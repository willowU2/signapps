//! Windows Service support
//!
//! This module provides the Windows Service wrapper for SignApps services.
#![allow(dead_code)]

use crate::ShutdownSignal;
use std::ffi::OsString;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;
use windows_service::{
    define_windows_service,
    service::{
        ServiceControl, ServiceControlAccept, ServiceExitCode, ServiceState, ServiceStatus,
        ServiceType,
    },
    service_control_handler::{self, ServiceControlHandlerResult},
    service_dispatcher,
};

/// Definition for a Windows service.
pub struct ServiceDefinition {
    /// Service name (used in Windows Service Manager)
    pub name: String,
    /// Display name (shown in services.msc)
    pub display_name: String,
    /// Service description
    pub description: String,
    /// Dependencies (other service names that must start first)
    pub dependencies: Vec<String>,
}

impl ServiceDefinition {
    /// Create a new service definition with default values.
    pub fn new(name: &str) -> Self {
        Self {
            name: name.to_string(),
            display_name: name.to_string(),
            description: format!("{} SignApps service", name),
            dependencies: vec!["postgresql-x64-16".to_string()], // PostgreSQL dependency
        }
    }

    /// Set the display name.
    pub fn display_name(mut self, name: &str) -> Self {
        self.display_name = name.to_string();
        self
    }

    /// Set the description.
    pub fn description(mut self, desc: &str) -> Self {
        self.description = desc.to_string();
        self
    }

    /// Set dependencies.
    pub fn dependencies(mut self, deps: Vec<String>) -> Self {
        self.dependencies = deps;
        self
    }

    /// Add a dependency.
    pub fn add_dependency(mut self, dep: &str) -> Self {
        self.dependencies.push(dep.to_string());
        self
    }
}

// Global state for the service
static SERVICE_STATE: once_cell::sync::Lazy<Arc<Mutex<Option<ShutdownSignal>>>> =
    once_cell::sync::Lazy::new(|| Arc::new(Mutex::new(None)));

// Type for the service main function - use Arc<dyn Fn> for clonability
type ServiceMainFn = Arc<
    dyn Fn(
            ShutdownSignal,
        )
            -> std::pin::Pin<Box<dyn std::future::Future<Output = anyhow::Result<()>> + Send>>
        + Send
        + Sync,
>;

static SERVICE_MAIN_FN: once_cell::sync::Lazy<Arc<Mutex<Option<ServiceMainFn>>>> =
    once_cell::sync::Lazy::new(|| Arc::new(Mutex::new(None)));

static SERVICE_NAME: once_cell::sync::Lazy<Arc<Mutex<String>>> =
    once_cell::sync::Lazy::new(|| Arc::new(Mutex::new(String::new())));

/// Run the application as a Windows service.
///
/// This function should be called from main() when running as a service.
/// It will block until the service is stopped.
///
/// # Arguments
///
/// * `definition` - Service definition with name, description, etc.
/// * `service_main` - Async function that runs the actual service logic
///
/// # Example
///
/// ```rust,ignore
/// async fn my_service_main(shutdown: ShutdownSignal) -> anyhow::Result<()> {
///     // Start your server here
///     // Use shutdown.wait() to know when to stop
///     Ok(())
/// }
///
/// fn main() -> anyhow::Result<()> {
///     let def = ServiceDefinition::new("signapps-identity");
///     run_as_service(def, my_service_main)
/// }
/// ```
pub fn run_as_service<F, Fut>(definition: ServiceDefinition, service_main: F) -> anyhow::Result<()>
where
    F: Fn(ShutdownSignal) -> Fut + Send + Sync + 'static,
    Fut: std::future::Future<Output = anyhow::Result<()>> + Send + 'static,
{
    // Store the service name
    {
        let mut name = SERVICE_NAME.blocking_lock();
        *name = definition.name.clone();
    }

    // Store the service main function (we need to wrap it in Arc)
    {
        let service_main = Arc::new(service_main);
        let mut main_fn = SERVICE_MAIN_FN.blocking_lock();
        *main_fn = Some(Arc::new(move |shutdown| {
            let service_main = service_main.clone();
            Box::pin(async move { service_main(shutdown).await })
        }));
    }

    // Run the service dispatcher
    service_dispatcher::start(&definition.name, ffi_service_main)?;

    Ok(())
}

// FFI entry point for Windows Service
define_windows_service!(ffi_service_main, service_main_wrapper);

fn service_main_wrapper(_arguments: Vec<OsString>) {
    if let Err(e) = run_service() {
        tracing::error!("Service failed: {}", e);
    }
}

fn run_service() -> anyhow::Result<()> {
    // Create shutdown signal
    let shutdown = ShutdownSignal::new();

    // Store shutdown signal for the control handler
    {
        let mut state = SERVICE_STATE.blocking_lock();
        *state = Some(shutdown.clone());
    }

    // Get service name
    let service_name = {
        let name = SERVICE_NAME.blocking_lock();
        name.clone()
    };

    // Define the control handler
    let shutdown_clone = shutdown.clone();
    let event_handler = move |control_event| -> ServiceControlHandlerResult {
        match control_event {
            ServiceControl::Stop | ServiceControl::Shutdown => {
                tracing::info!("Received stop/shutdown control event");
                shutdown_clone.trigger();
                ServiceControlHandlerResult::NoError
            },
            ServiceControl::Interrogate => ServiceControlHandlerResult::NoError,
            _ => ServiceControlHandlerResult::NotImplemented,
        }
    };

    // Register the control handler
    let status_handle = service_control_handler::register(&service_name, event_handler)?;

    // Report running status
    status_handle.set_service_status(ServiceStatus {
        service_type: ServiceType::OWN_PROCESS,
        current_state: ServiceState::Running,
        controls_accepted: ServiceControlAccept::STOP | ServiceControlAccept::SHUTDOWN,
        exit_code: ServiceExitCode::Win32(0),
        checkpoint: 0,
        wait_hint: Duration::default(),
        process_id: None,
    })?;

    // Get the service main function
    let service_main = {
        let main_fn = SERVICE_MAIN_FN.blocking_lock();
        main_fn.clone()
    };

    // Create tokio runtime and run the service
    let rt = tokio::runtime::Runtime::new()?;
    let result = rt.block_on(async {
        if let Some(main_fn) = service_main {
            main_fn(shutdown).await
        } else {
            Err(anyhow::anyhow!("Service main function not set"))
        }
    });

    // Report stopped status
    let exit_code = if result.is_ok() {
        ServiceExitCode::Win32(0)
    } else {
        tracing::error!("Service exited with error: {:?}", result);
        ServiceExitCode::Win32(1)
    };

    status_handle.set_service_status(ServiceStatus {
        service_type: ServiceType::OWN_PROCESS,
        current_state: ServiceState::Stopped,
        controls_accepted: ServiceControlAccept::empty(),
        exit_code,
        checkpoint: 0,
        wait_hint: Duration::default(),
        process_id: None,
    })?;

    result
}

/// Check if the process is running as a Windows service.
///
/// Returns true if running as a service, false if running interactively.
pub fn is_running_as_service() -> bool {
    // Check for common indicators that we're running as a service:
    // 1. No console attached
    // 2. Parent process is services.exe
    //
    // For simplicity, we check if SIGNAPPS_SERVICE env var is set
    std::env::var("SIGNAPPS_SERVICE").is_ok()
}

/// Install the service using sc.exe
///
/// This is a helper function that generates the sc.exe command.
/// It should be run with administrator privileges.
pub fn generate_install_command(definition: &ServiceDefinition, exe_path: &str) -> String {
    let deps = if definition.dependencies.is_empty() {
        String::new()
    } else {
        format!(" depend= {}", definition.dependencies.join("/"))
    };

    format!(
        r#"sc.exe create "{}" binPath= "{}" start= auto DisplayName= "{}"{}"#,
        definition.name, exe_path, definition.display_name, deps
    )
}

/// Generate the uninstall command
pub fn generate_uninstall_command(service_name: &str) -> String {
    format!(r#"sc.exe delete "{}""#, service_name)
}
