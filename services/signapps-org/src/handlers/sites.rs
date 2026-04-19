//! SO7 handlers for `/api/v1/org/sites` — sites physiques.
//!
//! Endpoints :
//! - `GET    /api/v1/org/sites?tenant_id=X&kind=Y`
//! - `GET    /api/v1/org/sites/:id`
//! - `GET    /api/v1/org/sites/:id/tree`
//! - `POST   /api/v1/org/sites`
//! - `PUT    /api/v1/org/sites/:id`
//! - `DELETE /api/v1/org/sites/:id` (soft-delete)
//! - `GET    /api/v1/org/sites/:id/persons`
//! - `POST   /api/v1/org/sites/:id/persons`
//! - `DELETE /api/v1/org/sites/persons/:sp_id`

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{delete, get},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use signapps_common::{Error, Result};
use signapps_db::models::org::{
    OrgSite, Person, SiteKind, SitePerson, SitePersonRole,
};
use signapps_db::repositories::org::SiteRepository;
use uuid::Uuid;

use crate::AppState;

/// Mount the sites router at `/api/v1/org/sites`.
pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list).post(create))
        .route("/:id", get(get_one).put(update).delete(archive))
        .route("/:id/tree", get(subtree))
        .route("/:id/persons", get(list_persons).post(attach_person))
        .route("/persons/:sp_id", delete(detach_person))
}

// ─── DTOs ─────────────────────────────────────────────────────────────

/// Query for `GET /api/v1/org/sites`.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct ListQuery {
    /// Tenant UUID.
    pub tenant_id: Uuid,
    /// Optional kind filter (`building` | `floor` | `room` | `desk`).
    pub kind: Option<String>,
}

/// Body for `POST /api/v1/org/sites`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreateBody {
    /// Tenant.
    pub tenant_id: Uuid,
    /// Parent (NULL pour un building).
    pub parent_id: Option<Uuid>,
    /// Slug unique.
    pub slug: String,
    /// Libellé.
    pub name: String,
    /// Kind.
    pub kind: String,
    /// Adresse (building seulement).
    pub address: Option<String>,
    /// GPS `{lat, lng}` (building seulement).
    pub gps: Option<serde_json::Value>,
    /// Timezone IANA.
    pub timezone: Option<String>,
    /// Capacité.
    pub capacity: Option<i32>,
    /// Equipment JSONB.
    #[serde(default)]
    pub equipment: serde_json::Value,
    /// Bookable flag.
    #[serde(default)]
    pub bookable: bool,
}

/// Body for `PUT /api/v1/org/sites/:id`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct UpdateBody {
    /// Nouveau libellé.
    pub name: String,
    /// Adresse (null pour vider).
    pub address: Option<String>,
    /// GPS.
    pub gps: Option<serde_json::Value>,
    /// Timezone.
    pub timezone: Option<String>,
    /// Capacité.
    pub capacity: Option<i32>,
    /// Equipment.
    #[serde(default)]
    pub equipment: serde_json::Value,
    /// Bookable.
    #[serde(default)]
    pub bookable: bool,
}

/// Body for `POST /api/v1/org/sites/:id/persons`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct AttachPersonBody {
    /// Personne rattachée.
    pub person_id: Uuid,
    /// `primary` ou `secondary` (défaut).
    #[serde(default = "default_secondary")]
    pub role: String,
    /// Desk optionnel (site child of kind = desk).
    pub desk_id: Option<Uuid>,
}

fn default_secondary() -> String {
    "secondary".to_string()
}

/// Response combining a site with all its persons.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct SitePersonsResponse {
    /// Raw site-person rows.
    pub assignments: Vec<SitePerson>,
    /// Person details.
    pub persons: Vec<Person>,
}

// ─── Handlers ─────────────────────────────────────────────────────────

/// GET /api/v1/org/sites
#[utoipa::path(
    get,
    path = "/api/v1/org/sites",
    tag = "Org Sites",
    params(ListQuery),
    responses((status = 200, description = "Sites", body = Vec<OrgSite>)),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn list(
    State(st): State<AppState>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<OrgSite>>> {
    let kind = match q.kind.as_deref() {
        Some(k) => Some(SiteKind::parse(k).map_err(Error::BadRequest)?),
        None => None,
    };
    let rows = SiteRepository::new(st.pool.inner())
        .list_by_tenant(q.tenant_id, kind)
        .await
        .map_err(|e| Error::Database(format!("list sites: {e}")))?;
    Ok(Json(rows))
}

/// GET /api/v1/org/sites/:id
#[utoipa::path(
    get,
    path = "/api/v1/org/sites/{id}",
    tag = "Org Sites",
    params(("id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 200, description = "Site", body = OrgSite),
        (status = 404, description = "Not found"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn get_one(
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<OrgSite>> {
    let row = SiteRepository::new(st.pool.inner())
        .get(id)
        .await
        .map_err(|e| Error::Database(format!("get site: {e}")))?
        .ok_or_else(|| Error::NotFound(format!("site {id}")))?;
    Ok(Json(row))
}

/// GET /api/v1/org/sites/:id/tree — recursive subtree.
#[utoipa::path(
    get,
    path = "/api/v1/org/sites/{id}/tree",
    tag = "Org Sites",
    params(("id" = Uuid, Path, description = "Site UUID")),
    responses((status = 200, description = "Subtree", body = Vec<OrgSite>)),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn subtree(
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<OrgSite>>> {
    let rows = SiteRepository::new(st.pool.inner())
        .subtree(id)
        .await
        .map_err(|e| Error::Database(format!("subtree: {e}")))?;
    Ok(Json(rows))
}

/// POST /api/v1/org/sites
#[utoipa::path(
    post,
    path = "/api/v1/org/sites",
    tag = "Org Sites",
    request_body = CreateBody,
    responses(
        (status = 201, description = "Created", body = OrgSite),
        (status = 400, description = "Bad kind"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st, body))]
pub async fn create(
    State(st): State<AppState>,
    Json(body): Json<CreateBody>,
) -> Result<(StatusCode, Json<OrgSite>)> {
    let kind = SiteKind::parse(&body.kind).map_err(Error::BadRequest)?;
    let row = SiteRepository::new(st.pool.inner())
        .create(
            body.tenant_id,
            body.parent_id,
            &body.slug,
            &body.name,
            kind,
            body.address.as_deref(),
            body.gps,
            body.timezone.as_deref(),
            body.capacity,
            body.equipment,
            body.bookable,
        )
        .await
        .map_err(|e| Error::Database(format!("create site: {e}")))?;
    Ok((StatusCode::CREATED, Json(row)))
}

/// PUT /api/v1/org/sites/:id
#[utoipa::path(
    put,
    path = "/api/v1/org/sites/{id}",
    tag = "Org Sites",
    params(("id" = Uuid, Path, description = "Site UUID")),
    request_body = UpdateBody,
    responses(
        (status = 200, description = "Updated", body = OrgSite),
        (status = 404, description = "Not found"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st, body))]
pub async fn update(
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateBody>,
) -> Result<Json<OrgSite>> {
    let row = SiteRepository::new(st.pool.inner())
        .update(
            id,
            &body.name,
            body.address.as_deref(),
            body.gps,
            body.timezone.as_deref(),
            body.capacity,
            body.equipment,
            body.bookable,
        )
        .await
        .map_err(|e| Error::Database(format!("update site: {e}")))?
        .ok_or_else(|| Error::NotFound(format!("site {id}")))?;
    Ok(Json(row))
}

/// DELETE /api/v1/org/sites/:id
#[utoipa::path(
    delete,
    path = "/api/v1/org/sites/{id}",
    tag = "Org Sites",
    params(("id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 204, description = "Archived"),
        (status = 404, description = "Not found"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn archive(State(st): State<AppState>, Path(id): Path<Uuid>) -> Result<StatusCode> {
    let ok = SiteRepository::new(st.pool.inner())
        .archive(id)
        .await
        .map_err(|e| Error::Database(format!("archive site: {e}")))?;
    if !ok {
        return Err(Error::NotFound(format!("site {id}")));
    }
    Ok(StatusCode::NO_CONTENT)
}

/// GET /api/v1/org/sites/:id/persons
#[utoipa::path(
    get,
    path = "/api/v1/org/sites/{id}/persons",
    tag = "Org Sites",
    params(("id" = Uuid, Path, description = "Site UUID")),
    responses((status = 200, description = "Persons", body = SitePersonsResponse)),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn list_persons(
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<SitePersonsResponse>> {
    let repo = SiteRepository::new(st.pool.inner());
    let assignments = repo
        .list_persons(id)
        .await
        .map_err(|e| Error::Database(format!("list site persons: {e}")))?;

    let person_ids: Vec<Uuid> = assignments.iter().map(|a| a.person_id).collect();
    let persons: Vec<Person> = if person_ids.is_empty() {
        Vec::new()
    } else {
        sqlx::query_as::<_, Person>(
            "SELECT * FROM org_persons WHERE id = ANY($1) AND active",
        )
        .bind(&person_ids)
        .fetch_all(st.pool.inner())
        .await
        .map_err(|e| Error::Database(format!("fetch persons: {e}")))?
    };

    Ok(Json(SitePersonsResponse {
        assignments,
        persons,
    }))
}

/// POST /api/v1/org/sites/:id/persons
#[utoipa::path(
    post,
    path = "/api/v1/org/sites/{id}/persons",
    tag = "Org Sites",
    params(("id" = Uuid, Path, description = "Site UUID")),
    request_body = AttachPersonBody,
    responses(
        (status = 201, description = "Attached", body = SitePerson),
        (status = 400, description = "Bad role"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st, body))]
pub async fn attach_person(
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<AttachPersonBody>,
) -> Result<(StatusCode, Json<SitePerson>)> {
    let role = SitePersonRole::parse(&body.role).map_err(Error::BadRequest)?;
    let row = SiteRepository::new(st.pool.inner())
        .attach_person(body.person_id, id, role, body.desk_id)
        .await
        .map_err(|e| Error::Database(format!("attach person: {e}")))?;
    Ok((StatusCode::CREATED, Json(row)))
}

/// DELETE /api/v1/org/sites/persons/:sp_id
#[utoipa::path(
    delete,
    path = "/api/v1/org/sites/persons/{sp_id}",
    tag = "Org Sites",
    params(("sp_id" = Uuid, Path, description = "Site-person row UUID")),
    responses(
        (status = 204, description = "Detached"),
        (status = 404, description = "Not found"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn detach_person(
    State(st): State<AppState>,
    Path(sp_id): Path<Uuid>,
) -> Result<StatusCode> {
    let ok = SiteRepository::new(st.pool.inner())
        .detach_person(sp_id)
        .await
        .map_err(|e| Error::Database(format!("detach person: {e}")))?;
    if !ok {
        return Err(Error::NotFound(format!("site_person {sp_id}")));
    }
    Ok(StatusCode::NO_CONTENT)
}
