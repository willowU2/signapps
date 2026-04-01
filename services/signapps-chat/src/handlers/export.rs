//! Channel history export handler (IDEA-142, DB-backed).

use crate::state::AppState;
use crate::types::{ChatMessage, ExportQuery, MessageRow};
use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
};
use signapps_common::Claims;
use uuid::Uuid;

/// Export channel message history as JSON or CSV.
pub async fn export_channel(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(channel_id): Path<Uuid>,
    Query(params): Query<ExportQuery>,
) -> impl IntoResponse {
    let format = params.format.as_deref().unwrap_or("json");

    let rows = match sqlx::query_as::<_, MessageRow>(
        "SELECT id, channel_id, user_id, username, content, parent_id, \
                reactions, attachment, is_pinned, created_at, updated_at \
         FROM chat.messages WHERE channel_id = $1 ORDER BY created_at ASC",
    )
    .bind(channel_id)
    .fetch_all(&state.pool)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!("export_channel DB error: {:?}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                [(axum::http::header::CONTENT_TYPE, "application/json")],
                serde_json::json!({ "error": "Database error" }).to_string(),
            );
        },
    };

    let msgs: Vec<ChatMessage> = rows.into_iter().map(ChatMessage::from).collect();

    if format == "csv" {
        let mut csv = String::from("id,username,content,created_at\n");
        for m in &msgs {
            let content = m.content.replace('"', "\"\"");
            csv.push_str(&format!(
                "{},{},\"{}\",{}\n",
                m.id, m.username, content, m.created_at
            ));
        }
        (
            StatusCode::OK,
            [(axum::http::header::CONTENT_TYPE, "text/csv")],
            csv,
        )
    } else {
        let json = serde_json::to_string(&msgs).unwrap_or_default();
        (
            StatusCode::OK,
            [(axum::http::header::CONTENT_TYPE, "application/json")],
            json,
        )
    }
}
