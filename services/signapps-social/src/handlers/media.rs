use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::models::{CreateMediaRequest, MediaItem};
use crate::AppState;
use signapps_common::Claims;

#[derive(Debug, Deserialize)]
/// Query parameters for filtering results.
pub struct MediaQuery {
    pub mime_type: Option<String>,
    pub sort: Option<String>,
}

#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/media",
    responses((status = 200, description = "Success")),
    tag = "Social"
)]
#[tracing::instrument(skip_all)]
pub async fn list_media(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<MediaQuery>,
) -> impl IntoResponse {
    let order = match query.sort.as_deref() {
        Some("oldest") => "created_at ASC",
        Some("name") => "filename ASC",
        Some("size") => "size_bytes DESC",
        _ => "created_at DESC",
    };

    let sql = if query.mime_type.is_some() {
        format!(
            "SELECT * FROM social.media WHERE user_id = $1 AND mime_type LIKE $2 ORDER BY {}",
            order
        )
    } else {
        format!(
            "SELECT * FROM social.media WHERE user_id = $1 ORDER BY {}",
            order
        )
    };

    let result = if let Some(ref mime) = query.mime_type {
        let pattern = format!("{}%", mime);
        sqlx::query_as::<_, MediaItem>(&sql)
            .bind(claims.sub)
            .bind(&pattern)
            .fetch_all(&state.pool)
            .await
    } else {
        sqlx::query_as::<_, MediaItem>(&sql)
            .bind(claims.sub)
            .fetch_all(&state.pool)
            .await
    };

    match result {
        Ok(rows) => Ok(Json(rows)),
        Err(e) => {
            tracing::error!("list_media: {e}");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

#[tracing::instrument(skip_all)]
#[utoipa::path(
    post,
    path = "/api/v1/media",
    responses((status = 201, description = "Success")),
    tag = "Social"
)]
#[tracing::instrument(skip_all)]
pub async fn create_media(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateMediaRequest>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, MediaItem>(
        r#"INSERT INTO social.media
           (user_id, filename, original_name, mime_type, size_bytes, url, thumbnail_url, width, height, tags)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING *"#,
    )
    .bind(claims.sub)
    .bind(&payload.filename)
    .bind(&payload.original_name)
    .bind(&payload.mime_type)
    .bind(payload.size_bytes.unwrap_or(0))
    .bind(&payload.url)
    .bind(&payload.thumbnail_url)
    .bind(payload.width)
    .bind(payload.height)
    .bind(payload.tags.clone().unwrap_or(serde_json::json!([])))
    .fetch_one(&state.pool)
    .await
    {
        Ok(item) => Ok((StatusCode::CREATED, Json(item))),
        Err(e) => {
            tracing::error!("create_media: {e}");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

#[tracing::instrument(skip_all)]
#[utoipa::path(
    delete,
    path = "/api/v1/media",
    responses((status = 204, description = "Success")),
    tag = "Social"
)]
#[tracing::instrument(skip_all)]
pub async fn delete_media(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    axum::extract::Path(id): axum::extract::Path<Uuid>,
) -> impl IntoResponse {
    match sqlx::query("DELETE FROM social.media WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(claims.sub)
        .execute(&state.pool)
        .await
    {
        Ok(_) => Ok(StatusCode::NO_CONTENT),
        Err(e) => {
            tracing::error!("delete_media: {e}");
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
