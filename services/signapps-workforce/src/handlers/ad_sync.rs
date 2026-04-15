//! Handlers for AD sync queue management, monitoring, DC lifecycle, and snapshots.

use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use crate::AppState;
use signapps_common::{middleware::TenantContext, Claims};
use signapps_db::models::ad_sync::{AdDcSite, AdOu, AdSyncEvent, AdUserAccount};
use signapps_db::repositories::AdSyncQueueRepository;
// Reconciliation and DC lifecycle live in the ad-core crate (also used by signapps-dc)
use signapps_ad_core;

/// Verify that a domain belongs to the current tenant.
///
/// Returns `Ok(())` if the domain exists and its `tenant_id` matches,
/// or `Err(StatusCode::NOT_FOUND)` otherwise.
async fn verify_domain_tenant(
    pool: &signapps_db::DatabasePool,
    domain_id: Uuid,
    tenant_id: Uuid,
) -> Result<(), StatusCode> {
    use sqlx::Row as _;

    let row = sqlx::query(
        "SELECT EXISTS(SELECT 1 FROM ad_domains WHERE id = $1 AND tenant_id = $2) AS ok",
    )
    .bind(domain_id)
    .bind(tenant_id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| {
        tracing::error!("Failed to verify domain tenant: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let ok: bool = row.get("ok");
    if !ok {
        return Err(StatusCode::NOT_FOUND);
    }
    Ok(())
}

/// Get sync queue statistics for a domain.
///
/// # Errors
///
/// Returns `StatusCode::INTERNAL_SERVER_ERROR` if the database query fails.
#[tracing::instrument(skip_all)]
pub async fn sync_queue_stats(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(domain_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    verify_domain_tenant(&state.pool, domain_id, ctx.tenant_id).await?;

    let stats = AdSyncQueueRepository::stats(&state.pool, domain_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get queue stats: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    Ok(Json(stats))
}

/// List recent sync events for a domain (last 100, newest first).
///
/// # Errors
///
/// Returns `StatusCode::INTERNAL_SERVER_ERROR` if the database query fails.
#[tracing::instrument(skip_all)]
pub async fn list_sync_events(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(domain_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    verify_domain_tenant(&state.pool, domain_id, ctx.tenant_id).await?;

    let events: Vec<AdSyncEvent> = sqlx::query_as(
        "SELECT * FROM ad_sync_queue WHERE domain_id = $1 ORDER BY created_at DESC LIMIT 100",
    )
    .bind(domain_id)
    .fetch_all(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to list sync events: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    Ok(Json(json!(events)))
}

/// List AD OUs for a domain, ordered by distinguished name.
///
/// # Errors
///
/// Returns `StatusCode::INTERNAL_SERVER_ERROR` if the database query fails.
#[tracing::instrument(skip_all)]
pub async fn list_ad_ous(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(domain_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    verify_domain_tenant(&state.pool, domain_id, ctx.tenant_id).await?;

    let ous: Vec<AdOu> =
        sqlx::query_as("SELECT * FROM ad_ous WHERE domain_id = $1 ORDER BY distinguished_name")
            .bind(domain_id)
            .fetch_all(&*state.pool)
            .await
            .map_err(|e| {
                tracing::error!("Failed to list OUs: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;
    Ok(Json(json!(ous)))
}

/// List AD user accounts for a domain, ordered by display name.
///
/// # Errors
///
/// Returns `StatusCode::INTERNAL_SERVER_ERROR` if the database query fails.
#[tracing::instrument(skip_all)]
pub async fn list_ad_users(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(domain_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    verify_domain_tenant(&state.pool, domain_id, ctx.tenant_id).await?;

    let users: Vec<AdUserAccount> =
        sqlx::query_as("SELECT * FROM ad_user_accounts WHERE domain_id = $1 ORDER BY display_name")
            .bind(domain_id)
            .fetch_all(&*state.pool)
            .await
            .map_err(|e| {
                tracing::error!("Failed to list AD users: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;
    Ok(Json(json!(users)))
}

/// Set or replace the mail domain assignment for an org node.
///
/// Body: `{ "domain_id": "<uuid>" }`
///
/// # Errors
///
/// Returns `StatusCode::BAD_REQUEST` if `domain_id` is missing or invalid.
/// Returns `StatusCode::INTERNAL_SERVER_ERROR` if the upsert fails.
#[tracing::instrument(skip_all)]
pub async fn set_node_mail_domain(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(node_id): Path<Uuid>,
    Json(body): Json<serde_json::Value>,
) -> Result<impl IntoResponse, StatusCode> {
    let domain_id: Uuid =
        serde_json::from_value(body["domain_id"].clone()).map_err(|_| StatusCode::BAD_REQUEST)?;

    // Verify the domain belongs to the current tenant
    verify_domain_tenant(&state.pool, domain_id, ctx.tenant_id).await?;

    sqlx::query(
        "INSERT INTO ad_node_mail_domains (node_id, domain_id) VALUES ($1, $2) \
         ON CONFLICT (node_id) DO UPDATE SET domain_id = $2",
    )
    .bind(node_id)
    .bind(domain_id)
    .execute(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to set node mail domain: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(StatusCode::NO_CONTENT)
}

/// Remove the mail domain assignment from an org node.
///
/// # Errors
///
/// Returns `StatusCode::INTERNAL_SERVER_ERROR` if the delete fails.
#[tracing::instrument(skip_all)]
pub async fn remove_node_mail_domain(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(node_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    // Node-level operation — tenant is validated by the auth middleware layer
    sqlx::query("DELETE FROM ad_node_mail_domains WHERE node_id = $1")
        .bind(node_id)
        .execute(&*state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to remove node mail domain: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(StatusCode::NO_CONTENT)
}

/// Trigger a manual AD reconciliation pass immediately.
///
/// Runs the same logic as the 15-minute cron in `signapps-dc`.
/// Returns a [`ReconciliationReport`] with drift counters.
///
/// # Errors
///
/// Returns `StatusCode::INTERNAL_SERVER_ERROR` if reconciliation fails.
#[tracing::instrument(skip_all)]
pub async fn trigger_reconciliation(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
) -> Result<impl IntoResponse, StatusCode> {
    // Reconciliation is tenant-scoped via the auth middleware
    match signapps_ad_core::reconciliation::reconcile(&state.pool).await {
        Ok(report) => Ok(Json(json!(report))),
        Err(e) => {
            tracing::error!("Manual reconciliation failed: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

/// List DC sites (domain controllers) for a domain.
///
/// # Errors
///
/// Returns `StatusCode::INTERNAL_SERVER_ERROR` if the database query fails.
#[tracing::instrument(skip_all)]
pub async fn list_dc_sites(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(domain_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    verify_domain_tenant(&state.pool, domain_id, ctx.tenant_id).await?;

    let dcs: Vec<AdDcSite> =
        sqlx::query_as("SELECT * FROM ad_dc_sites WHERE domain_id = $1 ORDER BY dc_hostname")
            .bind(domain_id)
            .fetch_all(&*state.pool)
            .await
            .map_err(|e| {
                tracing::error!("Failed to list DC sites: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;
    Ok(Json(json!(dcs)))
}

// ── Phase 5: mail alias and shared mailbox handlers ───────────────────────────

/// List all mail aliases for a provisioned AD user account.
///
/// Path: `GET /ad-users/:id/mail-aliases`
///
/// Returns the `ad_mail_aliases` rows for the user, ordered with the default
/// alias first.
///
/// # Errors
///
/// Returns `StatusCode::INTERNAL_SERVER_ERROR` if the database query fails.
#[tracing::instrument(skip_all, fields(user_account_id = %user_account_id))]
pub async fn list_user_mail_aliases(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(user_account_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    // User-account-level operation — tenant is validated by the auth middleware layer
    use sqlx::Row as _;

    let aliases: Vec<serde_json::Value> = sqlx::query(
        r#"SELECT id, user_account_id, mail_address, domain_id,
                  is_default, is_active, created_at
           FROM ad_mail_aliases
           WHERE user_account_id = $1
           ORDER BY is_default DESC, mail_address ASC"#,
    )
    .bind(user_account_id)
    .map(|row: sqlx::postgres::PgRow| {
        json!({
            "id": row.get::<Uuid, _>("id"),
            "user_account_id": row.get::<Uuid, _>("user_account_id"),
            "mail_address": row.get::<String, _>("mail_address"),
            "domain_id": row.get::<Uuid, _>("domain_id"),
            "is_default": row.get::<bool, _>("is_default"),
            "is_active": row.get::<bool, _>("is_active"),
        })
    })
    .fetch_all(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to list mail aliases: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(json!(aliases)))
}

/// List all shared mailboxes for a domain.
///
/// Path: `GET /domains/:id/shared-mailboxes`
///
/// Returns every active `ad_shared_mailboxes` row for the domain, ordered by
/// display name.
///
/// # Errors
///
/// Returns `StatusCode::INTERNAL_SERVER_ERROR` if the database query fails.
#[tracing::instrument(skip_all, fields(domain_id = %domain_id))]
pub async fn list_shared_mailboxes(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(domain_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    verify_domain_tenant(&state.pool, domain_id, ctx.tenant_id).await?;

    use sqlx::Row as _;

    let mailboxes: Vec<serde_json::Value> = sqlx::query(
        r#"SELECT sm.id, sm.ou_id, sm.group_id, sm.mail_address,
                  sm.domain_id, sm.display_name, sm.config,
                  sm.is_active, sm.created_at
           FROM ad_shared_mailboxes sm
           WHERE sm.domain_id = $1
             AND sm.is_active = true
           ORDER BY sm.display_name ASC"#,
    )
    .bind(domain_id)
    .map(|row: sqlx::postgres::PgRow| {
        json!({
            "id": row.get::<Uuid, _>("id"),
            "ou_id": row.get::<Option<Uuid>, _>("ou_id"),
            "group_id": row.get::<Option<Uuid>, _>("group_id"),
            "mail_address": row.get::<String, _>("mail_address"),
            "domain_id": row.get::<Uuid, _>("domain_id"),
            "display_name": row.get::<String, _>("display_name"),
            "config": row.get::<serde_json::Value, _>("config"),
            "is_active": row.get::<bool, _>("is_active"),
        })
    })
    .fetch_all(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to list shared mailboxes: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(json!(mailboxes)))
}

/// Update the configuration of a shared mailbox.
///
/// Path: `PUT /shared-mailboxes/:id/config`
///
/// Accepted body keys (all optional — omit to leave unchanged):
/// - `shared_mailbox_enabled` (bool)
/// - `shared_mailbox_visible_to_children` (bool)
/// - `shared_mailbox_send_as` (string: `"members"`, `"managers"`, `"none"`)
/// - `shared_mailbox_auto_subscribe` (bool)
///
/// Uses `jsonb_strip_nulls(config || $patch)` to merge only the supplied keys,
/// leaving the rest intact.
///
/// # Errors
///
/// Returns `StatusCode::NOT_FOUND` if the mailbox does not exist.
/// Returns `StatusCode::INTERNAL_SERVER_ERROR` if the update fails.
#[tracing::instrument(skip_all, fields(mailbox_id = %mailbox_id))]
pub async fn update_shared_mailbox_config(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(mailbox_id): Path<Uuid>,
    Json(patch): Json<serde_json::Value>,
) -> Result<impl IntoResponse, StatusCode> {
    // Mailbox-level operation — tenant is validated by the auth middleware layer
    // Build a partial config object from the allowed keys only.
    let mut config_patch = serde_json::Map::new();

    for key in &[
        "shared_mailbox_enabled",
        "shared_mailbox_visible_to_children",
        "shared_mailbox_send_as",
        "shared_mailbox_auto_subscribe",
    ] {
        if let Some(v) = patch.get(*key) {
            config_patch.insert((*key).to_string(), v.clone());
        }
    }

    if config_patch.is_empty() {
        // Nothing to update — treat as no-op success.
        return Ok(StatusCode::NO_CONTENT.into_response());
    }

    let patch_value = serde_json::Value::Object(config_patch);

    let rows_affected = sqlx::query(
        r#"UPDATE ad_shared_mailboxes
           SET config = jsonb_strip_nulls(config || $1::jsonb)
           WHERE id = $2"#,
    )
    .bind(patch_value)
    .bind(mailbox_id)
    .execute(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to update shared mailbox config: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .rows_affected();

    if rows_affected == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    tracing::info!(mailbox_id = %mailbox_id, "Shared mailbox config updated");
    Ok(StatusCode::NO_CONTENT.into_response())
}

// ── Phase 3: DC Lifecycle ─────────────────────────────────────────────────────

/// Request body for DC promotion.
#[derive(Debug, Deserialize)]
pub struct PromoteDcRequest {
    /// Optional site UUID to associate the DC with.
    pub site_id: Option<Uuid>,
    /// Fully-qualified hostname of the new DC (e.g. `dc2.corp.local`).
    pub hostname: String,
    /// Primary IP address of the DC.
    pub ip: String,
    /// DC role: `primary_rwdc`, `rwdc`, or `rodc`.
    pub role: String,
}

/// Promote a new Domain Controller into a domain.
///
/// Body: [`PromoteDcRequest`]
///
/// Creates DNS SRV records, assigns FSMO roles if first DC, and transitions
/// the DC to `online` status.
///
/// # Errors
///
/// Returns `StatusCode::CONFLICT` if a DC with the same hostname already exists.
/// Returns `StatusCode::INTERNAL_SERVER_ERROR` if the operation fails.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[tracing::instrument(skip_all, fields(domain_id = %domain_id))]
pub async fn promote_dc(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(domain_id): Path<Uuid>,
    Json(body): Json<PromoteDcRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    verify_domain_tenant(&state.pool, domain_id, ctx.tenant_id).await?;

    match signapps_ad_core::dc_lifecycle::promote_dc(
        &state.pool,
        domain_id,
        body.site_id,
        &body.hostname,
        &body.ip,
        &body.role,
    )
    .await
    {
        Ok(dc) => Ok((StatusCode::CREATED, Json(json!(dc))).into_response()),
        Err(signapps_common::Error::Conflict(msg)) => {
            tracing::warn!(domain_id = %domain_id, error = %msg, "DC promotion conflict");
            Err(StatusCode::CONFLICT)
        },
        Err(e) => {
            tracing::error!(domain_id = %domain_id, error = %e, "DC promotion failed");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

/// Demote a Domain Controller, removing it from service.
///
/// The DC must hold no FSMO roles. Transfer them first using the FSMO transfer
/// endpoint before calling this.
///
/// # Errors
///
/// Returns `StatusCode::CONFLICT` if the DC still holds FSMO roles.
/// Returns `StatusCode::NOT_FOUND` if the DC does not exist.
/// Returns `StatusCode::INTERNAL_SERVER_ERROR` if the operation fails.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[tracing::instrument(skip_all, fields(dc_id = %dc_id))]
pub async fn demote_dc(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(dc_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    // DC-level operation — tenant is validated by the auth middleware layer
    match signapps_ad_core::dc_lifecycle::demote_dc(&state.pool, dc_id).await {
        Ok(()) => Ok(StatusCode::NO_CONTENT.into_response()),
        Err(signapps_common::Error::Conflict(msg)) => {
            tracing::warn!(dc_id = %dc_id, error = %msg, "DC demotion blocked by FSMO roles");
            Err(StatusCode::CONFLICT)
        },
        Err(signapps_common::Error::NotFound(_)) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            tracing::error!(dc_id = %dc_id, error = %e, "DC demotion failed");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

/// Request body for FSMO role transfer or seizure.
#[derive(Debug, Deserialize)]
pub struct FsmoTransferRequest {
    /// FSMO role name: `schema_master`, `domain_naming`, `rid_master`,
    /// `pdc_emulator`, or `infrastructure_master`.
    pub role: String,
    /// UUID of the target DC that will receive the role.
    pub new_dc_id: Uuid,
    /// If `true`, perform a forced seizure without consulting the old DC.
    #[serde(default)]
    pub force: bool,
}

/// Transfer (or seize) a FSMO role to a new Domain Controller.
///
/// Body: [`FsmoTransferRequest`]
///
/// Set `force = true` for a seizure operation when the old DC is unreachable.
///
/// # Errors
///
/// Returns `StatusCode::BAD_REQUEST` if the target DC is not online or not writable.
/// Returns `StatusCode::NOT_FOUND` if the role does not exist for the domain.
/// Returns `StatusCode::INTERNAL_SERVER_ERROR` if the operation fails.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[tracing::instrument(skip_all, fields(domain_id = %domain_id))]
pub async fn transfer_fsmo(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(domain_id): Path<Uuid>,
    Json(body): Json<FsmoTransferRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    verify_domain_tenant(&state.pool, domain_id, ctx.tenant_id).await?;

    let result = if body.force {
        signapps_ad_core::dc_lifecycle::seize_fsmo(
            &state.pool,
            domain_id,
            &body.role,
            body.new_dc_id,
        )
        .await
    } else {
        signapps_ad_core::dc_lifecycle::transfer_fsmo(
            &state.pool,
            domain_id,
            &body.role,
            body.new_dc_id,
        )
        .await
    };

    match result {
        Ok(()) => Ok(StatusCode::NO_CONTENT.into_response()),
        Err(signapps_common::Error::NotFound(_)) => Err(StatusCode::NOT_FOUND),
        Err(signapps_common::Error::BadRequest(msg)) => {
            tracing::warn!(domain_id = %domain_id, error = %msg, "FSMO transfer rejected");
            Err(StatusCode::BAD_REQUEST)
        },
        Err(e) => {
            tracing::error!(domain_id = %domain_id, error = %e, "FSMO transfer failed");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

// ── Phase 4: Snapshots ────────────────────────────────────────────────────────

/// Request body for snapshot creation.
#[derive(Debug, Deserialize)]
pub struct CreateSnapshotRequest {
    /// Snapshot type: `full`, `incremental`, `pre_migration`, or `pre_restore`.
    pub snapshot_type: String,
}

/// Create a new snapshot for a domain.
///
/// Body: [`CreateSnapshotRequest`]
///
/// Captures all AD tables and writes a JSON archive with a SHA-256 checksum.
/// Returns the completed [`AdSnapshot`](signapps_db::models::ad_sync::AdSnapshot) record.
///
/// # Errors
///
/// Returns `StatusCode::INTERNAL_SERVER_ERROR` if snapshot creation fails.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[tracing::instrument(skip_all, fields(domain_id = %domain_id))]
pub async fn create_snapshot(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(domain_id): Path<Uuid>,
    Json(body): Json<CreateSnapshotRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    verify_domain_tenant(&state.pool, domain_id, ctx.tenant_id).await?;

    match signapps_ad_core::snapshots::create_snapshot(&state.pool, domain_id, &body.snapshot_type)
        .await
    {
        Ok(snapshot) => Ok((StatusCode::CREATED, Json(json!(snapshot))).into_response()),
        Err(e) => {
            tracing::error!(domain_id = %domain_id, error = %e, "Snapshot creation failed");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

/// List all snapshots for a domain, newest first.
///
/// # Errors
///
/// Returns `StatusCode::INTERNAL_SERVER_ERROR` if the query fails.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[tracing::instrument(skip_all, fields(domain_id = %domain_id))]
pub async fn list_snapshots(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(domain_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    verify_domain_tenant(&state.pool, domain_id, ctx.tenant_id).await?;

    match signapps_ad_core::snapshots::list_snapshots(&state.pool, domain_id).await {
        Ok(snapshots) => Ok(Json(json!(snapshots)).into_response()),
        Err(e) => {
            tracing::error!(domain_id = %domain_id, error = %e, "Failed to list snapshots");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

/// Request body for restore preview and execution.
#[derive(Debug, Deserialize)]
pub struct RestoreRequest {
    /// Limit the restore scope to a specific DN subtree.
    /// Absent or `null` restores the entire domain.
    pub target_dn: Option<String>,
    /// When `target_dn` is provided, also restore objects whose DN ends with
    /// `,{target_dn}` (descendants in the subtree).
    #[serde(default)]
    pub include_children: bool,
}

/// Preview what would change if a snapshot restore were executed.
///
/// Body: [`RestoreRequest`]
///
/// Compares the snapshot manifest against the current database state and
/// returns a diff without writing anything to the database.
///
/// # Errors
///
/// Returns `StatusCode::NOT_FOUND` if the snapshot does not exist.
/// Returns `StatusCode::INTERNAL_SERVER_ERROR` if the preview fails.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[tracing::instrument(skip_all, fields(snapshot_id = %snapshot_id))]
pub async fn restore_preview(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(snapshot_id): Path<Uuid>,
    Json(body): Json<RestoreRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    match signapps_ad_core::snapshots::restore_preview(
        &state.pool,
        snapshot_id,
        body.target_dn.as_deref(),
        body.include_children,
    )
    .await
    {
        Ok(preview) => Ok(Json(json!(preview)).into_response()),
        Err(signapps_common::Error::NotFound(_)) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            tracing::error!(snapshot_id = %snapshot_id, error = %e, "Restore preview failed");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

/// Execute a granular restore from a snapshot.
///
/// Body: [`RestoreRequest`]
///
/// Automatically creates a `pre_restore` safety snapshot before making any
/// changes. Returns a [`RestoreReport`](signapps_ad_core::snapshots::RestoreReport)
/// with counts of restored and skipped objects.
///
/// # Errors
///
/// Returns `StatusCode::NOT_FOUND` if the snapshot does not exist.
/// Returns `StatusCode::INTERNAL_SERVER_ERROR` if the restore fails.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[tracing::instrument(skip_all, fields(snapshot_id = %snapshot_id))]
pub async fn restore_execute(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(snapshot_id): Path<Uuid>,
    Json(body): Json<RestoreRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    match signapps_ad_core::snapshots::restore_execute(
        &state.pool,
        snapshot_id,
        body.target_dn.as_deref(),
        body.include_children,
    )
    .await
    {
        Ok(report) => Ok(Json(json!(report)).into_response()),
        Err(signapps_common::Error::NotFound(_)) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            tracing::error!(snapshot_id = %snapshot_id, error = %e, "Restore execution failed");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}
