//! Windows Event Log integration
//!
//! Provides logging to Windows Event Log for services.

use eventlog::EventLog;

/// Logger that writes to Windows Event Log.
pub struct EventLogger {
    log: EventLog,
    service_name: String,
}

impl EventLogger {
    /// Create a new event logger for the given service.
    ///
    /// The service name should match the Windows service name.
    pub fn new(service_name: &str) -> anyhow::Result<Self> {
        let log = EventLog::new(service_name, None)?;
        Ok(Self {
            log,
            service_name: service_name.to_string(),
        })
    }

    /// Log an informational message.
    pub fn info(&self, message: &str) {
        if let Err(e) = self.log.info(message) {
            eprintln!("Failed to write to event log: {}", e);
        }
    }

    /// Log a warning message.
    pub fn warn(&self, message: &str) {
        if let Err(e) = self.log.warn(message) {
            eprintln!("Failed to write to event log: {}", e);
        }
    }

    /// Log an error message.
    pub fn error(&self, message: &str) {
        if let Err(e) = self.log.error(message) {
            eprintln!("Failed to write to event log: {}", e);
        }
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
