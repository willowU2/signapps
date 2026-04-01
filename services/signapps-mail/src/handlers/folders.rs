use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use serde::Deserialize;
use signapps_common::Claims;
use uuid::Uuid;

use crate::models::MailFolder;
use crate::AppState;

#[derive(Debug, Deserialize)]
/// Query parameters for filtering and pagination.
pub struct FolderQuery {
    pub account_id: Option<Uuid>,
}

/// List IMAP folders for the current user's accounts.
#[utoipa::path(
    get,
    path = "/api/v1/mail/folders",
    tag = "mail-folders",
    security(("bearerAuth" = [])),
    params(("account_id" = Option<uuid::Uuid>, Query, description = "Filter by account")),
    responses(
        (status = 200, description = "List of folders", body = Vec<crate::models::MailFolder>),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn list_folders(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<FolderQuery>,
) -> impl IntoResponse {
    let folders = if let Some(account_id) = query.account_id {
        sqlx::query_as::<_, MailFolder>(
            r#"
            SELECT f.* FROM mail.folders f
            JOIN mail.accounts a ON a.id = f.account_id
            WHERE f.account_id = $1 AND a.user_id = $2
            ORDER BY f.folder_type, f.name
            LIMIT 500
            "#,
        )
        .bind(account_id)
        .bind(claims.sub)
        .fetch_all(&state.pool)
        .await
    } else {
        sqlx::query_as::<_, MailFolder>(
            r#"
            SELECT f.* FROM mail.folders f
            JOIN mail.accounts a ON a.id = f.account_id
            WHERE a.user_id = $1
            ORDER BY a.email_address, f.folder_type, f.name
            LIMIT 500
            "#,
        )
        .bind(claims.sub)
        .fetch_all(&state.pool)
        .await
    };

    Json(folders.unwrap_or_default())
}

/// Get a mail folder by ID.
#[utoipa::path(
    get,
    path = "/api/v1/mail/folders/{id}",
    tag = "mail-folders",
    security(("bearerAuth" = [])),
    params(("id" = uuid::Uuid, Path, description = "Folder UUID")),
    responses(
        (status = 200, description = "Folder details", body = crate::models::MailFolder),
        (status = 404, description = "Folder not found"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn get_folder(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let folder = match sqlx::query_as::<_, MailFolder>(
        r#"
        SELECT f.* FROM mail.folders f
        JOIN mail.accounts a ON a.id = f.account_id
        WHERE f.id = $1 AND a.user_id = $2
        "#,
    )
    .bind(id)
    .bind(claims.sub)
    .fetch_optional(&state.pool)
    .await
    {
        Ok(v) => v,
        Err(e) => {
            tracing::error!("Failed to fetch folder: {:?}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response();
        },
    };

    match folder {
        Some(f) => Json(f).into_response(),
        None => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Folder not found" })),
        )
            .into_response(),
    }
}
