//! Admin Security Policies handlers.
//!
//! Provides endpoints for managing security policies, viewing active sessions,
//! force-revoking sessions, and reviewing recent failed login attempts.
//!
//! All routes require admin role (enforced by the router middleware).

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::{Error, Result};
use uuid::Uuid;

use crate::AppState;

// =============================================================================
// SecurityPolicies
// =============================================================================

/// Organisation-wide security policies managed by admins.
#[derive(Debug, Clone, Serialize, Deserialize)]
/// SecurityPolicies data transfer object.
pub struct SecurityPolicies {
    /// Minimum password length in characters.
    pub password_min_length: u32,
    /// Require at least one uppercase letter in passwords.
    pub password_require_uppercase: bool,
    /// Require at least one numeric digit in passwords.
    pub password_require_numbers: bool,
    /// Require at least one special character in passwords.
    pub password_require_special: bool,
    /// Maximum session duration in hours (0 = unlimited).
    pub max_session_duration_hours: u32,
    /// Maximum concurrent active sessions per user (0 = unlimited).
    pub max_concurrent_sessions: u32,
    /// Number of consecutive failed logins before account lockout.
    pub failed_login_lockout_attempts: u32,
    /// Duration (minutes) an account remains locked after exceeding the threshold.
    pub failed_login_lockout_duration_minutes: u32,
}

impl Default for SecurityPolicies {
    fn default() -> Self {
        Self {
            password_min_length: 8,
            password_require_uppercase: true,
            password_require_numbers: true,
            password_require_special: false,
            max_session_duration_hours: 24,
            max_concurrent_sessions: 5,
            failed_login_lockout_attempts: 5,
            failed_login_lockout_duration_minutes: 15,
        }
    }
}

// =============================================================================
// ActiveSession
// =============================================================================

/// Represents a currently active user session.
#[derive(Debug, Clone, Serialize, Deserialize)]
/// ActiveSession data transfer object.
pub struct ActiveSession {
    /// Unique session identifier (opaque token prefix).
    pub id: String,
    /// ID of the user who owns this session.
    pub user_id: Uuid,
    /// Username of the session owner.
    pub username: String,
    /// When the session was created.
    pub created_at: DateTime<Utc>,
    /// When the session expires.
    pub expires_at: DateTime<Utc>,
    /// Client IP address, if available.
    pub ip_address: Option<String>,
    /// User-Agent string, if available.
    pub user_agent: Option<String>,
}

// =============================================================================
// LoginAttempt
// =============================================================================

/// A record of a failed login attempt.
#[derive(Debug, Clone, Serialize, Deserialize)]
/// LoginAttempt data transfer object.
pub struct LoginAttempt {
    /// Unique identifier for this record.
    pub id: Uuid,
    /// Username that was attempted.
    pub username: String,
    /// Source IP address.
    pub ip_address: Option<String>,
    /// Reason the attempt failed.
    pub failure_reason: String,
    /// When the attempt occurred.
    pub attempted_at: DateTime<Utc>,
}

// =============================================================================
// In-memory stores (shared state helpers)
// =============================================================================

/// Thread-safe store for security policies.
#[derive(Debug, Clone)]
/// SecurityPoliciesStore data transfer object.
pub struct SecurityPoliciesStore {
    inner: std::sync::Arc<tokio::sync::RwLock<SecurityPolicies>>,
}

impl Default for SecurityPoliciesStore {
    fn default() -> Self {
        Self::new()
    }
}

impl SecurityPoliciesStore {
    pub fn new() -> Self {
        Self {
            inner: std::sync::Arc::new(tokio::sync::RwLock::new(SecurityPolicies::default())),
        }
    }

    #[tracing::instrument(skip_all)]
    pub async fn get(&self) -> SecurityPolicies {
        self.inner.read().await.clone()
    }

    #[tracing::instrument(skip_all)]
    pub async fn set(&self, policies: SecurityPolicies) {
        *self.inner.write().await = policies;
    }
}

/// Thread-safe store for active sessions.
#[derive(Debug, Clone)]
/// ActiveSessionsStore data transfer object.
pub struct ActiveSessionsStore {
    inner: std::sync::Arc<tokio::sync::Mutex<Vec<ActiveSession>>>,
}

impl Default for ActiveSessionsStore {
    fn default() -> Self {
        Self::new()
    }
}

impl ActiveSessionsStore {
    pub fn new() -> Self {
        Self {
            inner: std::sync::Arc::new(tokio::sync::Mutex::new(Vec::new())),
        }
    }

    /// Register a new active session.
    #[tracing::instrument(skip_all)]
    pub async fn add(&self, session: ActiveSession) {
        let mut sessions = self.inner.lock().await;
        sessions.push(session);
    }

    /// List all sessions that have not yet expired.
    #[tracing::instrument(skip_all)]
    pub async fn list_active(&self) -> Vec<ActiveSession> {
        let sessions = self.inner.lock().await;
        let now = Utc::now();
        sessions
            .iter()
            .filter(|s| s.expires_at > now)
            .cloned()
            .collect()
    }

    /// Remove a session by its ID. Returns true if found and removed.
    #[tracing::instrument(skip_all)]
    pub async fn remove(&self, session_id: &str) -> bool {
        let mut sessions = self.inner.lock().await;
        let before = sessions.len();
        sessions.retain(|s| s.id != session_id);
        sessions.len() < before
    }

    /// Purge all expired sessions (housekeeping).
    #[tracing::instrument(skip_all)]
    pub async fn purge_expired(&self) {
        let mut sessions = self.inner.lock().await;
        let now = Utc::now();
        sessions.retain(|s| s.expires_at > now);
    }
}

/// Thread-safe store for recent failed login attempts.
#[derive(Debug, Clone)]
/// LoginAttemptsStore data transfer object.
pub struct LoginAttemptsStore {
    inner: std::sync::Arc<tokio::sync::Mutex<Vec<LoginAttempt>>>,
}

impl Default for LoginAttemptsStore {
    fn default() -> Self {
        Self::new()
    }
}

impl LoginAttemptsStore {
    pub fn new() -> Self {
        Self {
            inner: std::sync::Arc::new(tokio::sync::Mutex::new(Vec::new())),
        }
    }

    /// Record a failed login attempt.
    #[tracing::instrument(skip_all)]
    pub async fn record(&self, attempt: LoginAttempt) {
        const MAX_ENTRIES: usize = 5_000;
        let mut attempts = self.inner.lock().await;
        if attempts.len() >= MAX_ENTRIES {
            attempts.remove(0);
        }
        attempts.push(attempt);
    }

    /// Return the most recent `limit` entries (newest first).
    #[tracing::instrument(skip_all)]
    pub async fn recent(&self, limit: usize) -> Vec<LoginAttempt> {
        let attempts = self.inner.lock().await;
        attempts.iter().rev().take(limit).cloned().collect()
    }
}

// =============================================================================
// Query / request types
// =============================================================================

/// Query parameters for listing login attempts.
#[derive(Debug, Deserialize)]
/// Query parameters for filtering results.
pub struct LoginAttemptsQuery {
    /// Maximum entries to return (default 50, max 200).
    pub limit: Option<usize>,
}

// =============================================================================
// Handlers
// =============================================================================

/// GET /api/v1/admin/security/policies
///
/// Returns the current security policies.
#[tracing::instrument(skip(state))]
pub async fn get_policies(State(state): State<AppState>) -> Result<Json<SecurityPolicies>> {
    let policies = state.security_policies.get().await;
    Ok(Json(policies))
}

/// PUT /api/v1/admin/security/policies
///
/// Replaces the current security policies with the supplied payload.
#[tracing::instrument(skip(state, payload))]
pub async fn update_policies(
    State(state): State<AppState>,
    Json(payload): Json<SecurityPolicies>,
) -> Result<Json<SecurityPolicies>> {
    // Basic validation
    if payload.password_min_length < 6 {
        return Err(Error::Validation(
            "password_min_length must be at least 6".to_string(),
        ));
    }
    if payload.failed_login_lockout_attempts == 0 {
        return Err(Error::Validation(
            "failed_login_lockout_attempts must be greater than 0".to_string(),
        ));
    }

    state.security_policies.set(payload.clone()).await;
    tracing::info!("Security policies updated by admin");
    Ok(Json(payload))
}

/// GET /api/v1/admin/security/sessions
///
/// Lists all currently active (non-expired) user sessions.
#[tracing::instrument(skip(state))]
pub async fn list_sessions(State(state): State<AppState>) -> Result<Json<Vec<ActiveSession>>> {
    // Housekeep expired sessions before returning
    state.active_sessions.purge_expired().await;
    let sessions = state.active_sessions.list_active().await;
    Ok(Json(sessions))
}

/// DELETE /api/v1/admin/security/sessions/:id
///
/// Force-terminates a session by its ID.
/// The session is removed from the active-sessions store;
/// the associated token is also blacklisted in the cache so
/// in-flight requests are rejected immediately.
#[tracing::instrument(skip(state))]
pub async fn revoke_session(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<StatusCode> {
    let removed = state.active_sessions.remove(&id).await;

    if !removed {
        return Err(Error::NotFound(format!("Session {} not found", id)));
    }

    // Blacklist the token in the cache so active JWTs are immediately rejected.
    // We use a long TTL (max session duration from policies) since we cannot
    // know the exact remaining TTL without decoding the token here.
    let policies = state.security_policies.get().await;
    let blacklist_ttl =
        std::time::Duration::from_secs(policies.max_session_duration_hours as u64 * 3600);
    let blacklist_key = format!("blacklist:{}", id);
    state
        .cache
        .set(&blacklist_key, "revoked", blacklist_ttl)
        .await;

    tracing::info!(session_id = %id, "Admin revoked session");
    Ok(StatusCode::NO_CONTENT)
}

/// GET /api/v1/admin/security/login-attempts
///
/// Returns recent failed login attempts (newest first).
#[tracing::instrument(skip(state))]
pub async fn list_login_attempts(
    State(state): State<AppState>,
    axum::extract::Query(query): axum::extract::Query<LoginAttemptsQuery>,
) -> Result<Json<Vec<LoginAttempt>>> {
    let limit = query.limit.unwrap_or(50).min(200);
    let attempts = state.login_attempts.recent(limit).await;
    Ok(Json(attempts))
}
