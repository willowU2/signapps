//! AD / LDAP configuration & sync handlers for `/api/v1/org/ad` (S1 W3).
//!
//! - `GET /config/:tenant_id` — returns the stored config, WITHOUT the
//!   decrypted bind password (only a boolean `has_bind_password`).
//! - `PUT /config/:tenant_id` — upserts the config. When a
//!   `bind_password` is present in the body it is encrypted with the
//!   shared keystore DEK `org-ad-bind-password-v1` before hitting
//!   Postgres.
//! - `POST /sync/:tenant_id` — triggers one sync cycle and returns
//!   the [`SyncReport`].
//! - `POST /sync/:tenant_id/dry-run` — same as above with
//!   `dry_run = true`, so the caller can preview the report without
//!   persisting changes.

use axum::{
    extract::{Path, State},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use signapps_common::{Error, Result};
use signapps_db::models::org::{AdSyncMode, ConflictStrategy};
use signapps_db::repositories::org::AdConfigRepository;
use signapps_keystore::encrypt_string_arc;
use uuid::Uuid;

use crate::ad::config::{AdSyncConfig, BIND_PASSWORD_DEK};
use crate::ad::sync::{run_cycle, SyncReport};
use crate::AppState;

/// Build the AD router nested at `/api/v1/org/ad`.
pub fn routes() -> Router<AppState> {
    Router::new()
        .route(
            "/config/:tenant_id",
            get(get_config).put(put_config),
        )
        .route("/sync/:tenant_id", post(trigger_sync))
        .route("/sync/:tenant_id/dry-run", post(trigger_sync_dry_run))
}

// ════════════════════════════════════════════════════════════════════
// Config DTOs
// ════════════════════════════════════════════════════════════════════

/// Safe (password-free) view of the stored AD config.
#[derive(Debug, Serialize, Deserialize, utoipa::ToSchema)]
pub struct AdConfigView {
    /// Tenant that owns the row.
    pub tenant_id: Uuid,
    /// Activation mode.
    pub mode: AdSyncMode,
    /// LDAP URL.
    pub ldap_url: Option<String>,
    /// Bind DN.
    pub bind_dn: Option<String>,
    /// `true` when a ciphertext for the bind password is stored.
    pub has_bind_password: bool,
    /// Base DN.
    pub base_dn: Option<String>,
    /// User filter.
    pub user_filter: Option<String>,
    /// OU filter.
    pub ou_filter: Option<String>,
    /// Sync interval (seconds).
    pub sync_interval_sec: i32,
    /// Conflict resolution strategy.
    pub conflict_strategy: ConflictStrategy,
}

/// Request body for `PUT /config/:tenant_id`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct PutConfigBody {
    /// Activation mode.
    pub mode: AdSyncMode,
    /// LDAP / LDAPS URL.
    pub ldap_url: String,
    /// DN used to bind.
    pub bind_dn: String,
    /// Plaintext password. Encrypted server-side before storage.
    /// Send an empty string to clear it.
    pub bind_password: String,
    /// Base DN to scan.
    pub base_dn: String,
    /// Optional user filter. Defaults to `(objectClass=user)`.
    pub user_filter: Option<String>,
    /// Optional OU filter. Defaults to
    /// `(objectClass=organizationalUnit)`.
    pub ou_filter: Option<String>,
    /// Seconds between two cycles. Clamped to `>= 30`. Defaults to 300.
    pub sync_interval_sec: Option<i32>,
    /// Conflict resolution strategy. Defaults to `OrgWins`.
    pub conflict_strategy: Option<ConflictStrategy>,
}

// ════════════════════════════════════════════════════════════════════
// Handlers
// ════════════════════════════════════════════════════════════════════

/// GET /api/v1/org/ad/config/:tenant_id
#[utoipa::path(
    get,
    path = "/api/v1/org/ad/config/{tenant_id}",
    tag = "Org AD",
    params(("tenant_id" = Uuid, Path, description = "Tenant UUID")),
    responses(
        (status = 200, description = "AD config (never includes plaintext password)", body = AdConfigView),
        (status = 404, description = "No config for tenant"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn get_config(
    State(st): State<AppState>,
    Path(tenant_id): Path<Uuid>,
) -> Result<Json<AdConfigView>> {
    let repo = AdConfigRepository::new(st.pool.inner());
    let row = repo
        .get(tenant_id)
        .await
        .map_err(|e| Error::Database(format!("get ad config: {e}")))?
        .ok_or_else(|| Error::NotFound(format!("ad config for tenant {tenant_id}")))?;

    Ok(Json(AdConfigView {
        tenant_id: row.tenant_id,
        mode: row.mode,
        ldap_url: row.ldap_url,
        bind_dn: row.bind_dn,
        has_bind_password: row.bind_password_enc.is_some(),
        base_dn: row.base_dn,
        user_filter: row.user_filter,
        ou_filter: row.ou_filter,
        sync_interval_sec: row.sync_interval_sec,
        conflict_strategy: row.conflict_strategy,
    }))
}

/// PUT /api/v1/org/ad/config/:tenant_id
#[utoipa::path(
    put,
    path = "/api/v1/org/ad/config/{tenant_id}",
    tag = "Org AD",
    params(("tenant_id" = Uuid, Path, description = "Tenant UUID")),
    request_body = PutConfigBody,
    responses(
        (status = 200, description = "Config upserted", body = AdConfigView),
        (status = 400, description = "Invalid body"),
        (status = 500, description = "Keystore / DB failure"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st, body), fields(has_password = !body.bind_password.is_empty()))]
pub async fn put_config(
    State(st): State<AppState>,
    Path(tenant_id): Path<Uuid>,
    Json(body): Json<PutConfigBody>,
) -> Result<Json<AdConfigView>> {
    // Encrypt the bind password when non-empty; an empty string clears it.
    let enc: Option<Vec<u8>> = if body.bind_password.is_empty() {
        None
    } else {
        let dek = st.keystore.dek(BIND_PASSWORD_DEK);
        let ct = encrypt_string_arc(&body.bind_password, &dek)
            .map_err(|e| Error::Internal(format!("keystore encrypt: {e}")))?;
        Some(ct)
    };

    let repo = AdConfigRepository::new(st.pool.inner());
    let row = repo
        .upsert(
            tenant_id,
            body.mode,
            Some(body.ldap_url.as_str()),
            Some(body.bind_dn.as_str()),
            enc.as_deref(),
            Some(body.base_dn.as_str()),
            body.user_filter.as_deref(),
            body.ou_filter.as_deref(),
            body.sync_interval_sec.unwrap_or(300).max(30),
            body.conflict_strategy.unwrap_or(ConflictStrategy::OrgWins),
        )
        .await
        .map_err(|e| Error::Database(format!("upsert ad config: {e}")))?;

    Ok(Json(AdConfigView {
        tenant_id: row.tenant_id,
        mode: row.mode,
        ldap_url: row.ldap_url,
        bind_dn: row.bind_dn,
        has_bind_password: row.bind_password_enc.is_some(),
        base_dn: row.base_dn,
        user_filter: row.user_filter,
        ou_filter: row.ou_filter,
        sync_interval_sec: row.sync_interval_sec,
        conflict_strategy: row.conflict_strategy,
    }))
}

/// POST /api/v1/org/ad/sync/:tenant_id
#[utoipa::path(
    post,
    path = "/api/v1/org/ad/sync/{tenant_id}",
    tag = "Org AD",
    params(("tenant_id" = Uuid, Path, description = "Tenant UUID")),
    responses(
        (status = 200, description = "Sync report"),
        (status = 404, description = "No config for tenant"),
        (status = 500, description = "LDAP or DB failure"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn trigger_sync(
    State(st): State<AppState>,
    Path(tenant_id): Path<Uuid>,
) -> Result<Json<SyncReport>> {
    run_sync_with(&st, tenant_id, false).await
}

/// POST /api/v1/org/ad/sync/:tenant_id/dry-run
#[utoipa::path(
    post,
    path = "/api/v1/org/ad/sync/{tenant_id}/dry-run",
    tag = "Org AD",
    params(("tenant_id" = Uuid, Path, description = "Tenant UUID")),
    responses(
        (status = 200, description = "Dry-run sync report — no writes applied"),
        (status = 404, description = "No config for tenant"),
        (status = 500, description = "LDAP or DB failure"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn trigger_sync_dry_run(
    State(st): State<AppState>,
    Path(tenant_id): Path<Uuid>,
) -> Result<Json<SyncReport>> {
    run_sync_with(&st, tenant_id, true).await
}

async fn run_sync_with(st: &AppState, tenant_id: Uuid, dry_run: bool) -> Result<Json<SyncReport>> {
    let cfg = AdSyncConfig::load(st.pool.inner(), &st.keystore, tenant_id)
        .await
        .map_err(|e| Error::Internal(format!("ad config load: {e}")))?
        .ok_or_else(|| Error::NotFound(format!("ad config for tenant {tenant_id}")))?;

    let report = run_cycle(st.pool.inner(), &cfg, dry_run, Some(&st.event_bus))
        .await
        .map_err(|e| Error::Internal(format!("ad sync cycle: {e}")))?;
    Ok(Json(report))
}
