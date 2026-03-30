use crate::AppState;
use axum::{extract::State, http::StatusCode, response::IntoResponse, Extension, Json};
use serde::{Deserialize, Serialize};
use signapps_common::Claims;

// -------------------------------------------------------------------------
// Bug 10: SignatureStore (in-memory) removed.
// Signatures are persisted in mail.accounts.signature_html / signature_text.
// Schema (from migration 026_mail_schema.sql):
//   signature_html TEXT, signature_text TEXT
// -------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize)]
pub struct SignatureResponse {
    pub signature_html: Option<String>,
    pub signature_text: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateSignatureRequest {
    pub signature_html: Option<String>,
    pub signature_text: Option<String>,
}

/// GET /api/v1/mail/signatures/me
/// Returns the signature fields from the first active mail.accounts row for this user.
#[tracing::instrument(skip_all)]
pub async fn get_signature(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    let row: Option<(Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT signature_html, signature_text FROM mail.accounts WHERE user_id = $1 AND status = 'active' ORDER BY created_at LIMIT 1",
    )
    .bind(claims.sub)
    .fetch_optional(&state.pool)
    .await
    .unwrap_or(None);

    match row {
        Some((html, text)) => Json(SignatureResponse {
            signature_html: html,
            signature_text: text,
        })
        .into_response(),
        None => (StatusCode::NOT_FOUND, "No active mail account found").into_response(),
    }
}

/// PUT /api/v1/mail/signatures/me
/// Updates signature_html and signature_text on all mail.accounts rows for this user.
#[tracing::instrument(skip_all)]
pub async fn upsert_signature(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<UpdateSignatureRequest>,
) -> impl IntoResponse {
    let result = sqlx::query(
        r#"
        UPDATE mail.accounts
        SET signature_html = $1,
            signature_text = $2,
            updated_at     = NOW()
        WHERE user_id = $3
        "#,
    )
    .bind(&payload.signature_html)
    .bind(&payload.signature_text)
    .bind(claims.sub)
    .execute(&state.pool)
    .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => Json(SignatureResponse {
            signature_html: payload.signature_html,
            signature_text: payload.signature_text,
        })
        .into_response(),
        Ok(_) => (StatusCode::NOT_FOUND, "No mail account found for user").into_response(),
        Err(e) => {
            tracing::error!(
                "Failed to update signature for user {}: {:?}",
                claims.sub,
                e
            );
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to update signature",
            )
                .into_response()
        },
    }
}
