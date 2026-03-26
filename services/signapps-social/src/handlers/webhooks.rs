use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use uuid::Uuid;

use crate::models::{CreateWebhookRequest, UpdateWebhookRequest, Webhook};
use crate::AppState;
use signapps_common::Claims;

pub async fn list_webhooks(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, Webhook>(
        "SELECT * FROM social.webhooks WHERE user_id = $1 ORDER BY created_at DESC",
    )
    .bind(claims.sub)
    .fetch_all(&state.pool)
    .await
    {
        Ok(rows) => Ok(Json(rows)),
        Err(e) => {
            tracing::error!("list_webhooks: {e}");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

pub async fn create_webhook(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateWebhookRequest>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, Webhook>(
        r#"INSERT INTO social.webhooks
           (user_id, name, url, events, account_filter, secret)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *"#,
    )
    .bind(claims.sub)
    .bind(&payload.name)
    .bind(&payload.url)
    .bind(
        payload
            .events
            .unwrap_or(serde_json::json!(["post.published"])),
    )
    .bind(payload.account_filter)
    .bind(&payload.secret)
    .fetch_one(&state.pool)
    .await
    {
        Ok(wh) => Ok((StatusCode::CREATED, Json(wh))),
        Err(e) => {
            tracing::error!("create_webhook: {e}");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

pub async fn update_webhook(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateWebhookRequest>,
) -> impl IntoResponse {
    let existing = sqlx::query_as::<_, Webhook>(
        "SELECT * FROM social.webhooks WHERE id = $1 AND user_id = $2",
    )
    .bind(id)
    .bind(claims.sub)
    .fetch_optional(&state.pool)
    .await;

    let wh = match existing {
        Ok(Some(w)) => w,
        Ok(None) => return Err(StatusCode::NOT_FOUND),
        Err(e) => {
            tracing::error!("update_webhook fetch: {e}");
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        },
    };

    match sqlx::query_as::<_, Webhook>(
        r#"UPDATE social.webhooks
           SET name = $1, url = $2, events = $3, account_filter = $4, is_active = $5
           WHERE id = $6 AND user_id = $7
           RETURNING *"#,
    )
    .bind(payload.name.unwrap_or(wh.name))
    .bind(payload.url.unwrap_or(wh.url))
    .bind(payload.events.unwrap_or(wh.events))
    .bind(payload.account_filter.or(wh.account_filter))
    .bind(payload.is_active.unwrap_or(wh.is_active))
    .bind(id)
    .bind(claims.sub)
    .fetch_one(&state.pool)
    .await
    {
        Ok(row) => Ok(Json(row)),
        Err(e) => {
            tracing::error!("update_webhook: {e}");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

pub async fn delete_webhook(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    match sqlx::query("DELETE FROM social.webhooks WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(claims.sub)
        .execute(&state.pool)
        .await
    {
        Ok(_) => Ok(StatusCode::NO_CONTENT),
        Err(e) => {
            tracing::error!("delete_webhook: {e}");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

pub async fn test_webhook(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let existing = sqlx::query_as::<_, Webhook>(
        "SELECT * FROM social.webhooks WHERE id = $1 AND user_id = $2",
    )
    .bind(id)
    .bind(claims.sub)
    .fetch_optional(&state.pool)
    .await;

    let wh = match existing {
        Ok(Some(w)) => w,
        Ok(None) => return Err(StatusCode::NOT_FOUND),
        Err(e) => {
            tracing::error!("test_webhook fetch: {e}");
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        },
    };

    let payload = serde_json::json!({
        "event": "test",
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "data": { "message": "Test webhook from SignSocial" }
    });

    let client = reqwest::Client::new();
    let resp = client.post(&wh.url).json(&payload).send().await;

    let (status_code, success) = match resp {
        Ok(r) => (r.status().as_u16() as i32, r.status().is_success()),
        Err(_) => (0, false),
    };

    sqlx::query(
        "UPDATE social.webhooks SET last_triggered_at = NOW(), last_status_code = $1 WHERE id = $2",
    )
    .bind(status_code)
    .bind(id)
    .execute(&state.pool)
    .await
    .ok();

    Ok(Json(serde_json::json!({
        "success": success,
        "status_code": status_code
    })))
}
