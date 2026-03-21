//! TimeItem handlers for the unified scheduling API.

use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, Utc};
use serde_json::json;
use signapps_common::{Claims, TenantContext};
use signapps_db::{
    AddDependency, AddTimeItemGroup, AddTimeItemUser, CreateSchedulingResource,
    CreateSchedulingTemplate, CreateTimeItem, MoveTimeItem, RecurrenceRuleRepository,
    SchedulingPreferencesRepository, SchedulingResourceRepository, SchedulingTemplateRepository,
    ShareTimeItem, TimeItemDependencyRepository, TimeItemGroupRepository, TimeItemRepository,
    TimeItemUserRepository, TimeItemsQuery, UpdateSchedulingPreferences, UpdateTimeItem,
};
use uuid::Uuid;

use crate::AppState;

// ============================================================================
// TimeItem CRUD
// ============================================================================

/// List time items with filters.
pub async fn list_time_items(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Extension(ctx): Extension<TenantContext>,
    Query(query): Query<TimeItemsQuery>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = TimeItemRepository::new(&state.pool);

    match repo.query(ctx.tenant_id, claims.sub, &query).await {
        Ok(response) => Ok(Json(json!(response))),
        Err(e) => {
            tracing::error!("Failed to list time items: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

/// Get a single time item by ID.
pub async fn get_time_item(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(_ctx): Extension<TenantContext>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = TimeItemRepository::new(&state.pool);

    match repo.find_by_id_with_relations(id).await {
        Ok(Some(item)) => Ok(Json(json!(item))),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            tracing::error!("Failed to get time item: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

/// Create a new time item.
pub async fn create_time_item(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Extension(ctx): Extension<TenantContext>,
    Json(input): Json<CreateTimeItem>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = TimeItemRepository::new(&state.pool);

    match repo
        .create(ctx.tenant_id, claims.sub, claims.sub, input)
        .await
    {
        Ok(item) => Ok((StatusCode::CREATED, Json(json!(item)))),
        Err(e) => {
            tracing::error!("Failed to create time item: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

/// Update a time item.
pub async fn update_time_item(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(_ctx): Extension<TenantContext>,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdateTimeItem>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = TimeItemRepository::new(&state.pool);

    match repo.update(id, input).await {
        Ok(item) => Ok(Json(json!(item))),
        Err(e) => {
            tracing::error!("Failed to update time item: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

/// Move a time item (change time).
pub async fn move_time_item(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(_ctx): Extension<TenantContext>,
    Path(id): Path<Uuid>,
    Json(input): Json<MoveTimeItem>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = TimeItemRepository::new(&state.pool);

    match repo
        .move_item(id, input.start_time, input.end_time, input.duration_minutes)
        .await
    {
        Ok(item) => Ok(Json(json!(item))),
        Err(e) => {
            tracing::error!("Failed to move time item: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

/// Delete a time item (soft delete).
pub async fn delete_time_item(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(_ctx): Extension<TenantContext>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = TimeItemRepository::new(&state.pool);

    match repo.delete(id).await {
        Ok(()) => Ok(StatusCode::NO_CONTENT),
        Err(e) => {
            tracing::error!("Failed to delete time item: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

/// Update time item status.
#[derive(serde::Deserialize)]
pub struct UpdateStatusInput {
    pub status: String,
}

pub async fn update_time_item_status(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(_ctx): Extension<TenantContext>,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdateStatusInput>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = TimeItemRepository::new(&state.pool);

    match repo.update_status(id, &input.status).await {
        Ok(item) => Ok(Json(json!(item))),
        Err(e) => {
            tracing::error!("Failed to update status: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

// ============================================================================
// Multi-User Availability
// ============================================================================

#[derive(serde::Deserialize)]
pub struct QueryUsersEventsInput {
    pub user_ids: Vec<Uuid>,
    pub start: DateTime<Utc>,
    pub end: DateTime<Utc>,
}

/// Fetch events for multiple users to compute availability.
pub async fn query_users_events(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(ctx): Extension<TenantContext>,
    Json(input): Json<QueryUsersEventsInput>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = TimeItemRepository::new(&state.pool);

    match repo
        .fetch_events_for_users(ctx.tenant_id, &input.user_ids, input.start, input.end)
        .await
    {
        Ok(items) => Ok(Json(json!({ "items": items }))),
        Err(e) => {
            tracing::error!("Failed to fetch events for users: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

// ============================================================================
// TimeItem Children
// ============================================================================

/// List children of a time item.
pub async fn list_children(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(_ctx): Extension<TenantContext>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = TimeItemRepository::new(&state.pool);

    match repo.list_children(id).await {
        Ok(items) => Ok(Json(json!({ "items": items }))),
        Err(e) => {
            tracing::error!("Failed to list children: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

// ============================================================================
// TimeItem Users (Participants)
// ============================================================================

/// List users for a time item.
pub async fn list_time_item_users(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(_ctx): Extension<TenantContext>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = TimeItemUserRepository::new(&state.pool);

    match repo.list_users(id).await {
        Ok(users) => Ok(Json(json!({ "users": users }))),
        Err(e) => {
            tracing::error!("Failed to list users: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

/// Add a user to a time item.
pub async fn add_time_item_user(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(_ctx): Extension<TenantContext>,
    Path(id): Path<Uuid>,
    Json(input): Json<AddTimeItemUser>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = TimeItemUserRepository::new(&state.pool);

    match repo.add_user(id, input).await {
        Ok(user) => {
            // Attempt to broadcast to the assigned user
            let item_repo = TimeItemRepository::new(&state.pool);
            if let Ok(Some(item)) = item_repo.find_by_id(id).await {
                let type_label = if item.item_type == "task" { "la tâche" } else { "l'événement" };
                let notification = crate::NotificationMessage {
                    user_id: user.user_id,
                    title: "Nouvelle Assignation".to_string(),
                    message: format!("Vous avez été ajouté(e) à {} '{}'", type_label, item.title),
                    action_url: Some(format!("/app/scheduling/hub")),
                };

                let tx = state.tx_notifications.clone();
                if let Some(client) = state.redis_client.clone() {
                    tokio::spawn(async move {
                        if let Ok(mut con) = client.get_multiplexed_tokio_connection().await {
                            let payload = serde_json::to_string(&notification).unwrap_or_default();
                            let _: Result<(), redis::RedisError> = redis::cmd("PUBLISH")
                                .arg("signapps_notifications")
                                .arg(payload)
                                .query_async(&mut con)
                                .await;
                        } else {
                            let _ = tx.send(notification);
                        }
                    });
                } else {
                    let _ = state.tx_notifications.send(notification);
                }
            }

            Ok((StatusCode::CREATED, Json(json!(user))))
        },
        Err(e) => {
            tracing::error!("Failed to add user: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

/// Remove a user from a time item.
pub async fn remove_time_item_user(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(_ctx): Extension<TenantContext>,
    Path((id, user_id)): Path<(Uuid, Uuid)>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = TimeItemUserRepository::new(&state.pool);

    match repo.remove_user(id, user_id).await {
        Ok(()) => Ok(StatusCode::NO_CONTENT),
        Err(e) => {
            tracing::error!("Failed to remove user: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

/// Update RSVP status.
#[derive(serde::Deserialize)]
pub struct UpdateRsvpInput {
    pub status: String,
}

pub async fn update_rsvp(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Extension(_ctx): Extension<TenantContext>,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdateRsvpInput>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = TimeItemUserRepository::new(&state.pool);

    match repo.update_rsvp(id, claims.sub, &input.status).await {
        Ok(user) => Ok(Json(json!(user))),
        Err(e) => {
            tracing::error!("Failed to update RSVP: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

// ============================================================================
// TimeItem Groups
// ============================================================================

/// List groups for a time item.
pub async fn list_time_item_groups(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(_ctx): Extension<TenantContext>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = TimeItemGroupRepository::new(&state.pool);

    match repo.list_groups(id).await {
        Ok(groups) => Ok(Json(json!({ "groups": groups }))),
        Err(e) => {
            tracing::error!("Failed to list groups: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

/// Add a group to a time item.
pub async fn add_time_item_group(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(_ctx): Extension<TenantContext>,
    Path(id): Path<Uuid>,
    Json(input): Json<AddTimeItemGroup>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = TimeItemGroupRepository::new(&state.pool);

    match repo.add_group(id, input).await {
        Ok(group) => Ok((StatusCode::CREATED, Json(json!(group)))),
        Err(e) => {
            tracing::error!("Failed to add group: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

/// Remove a group from a time item.
pub async fn remove_time_item_group(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(_ctx): Extension<TenantContext>,
    Path((id, group_id)): Path<(Uuid, Uuid)>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = TimeItemGroupRepository::new(&state.pool);

    match repo.remove_group(id, group_id).await {
        Ok(()) => Ok(StatusCode::NO_CONTENT),
        Err(e) => {
            tracing::error!("Failed to remove group: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

/// Share a time item with multiple users and groups.
pub async fn share_time_item(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(_ctx): Extension<TenantContext>,
    Path(id): Path<Uuid>,
    Json(input): Json<ShareTimeItem>,
) -> Result<impl IntoResponse, StatusCode> {
    let user_repo = TimeItemUserRepository::new(&state.pool);
    let group_repo = TimeItemGroupRepository::new(&state.pool);

    // Add users
    if let Some(users) = input.users {
        for user in users {
            if let Err(e) = user_repo.add_user(id, user).await {
                tracing::error!("Failed to add user: {}", e);
            }
        }
    }

    // Add groups
    if let Some(groups) = input.groups {
        for group in groups {
            if let Err(e) = group_repo.add_group(id, group).await {
                tracing::error!("Failed to add group: {}", e);
            }
        }
    }

    Ok(StatusCode::NO_CONTENT)
}

// ============================================================================
// TimeItem Dependencies
// ============================================================================

/// List dependencies for a time item.
pub async fn list_dependencies(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(_ctx): Extension<TenantContext>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = TimeItemDependencyRepository::new(&state.pool);

    match repo.list_dependencies(id).await {
        Ok(deps) => Ok(Json(json!({ "dependencies": deps }))),
        Err(e) => {
            tracing::error!("Failed to list dependencies: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

/// Add a dependency.
pub async fn add_dependency(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(_ctx): Extension<TenantContext>,
    Path(id): Path<Uuid>,
    Json(input): Json<AddDependency>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = TimeItemDependencyRepository::new(&state.pool);

    match repo.add_dependency(id, input).await {
        Ok(dep) => Ok((StatusCode::CREATED, Json(json!(dep)))),
        Err(e) => {
            tracing::error!("Failed to add dependency: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

/// Remove a dependency.
pub async fn remove_dependency(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(_ctx): Extension<TenantContext>,
    Path((id, depends_on_id)): Path<(Uuid, Uuid)>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = TimeItemDependencyRepository::new(&state.pool);

    match repo.remove_dependency(id, depends_on_id).await {
        Ok(()) => Ok(StatusCode::NO_CONTENT),
        Err(e) => {
            tracing::error!("Failed to remove dependency: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

// ============================================================================
// Recurrence Rules
// ============================================================================

/// Get recurrence rule for a time item.
pub async fn get_recurrence(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(_ctx): Extension<TenantContext>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = RecurrenceRuleRepository::new(&state.pool);

    match repo.find_by_time_item(id).await {
        Ok(Some(rule)) => Ok(Json(json!(rule))),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            tracing::error!("Failed to get recurrence: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

/// Delete recurrence rule.
pub async fn delete_recurrence(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(_ctx): Extension<TenantContext>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = RecurrenceRuleRepository::new(&state.pool);

    match repo.delete(id).await {
        Ok(()) => Ok(StatusCode::NO_CONTENT),
        Err(e) => {
            tracing::error!("Failed to delete recurrence: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

// ============================================================================
// Scheduling Resources
// ============================================================================

/// List scheduling resources.
pub async fn list_scheduling_resources(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(ctx): Extension<TenantContext>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = SchedulingResourceRepository::new(&state.pool);

    match repo.list(ctx.tenant_id).await {
        Ok(resources) => Ok(Json(json!({ "resources": resources }))),
        Err(e) => {
            tracing::error!("Failed to list resources: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

/// Get a scheduling resource.
pub async fn get_scheduling_resource(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(_ctx): Extension<TenantContext>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = SchedulingResourceRepository::new(&state.pool);

    match repo.find_by_id(id).await {
        Ok(Some(resource)) => Ok(Json(json!(resource))),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            tracing::error!("Failed to get resource: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

/// Create a scheduling resource.
pub async fn create_scheduling_resource(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(ctx): Extension<TenantContext>,
    Json(input): Json<CreateSchedulingResource>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = SchedulingResourceRepository::new(&state.pool);

    match repo.create(ctx.tenant_id, input).await {
        Ok(resource) => Ok((StatusCode::CREATED, Json(json!(resource)))),
        Err(e) => {
            tracing::error!("Failed to create resource: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

/// Delete a scheduling resource.
pub async fn delete_scheduling_resource(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(_ctx): Extension<TenantContext>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = SchedulingResourceRepository::new(&state.pool);

    match repo.delete(id).await {
        Ok(()) => Ok(StatusCode::NO_CONTENT),
        Err(e) => {
            tracing::error!("Failed to delete resource: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

// ============================================================================
// Scheduling Templates
// ============================================================================

/// List scheduling templates.
pub async fn list_templates(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(ctx): Extension<TenantContext>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = SchedulingTemplateRepository::new(&state.pool);

    match repo.list(ctx.tenant_id).await {
        Ok(templates) => Ok(Json(json!({ "templates": templates }))),
        Err(e) => {
            tracing::error!("Failed to list templates: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

/// Get a scheduling template.
pub async fn get_template(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(_ctx): Extension<TenantContext>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = SchedulingTemplateRepository::new(&state.pool);

    match repo.find_by_id(id).await {
        Ok(Some(template)) => Ok(Json(json!(template))),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            tracing::error!("Failed to get template: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

/// Create a scheduling template.
pub async fn create_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Extension(ctx): Extension<TenantContext>,
    Json(input): Json<CreateSchedulingTemplate>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = SchedulingTemplateRepository::new(&state.pool);

    match repo.create(ctx.tenant_id, claims.sub, input).await {
        Ok(template) => Ok((StatusCode::CREATED, Json(json!(template)))),
        Err(e) => {
            tracing::error!("Failed to create template: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

/// Delete a scheduling template.
pub async fn delete_template(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(_ctx): Extension<TenantContext>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = SchedulingTemplateRepository::new(&state.pool);

    match repo.delete(id).await {
        Ok(()) => Ok(StatusCode::NO_CONTENT),
        Err(e) => {
            tracing::error!("Failed to delete template: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

// ============================================================================
// Scheduling Preferences
// ============================================================================

/// Get user scheduling preferences.
pub async fn get_preferences(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Extension(_ctx): Extension<TenantContext>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = SchedulingPreferencesRepository::new(&state.pool);

    match repo.get_or_create(claims.sub).await {
        Ok(prefs) => Ok(Json(json!(prefs))),
        Err(e) => {
            tracing::error!("Failed to get preferences: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

/// Update user scheduling preferences.
pub async fn update_preferences(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Extension(_ctx): Extension<TenantContext>,
    Json(input): Json<UpdateSchedulingPreferences>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = SchedulingPreferencesRepository::new(&state.pool);

    // Ensure preferences exist first
    let _ = repo.get_or_create(claims.sub).await;

    match repo.update(claims.sub, input).await {
        Ok(prefs) => Ok(Json(json!(prefs))),
        Err(e) => {
            tracing::error!("Failed to update preferences: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}
