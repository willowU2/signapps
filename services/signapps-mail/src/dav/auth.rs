//! HTTP Basic Auth for DAV clients.
//!
//! Extracts credentials from the `Authorization: Basic <base64>` header,
//! verifies them against `mailserver.accounts.password_hash` using Argon2,
//! and returns the authenticated account information.

use axum::{
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
};
use sqlx::{Pool, Postgres};
use uuid::Uuid;

/// Authenticated DAV user context.
///
/// Passed to DAV handlers after successful HTTP Basic Auth.
#[derive(Debug, Clone)]
pub struct DavAuth {
    /// The account ID in `mailserver.accounts`.
    pub account_id: Uuid,
    /// The email address used for authentication.
    pub email: String,
    /// The domain ID for the account.
    pub domain_id: Uuid,
}

/// Minimal account row for authentication.
#[derive(Debug, sqlx::FromRow)]
struct AuthAccountRow {
    id: Uuid,
    domain_id: Uuid,
    address: String,
    password_hash: String,
}

/// Extract and verify HTTP Basic Auth credentials from the request headers.
///
/// # Errors
///
/// Returns an HTTP 401 response if credentials are missing, invalid, or
/// do not match any active account.
///
/// # Panics
///
/// None.
#[tracing::instrument(skip(pool, headers))]
pub async fn authenticate_basic(
    pool: &Pool<Postgres>,
    headers: &HeaderMap,
) -> Result<DavAuth, impl IntoResponse> {
    let auth_header = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .ok_or((
            StatusCode::UNAUTHORIZED,
            [("WWW-Authenticate", "Basic realm=\"SignApps DAV\"")],
            "Missing Authorization header",
        ))?;

    if !auth_header.starts_with("Basic ") {
        return Err((
            StatusCode::UNAUTHORIZED,
            [("WWW-Authenticate", "Basic realm=\"SignApps DAV\"")],
            "Invalid auth scheme",
        ));
    }

    let decoded = base64::Engine::decode(
        &base64::engine::general_purpose::STANDARD,
        &auth_header[6..],
    )
    .map_err(|_| {
        (
            StatusCode::UNAUTHORIZED,
            [("WWW-Authenticate", "Basic realm=\"SignApps DAV\"")],
            "Invalid base64 in Authorization",
        )
    })?;

    let credentials = String::from_utf8(decoded).map_err(|_| {
        (
            StatusCode::UNAUTHORIZED,
            [("WWW-Authenticate", "Basic realm=\"SignApps DAV\"")],
            "Invalid UTF-8 in credentials",
        )
    })?;

    let (username, password) = credentials.split_once(':').ok_or((
        StatusCode::UNAUTHORIZED,
        [("WWW-Authenticate", "Basic realm=\"SignApps DAV\"")],
        "Invalid credential format",
    ))?;

    // Look up account by email address
    let account: Option<AuthAccountRow> = sqlx::query_as(
        "SELECT id, domain_id, address, password_hash FROM mailserver.accounts WHERE LOWER(address) = LOWER($1) AND COALESCE(is_active, true)"
    )
    .bind(username)
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        tracing::error!("DAV auth DB error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            [("WWW-Authenticate", "Basic realm=\"SignApps DAV\"")],
            "Internal error",
        )
    })?;

    let account = account.ok_or((
        StatusCode::UNAUTHORIZED,
        [("WWW-Authenticate", "Basic realm=\"SignApps DAV\"")],
        "Unknown account",
    ))?;

    // Verify password using Argon2
    let parsed_hash = argon2::PasswordHash::new(&account.password_hash).map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            [("WWW-Authenticate", "Basic realm=\"SignApps DAV\"")],
            "Invalid stored hash",
        )
    })?;

    use argon2::PasswordVerifier;
    argon2::Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .map_err(|_| {
            (
                StatusCode::UNAUTHORIZED,
                [("WWW-Authenticate", "Basic realm=\"SignApps DAV\"")],
                "Invalid password",
            )
        })?;

    tracing::debug!(account_id = %account.id, email = %account.address, "DAV auth succeeded");

    Ok(DavAuth {
        account_id: account.id,
        email: account.address,
        domain_id: account.domain_id,
    })
}

/// Helper: extract the email address from a DAV path.
///
/// Paths follow the pattern `/dav/calendars/<email>/...` or
/// `/dav/addressbooks/<email>/...`.
///
/// # Examples
///
/// ```ignore
/// let email = extract_email_from_path("/dav/calendars/user@example.com/cal-id/");
/// assert_eq!(email, Some("user@example.com"));
/// ```
pub fn extract_email_from_path(path: &str) -> Option<&str> {
    let parts: Vec<&str> = path.trim_matches('/').split('/').collect();
    // Expected: ["dav", "calendars"|"addressbooks", "email", ...]
    if parts.len() >= 3 {
        Some(parts[2])
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_email_from_path() {
        assert_eq!(
            extract_email_from_path("/dav/calendars/user@example.com/cal-id/"),
            Some("user@example.com")
        );
        assert_eq!(
            extract_email_from_path("/dav/addressbooks/alice@domain.com/default/contact.vcf"),
            Some("alice@domain.com")
        );
        assert_eq!(extract_email_from_path("/dav/"), None);
    }
}
