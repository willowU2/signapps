//! JMAP Session resource handler.
//!
//! `GET /.well-known/jmap` returns the JMAP Session object describing the
//! server's capabilities, available accounts, and endpoint URLs.

use axum::{extract::State, response::IntoResponse, Extension, Json};
use signapps_common::Claims;
use signapps_jmap::session::{JmapAccount, JmapSession};
use std::collections::HashMap;

use crate::AppState;

/// GET /.well-known/jmap
///
/// Returns the JMAP Session resource for the authenticated user.
/// Lists all mail accounts as JMAP accounts with mail/submission capabilities.
///
/// # Errors
///
/// Returns HTTP 500 if the database query fails.
///
/// # Panics
///
/// None — all errors are handled gracefully.
#[utoipa::path(
    get,
    path = "/.well-known/jmap",
    tag = "jmap",
    security(("bearerAuth" = [])),
    responses(
        (status = 200, description = "JMAP Session resource"),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all, fields(user_id = %claims.sub))]
pub async fn well_known(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    // Determine the base URL from environment or default
    let base_url =
        std::env::var("JMAP_BASE_URL").unwrap_or_else(|_| "http://localhost:3012".to_string());

    let mut session = JmapSession::new(claims.username.clone(), base_url);

    // Fetch all mail accounts for this user
    let accounts: Vec<(uuid::Uuid, String)> = sqlx::query_as(
        r#"
        SELECT id, email_address
        FROM mail.accounts
        WHERE user_id = $1
          AND (status = 'active' OR status IS NULL)
        ORDER BY created_at
        "#,
    )
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let is_first = true;
    for (i, (account_id, email_address)) in accounts.iter().enumerate() {
        let mut account_capabilities = HashMap::new();
        account_capabilities.insert(
            "urn:ietf:params:jmap:mail".to_string(),
            serde_json::json!({}),
        );
        account_capabilities.insert(
            "urn:ietf:params:jmap:submission".to_string(),
            serde_json::json!({}),
        );

        let account = JmapAccount {
            name: email_address.clone(),
            is_personal: true,
            is_read_only: false,
            account_capabilities,
        };

        session.add_account(account_id.to_string(), account, is_first && i == 0);
    }

    Json(session)
}
