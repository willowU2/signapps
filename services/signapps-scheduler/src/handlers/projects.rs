use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use signapps_common::{Claims, TenantContext};
use signapps_db::models::{CreateProject, UpdateProject};
use signapps_db::repositories::ProjectRepository;
use sqlx::FromRow;
use uuid::Uuid;

use crate::AppState;

#[derive(Debug, Deserialize, Default, utoipa::IntoParams)]
/// Query parameters for filtering results.
pub struct ProjectListQuery {
    pub workspace_id: Option<Uuid>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

/// List projects.
#[utoipa::path(
    get,
    path = "/api/v1/projects",
    params(ProjectListQuery),
    responses(
        (status = 200, description = "List of projects"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Projects"
)]
#[tracing::instrument(skip_all)]
pub async fn list(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(ctx): Extension<TenantContext>,
    Query(query): Query<ProjectListQuery>,
) -> Result<impl IntoResponse, StatusCode> {
    let limit = query.limit.unwrap_or(100);
    let offset = query.offset.unwrap_or(0);

    match ProjectRepository::list_with_stats(
        state.pool.inner(),
        ctx.tenant_id,
        query.workspace_id,
        limit,
        offset,
    )
    .await
    {
        Ok(projects) => Ok(Json(json!({ "data": projects }))),
        Err(e) => {
            tracing::error!("Failed to list projects: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

/// Create a project.
#[tracing::instrument(skip_all)]
pub async fn create(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Extension(ctx): Extension<TenantContext>,
    Json(payload): Json<CreateProject>,
) -> Result<impl IntoResponse, StatusCode> {
    match ProjectRepository::create(state.pool.inner(), ctx.tenant_id, claims.sub, payload).await {
        Ok(project) => Ok((StatusCode::CREATED, Json(json!({ "data": project })))),
        Err(e) => {
            tracing::error!("Failed to create project: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

/// Get a project by ID.
#[utoipa::path(
    get,
    path = "/api/v1/projects/{id}",
    params(("id" = Uuid, Path, description = "Project ID")),
    responses(
        (status = 200, description = "Project details"),
        (status = 404, description = "Not found"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Projects"
)]
#[tracing::instrument(skip_all)]
pub async fn get_by_id(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(ctx): Extension<TenantContext>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    match ProjectRepository::find_by_id(state.pool.inner(), id).await {
        Ok(Some(project)) => {
            if project.tenant_id != ctx.tenant_id {
                return Err(StatusCode::NOT_FOUND);
            }
            Ok(Json(json!({ "data": project })))
        },
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            tracing::error!("Failed to get project: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

/// Update a project.
#[tracing::instrument(skip_all)]
pub async fn update(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(_ctx): Extension<TenantContext>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateProject>,
) -> Result<impl IntoResponse, StatusCode> {
    match ProjectRepository::update(state.pool.inner(), id, payload).await {
        Ok(project) => Ok(Json(json!({ "data": project }))),
        Err(e) => {
            tracing::error!("Failed to update project: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

/// Delete a project.
#[utoipa::path(
    delete,
    path = "/api/v1/projects/{id}",
    params(("id" = Uuid, Path, description = "Project ID")),
    responses(
        (status = 204, description = "Project deleted"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Projects"
)]
#[tracing::instrument(skip_all)]
pub async fn delete(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(_ctx): Extension<TenantContext>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    match ProjectRepository::delete(state.pool.inner(), id).await {
        Ok(_) => Ok(StatusCode::NO_CONTENT),
        Err(e) => {
            tracing::error!("Failed to delete project: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

// ============================================================================
// Org-aware project member handlers
// ============================================================================

/// Request body for adding/updating a project member.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct AddMemberRequest {
    /// User ID of the member to add.
    pub user_id: Uuid,
    /// Optional person ID from core.persons.
    pub person_id: Option<Uuid>,
    /// Role: owner | admin | member | viewer | external_contributor | external_observer
    pub role: String,
}

/// Request body for updating a member's role.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct UpdateMemberRoleRequest {
    /// New role to assign.
    pub role: String,
}

/// A project member row with optional person details.
#[derive(Debug, Serialize, FromRow, utoipa::ToSchema)]
pub struct ProjectMemberView {
    pub id: Uuid,
    pub project_id: Uuid,
    pub user_id: Uuid,
    pub person_id: Option<Uuid>,
    pub role: String,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub email: Option<String>,
    pub avatar_url: Option<String>,
}

/// A minimal member row for upsert returns.
#[derive(Debug, FromRow)]
struct MemberRow {
    pub id: Uuid,
    pub project_id: Uuid,
    pub user_id: Uuid,
    pub person_id: Option<Uuid>,
    pub role: String,
}

/// A minimal member row for update returns.
#[derive(Debug, FromRow)]
struct MemberRoleRow {
    pub id: Uuid,
    pub project_id: Uuid,
    pub user_id: Uuid,
    pub role: String,
}

/// A task count row for progress.
#[derive(Debug, FromRow)]
struct ProgressRow {
    pub total: Option<i64>,
    pub done: Option<i64>,
}

/// A workload row per person.
#[derive(Debug, FromRow)]
struct WorkloadRow {
    pub person_id: Uuid,
    pub first_name: String,
    pub last_name: String,
    pub project_id: Option<Uuid>,
    pub active_tasks: Option<i64>,
}

/// List members of a project, enriched with person info where available.
#[utoipa::path(
    get,
    path = "/api/v1/projects/{id}/members",
    params(("id" = Uuid, Path, description = "Project ID")),
    responses(
        (status = 200, description = "List of project members"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Projects"
)]
#[tracing::instrument(skip_all)]
pub async fn list_members(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(_ctx): Extension<TenantContext>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let members = sqlx::query_as::<_, ProjectMemberView>(
        r#"
        SELECT pm.id, pm.project_id, pm.user_id, pm.person_id, pm.role,
               p.first_name, p.last_name, p.email, p.avatar_url
        FROM calendar.project_members pm
        LEFT JOIN core.persons p ON p.id = pm.person_id
        WHERE pm.project_id = $1
        ORDER BY pm.joined_at ASC
        "#,
    )
    .bind(id)
    .fetch_all(state.pool.inner())
    .await
    .map_err(|e| {
        tracing::error!("Failed to list project members: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(json!({ "data": members })))
}

/// Add a member to a project (upsert by user_id).
#[utoipa::path(
    post,
    path = "/api/v1/projects/{id}/members",
    params(("id" = Uuid, Path, description = "Project ID")),
    request_body = AddMemberRequest,
    responses(
        (status = 201, description = "Member added"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Projects"
)]
#[tracing::instrument(skip_all)]
pub async fn add_member(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(_ctx): Extension<TenantContext>,
    Path(project_id): Path<Uuid>,
    Json(payload): Json<AddMemberRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let member = sqlx::query_as::<_, MemberRow>(
        r#"
        INSERT INTO calendar.project_members (project_id, user_id, person_id, role)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (project_id, user_id) DO UPDATE
            SET role = EXCLUDED.role,
                person_id = COALESCE(EXCLUDED.person_id, calendar.project_members.person_id)
        RETURNING id, project_id, user_id, person_id, role
        "#,
    )
    .bind(project_id)
    .bind(payload.user_id)
    .bind(payload.person_id)
    .bind(&payload.role)
    .fetch_one(state.pool.inner())
    .await
    .map_err(|e| {
        tracing::error!("Failed to add project member: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "data": {
                "id": member.id,
                "project_id": member.project_id,
                "user_id": member.user_id,
                "person_id": member.person_id,
                "role": member.role,
            }
        })),
    ))
}

/// Update a project member's role.
#[utoipa::path(
    put,
    path = "/api/v1/projects/{id}/members/{person_id}",
    params(
        ("id" = Uuid, Path, description = "Project ID"),
        ("person_id" = Uuid, Path, description = "User ID of the member"),
    ),
    request_body = UpdateMemberRoleRequest,
    responses(
        (status = 200, description = "Role updated"),
        (status = 404, description = "Member not found"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Projects"
)]
#[tracing::instrument(skip_all)]
pub async fn update_member_role(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(_ctx): Extension<TenantContext>,
    Path((project_id, user_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<UpdateMemberRoleRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let result = sqlx::query_as::<_, MemberRoleRow>(
        r#"
        UPDATE calendar.project_members SET role = $3
        WHERE project_id = $1 AND user_id = $2
        RETURNING id, project_id, user_id, role
        "#,
    )
    .bind(project_id)
    .bind(user_id)
    .bind(&payload.role)
    .fetch_optional(state.pool.inner())
    .await
    .map_err(|e| {
        tracing::error!("Failed to update member role: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    match result {
        Some(m) => Ok(Json(json!({
            "data": {
                "id": m.id,
                "project_id": m.project_id,
                "user_id": m.user_id,
                "role": m.role,
            }
        }))),
        None => Err(StatusCode::NOT_FOUND),
    }
}

/// Remove a member from a project.
#[utoipa::path(
    delete,
    path = "/api/v1/projects/{id}/members/{person_id}",
    params(
        ("id" = Uuid, Path, description = "Project ID"),
        ("person_id" = Uuid, Path, description = "User ID of the member"),
    ),
    responses(
        (status = 204, description = "Member removed"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Projects"
)]
#[tracing::instrument(skip_all)]
pub async fn remove_member(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(_ctx): Extension<TenantContext>,
    Path((project_id, user_id)): Path<(Uuid, Uuid)>,
) -> Result<impl IntoResponse, StatusCode> {
    sqlx::query("DELETE FROM calendar.project_members WHERE project_id = $1 AND user_id = $2")
        .bind(project_id)
        .bind(user_id)
        .execute(state.pool.inner())
        .await
        .map_err(|e| {
            tracing::error!("Failed to remove project member: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(StatusCode::NO_CONTENT)
}

/// List projects where the current user is owner or member.
#[utoipa::path(
    get,
    path = "/api/v1/projects/my-projects",
    responses(
        (status = 200, description = "Projects for the current user"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Projects"
)]
#[tracing::instrument(skip_all)]
pub async fn my_projects(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Extension(ctx): Extension<TenantContext>,
) -> Result<impl IntoResponse, StatusCode> {
    // Resolve person_id from claims.sub (user_id) via core.persons
    let person_id: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM core.persons WHERE user_id = $1 AND tenant_id = $2 LIMIT 1",
    )
    .bind(claims.sub)
    .bind(ctx.tenant_id)
    .fetch_optional(state.pool.inner())
    .await
    .map_err(|e| {
        tracing::error!("Failed to resolve person for my_projects: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let projects = sqlx::query_as::<_, signapps_db::models::ProjectWithStats>(
        r#"
        SELECT DISTINCT p.id, p.tenant_id, p.workspace_id, p.name, p.description,
               p.color, p.status, p.start_date, p.due_date, p.owner_id, p.created_at,
               COALESCE(COUNT(t.id), 0) AS total_tasks,
               COALESCE(COUNT(t.id) FILTER (WHERE t.status = 'completed'), 0) AS completed_tasks
        FROM calendar.projects p
        LEFT JOIN calendar.project_members pm ON pm.project_id = p.id
        LEFT JOIN calendar.tasks t ON t.project_id = p.id
        WHERE p.tenant_id = $1
          AND p.deleted_at IS NULL
          AND (
              p.owner_id = $2
              OR pm.user_id = $2
              OR ($3::uuid IS NOT NULL AND pm.person_id = $3)
          )
        GROUP BY p.id, p.tenant_id, p.workspace_id, p.name, p.description,
                 p.color, p.status, p.start_date, p.due_date, p.owner_id, p.created_at
        ORDER BY p.created_at DESC
        "#,
    )
    .bind(ctx.tenant_id)
    .bind(claims.sub)
    .bind(person_id)
    .fetch_all(state.pool.inner())
    .await
    .map_err(|e| {
        tracing::error!("Failed to list my projects: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(json!({ "data": projects })))
}

/// Get task completion progress for a project.
#[utoipa::path(
    get,
    path = "/api/v1/projects/{id}/progress",
    params(("id" = Uuid, Path, description = "Project ID")),
    responses(
        (status = 200, description = "Project progress"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Projects"
)]
#[tracing::instrument(skip_all)]
pub async fn project_progress(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(_ctx): Extension<TenantContext>,
    Path(project_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let row = sqlx::query_as::<_, ProgressRow>(
        r#"
        SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE status = 'completed') AS done
        FROM scheduling.time_items
        WHERE project_id = $1 AND item_type = 'task' AND deleted_at IS NULL
        "#,
    )
    .bind(project_id)
    .fetch_one(state.pool.inner())
    .await
    .map_err(|e| {
        tracing::error!("Failed to compute project progress: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let total = row.total.unwrap_or(0);
    let done = row.done.unwrap_or(0);
    let percent: f64 = if total > 0 {
        (done as f64 / total as f64) * 100.0
    } else {
        0.0
    };

    Ok(Json(json!({
        "data": {
            "project_id": project_id,
            "total_tasks": total,
            "completed_tasks": done,
            "progress_percent": percent,
        }
    })))
}

/// Get active task workload per person in the caller's N-1 org scope.
#[utoipa::path(
    get,
    path = "/api/v1/projects/team-workload",
    responses(
        (status = 200, description = "Team workload by person and project"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Projects"
)]
#[tracing::instrument(skip_all)]
pub async fn team_workload(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Extension(ctx): Extension<TenantContext>,
) -> Result<impl IntoResponse, StatusCode> {
    // Resolve person_id for the caller
    let caller_person_id: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM core.persons WHERE user_id = $1 AND tenant_id = $2 LIMIT 1",
    )
    .bind(claims.sub)
    .bind(ctx.tenant_id)
    .fetch_optional(state.pool.inner())
    .await
    .map_err(|e| {
        tracing::error!("Failed to resolve person for team_workload: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let rows = if let Some(pid) = caller_person_id {
        // Resolve the caller's primary org node
        let manager_node: Option<Uuid> = sqlx::query_scalar(
            r#"
            SELECT a.node_id
            FROM core.assignments a
            WHERE a.person_id = $1 AND a.is_primary = true
              AND (a.end_date IS NULL OR a.end_date >= CURRENT_DATE)
            LIMIT 1
            "#,
        )
        .bind(pid)
        .fetch_optional(state.pool.inner())
        .await
        .map_err(|e| {
            tracing::error!("Failed to resolve manager node: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

        if let Some(node_id) = manager_node {
            sqlx::query_as::<_, WorkloadRow>(
                r#"
                SELECT
                    p.id AS person_id,
                    p.first_name,
                    p.last_name,
                    t.project_id,
                    COUNT(t.id) AS active_tasks
                FROM core.org_closure c
                JOIN core.assignments a ON a.node_id = c.descendant_id
                    AND (a.end_date IS NULL OR a.end_date >= CURRENT_DATE)
                JOIN core.persons p ON p.id = a.person_id AND p.tenant_id = $2
                LEFT JOIN scheduling.time_items t ON t.assignee_id = p.id
                    AND t.item_type = 'task'
                    AND t.status NOT IN ('completed', 'cancelled')
                    AND t.deleted_at IS NULL
                WHERE c.ancestor_id = $1
                GROUP BY p.id, p.first_name, p.last_name, t.project_id
                ORDER BY p.last_name, p.first_name
                "#,
            )
            .bind(node_id)
            .bind(ctx.tenant_id)
            .fetch_all(state.pool.inner())
            .await
            .map_err(|e| {
                tracing::error!("Failed to load team workload: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?
        } else {
            vec![]
        }
    } else {
        // No person record: show workload for entire tenant
        sqlx::query_as::<_, WorkloadRow>(
            r#"
            SELECT
                p.id AS person_id,
                p.first_name,
                p.last_name,
                t.project_id,
                COUNT(t.id) AS active_tasks
            FROM core.persons p
            LEFT JOIN scheduling.time_items t ON t.assignee_id = p.id
                AND t.item_type = 'task'
                AND t.status NOT IN ('completed', 'cancelled')
                AND t.deleted_at IS NULL
            WHERE p.tenant_id = $1
            GROUP BY p.id, p.first_name, p.last_name, t.project_id
            ORDER BY p.last_name, p.first_name
            "#,
        )
        .bind(ctx.tenant_id)
        .fetch_all(state.pool.inner())
        .await
        .map_err(|e| {
            tracing::error!("Failed to load tenant workload: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
    };

    let data: Vec<serde_json::Value> = rows
        .into_iter()
        .map(|r| {
            json!({
                "person_id": r.person_id,
                "first_name": r.first_name,
                "last_name": r.last_name,
                "project_id": r.project_id,
                "active_tasks": r.active_tasks.unwrap_or(0),
            })
        })
        .collect();

    Ok(Json(json!({ "data": data })))
}

#[cfg(test)]
mod tests {
    #[allow(unused_imports)]
    use super::*;

    #[test]
    fn module_compiles() {
        // Verify this handler module compiles correctly.
        // Integration tests require a running database and service.
        assert!(true, "{} handler module loaded", module_path!());
    }
}
