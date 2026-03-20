//! Windows Event Log integration
//!
//! Provides logging to Windows Event Log for services.
//! Note: The eventlog crate is a simple logger that implements the log facade.

use log::Level;

/// Logger that writes to Windows Event Log.
pub struct EventLogger {
    service_name: String,
}

impl EventLogger {
    /// Create a new event logger for the given service.
    ///
    /// The service name should match the Windows service name.
    /// This initializes the eventlog crate as a global logger.
    pub fn new(service_name: &str) -> anyhow::Result<Self> {
        // Initialize eventlog as the global logger with Info level
        eventlog::init(service_name, Level::Info)?;
        Ok(Self {
            service_name: service_name.to_string(),
        })
    }

    /// Log an informational message using the log crate.
    pub fn info(&self, message: &str) {
        log::info!("{}", message);
    }

    /// Log a warning message using the log crate.
    pub fn warn(&self, message: &str) {
        log::warn!("{}", message);
    }

    /// Log an error message using the log crate.
    pub fn error(&self, message: &str) {
        log::error!("{}", message);
    }

    /// Get the service name.
    pub fn service_name(&self) -> &str {
        &self.service_name
    }
}

/// Register the service as an event source in Windows Event Log.
///
/// This should be called during service installation.
/// Requires administrator privileges.
pub fn register_event_source(service_name: &str) -> anyhow::Result<()> {
    eventlog::register(service_name)?;
    Ok(())
}

/// Deregister the service from Windows Event Log.
///
/// This should be called during service uninstallation.
/// Requires administrator privileges.
pub fn deregister_event_source(service_name: &str) -> anyhow::Result<()> {
    eventlog::deregister(service_name)?;
    Ok(())
}

/// Create a tracing layer that logs to Windows Event Log.
///
/// This can be used with tracing-subscriber to send logs to Event Log.
pub fn create_event_log_layer(
    _service_name: &str,
) -> impl tracing_subscriber::layer::Layer<tracing_subscriber::Registry> {
    // For now, we just return a no-op layer
    // A full implementation would create a custom tracing layer
    tracing_subscriber::layer::Identity::new()
}
