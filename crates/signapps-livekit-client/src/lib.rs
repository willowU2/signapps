//! # signapps-livekit-client
//!
//! Thin, async HTTP client for the [LiveKit Server](https://livekit.io) REST (Twirp) API.
//!
//! Progressive surface. Phase 1 scaffold only exposes [`LiveKitClient`] plus
//! the error hierarchy; room/participant/egress helpers are wired in
//! subsequent commits.

#![warn(missing_docs)]

use std::time::Duration;

use reqwest::redirect::Policy;
use thiserror::Error;

/// Errors emitted by the LiveKit client.
#[derive(Debug, Error)]
pub enum LiveKitError {
    /// Transport-level HTTP error (connect, timeout, DNS, decoding…).
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),

    /// JWT encoding/decoding failure.
    #[error("JWT error: {0}")]
    Jwt(#[from] jsonwebtoken::errors::Error),

    /// Missing or invalid configuration (env vars, URL, …).
    #[error("config error: {0}")]
    Config(String),

    /// LiveKit server responded with a non-success status.
    #[error("upstream LiveKit error ({status}): {body}")]
    Upstream {
        /// HTTP status code returned by LiveKit.
        status: u16,
        /// Response body (usually a Twirp error payload).
        body: String,
    },
}

/// Convenient `Result` alias bound to [`LiveKitError`].
pub type Result<T> = std::result::Result<T, LiveKitError>;

/// Async client for the LiveKit Server API.
///
/// Build via [`LiveKitClient::new`] or [`LiveKitClient::from_env`]. The
/// client is `Clone`-friendly and designed to be kept in application state
/// (wrap in `Arc` if cloning becomes expensive).
#[derive(Debug, Clone)]
pub struct LiveKitClient {
    /// Base URL of the LiveKit server (e.g. `http://localhost:7880`).
    pub base_url: String,
    /// LiveKit API key (used as JWT `iss`).
    pub api_key: String,
    /// LiveKit API secret (HMAC-SHA256 signing key).
    pub api_secret: String,
    /// Shared reqwest client.
    #[allow(dead_code)]
    pub(crate) http: reqwest::Client,
}

impl LiveKitClient {
    /// Create a new client from explicit parameters.
    ///
    /// # Errors
    ///
    /// Returns [`LiveKitError::Config`] if the internal HTTP client cannot be
    /// built.
    pub fn new(
        base_url: impl Into<String>,
        api_key: impl Into<String>,
        api_secret: impl Into<String>,
    ) -> Result<Self> {
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(10))
            .redirect(Policy::none())
            .build()
            .map_err(|e| LiveKitError::Config(format!("failed to build HTTP client: {e}")))?;
        Ok(Self {
            base_url: base_url.into(),
            api_key: api_key.into(),
            api_secret: api_secret.into(),
            http,
        })
    }

    /// Build a client from `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.
    ///
    /// # Errors
    ///
    /// Returns [`LiveKitError::Config`] if any of those env vars are missing
    /// or if the HTTP client cannot be initialised.
    pub fn from_env() -> Result<Self> {
        let base_url = std::env::var("LIVEKIT_URL")
            .map_err(|_| LiveKitError::Config("LIVEKIT_URL must be set".into()))?;
        let api_key = std::env::var("LIVEKIT_API_KEY")
            .map_err(|_| LiveKitError::Config("LIVEKIT_API_KEY must be set".into()))?;
        let api_secret = std::env::var("LIVEKIT_API_SECRET")
            .map_err(|_| LiveKitError::Config("LIVEKIT_API_SECRET must be set".into()))?;
        Self::new(base_url, api_key, api_secret)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn client_builds_with_explicit_params() {
        let c = LiveKitClient::new("http://localhost:7880", "k", "s").expect("builds");
        assert_eq!(c.base_url, "http://localhost:7880");
        assert_eq!(c.api_key, "k");
        assert_eq!(c.api_secret, "s");
    }
}
