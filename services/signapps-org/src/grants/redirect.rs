//! Public grant redirect mounted at `/g/:token`.
//!
//! Walks the full verify-and-dispatch flow:
//!
//! 1. Parse the token payload (base64 decode, no HMAC yet) to extract
//!    the tenant id so we can derive the correct HMAC secret.
//! 2. Derive the per-tenant HMAC secret (keystore DEK + tenant id).
//! 3. Fully verify the token (signature + expiry) via
//!    [`super::token::verify`].
//! 4. Look up the matching grant row via [`AccessGrantRepository`] and
//!    reject on revocation / expired `expires_at`.
//! 5. Bump `last_used_at` on the grant.
//! 6. Build the resource target URL (see [`super::resource_target_url`]).
//! 7. Inject a `grant_token=<token>` cookie so downstream services can
//!    see the bearer token without having to re-parse it from the URL.
//! 8. Issue a 302 redirect.

use axum::{
    extract::{Path, State},
    http::{header::LOCATION, header::SET_COOKIE, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use signapps_common::error::Error as AppError;
use signapps_db::repositories::org::AccessGrantRepository;

use crate::grants::{peek_tenant_id, resource_target_url, tenant_hmac_secret, token};
use crate::AppState;

/// Build the `/g/:token` router.
pub fn routes() -> Router<AppState> {
    Router::new().route("/:token", get(follow))
}

/// Handler for `GET /g/:token`.
///
/// Never logs the raw token or the HMAC secret — at most
/// `grant_id` + `tenant_id` once the payload has been authenticated.
#[tracing::instrument(skip(st, token_str), fields(token_len = token_str.len()))]
pub async fn follow(
    State(st): State<AppState>,
    Path(token_str): Path<String>,
) -> Result<Response, AppError> {
    // 1. Peek at the payload to extract `tenant_id`. Signature is NOT
    //    trusted yet — we only need the tenant to derive the key.
    let preview_tenant = peek_tenant_id(&token_str)
        .ok_or_else(|| AppError::BadRequest("malformed grant token".to_string()))?;

    // 2. Derive the per-tenant secret (keystore → DEK + tenant salt).
    let secret = tenant_hmac_secret(Some(&st.keystore), preview_tenant);

    // 3. Full HMAC + expiry verification.
    let payload = token::verify(&token_str, &secret).map_err(|e| match e {
        token::TokenError::Expired => AppError::Forbidden("grant token expired".to_string()),
        _ => AppError::Forbidden("invalid grant token".to_string()),
    })?;

    tracing::info!(
        grant_id = %payload.grant_id,
        tenant_id = %payload.tenant_id,
        "grant token verified"
    );

    // 4. Database lookup — source of truth for revocation / expiry.
    let repo = AccessGrantRepository::new(st.pool.inner());
    let hashed = token::hash(&token_str);
    let grant = repo
        .get_by_token(&hashed)
        .await
        .map_err(|e| AppError::Internal(format!("grant lookup failed: {e}")))?
        .ok_or_else(|| AppError::Forbidden("grant not found".to_string()))?;

    if grant.revoked_at.is_some() {
        return Err(AppError::Forbidden("grant revoked".to_string()));
    }
    if let Some(exp) = grant.expires_at {
        if chrono::Utc::now() >= exp {
            return Err(AppError::Forbidden("grant expired".to_string()));
        }
    }

    // 5. Bump last_used_at (best-effort: failure here is not fatal).
    if let Err(e) = repo.bump_last_used(grant.id).await {
        tracing::warn!(?e, grant_id=%grant.id, "bump_last_used failed");
    }

    // 6. Compute the target URL from the payload, not the DB row —
    //    the payload is authenticated and the DB row has already been
    //    checked.
    let location = resource_target_url(&payload.resource_type, payload.resource_id);

    // 7. Cookie: share the raw token with the resource service so it
    //    can re-verify without another HTTP round-trip. Scoped to the
    //    site, HttpOnly to block JS access, SameSite=Lax to survive
    //    top-level navigations but not CSRF.
    let cookie = format!(
        "grant_token={}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600",
        token_str
    );

    // 8. 302 with Location + Set-Cookie.
    let response = Response::builder()
        .status(StatusCode::FOUND)
        .header(LOCATION, location)
        .header(SET_COOKIE, cookie)
        .body(axum::body::Body::empty())
        .map_err(|e| AppError::Internal(format!("build redirect: {e}")))?;
    Ok(response.into_response())
}
