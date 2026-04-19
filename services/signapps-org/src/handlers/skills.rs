//! SO3 handlers for `/api/v1/org/skills` and person-skills.
//!
//! Endpoints :
//! - `GET  /api/v1/org/skills?tenant_id=X&category=Y`        — catalog
//! - `POST /api/v1/org/skills`                               — create custom skill
//! - `GET  /api/v1/org/persons/:id/skills`                   — list tagged
//! - `POST /api/v1/org/persons/:id/skills`                   — upsert tag
//! - `DELETE /api/v1/org/persons/:id/skills/:skill_id`       — untag
//! - `POST /api/v1/org/persons/:id/skills/:skill_id/endorse` — endorse

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use signapps_common::{Error, Result};
use signapps_db::models::org::{PersonSkill, PersonSkillWithName, Skill, SkillCategory};
use signapps_db::repositories::org::SkillRepository;
use uuid::Uuid;

use crate::AppState;

/// Build the skills catalog router (nested at `/api/v1/org/skills`).
pub fn routes_catalog() -> Router<AppState> {
    Router::new().route("/", get(list).post(create))
}

/// Build the person-skills sub-router (nested under `/api/v1/org/persons/:person_id/skills`).
pub fn routes_person() -> Router<AppState> {
    Router::new()
        .route("/", get(list_person_skills).post(tag_skill))
        .route("/:skill_id", axum::routing::delete(untag_skill))
        .route("/:skill_id/endorse", post(endorse_skill))
}

// ─── DTOs ───────────────────────────────────────────────────────────

/// Query params for `GET /api/v1/org/skills`.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct ListSkillsQuery {
    /// Optional tenant filter (include the tenant's customs + globals).
    pub tenant_id: Option<Uuid>,
    /// Optional category filter.
    pub category: Option<SkillCategory>,
}

/// Request body for `POST /api/v1/org/skills`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreateSkillBody {
    /// Tenant (None = global — réservé aux admins, à renforcer plus tard).
    pub tenant_id: Option<Uuid>,
    /// Slug (`rust`, `aws`, …).
    pub slug: String,
    /// Nom affiché.
    pub name: String,
    /// Catégorie.
    pub category: SkillCategory,
    /// Description optionnelle.
    pub description: Option<String>,
}

/// Request body for `POST /api/v1/org/persons/:id/skills`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct TagSkillBody {
    /// Skill UUID.
    pub skill_id: Uuid,
    /// Niveau 1-5.
    pub level: i16,
}

/// Response shell simple pour l'endorsement.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct EndorseResponse {
    /// Le row mis à jour.
    pub person_skill: PersonSkill,
}

// ─── Handlers (catalog) ─────────────────────────────────────────────

/// GET /api/v1/org/skills — list skills.
#[utoipa::path(
    get,
    path = "/api/v1/org/skills",
    tag = "Org",
    params(ListSkillsQuery),
    responses(
        (status = 200, description = "Skills", body = Vec<Skill>),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn list(
    State(st): State<AppState>,
    Query(q): Query<ListSkillsQuery>,
) -> Result<Json<Vec<Skill>>> {
    let rows = SkillRepository::new(st.pool.inner())
        .list(q.tenant_id, q.category)
        .await
        .map_err(|e| Error::Database(format!("list skills: {e}")))?;
    Ok(Json(rows))
}

/// POST /api/v1/org/skills — create custom skill for a tenant (or global).
#[utoipa::path(
    post,
    path = "/api/v1/org/skills",
    tag = "Org",
    request_body = CreateSkillBody,
    responses(
        (status = 201, description = "Skill created", body = Skill),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st, body))]
pub async fn create(
    State(st): State<AppState>,
    Json(body): Json<CreateSkillBody>,
) -> Result<(StatusCode, Json<Skill>)> {
    let skill = SkillRepository::new(st.pool.inner())
        .upsert(
            body.tenant_id,
            &body.slug,
            &body.name,
            body.category,
            body.description.as_deref(),
        )
        .await
        .map_err(|e| Error::Database(format!("upsert skill: {e}")))?;
    Ok((StatusCode::CREATED, Json(skill)))
}

// ─── Handlers (person-skills) ──────────────────────────────────────

/// GET /api/v1/org/persons/:id/skills — list skills of a person.
#[utoipa::path(
    get,
    path = "/api/v1/org/persons/{id}/skills",
    tag = "Org",
    params(("id" = Uuid, Path, description = "Person UUID")),
    responses(
        (status = 200, description = "Skills tagged on the person", body = Vec<PersonSkillWithName>),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn list_person_skills(
    State(st): State<AppState>,
    Path(person_id): Path<Uuid>,
) -> Result<Json<Vec<PersonSkillWithName>>> {
    let rows = SkillRepository::new(st.pool.inner())
        .list_by_person(person_id)
        .await
        .map_err(|e| Error::Database(format!("list person skills: {e}")))?;
    Ok(Json(rows))
}

/// POST /api/v1/org/persons/:id/skills — upsert (skill, level).
#[utoipa::path(
    post,
    path = "/api/v1/org/persons/{id}/skills",
    tag = "Org",
    params(("id" = Uuid, Path, description = "Person UUID")),
    request_body = TagSkillBody,
    responses(
        (status = 201, description = "Tag set", body = PersonSkill),
        (status = 400, description = "Invalid level (must be 1..=5)"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st, body))]
pub async fn tag_skill(
    State(st): State<AppState>,
    Path(person_id): Path<Uuid>,
    Json(body): Json<TagSkillBody>,
) -> Result<(StatusCode, Json<PersonSkill>)> {
    if !(1..=5).contains(&body.level) {
        return Err(Error::BadRequest(format!(
            "level must be 1..=5, got {}",
            body.level
        )));
    }
    let row = SkillRepository::new(st.pool.inner())
        .tag(person_id, body.skill_id, body.level)
        .await
        .map_err(|e| Error::Database(format!("tag skill: {e}")))?;
    Ok((StatusCode::CREATED, Json(row)))
}

/// DELETE /api/v1/org/persons/:id/skills/:skill_id — untag.
#[utoipa::path(
    delete,
    path = "/api/v1/org/persons/{id}/skills/{skill_id}",
    tag = "Org",
    params(
        ("id" = Uuid, Path, description = "Person UUID"),
        ("skill_id" = Uuid, Path, description = "Skill UUID"),
    ),
    responses(
        (status = 204, description = "Skill untagged"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn untag_skill(
    State(st): State<AppState>,
    Path((person_id, skill_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode> {
    SkillRepository::new(st.pool.inner())
        .untag(person_id, skill_id)
        .await
        .map_err(|e| Error::Database(format!("untag skill: {e}")))?;
    Ok(StatusCode::NO_CONTENT)
}

/// POST /api/v1/org/persons/:id/skills/:skill_id/endorse — endorsement.
#[utoipa::path(
    post,
    path = "/api/v1/org/persons/{id}/skills/{skill_id}/endorse",
    tag = "Org",
    params(
        ("id" = Uuid, Path, description = "Person UUID"),
        ("skill_id" = Uuid, Path, description = "Skill UUID"),
    ),
    request_body = EndorserBody,
    responses(
        (status = 200, description = "Endorsement recorded", body = EndorseResponse),
        (status = 404, description = "Person-skill tuple not found"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st, body))]
pub async fn endorse_skill(
    State(st): State<AppState>,
    Path((person_id, skill_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<EndorserBody>,
) -> Result<Json<EndorseResponse>> {
    let row = SkillRepository::new(st.pool.inner())
        .endorse(person_id, skill_id, body.endorser_person_id)
        .await
        .map_err(|e| Error::Database(format!("endorse: {e}")))?
        .ok_or_else(|| Error::NotFound(format!("person_skill {person_id}/{skill_id}")))?;
    Ok(Json(EndorseResponse { person_skill: row }))
}

/// Body for endorsement.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct EndorserBody {
    /// Personne qui endorse (probablement le caller).
    pub endorser_person_id: Uuid,
}
