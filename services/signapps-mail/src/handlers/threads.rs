use axum::{
    extract::{Query, State},
    response::IntoResponse,
    Extension, Json,
};
use serde::Deserialize;
use signapps_common::Claims;
use uuid::Uuid;

use crate::models::Email;
use crate::AppState;

#[derive(Debug, Deserialize)]
/// Query parameters for thread listing.
pub struct ThreadQuery {
    pub folder_id: Option<Uuid>,
    pub account_id: Option<Uuid>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

/// GET /api/v1/mail/threads?folder_id=X
///
/// Returns emails grouped by thread_id, one row per thread (the latest message).
/// Ordered by most-recent message descending.
#[tracing::instrument(skip_all)]
pub async fn list_threads(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<ThreadQuery>,
) -> impl IntoResponse {
    let limit = query.limit.unwrap_or(50).min(1000);
    let offset = query.offset.unwrap_or(0);

    let threads = sqlx::query_as::<_, Email>(
        r#"
        SELECT DISTINCT ON (COALESCE(e.thread_id, e.id)) e.*
        FROM mail.emails e
        JOIN mail.accounts a ON a.id = e.account_id
        WHERE a.user_id = $1
          AND ($2::UUID IS NULL OR e.account_id = $2)
          AND ($3::UUID IS NULL OR e.folder_id = $3)
          AND COALESCE(e.is_deleted, false) = false
        ORDER BY COALESCE(e.thread_id, e.id), COALESCE(e.received_at, e.created_at) DESC
        LIMIT $4 OFFSET $5
        "#,
    )
    .bind(claims.sub)
    .bind(query.account_id)
    .bind(query.folder_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    Json(threads).into_response()
}
