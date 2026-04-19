//! SO1 CRUD handlers for `/api/v1/org/positions` + incumbents.
//!
//! Backed by [`PositionRepository`], the W1 repository that talks to the
//! canonical `org_positions` + `org_position_incumbents` tables.
//!
//! Events emitted:
//! - `org.position.created` on POST
//! - `org.position.updated` on PATCH
//! - `org.position.archived` on DELETE
//! - `org.incumbent.added` / `org.incumbent.revoked`

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::get,
    Json, Router,
};
use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use signapps_common::pg_events::NewEvent;
use signapps_common::{Error, Result};
use signapps_db::models::org::{Position, PositionIncumbent};
use signapps_db::repositories::org::PositionRepository;
use uuid::Uuid;

use crate::AppState;

/// Build the positions router (nested at `/api/v1/org/positions`).
pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list).post(create))
        .route("/:id", get(detail).patch(update).delete(delete_position))
        .route(
            "/:id/incumbents",
            get(list_incumbents).post(add_incumbent),
        )
        .route(
            "/:id/incumbents/:incumbent_id",
            axum::routing::delete(revoke_incumbent),
        )
}

// ─── DTOs ───────────────────────────────────────────────────────────

/// Query parameters for `GET /api/v1/org/positions`.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct ListQuery {
    /// Tenant UUID — required.
    pub tenant_id: Uuid,
    /// Optional node filter.
    pub node_id: Option<Uuid>,
}

/// Request body for `POST /api/v1/org/positions`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreatePositionBody {
    /// Tenant propriétaire.
    pub tenant_id: Uuid,
    /// Noeud d'attache.
    pub node_id: Uuid,
    /// Libellé officiel.
    pub title: String,
    /// Nombre de sièges (>=0). Default 1.
    #[serde(default = "default_head_count")]
    pub head_count: i32,
    /// Attributs JSONB libres.
    #[serde(default)]
    pub attributes: serde_json::Value,
}

fn default_head_count() -> i32 {
    1
}

/// Request body for `PATCH /api/v1/org/positions/:id`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct UpdatePositionBody {
    /// Nouveau titre (optionnel).
    pub title: Option<String>,
    /// Nouveau head_count (optionnel).
    pub head_count: Option<i32>,
    /// Nouveaux attributs (optionnel).
    pub attributes: Option<serde_json::Value>,
    /// Nouveau statut (optionnel).
    pub active: Option<bool>,
}

/// Request body for `POST /api/v1/org/positions/:id/incumbents`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct AddIncumbentBody {
    /// Tenant propriétaire.
    pub tenant_id: Uuid,
    /// Personne à rattacher au poste.
    pub person_id: Uuid,
    /// Date de début (par défaut CURRENT_DATE).
    pub start_date: Option<NaiveDate>,
}

/// Query for `DELETE /api/v1/org/positions/:id/incumbents/:incumbent_id`.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct RevokeIncumbentQuery {
    /// End date (par défaut CURRENT_DATE).
    pub end_date: Option<NaiveDate>,
}

/// Response enrichi : position + compteur occupancy.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct PositionWithOccupancy {
    /// Le poste.
    #[serde(flatten)]
    pub position: Position,
    /// Nombre d'incumbents actifs.
    pub filled: i64,
    /// Sièges restants (head_count - filled, >= 0).
    pub vacant: i64,
}

// ─── Handlers ───────────────────────────────────────────────────────

/// GET /api/v1/org/positions — list for tenant, optionally filtered by node.
#[utoipa::path(
    get,
    path = "/api/v1/org/positions",
    tag = "Org",
    params(ListQuery),
    responses(
        (status = 200, description = "Positions list", body = Vec<PositionWithOccupancy>),
        (status = 401, description = "Not authenticated"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn list(
    State(st): State<AppState>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<PositionWithOccupancy>>> {
    let repo = PositionRepository::new(st.pool.inner());
    let positions = repo
        .list_by_tenant(q.tenant_id, q.node_id)
        .await
        .map_err(|e| Error::Database(format!("list positions: {e}")))?;

    let mut out = Vec::with_capacity(positions.len());
    for p in positions {
        let (filled, hc) = repo
            .occupancy(p.id)
            .await
            .map_err(|e| Error::Database(format!("occupancy: {e}")))?;
        let vacant = i64::from(hc) - filled;
        out.push(PositionWithOccupancy {
            position: p,
            filled,
            vacant: vacant.max(0),
        });
    }
    Ok(Json(out))
}

/// GET /api/v1/org/positions/:id — single position.
#[utoipa::path(
    get,
    path = "/api/v1/org/positions/{id}",
    tag = "Org",
    params(("id" = Uuid, Path, description = "Position UUID")),
    responses(
        (status = 200, description = "Position detail", body = Position),
        (status = 404, description = "Position not found"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn detail(
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Position>> {
    PositionRepository::new(st.pool.inner())
        .get(id)
        .await
        .map_err(|e| Error::Database(format!("get position: {e}")))?
        .map(Json)
        .ok_or_else(|| Error::NotFound(format!("position {id}")))
}

/// POST /api/v1/org/positions — create.
#[utoipa::path(
    post,
    path = "/api/v1/org/positions",
    tag = "Org",
    request_body = CreatePositionBody,
    responses(
        (status = 201, description = "Position created", body = Position),
        (status = 400, description = "Invalid body"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st, body))]
pub async fn create(
    State(st): State<AppState>,
    Json(body): Json<CreatePositionBody>,
) -> Result<(StatusCode, Json<Position>)> {
    let repo = PositionRepository::new(st.pool.inner());
    let position = repo
        .create(
            body.tenant_id,
            body.node_id,
            &body.title,
            body.head_count,
            body.attributes,
        )
        .await
        .map_err(|e| Error::Database(format!("create position: {e}")))?;

    if let Ok(payload) = serde_json::to_value(&position) {
        if let Err(e) = st
            .event_bus
            .publish(NewEvent {
                event_type: "org.position.created".to_string(),
                aggregate_id: Some(position.id),
                payload,
            })
            .await
        {
            tracing::error!(?e, "failed to publish org.position.created");
        }
    }
    Ok((StatusCode::CREATED, Json(position)))
}

/// PATCH /api/v1/org/positions/:id — partial update.
#[utoipa::path(
    patch,
    path = "/api/v1/org/positions/{id}",
    tag = "Org",
    params(("id" = Uuid, Path, description = "Position UUID")),
    request_body = UpdatePositionBody,
    responses(
        (status = 200, description = "Position updated", body = Position),
        (status = 404, description = "Position not found"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st, body))]
pub async fn update(
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdatePositionBody>,
) -> Result<Json<Position>> {
    let position = PositionRepository::new(st.pool.inner())
        .update(
            id,
            body.title.as_deref(),
            body.head_count,
            body.attributes,
            body.active,
        )
        .await
        .map_err(|e| Error::Database(format!("update position: {e}")))?
        .ok_or_else(|| Error::NotFound(format!("position {id}")))?;

    if let Ok(payload) = serde_json::to_value(&position) {
        let _ = st
            .event_bus
            .publish(NewEvent {
                event_type: "org.position.updated".to_string(),
                aggregate_id: Some(position.id),
                payload,
            })
            .await;
    }
    Ok(Json(position))
}

/// DELETE /api/v1/org/positions/:id — hard delete (cascade to incumbents).
#[utoipa::path(
    delete,
    path = "/api/v1/org/positions/{id}",
    tag = "Org",
    params(("id" = Uuid, Path, description = "Position UUID")),
    responses(
        (status = 204, description = "Position deleted"),
        (status = 404, description = "Position not found"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn delete_position(
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    let repo = PositionRepository::new(st.pool.inner());
    if repo
        .get(id)
        .await
        .map_err(|e| Error::Database(format!("get position: {e}")))?
        .is_none()
    {
        return Err(Error::NotFound(format!("position {id}")));
    }
    repo.delete(id)
        .await
        .map_err(|e| Error::Database(format!("delete position: {e}")))?;

    let _ = st
        .event_bus
        .publish(NewEvent {
            event_type: "org.position.archived".to_string(),
            aggregate_id: Some(id),
            payload: serde_json::json!({ "id": id }),
        })
        .await;
    Ok(StatusCode::NO_CONTENT)
}

// ─── Incumbents ─────────────────────────────────────────────────────

/// GET /api/v1/org/positions/:id/incumbents — list incumbents.
#[utoipa::path(
    get,
    path = "/api/v1/org/positions/{id}/incumbents",
    tag = "Org",
    params(("id" = Uuid, Path, description = "Position UUID")),
    responses(
        (status = 200, description = "Incumbents list (active first)", body = Vec<PositionIncumbent>),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn list_incumbents(
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<PositionIncumbent>>> {
    let list = PositionRepository::new(st.pool.inner())
        .list_incumbents(id)
        .await
        .map_err(|e| Error::Database(format!("list incumbents: {e}")))?;
    Ok(Json(list))
}

/// POST /api/v1/org/positions/:id/incumbents — attach a person.
#[utoipa::path(
    post,
    path = "/api/v1/org/positions/{id}/incumbents",
    tag = "Org",
    params(("id" = Uuid, Path, description = "Position UUID")),
    request_body = AddIncumbentBody,
    responses(
        (status = 201, description = "Incumbent created", body = PositionIncumbent),
        (status = 400, description = "Invalid body"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st, body))]
pub async fn add_incumbent(
    State(st): State<AppState>,
    Path(position_id): Path<Uuid>,
    Json(body): Json<AddIncumbentBody>,
) -> Result<(StatusCode, Json<PositionIncumbent>)> {
    let inc = PositionRepository::new(st.pool.inner())
        .add_incumbent(body.tenant_id, position_id, body.person_id, body.start_date)
        .await
        .map_err(|e| Error::Database(format!("add incumbent: {e}")))?;

    if let Ok(payload) = serde_json::to_value(&inc) {
        let _ = st
            .event_bus
            .publish(NewEvent {
                event_type: "org.incumbent.added".to_string(),
                aggregate_id: Some(inc.id),
                payload,
            })
            .await;
    }
    Ok((StatusCode::CREATED, Json(inc)))
}

/// DELETE /api/v1/org/positions/:id/incumbents/:incumbent_id — soft revoke.
#[utoipa::path(
    delete,
    path = "/api/v1/org/positions/{id}/incumbents/{incumbent_id}",
    tag = "Org",
    params(
        ("id" = Uuid, Path, description = "Position UUID"),
        ("incumbent_id" = Uuid, Path, description = "Incumbent UUID"),
        RevokeIncumbentQuery,
    ),
    responses(
        (status = 200, description = "Incumbent revoked", body = PositionIncumbent),
        (status = 404, description = "Incumbent not found"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn revoke_incumbent(
    State(st): State<AppState>,
    Path((_position_id, incumbent_id)): Path<(Uuid, Uuid)>,
    Query(q): Query<RevokeIncumbentQuery>,
) -> Result<Json<PositionIncumbent>> {
    let revoked = PositionRepository::new(st.pool.inner())
        .revoke_incumbent(incumbent_id, q.end_date)
        .await
        .map_err(|e| Error::Database(format!("revoke incumbent: {e}")))?
        .ok_or_else(|| Error::NotFound(format!("incumbent {incumbent_id}")))?;

    if let Ok(payload) = serde_json::to_value(&revoked) {
        let _ = st
            .event_bus
            .publish(NewEvent {
                event_type: "org.incumbent.revoked".to_string(),
                aggregate_id: Some(revoked.id),
                payload,
            })
            .await;
    }
    Ok(Json(revoked))
}
