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

#[derive(Serialize)]
pub struct GroupResponse {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub parent_id: Option<Uuid>,
    pub member_count: i32,
}

#[derive(Deserialize)]
pub struct ListQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Deserialize)]
pub struct AddMemberRequest {
    pub user_id: Uuid,
    pub role: Option<String>,
}


/// List all groups.
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
pub async fn delete(State(state): State<AppState>, Path(id): Path<Uuid>) -> Result<StatusCode> {
    let repo = GroupRepository::new(&state.pool);
    repo.delete(id).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Add member to group.
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
pub async fn remove_member(
    State(state): State<AppState>,
    Path((group_id, user_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode> {
    let repo = GroupRepository::new(&state.pool);
    repo.remove_member(group_id, user_id).await?;
    Ok(StatusCode::NO_CONTENT)
}
