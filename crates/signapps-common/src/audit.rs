//! Audit Trail / Activity Log foundation.
//!
//! Provides in-memory audit logging for tracking user actions across services.
//! Records mutations (POST/PUT/DELETE) automatically via middleware,
//! and exposes a GET endpoint for querying recent entries.

use axum::{
    extract::{Query, Request, State},
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fmt;
use std::sync::{Arc, Mutex};
use uuid::Uuid;

use crate::Claims;

// =============================================================================
// AuditAction
// =============================================================================

/// Categorised action types for audit entries.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AuditAction {
    Create,
    Read,
    Update,
    Delete,
    Login,
    Logout,
    Export,
    Custom(String),
}

impl fmt::Display for AuditAction {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AuditAction::Create => write!(f, "create"),
            AuditAction::Read => write!(f, "read"),
            AuditAction::Update => write!(f, "update"),
            AuditAction::Delete => write!(f, "delete"),
            AuditAction::Login => write!(f, "login"),
            AuditAction::Logout => write!(f, "logout"),
            AuditAction::Export => write!(f, "export"),
            AuditAction::Custom(s) => write!(f, "custom:{s}"),
        }
    }
}

/// Map an HTTP method to the corresponding audit action.
fn action_from_method(method: &axum::http::Method) -> AuditAction {
    match *method {
        axum::http::Method::POST => AuditAction::Create,
        axum::http::Method::PUT | axum::http::Method::PATCH => AuditAction::Update,
        axum::http::Method::DELETE => AuditAction::Delete,
        _ => AuditAction::Read,
    }
}

// =============================================================================
// AuditEntry
// =============================================================================

/// A single audit log entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEntry {
    /// Unique identifier for this entry.
    pub id: Uuid,
    /// The user who performed the action.
    pub actor_id: Uuid,
    /// What action was taken.
    pub action: String,
    /// The type of resource affected (e.g. "user", "document").
    pub resource_type: String,
    /// Identifier of the affected resource (path-based).
    pub resource_id: String,
    /// JSON diff / payload of changes, if applicable.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub changes: Option<serde_json::Value>,
    /// IP address of the caller.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ip_address: Option<String>,
    /// When the action occurred.
    pub timestamp: DateTime<Utc>,
}

// =============================================================================
// AuditLog (in-memory store)
// =============================================================================

/// Maximum number of entries kept in memory.
const MAX_ENTRIES: usize = 10_000;

/// Thread-safe, in-memory audit log.
#[derive(Debug, Clone)]
pub struct AuditLog {
    entries: Arc<Mutex<Vec<AuditEntry>>>,
}

impl Default for AuditLog {
    fn default() -> Self {
        Self::new()
    }
}

impl AuditLog {
    /// Create an empty audit log.
    pub fn new() -> Self {
        Self {
            entries: Arc::new(Mutex::new(Vec::new())),
        }
    }

    /// Append an entry, evicting the oldest when the cap is reached.
    pub fn push(&self, entry: AuditEntry) {
        let mut entries = self.entries.lock().expect("audit lock poisoned");
        if entries.len() >= MAX_ENTRIES {
            entries.remove(0);
        }
        entries.push(entry);
    }

    /// Return the most recent `limit` entries (newest first).
    pub fn recent(&self, limit: usize) -> Vec<AuditEntry> {
        let entries = self.entries.lock().expect("audit lock poisoned");
        entries.iter().rev().take(limit).cloned().collect()
    }

    /// Return entries filtered by actor.
    pub fn by_actor(&self, actor_id: Uuid, limit: usize) -> Vec<AuditEntry> {
        let entries = self.entries.lock().expect("audit lock poisoned");
        entries
            .iter()
            .rev()
            .filter(|e| e.actor_id == actor_id)
            .take(limit)
            .cloned()
            .collect()
    }

    /// Total number of stored entries.
    pub fn len(&self) -> usize {
        self.entries.lock().expect("audit lock poisoned").len()
    }

    /// Whether the log is empty.
    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

// =============================================================================
// Middleware
// =============================================================================

/// Trait that application state must implement to use audit middleware.
pub trait AuditState: Clone + Send + Sync + 'static {
    /// Provide access to the shared audit log.
    fn audit_log(&self) -> &AuditLog;
}

/// Axum middleware that automatically logs mutations (POST/PUT/PATCH/DELETE).
///
/// Must be applied **after** `auth_middleware` so that `Claims` are available
/// in request extensions.
pub async fn audit_middleware<S: AuditState>(
    State(state): State<S>,
    request: Request,
    next: Next,
) -> Response {
    let method = request.method().clone();

    // Only audit mutations
    if method == axum::http::Method::GET || method == axum::http::Method::HEAD || method == axum::http::Method::OPTIONS {
        return next.run(request).await;
    }

    let path = request.uri().path().to_string();
    let action = action_from_method(&method);
    let actor_id = request.extensions().get::<Claims>().map(|c| c.sub);

    let ip_address = request
        .headers()
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.split(',').next().unwrap_or(s).trim().to_string());

    let response = next.run(request).await;

    // Only record if we know who performed the action
    if let Some(actor_id) = actor_id {
        let entry = AuditEntry {
            id: Uuid::new_v4(),
            actor_id,
            action: action.to_string(),
            resource_type: extract_resource_type(&path),
            resource_id: path,
            changes: None,
            ip_address,
            timestamp: Utc::now(),
        };

        state.audit_log().push(entry);
    }

    response
}

/// Derive a resource type from the request path.
///
/// E.g. `/api/v1/users/123` -> `"users"`
fn extract_resource_type(path: &str) -> String {
    path.split('/')
        .filter(|s| !s.is_empty() && *s != "api" && !s.starts_with('v'))
        .find(|s| !Uuid::try_parse(s).is_ok() && s.parse::<u64>().is_err())
        .unwrap_or("unknown")
        .to_string()
}

// =============================================================================
// Query handler
// =============================================================================

/// Query parameters for the audit list endpoint.
#[derive(Debug, Deserialize)]
pub struct AuditQuery {
    /// Maximum entries to return (default 50, max 200).
    pub limit: Option<usize>,
    /// Filter by actor UUID.
    pub actor_id: Option<Uuid>,
}

/// GET /api/v1/audit — list recent audit entries.
///
/// Requires admin role (enforce via middleware on the router).
pub async fn list_audit_entries<S: AuditState>(
    State(state): State<S>,
    Query(params): Query<AuditQuery>,
) -> impl IntoResponse {
    let limit = params.limit.unwrap_or(50).min(200);

    let entries = match params.actor_id {
        Some(actor) => state.audit_log().by_actor(actor, limit),
        None => state.audit_log().recent(limit),
    };

    Json(entries)
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_entry(actor: Uuid) -> AuditEntry {
        AuditEntry {
            id: Uuid::new_v4(),
            actor_id: actor,
            action: AuditAction::Create.to_string(),
            resource_type: "users".into(),
            resource_id: "/api/v1/users".into(),
            changes: None,
            ip_address: Some("127.0.0.1".into()),
            timestamp: Utc::now(),
        }
    }

    #[test]
    fn test_audit_log_push_and_recent() {
        let log = AuditLog::new();
        let actor = Uuid::new_v4();

        log.push(sample_entry(actor));
        log.push(sample_entry(actor));

        assert_eq!(log.len(), 2);
        let recent = log.recent(10);
        assert_eq!(recent.len(), 2);
    }

    #[test]
    fn test_audit_log_cap() {
        let log = AuditLog::new();
        let actor = Uuid::new_v4();

        for _ in 0..MAX_ENTRIES + 50 {
            log.push(sample_entry(actor));
        }

        assert_eq!(log.len(), MAX_ENTRIES);
    }

    #[test]
    fn test_by_actor_filter() {
        let log = AuditLog::new();
        let a = Uuid::new_v4();
        let b = Uuid::new_v4();

        log.push(sample_entry(a));
        log.push(sample_entry(b));
        log.push(sample_entry(a));

        assert_eq!(log.by_actor(a, 10).len(), 2);
        assert_eq!(log.by_actor(b, 10).len(), 1);
    }

    #[test]
    fn test_extract_resource_type() {
        assert_eq!(extract_resource_type("/api/v1/users/123"), "users");
        assert_eq!(extract_resource_type("/api/v1/documents"), "documents");
        assert_eq!(extract_resource_type("/health"), "health");
    }

    #[test]
    fn test_action_display() {
        assert_eq!(AuditAction::Create.to_string(), "create");
        assert_eq!(AuditAction::Custom("import".into()).to_string(), "custom:import");
    }

    #[test]
    fn test_action_from_method() {
        assert_eq!(action_from_method(&axum::http::Method::POST), AuditAction::Create);
        assert_eq!(action_from_method(&axum::http::Method::PUT), AuditAction::Update);
        assert_eq!(action_from_method(&axum::http::Method::DELETE), AuditAction::Delete);
        assert_eq!(action_from_method(&axum::http::Method::GET), AuditAction::Read);
    }
}
