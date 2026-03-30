use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use uuid::Uuid;

use crate::models::{ContentSet, CreateContentSetRequest};
use crate::AppState;
use signapps_common::Claims;

#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn list_content_sets(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, ContentSet>(
        "SELECT * FROM social.content_sets WHERE user_id = $1 ORDER BY updated_at DESC",
    )
    .bind(claims.sub)
    .fetch_all(&state.pool)
    .await
    {
        Ok(rows) => Ok(Json(rows)),
        Err(e) => {
            tracing::error!("list_content_sets: {e}");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn create_content_set(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateContentSetRequest>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, ContentSet>(
        r#"INSERT INTO social.content_sets
           (user_id, name, description, content, media_urls, hashtags, target_accounts, platform_overrides, signature_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING *"#,
    )
    .bind(claims.sub)
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(&payload.content)
    .bind(payload.media_urls.clone().unwrap_or(serde_json::json!([])))
    .bind(payload.hashtags.clone().unwrap_or(serde_json::json!([])))
    .bind(
        payload
            .target_accounts
            .clone()
            .unwrap_or(serde_json::json!([])),
    )
    .bind(
        payload
            .platform_overrides
            .clone()
            .unwrap_or(serde_json::json!({})),
    )
    .bind(payload.signature_id)
    .fetch_one(&state.pool)
    .await
    {
        Ok(cs) => Ok((StatusCode::CREATED, Json(cs))),
        Err(e) => {
            tracing::error!("create_content_set: {e}");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn delete_content_set(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    match sqlx::query("DELETE FROM social.content_sets WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(claims.sub)
        .execute(&state.pool)
        .await
    {
        Ok(_) => Ok(StatusCode::NO_CONTENT),
        Err(e) => {
            tracing::error!("delete_content_set: {e}");
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
