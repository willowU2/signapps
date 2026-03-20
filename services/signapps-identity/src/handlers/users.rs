//! User management handlers.

use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use signapps_common::{Claims, Error, Result};
use signapps_db::models::{CreateCalendar, CreateTask, CreateUser, UpdateUser};
use signapps_db::repositories::{CalendarRepository, TaskRepository, UserRepository};
use uuid::Uuid;
use validator::Validate;

use crate::AppState;

/// Query parameters for listing users.
#[derive(Debug, Deserialize)]
pub struct ListQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    #[allow(dead_code)]
    pub search: Option<String>,
}

/// User response DTO.
#[derive(Debug, Serialize)]
pub struct UserResponse {
    pub id: Uuid,
    pub username: String,
    pub email: Option<String>,
    pub display_name: Option<String>,
    pub role: i16,
    pub mfa_enabled: bool,
    pub auth_provider: String,
    pub created_at: String,
    pub last_login: Option<String>,
}

/// User list response with pagination info.
#[allow(dead_code)]
#[derive(Debug, Serialize)]
pub struct UserListResponse {
    pub users: Vec<UserResponse>,
    pub total: i64,
    pub limit: i64,
    pub offset: i64,
}

/// Create user request (admin).
#[derive(Debug, Deserialize, Validate)]
pub struct AdminCreateUserRequest {
    #[validate(length(min = 3, max = 64))]
    pub username: String,
    #[validate(email)]
    pub email: Option<String>,
    #[validate(length(min = 8, max = 128))]
    pub password: Option<String>,
    #[validate(length(max = 255))]
    pub display_name: Option<String>,
    pub role: Option<i16>,
    pub auth_provider: Option<String>,
    pub workspace_ids: Option<Vec<Uuid>>,
}

/// Update user request (admin).
#[derive(Debug, Deserialize, Validate)]
pub struct AdminUpdateUserRequest {
    #[validate(email)]
    pub email: Option<String>,
    #[validate(length(max = 255))]
    pub display_name: Option<String>,
    pub role: Option<i16>,
    pub mfa_enabled: Option<bool>,
    pub workspace_ids: Option<Vec<Uuid>>,
}

/// Update self request.
#[derive(Debug, Deserialize, Validate)]
pub struct UpdateSelfRequest {
    #[validate(email)]
    pub email: Option<String>,
    #[validate(length(max = 255))]
    pub display_name: Option<String>,
    #[validate(length(min = 8, max = 128))]
    pub new_password: Option<String>,
    pub current_password: Option<String>,
}

/// Set user tenant request.
#[derive(Debug, Deserialize)]
pub struct SetTenantRequest {
    pub tenant_id: Uuid,
}

impl From<signapps_db::models::User> for UserResponse {
    fn from(user: signapps_db::models::User) -> Self {
        Self {
            id: user.id,
            username: user.username,
            email: user.email,
            display_name: user.display_name,
            role: user.role,
            mfa_enabled: user.mfa_enabled,
            auth_provider: user.auth_provider,
            created_at: user.created_at.to_rfc3339(),
            last_login: user.last_login.map(|dt| dt.to_rfc3339()),
        }
    }
}

/// List all users with pagination (admin only).
#[tracing::instrument(skip(state))]
pub async fn list(
    State(state): State<AppState>,
    Query(query): Query<ListQuery>,
) -> Result<Json<Vec<UserResponse>>> {
    let limit = query.limit.unwrap_or(50).min(100);
    let offset = query.offset.unwrap_or(0);

    let users = UserRepository::list(&state.pool, limit, offset).await?;

    let response: Vec<UserResponse> = users.into_iter().map(UserResponse::from).collect();

    Ok(Json(response))
}

/// Get user by ID (admin only).
#[tracing::instrument(skip(state))]
pub async fn get(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<UserResponse>> {
    let user = UserRepository::find_by_id(&state.pool, id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("User {}", id)))?;

    Ok(Json(UserResponse::from(user)))
}

/// Create new user (admin only).
#[tracing::instrument(skip(state, payload))]
pub async fn create(
    State(state): State<AppState>,
    Json(payload): Json<AdminCreateUserRequest>,
) -> Result<Json<UserResponse>> {
    payload
        .validate()
        .map_err(|e| Error::Validation(e.to_string()))?;

    // Check username uniqueness
    if UserRepository::find_by_username(&state.pool, &payload.username)
        .await?
        .is_some()
    {
        return Err(Error::AlreadyExists("Username already taken".to_string()));
    }

    // Check email uniqueness
    if let Some(ref email) = payload.email {
        if UserRepository::find_by_email(&state.pool, email)
            .await?
            .is_some()
        {
            return Err(Error::AlreadyExists("Email already registered".to_string()));
        }
    }

    let auth_provider = payload
        .auth_provider
        .as_deref()
        .unwrap_or("local")
        .to_string();

    let create_user = CreateUser {
        username: payload.username.to_lowercase(),
        email: payload.email,
        password: payload.password.clone(),
        display_name: payload.display_name,
        role: payload.role.unwrap_or(1),
        auth_provider,
        ldap_dn: None,
        ldap_groups: None,
    };

    // Hash password if provided and create user
    let user = if let Some(ref password) = payload.password {
        let password_hash = crate::auth::hash_password(password)?;
        UserRepository::create_with_hash(&state.pool, create_user, &password_hash).await?
    } else {
        UserRepository::create(&state.pool, create_user).await?
    };

    // Initialize Default Calendar
    let calendar_params = CreateCalendar {
        name: "Mon Calendrier".to_string(),
        description: Some("Calendrier personnel de l'utilisateur".to_string()),
        timezone: Some("UTC".to_string()),
        color: Some("#3b82f6".to_string()),
        is_shared: Some(false),
    };
    let calendar_repo = CalendarRepository::new(&state.pool);
    let calendar = calendar_repo.create(calendar_params, user.id).await?;

    // Initialize Default Tasks List (Root task for the calendar)
    let task_params = CreateTask {
        parent_task_id: None,
        title: "Mes Tâches".to_string(),
        description: Some("Liste principale des tâches de l'utilisateur".to_string()),
        priority: Some(1),
        position: Some(0),
        due_date: None,
        assigned_to: Some(user.id),
    };
    let task_repo = TaskRepository::new(&state.pool);
    let _root_task = task_repo.create(calendar.id, task_params, user.id).await?;

    // Add user to specified workspaces
    if let Some(workspace_ids) = payload.workspace_ids {
        for workspace_id in workspace_ids {
            let member = signapps_db::models::AddWorkspaceMember {
                user_id: user.id,
                role: Some("member".to_string()),
            };
            if let Err(e) = signapps_db::repositories::WorkspaceRepository::add_member(&state.pool, workspace_id, member).await {
                tracing::error!(workspace_id = %workspace_id, "Failed to add new user to workspace: {}", e);
            }
        }
    }

    tracing::info!(user_id = %user.id, calendar_id = %calendar.id, "Admin created user and default calendar & tasks");

    Ok(Json(UserResponse::from(user)))
}

/// Update user (admin only).
#[tracing::instrument(skip(state, payload))]
pub async fn update(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<AdminUpdateUserRequest>,
) -> Result<Json<UserResponse>> {
    payload
        .validate()
        .map_err(|e| Error::Validation(e.to_string()))?;

    // Verify user exists
    let _existing = UserRepository::find_by_id(&state.pool, id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("User {}", id)))?;

    // Check email uniqueness if changing
    if let Some(ref email) = payload.email {
        if let Some(other) = UserRepository::find_by_email(&state.pool, email).await? {
            if other.id != id {
                return Err(Error::AlreadyExists("Email already registered".to_string()));
            }
        }
    }

    let update = UpdateUser {
        email: payload.email,
        display_name: payload.display_name,
        role: payload.role,
        ldap_dn: None,
        ldap_groups: None,
    };

    let user = UserRepository::update(&state.pool, id, update).await?;

    // Handle MFA disable if requested
    if payload.mfa_enabled == Some(false) {
        UserRepository::disable_mfa(&state.pool, id).await?;
    }

    tracing::info!(user_id = %id, "Admin updated user");

    Ok(Json(UserResponse::from(user)))
}

/// Delete user (admin only).
#[tracing::instrument(skip(state))]
pub async fn delete(State(state): State<AppState>, Path(id): Path<Uuid>) -> Result<StatusCode> {
    // Verify user exists
    let _existing = UserRepository::find_by_id(&state.pool, id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("User {}", id)))?;

    // Purge associated tasks
    sqlx::query("DELETE FROM calendar.tasks WHERE created_by = $1 OR assigned_to = $1")
        .bind(id)
        .execute(state.pool.inner())
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

    // Purge associated calendars
    sqlx::query("DELETE FROM calendar.calendars WHERE owner_id = $1")
        .bind(id)
        .execute(state.pool.inner())
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

    UserRepository::delete(&state.pool, id).await?;

    tracing::info!(user_id = %id, "Admin deleted user");

    Ok(StatusCode::NO_CONTENT)
}

/// Get current user profile.
#[tracing::instrument(skip(state))]
pub async fn get_me(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<UserResponse>> {
    let user = UserRepository::find_by_id(&state.pool, claims.sub)
        .await?
        .ok_or(Error::NotFound("User not found".to_string()))?;

    Ok(Json(UserResponse::from(user)))
}

/// Update current user profile.
#[tracing::instrument(skip(state, payload))]
pub async fn update_me(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<UpdateSelfRequest>,
) -> Result<Json<UserResponse>> {
    payload
        .validate()
        .map_err(|e| Error::Validation(e.to_string()))?;

    let user = UserRepository::find_by_id(&state.pool, claims.sub)
        .await?
        .ok_or(Error::NotFound("User not found".to_string()))?;

    // Check email uniqueness if changing
    if let Some(ref email) = payload.email {
        if let Some(other) = UserRepository::find_by_email(&state.pool, email).await? {
            if other.id != claims.sub {
                return Err(Error::AlreadyExists("Email already registered".to_string()));
            }
        }
    }

    // Handle password change
    if let Some(ref new_password) = payload.new_password {
        let current_password = payload.current_password.as_ref().ok_or(Error::BadRequest(
            "Current password required to change password".to_string(),
        ))?;

        let password_hash = user.password_hash.as_ref().ok_or(Error::BadRequest(
            "Cannot change password for LDAP users".to_string(),
        ))?;

        if !crate::auth::verify_password(current_password, password_hash)? {
            return Err(Error::InvalidCredentials);
        }

        // Hash new password and update
        let new_hash = crate::auth::hash_password(new_password)?;
        UserRepository::update_password(&state.pool, claims.sub, &new_hash).await?;
        tracing::info!(user_id = %claims.sub, "User changed password");
    }

    let update = UpdateUser {
        email: payload.email,
        display_name: payload.display_name,
        role: None, // Users cannot change their own role
        ldap_dn: None,
        ldap_groups: None,
    };

    let updated = UserRepository::update(&state.pool, claims.sub, update).await?;

    tracing::info!(user_id = %claims.sub, "User updated profile");

    Ok(Json(UserResponse::from(updated)))
}

/// Set user's default tenant (admin only).
#[tracing::instrument(skip(state, payload))]
pub async fn set_tenant(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<SetTenantRequest>,
) -> Result<Json<UserResponse>> {
    // Verify user exists
    let _existing = UserRepository::find_by_id(&state.pool, id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("User {}", id)))?;

    // Verify tenant exists
    let _tenant = signapps_db::repositories::TenantRepository::find_by_id(&state.pool, payload.tenant_id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Tenant {}", payload.tenant_id)))?;

    // Set the tenant
    let user = UserRepository::set_tenant(&state.pool, id, payload.tenant_id).await?;

    tracing::info!(user_id = %id, tenant_id = %payload.tenant_id, "Admin assigned user to tenant");

    Ok(Json(UserResponse::from(user)))
}
