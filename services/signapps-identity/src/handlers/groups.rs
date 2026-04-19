//! Group management handlers (RBAC).

use crate::AppState;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use signapps_common::{Error, Result};
use signapps_db::repositories::GroupRepository;
use uuid::Uuid;

#[derive(Serialize, utoipa::ToSchema)]
/// Response for Group.
pub struct GroupResponse {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub parent_id: Option<Uuid>,
    pub member_count: i32,
}

#[derive(Serialize, utoipa::ToSchema)]
/// Response for GroupMember.
pub struct GroupMemberResponse {
    pub user_id: Uuid,
    pub username: String,
    pub email: Option<String>,
    pub full_name: Option<String>,
    pub role: String,
    pub added_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Deserialize)]
/// Query parameters for filtering results.
pub struct ListQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Deserialize, utoipa::ToSchema)]
/// Request body for AddMember.
pub struct AddMemberRequest {
    pub user_id: Uuid,
    pub role: Option<String>,
}

/// List all groups.
#[utoipa::path(
    get,
    path = "/api/v1/groups",
    tag = "groups",
    security(("bearerAuth" = [])),
    params(
        ("limit" = Option<i64>, Query, description = "Maximum results (default 50)"),
        ("offset" = Option<i64>, Query, description = "Pagination offset"),
    ),
    responses(
        (status = 200, description = "Group list", body = Vec<GroupResponse>),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn list(
    State(state): State<AppState>,
    axum::extract::Query(query): axum::extract::Query<ListQuery>,
) -> Result<Json<Vec<GroupResponse>>> {
    let repo = GroupRepository::new(&state.pool);
    let limit = query.limit.unwrap_or(50);
    let offset = query.offset.unwrap_or(0);
    let groups = repo.list(limit, offset).await?;

    let group_ids: Vec<Uuid> = groups.iter().map(|g| g.id).collect();
    let counts = repo.count_members_batch(&group_ids).await?;

    let response: Vec<GroupResponse> = groups
        .into_iter()
        .map(|g| {
            let count = counts.get(&g.id).copied().unwrap_or(0);
            GroupResponse {
                id: g.id,
                name: g.name,
                description: g.description,
                parent_id: g.parent_id,
                member_count: count,
            }
        })
        .collect();

    Ok(Json(response))
}

/// Get group by ID.
#[utoipa::path(
    get,
    path = "/api/v1/groups/{id}",
    tag = "groups",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Group UUID")),
    responses(
        (status = 200, description = "Group found", body = GroupResponse),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Group not found"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn get(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<GroupResponse>> {
    let repo = GroupRepository::new(&state.pool);
    let group = repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Group {}", id)))?;

    let member_count = repo.count_members(id).await?;

    Ok(Json(GroupResponse {
        id: group.id,
        name: group.name,
        description: group.description,
        parent_id: group.parent_id,
        member_count,
    }))
}

/// Create new group.
#[utoipa::path(
    post,
    path = "/api/v1/groups",
    tag = "groups",
    security(("bearerAuth" = [])),
    request_body = signapps_db::models::CreateGroup,
    responses(
        (status = 200, description = "Group created", body = GroupResponse),
        (status = 400, description = "Validation error"),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn create(
    State(state): State<AppState>,
    Json(payload): Json<signapps_db::models::CreateGroup>,
) -> Result<Json<GroupResponse>> {
    let repo = GroupRepository::new(&state.pool);
    let group = repo.create(payload).await?;

    Ok(Json(GroupResponse {
        id: group.id,
        name: group.name,
        description: group.description,
        parent_id: group.parent_id,
        member_count: 0, // Newly created group has no members
    }))
}

/// Update group.
#[utoipa::path(
    put,
    path = "/api/v1/groups/{id}",
    tag = "groups",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Group UUID")),
    request_body = signapps_db::models::CreateGroup,
    responses(
        (status = 200, description = "Group updated", body = GroupResponse),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Group not found"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn update(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<signapps_db::models::CreateGroup>,
) -> Result<Json<GroupResponse>> {
    let repo = GroupRepository::new(&state.pool);

    // Verify group exists
    repo.find_by_id(id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Group {}", id)))?;

    let group = repo.update(id, payload).await?;
    let member_count = repo.count_members(id).await?;

    Ok(Json(GroupResponse {
        id: group.id,
        name: group.name,
        description: group.description,
        parent_id: group.parent_id,
        member_count,
    }))
}

/// Delete group.
#[utoipa::path(
    delete,
    path = "/api/v1/groups/{id}",
    tag = "groups",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Group UUID")),
    responses(
        (status = 204, description = "Group deleted"),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Group not found"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn delete(State(state): State<AppState>, Path(id): Path<Uuid>) -> Result<StatusCode> {
    let repo = GroupRepository::new(&state.pool);
    repo.delete(id).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Add member to group.
#[utoipa::path(
    post,
    path = "/api/v1/groups/{id}/members",
    tag = "groups",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Group UUID")),
    request_body = AddMemberRequest,
    responses(
        (status = 201, description = "Member added"),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Group not found"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn add_member(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<AddMemberRequest>,
) -> Result<StatusCode> {
    let repo = GroupRepository::new(&state.pool);
    repo.add_member(
        id,
        payload.user_id,
        &payload.role.unwrap_or_else(|| "member".to_string()),
    )
    .await?;
    Ok(StatusCode::CREATED)
}

/// Remove member from group.
#[utoipa::path(
    delete,
    path = "/api/v1/groups/{id}/members/{uid}",
    tag = "groups",
    security(("bearerAuth" = [])),
    params(
        ("id" = Uuid, Path, description = "Group UUID"),
        ("uid" = Uuid, Path, description = "User UUID"),
    ),
    responses(
        (status = 204, description = "Member removed"),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Group or member not found"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn remove_member(
    State(state): State<AppState>,
    Path((group_id, user_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode> {
    let repo = GroupRepository::new(&state.pool);
    repo.remove_member(group_id, user_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// List group members with user details.
#[utoipa::path(
    get,
    path = "/api/v1/groups/{id}/members",
    tag = "groups",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Group UUID")),
    responses(
        (status = 200, description = "Member list", body = Vec<GroupMemberResponse>),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Group not found"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn list_members(
    State(state): State<AppState>,
    Path(group_id): Path<Uuid>,
) -> Result<Json<Vec<GroupMemberResponse>>> {
    let repo = GroupRepository::new(&state.pool);

    // Verify group exists
    repo.find_by_id(group_id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Group {}", group_id)))?;

    let members = repo.list_members_with_users(group_id).await?;

    let response: Vec<GroupMemberResponse> = members
        .into_iter()
        .map(|m| GroupMemberResponse {
            user_id: m.user_id,
            username: m.username,
            email: m.email,
            full_name: m.full_name,
            role: m.role,
            added_at: m.added_at,
        })
        .collect();

    Ok(Json(response))
}

#[cfg(test)]
mod tests {
    #[allow(unused_imports)]
    use super::*;

    #[test]
    fn module_compiles() {
        // Verify this handler module compiles correctly.
        // Integration tests require a running database and service.
        // Placeholder: ensures the module compiles.
        let _ = module_path!();
    }
}
