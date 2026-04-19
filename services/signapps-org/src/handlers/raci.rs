//! SO2 RACI matrix handlers.
//!
//! Endpoints :
//! - `GET    /api/v1/org/raci?project_id=X`   → list
//! - `POST   /api/v1/org/raci`                → create
//! - `POST   /api/v1/org/raci/bulk`           → bulk set (replace per person)
//! - `DELETE /api/v1/org/raci/:id`            → remove one row
//!
//! **Validation** — la contrainte SQL
//! `idx_raci_one_accountable` empêche deux `accountable` sur le même
//! projet. On intercepte l'erreur pour retourner un `409 Conflict`
//! lisible.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{delete, get, post},
    Json, Router,
};
use serde::Deserialize;
use signapps_common::{Error, Result};
use signapps_db::models::org::{Raci, RaciRole};
use signapps_db::repositories::org::RaciRepository;
use uuid::Uuid;

use crate::AppState;

/// Build the RACI router.
pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list).post(create))
        .route("/bulk", post(bulk_set))
        .route("/:id", delete(delete_one))
}

// ─── DTOs ─────────────────────────────────────────────────────────────

/// Query for `GET /api/v1/org/raci`.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct ListQuery {
    /// Projet (un `org_nodes.id` avec `attributes.axis_type='project'`).
    pub project_id: Uuid,
}

/// Request body for `POST /api/v1/org/raci`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreateBody {
    /// Tenant propriétaire.
    pub tenant_id: Uuid,
    /// Projet.
    pub project_id: Uuid,
    /// Personne.
    pub person_id: Uuid,
    /// Rôle RACI.
    pub role: RaciRole,
}

/// One entry in the bulk-set payload.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct BulkEntry {
    /// Projet.
    pub project_id: Uuid,
    /// Personne.
    pub person_id: Uuid,
    /// Liste des rôles à définir. Vide = retire la personne du projet.
    pub roles: Vec<RaciRole>,
}

/// Request body for `POST /api/v1/org/raci/bulk`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct BulkBody {
    /// Tenant propriétaire.
    pub tenant_id: Uuid,
    /// Liste des assignations.
    pub entries: Vec<BulkEntry>,
}

// ─── Handlers ─────────────────────────────────────────────────────────

/// `GET /api/v1/org/raci` — list entries for a project.
#[utoipa::path(
    get,
    path = "/api/v1/org/raci",
    tag = "Org",
    params(ListQuery),
    responses(
        (status = 200, description = "RACI entries", body = Vec<Raci>),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn list(
    State(st): State<AppState>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<Raci>>> {
    let rows = RaciRepository::new(st.pool.inner())
        .list_by_project(q.project_id)
        .await
        .map_err(|e| Error::Database(format!("list_by_project: {e}")))?;
    Ok(Json(rows))
}

/// `POST /api/v1/org/raci` — create a single entry.
#[utoipa::path(
    post,
    path = "/api/v1/org/raci",
    tag = "Org",
    request_body = CreateBody,
    responses(
        (status = 201, description = "RACI created", body = Raci),
        (status = 409, description = "Another accountable already exists on this project"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st, body))]
pub async fn create(
    State(st): State<AppState>,
    Json(body): Json<CreateBody>,
) -> Result<(StatusCode, Json<Raci>)> {
    let row = RaciRepository::new(st.pool.inner())
        .create(body.tenant_id, body.project_id, body.person_id, body.role)
        .await
        .map_err(map_unique_violation)?;
    Ok((StatusCode::CREATED, Json(row)))
}

/// `POST /api/v1/org/raci/bulk` — replace RACI roles of `(project, person)`
/// pairs in a single transaction per pair.
#[utoipa::path(
    post,
    path = "/api/v1/org/raci/bulk",
    tag = "Org",
    request_body = BulkBody,
    responses(
        (status = 200, description = "Bulk set applied", body = Vec<Raci>),
        (status = 409, description = "Unique accountable constraint violated"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st, body))]
pub async fn bulk_set(
    State(st): State<AppState>,
    Json(body): Json<BulkBody>,
) -> Result<Json<Vec<Raci>>> {
    let repo = RaciRepository::new(st.pool.inner());
    let mut all = Vec::new();
    for entry in body.entries {
        let rows = repo
            .bulk_set(body.tenant_id, entry.project_id, entry.person_id, &entry.roles)
            .await
            .map_err(map_unique_violation)?;
        all.extend(rows);
    }
    Ok(Json(all))
}

/// `DELETE /api/v1/org/raci/:id` — remove one RACI row.
#[utoipa::path(
    delete,
    path = "/api/v1/org/raci/{id}",
    tag = "Org",
    params(("id" = Uuid, Path, description = "RACI row UUID")),
    responses(
        (status = 204, description = "Row deleted"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn delete_one(
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    RaciRepository::new(st.pool.inner())
        .delete(id)
        .await
        .map_err(|e| Error::Database(format!("delete raci: {e}")))?;
    Ok(StatusCode::NO_CONTENT)
}

/// Map `UNIQUE` violations coming from the `idx_raci_one_accountable`
/// partial index (and the `(project, person, role)` triple) to a
/// `409 Conflict` payload.
fn map_unique_violation(err: anyhow::Error) -> Error {
    let msg = err.to_string();
    if msg.contains("idx_raci_one_accountable") {
        Error::Conflict("only one accountable allowed per project".into())
    } else if msg.contains("org_raci_project_id_person_id_role_key") {
        Error::Conflict("this person already has this role on this project".into())
    } else {
        Error::Database(format!("raci write: {msg}"))
    }
}
