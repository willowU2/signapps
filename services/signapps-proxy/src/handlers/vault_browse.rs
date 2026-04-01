//! Vault browse proxy handler — credential + TOTP injection for managed sites.

use axum::{
    body::Body,
    extract::{Path, State},
    http::{HeaderMap, HeaderValue, StatusCode},
    response::Response,
};
use chrono::Utc;
use hmac::{Hmac, Mac};
use sha1::Sha1;
use signapps_common::{Error, Result};
use sqlx::FromRow;
use url::Url;
use uuid::Uuid;

use crate::AppState;

// ---------------------------------------------------------------------------
// Session model (mirrors vault.browse_sessions table)
// ---------------------------------------------------------------------------

#[derive(Debug, FromRow)]
#[allow(dead_code)]
struct BrowseSession {
    id: Uuid,
    item_id: Uuid,
    token: String,
    target_url: String,
    username: String,
    password: String,
    injected_totp_secret: Option<String>,
    session_cookie: Option<String>,
    expires_at: chrono::DateTime<Utc>,
}

// ---------------------------------------------------------------------------
// TOTP computation (HMAC-SHA1, RFC 6238)
// ---------------------------------------------------------------------------

fn compute_totp(secret_base32: &str) -> Result<String> {
    let key = base32::decode(base32::Alphabet::Rfc4648 { padding: false }, secret_base32)
        .ok_or_else(|| Error::BadRequest("Invalid TOTP secret".into()))?;

    let counter = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs()
        / 30;
    let counter_bytes = counter.to_be_bytes();

    let mut mac =
        Hmac::<Sha1>::new_from_slice(&key).map_err(|_| Error::Internal("HMAC error".into()))?;
    mac.update(&counter_bytes);
    let result = mac.finalize().into_bytes();

    let offset = (result[19] & 0xf) as usize;
    let code = ((result[offset] as u32 & 0x7f) << 24
        | (result[offset + 1] as u32) << 16
        | (result[offset + 2] as u32) << 8
        | result[offset + 3] as u32)
        % 1_000_000;

    Ok(format!("{:06}", code))
}

// ---------------------------------------------------------------------------
// Session lookup
// ---------------------------------------------------------------------------

async fn lookup_session(state: &AppState, token: &str) -> Result<BrowseSession> {
    let session = sqlx::query_as::<_, BrowseSession>(
        r#"
        SELECT id, item_id, token, target_url, username, password,
               injected_totp_secret, session_cookie, expires_at
        FROM vault.browse_sessions
        WHERE token = $1
        "#,
    )
    .bind(token)
    .fetch_optional(&*state.pool)
    .await
    .map_err(|e| Error::Internal(format!("DB error: {e}")))?
    .ok_or_else(|| Error::NotFound("Browse session not found".into()))?;

    if session.expires_at < Utc::now() {
        return Err(Error::NotFound("Browse session expired".into()));
    }

    Ok(session)
}

// ---------------------------------------------------------------------------
// URL rewriting helpers
// ---------------------------------------------------------------------------

/// Given a base URL and a sub-path, resolve the target URL.
fn resolve_url(base: &str, sub_path: &str) -> Result<String> {
    let base_url = Url::parse(base).map_err(|_| Error::BadRequest("Invalid target URL".into()))?;

    // If sub_path looks absolute (starts with http), use it directly
    if sub_path.starts_with("http://") || sub_path.starts_with("https://") {
        return Ok(sub_path.to_string());
    }

    let resolved = base_url
        .join(sub_path)
        .map_err(|_| Error::BadRequest("Failed to resolve sub-path URL".into()))?;

    Ok(resolved.to_string())
}

/// Extract base origin (scheme + host + optional port) from a URL.
fn base_origin(url: &str) -> Option<String> {
    let parsed = Url::parse(url).ok()?;
    let mut origin = format!("{}://{}", parsed.scheme(), parsed.host_str()?);
    if let Some(port) = parsed.port() {
        origin.push_str(&format!(":{}", port));
    }
    Some(origin)
}

/// Rewrite absolute URLs in the HTML body that belong to the target origin
/// so that they go through `/proxy/vault/{token}/...` instead.
fn rewrite_html_urls(html: &str, token: &str, target_origin: &str) -> String {
    // We rewrite href="...", src="...", action="..." pointing to the target domain.
    // We do a simple string search & replace (no full HTML parser dependency needed).
    let proxy_prefix = format!("/proxy/vault/{}", token);

    let mut out = String::with_capacity(html.len());
    let mut rest = html;

    // Attributes we care about
    let attrs = ["href=\"", "src=\"", "action=\""];

    while !rest.is_empty() {
        // Find the earliest attribute occurrence
        let mut earliest: Option<(usize, &str)> = None;
        for attr in &attrs {
            if let Some(pos) = rest.find(attr) {
                if earliest.is_none() || pos < earliest.unwrap().0 {
                    earliest = Some((pos, attr));
                }
            }
        }

        let (pos, attr) = match earliest {
            Some(e) => e,
            None => {
                out.push_str(rest);
                break;
            },
        };

        // Push everything up to (and including) the attribute name+quote
        out.push_str(&rest[..pos + attr.len()]);
        rest = &rest[pos + attr.len()..];

        // Find closing quote
        let end_quote = rest.find('"').unwrap_or(rest.len());
        let url_val = &rest[..end_quote];

        // Only rewrite if it starts with the target origin
        if let Some(path_part) = url_val.strip_prefix(target_origin) {
            let path_part = if path_part.is_empty() { "/" } else { path_part };
            out.push_str(&proxy_prefix);
            out.push_str(path_part);
        } else {
            out.push_str(url_val);
        }

        rest = &rest[end_quote..];
    }

    out
}

/// Build the credential-injection script.
fn build_inject_script(username: &str, password: &str, totp_code: &str) -> String {
    let escaped_username = username.replace('\'', "\\'");
    let escaped_password = password.replace('\'', "\\'");

    format!(
        r#"<script>
(function(){{
  var u='{username}',p='{password}',t='{totp}';
  var pi=document.querySelector('input[type="password"]');
  if(pi){{
    var fi=pi.form||pi.closest('form');
    if(fi){{
      var ui=fi.querySelector('input[type="text"],input[type="email"],input[name*="user"],input[name*="login"],input[name*="email"]');
      if(ui){{ui.value=u;ui.dispatchEvent(new Event('input',{{bubbles:true}}))}}
      pi.value=p;pi.dispatchEvent(new Event('input',{{bubbles:true}}));
    }}
  }}
  if(t){{
    var ti=document.querySelector('input[maxlength="6"],input[name*="code"],input[name*="otp"],input[name*="totp"],input[name*="2fa"]');
    if(ti){{ti.value=t;ti.dispatchEvent(new Event('input',{{bubbles:true}}))}}
  }}
}})();
</script>"#,
        username = escaped_username,
        password = escaped_password,
        totp = totp_code,
    )
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

async fn log_browse_action(state: &AppState, item_id: Uuid) {
    let result = sqlx::query(
        r#"
        INSERT INTO vault.audit_log (item_id, action, performed_at)
        VALUES ($1, 'browse', NOW())
        "#,
    )
    .bind(item_id)
    .execute(&*state.pool)
    .await;

    if let Err(e) = result {
        tracing::warn!(error = %e, item_id = %item_id, "Failed to write browse audit log");
    }
}

// ---------------------------------------------------------------------------
// Helper: build a plain-text Response
// ---------------------------------------------------------------------------

fn plain_response(status: StatusCode, body: impl Into<String>) -> Response {
    Response::builder()
        .status(status)
        .header("content-type", "text/plain")
        .body(Body::from(body.into()))
        .unwrap_or_default()
}

// ---------------------------------------------------------------------------
// Core proxy logic
// ---------------------------------------------------------------------------

async fn proxy_vault_request(
    _state: &AppState,
    session: &BrowseSession,
    target_url: &str,
    token: &str,
    incoming_headers: &HeaderMap,
) -> Result<Response> {
    // Build reqwest client
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::limited(5))
        .build()
        .map_err(|e| Error::Internal(format!("HTTP client error: {e}")))?;

    let mut req_builder = client.get(target_url);

    // Forward relevant headers from the incoming request
    for name in &[
        axum::http::header::ACCEPT,
        axum::http::header::ACCEPT_LANGUAGE,
    ] {
        if let Some(val) = incoming_headers.get(name) {
            if let Ok(s) = val.to_str() {
                req_builder = req_builder.header(name.as_str(), s);
            }
        }
    }

    // Forward session cookie if present
    if let Some(ref cookie) = session.session_cookie {
        req_builder = req_builder.header("cookie", cookie.as_str());
    }

    let resp = req_builder
        .send()
        .await
        .map_err(|e| Error::Internal(format!("Upstream fetch error: {e}")))?;

    let status = resp.status();
    let status_u16 = status.as_u16();
    let content_type = resp
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();

    let is_html = content_type.contains("text/html");

    if is_html {
        // Compute TOTP code if secret is present
        let totp_code = match &session.injected_totp_secret {
            Some(secret) => compute_totp(secret).unwrap_or_default(),
            None => String::new(),
        };

        let html_bytes = resp
            .bytes()
            .await
            .map_err(|e| Error::Internal(format!("Body read error: {e}")))?;

        let mut html = String::from_utf8_lossy(&html_bytes).into_owned();

        // Rewrite URLs
        if let Some(origin) = base_origin(&session.target_url) {
            html = rewrite_html_urls(&html, token, &origin);
        }

        // Inject credential script before </body>
        let script = build_inject_script(&session.username, &session.password, &totp_code);
        html = if let Some(pos) = html.to_lowercase().rfind("</body>") {
            format!("{}{}{}", &html[..pos], script, &html[pos..])
        } else {
            format!("{}{}", html, script)
        };

        let mut response = Response::builder()
            .status(status_u16)
            .header("content-type", "text/html; charset=utf-8")
            .header(
                "content-security-policy",
                "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:",
            )
            .body(Body::from(html))
            .map_err(|e| Error::Internal(format!("Response build error: {e}")))?;

        // Allow framing from our own origin
        response
            .headers_mut()
            .insert("x-frame-options", HeaderValue::from_static("SAMEORIGIN"));

        Ok(response)
    } else {
        // Transparent proxy for non-HTML resources
        let bytes = resp
            .bytes()
            .await
            .map_err(|e| Error::Internal(format!("Body read error: {e}")))?;

        let response = Response::builder()
            .status(status_u16)
            .header("content-type", content_type.as_str())
            .body(Body::from(bytes))
            .map_err(|e| Error::Internal(format!("Response build error: {e}")))?;

        Ok(response)
    }
}

// ---------------------------------------------------------------------------
// Axum handlers
// ---------------------------------------------------------------------------

/// GET /proxy/vault/:token — Proxy the target website root with credential injection.
#[tracing::instrument(skip_all, fields(token))]
pub async fn vault_browse(
    State(state): State<AppState>,
    Path(token): Path<String>,
    headers: HeaderMap,
) -> Response {
    tracing::Span::current().record("token", token.as_str());

    let session = match lookup_session(&state, &token).await {
        Ok(s) => s,
        Err(e) => {
            return match e {
                Error::NotFound(msg) => plain_response(StatusCode::NOT_FOUND, msg),
                _ => plain_response(StatusCode::INTERNAL_SERVER_ERROR, "Internal error"),
            };
        },
    };

    let target_url = session.target_url.clone();
    let item_id = session.item_id;

    match proxy_vault_request(&state, &session, &target_url, &token, &headers).await {
        Ok(resp) => {
            log_browse_action(&state, item_id).await;
            resp
        },
        Err(e) => {
            tracing::error!(error = %e, "Vault browse proxy error");
            plain_response(StatusCode::BAD_GATEWAY, format!("Proxy error: {e}"))
        },
    }
}

/// GET /proxy/vault/:token/*path — Proxy sub-resources of the target website.
#[tracing::instrument(skip_all, fields(token, path))]
pub async fn vault_browse_sub(
    State(state): State<AppState>,
    Path((token, sub_path)): Path<(String, String)>,
    headers: HeaderMap,
) -> Response {
    tracing::Span::current().record("token", token.as_str());
    tracing::Span::current().record("path", sub_path.as_str());

    let session = match lookup_session(&state, &token).await {
        Ok(s) => s,
        Err(e) => {
            return match e {
                Error::NotFound(msg) => plain_response(StatusCode::NOT_FOUND, msg),
                _ => plain_response(StatusCode::INTERNAL_SERVER_ERROR, "Internal error"),
            };
        },
    };

    let sub = format!("/{}", sub_path);
    let target_url = match resolve_url(&session.target_url, &sub) {
        Ok(u) => u,
        Err(e) => {
            return plain_response(StatusCode::BAD_REQUEST, format!("URL error: {e}"));
        },
    };

    let item_id = session.item_id;

    match proxy_vault_request(&state, &session, &target_url, &token, &headers).await {
        Ok(resp) => {
            log_browse_action(&state, item_id).await;
            resp
        },
        Err(e) => {
            tracing::error!(error = %e, "Vault browse sub-resource proxy error");
            plain_response(StatusCode::BAD_GATEWAY, format!("Proxy error: {e}"))
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_inject_script_contains_placeholders() {
        let script = build_inject_script("admin", "s3cr3t", "123456");
        assert!(script.contains("admin"));
        assert!(script.contains("s3cr3t"));
        assert!(script.contains("123456"));
    }

    #[test]
    fn test_rewrite_html_urls_replaces_origin() {
        let html = r#"<a href="https://example.com/login">login</a>"#;
        let result = rewrite_html_urls(html, "tok123", "https://example.com");
        assert!(result.contains("/proxy/vault/tok123/login"));
        assert!(!result.contains("https://example.com/login"));
    }

    #[test]
    fn test_rewrite_html_urls_leaves_external_alone() {
        let html = r#"<img src="https://cdn.other.com/logo.png">"#;
        let result = rewrite_html_urls(html, "tok123", "https://example.com");
        assert!(result.contains("https://cdn.other.com/logo.png"));
    }

    #[test]
    fn test_resolve_url_absolute() {
        let result = resolve_url("https://example.com", "/api/data").unwrap();
        assert_eq!(result, "https://example.com/api/data");
    }

    #[test]
    fn test_resolve_url_passthrough_http() {
        let result = resolve_url("https://example.com", "https://other.com/path").unwrap();
        assert_eq!(result, "https://other.com/path");
    }

    #[test]
    fn test_base_origin_extracts_correctly() {
        assert_eq!(
            base_origin("https://example.com/login?foo=bar"),
            Some("https://example.com".to_string())
        );
        assert_eq!(
            base_origin("http://example.com:8080/path"),
            Some("http://example.com:8080".to_string())
        );
    }
}
