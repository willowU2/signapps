//! Stalwart Mail Server management — internal mail server integration.
//!
//! Provides admin endpoints to check Stalwart status, manage domains,
//! and create/delete internal mailboxes via the Stalwart management API.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};

use crate::AppState;

// ---------------------------------------------------------------------------
// Configuration helpers
// ---------------------------------------------------------------------------

/// Stalwart management API base URL (default: `http://localhost:8580`).
fn stalwart_api_url() -> String {
    std::env::var("STALWART_API_URL").unwrap_or_else(|_| "http://localhost:8580".to_string())
}

/// Admin bearer token for authenticating against the Stalwart management API.
fn stalwart_api_token() -> Option<String> {
    std::env::var("STALWART_API_TOKEN")
        .ok()
        .filter(|s| !s.is_empty())
}

/// IMAP host for internal accounts (default: `localhost`).
pub fn stalwart_imap_host() -> String {
    std::env::var("STALWART_IMAP_HOST").unwrap_or_else(|_| "localhost".to_string())
}

/// IMAP port for internal accounts (default: `993`).
pub fn stalwart_imap_port() -> i32 {
    std::env::var("STALWART_IMAP_PORT")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(993)
}

/// SMTP host for internal accounts (default: `localhost`).
pub fn stalwart_smtp_host() -> String {
    std::env::var("STALWART_SMTP_HOST").unwrap_or_else(|_| "localhost".to_string())
}

/// SMTP port for internal accounts (default: `587`).
pub fn stalwart_smtp_port() -> i32 {
    std::env::var("STALWART_SMTP_PORT")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(587)
}

/// Build an HTTP client with the Stalwart admin token pre-configured.
fn stalwart_client() -> reqwest::Client {
    reqwest::Client::new()
}

/// Add the authorization header if a token is configured.
fn with_auth(builder: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
    if let Some(token) = stalwart_api_token() {
        builder.bearer_auth(token)
    } else {
        builder
    }
}

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

/// Response returned by the server status endpoint.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct StalwartStatus {
    /// Whether the Stalwart server is reachable.
    pub online: bool,
    /// Base URL of the Stalwart management API.
    pub api_url: String,
    /// Optional error message if the server is unreachable.
    pub error: Option<String>,
    /// IMAP host configured for internal accounts.
    pub imap_host: String,
    /// IMAP port configured for internal accounts.
    pub imap_port: i32,
    /// SMTP host configured for internal accounts.
    pub smtp_host: String,
    /// SMTP port configured for internal accounts.
    pub smtp_port: i32,
}

/// Request payload for creating a new internal mailbox.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreateMailboxRequest {
    /// Full email address (e.g. `alice@signapps.local`).
    pub email: String,
    /// Display name of the account.
    pub name: String,
    /// Password for IMAP/SMTP authentication.
    pub password: String,
}

/// Response after successfully creating a mailbox.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct CreateMailboxResponse {
    /// Whether the creation succeeded.
    pub success: bool,
    /// The email address of the created mailbox.
    pub email: String,
    /// Optional message from the server.
    pub message: Option<String>,
}

/// A domain configured on the Stalwart server.
#[derive(Debug, Serialize, Deserialize, utoipa::ToSchema)]
pub struct StalwartDomain {
    /// Domain name (e.g. `signapps.local`).
    pub name: String,
}

/// An account on the Stalwart server.
#[derive(Debug, Serialize, Deserialize, utoipa::ToSchema)]
pub struct StalwartAccount {
    /// Account name / email.
    pub name: String,
    /// Account type (individual, group, etc.).
    #[serde(rename = "type", default)]
    pub account_type: Option<String>,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// Check if the Stalwart Mail Server is running and reachable.
///
/// Pings the management API health endpoint and returns connection details.
///
/// # Errors
///
/// Always returns 200 — the `online` field indicates availability.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    get,
    path = "/api/v1/mail/internal/status",
    tag = "mail-internal-server",
    security(("bearerAuth" = [])),
    responses(
        (status = 200, description = "Stalwart server status", body = StalwartStatus),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn get_status() -> impl IntoResponse {
    let api_url = stalwart_api_url();
    let client = stalwart_client();

    // Try to reach the Stalwart management API
    let health_url = format!("{}/healthz", api_url);
    let result = with_auth(client.get(&health_url))
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await;

    let (online, error) = match result {
        Ok(resp) if resp.status().is_success() => (true, None),
        Ok(resp) => (
            false,
            Some(format!("Stalwart responded with status {}", resp.status())),
        ),
        Err(e) => (false, Some(format!("Connection failed: {}", e))),
    };

    Json(StalwartStatus {
        online,
        api_url,
        error,
        imap_host: stalwart_imap_host(),
        imap_port: stalwart_imap_port(),
        smtp_host: stalwart_smtp_host(),
        smtp_port: stalwart_smtp_port(),
    })
}

/// List domains configured on the Stalwart server.
///
/// Calls the Stalwart management API `GET /api/domain` to enumerate domains.
///
/// # Errors
///
/// Returns `502 Bad Gateway` if Stalwart is unreachable.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    get,
    path = "/api/v1/mail/internal/domains",
    tag = "mail-internal-server",
    security(("bearerAuth" = [])),
    responses(
        (status = 200, description = "List of domains", body = Vec<StalwartDomain>),
        (status = 502, description = "Stalwart unreachable"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn list_domains() -> impl IntoResponse {
    let api_url = stalwart_api_url();
    let client = stalwart_client();

    let url = format!("{}/api/domain", api_url);
    let result = with_auth(client.get(&url))
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await;

    match result {
        Ok(resp) if resp.status().is_success() => {
            // Stalwart returns a JSON object with a "data" array of { "items": [...] }
            // or directly an array — handle both formats gracefully.
            let body = resp.text().await.unwrap_or_default();
            let domains = parse_domain_list(&body);
            Json(serde_json::json!({ "domains": domains })).into_response()
        },
        Ok(resp) => {
            let status = resp.status().as_u16();
            let body = resp.text().await.unwrap_or_default();
            tracing::warn!(status, body = %body, "Stalwart domain list failed");
            (
                StatusCode::BAD_GATEWAY,
                Json(serde_json::json!({
                    "error": format!("Stalwart returned status {}", status),
                    "detail": body,
                })),
            )
                .into_response()
        },
        Err(e) => {
            tracing::error!("Failed to reach Stalwart: {}", e);
            (
                StatusCode::BAD_GATEWAY,
                Json(serde_json::json!({ "error": format!("Connection failed: {}", e) })),
            )
                .into_response()
        },
    }
}

/// Create a new mailbox on the internal Stalwart server.
///
/// Calls the Stalwart management API to create an account, then optionally
/// links it to a SignApps user as an internal mail account.
///
/// # Errors
///
/// Returns `502` if Stalwart is unreachable, or `400` if the account
/// creation fails (e.g. duplicate email).
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    post,
    path = "/api/v1/mail/internal/accounts",
    tag = "mail-internal-server",
    security(("bearerAuth" = [])),
    request_body = CreateMailboxRequest,
    responses(
        (status = 201, description = "Mailbox created", body = CreateMailboxResponse),
        (status = 400, description = "Invalid request or duplicate email"),
        (status = 502, description = "Stalwart unreachable"),
    )
)]
#[tracing::instrument(skip_all, fields(email = %payload.email))]
pub async fn create_account(
    State(_state): State<AppState>,
    Json(payload): Json<CreateMailboxRequest>,
) -> impl IntoResponse {
    let api_url = stalwart_api_url();
    let client = stalwart_client();

    // Stalwart management API: POST /api/account
    // Payload: { "name": "user@domain", "type": "individual",
    //            "secrets": ["password"], "emails": ["user@domain"],
    //            "description": "Display Name" }
    let account_payload = serde_json::json!({
        "name": &payload.email,
        "type": "individual",
        "secrets": [&payload.password],
        "emails": [&payload.email],
        "description": &payload.name,
    });

    let url = format!("{}/api/account/{}", api_url, payload.email);
    let result = with_auth(client.post(&url))
        .json(&account_payload)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await;

    match result {
        Ok(resp) if resp.status().is_success() || resp.status() == StatusCode::CREATED => {
            tracing::info!(email = %payload.email, "Internal mailbox created on Stalwart");
            (
                StatusCode::CREATED,
                Json(CreateMailboxResponse {
                    success: true,
                    email: payload.email,
                    message: Some("Mailbox created successfully".to_string()),
                }),
            )
                .into_response()
        },
        Ok(resp) => {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            tracing::warn!(
                email = %payload.email,
                status = %status,
                body = %body,
                "Stalwart account creation failed"
            );
            (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "error": "Failed to create mailbox",
                    "detail": body,
                })),
            )
                .into_response()
        },
        Err(e) => {
            tracing::error!(email = %payload.email, "Stalwart unreachable: {}", e);
            (
                StatusCode::BAD_GATEWAY,
                Json(serde_json::json!({ "error": format!("Connection failed: {}", e) })),
            )
                .into_response()
        },
    }
}

/// Delete a mailbox from the internal Stalwart server.
///
/// Calls the Stalwart management API to remove the account.
///
/// # Errors
///
/// Returns `502` if Stalwart is unreachable, or `404` if the account
/// does not exist.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    delete,
    path = "/api/v1/mail/internal/accounts/{email}",
    tag = "mail-internal-server",
    security(("bearerAuth" = [])),
    params(("email" = String, Path, description = "Email address of the mailbox to delete")),
    responses(
        (status = 200, description = "Mailbox deleted"),
        (status = 404, description = "Mailbox not found"),
        (status = 502, description = "Stalwart unreachable"),
    )
)]
#[tracing::instrument(skip_all, fields(email = %email))]
pub async fn delete_account(
    State(_state): State<AppState>,
    Path(email): Path<String>,
) -> impl IntoResponse {
    let api_url = stalwart_api_url();
    let client = stalwart_client();

    let url = format!("{}/api/account/{}", api_url, email);
    let result = with_auth(client.delete(&url))
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await;

    match result {
        Ok(resp) if resp.status().is_success() => {
            tracing::info!(email = %email, "Internal mailbox deleted from Stalwart");
            Json(serde_json::json!({
                "success": true,
                "message": format!("Mailbox {} deleted", email),
            }))
            .into_response()
        },
        Ok(resp) if resp.status() == StatusCode::NOT_FOUND => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Mailbox not found" })),
        )
            .into_response(),
        Ok(resp) => {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            tracing::warn!(
                email = %email,
                status = %status,
                body = %body,
                "Stalwart account deletion failed"
            );
            (
                StatusCode::BAD_GATEWAY,
                Json(serde_json::json!({
                    "error": format!("Stalwart returned status {}", status),
                    "detail": body,
                })),
            )
                .into_response()
        },
        Err(e) => {
            tracing::error!(email = %email, "Stalwart unreachable: {}", e);
            (
                StatusCode::BAD_GATEWAY,
                Json(serde_json::json!({ "error": format!("Connection failed: {}", e) })),
            )
                .into_response()
        },
    }
}

/// List all accounts on the internal Stalwart server.
///
/// Calls the Stalwart management API `GET /api/account` to enumerate accounts.
///
/// # Errors
///
/// Returns `502 Bad Gateway` if Stalwart is unreachable.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    get,
    path = "/api/v1/mail/internal/accounts",
    tag = "mail-internal-server",
    security(("bearerAuth" = [])),
    responses(
        (status = 200, description = "List of accounts", body = Vec<StalwartAccount>),
        (status = 502, description = "Stalwart unreachable"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn list_accounts() -> impl IntoResponse {
    let api_url = stalwart_api_url();
    let client = stalwart_client();

    let url = format!("{}/api/account", api_url);
    let result = with_auth(client.get(&url))
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await;

    match result {
        Ok(resp) if resp.status().is_success() => {
            let body = resp.text().await.unwrap_or_default();
            let accounts = parse_account_list(&body);
            Json(serde_json::json!({ "accounts": accounts })).into_response()
        },
        Ok(resp) => {
            let status = resp.status().as_u16();
            let body = resp.text().await.unwrap_or_default();
            tracing::warn!(status, body = %body, "Stalwart account list failed");
            (
                StatusCode::BAD_GATEWAY,
                Json(serde_json::json!({
                    "error": format!("Stalwart returned status {}", status),
                    "detail": body,
                })),
            )
                .into_response()
        },
        Err(e) => {
            tracing::error!("Failed to reach Stalwart: {}", e);
            (
                StatusCode::BAD_GATEWAY,
                Json(serde_json::json!({ "error": format!("Connection failed: {}", e) })),
            )
                .into_response()
        },
    }
}

// ---------------------------------------------------------------------------
// Parsing helpers (Stalwart API response formats vary by version)
// ---------------------------------------------------------------------------

/// Parse a domain list from the Stalwart API response.
///
/// Handles both `{ "data": { "items": [...] } }` and plain `[...]` formats.
fn parse_domain_list(body: &str) -> Vec<StalwartDomain> {
    // Try { "data": { "items": [...] } }
    if let Ok(val) = serde_json::from_str::<serde_json::Value>(body) {
        if let Some(items) = val
            .get("data")
            .and_then(|d| d.get("items"))
            .and_then(|i| i.as_array())
        {
            return items
                .iter()
                .filter_map(|v| {
                    v.as_str().map(|s| StalwartDomain {
                        name: s.to_string(),
                    })
                })
                .collect();
        }
        // Try plain array at top level
        if let Some(arr) = val.as_array() {
            return arr
                .iter()
                .filter_map(|v| {
                    if let Some(s) = v.as_str() {
                        Some(StalwartDomain {
                            name: s.to_string(),
                        })
                    } else { v.get("name").and_then(|n| n.as_str()).map(|name| StalwartDomain {
                            name: name.to_string(),
                        }) }
                })
                .collect();
        }
        // Try { "data": [...] }
        if let Some(data) = val.get("data").and_then(|d| d.as_array()) {
            return data
                .iter()
                .filter_map(|v| {
                    v.as_str().map(|s| StalwartDomain {
                        name: s.to_string(),
                    })
                })
                .collect();
        }
    }
    Vec::new()
}

/// Parse an account list from the Stalwart API response.
fn parse_account_list(body: &str) -> Vec<StalwartAccount> {
    if let Ok(val) = serde_json::from_str::<serde_json::Value>(body) {
        if let Some(items) = val
            .get("data")
            .and_then(|d| d.get("items"))
            .and_then(|i| i.as_array())
        {
            return items
                .iter()
                .filter_map(|v| {
                    v.as_str().map(|s| StalwartAccount {
                        name: s.to_string(),
                        account_type: None,
                    })
                })
                .collect();
        }
        if let Some(arr) = val.as_array() {
            return arr
                .iter()
                .filter_map(|v| {
                    if let Some(s) = v.as_str() {
                        Some(StalwartAccount {
                            name: s.to_string(),
                            account_type: None,
                        })
                    } else { v.get("name").and_then(|n| n.as_str()).map(|name| StalwartAccount {
                            name: name.to_string(),
                            account_type: v
                                .get("type")
                                .and_then(|t| t.as_str())
                                .map(|s| s.to_string()),
                        }) }
                })
                .collect();
        }
        if let Some(data) = val.get("data").and_then(|d| d.as_array()) {
            return data
                .iter()
                .filter_map(|v| {
                    v.as_str().map(|s| StalwartAccount {
                        name: s.to_string(),
                        account_type: None,
                    })
                })
                .collect();
        }
    }
    Vec::new()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_domain_list_items_format() {
        let body = r#"{"data":{"items":["signapps.local","example.com"]}}"#;
        let domains = parse_domain_list(body);
        assert_eq!(domains.len(), 2);
        assert_eq!(domains[0].name, "signapps.local");
        assert_eq!(domains[1].name, "example.com");
    }

    #[test]
    fn test_parse_domain_list_array_format() {
        let body = r#"["signapps.local","test.org"]"#;
        let domains = parse_domain_list(body);
        assert_eq!(domains.len(), 2);
        assert_eq!(domains[0].name, "signapps.local");
    }

    #[test]
    fn test_parse_domain_list_data_array() {
        let body = r#"{"data":["signapps.local"]}"#;
        let domains = parse_domain_list(body);
        assert_eq!(domains.len(), 1);
        assert_eq!(domains[0].name, "signapps.local");
    }

    #[test]
    fn test_parse_domain_list_empty() {
        let body = r#"{"data":{"items":[]}}"#;
        let domains = parse_domain_list(body);
        assert!(domains.is_empty());
    }

    #[test]
    fn test_parse_account_list_items_format() {
        let body = r#"{"data":{"items":["admin@signapps.local","alice@signapps.local"]}}"#;
        let accounts = parse_account_list(body);
        assert_eq!(accounts.len(), 2);
        assert_eq!(accounts[0].name, "admin@signapps.local");
    }

    #[test]
    fn test_parse_account_list_empty_body() {
        let body = "invalid json";
        let accounts = parse_account_list(body);
        assert!(accounts.is_empty());
    }
}
