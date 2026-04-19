//! SO3 bulk ops handlers for `/api/v1/org/bulk/*`.
//!
//! Endpoints :
//! - `POST /api/v1/org/bulk/move`   → batch create assignments
//! - `POST /api/v1/org/bulk/export` → CSV export of a selection
//! - `POST /api/v1/org/bulk/assign-role` → attribute role on selection

use axum::{
    extract::State,
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    routing::post,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use signapps_common::{Error, Result};
use signapps_db::models::org::{Assignment, Axis};
use signapps_db::repositories::org::AssignmentRepository;
use uuid::Uuid;

use crate::AppState;

/// Build the bulk router (nested at `/api/v1/org/bulk`).
pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/move", post(bulk_move))
        .route("/export", post(bulk_export))
        .route("/assign-role", post(bulk_assign_role))
}

// ─── DTOs ───────────────────────────────────────────────────────────

/// Body for `POST /api/v1/org/bulk/move`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct BulkMoveBody {
    /// Tenant propriétaire.
    pub tenant_id: Uuid,
    /// Ids des personnes à déplacer.
    pub person_ids: Vec<Uuid>,
    /// Noeud cible.
    pub target_node_id: Uuid,
    /// Axe (structure | focus | group). Default `structure`.
    #[serde(default = "default_axis")]
    pub axis: Axis,
    /// Rôle optionnel à attacher.
    pub role: Option<String>,
}

fn default_axis() -> Axis {
    Axis::Structure
}

/// Body for `POST /api/v1/org/bulk/export`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct BulkExportBody {
    /// Tenant propriétaire.
    pub tenant_id: Uuid,
    /// Ids des personnes à exporter.
    pub person_ids: Vec<Uuid>,
}

/// Body for `POST /api/v1/org/bulk/assign-role`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct BulkAssignRoleBody {
    /// Tenant propriétaire.
    pub tenant_id: Uuid,
    /// Ids des personnes.
    pub person_ids: Vec<Uuid>,
    /// Role à mettre dans `attributes.title`.
    pub role: String,
}

/// Response for `POST /api/v1/org/bulk/move`.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct BulkMoveResponse {
    /// Nombre d'assignments créés.
    pub created: usize,
    /// Liste des ids d'assignments créés.
    pub assignment_ids: Vec<Uuid>,
    /// Erreurs partielles par person_id.
    pub errors: Vec<String>,
}

/// Response for `POST /api/v1/org/bulk/assign-role`.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct BulkAssignRoleResponse {
    /// Nombre de rows mises à jour.
    pub updated: usize,
    /// Erreurs partielles.
    pub errors: Vec<String>,
}

// ─── Handlers ───────────────────────────────────────────────────────

/// POST /api/v1/org/bulk/move — batch create assignments.
#[utoipa::path(
    post,
    path = "/api/v1/org/bulk/move",
    tag = "Org",
    request_body = BulkMoveBody,
    responses(
        (status = 200, description = "Assignments created", body = BulkMoveResponse),
        (status = 400, description = "Empty selection"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st, body), fields(n = body.person_ids.len()))]
pub async fn bulk_move(
    State(st): State<AppState>,
    Json(body): Json<BulkMoveBody>,
) -> Result<Json<BulkMoveResponse>> {
    if body.person_ids.is_empty() {
        return Err(Error::BadRequest("person_ids is empty".into()));
    }

    let repo = AssignmentRepository::new(st.pool.inner());
    let mut created_ids = Vec::with_capacity(body.person_ids.len());
    let mut errors = Vec::new();

    for person_id in &body.person_ids {
        let res: anyhow::Result<Assignment> = repo
            .create(
                body.tenant_id,
                *person_id,
                body.target_node_id,
                body.axis,
                body.role.as_deref(),
                false,
                None,
                None,
            )
            .await;
        match res {
            Ok(a) => created_ids.push(a.id),
            Err(e) => errors.push(format!("{person_id}: {e}")),
        }
    }

    Ok(Json(BulkMoveResponse {
        created: created_ids.len(),
        assignment_ids: created_ids,
        errors,
    }))
}

/// POST /api/v1/org/bulk/export — CSV export.
#[utoipa::path(
    post,
    path = "/api/v1/org/bulk/export",
    tag = "Org",
    request_body = BulkExportBody,
    responses(
        (status = 200, description = "CSV file", content_type = "text/csv"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st, body), fields(n = body.person_ids.len()))]
pub async fn bulk_export(
    State(st): State<AppState>,
    Json(body): Json<BulkExportBody>,
) -> std::result::Result<Response, Error> {
    if body.person_ids.is_empty() {
        return Err(Error::BadRequest("person_ids is empty".into()));
    }

    let pool = st.pool.inner();
    // Fetch only the requested persons (scoped to the tenant).
    #[derive(sqlx::FromRow)]
    struct PersonRow {
        id: Uuid,
        first_name: String,
        last_name: String,
        email: Option<String>,
    }

    let rows = sqlx::query_as::<_, PersonRow>(
        "SELECT id, first_name, last_name, email FROM org_persons
         WHERE tenant_id = $1 AND id = ANY($2)
         ORDER BY last_name, first_name",
    )
    .bind(body.tenant_id)
    .bind(&body.person_ids)
    .fetch_all(pool)
    .await
    .map_err(|e| Error::Database(format!("bulk export: {e}")))?;

    // Build CSV (quoted fields).
    let mut csv = String::from("id,first_name,last_name,email\n");
    for r in rows {
        csv.push_str(&format!(
            "{},{},{},{}\n",
            r.id,
            csv_escape(&r.first_name),
            csv_escape(&r.last_name),
            csv_escape(r.email.as_deref().unwrap_or(""))
        ));
    }

    let response = (
        StatusCode::OK,
        [
            (header::CONTENT_TYPE, "text/csv; charset=utf-8"),
            (
                header::CONTENT_DISPOSITION,
                "attachment; filename=\"persons.csv\"",
            ),
        ],
        csv,
    )
        .into_response();
    Ok(response)
}

/// POST /api/v1/org/bulk/assign-role — set role in attributes.title.
#[utoipa::path(
    post,
    path = "/api/v1/org/bulk/assign-role",
    tag = "Org",
    request_body = BulkAssignRoleBody,
    responses(
        (status = 200, description = "Roles set", body = BulkAssignRoleResponse),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st, body), fields(n = body.person_ids.len()))]
pub async fn bulk_assign_role(
    State(st): State<AppState>,
    Json(body): Json<BulkAssignRoleBody>,
) -> Result<Json<BulkAssignRoleResponse>> {
    if body.person_ids.is_empty() {
        return Err(Error::BadRequest("person_ids is empty".into()));
    }
    let pool = st.pool.inner();

    // jsonb_set writes attributes.title = role for each row.
    let res = sqlx::query(
        r#"
        UPDATE org_persons
           SET attributes = jsonb_set(
               COALESCE(attributes, '{}'::jsonb),
               '{title}',
               to_jsonb($3::text),
               true
           )
         WHERE tenant_id = $1 AND id = ANY($2)
        "#,
    )
    .bind(body.tenant_id)
    .bind(&body.person_ids)
    .bind(&body.role)
    .execute(pool)
    .await;

    match res {
        Ok(r) => Ok(Json(BulkAssignRoleResponse {
            updated: usize::try_from(r.rows_affected()).unwrap_or(0),
            errors: vec![],
        })),
        Err(e) => Err(Error::Database(format!("bulk assign-role: {e}"))),
    }
}

// ─── Helpers ────────────────────────────────────────────────────────

fn csv_escape(s: &str) -> String {
    if s.contains(',') || s.contains('"') || s.contains('\n') {
        let escaped = s.replace('"', "\"\"");
        format!("\"{escaped}\"")
    } else {
        s.to_string()
    }
}
