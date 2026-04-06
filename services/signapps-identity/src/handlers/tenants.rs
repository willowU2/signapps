//! Tenant management handlers (multi-tenant administration).

use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use signapps_common::{Claims, Error, Result, TenantContext};
use signapps_db::models::{
    AddWorkspaceMember, CreateTenant, CreateWorkspace, UpdateTenant, UpdateWorkspace,
};
use signapps_db::repositories::{TenantRepository, WorkspaceRepository};
use uuid::Uuid;
use validator::Validate;

use crate::AppState;

// ============================================================================
// Tenant Endpoints
// ============================================================================

/// Query parameters for listing tenants.
#[derive(Debug, Deserialize)]
/// Query parameters for filtering results.
pub struct ListTenantsQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

/// Tenant response DTO.
#[derive(Debug, Serialize, utoipa::ToSchema)]
/// Response for Tenant.
pub struct TenantResponse {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub domain: Option<String>,
    pub logo_url: Option<String>,
    pub plan: String,
    pub max_users: i32,
    pub max_resources: i32,
    pub max_workspaces: i32,
    pub is_active: bool,
    pub created_at: String,
}

impl From<signapps_db::models::Tenant> for TenantResponse {
    fn from(t: signapps_db::models::Tenant) -> Self {
        Self {
            id: t.id,
            name: t.name,
            slug: t.slug,
            domain: t.domain,
            logo_url: t.logo_url,
            plan: t.plan,
            max_users: t.max_users,
            max_resources: t.max_resources,
            max_workspaces: t.max_workspaces,
            is_active: t.is_active,
            created_at: t.created_at.to_rfc3339(),
        }
    }
}

/// Create tenant request.
#[derive(Debug, Deserialize, Validate, utoipa::ToSchema)]
/// Request body for CreateTenant.
pub struct CreateTenantRequest {
    #[validate(length(min = 2, max = 255))]
    pub name: String,
    #[validate(length(min = 2, max = 64))]
    pub slug: String,
    #[validate(length(max = 255))]
    pub domain: Option<String>,
    #[validate(url)]
    pub logo_url: Option<String>,
    pub plan: Option<String>,
}

/// Update tenant request.
#[derive(Debug, Deserialize, Validate, utoipa::ToSchema)]
/// Request body for UpdateTenant.
pub struct UpdateTenantRequest {
    #[validate(length(min = 2, max = 255))]
    pub name: Option<String>,
    #[validate(length(max = 255))]
    pub domain: Option<String>,
    #[validate(url)]
    pub logo_url: Option<String>,
    pub plan: Option<String>,
    pub max_users: Option<i32>,
    pub max_resources: Option<i32>,
    pub max_workspaces: Option<i32>,
    pub is_active: Option<bool>,
}

/// GET /api/v1/tenants — List all tenants (super-admin only).
#[utoipa::path(
    get,
    path = "/api/v1/tenants",
    tag = "tenants",
    security(("bearerAuth" = [])),
    params(
        ("limit" = Option<i64>, Query, description = "Maximum results (default 50, max 100)"),
        ("offset" = Option<i64>, Query, description = "Pagination offset"),
    ),
    responses(
        (status = 200, description = "Tenant list", body = Vec<TenantResponse>),
        (status = 401, description = "Not authenticated"),
        (status = 403, description = "Insufficient permissions"),
    )
)]
#[tracing::instrument(skip(state))]
#[tracing::instrument(skip_all)]
pub async fn list_tenants(
    State(state): State<AppState>,
    Query(query): Query<ListTenantsQuery>,
) -> Result<Json<Vec<TenantResponse>>> {
    let limit = query.limit.unwrap_or(50).min(100);
    let offset = query.offset.unwrap_or(0);

    let tenants = TenantRepository::list(&state.pool, limit, offset).await?;
    let response: Vec<TenantResponse> = tenants.into_iter().map(TenantResponse::from).collect();

    Ok(Json(response))
}

/// GET /api/v1/tenants/:id — Get tenant by ID.
#[utoipa::path(
    get,
    path = "/api/v1/tenants/{id}",
    tag = "tenants",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Tenant UUID")),
    responses(
        (status = 200, description = "Tenant detail", body = TenantResponse),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Tenant not found"),
    )
)]
#[tracing::instrument(skip(state))]
#[tracing::instrument(skip_all)]
pub async fn get_tenant(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<TenantResponse>> {
    let tenant = TenantRepository::find_by_id(&state.pool, id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Tenant {}", id)))?;

    Ok(Json(TenantResponse::from(tenant)))
}

/// GET /api/v1/tenant — Get current user's tenant.
#[utoipa::path(
    get,
    path = "/api/v1/tenant",
    tag = "tenants",
    security(("bearerAuth" = [])),
    responses(
        (status = 200, description = "Current tenant", body = TenantResponse),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Tenant not found"),
    )
)]
#[tracing::instrument(skip(state))]
#[tracing::instrument(skip_all)]
pub async fn get_my_tenant(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
) -> Result<Json<TenantResponse>> {
    let tenant = TenantRepository::find_by_id(&state.pool, ctx.tenant_id)
        .await?
        .ok_or_else(|| Error::NotFound("Tenant not found".to_string()))?;

    Ok(Json(TenantResponse::from(tenant)))
}

/// POST /api/v1/tenants — Create a new tenant (super-admin only).
#[utoipa::path(
    post,
    path = "/api/v1/tenants",
    tag = "tenants",
    security(("bearerAuth" = [])),
    request_body = CreateTenantRequest,
    responses(
        (status = 201, description = "Tenant created", body = TenantResponse),
        (status = 400, description = "Validation error"),
        (status = 401, description = "Not authenticated"),
        (status = 409, description = "Slug or domain already exists"),
    )
)]
#[tracing::instrument(skip(state, payload))]
#[tracing::instrument(skip_all)]
pub async fn create_tenant(
    State(state): State<AppState>,
    Json(payload): Json<CreateTenantRequest>,
) -> Result<(StatusCode, Json<TenantResponse>)> {
    payload
        .validate()
        .map_err(|e| Error::Validation(e.to_string()))?;

    // Check slug uniqueness
    if TenantRepository::find_by_slug(&state.pool, &payload.slug)
        .await?
        .is_some()
    {
        return Err(Error::AlreadyExists(
            "Tenant slug already exists".to_string(),
        ));
    }

    // Check domain uniqueness if provided
    if let Some(ref domain) = payload.domain {
        if TenantRepository::find_by_domain(&state.pool, domain)
            .await?
            .is_some()
        {
            return Err(Error::AlreadyExists(
                "Domain already registered".to_string(),
            ));
        }
    }

    let create = CreateTenant {
        name: payload.name,
        slug: payload.slug.to_lowercase(),
        domain: payload.domain,
        logo_url: payload.logo_url,
        plan: payload.plan,
    };

    let tenant = TenantRepository::create(&state.pool, create).await?;
    tracing::info!(tenant_id = %tenant.id, "Created new tenant");

    Ok((StatusCode::CREATED, Json(TenantResponse::from(tenant))))
}

/// PUT /api/v1/tenants/:id — Update a tenant (super-admin or tenant admin).
#[utoipa::path(
    put,
    path = "/api/v1/tenants/{id}",
    tag = "tenants",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Tenant UUID")),
    request_body = UpdateTenantRequest,
    responses(
        (status = 200, description = "Tenant updated", body = TenantResponse),
        (status = 400, description = "Validation error"),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Tenant not found"),
        (status = 409, description = "Domain already registered"),
    )
)]
#[tracing::instrument(skip(state, payload))]
#[tracing::instrument(skip_all)]
pub async fn update_tenant(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateTenantRequest>,
) -> Result<Json<TenantResponse>> {
    payload
        .validate()
        .map_err(|e| Error::Validation(e.to_string()))?;

    // Verify tenant exists
    let _existing = TenantRepository::find_by_id(&state.pool, id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Tenant {}", id)))?;

    // Check domain uniqueness if changing
    if let Some(ref domain) = payload.domain {
        if let Some(other) = TenantRepository::find_by_domain(&state.pool, domain).await? {
            if other.id != id {
                return Err(Error::AlreadyExists(
                    "Domain already registered".to_string(),
                ));
            }
        }
    }

    let update = UpdateTenant {
        name: payload.name,
        domain: payload.domain,
        logo_url: payload.logo_url,
        settings: None,
        plan: payload.plan,
        max_users: payload.max_users,
        max_resources: payload.max_resources,
        max_workspaces: payload.max_workspaces,
        is_active: payload.is_active,
    };

    let tenant = TenantRepository::update(&state.pool, id, update).await?;
    tracing::info!(tenant_id = %id, "Updated tenant");

    Ok(Json(TenantResponse::from(tenant)))
}

/// DELETE /api/v1/tenants/:id — Delete (deactivate) a tenant (super-admin only).
#[utoipa::path(
    delete,
    path = "/api/v1/tenants/{id}",
    tag = "tenants",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Tenant UUID")),
    responses(
        (status = 204, description = "Tenant deactivated"),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Tenant not found"),
    )
)]
#[tracing::instrument(skip(state))]
#[tracing::instrument(skip_all)]
pub async fn delete_tenant(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    // Verify tenant exists
    let _existing = TenantRepository::find_by_id(&state.pool, id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Tenant {}", id)))?;

    TenantRepository::delete(&state.pool, id).await?;
    tracing::info!(tenant_id = %id, "Deactivated tenant");

    Ok(StatusCode::NO_CONTENT)
}

// ============================================================================
// Workspace Endpoints
// ============================================================================

/// Query parameters for listing workspaces.
#[derive(Debug, Deserialize)]
/// Query parameters for filtering results.
pub struct ListWorkspacesQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

/// Workspace response DTO.
#[derive(Debug, Serialize, utoipa::ToSchema)]
/// Response for Workspace.
pub struct WorkspaceResponse {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub color: String,
    pub icon: Option<String>,
    pub is_default: bool,
    pub created_at: String,
}

impl From<signapps_db::models::Workspace> for WorkspaceResponse {
    fn from(w: signapps_db::models::Workspace) -> Self {
        Self {
            id: w.id,
            tenant_id: w.tenant_id,
            name: w.name,
            description: w.description,
            color: w.color,
            icon: w.icon,
            is_default: w.is_default,
            created_at: w.created_at.to_rfc3339(),
        }
    }
}

/// Workspace member response DTO.
#[derive(Debug, Serialize, utoipa::ToSchema)]
/// Response for WorkspaceMember.
pub struct WorkspaceMemberResponse {
    pub id: Uuid,
    pub user_id: Uuid,
    pub username: String,
    pub email: Option<String>,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub role: String,
    pub joined_at: String,
}

impl From<signapps_db::models::WorkspaceMemberWithUser> for WorkspaceMemberResponse {
    fn from(m: signapps_db::models::WorkspaceMemberWithUser) -> Self {
        Self {
            id: m.id,
            user_id: m.user_id,
            username: m.username,
            email: m.email,
            display_name: m.display_name,
            avatar_url: m.avatar_url,
            role: m.role,
            joined_at: m.joined_at.to_rfc3339(),
        }
    }
}

/// Create workspace request.
#[derive(Debug, Deserialize, Validate, utoipa::ToSchema)]
/// Request body for CreateWorkspace.
pub struct CreateWorkspaceRequest {
    #[validate(length(min = 2, max = 255))]
    pub name: String,
    #[validate(length(max = 1000))]
    pub description: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub is_default: Option<bool>,
}

/// Update workspace request.
#[derive(Debug, Deserialize, Validate, utoipa::ToSchema)]
/// Request body for UpdateWorkspace.
pub struct UpdateWorkspaceRequest {
    #[validate(length(min = 2, max = 255))]
    pub name: Option<String>,
    #[validate(length(max = 1000))]
    pub description: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub is_default: Option<bool>,
}

/// Add member request.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request body for AddMember.
pub struct AddMemberRequest {
    pub user_id: Uuid,
    pub role: Option<String>,
}

/// Update member role request.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request body for UpdateMemberRole.
pub struct UpdateMemberRoleRequest {
    pub role: String,
}

/// GET /api/v1/workspaces — List workspaces for current tenant.
#[utoipa::path(
    get,
    path = "/api/v1/workspaces",
    tag = "workspaces",
    security(("bearerAuth" = [])),
    params(
        ("limit" = Option<i64>, Query, description = "Maximum results (default 50, max 100)"),
        ("offset" = Option<i64>, Query, description = "Pagination offset"),
    ),
    responses(
        (status = 200, description = "Workspace list", body = Vec<WorkspaceResponse>),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip(state))]
#[tracing::instrument(skip_all)]
pub async fn list_workspaces(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Query(query): Query<ListWorkspacesQuery>,
) -> Result<Json<Vec<WorkspaceResponse>>> {
    let limit = query.limit.unwrap_or(50).min(100);
    let offset = query.offset.unwrap_or(0);

    let workspaces =
        WorkspaceRepository::list_by_tenant(&state.pool, ctx.tenant_id, limit, offset).await?;
    let response: Vec<WorkspaceResponse> = workspaces
        .into_iter()
        .map(WorkspaceResponse::from)
        .collect();

    Ok(Json(response))
}

/// GET /api/v1/workspaces/mine — List workspaces the current user is a member of.
#[utoipa::path(
    get,
    path = "/api/v1/workspaces/mine",
    tag = "workspaces",
    security(("bearerAuth" = [])),
    responses(
        (status = 200, description = "User's workspaces", body = Vec<WorkspaceResponse>),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip(state))]
#[tracing::instrument(skip_all)]
pub async fn list_my_workspaces(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<WorkspaceResponse>>> {
    let workspaces = WorkspaceRepository::list_by_user(&state.pool, claims.sub).await?;
    let response: Vec<WorkspaceResponse> = workspaces
        .into_iter()
        .map(WorkspaceResponse::from)
        .collect();

    Ok(Json(response))
}

/// GET /api/v1/workspaces/:id — Get workspace by ID.
#[utoipa::path(
    get,
    path = "/api/v1/workspaces/{id}",
    tag = "workspaces",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Workspace UUID")),
    responses(
        (status = 200, description = "Workspace detail", body = WorkspaceResponse),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Workspace not found"),
    )
)]
#[tracing::instrument(skip(state))]
#[tracing::instrument(skip_all)]
pub async fn get_workspace(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Path(id): Path<Uuid>,
) -> Result<Json<WorkspaceResponse>> {
    let workspace = WorkspaceRepository::find_by_id(&state.pool, id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Workspace {}", id)))?;

    if workspace.tenant_id != ctx.tenant_id {
        return Err(Error::NotFound(format!("Workspace {}", id)));
    }

    Ok(Json(WorkspaceResponse::from(workspace)))
}

/// POST /api/v1/workspaces — Create a new workspace.
#[utoipa::path(
    post,
    path = "/api/v1/workspaces",
    tag = "workspaces",
    security(("bearerAuth" = [])),
    request_body = CreateWorkspaceRequest,
    responses(
        (status = 201, description = "Workspace created", body = WorkspaceResponse),
        (status = 400, description = "Validation error or limit reached"),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip(state, payload))]
#[tracing::instrument(skip_all)]
pub async fn create_workspace(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateWorkspaceRequest>,
) -> Result<(StatusCode, Json<WorkspaceResponse>)> {
    payload
        .validate()
        .map_err(|e| Error::Validation(e.to_string()))?;

    // Check workspace limit (bypass for admins)
    if claims.role < 2 {
        let count = WorkspaceRepository::list_by_tenant(&state.pool, ctx.tenant_id, 1000, 0)
            .await?
            .len() as i32;

        let tenant = TenantRepository::find_by_id(&state.pool, ctx.tenant_id)
            .await?
            .ok_or_else(|| Error::NotFound("Tenant not found".to_string()))?;

        if count >= tenant.max_workspaces {
            return Err(Error::BadRequest(format!(
                "Workspace limit reached ({}/{})",
                count, tenant.max_workspaces
            )));
        }
    }

    let create = CreateWorkspace {
        name: payload.name,
        description: payload.description,
        color: payload.color,
        icon: payload.icon,
        is_default: payload.is_default,
    };

    let workspace =
        WorkspaceRepository::create(&state.pool, ctx.tenant_id, claims.sub, create).await?;

    // Add creator as workspace owner
    let member = AddWorkspaceMember {
        user_id: claims.sub,
        role: Some("owner".to_string()),
    };
    WorkspaceRepository::add_member(&state.pool, workspace.id, member).await?;

    tracing::info!(workspace_id = %workspace.id, "Created new workspace");

    Ok((
        StatusCode::CREATED,
        Json(WorkspaceResponse::from(workspace)),
    ))
}

/// PUT /api/v1/workspaces/:id — Update a workspace.
#[utoipa::path(
    put,
    path = "/api/v1/workspaces/{id}",
    tag = "workspaces",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Workspace UUID")),
    request_body = UpdateWorkspaceRequest,
    responses(
        (status = 200, description = "Workspace updated", body = WorkspaceResponse),
        (status = 400, description = "Validation error"),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Workspace not found"),
    )
)]
#[tracing::instrument(skip(state, payload))]
#[tracing::instrument(skip_all)]
pub async fn update_workspace(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateWorkspaceRequest>,
) -> Result<Json<WorkspaceResponse>> {
    payload
        .validate()
        .map_err(|e| Error::Validation(e.to_string()))?;

    // Verify workspace exists and belongs to current tenant
    let _existing = WorkspaceRepository::find_by_id(&state.pool, id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Workspace {}", id)))?;

    if _existing.tenant_id != ctx.tenant_id {
        return Err(Error::NotFound(format!("Workspace {}", id)));
    }

    let update = UpdateWorkspace {
        name: payload.name,
        description: payload.description,
        color: payload.color,
        icon: payload.icon,
        is_default: payload.is_default,
        settings: None,
    };

    let workspace = WorkspaceRepository::update(&state.pool, id, update).await?;
    tracing::info!(workspace_id = %id, "Updated workspace");

    Ok(Json(WorkspaceResponse::from(workspace)))
}

/// DELETE /api/v1/workspaces/:id — Delete a workspace.
#[utoipa::path(
    delete,
    path = "/api/v1/workspaces/{id}",
    tag = "workspaces",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Workspace UUID")),
    responses(
        (status = 204, description = "Workspace deleted"),
        (status = 400, description = "Cannot delete default workspace"),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Workspace not found"),
    )
)]
#[tracing::instrument(skip(state))]
#[tracing::instrument(skip_all)]
pub async fn delete_workspace(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    // Verify workspace exists and belongs to current tenant
    let workspace = WorkspaceRepository::find_by_id(&state.pool, id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Workspace {}", id)))?;

    if workspace.tenant_id != ctx.tenant_id {
        return Err(Error::NotFound(format!("Workspace {}", id)));
    }

    // Prevent deleting default workspace
    if workspace.is_default {
        return Err(Error::BadRequest(
            "Cannot delete default workspace".to_string(),
        ));
    }

    WorkspaceRepository::delete(&state.pool, id).await?;
    tracing::info!(workspace_id = %id, "Deleted workspace");

    Ok(StatusCode::NO_CONTENT)
}

/// GET /api/v1/workspaces/:id/members — List workspace members.
#[utoipa::path(
    get,
    path = "/api/v1/workspaces/{id}/members",
    tag = "workspaces",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Workspace UUID")),
    responses(
        (status = 200, description = "Member list", body = Vec<WorkspaceMemberResponse>),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Workspace not found"),
    )
)]
#[tracing::instrument(skip(state))]
#[tracing::instrument(skip_all)]
pub async fn list_workspace_members(
    State(state): State<AppState>,
    Path(workspace_id): Path<Uuid>,
) -> Result<Json<Vec<WorkspaceMemberResponse>>> {
    // Verify workspace exists
    let _workspace = WorkspaceRepository::find_by_id(&state.pool, workspace_id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Workspace {}", workspace_id)))?;

    let members = WorkspaceRepository::list_members(&state.pool, workspace_id).await?;
    let response: Vec<WorkspaceMemberResponse> = members
        .into_iter()
        .map(WorkspaceMemberResponse::from)
        .collect();

    Ok(Json(response))
}

/// POST /api/v1/workspaces/:id/members — Add member to workspace.
#[utoipa::path(
    post,
    path = "/api/v1/workspaces/{id}/members",
    tag = "workspaces",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Workspace UUID")),
    request_body = AddMemberRequest,
    responses(
        (status = 201, description = "Member added"),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Workspace not found"),
    )
)]
#[tracing::instrument(skip(state, payload))]
#[tracing::instrument(skip_all)]
pub async fn add_workspace_member(
    State(state): State<AppState>,
    Path(workspace_id): Path<Uuid>,
    Json(payload): Json<AddMemberRequest>,
) -> Result<StatusCode> {
    // Verify workspace exists
    let _workspace = WorkspaceRepository::find_by_id(&state.pool, workspace_id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Workspace {}", workspace_id)))?;

    let member = AddWorkspaceMember {
        user_id: payload.user_id,
        role: payload.role,
    };

    WorkspaceRepository::add_member(&state.pool, workspace_id, member).await?;
    tracing::info!(workspace_id = %workspace_id, user_id = %payload.user_id, "Added member to workspace");

    Ok(StatusCode::CREATED)
}

/// PUT /api/v1/workspaces/:id/members/:uid — Update workspace member role.
#[utoipa::path(
    put,
    path = "/api/v1/workspaces/{id}/members/{uid}",
    tag = "workspaces",
    security(("bearerAuth" = [])),
    params(
        ("id" = Uuid, Path, description = "Workspace UUID"),
        ("uid" = Uuid, Path, description = "User UUID"),
    ),
    request_body = UpdateMemberRoleRequest,
    responses(
        (status = 200, description = "Role updated"),
        (status = 400, description = "Invalid role"),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip(state, payload))]
#[tracing::instrument(skip_all)]
pub async fn update_workspace_member_role(
    State(state): State<AppState>,
    Path((workspace_id, user_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<UpdateMemberRoleRequest>,
) -> Result<StatusCode> {
    // Validate role
    let valid_roles = ["owner", "admin", "member", "viewer"];
    if !valid_roles.contains(&payload.role.as_str()) {
        return Err(Error::Validation(format!(
            "Invalid role. Must be one of: {:?}",
            valid_roles
        )));
    }

    WorkspaceRepository::update_member_role(&state.pool, workspace_id, user_id, &payload.role)
        .await?;
    tracing::info!(workspace_id = %workspace_id, user_id = %user_id, role = %payload.role, "Updated member role");

    Ok(StatusCode::OK)
}

/// DELETE /api/v1/workspaces/:id/members/:uid — Remove member from workspace.
#[utoipa::path(
    delete,
    path = "/api/v1/workspaces/{id}/members/{uid}",
    tag = "workspaces",
    security(("bearerAuth" = [])),
    params(
        ("id" = Uuid, Path, description = "Workspace UUID"),
        ("uid" = Uuid, Path, description = "User UUID"),
    ),
    responses(
        (status = 204, description = "Member removed"),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip(state))]
#[tracing::instrument(skip_all)]
pub async fn remove_workspace_member(
    State(state): State<AppState>,
    Path((workspace_id, user_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode> {
    WorkspaceRepository::remove_member(&state.pool, workspace_id, user_id).await?;
    tracing::info!(workspace_id = %workspace_id, user_id = %user_id, "Removed member from workspace");

    Ok(StatusCode::NO_CONTENT)
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
