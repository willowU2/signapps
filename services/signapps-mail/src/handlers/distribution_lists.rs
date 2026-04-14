//! Org-aware distribution list handlers.
//!
//! Provides CRUD endpoints for mailserver distribution lists. Members are
//! resolved dynamically from the org closure rather than stored explicitly.

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

/// A mailserver distribution list.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, utoipa::ToSchema)]
pub struct DistributionList {
    /// Unique identifier (UUID v4).
    pub id: Uuid,
    /// Org node that scopes this list.
    pub node_id: Uuid,
    /// List email address.
    pub address: String,
    /// Domain UUID.
    pub domain_id: Option<Uuid>,
    /// Human-readable description.
    pub description: Option<String>,
    /// Whether external senders may post to this list.
    pub allow_external: Option<bool>,
    /// Row creation timestamp.
    pub created_at: Option<DateTime<Utc>>,
    /// Row last-update timestamp.
    pub updated_at: Option<DateTime<Utc>>,
}

/// Request payload to create a distribution list.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreateDistributionListRequest {
    /// Org node UUID that scopes this list.
    pub node_id: Uuid,
    /// Email address for the list (local part only, without domain).
    pub address: String,
    /// Domain UUID.
    pub domain_id: Option<Uuid>,
    /// Human-readable description.
    pub description: Option<String>,
    /// Allow external senders.
    pub allow_external: Option<bool>,
}

/// Request payload to update a distribution list.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct UpdateDistributionListRequest {
    /// New address.
    pub address: Option<String>,
    /// New domain UUID.
    pub domain_id: Option<Uuid>,
    /// New description.
    pub description: Option<String>,
    /// New external-sender setting.
    pub allow_external: Option<bool>,
}

/// A dynamically resolved distribution list member.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, utoipa::ToSchema)]
pub struct DistributionListMember {
    /// Member email address.
    pub address: String,
    /// Member first name.
    pub first_name: String,
    /// Member last name.
    pub last_name: String,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// List all distribution lists.
#[utoipa::path(
    get,
    path = "/api/v1/mailserver/distribution-lists",
    tag = "mailserver-distribution-lists",
    security(("bearerAuth" = [])),
    responses(
        (status = 200, description = "List of distribution lists", body = Vec<DistributionList>),
        (status = 401, description = "Unauthorized"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn list_distribution_lists(
    State(state): State<AppState>,
    _claims: Extension<Claims>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, DistributionList>(
        "SELECT * FROM mailserver.distribution_lists ORDER BY created_at DESC",
    )
    .fetch_all(&state.pool)
    .await
    {
        Ok(lists) => Json(lists).into_response(),
        Err(e) => {
            tracing::error!(?e, "Failed to list distribution lists");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response()
        },
    }
}

/// Create a distribution list.
#[utoipa::path(
    post,
    path = "/api/v1/mailserver/distribution-lists",
    tag = "mailserver-distribution-lists",
    request_body = CreateDistributionListRequest,
    security(("bearerAuth" = [])),
    responses(
        (status = 201, description = "Distribution list created", body = DistributionList),
        (status = 400, description = "Invalid input"),
        (status = 401, description = "Unauthorized"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn create_distribution_list(
    State(state): State<AppState>,
    _claims: Extension<Claims>,
    Json(body): Json<CreateDistributionListRequest>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, DistributionList>(
        r#"INSERT INTO mailserver.distribution_lists
               (id, node_id, address, domain_id, description, allow_external, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW(), NOW())
           RETURNING *"#,
    )
    .bind(body.node_id)
    .bind(&body.address)
    .bind(body.domain_id)
    .bind(&body.description)
    .bind(body.allow_external.unwrap_or(false))
    .fetch_one(&state.pool)
    .await
    {
        Ok(list) => (StatusCode::CREATED, Json(list)).into_response(),
        Err(e) => {
            tracing::error!(?e, "Failed to create distribution list");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response()
        }
    }
}

/// Get members of a distribution list, resolved dynamically via org closure.
///
/// Returns all active mailserver accounts belonging to persons assigned
/// anywhere under the list's org node.
#[utoipa::path(
    get,
    path = "/api/v1/mailserver/distribution-lists/{id}/members",
    tag = "mailserver-distribution-lists",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Distribution list UUID")),
    responses(
        (status = 200, description = "Members of the distribution list", body = Vec<DistributionListMember>),
        (status = 404, description = "Distribution list not found"),
        (status = 401, description = "Unauthorized"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn get_distribution_list_members(
    State(state): State<AppState>,
    _claims: Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    // Fetch the list's node_id
    #[derive(sqlx::FromRow)]
    struct NodeRow {
        node_id: Uuid,
    }

    let list_row = match sqlx::query_as::<_, NodeRow>(
        "SELECT node_id FROM mailserver.distribution_lists WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({ "error": "Distribution list not found" })),
            )
                .into_response()
        },
        Err(e) => {
            tracing::error!(?e, "Failed to fetch distribution list");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response();
        },
    };

    match sqlx::query_as::<_, DistributionListMember>(
        r#"SELECT DISTINCT a.address, p.first_name, p.last_name
           FROM mailserver.accounts a
           JOIN core.persons p ON p.id = a.person_id
           JOIN core.assignments ca ON ca.person_id = p.id
           JOIN core.org_closure oc ON oc.descendant_id = ca.node_id
           WHERE oc.ancestor_id = $1
             AND ca.end_date IS NULL
             AND a.is_active = true
           ORDER BY p.last_name, p.first_name"#,
    )
    .bind(list_row.node_id)
    .fetch_all(&state.pool)
    .await
    {
        Ok(members) => Json(members).into_response(),
        Err(e) => {
            tracing::error!(?e, "Failed to resolve distribution list members");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response()
        },
    }
}

/// Update a distribution list.
#[utoipa::path(
    put,
    path = "/api/v1/mailserver/distribution-lists/{id}",
    tag = "mailserver-distribution-lists",
    request_body = UpdateDistributionListRequest,
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Distribution list UUID")),
    responses(
        (status = 200, description = "Updated distribution list", body = DistributionList),
        (status = 404, description = "Not found"),
        (status = 401, description = "Unauthorized"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn update_distribution_list(
    State(state): State<AppState>,
    _claims: Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateDistributionListRequest>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, DistributionList>(
        r#"UPDATE mailserver.distribution_lists
           SET address       = COALESCE($2, address),
               domain_id     = COALESCE($3, domain_id),
               description   = COALESCE($4, description),
               allow_external = COALESCE($5, allow_external),
               updated_at    = NOW()
           WHERE id = $1
           RETURNING *"#,
    )
    .bind(id)
    .bind(&body.address)
    .bind(body.domain_id)
    .bind(&body.description)
    .bind(body.allow_external)
    .fetch_optional(&state.pool)
    .await
    {
        Ok(Some(list)) => Json(list).into_response(),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Distribution list not found" })),
        )
            .into_response(),
        Err(e) => {
            tracing::error!(?e, "Failed to update distribution list");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response()
        },
    }
}

/// Delete a distribution list.
#[utoipa::path(
    delete,
    path = "/api/v1/mailserver/distribution-lists/{id}",
    tag = "mailserver-distribution-lists",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Distribution list UUID")),
    responses(
        (status = 204, description = "Deleted"),
        (status = 404, description = "Not found"),
        (status = 401, description = "Unauthorized"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn delete_distribution_list(
    State(state): State<AppState>,
    _claims: Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    match sqlx::query("DELETE FROM mailserver.distribution_lists WHERE id = $1")
        .bind(id)
        .execute(&state.pool)
        .await
    {
        Ok(r) if r.rows_affected() == 0 => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Distribution list not found" })),
        )
            .into_response(),
        Ok(_) => StatusCode::NO_CONTENT.into_response(),
        Err(e) => {
            tracing::error!(?e, "Failed to delete distribution list");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response()
        },
    }
}
