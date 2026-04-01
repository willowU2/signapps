use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use serde::Deserialize;
use signapps_common::Claims;
use uuid::Uuid;

use crate::models::{MailAccount, MailLabel};
use crate::AppState;

use super::folders::FolderQuery;

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request payload for CreateLabel operation.
pub struct CreateLabelRequest {
    pub account_id: Uuid,
    pub name: String,
    pub color: Option<String>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request payload for UpdateLabel operation.
pub struct UpdateLabelRequest {
    pub name: Option<String>,
    pub color: Option<String>,
}

/// List mail labels for the current user.
#[utoipa::path(
    get,
    path = "/api/v1/mail/labels",
    tag = "mail-labels",
    security(("bearerAuth" = [])),
    responses(
        (status = 200, description = "List of labels", body = Vec<crate::models::MailLabel>),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn list_labels(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<FolderQuery>,
) -> impl IntoResponse {
    let labels = if let Some(account_id) = query.account_id {
        sqlx::query_as::<_, MailLabel>(
            r#"
            SELECT l.* FROM mail.labels l
            JOIN mail.accounts a ON a.id = l.account_id
            WHERE l.account_id = $1 AND a.user_id = $2
            ORDER BY l.name
            LIMIT 200
            "#,
        )
        .bind(account_id)
        .bind(claims.sub)
        .fetch_all(&state.pool)
        .await
    } else {
        sqlx::query_as::<_, MailLabel>(
            r#"
            SELECT l.* FROM mail.labels l
            JOIN mail.accounts a ON a.id = l.account_id
            WHERE a.user_id = $1
            ORDER BY l.name
            LIMIT 200
            "#,
        )
        .bind(claims.sub)
        .fetch_all(&state.pool)
        .await
    };

    Json(labels.unwrap_or_default())
}

/// Create a new mail label.
#[utoipa::path(
    post,
    path = "/api/v1/mail/labels",
    tag = "mail-labels",
    security(("bearerAuth" = [])),
    request_body = CreateLabelRequest,
    responses(
        (status = 201, description = "Label created", body = crate::models::MailLabel),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn create_label(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateLabelRequest>,
) -> impl IntoResponse {
    // Verify account ownership
    let account = match sqlx::query_as::<_, MailAccount>(
        "SELECT * FROM mail.accounts WHERE id = $1 AND user_id = $2",
    )
    .bind(payload.account_id)
    .bind(claims.sub)
    .fetch_optional(&state.pool)
    .await
    {
        Ok(v) => v,
        Err(e) => {
            tracing::error!("Failed to verify account ownership: {:?}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response();
        },
    };

    if account.is_none() {
        return (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Account not found" })),
        )
            .into_response();
    }

    if payload.name.trim().is_empty() || payload.name.len() > 50 {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "Label name must be 1-50 characters" })),
        )
            .into_response();
    }

    let label = sqlx::query_as::<_, MailLabel>(
        "INSERT INTO mail.labels (account_id, name, color) VALUES ($1, $2, $3) RETURNING *",
    )
    .bind(payload.account_id)
    .bind(&payload.name)
    .bind(&payload.color)
    .fetch_one(&state.pool)
    .await;

    match label {
        Ok(l) => (StatusCode::CREATED, Json(l)).into_response(),
        Err(e) => {
            tracing::error!("Failed to create label: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Failed to create label" })),
            )
                .into_response()
        },
    }
}

/// Update a mail label.
#[utoipa::path(
    patch,
    path = "/api/v1/mail/labels/{id}",
    tag = "mail-labels",
    security(("bearerAuth" = [])),
    params(("id" = uuid::Uuid, Path, description = "Label UUID")),
    request_body = UpdateLabelRequest,
    responses(
        (status = 200, description = "Label updated", body = crate::models::MailLabel),
        (status = 404, description = "Label not found"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn update_label(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateLabelRequest>,
) -> impl IntoResponse {
    let label = sqlx::query_as::<_, MailLabel>(
        r#"
        UPDATE mail.labels SET
            name = COALESCE($1, name),
            color = COALESCE($2, color)
        WHERE id = $3 AND account_id IN (
            SELECT id FROM mail.accounts WHERE user_id = $4
        )
        RETURNING *
        "#,
    )
    .bind(&payload.name)
    .bind(&payload.color)
    .bind(id)
    .bind(claims.sub)
    .fetch_optional(&state.pool)
    .await;

    match label {
        Ok(Some(l)) => Json(l).into_response(),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Label not found" })),
        )
            .into_response(),
        Err(e) => {
            tracing::error!("Failed to update label: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Failed to update" })),
            )
                .into_response()
        },
    }
}

/// Delete a mail label.
#[utoipa::path(
    delete,
    path = "/api/v1/mail/labels/{id}",
    tag = "mail-labels",
    security(("bearerAuth" = [])),
    params(("id" = uuid::Uuid, Path, description = "Label UUID")),
    responses(
        (status = 204, description = "Label deleted"),
        (status = 404, description = "Label not found"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn delete_label(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let result = sqlx::query(
        r#"
        DELETE FROM mail.labels
        WHERE id = $1 AND account_id IN (
            SELECT id FROM mail.accounts WHERE user_id = $2
        )
        "#,
    )
    .bind(id)
    .bind(claims.sub)
    .execute(&state.pool)
    .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => StatusCode::NO_CONTENT.into_response(),
        Ok(_) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Label not found" })),
        )
            .into_response(),
        Err(e) => {
            tracing::error!("Failed to delete label: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Failed to delete" })),
            )
                .into_response()
        },
    }
}
