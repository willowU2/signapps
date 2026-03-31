// GR1-GR4: Device groups, members, tags, tag assignments
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_db::DatabasePool;
use uuid::Uuid;

fn internal_err(e: impl std::fmt::Display) -> (StatusCode, String) {
    (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
}

// ─── Types ───────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DeviceGroup {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub parent_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateGroupReq {
    pub name: String,
    pub description: Option<String>,
    pub parent_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateGroupReq {
    pub name: Option<String>,
    pub description: Option<String>,
    pub parent_id: Option<Uuid>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DeviceTag {
    pub id: Uuid,
    pub name: String,
    pub color: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateTagReq {
    pub name: String,
    pub color: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct MembershipReq {
    pub hardware_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct TagAssignReq {
    pub hardware_id: Uuid,
}

// ─── GR1: Group CRUD ─────────────────────────────────────────────────────────

#[tracing::instrument(skip_all)]
pub async fn list_groups(
    State(pool): State<DatabasePool>,
) -> Result<Json<Vec<DeviceGroup>>, (StatusCode, String)> {
    let rows = sqlx::query_as::<_, DeviceGroup>(
        "SELECT id, name, description, parent_id, created_at FROM it.device_groups ORDER BY name",
    )
    .fetch_all(pool.inner())
    .await
    .map_err(internal_err)?;
    Ok(Json(rows))
}

#[tracing::instrument(skip_all)]
pub async fn create_group(
    State(pool): State<DatabasePool>,
    Json(payload): Json<CreateGroupReq>,
) -> Result<(StatusCode, Json<DeviceGroup>), (StatusCode, String)> {
    let row = sqlx::query_as::<_, DeviceGroup>(
        r#"
        INSERT INTO it.device_groups (name, description, parent_id)
        VALUES ($1, $2, $3)
        RETURNING id, name, description, parent_id, created_at
        "#,
    )
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(payload.parent_id)
    .fetch_one(pool.inner())
    .await
    .map_err(internal_err)?;
    Ok((StatusCode::CREATED, Json(row)))
}

#[tracing::instrument(skip_all)]
pub async fn get_group(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
) -> Result<Json<DeviceGroup>, (StatusCode, String)> {
    let row = sqlx::query_as::<_, DeviceGroup>(
        "SELECT id, name, description, parent_id, created_at FROM it.device_groups WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(pool.inner())
    .await
    .map_err(internal_err)?
    .ok_or((StatusCode::NOT_FOUND, "Group not found".to_string()))?;
    Ok(Json(row))
}

#[tracing::instrument(skip_all)]
pub async fn update_group(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateGroupReq>,
) -> Result<Json<DeviceGroup>, (StatusCode, String)> {
    let row = sqlx::query_as::<_, DeviceGroup>(
        r#"
        UPDATE it.device_groups
        SET name        = COALESCE($2, name),
            description = COALESCE($3, description),
            parent_id   = COALESCE($4, parent_id)
        WHERE id = $1
        RETURNING id, name, description, parent_id, created_at
        "#,
    )
    .bind(id)
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(payload.parent_id)
    .fetch_optional(pool.inner())
    .await
    .map_err(internal_err)?
    .ok_or((StatusCode::NOT_FOUND, "Group not found".to_string()))?;
    Ok(Json(row))
}

#[tracing::instrument(skip_all)]
pub async fn delete_group(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    let result = sqlx::query("DELETE FROM it.device_groups WHERE id = $1")
        .bind(id)
        .execute(pool.inner())
        .await
        .map_err(internal_err)?;
    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Group not found".to_string()));
    }
    Ok(StatusCode::NO_CONTENT)
}

// ─── GR2: Group membership ───────────────────────────────────────────────────

#[tracing::instrument(skip_all)]
pub async fn add_member(
    State(pool): State<DatabasePool>,
    Path(group_id): Path<Uuid>,
    Json(payload): Json<MembershipReq>,
) -> Result<StatusCode, (StatusCode, String)> {
    sqlx::query(
        "INSERT INTO it.device_group_members (group_id, hardware_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    )
    .bind(group_id)
    .bind(payload.hardware_id)
    .execute(pool.inner())
    .await
    .map_err(internal_err)?;
    Ok(StatusCode::NO_CONTENT)
}

#[tracing::instrument(skip_all)]
pub async fn remove_member(
    State(pool): State<DatabasePool>,
    Path((group_id, hardware_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, (StatusCode, String)> {
    sqlx::query("DELETE FROM it.device_group_members WHERE group_id = $1 AND hardware_id = $2")
        .bind(group_id)
        .bind(hardware_id)
        .execute(pool.inner())
        .await
        .map_err(internal_err)?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct GroupMember {
    pub hardware_id: Uuid,
    pub name: String,
}

#[tracing::instrument(skip_all)]
pub async fn list_members(
    State(pool): State<DatabasePool>,
    Path(group_id): Path<Uuid>,
) -> Result<Json<Vec<GroupMember>>, (StatusCode, String)> {
    let rows = sqlx::query_as::<_, GroupMember>(
        r#"
        SELECT h.id as hardware_id, h.name
        FROM it.device_group_members m
        JOIN it.hardware h ON h.id = m.hardware_id
        WHERE m.group_id = $1
        ORDER BY h.name
        "#,
    )
    .bind(group_id)
    .fetch_all(pool.inner())
    .await
    .map_err(internal_err)?;
    Ok(Json(rows))
}

// ─── GR3: Tag CRUD ───────────────────────────────────────────────────────────

#[tracing::instrument(skip_all)]
pub async fn list_tags(
    State(pool): State<DatabasePool>,
) -> Result<Json<Vec<DeviceTag>>, (StatusCode, String)> {
    let rows =
        sqlx::query_as::<_, DeviceTag>("SELECT id, name, color FROM it.device_tags ORDER BY name")
            .fetch_all(pool.inner())
            .await
            .map_err(internal_err)?;
    Ok(Json(rows))
}

#[tracing::instrument(skip_all)]
pub async fn create_tag(
    State(pool): State<DatabasePool>,
    Json(payload): Json<CreateTagReq>,
) -> Result<(StatusCode, Json<DeviceTag>), (StatusCode, String)> {
    let row = sqlx::query_as::<_, DeviceTag>(
        r#"
        INSERT INTO it.device_tags (name, color)
        VALUES ($1, $2)
        RETURNING id, name, color
        "#,
    )
    .bind(&payload.name)
    .bind(payload.color.as_deref().unwrap_or("#3b82f6"))
    .fetch_one(pool.inner())
    .await
    .map_err(internal_err)?;
    Ok((StatusCode::CREATED, Json(row)))
}

#[tracing::instrument(skip_all)]
pub async fn delete_tag(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    let result = sqlx::query("DELETE FROM it.device_tags WHERE id = $1")
        .bind(id)
        .execute(pool.inner())
        .await
        .map_err(internal_err)?;
    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Tag not found".to_string()));
    }
    Ok(StatusCode::NO_CONTENT)
}

// ─── GR4: Tag assignments ────────────────────────────────────────────────────

#[tracing::instrument(skip_all)]
pub async fn assign_tag(
    State(pool): State<DatabasePool>,
    Path(tag_id): Path<Uuid>,
    Json(payload): Json<TagAssignReq>,
) -> Result<StatusCode, (StatusCode, String)> {
    sqlx::query(
        "INSERT INTO it.device_tag_assignments (tag_id, hardware_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    )
    .bind(tag_id)
    .bind(payload.hardware_id)
    .execute(pool.inner())
    .await
    .map_err(internal_err)?;
    Ok(StatusCode::NO_CONTENT)
}

#[tracing::instrument(skip_all)]
pub async fn unassign_tag(
    State(pool): State<DatabasePool>,
    Path((tag_id, hardware_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, (StatusCode, String)> {
    sqlx::query("DELETE FROM it.device_tag_assignments WHERE tag_id = $1 AND hardware_id = $2")
        .bind(tag_id)
        .bind(hardware_id)
        .execute(pool.inner())
        .await
        .map_err(internal_err)?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct HardwareTag {
    pub tag_id: Uuid,
    pub name: String,
    pub color: String,
}

#[tracing::instrument(skip_all)]
pub async fn list_hardware_tags(
    State(pool): State<DatabasePool>,
    Path(hardware_id): Path<Uuid>,
) -> Result<Json<Vec<HardwareTag>>, (StatusCode, String)> {
    let rows = sqlx::query_as::<_, HardwareTag>(
        r#"
        SELECT t.id as tag_id, t.name, t.color
        FROM it.device_tag_assignments a
        JOIN it.device_tags t ON t.id = a.tag_id
        WHERE a.hardware_id = $1
        ORDER BY t.name
        "#,
    )
    .bind(hardware_id)
    .fetch_all(pool.inner())
    .await
    .map_err(internal_err)?;
    Ok(Json(rows))
}

#[cfg(test)]
mod tests {
    #[test]
    fn module_compiles() {
        assert!(true, "{} handler module loaded", module_path!());
    }
}
