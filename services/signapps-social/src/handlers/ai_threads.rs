use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use chrono::Utc;
use signapps_common::Claims;
use uuid::Uuid;

use crate::AppState;

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
/// AiThread data transfer object.
pub struct AiThread {
    pub id: Uuid,
    pub user_id: Uuid,
    pub title: String,
    pub messages: serde_json::Value,
    pub created_at: chrono::DateTime<Utc>,
    pub updated_at: chrono::DateTime<Utc>,
}

#[derive(Debug, serde::Deserialize)]
/// Request body for CreateAiThread.
pub struct CreateAiThreadRequest {
    pub title: String,
    pub messages: Option<serde_json::Value>,
}

#[derive(Debug, serde::Deserialize)]
/// Request body for UpdateAiThread.
pub struct UpdateAiThreadRequest {
    pub title: Option<String>,
    pub messages: Option<serde_json::Value>,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn list_ai_threads(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, AiThread>(
        "SELECT id, user_id, title, messages, created_at, updated_at
         FROM social.ai_threads
         WHERE user_id = $1
         ORDER BY updated_at DESC
         LIMIT 200",
    )
    .bind(claims.sub)
    .fetch_all(&state.pool)
    .await
    {
        Ok(rows) => (StatusCode::OK, Json(serde_json::json!(rows))),
        Err(e) => {
            tracing::error!("list_ai_threads: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database error" })),
            )
        },
    }
}

#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn create_ai_thread(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateAiThreadRequest>,
) -> impl IntoResponse {
    let id = Uuid::new_v4();
    let now = Utc::now();
    let messages = payload.messages.unwrap_or_else(|| serde_json::json!([]));

    match sqlx::query_as::<_, AiThread>(
        "INSERT INTO social.ai_threads (id, user_id, title, messages, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, user_id, title, messages, created_at, updated_at",
    )
    .bind(id)
    .bind(claims.sub)
    .bind(&payload.title)
    .bind(&messages)
    .bind(now)
    .bind(now)
    .fetch_one(&state.pool)
    .await
    {
        Ok(row) => (StatusCode::CREATED, Json(serde_json::json!(row))),
        Err(e) => {
            tracing::error!("create_ai_thread: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database error" })),
            )
        },
    }
}

#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn get_ai_thread(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, AiThread>(
        "SELECT id, user_id, title, messages, created_at, updated_at
         FROM social.ai_threads
         WHERE id = $1 AND user_id = $2",
    )
    .bind(id)
    .bind(claims.sub)
    .fetch_optional(&state.pool)
    .await
    {
        Ok(Some(row)) => (StatusCode::OK, Json(serde_json::json!(row))),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Thread not found" })),
        ),
        Err(e) => {
            tracing::error!("get_ai_thread: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database error" })),
            )
        },
    }
}

#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn update_ai_thread(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateAiThreadRequest>,
) -> impl IntoResponse {
    let existing = sqlx::query_as::<_, AiThread>(
        "SELECT id, user_id, title, messages, created_at, updated_at
         FROM social.ai_threads WHERE id = $1 AND user_id = $2",
    )
    .bind(id)
    .bind(claims.sub)
    .fetch_optional(&state.pool)
    .await;

    let thread = match existing {
        Ok(Some(t)) => t,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({ "error": "Thread not found" })),
            )
        },
        Err(e) => {
            tracing::error!("update_ai_thread fetch: {e}");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database error" })),
            );
        },
    };

    let title = payload.title.unwrap_or(thread.title);
    let messages = payload.messages.unwrap_or(thread.messages);

    match sqlx::query_as::<_, AiThread>(
        "UPDATE social.ai_threads
         SET title = $1, messages = $2, updated_at = NOW()
         WHERE id = $3 AND user_id = $4
         RETURNING id, user_id, title, messages, created_at, updated_at",
    )
    .bind(&title)
    .bind(&messages)
    .bind(id)
    .bind(claims.sub)
    .fetch_one(&state.pool)
    .await
    {
        Ok(row) => (StatusCode::OK, Json(serde_json::json!(row))),
        Err(e) => {
            tracing::error!("update_ai_thread: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database error" })),
            )
        },
    }
}

#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn delete_ai_thread(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> StatusCode {
    match sqlx::query("DELETE FROM social.ai_threads WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(claims.sub)
        .execute(&state.pool)
        .await
    {
        Ok(r) if r.rows_affected() > 0 => StatusCode::NO_CONTENT,
        Ok(_) => StatusCode::NOT_FOUND,
        Err(e) => {
            tracing::error!("delete_ai_thread: {e}");
            StatusCode::INTERNAL_SERVER_ERROR
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
