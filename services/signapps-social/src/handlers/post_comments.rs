use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use uuid::Uuid;

use crate::models::{CreatePostCommentRequest, PostComment};
use crate::AppState;
use signapps_common::Claims;

#[utoipa::path(
    get,
    path = "/api/v1/social/posts/{id}/comments",
    params(("id" = uuid::Uuid, Path, description = "Post ID")),
    responses(
        (status = 200, description = "List of post comments"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Social Post Comments"
)]
#[tracing::instrument(skip_all)]
pub async fn list_comments(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(post_id): Path<Uuid>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, PostComment>(
        "SELECT * FROM social.post_comments WHERE post_id = $1 ORDER BY created_at ASC",
    )
    .bind(post_id)
    .fetch_all(&state.pool)
    .await
    {
        Ok(rows) => Ok(Json(rows)),
        Err(e) => {
            tracing::error!("list_comments: {e}");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

#[utoipa::path(
    post,
    path = "/api/v1/social/posts/{id}/comments",
    params(("id" = uuid::Uuid, Path, description = "Post ID")),
    request_body = crate::models::CreatePostCommentRequest,
    responses(
        (status = 201, description = "Comment created", body = crate::models::PostComment),
        (status = 400, description = "Invalid input"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Social Post Comments"
)]
#[tracing::instrument(skip_all)]
pub async fn create_comment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(post_id): Path<Uuid>,
    Json(payload): Json<CreatePostCommentRequest>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, PostComment>(
        r#"INSERT INTO social.post_comments (post_id, user_id, content, parent_comment_id)
           VALUES ($1, $2, $3, $4)
           RETURNING *"#,
    )
    .bind(post_id)
    .bind(claims.sub)
    .bind(&payload.content)
    .bind(payload.parent_comment_id)
    .fetch_one(&state.pool)
    .await
    {
        Ok(comment) => Ok((StatusCode::CREATED, Json(comment))),
        Err(e) => {
            tracing::error!("create_comment: {e}");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

#[utoipa::path(
    delete,
    path = "/api/v1/social/posts/{post_id}/comments/{id}",
    params(
        ("post_id" = uuid::Uuid, Path, description = "Post ID"),
        ("id" = uuid::Uuid, Path, description = "Comment ID")
    ),
    responses(
        (status = 204, description = "Comment deleted"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Comment not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Social Post Comments"
)]
#[tracing::instrument(skip_all)]
pub async fn delete_comment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((_post_id, comment_id)): Path<(Uuid, Uuid)>,
) -> impl IntoResponse {
    match sqlx::query("DELETE FROM social.post_comments WHERE id = $1 AND user_id = $2")
        .bind(comment_id)
        .bind(claims.sub)
        .execute(&state.pool)
        .await
    {
        Ok(_) => Ok(StatusCode::NO_CONTENT),
        Err(e) => {
            tracing::error!("delete_comment: {e}");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
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
