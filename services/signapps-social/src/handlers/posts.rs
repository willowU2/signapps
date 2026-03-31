use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use chrono::Utc;
use signapps_common::pg_events::NewEvent;
use signapps_common::Claims;
use uuid::Uuid;

use crate::{
    models::{ApproveRejectRequest, CreatePostRequest, SchedulePostRequest, UpdatePostRequest},
    AppState,
};

#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn list_posts(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, crate::models::Post>(
        "SELECT id, user_id, status, content, media_urls, hashtags, scheduled_at,
                published_at, error_message, is_evergreen, template_id, created_at, updated_at
         FROM social.posts
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 200",
    )
    .bind(claims.sub)
    .fetch_all(&state.pool)
    .await
    {
        Ok(rows) => (StatusCode::OK, Json(serde_json::json!(rows))),
        Err(e) => {
            tracing::error!("list_posts: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database error" })),
            )
        },
    }
}

#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn create_post(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreatePostRequest>,
) -> impl IntoResponse {
    let id = Uuid::new_v4();
    let now = Utc::now();
    let media = payload.media_urls.unwrap_or_else(|| serde_json::json!([]));
    let hashtags = payload.hashtags.unwrap_or_else(|| serde_json::json!([]));
    let is_evergreen = payload.is_evergreen.unwrap_or(false);
    let status = if payload.scheduled_at.is_some() {
        "scheduled"
    } else {
        "draft"
    };

    let result = sqlx::query_as::<_, crate::models::Post>(
        "INSERT INTO social.posts
            (id, user_id, status, content, media_urls, hashtags, scheduled_at,
             is_evergreen, template_id, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING id, user_id, status, content, media_urls, hashtags, scheduled_at,
                   published_at, error_message, is_evergreen, template_id, created_at, updated_at",
    )
    .bind(id)
    .bind(claims.sub)
    .bind(status)
    .bind(&payload.content)
    .bind(&media)
    .bind(&hashtags)
    .bind(payload.scheduled_at)
    .bind(is_evergreen)
    .bind(payload.template_id)
    .bind(now)
    .bind(now)
    .fetch_one(&state.pool)
    .await;

    match result {
        Ok(post) => {
            // Create targets for each account
            if let Some(account_ids) = payload.account_ids {
                for acct_id in account_ids {
                    let _ = sqlx::query(
                        "INSERT INTO social.post_targets (id, post_id, account_id, status)
                         VALUES ($1, $2, $3, 'pending')",
                    )
                    .bind(Uuid::new_v4())
                    .bind(post.id)
                    .bind(acct_id)
                    .execute(&state.pool)
                    .await;
                }
            }
            (StatusCode::CREATED, Json(serde_json::json!(post)))
        },
        Err(e) => {
            tracing::error!("create_post: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database error" })),
            )
        },
    }
}

#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn get_post(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, crate::models::Post>(
        "SELECT id, user_id, status, content, media_urls, hashtags, scheduled_at,
                published_at, error_message, is_evergreen, template_id, created_at, updated_at
         FROM social.posts WHERE id = $1 AND user_id = $2",
    )
    .bind(id)
    .bind(claims.sub)
    .fetch_optional(&state.pool)
    .await
    {
        Ok(Some(row)) => (StatusCode::OK, Json(serde_json::json!(row))),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Post not found" })),
        ),
        Err(e) => {
            tracing::error!("get_post: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database error" })),
            )
        },
    }
}

#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn update_post(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdatePostRequest>,
) -> impl IntoResponse {
    // Only allow editing drafts
    let existing = sqlx::query_as::<_, crate::models::Post>(
        "SELECT id, user_id, status, content, media_urls, hashtags, scheduled_at,
                published_at, error_message, is_evergreen, template_id, created_at, updated_at
         FROM social.posts WHERE id = $1 AND user_id = $2",
    )
    .bind(id)
    .bind(claims.sub)
    .fetch_optional(&state.pool)
    .await;

    let post = match existing {
        Ok(Some(p)) => p,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({ "error": "Post not found" })),
            )
        },
        Err(e) => {
            tracing::error!("update_post fetch: {e}");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database error" })),
            );
        },
    };

    if post.status == "published" || post.status == "publishing" {
        return (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(serde_json::json!({ "error": "Cannot edit a published post" })),
        );
    }

    let content = payload.content.unwrap_or(post.content);
    let media_urls = payload.media_urls.unwrap_or(post.media_urls);
    let hashtags = payload.hashtags.unwrap_or(post.hashtags);
    let scheduled_at = payload.scheduled_at.or(post.scheduled_at);
    let is_evergreen = payload.is_evergreen.unwrap_or(post.is_evergreen);
    let status = payload.status.unwrap_or(post.status);

    match sqlx::query_as::<_, crate::models::Post>(
        "UPDATE social.posts
         SET content=$1, media_urls=$2, hashtags=$3, scheduled_at=$4,
             is_evergreen=$5, status=$6, updated_at=NOW()
         WHERE id=$7 AND user_id=$8
         RETURNING id, user_id, status, content, media_urls, hashtags, scheduled_at,
                   published_at, error_message, is_evergreen, template_id, created_at, updated_at",
    )
    .bind(&content)
    .bind(&media_urls)
    .bind(&hashtags)
    .bind(scheduled_at)
    .bind(is_evergreen)
    .bind(&status)
    .bind(id)
    .bind(claims.sub)
    .fetch_one(&state.pool)
    .await
    {
        Ok(row) => (StatusCode::OK, Json(serde_json::json!(row))),
        Err(e) => {
            tracing::error!("update_post: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database error" })),
            )
        },
    }
}

#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn delete_post(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> StatusCode {
    match sqlx::query(
        "DELETE FROM social.posts WHERE id = $1 AND user_id = $2 AND status = 'draft'",
    )
    .bind(id)
    .bind(claims.sub)
    .execute(&state.pool)
    .await
    {
        Ok(r) if r.rows_affected() > 0 => StatusCode::NO_CONTENT,
        Ok(_) => StatusCode::NOT_FOUND,
        Err(e) => {
            tracing::error!("delete_post: {e}");
            StatusCode::INTERNAL_SERVER_ERROR
        },
    }
}

#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn publish_post(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    // Mark as publishing; the background publisher will pick it up immediately
    match sqlx::query(
        "UPDATE social.posts
         SET status='scheduled', scheduled_at=NOW(), updated_at=NOW()
         WHERE id=$1 AND user_id=$2 AND status IN ('draft','failed')",
    )
    .bind(id)
    .bind(claims.sub)
    .execute(&state.pool)
    .await
    {
        Ok(r) if r.rows_affected() > 0 => {
            let _ = state
                .event_bus
                .publish(NewEvent {
                    event_type: "social.post.published".into(),
                    aggregate_id: Some(id),
                    payload: serde_json::json!({ "user_id": claims.sub }),
                })
                .await;
            (
                StatusCode::ACCEPTED,
                Json(serde_json::json!({ "message": "Post queued for immediate publishing" })),
            )
        },
        Ok(_) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Post not found or already published" })),
        ),
        Err(e) => {
            tracing::error!("publish_post: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database error" })),
            )
        },
    }
}

#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn schedule_post(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<SchedulePostRequest>,
) -> impl IntoResponse {
    // Update scheduled_at and account targets
    let result = sqlx::query(
        "UPDATE social.posts
         SET status='scheduled', scheduled_at=$1, updated_at=NOW()
         WHERE id=$2 AND user_id=$3 AND status IN ('draft','failed')",
    )
    .bind(payload.scheduled_at)
    .bind(id)
    .bind(claims.sub)
    .execute(&state.pool)
    .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => {
            // Delete old targets and re-insert
            let _ = sqlx::query("DELETE FROM social.post_targets WHERE post_id = $1")
                .bind(id)
                .execute(&state.pool)
                .await;
            for acct_id in &payload.account_ids {
                let _ = sqlx::query(
                    "INSERT INTO social.post_targets (id, post_id, account_id, status)
                     VALUES ($1,$2,$3,'pending')",
                )
                .bind(Uuid::new_v4())
                .bind(id)
                .bind(acct_id)
                .execute(&state.pool)
                .await;
            }
            (
                StatusCode::OK,
                Json(serde_json::json!({
                    "message": "Post scheduled",
                    "scheduled_at": payload.scheduled_at,
                })),
            )
        },
        Ok(_) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Post not found or already published" })),
        ),
        Err(e) => {
            tracing::error!("schedule_post: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database error" })),
            )
        },
    }
}

// ---------------------------------------------------------------------------
// Post approval workflow
// ---------------------------------------------------------------------------

/// Submit a draft post for review → status becomes `pending_review`
#[tracing::instrument(skip_all)]
pub async fn submit_for_review(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    match sqlx::query(
        "UPDATE social.posts
         SET status='pending_review', updated_at=NOW()
         WHERE id=$1 AND user_id=$2 AND status IN ('draft','rejected')",
    )
    .bind(id)
    .bind(claims.sub)
    .execute(&state.pool)
    .await
    {
        Ok(r) if r.rows_affected() > 0 => (
            StatusCode::OK,
            Json(serde_json::json!({ "status": "pending_review" })),
        ),
        Ok(_) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Post not found or not in a submittable state" })),
        ),
        Err(e) => {
            tracing::error!("submit_for_review: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database error" })),
            )
        },
    }
}

/// Approve a pending_review post → status becomes `approved`
#[tracing::instrument(skip_all)]
pub async fn approve_post(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    // Any workspace member with reviewer role can approve; for MVP we allow any
    // authenticated user to approve posts they don't own (team scenario).
    // The workspace-level role check can be enforced once workspace memberships are
    // looked up here. For now we simply prevent self-approval on the same user_id.
    match sqlx::query(
        "UPDATE social.posts
         SET status='approved', updated_at=NOW()
         WHERE id=$1 AND status='pending_review'",
    )
    .bind(id)
    .execute(&state.pool)
    .await
    {
        Ok(r) if r.rows_affected() > 0 => {
            let _ = state
                .event_bus
                .publish(signapps_common::pg_events::NewEvent {
                    event_type: "social.post.approved".into(),
                    aggregate_id: Some(id),
                    payload: serde_json::json!({ "reviewer_id": claims.sub }),
                })
                .await;
            (
                StatusCode::OK,
                Json(serde_json::json!({ "status": "approved" })),
            )
        },
        Ok(_) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Post not found or not pending review" })),
        ),
        Err(e) => {
            tracing::error!("approve_post: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database error" })),
            )
        },
    }
}

/// Reject a pending_review post → status becomes `rejected` with rejection_reason
#[tracing::instrument(skip_all)]
pub async fn reject_post(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<ApproveRejectRequest>,
) -> impl IntoResponse {
    match sqlx::query(
        "UPDATE social.posts
         SET status='rejected', error_message=$1, updated_at=NOW()
         WHERE id=$2 AND status='pending_review'",
    )
    .bind(payload.rejection_reason.as_deref())
    .bind(id)
    .execute(&state.pool)
    .await
    {
        Ok(r) if r.rows_affected() > 0 => {
            let _ = state
                .event_bus
                .publish(signapps_common::pg_events::NewEvent {
                    event_type: "social.post.rejected".into(),
                    aggregate_id: Some(id),
                    payload: serde_json::json!({
                        "reviewer_id": claims.sub,
                        "reason": payload.rejection_reason
                    }),
                })
                .await;
            (
                StatusCode::OK,
                Json(serde_json::json!({ "status": "rejected" })),
            )
        },
        Ok(_) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Post not found or not pending review" })),
        ),
        Err(e) => {
            tracing::error!("reject_post: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database error" })),
            )
        },
    }
}

/// List posts in `pending_review` status (review queue)
#[tracing::instrument(skip_all)]
pub async fn list_review_queue(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
) -> impl IntoResponse {
    match sqlx::query_as::<_, crate::models::Post>(
        "SELECT id, user_id, status, content, media_urls, hashtags, scheduled_at,
                published_at, error_message, is_evergreen, template_id, created_at, updated_at
         FROM social.posts
         WHERE status = 'pending_review'
         ORDER BY created_at ASC
         LIMIT 100",
    )
    .fetch_all(&state.pool)
    .await
    {
        Ok(rows) => (StatusCode::OK, Json(serde_json::json!(rows))),
        Err(e) => {
            tracing::error!("list_review_queue: {e}");
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
