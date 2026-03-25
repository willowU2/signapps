//! Security Event Alert System.
//!
//! Logs security-relevant events (failed logins, permission denials,
//! suspicious patterns) for monitoring and alerting.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tracing::{error, warn, info};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SecurityEventType {
    FailedLogin,
    PermissionDenied,
    SuspiciousActivity,
    BruteForceAttempt,
    TokenRevoked,
    PasswordChanged,
    MfaEnabled,
    MfaDisabled,
    ApiKeyCreated,
    ApiKeyRevoked,
    DataExport,
    BulkDeletion,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Severity {
    Info,
    Warning,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityEvent {
    pub event_type: SecurityEventType,
    pub severity: Severity,
    pub actor_id: Option<String>,
    pub ip_address: Option<String>,
    pub resource: Option<String>,
    pub details: String,
    pub timestamp: DateTime<Utc>,
}

impl SecurityEvent {
    pub fn new(event_type: SecurityEventType, details: impl Into<String>) -> Self {
        let severity = match &event_type {
            SecurityEventType::FailedLogin => Severity::Warning,
            SecurityEventType::BruteForceAttempt => Severity::Critical,
            SecurityEventType::SuspiciousActivity => Severity::Critical,
            SecurityEventType::BulkDeletion => Severity::Warning,
            SecurityEventType::PermissionDenied => Severity::Warning,
            _ => Severity::Info,
        };

        Self {
            event_type,
            severity,
            actor_id: None,
            ip_address: None,
            resource: None,
            details: details.into(),
            timestamp: Utc::now(),
        }
    }

    pub fn with_actor(mut self, actor_id: impl Into<String>) -> Self {
        self.actor_id = Some(actor_id.into());
        self
    }

    pub fn with_ip(mut self, ip: impl Into<String>) -> Self {
        self.ip_address = Some(ip.into());
        self
    }

    pub fn with_resource(mut self, resource: impl Into<String>) -> Self {
        self.resource = Some(resource.into());
        self
    }

    /// Emit the security event to structured logs.
    pub fn emit(&self) {
        let json = serde_json::to_string(self).unwrap_or_default();
        match self.severity {
            Severity::Critical => error!(security_event = %json, "SECURITY CRITICAL"),
            Severity::Warning => warn!(security_event = %json, "SECURITY WARNING"),
            Severity::Info => info!(security_event = %json, "SECURITY INFO"),
        }
    }
}

/// Convenience: log a failed login attempt.
pub fn log_failed_login(username: &str, ip: &str) {
    SecurityEvent::new(
        SecurityEventType::FailedLogin,
        format!("Failed login attempt for user: {username}"),
    )
    .with_actor(username)
    .with_ip(ip)
    .emit();
}

/// Convenience: log a permission denial.
pub fn log_permission_denied(actor_id: &str, resource: &str, action: &str) {
    SecurityEvent::new(
        SecurityEventType::PermissionDenied,
        format!("Permission denied: {action} on {resource}"),
    )
    .with_actor(actor_id)
    .with_resource(resource)
    .emit();
}
