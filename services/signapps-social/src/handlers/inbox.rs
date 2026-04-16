use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use serde::Deserialize;
use signapps_common::Claims;
use uuid::Uuid;

use crate::{models::ReplyRequest, AppState};

#[derive(Debug, Deserialize)]
/// Query parameters for filtering results.
pub struct InboxQuery {
    pub unread_only: Option<bool>,
    pub account_id: Option<Uuid>,
    pub item_type: Option<String>,
}

#[utoipa::path(
    get,
    path = "/api/v1/social/inbox",
    responses(
        (status = 200, description = "List of inbox items"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Social Inbox"
)]
#[tracing::instrument(skip_all)]
pub async fn list_inbox(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<InboxQuery>,
) -> impl IntoResponse {
    // Join to accounts to ensure user ownership
    let unread_filter = q.unread_only.unwrap_or(false);

    match sqlx::query_as::<_, crate::models::InboxItem>(
        "SELECT i.id, i.account_id, i.platform_item_id, i.item_type,
                i.author_name, i.author_avatar, i.content, i.post_id,
                i.parent_id, i.is_read, i.sentiment, i.received_at, i.created_at
         FROM social.inbox i
         JOIN social.accounts a ON a.id = i.account_id
         WHERE a.user_id = $1
           AND ($2::uuid IS NULL OR i.account_id = $2)
           AND ($3::text IS NULL OR i.item_type = $3)
           AND (NOT $4 OR i.is_read = false)
         ORDER BY i.received_at DESC
         LIMIT 500",
    )
    .bind(claims.sub)
    .bind(q.account_id)
    .bind(q.item_type.as_deref())
    .bind(unread_filter)
    .fetch_all(&state.pool)
    .await
    {
        Ok(rows) => (StatusCode::OK, Json(serde_json::json!(rows))),
        Err(e) => {
            tracing::error!("list_inbox: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database error" })),
            )
        },
    }
}

#[utoipa::path(
    patch,
    path = "/api/v1/social/inbox/{id}/read",
    params(("id" = uuid::Uuid, Path, description = "Inbox item ID")),
    responses(
        (status = 200, description = "Item marked as read"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Inbox item not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Social Inbox"
)]
#[tracing::instrument(skip_all)]
pub async fn mark_read(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    match sqlx::query(
        "UPDATE social.inbox i SET is_read = true
         FROM social.accounts a
         WHERE i.id = $1 AND i.account_id = a.id AND a.user_id = $2",
    )
    .bind(id)
    .bind(claims.sub)
    .execute(&state.pool)
    .await
    {
        Ok(r) if r.rows_affected() > 0 => (
            StatusCode::OK,
            Json(serde_json::json!({ "message": "Marked as read" })),
        ),
        Ok(_) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Item not found" })),
        ),
        Err(e) => {
            tracing::error!("mark_read: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database error" })),
            )
        },
    }
}

#[utoipa::path(
    post,
    path = "/api/v1/social/inbox/{id}/reply",
    params(("id" = uuid::Uuid, Path, description = "Inbox item ID")),
    request_body = crate::models::ReplyRequest,
    responses(
        (status = 200, description = "Reply sent"),
        (status = 400, description = "Invalid input"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Inbox item not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Social Inbox"
)]
#[tracing::instrument(skip_all)]
pub async fn reply_inbox(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<ReplyRequest>,
) -> impl IntoResponse {
    // Fetch the item and its account to get platform credentials
    let row = sqlx::query(
        "SELECT i.platform_item_id, i.item_type, a.platform, a.access_token,
                a.platform_config
         FROM social.inbox i
         JOIN social.accounts a ON a.id = i.account_id
         WHERE i.id = $1 AND a.user_id = $2",
    )
    .bind(id)
    .bind(claims.sub)
    .fetch_optional(&state.pool)
    .await;

    match row {
        Ok(Some(r)) => {
            use sqlx::Row;
            let platform: String = r.get("platform");
            let platform_item_id: Option<String> = r.get("platform_item_id");
            let access_token: Option<String> = r.get("access_token");
            let platform_config: serde_json::Value = r.get("platform_config");

            if let (Some(item_id), Some(token)) = (platform_item_id, access_token) {
                let reply_result = match platform.as_str() {
                    "mastodon" => {
                        let instance = platform_config["instance_url"]
                            .as_str()
                            .unwrap_or("https://mastodon.social")
                            .to_string();
                        let client =
                            crate::platforms::mastodon::MastodonClient::new(instance, token);
                        use crate::platforms::SocialPlatform;
                        client.reply(&item_id, &payload.content).await
                    },
                    "bluesky" => {
                        let pds = platform_config["pds_url"]
                            .as_str()
                            .unwrap_or("https://bsky.social")
                            .to_string();
                        let did = platform_config["did"].as_str().unwrap_or("").to_string();
                        let client = crate::platforms::bluesky::BlueskyClient::new(pds, did, token);
                        use crate::platforms::SocialPlatform;
                        client.reply(&item_id, &payload.content).await
                    },
                    "twitter" => {
                        let client = crate::platforms::twitter::TwitterClient {
                            access_token: token,
                        };
                        use crate::platforms::SocialPlatform;
                        client.reply(&item_id, &payload.content).await
                    },
                    "facebook" => {
                        let page_id = platform_config["page_id"]
                            .as_str()
                            .unwrap_or("")
                            .to_string();
                        let client = crate::platforms::facebook::FacebookClient {
                            access_token: token,
                            page_id,
                        };
                        use crate::platforms::SocialPlatform;
                        client.reply(&item_id, &payload.content).await
                    },
                    "linkedin" => {
                        let author_urn = platform_config["author_urn"]
                            .as_str()
                            .unwrap_or("")
                            .to_string();
                        let client = crate::platforms::linkedin::LinkedinClient {
                            access_token: token,
                            author_urn,
                        };
                        use crate::platforms::SocialPlatform;
                        client.reply(&item_id, &payload.content).await
                    },
                    _ => {
                        return (
                            StatusCode::NOT_IMPLEMENTED,
                            Json(serde_json::json!({
                                "error": format!("Reply not supported for platform: {}", platform)
                            })),
                        )
                    },
                };

                match reply_result {
                    Ok(_) => (
                        StatusCode::OK,
                        Json(serde_json::json!({ "message": "Reply sent" })),
                    ),
                    Err(e) => (
                        StatusCode::BAD_GATEWAY,
                        Json(serde_json::json!({ "error": e.to_string() })),
                    ),
                }
            } else {
                (
                    StatusCode::UNPROCESSABLE_ENTITY,
                    Json(serde_json::json!({ "error": "Missing platform credentials" })),
                )
            }
        },
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Inbox item not found" })),
        ),
        Err(e) => {
            tracing::error!("reply_inbox: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database error" })),
            )
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
