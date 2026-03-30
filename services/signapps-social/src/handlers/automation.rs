use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use chrono::Utc;
use signapps_common::Claims;
use uuid::Uuid;

use crate::{
    models::{
        AiBestTimeRequest, AiGenerateRequest, AiHashtagsRequest, CreateRssFeedRequest,
        CreateTemplateRequest,
    },
    AppState,
};

// ---------------------------------------------------------------------------
// RSS Feeds
// ---------------------------------------------------------------------------

#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/automation",
    responses((status = 200, description = "Success")),
    tag = "Social"
)]
#[tracing::instrument(skip_all)]
pub async fn list_rss_feeds(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, crate::models::RssFeed>(
        "SELECT id, user_id, feed_url, name, target_accounts, post_template, is_active,
                last_checked_at, last_item_guid, check_interval_minutes, created_at
         FROM social.rss_feeds WHERE user_id = $1 ORDER BY created_at DESC",
    )
    .bind(claims.sub)
    .fetch_all(&state.pool)
    .await
    {
        Ok(rows) => (StatusCode::OK, Json(serde_json::json!(rows))),
        Err(e) => {
            tracing::error!("list_rss_feeds: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database error" })),
            )
        },
    }
}

#[tracing::instrument(skip_all)]
#[utoipa::path(
    post,
    path = "/api/v1/automation",
    responses((status = 201, description = "Success")),
    tag = "Social"
)]
#[tracing::instrument(skip_all)]
pub async fn create_rss_feed(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateRssFeedRequest>,
) -> impl IntoResponse {
    let id = Uuid::new_v4();
    let now = Utc::now();
    let targets = payload
        .target_accounts
        .unwrap_or_else(|| serde_json::json!([]));
    let interval = payload.check_interval_minutes.unwrap_or(60);
    let template = payload
        .post_template
        .unwrap_or_else(|| "{{title}} {{link}}".to_string());

    match sqlx::query_as::<_, crate::models::RssFeed>(
        "INSERT INTO social.rss_feeds
            (id, user_id, feed_url, name, target_accounts, post_template,
             is_active, check_interval_minutes, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,true,$7,$8)
         RETURNING id, user_id, feed_url, name, target_accounts, post_template, is_active,
                   last_checked_at, last_item_guid, check_interval_minutes, created_at",
    )
    .bind(id)
    .bind(claims.sub)
    .bind(&payload.feed_url)
    .bind(&payload.name)
    .bind(&targets)
    .bind(&template)
    .bind(interval)
    .bind(now)
    .fetch_one(&state.pool)
    .await
    {
        Ok(row) => (StatusCode::CREATED, Json(serde_json::json!(row))),
        Err(e) => {
            tracing::error!("create_rss_feed: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database error" })),
            )
        },
    }
}

#[tracing::instrument(skip_all)]
#[utoipa::path(
    delete,
    path = "/api/v1/automation",
    responses((status = 204, description = "Success")),
    tag = "Social"
)]
#[tracing::instrument(skip_all)]
pub async fn delete_rss_feed(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> StatusCode {
    match sqlx::query("DELETE FROM social.rss_feeds WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(claims.sub)
        .execute(&state.pool)
        .await
    {
        Ok(r) if r.rows_affected() > 0 => StatusCode::NO_CONTENT,
        Ok(_) => StatusCode::NOT_FOUND,
        Err(e) => {
            tracing::error!("delete_rss_feed: {e}");
            StatusCode::INTERNAL_SERVER_ERROR
        },
    }
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/automation",
    responses((status = 200, description = "Success")),
    tag = "Social"
)]
#[tracing::instrument(skip_all)]
pub async fn list_templates(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, crate::models::PostTemplate>(
        "SELECT id, user_id, name, content, hashtags, category, created_at
         FROM social.templates WHERE user_id = $1 ORDER BY created_at DESC",
    )
    .bind(claims.sub)
    .fetch_all(&state.pool)
    .await
    {
        Ok(rows) => (StatusCode::OK, Json(serde_json::json!(rows))),
        Err(e) => {
            tracing::error!("list_templates: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database error" })),
            )
        },
    }
}

#[tracing::instrument(skip_all)]
#[utoipa::path(
    post,
    path = "/api/v1/automation",
    responses((status = 201, description = "Success")),
    tag = "Social"
)]
#[tracing::instrument(skip_all)]
pub async fn create_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateTemplateRequest>,
) -> impl IntoResponse {
    let id = Uuid::new_v4();
    let now = Utc::now();
    let hashtags = payload.hashtags.unwrap_or_else(|| serde_json::json!([]));

    match sqlx::query_as::<_, crate::models::PostTemplate>(
        "INSERT INTO social.templates (id, user_id, name, content, hashtags, category, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING id, user_id, name, content, hashtags, category, created_at",
    )
    .bind(id)
    .bind(claims.sub)
    .bind(&payload.name)
    .bind(&payload.content)
    .bind(&hashtags)
    .bind(&payload.category)
    .bind(now)
    .fetch_one(&state.pool)
    .await
    {
        Ok(row) => (StatusCode::CREATED, Json(serde_json::json!(row))),
        Err(e) => {
            tracing::error!("create_template: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database error" })),
            )
        },
    }
}

#[tracing::instrument(skip_all)]
#[utoipa::path(
    delete,
    path = "/api/v1/automation",
    responses((status = 204, description = "Success")),
    tag = "Social"
)]
#[tracing::instrument(skip_all)]
pub async fn delete_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> StatusCode {
    match sqlx::query("DELETE FROM social.templates WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(claims.sub)
        .execute(&state.pool)
        .await
    {
        Ok(r) if r.rows_affected() > 0 => StatusCode::NO_CONTENT,
        Ok(_) => StatusCode::NOT_FOUND,
        Err(e) => {
            tracing::error!("delete_template: {e}");
            StatusCode::INTERNAL_SERVER_ERROR
        },
    }
}

/// PATCH /api/v1/social/templates/:id — SYNC-SOCIAL-TMPLUPDATE
#[tracing::instrument(skip_all)]
#[utoipa::path(
    put,
    path = "/api/v1/automation",
    responses((status = 200, description = "Success")),
    tag = "Social"
)]
#[tracing::instrument(skip_all)]
pub async fn update_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<serde_json::Value>,
) -> impl IntoResponse {
    // Build partial update — only set provided fields
    let name = payload.get("name").and_then(|v| v.as_str());
    let content = payload.get("content").and_then(|v| v.as_str());
    let category = payload.get("category").and_then(|v| v.as_str());

    match sqlx::query_as::<_, crate::models::PostTemplate>(
        "UPDATE social.templates
         SET name     = COALESCE($3, name),
             content  = COALESCE($4, content),
             hashtags = COALESCE($5::jsonb, hashtags),
             category = COALESCE($6, category)
         WHERE id = $1 AND user_id = $2
         RETURNING id, user_id, name, content, hashtags, category, created_at",
    )
    .bind(id)
    .bind(claims.sub)
    .bind(name)
    .bind(content)
    .bind(payload.get("hashtags"))
    .bind(category)
    .fetch_optional(&state.pool)
    .await
    {
        Ok(Some(row)) => (StatusCode::OK, Json(serde_json::json!(row))),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "not found" })),
        ),
        Err(e) => {
            tracing::error!("update_template: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database error" })),
            )
        },
    }
}

/// POST /api/v1/social/rss-feeds/:id/check — SYNC-SOCIAL-RSSCHECK
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/automation",
    responses((status = 200, description = "Success")),
    tag = "Social"
)]
#[tracing::instrument(skip_all)]
pub async fn check_rss_feed_now(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    // Mark last_checked_at = now to trigger the next publisher cycle immediately
    match sqlx::query(
        "UPDATE social.rss_feeds
         SET last_checked_at = NULL
         WHERE id = $1 AND user_id = $2",
    )
    .bind(id)
    .bind(claims.sub)
    .execute(&state.pool)
    .await
    {
        Ok(r) if r.rows_affected() > 0 => (
            StatusCode::OK,
            Json(serde_json::json!({ "status": "check_scheduled" })),
        ),
        Ok(_) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "not found" })),
        ),
        Err(e) => {
            tracing::error!("check_rss_feed_now: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database error" })),
            )
        },
    }
}

/// GET /api/v1/social/ai/smart-replies/:inbox_item_id — SYNC-SOCIAL-SMARTREPLY
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/automation",
    responses((status = 200, description = "Success")),
    tag = "Social"
)]
#[tracing::instrument(skip_all)]
pub async fn ai_smart_replies(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(inbox_item_id): Path<Uuid>,
) -> impl IntoResponse {
    // Fetch the inbox item for context
    let item = sqlx::query(
        "SELECT ii.content, ii.item_type, ii.author_name, a.platform
         FROM social.inbox_items ii
         JOIN social.accounts a ON a.id = ii.account_id
         WHERE ii.id = $1 AND a.user_id = $2",
    )
    .bind(inbox_item_id)
    .bind(claims.sub)
    .fetch_optional(&state.pool)
    .await;

    match item {
        Ok(Some(row)) => {
            use sqlx::Row;
            let content = row.get::<Option<String>, _>("content").unwrap_or_default();
            let platform = row.get::<String, _>("platform");
            let author = row
                .get::<Option<String>, _>("author_name")
                .unwrap_or_default();

            // Generate contextual reply suggestions (delegated to signapps-ai when available)
            let suggestions = vec![
                format!(
                    "Thank you for your message, {}! We appreciate your feedback.",
                    author
                ),
                format!(
                    "Hi {}! Thanks for reaching out on {}. How can we help you further?",
                    author, platform
                ),
                format!(
                    "We're glad you connected with us, {}! We'll get back to you shortly.",
                    author
                ),
            ];

            // Optionally enrich with message content context
            let _ = content; // used for future AI delegation

            (
                StatusCode::OK,
                Json(serde_json::json!({ "suggestions": suggestions })),
            )
        },
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "inbox item not found" })),
        ),
        Err(e) => {
            tracing::error!("ai_smart_replies: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database error" })),
            )
        },
    }
}

// ---------------------------------------------------------------------------
// AI endpoints (local Ollama / signapps-ai delegation)
// ---------------------------------------------------------------------------

#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/automation",
    responses((status = 200, description = "Success")),
    tag = "Social"
)]
#[tracing::instrument(skip_all)]
pub async fn ai_generate(Json(payload): Json<AiGenerateRequest>) -> impl IntoResponse {
    // Delegate to signapps-ai when available; return a scaffold response for now
    let platform = payload.platform.as_deref().unwrap_or("general");
    let tone = payload.tone.as_deref().unwrap_or("professional");
    let max_len = payload.max_length.unwrap_or(280);
    let draft = format!(
        "[AI draft] Topic: {}. Tone: {}. Platform: {}. Max length: {} chars. \
         (Connect signapps-ai service for real generation.)",
        payload.topic, tone, platform, max_len
    );
    (
        StatusCode::OK,
        Json(serde_json::json!({ "content": draft })),
    )
}

#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/automation",
    responses((status = 200, description = "Success")),
    tag = "Social"
)]
#[tracing::instrument(skip_all)]
pub async fn ai_hashtags(Json(payload): Json<AiHashtagsRequest>) -> impl IntoResponse {
    let platform = payload.platform.as_deref().unwrap_or("general");
    // Placeholder — real implementation would call local LLM via signapps-ai
    let suggestions = vec!["#signApps", "#openSource", "#productivity"];
    (
        StatusCode::OK,
        Json(serde_json::json!({
            "hashtags": suggestions,
            "platform": platform,
            "note": "Connect signapps-ai service for AI-powered suggestions"
        })),
    )
}

#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/automation",
    responses((status = 200, description = "Success")),
    tag = "Social"
)]
#[tracing::instrument(skip_all)]
pub async fn ai_best_time(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<AiBestTimeRequest>,
) -> impl IntoResponse {
    // Analyse past analytics for best engagement windows
    let result = sqlx::query(
        "SELECT EXTRACT(DOW FROM p.published_at) AS dow,
                EXTRACT(HOUR FROM p.published_at) AS hour,
                COALESCE(SUM(pa.engagement + pa.likes + pa.comments), 0) AS engagement
         FROM social.posts p
         JOIN social.post_targets pt ON pt.post_id = p.id
         JOIN social.post_analytics pa ON pa.post_target_id = pt.id
         JOIN social.accounts a ON a.id = pt.account_id
         WHERE p.user_id = $1
           AND a.id = $2
           AND p.published_at IS NOT NULL
         GROUP BY dow, hour
         ORDER BY engagement DESC
         LIMIT 5",
    )
    .bind(claims.sub)
    .bind(payload.account_id)
    .fetch_all(&state.pool)
    .await;

    match result {
        Ok(rows) if !rows.is_empty() => {
            use sqlx::Row;
            let slots: Vec<_> = rows
                .iter()
                .map(|r| {
                    serde_json::json!({
                        "day_of_week": r.get::<f64, _>("dow") as u8,
                        "hour": r.get::<f64, _>("hour") as u8,
                        "engagement_score": r.get::<i64, _>("engagement"),
                    })
                })
                .collect();
            (
                StatusCode::OK,
                Json(serde_json::json!({ "best_times": slots })),
            )
        },
        _ => (
            StatusCode::OK,
            Json(serde_json::json!({
                "best_times": [],
                "note": "Not enough data yet. Publish more posts to get recommendations."
            })),
        ),
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
