//! Mailing list detection and mass unsubscribe handlers.
//!
//! Provides endpoints to list detected mailing lists from synced emails
//! and to mass-unsubscribe from them via HTTP or mailto.

use axum::{extract::State, http::StatusCode, response::IntoResponse, Extension, Json};
use serde::{Deserialize, Serialize};
use signapps_common::Claims;

use crate::AppState;

/// Represents a detected mailing list aggregated from synced emails.
///
/// Built from `List-Unsubscribe` and `List-Id` headers found during IMAP sync.
///
/// # Examples
///
/// ```json
/// {
///   "list_id": "newsletter.example.com",
///   "name": "newsletter@example.com",
///   "email_count": 42,
///   "unsubscribe_url": "https://example.com/unsubscribe"
/// }
/// ```
#[derive(Debug, Serialize, Deserialize, utoipa::ToSchema)]
pub struct MailingListEntry {
    /// Mailing list identifier from the `List-Id` header, or derived from sender.
    pub list_id: String,
    /// Display name (sender address or list name).
    pub name: String,
    /// Number of emails received from this mailing list.
    pub email_count: i64,
    /// Raw `List-Unsubscribe` header value (may contain mailto: and/or https: URLs).
    pub unsubscribe_header: Option<String>,
    /// Extracted HTTPS unsubscribe URL, if available.
    pub unsubscribe_url: Option<String>,
    /// Extracted mailto unsubscribe address, if available.
    pub unsubscribe_mailto: Option<String>,
}

/// Database row for the mailing list aggregation query.
#[derive(Debug, sqlx::FromRow)]
struct MailingListRow {
    list_id: Option<String>,
    sender: String,
    list_unsubscribe: Option<String>,
    email_count: i64,
}

/// Extract the first HTTPS URL from a `List-Unsubscribe` header value.
///
/// The header format is: `<mailto:unsub@example.com>, <https://example.com/unsub>`
fn extract_https_url(header: &str) -> Option<String> {
    for part in header.split(',') {
        let trimmed = part.trim().trim_start_matches('<').trim_end_matches('>');
        if trimmed.starts_with("https://") || trimmed.starts_with("http://") {
            return Some(trimmed.to_string());
        }
    }
    None
}

/// Extract the first mailto address from a `List-Unsubscribe` header value.
fn extract_mailto(header: &str) -> Option<String> {
    for part in header.split(',') {
        let trimmed = part.trim().trim_start_matches('<').trim_end_matches('>');
        if let Some(addr) = trimmed.strip_prefix("mailto:") {
            return Some(addr.to_string());
        }
    }
    None
}

/// List all detected mailing lists for the current user.
///
/// Aggregates emails that have a `List-Unsubscribe` header, grouped by
/// sender and list identifier.
///
/// # Errors
///
/// Returns `500` if the database query fails.
#[utoipa::path(
    get,
    path = "/api/v1/mail/mailing-lists",
    tag = "mail-mailing-lists",
    security(("bearerAuth" = [])),
    responses(
        (status = 200, description = "List of detected mailing lists", body = Vec<MailingListEntry>),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn list_mailing_lists(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    let rows = sqlx::query_as::<_, MailingListRow>(
        r#"
        SELECT
            e.list_id,
            e.sender,
            (array_agg(e.list_unsubscribe ORDER BY e.received_at DESC) FILTER (WHERE e.list_unsubscribe IS NOT NULL))[1] AS list_unsubscribe,
            COUNT(*) AS email_count
        FROM mail.emails e
        JOIN mail.accounts a ON a.id = e.account_id
        WHERE a.user_id = $1
          AND e.list_unsubscribe IS NOT NULL
          AND COALESCE(e.is_deleted, false) = false
        GROUP BY e.list_id, e.sender
        ORDER BY email_count DESC
        LIMIT 200
        "#,
    )
    .bind(claims.sub)
    .fetch_all(&state.pool)
    .await;

    match rows {
        Ok(rows) => {
            let entries: Vec<MailingListEntry> = rows
                .into_iter()
                .map(|row| {
                    let unsubscribe_url =
                        row.list_unsubscribe.as_deref().and_then(extract_https_url);
                    let unsubscribe_mailto =
                        row.list_unsubscribe.as_deref().and_then(extract_mailto);

                    let display_name = row.list_id.clone().unwrap_or_else(|| row.sender.clone());

                    MailingListEntry {
                        list_id: row.list_id.unwrap_or_else(|| row.sender.clone()),
                        name: display_name,
                        email_count: row.email_count,
                        unsubscribe_header: row.list_unsubscribe,
                        unsubscribe_url,
                        unsubscribe_mailto,
                    }
                })
                .collect();
            Json(entries).into_response()
        },
        Err(e) => {
            tracing::error!("Failed to query mailing lists: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Failed to fetch mailing lists" })),
            )
                .into_response()
        },
    }
}

/// Request payload for mass unsubscribe.
///
/// Provide a list of entries to unsubscribe from. Each entry can specify
/// a sender email, an HTTPS unsubscribe URL, or a mailto address.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct UnsubscribeRequest {
    /// List of unsubscribe targets.
    pub items: Vec<UnsubscribeItem>,
}

/// A single unsubscribe target.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct UnsubscribeItem {
    /// Sender email address to match when archiving emails.
    pub sender: String,
    /// HTTPS URL to call for unsubscription (RFC 2369).
    pub unsubscribe_url: Option<String>,
    /// Mailto address to send unsubscribe request to.
    pub unsubscribe_mailto: Option<String>,
}

/// Result of a single unsubscribe attempt.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct UnsubscribeResult {
    /// Sender that was processed.
    pub sender: String,
    /// Whether the unsubscribe request was successfully sent.
    pub success: bool,
    /// Method used: `"http"`, `"mailto"`, or `"none"`.
    pub method: String,
    /// Number of emails archived from this sender.
    pub emails_archived: i64,
    /// Error message if the unsubscribe failed.
    pub error: Option<String>,
}

/// Mass unsubscribe from mailing lists.
///
/// For each item:
/// - If an HTTPS unsubscribe URL is provided, sends a GET request to it.
/// - If a mailto address is provided, sends an empty unsubscribe email.
/// - Archives all emails from the sender.
///
/// # Errors
///
/// Returns `422` if the request body is empty.
/// Returns `500` on database errors.
#[utoipa::path(
    post,
    path = "/api/v1/mail/mailing-lists/unsubscribe",
    tag = "mail-mailing-lists",
    security(("bearerAuth" = [])),
    request_body = UnsubscribeRequest,
    responses(
        (status = 200, description = "Unsubscribe results", body = Vec<UnsubscribeResult>),
        (status = 401, description = "Not authenticated"),
        (status = 422, description = "Empty request"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn mass_unsubscribe(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<UnsubscribeRequest>,
) -> impl IntoResponse {
    if payload.items.is_empty() {
        return (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(serde_json::json!({ "error": "items must not be empty" })),
        )
            .into_response();
    }

    let http_client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .redirect(reqwest::redirect::Policy::limited(5))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    let mut results = Vec::with_capacity(payload.items.len());

    for item in &payload.items {
        let mut method = "none".to_string();
        let mut success = false;
        let mut error = None;

        // 1. Try HTTPS unsubscribe
        if let Some(ref url) = item.unsubscribe_url {
            if url.starts_with("https://") || url.starts_with("http://") {
                method = "http".to_string();
                match http_client.get(url).send().await {
                    Ok(resp) => {
                        if resp.status().is_success()
                            || resp.status().is_redirection()
                            || resp.status() == reqwest::StatusCode::OK
                        {
                            success = true;
                            tracing::info!(
                                sender = %item.sender,
                                url = %url,
                                status = %resp.status(),
                                "HTTP unsubscribe request sent"
                            );
                        } else {
                            error = Some(format!("HTTP {} from unsubscribe URL", resp.status()));
                            tracing::warn!(
                                sender = %item.sender,
                                url = %url,
                                status = %resp.status(),
                                "HTTP unsubscribe returned non-success"
                            );
                        }
                    },
                    Err(e) => {
                        error = Some(format!("HTTP request failed: {e}"));
                        tracing::error!(
                            sender = %item.sender,
                            url = %url,
                            "HTTP unsubscribe request failed: {}", e
                        );
                    },
                }
            }
        }

        // 2. Try mailto unsubscribe (send an empty email)
        if !success {
            if let Some(ref mailto) = item.unsubscribe_mailto {
                method = "mailto".to_string();
                // Find user's first active mail account to send from
                let send_account: Option<(String, String, Option<String>, Option<i32>)> =
                    sqlx::query_as(
                        r#"
                        SELECT email_address, smtp_server, app_password, smtp_port
                        FROM mail.accounts
                        WHERE user_id = $1
                          AND (status = 'active' OR status IS NULL)
                          AND smtp_server IS NOT NULL
                        LIMIT 1
                        "#,
                    )
                    .bind(claims.sub)
                    .fetch_optional(&state.pool)
                    .await
                    .ok()
                    .flatten();

                if let Some((from_addr, smtp_server, app_password, smtp_port)) = send_account {
                    match send_unsubscribe_email(
                        &from_addr,
                        mailto,
                        &smtp_server,
                        app_password.as_deref(),
                        smtp_port,
                    )
                    .await
                    {
                        Ok(()) => {
                            success = true;
                            tracing::info!(
                                sender = %item.sender,
                                mailto = %mailto,
                                "Mailto unsubscribe email sent"
                            );
                        },
                        Err(e) => {
                            error = Some(format!("SMTP send failed: {e}"));
                            tracing::error!(
                                sender = %item.sender,
                                mailto = %mailto,
                                "Mailto unsubscribe failed: {}", e
                            );
                        },
                    }
                } else {
                    error =
                        Some("No active SMTP account available to send unsubscribe email".into());
                }
            }
        }

        // 3. Archive all emails from this sender
        let archive_result = sqlx::query(
            r#"
            UPDATE mail.emails SET is_archived = true, updated_at = NOW()
            WHERE sender = $1
              AND account_id IN (SELECT id FROM mail.accounts WHERE user_id = $2)
              AND COALESCE(is_deleted, false) = false
              AND COALESCE(is_archived, false) = false
            "#,
        )
        .bind(&item.sender)
        .bind(claims.sub)
        .execute(&state.pool)
        .await;

        let emails_archived = match archive_result {
            Ok(r) => r.rows_affected() as i64,
            Err(e) => {
                tracing::error!(
                    sender = %item.sender,
                    "Failed to archive emails: {:?}", e
                );
                0
            },
        };

        results.push(UnsubscribeResult {
            sender: item.sender.clone(),
            success,
            method,
            emails_archived,
            error,
        });
    }

    Json(results).into_response()
}

/// Send a minimal unsubscribe email via SMTP.
///
/// Uses lettre to send a simple email to the mailto unsubscribe address.
///
/// # Errors
///
/// Returns an error if SMTP connection or sending fails.
async fn send_unsubscribe_email(
    from: &str,
    to: &str,
    smtp_server: &str,
    password: Option<&str>,
    smtp_port: Option<i32>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    use lettre::message::header::ContentType;
    use lettre::transport::smtp::authentication::Credentials;
    use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};

    let email = Message::builder()
        .from(from.parse()?)
        .to(to.parse()?)
        .subject("Unsubscribe")
        .header(ContentType::TEXT_PLAIN)
        .body("unsubscribe".to_string())?;

    let port = smtp_port.unwrap_or(587) as u16;
    let mut transport_builder =
        AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(smtp_server)?.port(port);

    if let Some(pw) = password {
        transport_builder =
            transport_builder.credentials(Credentials::new(from.to_string(), pw.to_string()));
    }

    let transport = transport_builder.build();
    transport.send(email).await?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_https_url() {
        let header = "<mailto:unsubscribe@example.com>, <https://example.com/unsubscribe?id=123>";
        assert_eq!(
            extract_https_url(header),
            Some("https://example.com/unsubscribe?id=123".to_string())
        );
    }

    #[test]
    fn test_extract_https_url_none() {
        let header = "<mailto:unsubscribe@example.com>";
        assert_eq!(extract_https_url(header), None);
    }

    #[test]
    fn test_extract_mailto() {
        let header = "<mailto:unsubscribe@example.com>, <https://example.com/unsubscribe>";
        assert_eq!(
            extract_mailto(header),
            Some("unsubscribe@example.com".to_string())
        );
    }

    #[test]
    fn test_extract_mailto_none() {
        let header = "<https://example.com/unsubscribe>";
        assert_eq!(extract_mailto(header), None);
    }

    #[test]
    fn test_extract_https_url_http() {
        let header = "<http://example.com/unsub>";
        assert_eq!(
            extract_https_url(header),
            Some("http://example.com/unsub".to_string())
        );
    }
}
