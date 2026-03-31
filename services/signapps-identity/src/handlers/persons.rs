//! Person (Party Model) handlers.

use crate::AppState;
use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use signapps_common::{Claims, Error, Result};
use signapps_db::models::core_org::{
    Assignment, AssignmentHistory, CreatePerson, EffectivePermissions, Person, PersonRole,
    UpdatePerson,
};
use signapps_db::repositories::{
    AssignmentRepository, PermissionProfileRepository, PersonRepository,
};
use uuid::Uuid;

// ============================================================================
// Request / response DTOs
// ============================================================================

/// Query parameters for listing persons.
#[derive(Debug, Deserialize)]
pub struct ListPersonsQuery {
    pub role: Option<String>,
    pub node_id: Option<Uuid>,
    pub site_id: Option<Uuid>,
    pub active: Option<bool>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

/// Request body for creating a person.
#[derive(Debug, Deserialize)]
pub struct CreatePersonRequest {
    pub first_name: String,
    pub last_name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub avatar_url: Option<String>,
    pub user_id: Option<Uuid>,
    pub metadata: Option<serde_json::Value>,
}

/// Request body for updating a person.
#[derive(Debug, Deserialize)]
pub struct UpdatePersonRequest {
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub avatar_url: Option<String>,
    pub is_active: Option<bool>,
    pub metadata: Option<serde_json::Value>,
}

/// Request body for linking a user account to a person.
#[derive(Debug, Deserialize)]
pub struct LinkUserRequest {
    pub user_id: Uuid,
}

/// Person detail response including roles and active assignments.
#[derive(Debug, Serialize)]
pub struct PersonDetailResponse {
    #[serde(flatten)]
    pub person: Person,
    pub roles: Vec<PersonRole>,
    pub active_assignments: Vec<Assignment>,
}

// ============================================================================
// Handlers
// ============================================================================

/// GET /api/v1/persons — List persons for the authenticated user's tenant.
///
/// Supports optional filters: role, node_id, site_id, active.
#[tracing::instrument(skip_all)]
pub async fn list_persons(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<ListPersonsQuery>,
) -> Result<Json<Vec<Person>>> {
    let tenant_id = claims
        .tenant_id
        .ok_or_else(|| Error::Forbidden("No tenant context".into()))?;
    let limit = query.limit.unwrap_or(50);
    let offset = query.offset.unwrap_or(0);

    let mut persons = PersonRepository::list(&state.pool, tenant_id, limit, offset).await?;

    // Filter by node_id: keep only persons with an active assignment to this node
    if let Some(node_id) = query.node_id {
        let node_assignments = AssignmentRepository::list_by_node(&state.pool, node_id).await?;
        let person_ids: std::collections::HashSet<Uuid> =
            node_assignments.iter().map(|a| a.person_id).collect();
        persons.retain(|p| person_ids.contains(&p.id));
    }

    // Filter by role
    if let Some(role_filter) = &query.role {
        let mut filtered = Vec::new();
        for p in persons {
            let roles = PersonRepository::list_roles(&state.pool, p.id).await?;
            if roles.iter().any(|r| &r.role_type == role_filter) {
                filtered.push(p);
            }
        }
        persons = filtered;
    }

    Ok(Json(persons))
}

/// POST /api/v1/persons — Create a new person for the authenticated user's tenant.
#[tracing::instrument(skip_all)]
pub async fn create_person(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreatePersonRequest>,
) -> Result<(StatusCode, Json<Person>)> {
    let tenant_id = claims
        .tenant_id
        .ok_or_else(|| Error::Forbidden("No tenant context".into()))?;
    let input = CreatePerson {
        tenant_id,
        first_name: payload.first_name,
        last_name: payload.last_name,
        email: payload.email,
        phone: payload.phone,
        avatar_url: payload.avatar_url,
        user_id: payload.user_id,
        metadata: payload.metadata,
    };
    let person = PersonRepository::create(&state.pool, input).await?;
    Ok((StatusCode::CREATED, Json(person)))
}

/// GET /api/v1/persons/:id — Retrieve a person with their roles and active assignments.
#[tracing::instrument(skip_all)]
pub async fn get_person(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<PersonDetailResponse>> {
    let person = PersonRepository::find_by_id(&state.pool, id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Person {id} not found")))?;
    let roles = PersonRepository::list_roles(&state.pool, id).await?;
    let all_assignments = AssignmentRepository::list_by_person(&state.pool, id).await?;
    let today = chrono::Utc::now().date_naive();
    let active_assignments = all_assignments
        .into_iter()
        .filter(|a| {
            a.start_date <= today && a.end_date.map_or(true, |end| end >= today)
        })
        .collect();
    Ok(Json(PersonDetailResponse {
        person,
        roles,
        active_assignments,
    }))
}

/// PUT /api/v1/persons/:id — Update a person record.
#[tracing::instrument(skip_all)]
pub async fn update_person(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdatePersonRequest>,
) -> Result<Json<Person>> {
    let input = UpdatePerson {
        first_name: payload.first_name,
        last_name: payload.last_name,
        email: payload.email,
        phone: payload.phone,
        avatar_url: payload.avatar_url,
        is_active: payload.is_active,
        metadata: payload.metadata,
    };
    let person = PersonRepository::update(&state.pool, id, input).await?;
    Ok(Json(person))
}

/// GET /api/v1/persons/:id/assignments — List all assignments (including historical) for a person.
#[tracing::instrument(skip_all)]
pub async fn get_person_assignments(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<Assignment>>> {
    let assignments = AssignmentRepository::list_by_person(&state.pool, id).await?;
    Ok(Json(assignments))
}

/// GET /api/v1/persons/:id/history — List assignment history entries for all of a person's assignments.
#[tracing::instrument(skip_all)]
pub async fn get_person_history(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<AssignmentHistory>>> {
    let assignments = AssignmentRepository::list_by_person(&state.pool, id).await?;
    let mut all_history = Vec::new();
    for assignment in &assignments {
        let history = AssignmentRepository::get_history(&state.pool, assignment.id).await?;
        all_history.extend(history);
    }
    // Sort newest first
    all_history.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(Json(all_history))
}

/// POST /api/v1/persons/:id/link-user — Link a platform user account to this person.
#[tracing::instrument(skip_all)]
pub async fn link_user(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<LinkUserRequest>,
) -> Result<Json<Person>> {
    let person = PersonRepository::link_user(&state.pool, id, payload.user_id).await?;
    Ok(Json(person))
}

/// POST /api/v1/persons/:id/unlink-user — Remove the platform user link from this person.
#[tracing::instrument(skip_all)]
pub async fn unlink_user(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Person>> {
    let person = PersonRepository::unlink_user(&state.pool, id).await?;
    Ok(Json(person))
}

/// GET /api/v1/persons/:id/effective-permissions — Compute effective permissions
/// for a person based on their active assignment nodes.
#[tracing::instrument(skip_all)]
pub async fn get_effective_permissions(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<EffectivePermissions>>> {
    let today = chrono::Utc::now().date_naive();
    let assignments = AssignmentRepository::list_by_person(&state.pool, id).await?;
    let active = assignments
        .into_iter()
        .filter(|a| a.start_date <= today && a.end_date.map_or(true, |end| end >= today));

    let mut result = Vec::new();
    for assignment in active {
        let perms =
            PermissionProfileRepository::get_effective(&state.pool, assignment.node_id).await?;
        result.push(perms);
    }
    Ok(Json(result))
}
