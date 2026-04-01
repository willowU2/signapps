use axum::{
    extract::{Multipart, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use signapps_common::Claims;

use crate::AppState;

/// POST /api/v1/mail/import/mbox
///
/// Accepts a multipart form upload with an `.mbox` file (field name: "file").
/// Parses each message (delimited by "From " lines), extracts headers + body,
/// and inserts into `mail.emails`.
///
/// Returns `{ imported, failed }`.
#[tracing::instrument(skip_all)]
pub async fn import_mbox(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    mut multipart: Multipart,
) -> impl IntoResponse {
    let mut mbox_bytes: Vec<u8> = Vec::new();

    while let Ok(Some(field)) = multipart.next_field().await {
        if field.name().unwrap_or("") == "file" {
            match field.bytes().await {
                Ok(b) => {
                    mbox_bytes = b.to_vec();
                    break;
                },
                Err(e) => {
                    tracing::error!("Failed to read MBOX field: {e}");
                    return (
                        StatusCode::BAD_REQUEST,
                        Json(serde_json::json!({ "error": "Failed to read uploaded file" })),
                    );
                },
            }
        }
    }

    if mbox_bytes.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "No file field found in multipart body" })),
        );
    }

    let content = match std::str::from_utf8(&mbox_bytes) {
        Ok(s) => s.to_string(),
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": "MBOX file must be UTF-8 encoded" })),
            )
        },
    };

    // Split MBOX into individual messages. Each message starts with a "From " line.
    let messages = split_mbox(&content);
    let total = messages.len();
    let mut imported = 0u32;
    let mut failed = 0u32;

    // Resolve account_id once before the loop to avoid N+1 queries
    let account_id: Option<uuid::Uuid> =
        sqlx::query_scalar("SELECT id FROM mail.accounts WHERE user_id = $1 LIMIT 1")
            .bind(claims.sub)
            .fetch_optional(&state.pool)
            .await
            .ok()
            .flatten();

    let Some(account_id) = account_id else {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "No mail account found for user" })),
        );
    };

    for raw_msg in messages {
        // Parse headers from the raw message
        let (subject, sender, recipients, body) = parse_mbox_message(&raw_msg);

        let res = sqlx::query(
            r#"INSERT INTO mail.emails
               (id, account_id, folder_id, message_id, subject, sender, recipients,
                body_text, body_html, is_read, is_sent, is_deleted, is_starred,
                is_draft, attachments, labels, received_at, created_at, updated_at)
               VALUES
               (gen_random_uuid(), $1, NULL, NULL, $2, $3, $4,
                $5, NULL, false, false, false, false,
                false, '[]', '[]', NOW(), NOW(), NOW())"#,
        )
        .bind(account_id)
        .bind(&subject)
        .bind(&sender)
        .bind(serde_json::json!(recipients))
        .bind(&body)
        .execute(&state.pool)
        .await;

        match res {
            Ok(_) => imported += 1,
            Err(e) => {
                tracing::warn!("Failed to insert MBOX message: {e}");
                failed += 1;
            },
        }
    }

    tracing::info!(user = %claims.sub, total, imported, failed, "MBOX import completed");
    (
        StatusCode::OK,
        Json(serde_json::json!({ "imported": imported, "failed": failed, "total": total })),
    )
}

/// Split raw MBOX content into individual message strings.
/// MBOX messages are separated by "From " lines at the start of a line.
fn split_mbox(content: &str) -> Vec<String> {
    let mut messages: Vec<String> = Vec::new();
    let mut current: Vec<&str> = Vec::new();

    for line in content.lines() {
        if line.starts_with("From ") && !current.is_empty() {
            messages.push(current.join("\n"));
            current.clear();
        }
        current.push(line);
    }
    if !current.is_empty() {
        messages.push(current.join("\n"));
    }

    messages
}

/// Parse a single MBOX message. Returns (subject, sender, recipients, body).
fn parse_mbox_message(raw: &str) -> (String, String, Vec<String>, String) {
    let mut subject = String::new();
    let mut sender = String::new();
    let mut recipients: Vec<String> = Vec::new();
    let mut in_headers = true;
    let mut body_lines: Vec<&str> = Vec::new();

    for line in raw.lines() {
        if in_headers {
            if line.is_empty() {
                in_headers = false;
                continue;
            }
            if let Some(val) = line
                .strip_prefix("Subject:")
                .or_else(|| line.strip_prefix("subject:"))
            {
                subject = val.trim().to_string();
            } else if let Some(val) = line
                .strip_prefix("From:")
                .or_else(|| line.strip_prefix("from:"))
            {
                sender = val.trim().to_string();
            } else if let Some(val) = line
                .strip_prefix("To:")
                .or_else(|| line.strip_prefix("to:"))
            {
                recipients.extend(val.trim().split(',').map(|s| s.trim().to_string()));
            }
        } else {
            body_lines.push(line);
        }
    }

    let body = body_lines.join("\n");
    (subject, sender, recipients, body)
}
