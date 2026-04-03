use axum::{extract::State, response::IntoResponse, Extension, Json};
use serde::Serialize;
use signapps_common::Claims;
use uuid::Uuid;

use crate::AppState;

#[derive(Serialize)]
/// Represents a mail stats.
pub struct MailStats {
    pub total_accounts: i64,
    pub total_emails: i64,
    pub unread_count: i64,
    pub starred_count: i64,
    pub draft_count: i64,
}

#[tracing::instrument(skip_all)]
pub async fn get_stats(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    let total_accounts: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM mail.accounts WHERE user_id = $1")
            .bind(claims.sub)
            .fetch_one(&state.pool)
            .await
            .unwrap_or((0,));

    let total_emails: (i64,) = sqlx::query_as(
        r#"
        SELECT COUNT(*) FROM mail.emails e
        JOIN mail.accounts a ON a.id = e.account_id
        WHERE a.user_id = $1 AND COALESCE(e.is_deleted, false) = false
        "#,
    )
    .bind(claims.sub)
    .fetch_one(&state.pool)
    .await
    .unwrap_or((0,));

    let unread_count: (i64,) = sqlx::query_as(
        r#"
        SELECT COUNT(*) FROM mail.emails e
        JOIN mail.accounts a ON a.id = e.account_id
        WHERE a.user_id = $1 AND COALESCE(e.is_read, false) = false
        AND COALESCE(e.is_deleted, false) = false
        "#,
    )
    .bind(claims.sub)
    .fetch_one(&state.pool)
    .await
    .unwrap_or((0,));

    let starred_count: (i64,) = sqlx::query_as(
        r#"
        SELECT COUNT(*) FROM mail.emails e
        JOIN mail.accounts a ON a.id = e.account_id
        WHERE a.user_id = $1 AND e.is_starred = true
        AND COALESCE(e.is_deleted, false) = false
        "#,
    )
    .bind(claims.sub)
    .fetch_one(&state.pool)
    .await
    .unwrap_or((0,));

    let draft_count: (i64,) = sqlx::query_as(
        r#"
        SELECT COUNT(*) FROM mail.emails e
        JOIN mail.accounts a ON a.id = e.account_id
        WHERE a.user_id = $1 AND e.is_draft = true
        "#,
    )
    .bind(claims.sub)
    .fetch_one(&state.pool)
    .await
    .unwrap_or((0,));

    Json(MailStats {
        total_accounts: total_accounts.0,
        total_emails: total_emails.0,
        unread_count: unread_count.0,
        starred_count: starred_count.0,
        draft_count: draft_count.0,
    })
}

/// GET /api/v1/mail/analytics
///
/// Returns 30-day send/receive/read stats and top senders for the authenticated user.
#[tracing::instrument(skip_all)]
pub async fn mail_analytics(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    // Get user's account IDs
    let accounts: Vec<Uuid> = sqlx::query_scalar("SELECT id FROM mail.accounts WHERE user_id = $1")
        .bind(claims.sub)
        .fetch_all(&state.pool)
        .await
        .unwrap_or_default();

    if accounts.is_empty() {
        return Json(serde_json::json!({
            "sent_30d": 0,
            "received_30d": 0,
            "read_rate": 0,
            "top_senders": []
        }))
        .into_response();
    }

    // Sent last 30 days
    let sent: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM mail.emails \
         WHERE account_id = ANY($1) AND is_sent = true \
           AND created_at > now() - interval '30 days'",
    )
    .bind(&accounts)
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    // Received last 30 days
    let received: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM mail.emails \
         WHERE account_id = ANY($1) AND is_sent = false \
           AND created_at > now() - interval '30 days'",
    )
    .bind(&accounts)
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    // Read count
    let read: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM mail.emails \
         WHERE account_id = ANY($1) AND is_sent = false AND is_read = true \
           AND created_at > now() - interval '30 days'",
    )
    .bind(&accounts)
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    let read_rate = if received > 0 {
        (read as f64 / received as f64 * 100.0).round()
    } else {
        0.0
    };

    // Top 5 senders
    let top_senders: Vec<(String, i64)> = sqlx::query_as(
        "SELECT sender, COUNT(*) as cnt FROM mail.emails \
         WHERE account_id = ANY($1) AND is_sent = false \
           AND created_at > now() - interval '30 days' \
         GROUP BY sender ORDER BY cnt DESC LIMIT 5",
    )
    .bind(&accounts)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    Json(serde_json::json!({
        "sent_30d": sent,
        "received_30d": received,
        "read_rate": read_rate,
        "top_senders": top_senders
            .iter()
            .map(|(s, c)| serde_json::json!({"sender": s, "count": c}))
            .collect::<Vec<_>>(),
    }))
    .into_response()
}
