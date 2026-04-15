//! Internal endpoint used by service `checkout_token` for synchronous refresh.
//!
//! `POST /api/v1/oauth/internal/refresh`
//!
//! Protected by an `X-Internal-Token` shared-secret header (env var
//! `OAUTH_INTERNAL_TOKEN`). Not JWT-authenticated — this route sits on
//! `public_routes` and is only intended for internal service-to-service calls.
//!
//! # Body
//!
//! ```json
//! { "source_table": "mail.accounts", "source_id": "<uuid>" }
//! ```
//!
//! # Response
//!
//! ```json
//! { "access_token": "...", "expires_at": "2026-04-14T12:00:00Z" }
//! ```

use crate::AppState;
use axum::extract::{Json, State};
use axum::http::HeaderMap;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::Error as AppError;
use signapps_keystore::{decrypt_string, encrypt_string};
use signapps_oauth::{
    try_refresh, CalendarConnectionsTable, MailAccountsTable, RefreshOutcome, SocialAccountsTable,
    TokenTable,
};
use tracing::instrument;
use uuid::Uuid;

/// Request body for the internal refresh endpoint.
#[derive(Debug, Deserialize)]
pub struct InternalRefreshBody {
    /// Source table owning the token (e.g., `"mail.accounts"`).
    pub source_table: String,
    /// UUID of the row in the source table.
    pub source_id: Uuid,
}

/// Response body returned on a successful refresh.
#[derive(Debug, Serialize)]
pub struct InternalRefreshResponse {
    /// Plaintext access token, ready to use as a Bearer.
    pub access_token: String,
    /// When the new access token expires.
    pub expires_at: DateTime<Utc>,
}

/// `POST /api/v1/oauth/internal/refresh`
///
/// Synchronously refreshes an OAuth token for the given `source_table`/`source_id`
/// pair. Called by [`signapps_oauth::checkout_token`] when a token is approaching
/// expiry.
///
/// Auth is via a shared `X-Internal-Token` header verified against the
/// `OAUTH_INTERNAL_TOKEN` environment variable. Returns `401 Unauthorized`
/// on mismatch.
///
/// # Errors
///
/// - [`AppError::Unauthorized`] — missing or invalid `X-Internal-Token`.
/// - [`AppError::BadRequest`] — unknown `source_table`.
/// - [`AppError::NotFound`] — no queue row found for the given `(source_table, source_id)`.
/// - [`AppError::Internal`] — crypto failure (DEK unavailable or en/decryption error).
/// - [`AppError::ExternalService`] — provider revoked the refresh token or returned a
///   transient error.
///
/// # Panics
///
/// No panics — all errors propagate via `Result`.
#[instrument(skip(state, headers, body))]
pub async fn internal_refresh(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<InternalRefreshBody>,
) -> Result<Json<InternalRefreshResponse>, AppError> {
    // ── Auth: shared-secret check ────────────────────────────────────────────
    let expected = std::env::var("OAUTH_INTERNAL_TOKEN").unwrap_or_default();
    let provided = headers
        .get("X-Internal-Token")
        .and_then(|h| h.to_str().ok())
        .unwrap_or_default();
    if expected.is_empty() || provided != expected {
        return Err(AppError::Unauthorized);
    }

    // ── Resolve TokenTable handle ────────────────────────────────────────────
    let table: Box<dyn TokenTable> = match body.source_table.as_str() {
        "mail.accounts" => Box::new(MailAccountsTable),
        "calendar.provider_connections" => Box::new(CalendarConnectionsTable),
        "social.accounts" => Box::new(SocialAccountsTable),
        other => {
            return Err(AppError::BadRequest(format!(
                "unknown source_table: {other}"
            )));
        },
    };

    // ── Look up (tenant_id, provider_key) from the refresh queue row ─────────
    let pool = state.pool.inner().clone();
    let q: Option<(Uuid, Uuid, String)> = sqlx::query_as(
        "SELECT tenant_id, user_id, provider_key \
         FROM identity.oauth_refresh_queue \
         WHERE source_table = $1 AND source_id = $2",
    )
    .bind(&body.source_table)
    .bind(body.source_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| AppError::Internal(format!("queue lookup: {e}")))?;

    let (tenant_id, _user_id, provider_key) = q.ok_or_else(|| {
        AppError::NotFound(format!(
            "no queue row for {}.{}",
            body.source_table, body.source_id
        ))
    })?;

    // ── Load encrypted tokens + decrypt refresh token ─────────────────────────
    let enc = table
        .load(&pool, body.source_id)
        .await
        .map_err(crate::handlers::oauth::error::oauth_error_to_app_error)?;
    let dek = state.keystore.dek("oauth-tokens-v1");
    let refresh_token = decrypt_string(&enc.refresh_token_enc, dek.as_ref())
        .map_err(|e| AppError::Internal(format!("decrypt refresh_token: {e}")))?;

    // ── Resolve provider definition + tenant credentials ─────────────────────
    let provider = state
        .oauth_engine_state
        .catalog
        .get(&provider_key)
        .map_err(|e| {
            crate::handlers::oauth::error::oauth_error_to_app_error(
                signapps_oauth::OAuthError::Catalog(e),
            )
        })?;
    let cfg = state
        .oauth_engine_state
        .configs
        .get(tenant_id, &provider_key)
        .await
        .map_err(crate::handlers::oauth::error::oauth_error_to_app_error)?
        .ok_or_else(|| {
            crate::handlers::oauth::error::oauth_error_to_app_error(
                signapps_oauth::OAuthError::ProviderNotConfigured,
            )
        })?;
    let creds = crate::handlers::oauth::creds::resolve_credentials(&cfg, &state.keystore)
        .map_err(crate::handlers::oauth::error::oauth_error_to_app_error)?;

    // ── Call provider's token refresh endpoint ────────────────────────────────
    let http = reqwest::Client::new();
    let outcome = try_refresh(
        &http,
        provider,
        &creds.client_id,
        &creds.client_secret,
        &refresh_token,
    )
    .await;

    // ── Handle outcome ────────────────────────────────────────────────────────
    match outcome {
        RefreshOutcome::Refreshed(tokens) => {
            let access_enc = encrypt_string(&tokens.access_token, dek.as_ref())
                .map_err(|e| AppError::Internal(format!("encrypt access_token: {e}")))?;
            let new_refresh_enc = match tokens.refresh_token.as_ref() {
                Some(rt) => encrypt_string(rt, dek.as_ref())
                    .map_err(|e| AppError::Internal(format!("encrypt new refresh_token: {e}")))?,
                // Provider did not issue a new refresh token — keep the existing one.
                None => enc.refresh_token_enc.clone(),
            };
            let new_expires_at = tokens
                .expires_in
                .map(|s| Utc::now() + chrono::Duration::seconds(s))
                .unwrap_or_else(|| Utc::now() + chrono::Duration::hours(1));

            table
                .update(
                    &pool,
                    body.source_id,
                    &access_enc,
                    &new_refresh_enc,
                    new_expires_at,
                )
                .await
                .map_err(crate::handlers::oauth::error::oauth_error_to_app_error)?;

            tracing::info!(
                source_table = %body.source_table,
                source_id = %body.source_id,
                provider = %provider_key,
                "internal_refresh: token refreshed successfully"
            );

            Ok(Json(InternalRefreshResponse {
                access_token: tokens.access_token,
                expires_at: new_expires_at,
            }))
        },
        RefreshOutcome::Revoked {
            error, description, ..
        } => {
            tracing::warn!(
                provider = %provider_key,
                error = %error,
                ?description,
                "internal_refresh: refresh token revoked by provider"
            );
            Err(AppError::ExternalService(format!(
                "refresh token revoked: {error} {description:?}"
            )))
        },
        RefreshOutcome::Transient { reason } => {
            tracing::warn!(
                provider = %provider_key,
                %reason,
                "internal_refresh: transient refresh failure"
            );
            Err(AppError::ExternalService(format!(
                "transient refresh failure: {reason}"
            )))
        },
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn module_compiles() {
        // Structural smoke test — integration requires a running identity service.
        let _ = module_path!();
    }
}
