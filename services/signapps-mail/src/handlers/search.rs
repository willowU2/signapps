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
/// Query parameters for filtering and pagination.
pub struct SearchQuery {
    pub q: String,
    pub account_id: Option<Uuid>,
    pub limit: Option<i64>,
}

#[tracing::instrument(skip_all)]
pub async fn search_emails(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<SearchQuery>,
) -> impl IntoResponse {
    let limit = query.limit.unwrap_or(50).min(1000);
    let emails = sqlx::query_as::<_, Email>(
        r#"
        SELECT e.* FROM mail.emails e
        JOIN mail.accounts a ON a.id = e.account_id
        WHERE a.user_id = $1
        AND ($2::UUID IS NULL OR e.account_id = $2)
        AND (
            e.search_vector @@ plainto_tsquery('french', $3)
            OR e.subject ILIKE '%' || $3 || '%'
        )
        ORDER BY COALESCE(e.received_at, e.created_at) DESC
        LIMIT $4
        "#,
    )
    .bind(claims.sub)
    .bind(query.account_id)
    .bind(&query.q)
    .bind(limit)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    Json(emails)
}
