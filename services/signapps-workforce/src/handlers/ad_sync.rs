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

/// Get sync queue statistics for a domain.
///
/// # Errors
///
/// Returns `StatusCode::INTERNAL_SERVER_ERROR` if the database query fails.
#[tracing::instrument(skip_all)]
pub async fn sync_queue_stats(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(domain_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
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
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(domain_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
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
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(domain_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let ous: Vec<AdOu> = sqlx::query_as(
        "SELECT * FROM ad_ous WHERE domain_id = $1 ORDER BY distinguished_name",
    )
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
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(domain_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let users: Vec<AdUserAccount> = sqlx::query_as(
        "SELECT * FROM ad_user_accounts WHERE domain_id = $1 ORDER BY display_name",
    )
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
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(node_id): Path<Uuid>,
    Json(body): Json<serde_json::Value>,
) -> Result<impl IntoResponse, StatusCode> {
    let domain_id: Uuid = serde_json::from_value(body["domain_id"].clone())
        .map_err(|_| StatusCode::BAD_REQUEST)?;

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
    match signapps_ad_core::reconciliation::reconcile(&state.pool).await {
        Ok(report) => Ok(Json(json!(report))),
        Err(e) => {
            tracing::error!("Manual reconciliation failed: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
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
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(domain_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let dcs: Vec<AdDcSite> = sqlx::query_as(
        "SELECT * FROM ad_dc_sites WHERE domain_id = $1 ORDER BY dc_hostname",
    )
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
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(domain_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
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
