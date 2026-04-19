//! SO1 handlers for `/api/v1/org/history` — audit log read surface +
//! time-travel helpers.
//!
//! - `GET /api/v1/org/history?entity_type=X&entity_id=Y&limit=50` → liste
//!   des events pour une entité, ordre le plus récent d'abord.
//! - `GET /api/v1/org/history/tenant?tenant_id=X&since=&limit=` → timeline
//!   complète d'un tenant.
//!
//! Le time-travel (`?at=YYYY-MM-DD`) est implémenté côté `nodes`/`persons`
//! handlers via `AuditRepository::snapshot_at`.

use axum::{
    extract::{Query, State},
    routing::get,
    Json, Router,
};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use signapps_common::{Error, Result};
use signapps_db::models::org::AuditLogEntry;
use signapps_db::repositories::org::AuditRepository;
use uuid::Uuid;

use crate::AppState;

/// Build the history router.
pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list_for_entity))
        .route("/tenant", get(list_for_tenant))
}

/// Query for `GET /api/v1/org/history`.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct EntityHistoryQuery {
    /// Table source (org_nodes | org_persons | org_assignments | org_positions | org_position_incumbents).
    pub entity_type: String,
    /// Id de l'entité ciblée.
    pub entity_id: Uuid,
    /// Limite de rows (default 100).
    pub limit: Option<i64>,
}

/// Query for `GET /api/v1/org/history/tenant`.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct TenantHistoryQuery {
    /// Tenant propriétaire.
    pub tenant_id: Uuid,
    /// Rétention minimale (default none = full timeline).
    pub since: Option<DateTime<Utc>>,
    /// Limite (default 200).
    pub limit: Option<i64>,
}

/// GET /api/v1/org/history — historique d'une entité donnée.
#[utoipa::path(
    get,
    path = "/api/v1/org/history",
    tag = "Org",
    params(EntityHistoryQuery),
    responses(
        (status = 200, description = "Audit entries", body = Vec<AuditLogEntry>),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn list_for_entity(
    State(st): State<AppState>,
    Query(q): Query<EntityHistoryQuery>,
) -> Result<Json<Vec<AuditLogEntry>>> {
    let list = AuditRepository::new(st.pool.inner())
        .list_for_entity(&q.entity_type, q.entity_id, q.limit.unwrap_or(100))
        .await
        .map_err(|e| Error::Database(format!("list audit for entity: {e}")))?;
    Ok(Json(list))
}

/// GET /api/v1/org/history/tenant — timeline complète d'un tenant.
#[utoipa::path(
    get,
    path = "/api/v1/org/history/tenant",
    tag = "Org",
    params(TenantHistoryQuery),
    responses(
        (status = 200, description = "Tenant timeline", body = Vec<AuditLogEntry>),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn list_for_tenant(
    State(st): State<AppState>,
    Query(q): Query<TenantHistoryQuery>,
) -> Result<Json<Vec<AuditLogEntry>>> {
    let list = AuditRepository::new(st.pool.inner())
        .list_for_tenant(q.tenant_id, q.since, q.limit.unwrap_or(200))
        .await
        .map_err(|e| Error::Database(format!("list audit for tenant: {e}")))?;
    Ok(Json(list))
}
