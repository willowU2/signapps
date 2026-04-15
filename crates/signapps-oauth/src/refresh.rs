//! Refresh-token exchange against the provider's token endpoint.
//!
//! Pure function: given (provider, client_id, client_secret, refresh_token),
//! POSTs to `provider.refresh_url` (or `access_url` if refresh_url is None),
//! parses the new TokenResponse, returns it. Encryption + DB writes are
//! the caller's responsibility (`OAuthRefreshJob` does them).

use crate::provider::ProviderDefinition;
use crate::types::TokenResponse;

/// Outcome of a refresh attempt.
#[derive(Debug, Clone)]
pub enum RefreshOutcome {
    /// Success — caller encrypts + persists the new tokens.
    Refreshed(TokenResponse),
    /// Provider explicitly revoked the refresh_token (4xx with error in body).
    /// Caller should mark the row as disabled and emit token-invalidated.
    Revoked {
        /// HTTP status from the provider.
        status: u16,
        /// Provider's error code (e.g., "invalid_grant").
        error: String,
        /// Optional human-readable description.
        description: Option<String>,
    },
    /// Transient failure (network, 5xx). Caller increments
    /// consecutive_failures and retries on the next scan.
    Transient {
        /// Reason string for last_error.
        reason: String,
    },
}

/// Try to refresh a token via the provider's refresh endpoint.
///
/// Never panics. All errors converted to `RefreshOutcome::Transient` or
/// `Revoked` so the caller's retry logic can decide what to do.
pub async fn try_refresh(
    http: &reqwest::Client,
    provider: &ProviderDefinition,
    client_id: &str,
    client_secret: &str,
    refresh_token: &str,
) -> RefreshOutcome {
    let endpoint = provider
        .refresh_url
        .as_deref()
        .unwrap_or(&provider.access_url);

    let resp = match http
        .post(endpoint)
        .form(&[
            ("grant_type", "refresh_token"),
            ("refresh_token", refresh_token),
            ("client_id", client_id),
            ("client_secret", client_secret),
        ])
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            return RefreshOutcome::Transient {
                reason: format!("network: {e}"),
            }
        },
    };

    let status = resp.status();

    if status.is_client_error() {
        // 4xx — most providers signal token revocation here. Try to parse
        // the OAuth error body. If we can't, surface the raw status.
        let body = resp.text().await.unwrap_or_default();
        // A typical body: {"error":"invalid_grant","error_description":"..."}
        let parsed: Option<OAuthErrBody> = serde_json::from_str(&body).ok();
        return RefreshOutcome::Revoked {
            status: status.as_u16(),
            error: parsed
                .as_ref()
                .map(|p| p.error.clone())
                .unwrap_or_else(|| format!("http_{}", status.as_u16())),
            description: parsed.and_then(|p| p.error_description),
        };
    }

    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        return RefreshOutcome::Transient {
            reason: format!("http_{}: {body}", status.as_u16()),
        };
    }

    match resp.json::<TokenResponse>().await {
        Ok(tokens) => RefreshOutcome::Refreshed(tokens),
        Err(e) => RefreshOutcome::Transient {
            reason: format!("invalid token JSON: {e}"),
        },
    }
}

#[derive(serde::Deserialize)]
struct OAuthErrBody {
    error: String,
    #[serde(default)]
    error_description: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn revoked_outcome_carries_provider_error() {
        // Smoke check on the enum shape — full HTTP roundtrip in
        // integration tests once we have wiremock infrastructure
        // working for the engine (P3T7 marked that as a follow-up).
        let r = RefreshOutcome::Revoked {
            status: 400,
            error: "invalid_grant".into(),
            description: Some("token revoked".into()),
        };
        match r {
            RefreshOutcome::Revoked { status, .. } => assert_eq!(status, 400),
            _ => panic!("wrong variant"),
        }
    }
}
