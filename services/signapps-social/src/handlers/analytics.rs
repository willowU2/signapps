use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use serde::Deserialize;
use signapps_common::Claims;
use uuid::Uuid;

use crate::AppState;

#[derive(Debug, Deserialize)]
/// Query parameters for filtering results.
pub struct FollowerQuery {
    pub days: Option<i32>,
}

#[derive(Debug, Deserialize)]
/// Query parameters for filtering results.
pub struct TopPostsQuery {
    pub limit: Option<i64>,
}

#[tracing::instrument(skip_all)]
pub async fn overview(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    // Return aggregated AnalyticsOverview matching the frontend type
    let rows = sqlx::query_as::<_, crate::models::AccountAnalyticsRow>(
        "SELECT an.id, an.account_id, an.date, an.followers, an.following,
                an.posts_count, an.impressions, an.reach, an.engagement,
                an.clicks, an.shares
         FROM social.analytics an
         JOIN social.accounts a ON a.id = an.account_id
         WHERE a.user_id = $1
           AND an.date = (
               SELECT MAX(an2.date) FROM social.analytics an2 WHERE an2.account_id = an.account_id
           )
         ORDER BY an.date DESC",
    )
    .bind(claims.sub)
    .fetch_all(&state.pool)
    .await;

    match rows {
        Ok(rows) => {
            let total_followers: i32 = rows.iter().map(|r| r.followers.unwrap_or(0)).sum();
            let total_reach: i32 = rows.iter().map(|r| r.reach.unwrap_or(0)).sum();
            let total_clicks: i32 = rows.iter().map(|r| r.clicks.unwrap_or(0)).sum();
            let total_posts: i32 = rows.iter().map(|r| r.posts_count.unwrap_or(0)).sum();
            let total_engagement: i32 = rows.iter().map(|r| r.engagement.unwrap_or(0)).sum();

            let engagement_rate = if total_followers > 0 {
                total_engagement as f64 / total_followers as f64 * 100.0
            } else {
                0.0
            };

            // Count unread inbox items
            let pending_inbox = sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*) FROM social.inbox_items ii
                 JOIN social.accounts a ON a.id = ii.account_id
                 WHERE a.user_id = $1 AND ii.is_read = false",
            )
            .bind(claims.sub)
            .fetch_one(&state.pool)
            .await
            .unwrap_or(0);

            // Posts published in last 7 days
            let posts_this_week = sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*) FROM social.posts
                 WHERE user_id = $1 AND published_at >= NOW() - INTERVAL '7 days'",
            )
            .bind(claims.sub)
            .fetch_one(&state.pool)
            .await
            .unwrap_or(total_posts as i64);

            (
                StatusCode::OK,
                Json(serde_json::json!({
                    "totalFollowers": total_followers,
                    "followersGrowth": 0,
                    "engagementRate": engagement_rate,
                    "totalReach": total_reach,
                    "totalClicks": total_clicks,
                    "postsThisWeek": posts_this_week,
                    "pendingInbox": pending_inbox,
                })),
            )
        },
        Err(e) => {
            tracing::error!("analytics overview: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database error" })),
            )
        },
    }
}

/// GET /social/analytics/followers?days=30
#[tracing::instrument(skip_all)]
pub async fn followers_timeline(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<FollowerQuery>,
) -> impl IntoResponse {
    let days = q.days.unwrap_or(30);
    match sqlx::query(
        "SELECT an.date::text AS date, an.followers, a.platform
         FROM social.analytics an
         JOIN social.accounts a ON a.id = an.account_id
         WHERE a.user_id = $1
           AND an.date >= CURRENT_DATE - $2::int * INTERVAL '1 day'
         ORDER BY an.date ASC",
    )
    .bind(claims.sub)
    .bind(days)
    .fetch_all(&state.pool)
    .await
    {
        Ok(rows) => {
            use sqlx::Row;
            let data: Vec<_> = rows
                .iter()
                .map(|r| {
                    serde_json::json!({
                        "date": r.get::<String, _>("date"),
                        "followers": r.get::<Option<i32>, _>("followers").unwrap_or(0),
                        "platform": r.get::<String, _>("platform"),
                    })
                })
                .collect();
            (StatusCode::OK, Json(serde_json::json!(data)))
        },
        Err(e) => {
            tracing::error!("followers_timeline: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database error" })),
            )
        },
    }
}

/// GET /social/analytics/by-platform
#[tracing::instrument(skip_all)]
pub async fn by_platform(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    match sqlx::query(
        "SELECT a.platform,
                COALESCE(SUM(an.engagement), 0) AS engagement,
                COUNT(DISTINCT p.id) AS posts
         FROM social.accounts a
         LEFT JOIN social.analytics an ON an.account_id = a.id
         LEFT JOIN social.post_targets pt ON pt.account_id = a.id
         LEFT JOIN social.posts p ON p.id = pt.post_id
         WHERE a.user_id = $1
         GROUP BY a.platform",
    )
    .bind(claims.sub)
    .fetch_all(&state.pool)
    .await
    {
        Ok(rows) => {
            use sqlx::Row;
            let data: Vec<_> = rows
                .iter()
                .map(|r| {
                    serde_json::json!({
                        "platform": r.get::<String, _>("platform"),
                        "engagement": r.get::<i64, _>("engagement"),
                        "posts": r.get::<i64, _>("posts"),
                    })
                })
                .collect();
            (StatusCode::OK, Json(serde_json::json!(data)))
        },
        Err(e) => {
            tracing::error!("by_platform: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database error" })),
            )
        },
    }
}

/// GET /social/analytics/top-posts?limit=10
#[tracing::instrument(skip_all)]
pub async fn top_posts(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<TopPostsQuery>,
) -> impl IntoResponse {
    let limit = q.limit.unwrap_or(10);
    match sqlx::query_as::<_, crate::models::Post>(
        "SELECT p.*
         FROM social.posts p
         JOIN social.post_targets pt ON pt.post_id = p.id
         JOIN social.post_analytics pa ON pa.post_target_id = pt.id
         WHERE p.user_id = $1
         GROUP BY p.id
         ORDER BY SUM(pa.likes + pa.comments + pa.shares) DESC
         LIMIT $2",
    )
    .bind(claims.sub)
    .bind(limit)
    .fetch_all(&state.pool)
    .await
    {
        Ok(rows) => (StatusCode::OK, Json(serde_json::json!(rows))),
        Err(e) => {
            tracing::error!("top_posts: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database error" })),
            )
        },
    }
}

#[tracing::instrument(skip_all)]
pub async fn post_analytics(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(post_id): Path<Uuid>,
) -> impl IntoResponse {
    // Verify ownership via posts table, then return analytics per target
    match sqlx::query_as::<_, crate::models::PostAnalyticsRow>(
        "SELECT pa.id, pa.post_target_id, pa.impressions, pa.reach, pa.likes,
                pa.comments, pa.shares, pa.clicks, pa.saves, pa.updated_at
         FROM social.post_analytics pa
         JOIN social.post_targets pt ON pt.id = pa.post_target_id
         JOIN social.posts p ON p.id = pt.post_id
         WHERE p.id = $1 AND p.user_id = $2",
    )
    .bind(post_id)
    .bind(claims.sub)
    .fetch_all(&state.pool)
    .await
    {
        Ok(rows) => (StatusCode::OK, Json(serde_json::json!(rows))),
        Err(e) => {
            tracing::error!("post_analytics: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database error" })),
            )
        },
    }
}
