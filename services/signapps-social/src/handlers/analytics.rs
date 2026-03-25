use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use signapps_common::Claims;
use uuid::Uuid;

use crate::AppState;

pub async fn overview(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    // Return latest analytics row per account for the authenticated user
    match sqlx::query_as::<_, crate::models::AccountAnalyticsRow>(
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
    .await
    {
        Ok(rows) => (StatusCode::OK, Json(serde_json::json!(rows))),
        Err(e) => {
            tracing::error!("analytics overview: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "database error" })),
            )
        },
    }
}

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
