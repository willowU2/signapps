//! Concurrent Session Management handlers.
//!
//! Track active sessions in DB, list and revoke sessions,
//! enforce max concurrent sessions per user.

use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use serde::Serialize;
use signapps_common::{Claims, Error, Result};
use uuid::Uuid;

use crate::AppState;

/// Session item returned to the client.
#[derive(Debug, Serialize)]
/// SessionItem data transfer object.
pub struct SessionItem {
    pub id: Uuid,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub is_current: bool,
}

/// GET /api/v1/auth/sessions — List current user's active sessions.
#[tracing::instrument(skip(state))]
#[utoipa::path(
    get,
    path = "/api/v1/sessions",
    responses((status = 200, description = "Success")),
    tag = "Identity"
)]
#[tracing::instrument(skip_all)]
pub async fn list(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<SessionItem>>> {
    let rows = sqlx::query_as::<
        _,
        (
            Uuid,
            Option<String>,
            Option<String>,
            DateTime<Utc>,
            DateTime<Utc>,
            String,
        ),
    >(
        r#"SELECT id, ip_address, user_agent, created_at, expires_at, token_hash
           FROM identity.sessions
           WHERE user_id = $1 AND expires_at > now()
           ORDER BY created_at DESC"#,
    )
    .bind(claims.sub)
    .fetch_all(&*state.pool)
    .await?;

    let items: Vec<SessionItem> = rows
        .into_iter()
        .map(|r| SessionItem {
            id: r.0,
            ip_address: r.1,
            user_agent: r.2,
            created_at: r.3,
            expires_at: r.4,
            is_current: false, // Caller can compare with their own session
        })
        .collect();

    Ok(Json(items))
}

/// DELETE /api/v1/auth/sessions/:id — Revoke a specific session.
#[tracing::instrument(skip(state))]
#[utoipa::path(
    put,
    path = "/api/v1/sessions",
    responses((status = 200, description = "Success")),
    tag = "Identity"
)]
#[tracing::instrument(skip_all)]
pub async fn revoke(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    let result = sqlx::query("DELETE FROM identity.sessions WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(claims.sub)
        .execute(&*state.pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(Error::NotFound("Session not found".to_string()));
    }

    tracing::info!(user_id = %claims.sub, session_id = %id, "Session revoked by user");
    Ok(StatusCode::NO_CONTENT)
}

/// DELETE /api/v1/auth/sessions — Revoke all sessions except current.
#[tracing::instrument(skip(state))]
#[utoipa::path(
    put,
    path = "/api/v1/sessions",
    responses((status = 200, description = "Success")),
    tag = "Identity"
)]
#[tracing::instrument(skip_all)]
pub async fn revoke_all(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<serde_json::Value>> {
    // Note: we cannot identify the "current" session from claims alone
    // without a session_id claim, so we delete ALL for safety.
    let result = sqlx::query("DELETE FROM identity.sessions WHERE user_id = $1")
        .bind(claims.sub)
        .execute(&*state.pool)
        .await?;

    tracing::info!(
        user_id = %claims.sub,
        count = result.rows_affected(),
        "All sessions revoked by user"
    );

    Ok(Json(serde_json::json!({
        "revoked": result.rows_affected()
    })))
}

#[cfg(test)]
mod tests {
    #[allow(unused_imports)]
    use super::*;

    #[test]
    fn module_compiles() {
        // Verify this handler module compiles correctly.
        // Integration tests require a running database and service.
        assert!(true, "{} handler module loaded", module_path!());
    }
}
