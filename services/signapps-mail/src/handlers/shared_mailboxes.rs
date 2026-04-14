//! Shared mailbox handlers.
//!
//! Provides CRUD endpoints for shared mailboxes and member management.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use signapps_common::Claims;

use crate::AppState;

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

/// A shared mailbox.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, utoipa::ToSchema)]
pub struct SharedMailbox {
    /// Unique identifier (UUID v4).
    pub id: Uuid,
    /// Display name.
    pub name: String,
    /// Shared mailbox email address.
    pub address: String,
    /// Domain UUID.
    pub domain_id: Option<Uuid>,
    /// Whether the mailbox is active.
    pub is_active: Option<bool>,
    /// Row creation timestamp.
    pub created_at: Option<DateTime<Utc>>,
    /// Row last-update timestamp.
    pub updated_at: Option<DateTime<Utc>>,
}

/// A shared mailbox with its members.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct SharedMailboxWithMembers {
    /// Shared mailbox data.
    #[serde(flatten)]
    pub mailbox: SharedMailbox,
    /// Members with access.
    pub members: Vec<SharedMailboxMember>,
}

/// A member of a shared mailbox.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, utoipa::ToSchema)]
pub struct SharedMailboxMember {
    /// Person UUID.
    pub person_id: Uuid,
    /// Person first name.
    pub first_name: String,
    /// Person last name.
    pub last_name: String,
    /// Access level (`read`, `read_write`, `send_as`).
    pub access_level: Option<String>,
}

/// Request payload to create a shared mailbox.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreateSharedMailboxRequest {
    /// Display name.
    pub name: String,
    /// Email address.
    pub address: String,
    /// Domain UUID.
    pub domain_id: Option<Uuid>,
}

/// Request payload to update a shared mailbox.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct UpdateSharedMailboxRequest {
    /// New display name.
    pub name: Option<String>,
    /// New address.
    pub address: Option<String>,
    /// New domain UUID.
    pub domain_id: Option<Uuid>,
    /// Whether the mailbox is active.
    pub is_active: Option<bool>,
}

/// Request payload to add a member to a shared mailbox.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct AddSharedMailboxMemberRequest {
    /// Person UUID to add.
    pub person_id: Uuid,
    /// Access level (`read`, `read_write`, `send_as`).
    pub access_level: Option<String>,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// List all shared mailboxes.
#[utoipa::path(
    get,
    path = "/api/v1/mailserver/shared-mailboxes",
    tag = "mailserver-shared-mailboxes",
    security(("bearerAuth" = [])),
    responses(
        (status = 200, description = "List of shared mailboxes", body = Vec<SharedMailbox>),
        (status = 401, description = "Unauthorized"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn list_shared_mailboxes(
    State(state): State<AppState>,
    _claims: Extension<Claims>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, SharedMailbox>(
        "SELECT * FROM mailserver.shared_mailboxes ORDER BY created_at DESC",
    )
    .fetch_all(&state.pool)
    .await
    {
        Ok(mailboxes) => Json(mailboxes).into_response(),
        Err(e) => {
            tracing::error!(?e, "Failed to list shared mailboxes");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response()
        },
    }
}

/// Create a shared mailbox.
#[utoipa::path(
    post,
    path = "/api/v1/mailserver/shared-mailboxes",
    tag = "mailserver-shared-mailboxes",
    request_body = CreateSharedMailboxRequest,
    security(("bearerAuth" = [])),
    responses(
        (status = 201, description = "Shared mailbox created", body = SharedMailbox),
        (status = 400, description = "Invalid input"),
        (status = 401, description = "Unauthorized"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn create_shared_mailbox(
    State(state): State<AppState>,
    _claims: Extension<Claims>,
    Json(body): Json<CreateSharedMailboxRequest>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, SharedMailbox>(
        r#"INSERT INTO mailserver.shared_mailboxes
               (id, name, address, domain_id, is_active, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, true, NOW(), NOW())
           RETURNING *"#,
    )
    .bind(&body.name)
    .bind(&body.address)
    .bind(body.domain_id)
    .fetch_one(&state.pool)
    .await
    {
        Ok(mailbox) => (StatusCode::CREATED, Json(mailbox)).into_response(),
        Err(e) => {
            tracing::error!(?e, "Failed to create shared mailbox");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response()
        },
    }
}

/// Get a shared mailbox with its current members.
#[utoipa::path(
    get,
    path = "/api/v1/mailserver/shared-mailboxes/{id}",
    tag = "mailserver-shared-mailboxes",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Shared mailbox UUID")),
    responses(
        (status = 200, description = "Shared mailbox with members", body = SharedMailboxWithMembers),
        (status = 404, description = "Not found"),
        (status = 401, description = "Unauthorized"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn get_shared_mailbox(
    State(state): State<AppState>,
    _claims: Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let mailbox = match sqlx::query_as::<_, SharedMailbox>(
        "SELECT * FROM mailserver.shared_mailboxes WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await
    {
        Ok(Some(m)) => m,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({ "error": "Shared mailbox not found" })),
            )
                .into_response()
        },
        Err(e) => {
            tracing::error!(?e, "Failed to fetch shared mailbox");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response();
        },
    };

    let members = match sqlx::query_as::<_, SharedMailboxMember>(
        r#"SELECT smm.person_id, p.first_name, p.last_name, smm.access_level
           FROM mailserver.shared_mailbox_members smm
           JOIN core.persons p ON p.id = smm.person_id
           WHERE smm.mailbox_id = $1
           ORDER BY p.last_name, p.first_name"#,
    )
    .bind(id)
    .fetch_all(&state.pool)
    .await
    {
        Ok(m) => m,
        Err(e) => {
            tracing::error!(?e, "Failed to fetch shared mailbox members");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response();
        },
    };

    Json(SharedMailboxWithMembers { mailbox, members }).into_response()
}

/// Update a shared mailbox.
#[utoipa::path(
    put,
    path = "/api/v1/mailserver/shared-mailboxes/{id}",
    tag = "mailserver-shared-mailboxes",
    request_body = UpdateSharedMailboxRequest,
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Shared mailbox UUID")),
    responses(
        (status = 200, description = "Updated shared mailbox", body = SharedMailbox),
        (status = 404, description = "Not found"),
        (status = 401, description = "Unauthorized"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn update_shared_mailbox(
    State(state): State<AppState>,
    _claims: Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateSharedMailboxRequest>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, SharedMailbox>(
        r#"UPDATE mailserver.shared_mailboxes
           SET name      = COALESCE($2, name),
               address   = COALESCE($3, address),
               domain_id = COALESCE($4, domain_id),
               is_active = COALESCE($5, is_active),
               updated_at = NOW()
           WHERE id = $1
           RETURNING *"#,
    )
    .bind(id)
    .bind(&body.name)
    .bind(&body.address)
    .bind(body.domain_id)
    .bind(body.is_active)
    .fetch_optional(&state.pool)
    .await
    {
        Ok(Some(m)) => Json(m).into_response(),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Shared mailbox not found" })),
        )
            .into_response(),
        Err(e) => {
            tracing::error!(?e, "Failed to update shared mailbox");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response()
        },
    }
}

/// Delete a shared mailbox.
#[utoipa::path(
    delete,
    path = "/api/v1/mailserver/shared-mailboxes/{id}",
    tag = "mailserver-shared-mailboxes",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Shared mailbox UUID")),
    responses(
        (status = 204, description = "Deleted"),
        (status = 404, description = "Not found"),
        (status = 401, description = "Unauthorized"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn delete_shared_mailbox(
    State(state): State<AppState>,
    _claims: Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    match sqlx::query("DELETE FROM mailserver.shared_mailboxes WHERE id = $1")
        .bind(id)
        .execute(&state.pool)
        .await
    {
        Ok(r) if r.rows_affected() == 0 => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Shared mailbox not found" })),
        )
            .into_response(),
        Ok(_) => StatusCode::NO_CONTENT.into_response(),
        Err(e) => {
            tracing::error!(?e, "Failed to delete shared mailbox");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response()
        },
    }
}

/// Add a member to a shared mailbox.
#[utoipa::path(
    post,
    path = "/api/v1/mailserver/shared-mailboxes/{id}/members",
    tag = "mailserver-shared-mailboxes",
    request_body = AddSharedMailboxMemberRequest,
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Shared mailbox UUID")),
    responses(
        (status = 201, description = "Member added"),
        (status = 400, description = "Invalid input"),
        (status = 401, description = "Unauthorized"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn add_shared_mailbox_member(
    State(state): State<AppState>,
    _claims: Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<AddSharedMailboxMemberRequest>,
) -> impl IntoResponse {
    match sqlx::query(
        r#"INSERT INTO mailserver.shared_mailbox_members
               (mailbox_id, person_id, access_level)
           VALUES ($1, $2, $3)
           ON CONFLICT (mailbox_id, person_id) DO UPDATE
               SET access_level = EXCLUDED.access_level"#,
    )
    .bind(id)
    .bind(body.person_id)
    .bind(&body.access_level)
    .execute(&state.pool)
    .await
    {
        Ok(_) => (
            StatusCode::CREATED,
            Json(serde_json::json!({ "message": "Member added" })),
        )
            .into_response(),
        Err(e) => {
            tracing::error!(?e, "Failed to add shared mailbox member");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response()
        },
    }
}

/// Remove a member from a shared mailbox.
#[utoipa::path(
    delete,
    path = "/api/v1/mailserver/shared-mailboxes/{id}/members/{person_id}",
    tag = "mailserver-shared-mailboxes",
    security(("bearerAuth" = [])),
    params(
        ("id" = Uuid, Path, description = "Shared mailbox UUID"),
        ("person_id" = Uuid, Path, description = "Person UUID"),
    ),
    responses(
        (status = 204, description = "Member removed"),
        (status = 404, description = "Member not found"),
        (status = 401, description = "Unauthorized"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn remove_shared_mailbox_member(
    State(state): State<AppState>,
    _claims: Extension<Claims>,
    Path((id, person_id)): Path<(Uuid, Uuid)>,
) -> impl IntoResponse {
    match sqlx::query(
        "DELETE FROM mailserver.shared_mailbox_members WHERE mailbox_id = $1 AND person_id = $2",
    )
    .bind(id)
    .bind(person_id)
    .execute(&state.pool)
    .await
    {
        Ok(r) if r.rows_affected() == 0 => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Member not found" })),
        )
            .into_response(),
        Ok(_) => StatusCode::NO_CONTENT.into_response(),
        Err(e) => {
            tracing::error!(?e, "Failed to remove shared mailbox member");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response()
        },
    }
}
