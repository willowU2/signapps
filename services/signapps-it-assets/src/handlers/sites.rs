//! Site handlers: CRUD, list persons, attach node/person.

use crate::handlers::AppState;
use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use signapps_common::{Claims, Error, Result};
use signapps_db::models::core_org::{CreateSite, NodeSite, Person, PersonSite, Site, UpdateSite};
use signapps_db::repositories::SiteRepository;
use uuid::Uuid;

// ============================================================================
// Request DTOs
// ============================================================================

/// Request body for creating a site.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreateSiteRequest {
    pub parent_id: Option<Uuid>,
    pub site_type: String,
    pub name: String,
    pub address: Option<String>,
    pub city: Option<String>,
    pub country: Option<String>,
    pub geo_lat: Option<f64>,
    pub geo_lng: Option<f64>,
    pub timezone: Option<String>,
    pub capacity: Option<i32>,
}

/// Request body for updating a site.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct UpdateSiteRequest {
    pub name: Option<String>,
    pub address: Option<String>,
    pub city: Option<String>,
    pub country: Option<String>,
    pub geo_lat: Option<f64>,
    pub geo_lng: Option<f64>,
    pub timezone: Option<String>,
    pub capacity: Option<i32>,
    pub is_active: Option<bool>,
}

/// Request body for attaching an org node to a site.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct AttachNodeRequest {
    pub node_id: Uuid,
    pub is_primary: Option<bool>,
}

/// Request body for attaching a person to a site.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct AttachPersonRequest {
    pub person_id: Uuid,
    pub is_primary: Option<bool>,
}

// ============================================================================
// Handlers
// ============================================================================

/// GET /api/v1/sites — List all active sites for the authenticated user's tenant.
#[utoipa::path(
    get,
    path = "/api/v1/sites",
    tag = "sites",
    security(("bearerAuth" = [])),
    responses(
        (status = 200, description = "Site list", body = Vec<Site>),
        (status = 401, description = "Not authenticated"),
        (status = 403, description = "No tenant context"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn list_sites(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<Site>>> {
    let tenant_id = claims
        .tenant_id
        .ok_or_else(|| Error::Forbidden("No tenant context".into()))?;
    let sites = SiteRepository::list(&state.pool, tenant_id).await?;
    Ok(Json(sites))
}

/// POST /api/v1/sites — Create a new site for the authenticated user's tenant.
#[utoipa::path(
    post,
    path = "/api/v1/sites",
    tag = "sites",
    security(("bearerAuth" = [])),
    request_body = CreateSiteRequest,
    responses(
        (status = 201, description = "Site created", body = Site),
        (status = 401, description = "Not authenticated"),
        (status = 403, description = "No tenant context"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn create_site(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateSiteRequest>,
) -> Result<(StatusCode, Json<Site>)> {
    let tenant_id = claims
        .tenant_id
        .ok_or_else(|| Error::Forbidden("No tenant context".into()))?;
    let input = CreateSite {
        tenant_id,
        parent_id: payload.parent_id,
        site_type: payload.site_type,
        name: payload.name,
        address: payload.address,
        city: payload.city,
        country: payload.country,
        geo_lat: payload.geo_lat,
        geo_lng: payload.geo_lng,
        timezone: payload.timezone,
        capacity: payload.capacity,
    };
    let site = SiteRepository::create(&state.pool, input).await?;
    Ok((StatusCode::CREATED, Json(site)))
}

/// GET /api/v1/sites/:id — Retrieve a site by ID.
#[utoipa::path(
    get,
    path = "/api/v1/sites/{id}",
    tag = "sites",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 200, description = "Site detail", body = Site),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Site not found"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn get_site(State(state): State<AppState>, Path(id): Path<Uuid>) -> Result<Json<Site>> {
    let site = SiteRepository::find(&state.pool, id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Site {id} not found")))?;
    Ok(Json(site))
}

/// PUT /api/v1/sites/:id — Update a site.
#[utoipa::path(
    put,
    path = "/api/v1/sites/{id}",
    tag = "sites",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Site UUID")),
    request_body = UpdateSiteRequest,
    responses(
        (status = 200, description = "Site updated", body = Site),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Site not found"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn update_site(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateSiteRequest>,
) -> Result<Json<Site>> {
    let input = UpdateSite {
        name: payload.name,
        address: payload.address,
        city: payload.city,
        country: payload.country,
        geo_lat: payload.geo_lat,
        geo_lng: payload.geo_lng,
        timezone: payload.timezone,
        capacity: payload.capacity,
        is_active: payload.is_active,
    };
    let site = SiteRepository::update(&state.pool, id, input).await?;
    Ok(Json(site))
}

/// GET /api/v1/sites/:id/persons — List active persons assigned to a site.
#[utoipa::path(
    get,
    path = "/api/v1/sites/{id}/persons",
    tag = "sites",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 200, description = "Persons at this site", body = Vec<Person>),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn list_site_persons(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<Person>>> {
    let persons = SiteRepository::list_persons(&state.pool, id).await?;
    Ok(Json(persons))
}

/// POST /api/v1/sites/:id/attach-node — Attach an org node to this site.
#[utoipa::path(
    post,
    path = "/api/v1/sites/{id}/attach-node",
    tag = "sites",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Site UUID")),
    request_body = AttachNodeRequest,
    responses(
        (status = 200, description = "Node attached", body = NodeSite),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn attach_node(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<AttachNodeRequest>,
) -> Result<Json<NodeSite>> {
    let node_site = SiteRepository::attach_node(
        &state.pool,
        payload.node_id,
        id,
        payload.is_primary.unwrap_or(false),
    )
    .await?;
    Ok(Json(node_site))
}

/// POST /api/v1/sites/:id/attach-person — Attach a person to this site.
#[utoipa::path(
    post,
    path = "/api/v1/sites/{id}/attach-person",
    tag = "sites",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Site UUID")),
    request_body = AttachPersonRequest,
    responses(
        (status = 200, description = "Person attached", body = PersonSite),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn attach_person(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<AttachPersonRequest>,
) -> Result<Json<PersonSite>> {
    let person_site = SiteRepository::attach_person(
        &state.pool,
        payload.person_id,
        id,
        payload.is_primary.unwrap_or(false),
    )
    .await?;
    Ok(Json(person_site))
}
