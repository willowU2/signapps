//! SO1 CRUD handlers for `/api/v1/org/delegations`.
//!
//! Backed by [`DelegationRepository`].
//!
//! Events emitted:
//! - `org.delegation.created`
//! - `org.delegation.revoked`
//! - `org.delegation.expired` (émis par le cron, pas le handler)

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use signapps_common::pg_events::NewEvent;
use signapps_common::{Error, Result};
use signapps_db::models::org::{Delegation, DelegationScope};
use signapps_db::repositories::org::DelegationRepository;
use uuid::Uuid;

use crate::AppState;

/// Build the delegations router.
pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list).post(create))
        .route("/:id", get(detail).delete(delete_delegation))
        .route("/:id/revoke", post(revoke))
}

// ─── DTOs ───────────────────────────────────────────────────────────

/// Query for `GET /api/v1/org/delegations`.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct ListQuery {
    /// Tenant propriétaire — requis.
    pub tenant_id: Uuid,
    /// Personne impliquée comme delegator (optionnel).
    pub delegator_person_id: Option<Uuid>,
    /// Personne impliquée comme delegate (optionnel).
    pub delegate_person_id: Option<Uuid>,
    /// Si `true`, ne retourne que les délégations actives dans la fenêtre courante.
    #[serde(default)]
    pub active_only: bool,
}

/// Request body for `POST /api/v1/org/delegations`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreateDelegationBody {
    /// Tenant propriétaire.
    pub tenant_id: Uuid,
    /// Source des responsabilités.
    pub delegator_person_id: Uuid,
    /// Destinataire.
    pub delegate_person_id: Uuid,
    /// Restriction à un sous-arbre (optionnel).
    pub node_id: Option<Uuid>,
    /// Scope (manager | rbac | all).
    pub scope: DelegationScope,
    /// Début de validité (UTC).
    pub start_at: DateTime<Utc>,
    /// Fin de validité (UTC).
    pub end_at: DateTime<Utc>,
    /// Raison libre.
    pub reason: Option<String>,
}

// ─── Handlers ───────────────────────────────────────────────────────

/// GET /api/v1/org/delegations — list (tenant + optional filters).
#[utoipa::path(
    get,
    path = "/api/v1/org/delegations",
    tag = "Org",
    params(ListQuery),
    responses(
        (status = 200, description = "Delegations list", body = Vec<Delegation>),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn list(
    State(st): State<AppState>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<Delegation>>> {
    let repo = DelegationRepository::new(st.pool.inner());
    // Priorité : si un delegator / delegate spécifique demandé, on prend
    // ce chemin ciblé (plus efficace via les indices partiels).
    let list = if let Some(id) = q.delegator_person_id {
        repo.list_active_for_delegator(id)
            .await
            .map_err(|e| Error::Database(format!("list delegator: {e}")))?
    } else if let Some(id) = q.delegate_person_id {
        repo.list_active_for_delegate(id)
            .await
            .map_err(|e| Error::Database(format!("list delegate: {e}")))?
    } else {
        repo.list_by_tenant(q.tenant_id, q.active_only)
            .await
            .map_err(|e| Error::Database(format!("list tenant: {e}")))?
    };
    Ok(Json(list))
}

/// GET /api/v1/org/delegations/:id — single delegation.
#[utoipa::path(
    get,
    path = "/api/v1/org/delegations/{id}",
    tag = "Org",
    params(("id" = Uuid, Path, description = "Delegation UUID")),
    responses(
        (status = 200, description = "Delegation detail", body = Delegation),
        (status = 404, description = "Not found"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn detail(
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Delegation>> {
    DelegationRepository::new(st.pool.inner())
        .get(id)
        .await
        .map_err(|e| Error::Database(format!("get delegation: {e}")))?
        .map(Json)
        .ok_or_else(|| Error::NotFound(format!("delegation {id}")))
}

/// POST /api/v1/org/delegations — create.
#[utoipa::path(
    post,
    path = "/api/v1/org/delegations",
    tag = "Org",
    request_body = CreateDelegationBody,
    responses(
        (status = 201, description = "Delegation created", body = Delegation),
        (status = 400, description = "Invalid (self-delegation, start>=end, ...)"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st, body))]
pub async fn create(
    State(st): State<AppState>,
    Json(body): Json<CreateDelegationBody>,
) -> Result<(StatusCode, Json<Delegation>)> {
    if body.delegator_person_id == body.delegate_person_id {
        return Err(Error::BadRequest(
            "delegator and delegate must differ".into(),
        ));
    }
    if body.start_at >= body.end_at {
        return Err(Error::BadRequest(
            "start_at must be strictly before end_at".into(),
        ));
    }

    let d = DelegationRepository::new(st.pool.inner())
        .create(
            body.tenant_id,
            body.delegator_person_id,
            body.delegate_person_id,
            body.node_id,
            body.scope,
            body.start_at,
            body.end_at,
            body.reason.as_deref(),
            None,
        )
        .await
        .map_err(|e| Error::Database(format!("create delegation: {e}")))?;

    if let Ok(payload) = serde_json::to_value(&d) {
        if let Err(e) = st
            .event_bus
            .publish(NewEvent {
                event_type: "org.delegation.created".to_string(),
                aggregate_id: Some(d.id),
                payload,
            })
            .await
        {
            tracing::error!(?e, "failed to publish org.delegation.created");
        }
    }
    Ok((StatusCode::CREATED, Json(d)))
}

/// POST /api/v1/org/delegations/:id/revoke — soft revoke.
#[utoipa::path(
    post,
    path = "/api/v1/org/delegations/{id}/revoke",
    tag = "Org",
    params(("id" = Uuid, Path, description = "Delegation UUID")),
    responses(
        (status = 200, description = "Delegation revoked", body = Delegation),
        (status = 404, description = "Not found"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn revoke(
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Delegation>> {
    let d = DelegationRepository::new(st.pool.inner())
        .revoke(id)
        .await
        .map_err(|e| Error::Database(format!("revoke: {e}")))?
        .ok_or_else(|| Error::NotFound(format!("delegation {id}")))?;

    if let Ok(payload) = serde_json::to_value(&d) {
        let _ = st
            .event_bus
            .publish(NewEvent {
                event_type: "org.delegation.revoked".to_string(),
                aggregate_id: Some(d.id),
                payload,
            })
            .await;
    }
    Ok(Json(d))
}

/// DELETE /api/v1/org/delegations/:id — hard delete (admin).
#[utoipa::path(
    delete,
    path = "/api/v1/org/delegations/{id}",
    tag = "Org",
    params(("id" = Uuid, Path, description = "Delegation UUID")),
    responses(
        (status = 204, description = "Deleted"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn delete_delegation(
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    DelegationRepository::new(st.pool.inner())
        .delete(id)
        .await
        .map_err(|e| Error::Database(format!("delete delegation: {e}")))?;
    Ok(StatusCode::NO_CONTENT)
}
