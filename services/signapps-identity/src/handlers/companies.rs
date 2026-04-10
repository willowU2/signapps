//! Company CRUD and person-company affiliation endpoints.
//!
//! Manages the `core.companies` table and the `core.person_companies`
//! affiliation table that underpins the Unified Person Model.
//!
//! # Endpoints
//!
//! - `GET    /api/v1/companies`                   — list companies (optional `?type=` filter)
//! - `POST   /api/v1/companies`                   — create company
//! - `GET    /api/v1/companies/:id`               — get company by ID
//! - `PUT    /api/v1/companies/:id`               — update company
//! - `DELETE /api/v1/companies/:id`               — deactivate company (soft-delete)
//! - `GET    /api/v1/companies/:id/persons`        — list persons affiliated with a company
//! - `POST   /api/v1/companies/:id/persons`        — add a person-company affiliation
//! - `DELETE /api/v1/companies/:cid/persons/:pid`  — remove an affiliation
//! - `GET    /api/v1/persons/:id/companies`        — list companies for a person
//! - `PUT    /api/v1/person-companies/:id`         — update an affiliation

use crate::AppState;
use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use signapps_common::{Claims, Error, Result};
use signapps_db::{
    models::company::{CreateCompany, CreatePersonCompany, UpdateCompany, UpdatePersonCompany},
    repositories::CompanyRepository,
};
use uuid::Uuid;

// ── Query params ──────────────────────────────────────────────────────────────

/// Query parameters for `list_companies`.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct ListCompaniesQuery {
    /// Filter by company type: `internal`, `client`, `supplier`, `partner`.
    #[serde(rename = "type")]
    pub company_type: Option<String>,
}

// ── Handlers ──────────────────────────────────────────────────────────────────

/// List companies for the current tenant.
///
/// # Examples
///
/// ```http
/// GET /api/v1/companies?type=client
/// Authorization: Bearer <token>
/// ```
///
/// # Errors
///
/// Returns `500 Internal Server Error` on database failure.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[utoipa::path(
    get,
    path = "/api/v1/companies",
    params(ListCompaniesQuery),
    responses(
        (status = 200, description = "List of companies"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearer" = [])),
    tag = "Companies"
)]
#[tracing::instrument(skip_all, fields(user_id = %claims.sub))]
pub async fn list_companies(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListCompaniesQuery>,
) -> Result<Json<serde_json::Value>> {
    let tenant_id = claims.tenant_id.unwrap_or_default();
    let companies =
        CompanyRepository::list(&state.pool, tenant_id, params.company_type.as_deref()).await?;
    Ok(Json(serde_json::json!({ "companies": companies })))
}

/// Create a new company.
///
/// # Examples
///
/// ```http
/// POST /api/v1/companies
/// Authorization: Bearer <token>
/// Content-Type: application/json
///
/// { "name": "Acme Corp", "company_type": "client" }
/// ```
///
/// # Errors
///
/// Returns `400 Bad Request` on constraint violations.
/// Returns `401 Unauthorized` if the token is missing or invalid.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[utoipa::path(
    post,
    path = "/api/v1/companies",
    request_body = CreateCompany,
    responses(
        (status = 201, description = "Company created"),
        (status = 400, description = "Invalid input"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearer" = [])),
    tag = "Companies"
)]
#[tracing::instrument(skip_all, fields(user_id = %claims.sub))]
pub async fn create_company(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(input): Json<CreateCompany>,
) -> Result<(StatusCode, Json<serde_json::Value>)> {
    let tenant_id = claims.tenant_id.unwrap_or_default();
    let company = CompanyRepository::create(&state.pool, tenant_id, input).await?;
    Ok((StatusCode::CREATED, Json(serde_json::json!({ "company": company }))))
}

/// Get a company by ID.
///
/// # Examples
///
/// ```http
/// GET /api/v1/companies/00000000-0000-0000-0000-000000000001
/// Authorization: Bearer <token>
/// ```
///
/// # Errors
///
/// Returns `404 Not Found` if the company does not exist.
/// Returns `401 Unauthorized` if the token is missing or invalid.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[utoipa::path(
    get,
    path = "/api/v1/companies/{id}",
    params(("id" = Uuid, Path, description = "Company ID")),
    responses(
        (status = 200, description = "Company found"),
        (status = 404, description = "Not found"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearer" = [])),
    tag = "Companies"
)]
#[tracing::instrument(skip_all, fields(user_id = %claims.sub))]
pub async fn get_company(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    let company = CompanyRepository::find_by_id(&state.pool, id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Company {id}")))?;
    Ok(Json(serde_json::json!({ "company": company })))
}

/// Update a company.
///
/// # Examples
///
/// ```http
/// PUT /api/v1/companies/00000000-0000-0000-0000-000000000001
/// Authorization: Bearer <token>
/// Content-Type: application/json
///
/// { "name": "Acme Corporation" }
/// ```
///
/// # Errors
///
/// Returns `404 Not Found` if the company does not exist.
/// Returns `400 Bad Request` on validation failures.
/// Returns `401 Unauthorized` if the token is missing or invalid.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[utoipa::path(
    put,
    path = "/api/v1/companies/{id}",
    params(("id" = Uuid, Path, description = "Company ID")),
    request_body = UpdateCompany,
    responses(
        (status = 200, description = "Company updated"),
        (status = 404, description = "Not found"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearer" = [])),
    tag = "Companies"
)]
#[tracing::instrument(skip_all, fields(user_id = %claims.sub))]
pub async fn update_company(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdateCompany>,
) -> Result<Json<serde_json::Value>> {
    let company = CompanyRepository::update(&state.pool, id, input).await?;
    Ok(Json(serde_json::json!({ "company": company })))
}

/// Soft-deactivate a company.
///
/// Sets `is_active = FALSE`. The company record is retained in the database.
///
/// # Examples
///
/// ```http
/// DELETE /api/v1/companies/00000000-0000-0000-0000-000000000001
/// Authorization: Bearer <token>
/// ```
///
/// # Errors
///
/// Returns `404 Not Found` if the company does not exist.
/// Returns `401 Unauthorized` if the token is missing or invalid.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[utoipa::path(
    delete,
    path = "/api/v1/companies/{id}",
    params(("id" = Uuid, Path, description = "Company ID")),
    responses(
        (status = 204, description = "Company deactivated"),
        (status = 404, description = "Not found"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearer" = [])),
    tag = "Companies"
)]
#[tracing::instrument(skip_all, fields(user_id = %claims.sub))]
pub async fn deactivate_company(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    CompanyRepository::deactivate(&state.pool, id).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// List all persons affiliated with a company.
///
/// # Examples
///
/// ```http
/// GET /api/v1/companies/00000000-0000-0000-0000-000000000001/persons
/// Authorization: Bearer <token>
/// ```
///
/// # Errors
///
/// Returns `500 Internal Server Error` on database failure.
/// Returns `401 Unauthorized` if the token is missing or invalid.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[utoipa::path(
    get,
    path = "/api/v1/companies/{id}/persons",
    params(("id" = Uuid, Path, description = "Company ID")),
    responses(
        (status = 200, description = "List of person-company affiliations"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearer" = [])),
    tag = "Companies"
)]
#[tracing::instrument(skip_all, fields(user_id = %claims.sub))]
pub async fn list_company_persons(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    let affiliations = CompanyRepository::list_persons_for_company(&state.pool, id).await?;
    Ok(Json(serde_json::json!({ "affiliations": affiliations })))
}

/// Add a person-company affiliation.
///
/// # Examples
///
/// ```http
/// POST /api/v1/companies/00000000-0000-0000-0000-000000000001/persons
/// Authorization: Bearer <token>
/// Content-Type: application/json
///
/// { "person_id": "...", "company_id": "...", "role_in_company": "employee" }
/// ```
///
/// # Errors
///
/// Returns `400 Bad Request` on constraint violations (e.g. duplicate affiliation).
/// Returns `401 Unauthorized` if the token is missing or invalid.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[utoipa::path(
    post,
    path = "/api/v1/companies/{id}/persons",
    params(("id" = Uuid, Path, description = "Company ID")),
    request_body = CreatePersonCompany,
    responses(
        (status = 201, description = "Affiliation created"),
        (status = 400, description = "Invalid input or duplicate"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearer" = [])),
    tag = "Companies"
)]
#[tracing::instrument(skip_all, fields(user_id = %claims.sub))]
pub async fn add_company_person(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(company_id): Path<Uuid>,
    Json(mut input): Json<CreatePersonCompany>,
) -> Result<(StatusCode, Json<serde_json::Value>)> {
    // Ensure the company_id in the body matches the path parameter
    input.company_id = company_id;
    let affiliation = CompanyRepository::create_affiliation(&state.pool, input).await?;
    Ok((StatusCode::CREATED, Json(serde_json::json!({ "affiliation": affiliation }))))
}

/// Remove a person-company affiliation.
///
/// # Examples
///
/// ```http
/// DELETE /api/v1/companies/00000000-0000-0000-0000-000000000001/persons/00000000-0000-0000-0000-000000000002
/// Authorization: Bearer <token>
/// ```
///
/// # Errors
///
/// Returns `404 Not Found` if the affiliation does not exist.
/// Returns `401 Unauthorized` if the token is missing or invalid.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[utoipa::path(
    delete,
    path = "/api/v1/companies/{cid}/persons/{pid}",
    params(
        ("cid" = Uuid, Path, description = "Company ID"),
        ("pid" = Uuid, Path, description = "PersonCompany affiliation ID"),
    ),
    responses(
        (status = 204, description = "Affiliation removed"),
        (status = 404, description = "Not found"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearer" = [])),
    tag = "Companies"
)]
#[tracing::instrument(skip_all, fields(user_id = %claims.sub))]
pub async fn remove_company_person(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((_cid, pid)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode> {
    CompanyRepository::remove_affiliation(&state.pool, pid).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// List all company affiliations for a person.
///
/// # Examples
///
/// ```http
/// GET /api/v1/persons/00000000-0000-0000-0000-000000000001/companies
/// Authorization: Bearer <token>
/// ```
///
/// # Errors
///
/// Returns `500 Internal Server Error` on database failure.
/// Returns `401 Unauthorized` if the token is missing or invalid.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[utoipa::path(
    get,
    path = "/api/v1/persons/{id}/companies",
    params(("id" = Uuid, Path, description = "Person ID")),
    responses(
        (status = 200, description = "List of person-company affiliations"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearer" = [])),
    tag = "Companies"
)]
#[tracing::instrument(skip_all, fields(user_id = %claims.sub))]
pub async fn list_person_companies(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(person_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    let affiliations =
        CompanyRepository::list_companies_for_person(&state.pool, person_id).await?;
    Ok(Json(serde_json::json!({ "affiliations": affiliations })))
}

/// Update a person-company affiliation.
///
/// # Examples
///
/// ```http
/// PUT /api/v1/person-companies/00000000-0000-0000-0000-000000000001
/// Authorization: Bearer <token>
/// Content-Type: application/json
///
/// { "job_title": "Senior Engineer", "is_primary": true }
/// ```
///
/// # Errors
///
/// Returns `404 Not Found` if the affiliation does not exist.
/// Returns `400 Bad Request` on validation failures.
/// Returns `401 Unauthorized` if the token is missing or invalid.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[utoipa::path(
    put,
    path = "/api/v1/person-companies/{id}",
    params(("id" = Uuid, Path, description = "PersonCompany affiliation ID")),
    request_body = UpdatePersonCompany,
    responses(
        (status = 200, description = "Affiliation updated"),
        (status = 404, description = "Not found"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearer" = [])),
    tag = "Companies"
)]
#[tracing::instrument(skip_all, fields(user_id = %claims.sub))]
pub async fn update_affiliation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdatePersonCompany>,
) -> Result<Json<serde_json::Value>> {
    let affiliation = CompanyRepository::update_affiliation(&state.pool, id, input).await?;
    Ok(Json(serde_json::json!({ "affiliation": affiliation })))
}
