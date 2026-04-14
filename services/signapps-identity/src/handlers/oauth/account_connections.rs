//! User-facing list of OAuth-connected accounts.
//!
//! # Endpoints
//!
//! | Method | Path | Description |
//! |--------|------|-------------|
//! | `GET` | `/api/v1/account/oauth-connections` | List all OAuth-connected accounts for the current user |
//! | `POST` | `/api/v1/account/oauth-connections/:source_table/:id/disconnect` | Revoke a connection |

use crate::AppState;
use axum::extract::{Extension, Path, State};
use axum::Json;
use chrono::{DateTime, Utc};
use serde::Serialize;
use signapps_common::{Claims, Error};
use sqlx::PgPool;
use tracing::instrument;
use uuid::Uuid;

// ── Response types ────────────────────────────────────────────────────────────

/// A single OAuth-connected account as returned by `list_connections`.
#[derive(Debug, Serialize)]
pub struct ConnectionRow {
    /// Row UUID from the source table.
    pub id: Uuid,
    /// Which table holds the row (`"mail.accounts"`, `"calendar.provider_connections"`,
    /// `"social.accounts"`).
    pub source_table: String,
    /// OAuth provider key (e.g. `"google"`, `"microsoft"`).
    pub provider_key: String,
    /// Email address associated with the connection (only for mail accounts).
    pub display_email: Option<String>,
    /// `"connected"` or `"needs_reconnect"`.
    pub status: String,
    /// When the access token expires (if known).
    pub expires_at: Option<DateTime<Utc>>,
    /// Whether the refresh queue has disabled this entry.
    pub disabled: bool,
    /// Last error message from the refresh job, if any.
    pub last_error: Option<String>,
}

// ── Handlers ──────────────────────────────────────────────────────────────────

/// GET /api/v1/account/oauth-connections
///
/// Lists every mail, calendar, and social row for the current user that
/// has a `refresh_token_enc` set. Joins with `identity.oauth_refresh_queue`
/// to surface `"connected"` vs `"needs_reconnect"` status and the last
/// error message if the token refresh has failed.
///
/// # Errors
///
/// - `Error::Internal` on database failures.
#[instrument(skip(state, claims), fields(user_id = %claims.sub))]
pub async fn list_connections(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<ConnectionRow>>, Error> {
    let pool = state.pool.inner();
    let mut out: Vec<ConnectionRow> = vec![];

    // ── mail.accounts ────────────────────────────────────────────────────────
    let mail: Vec<MailRow> = sqlx::query_as(
        "SELECT id, \
                COALESCE(oauth_provider_key, '') AS provider, \
                email_address, \
                oauth_expires_at \
         FROM mail.accounts \
         WHERE user_id = $1 AND oauth_refresh_token_enc IS NOT NULL",
    )
    .bind(claims.sub)
    .fetch_all(pool)
    .await
    .map_err(|e| Error::Internal(format!("mail.accounts query: {e}")))?;

    for r in mail {
        let q = lookup_queue_row(pool, "mail.accounts", r.id).await;
        out.push(ConnectionRow {
            id: r.id,
            source_table: "mail.accounts".into(),
            provider_key: r.provider,
            display_email: Some(r.email_address),
            status: status_from_queue(&q),
            expires_at: r.oauth_expires_at,
            disabled: q.as_ref().map(|q| q.disabled).unwrap_or(false),
            last_error: q.as_ref().and_then(|q| q.last_error.clone()),
        });
    }

    // ── calendar.provider_connections ────────────────────────────────────────
    let cal: Vec<CalRow> = sqlx::query_as(
        "SELECT id, provider, token_expires_at \
         FROM calendar.provider_connections \
         WHERE user_id = $1 AND refresh_token_enc IS NOT NULL",
    )
    .bind(claims.sub)
    .fetch_all(pool)
    .await
    .map_err(|e| Error::Internal(format!("calendar.provider_connections query: {e}")))?;

    for r in cal {
        let q = lookup_queue_row(pool, "calendar.provider_connections", r.id).await;
        out.push(ConnectionRow {
            id: r.id,
            source_table: "calendar.provider_connections".into(),
            provider_key: r.provider,
            display_email: None,
            status: status_from_queue(&q),
            expires_at: r.token_expires_at,
            disabled: q.as_ref().map(|q| q.disabled).unwrap_or(false),
            last_error: q.as_ref().and_then(|q| q.last_error.clone()),
        });
    }

    // ── social.accounts ──────────────────────────────────────────────────────
    let soc: Vec<SocRow> = sqlx::query_as(
        "SELECT id, platform, token_expires_at \
         FROM social.accounts \
         WHERE user_id = $1 AND refresh_token_enc IS NOT NULL",
    )
    .bind(claims.sub)
    .fetch_all(pool)
    .await
    .map_err(|e| Error::Internal(format!("social.accounts query: {e}")))?;

    for r in soc {
        let q = lookup_queue_row(pool, "social.accounts", r.id).await;
        out.push(ConnectionRow {
            id: r.id,
            source_table: "social.accounts".into(),
            provider_key: r.platform,
            display_email: None,
            status: status_from_queue(&q),
            expires_at: r.token_expires_at,
            disabled: q.as_ref().map(|q| q.disabled).unwrap_or(false),
            last_error: q.as_ref().and_then(|q| q.last_error.clone()),
        });
    }

    Ok(Json(out))
}

/// POST /api/v1/account/oauth-connections/:source_table/:id/disconnect
///
/// Drops the encrypted tokens from the specified row, scoped to the calling
/// user via `WHERE user_id = claims.sub`. The row itself is not deleted —
/// the account remains but loses its OAuth credentials. The user must
/// re-authorize to reconnect.
///
/// # Errors
///
/// - `Error::BadRequest` if `source_table` is not a recognized value.
/// - `Error::Internal` on database failures.
#[instrument(skip(state, claims), fields(user_id = %claims.sub, source_table = %source_table, id = %id))]
pub async fn disconnect(
    Path((source_table, id)): Path<(String, Uuid)>,
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<serde_json::Value>, Error> {
    let pool = state.pool.inner();

    let sql = match source_table.as_str() {
        "mail.accounts" => {
            "UPDATE mail.accounts \
             SET oauth_access_token_enc = NULL, \
                 oauth_refresh_token_enc = NULL, \
                 oauth_expires_at = NULL, \
                 oauth_provider_key = NULL, \
                 updated_at = NOW() \
             WHERE id = $1 AND user_id = $2"
        }
        "calendar.provider_connections" => {
            "UPDATE calendar.provider_connections \
             SET access_token_enc = NULL, \
                 refresh_token_enc = NULL, \
                 token_expires_at = NULL, \
                 updated_at = NOW() \
             WHERE id = $1 AND user_id = $2"
        }
        "social.accounts" => {
            "UPDATE social.accounts \
             SET access_token_enc = NULL, \
                 refresh_token_enc = NULL, \
                 token_expires_at = NULL, \
                 updated_at = NOW() \
             WHERE id = $1 AND user_id = $2"
        }
        _ => {
            return Err(Error::BadRequest(format!(
                "unknown source_table: {source_table:?}"
            )))
        }
    };

    sqlx::query(sql)
        .bind(id)
        .bind(claims.sub)
        .execute(pool)
        .await
        .map_err(|e| Error::Internal(format!("disconnect {source_table}: {e}")))?;

    Ok(Json(serde_json::json!({ "ok": true })))
}

// ── Private helpers ───────────────────────────────────────────────────────────

#[derive(sqlx::FromRow)]
struct MailRow {
    id: Uuid,
    provider: String,
    email_address: String,
    oauth_expires_at: Option<DateTime<Utc>>,
}

#[derive(sqlx::FromRow)]
struct CalRow {
    id: Uuid,
    provider: String,
    token_expires_at: Option<DateTime<Utc>>,
}

#[derive(sqlx::FromRow)]
struct SocRow {
    id: Uuid,
    platform: String,
    token_expires_at: Option<DateTime<Utc>>,
}

struct QueueState {
    disabled: bool,
    last_error: Option<String>,
}

/// Fetch the `oauth_refresh_queue` row for a given `(source_table, source_id)` pair.
///
/// Returns `None` if no queue entry exists (the connection has never been
/// queued for refresh, which is normal for freshly created accounts).
async fn lookup_queue_row(
    pool: &PgPool,
    source_table: &str,
    source_id: Uuid,
) -> Option<QueueState> {
    sqlx::query_as::<_, (bool, Option<String>)>(
        "SELECT disabled, last_error \
         FROM identity.oauth_refresh_queue \
         WHERE source_table = $1 AND source_id = $2",
    )
    .bind(source_table)
    .bind(source_id)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()
    .map(|(disabled, last_error)| QueueState { disabled, last_error })
}

/// Map a `QueueState` to a human-readable connection status string.
fn status_from_queue(q: &Option<QueueState>) -> String {
    match q {
        Some(qs) if qs.disabled => "needs_reconnect".into(),
        _ => "connected".into(),
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn module_compiles() {
        let _ = module_path!();
    }
}
