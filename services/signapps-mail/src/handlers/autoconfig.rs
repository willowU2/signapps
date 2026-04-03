//! Email client auto-configuration handlers.
//!
//! Provides automatic configuration discovery for email clients:
//!
//! - **Thunderbird autoconfig** (`GET /mail/config-v1.1.xml`) — Mozilla autoconfig XML.
//! - **Outlook autodiscover** (`POST /autodiscover/autodiscover.xml`) — Microsoft
//!   Autodiscover POX protocol.
//! - **CalDAV/CardDAV** well-known redirects (if not already on the DAV port).
//! - **JMAP** well-known redirect (already handled in `jmap::session`).
//!
//! These endpoints are **unauthenticated** — email clients call them before the
//! user has configured credentials.

use axum::{
    extract::{Query, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde::Deserialize;

use crate::AppState;

// ---------------------------------------------------------------------------
// Thunderbird autoconfig
// ---------------------------------------------------------------------------

/// Query parameters for the autoconfig endpoint.
#[derive(Debug, Deserialize)]
pub struct AutoconfigQuery {
    /// Email address being configured (e.g. `user@example.com`).
    pub emailaddress: Option<String>,
}

/// Thunderbird / Mozilla autoconfig endpoint.
///
/// Returns an XML document describing IMAP and SMTP settings for the
/// requested email domain. Clients access this via:
/// - `GET /mail/config-v1.1.xml?emailaddress=user@domain.com`
/// - `GET /.well-known/autoconfig/mail/config-v1.1.xml`
///
/// # Errors
///
/// Returns 400 if the email address is missing or has no domain part.
/// Returns 404 if the domain is not hosted locally.
///
/// # Panics
///
/// None.
#[utoipa::path(
    get,
    path = "/mail/config-v1.1.xml",
    tag = "autoconfig",
    params(
        ("emailaddress" = Option<String>, Query, description = "Email address to configure"),
    ),
    responses(
        (status = 200, description = "Autoconfig XML", content_type = "application/xml"),
        (status = 400, description = "Missing or invalid email address"),
        (status = 404, description = "Domain not hosted here"),
    )
)]
#[tracing::instrument(skip(state))]
pub async fn thunderbird_autoconfig(
    State(state): State<AppState>,
    Query(params): Query<AutoconfigQuery>,
) -> Response {
    let email = match params.emailaddress {
        Some(ref e) if e.contains('@') => e.clone(),
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "error": "Missing or invalid emailaddress parameter"
                })),
            )
                .into_response();
        },
    };

    let domain = match email.rsplit_once('@') {
        Some((_, d)) => d.to_lowercase(),
        None => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": "Invalid email address" })),
            )
                .into_response();
        },
    };

    // Verify domain is local
    let domain_exists: bool =
        sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM mailserver.domains WHERE LOWER(name) = $1 AND COALESCE(is_active, true))",
        )
        .bind(&domain)
        .fetch_one(&state.pool)
        .await
        .unwrap_or(false);

    if !domain_exists {
        return (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Domain not hosted here" })),
        )
            .into_response();
    }

    let mail_hostname =
        std::env::var("MAIL_HOSTNAME").unwrap_or_else(|_| format!("mail.{}", domain));

    let xml = format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<clientConfig version="1.1">
  <emailProvider id="{domain}">
    <domain>{domain}</domain>
    <displayName>SignApps Mail</displayName>
    <displayShortName>SignApps</displayShortName>
    <incomingServer type="imap">
      <hostname>{hostname}</hostname>
      <port>993</port>
      <socketType>SSL</socketType>
      <authentication>password-cleartext</authentication>
      <username>%EMAILADDRESS%</username>
    </incomingServer>
    <outgoingServer type="smtp">
      <hostname>{hostname}</hostname>
      <port>587</port>
      <socketType>STARTTLS</socketType>
      <authentication>password-cleartext</authentication>
      <username>%EMAILADDRESS%</username>
    </outgoingServer>
  </emailProvider>
</clientConfig>"#,
        domain = domain,
        hostname = mail_hostname,
    );

    (
        StatusCode::OK,
        [(header::CONTENT_TYPE, "application/xml; charset=utf-8")],
        xml,
    )
        .into_response()
}

// ---------------------------------------------------------------------------
// Outlook autodiscover
// ---------------------------------------------------------------------------

/// Outlook Autodiscover POX endpoint.
///
/// Accepts a POST with XML body containing the email address, and returns
/// Outlook-compatible server settings. Clients access this via:
/// - `POST /autodiscover/autodiscover.xml`
///
/// # Errors
///
/// Returns 400 if the XML body cannot be parsed.
/// Returns 404 if the domain is not hosted locally.
///
/// # Panics
///
/// None.
#[utoipa::path(
    post,
    path = "/autodiscover/autodiscover.xml",
    tag = "autoconfig",
    responses(
        (status = 200, description = "Autodiscover XML response", content_type = "application/xml"),
        (status = 400, description = "Invalid request"),
        (status = 404, description = "Domain not hosted here"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn outlook_autodiscover(State(state): State<AppState>, body: String) -> Response {
    // Extract email from the XML body (simplified parsing)
    // Outlook sends: <EMailAddress>user@domain.com</EMailAddress>
    let email = extract_email_from_autodiscover_xml(&body);

    let email = match email {
        Some(e) => e,
        None => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": "Could not extract email from request" })),
            )
                .into_response();
        },
    };

    let domain = match email.rsplit_once('@') {
        Some((_, d)) => d.to_lowercase(),
        None => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": "Invalid email address" })),
            )
                .into_response();
        },
    };

    // Verify domain is local
    let domain_exists: bool =
        sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM mailserver.domains WHERE LOWER(name) = $1 AND COALESCE(is_active, true))",
        )
        .bind(&domain)
        .fetch_one(&state.pool)
        .await
        .unwrap_or(false);

    if !domain_exists {
        return (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Domain not hosted here" })),
        )
            .into_response();
    }

    let mail_hostname =
        std::env::var("MAIL_HOSTNAME").unwrap_or_else(|_| format!("mail.{}", domain));

    let xml = format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<Autodiscover xmlns="http://schemas.microsoft.com/exchange/autodiscover/responseschema/2006">
  <Response xmlns="http://schemas.microsoft.com/exchange/autodiscover/outlook/responseschema/2006a">
    <Account>
      <AccountType>email</AccountType>
      <Action>settings</Action>
      <Protocol>
        <Type>IMAP</Type>
        <Server>{hostname}</Server>
        <Port>993</Port>
        <LoginName>{email}</LoginName>
        <DomainRequired>off</DomainRequired>
        <SPA>off</SPA>
        <SSL>on</SSL>
        <AuthRequired>on</AuthRequired>
      </Protocol>
      <Protocol>
        <Type>SMTP</Type>
        <Server>{hostname}</Server>
        <Port>587</Port>
        <LoginName>{email}</LoginName>
        <DomainRequired>off</DomainRequired>
        <SPA>off</SPA>
        <Encryption>TLS</Encryption>
        <AuthRequired>on</AuthRequired>
        <UsePOPAuth>on</UsePOPAuth>
        <SMTPLast>off</SMTPLast>
      </Protocol>
    </Account>
  </Response>
</Autodiscover>"#,
        hostname = mail_hostname,
        email = email,
    );

    (
        StatusCode::OK,
        [(header::CONTENT_TYPE, "application/xml; charset=utf-8")],
        xml,
    )
        .into_response()
}

/// Extract email address from Outlook Autodiscover XML request body.
///
/// Performs simple string extraction without a full XML parser to avoid
/// adding a dependency. Looks for `<EMailAddress>...</EMailAddress>`.
///
/// # Panics
///
/// None.
fn extract_email_from_autodiscover_xml(xml: &str) -> Option<String> {
    // Look for <EMailAddress>user@domain.com</EMailAddress>
    let start_tag = "<EMailAddress>";
    let end_tag = "</EMailAddress>";

    let start = xml.find(start_tag)? + start_tag.len();
    let end = xml[start..].find(end_tag)? + start;
    let email = xml[start..end].trim().to_string();

    if email.contains('@') {
        Some(email)
    } else {
        None
    }
}

// ---------------------------------------------------------------------------
// Well-known redirects (for HTTP on port 3012)
// ---------------------------------------------------------------------------

/// CalDAV well-known redirect.
///
/// Redirects `/.well-known/caldav` to the CalDAV principal URL on the DAV port.
/// This is served on the main HTTP port (3012) for clients that probe the
/// primary domain before discovering the DAV port.
///
/// # Panics
///
/// None.
#[tracing::instrument]
pub async fn well_known_caldav() -> Response {
    let dav_base =
        std::env::var("DAV_BASE_URL").unwrap_or_else(|_| "http://localhost:8443".to_string());
    (
        StatusCode::MOVED_PERMANENTLY,
        [(header::LOCATION, format!("{}/dav/calendars/", dav_base))],
        "",
    )
        .into_response()
}

/// CardDAV well-known redirect.
///
/// Redirects `/.well-known/carddav` to the CardDAV principal URL on the DAV port.
///
/// # Panics
///
/// None.
#[tracing::instrument]
pub async fn well_known_carddav() -> Response {
    let dav_base =
        std::env::var("DAV_BASE_URL").unwrap_or_else(|_| "http://localhost:8443".to_string());
    (
        StatusCode::MOVED_PERMANENTLY,
        [(header::LOCATION, format!("{}/dav/addressbooks/", dav_base))],
        "",
    )
        .into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_email_from_autodiscover_xml() {
        let xml = r#"<?xml version="1.0"?>
<Autodiscover xmlns="http://schemas.microsoft.com/exchange/autodiscover/outlook/requestschema/2006">
  <Request>
    <EMailAddress>user@example.com</EMailAddress>
    <AcceptableResponseSchema>http://schemas.microsoft.com/exchange/autodiscover/outlook/responseschema/2006a</AcceptableResponseSchema>
  </Request>
</Autodiscover>"#;
        let email = extract_email_from_autodiscover_xml(xml);
        assert_eq!(email, Some("user@example.com".to_string()));
    }

    #[test]
    fn test_extract_email_missing() {
        let xml = "<Autodiscover><Request></Request></Autodiscover>";
        let email = extract_email_from_autodiscover_xml(xml);
        assert_eq!(email, None);
    }

    #[test]
    fn test_extract_email_no_at() {
        let xml = "<Autodiscover><Request><EMailAddress>notanemail</EMailAddress></Request></Autodiscover>";
        let email = extract_email_from_autodiscover_xml(xml);
        assert_eq!(email, None);
    }

    #[test]
    fn test_extract_email_with_whitespace() {
        let xml = "<EMailAddress>  user@test.com  </EMailAddress>";
        let email = extract_email_from_autodiscover_xml(xml);
        assert_eq!(email, Some("user@test.com".to_string()));
    }
}
