//! Top-level OAuth errors, mapped to RFC 7807 Problem Details.

use crate::catalog::CatalogError;
use crate::protocol::OAuthPurpose;
use crate::state::StateError;
use thiserror::Error;

/// All OAuth-level errors.
///
/// These map 1:1 to RFC 7807 Problem Details responses via the
/// conversion into `signapps_common::AppError` (Plan 3).
#[derive(Debug, Error)]
pub enum OAuthError {
    /// Provider is not configured for this tenant.
    #[error("provider not configured for this tenant")]
    ProviderNotConfigured,

    /// Provider is configured but not enabled.
    #[error("provider disabled")]
    ProviderDisabled,

    /// User does not have access to this provider (failed ScopeResolver check).
    #[error("user not allowed to use this provider")]
    UserAccessDenied,

    /// Purpose (login/integration) not allowed for this provider.
    #[error("purpose {0:?} not allowed for this provider")]
    PurposeNotAllowed(OAuthPurpose),

    /// FlowState token invalid (tampered, expired, malformed).
    #[error("invalid state: {0}")]
    InvalidState(#[from] StateError),

    /// Provider returned an error during the OAuth exchange.
    #[error("provider returned error: {error}: {description:?}")]
    ProviderError {
        /// Error code from the provider.
        error: String,
        /// Human-readable description.
        description: Option<String>,
    },

    /// id_token validation failed (OIDC).
    #[error("id_token validation failed: {0}")]
    IdTokenInvalid(String),

    /// SAML assertion validation failed.
    #[error("saml assertion invalid: {0}")]
    SamlInvalid(String),

    /// Requested scope is not in the tenant's allowed_scopes.
    #[error("scope {0:?} not in allowed_scopes")]
    ScopeNotAllowed(String),

    /// Catalog error.
    #[error(transparent)]
    Catalog(#[from] CatalogError),

    /// Required template variable or extra param missing.
    #[error("required parameter missing: {0}")]
    MissingParameter(String),

    /// Crypto error when handling encrypted config fields.
    #[error("crypto error: {0}")]
    Crypto(String),

    /// Database error.
    #[error("database error: {0}")]
    Database(String),
}

impl OAuthError {
    /// Map to an HTTP status code for RFC 7807 responses.
    #[must_use]
    pub fn status_code(&self) -> u16 {
        match self {
            Self::ProviderNotConfigured
            | Self::ProviderDisabled
            | Self::MissingParameter(_)
            | Self::ScopeNotAllowed(_) => 400,
            Self::UserAccessDenied | Self::PurposeNotAllowed(_) => 403,
            Self::InvalidState(_) | Self::IdTokenInvalid(_) | Self::SamlInvalid(_) => 401,
            Self::ProviderError { .. } => 502,
            Self::Catalog(CatalogError::NotFound(_)) => 404,
            Self::Catalog(CatalogError::Parse(_)) | Self::Crypto(_) | Self::Database(_) => 500,
        }
    }

    /// Return the RFC 7807 `type` URI fragment.
    ///
    /// Full URIs are namespaced under `https://errors.signapps.com/oauth/`
    /// and assembled by the HTTP layer.
    #[must_use]
    pub fn problem_type(&self) -> &'static str {
        match self {
            Self::ProviderNotConfigured => "provider-not-configured",
            Self::ProviderDisabled => "provider-disabled",
            Self::UserAccessDenied => "user-access-denied",
            Self::PurposeNotAllowed(_) => "purpose-not-allowed",
            Self::InvalidState(_) => "invalid-state",
            Self::ProviderError { .. } => "provider-error",
            Self::IdTokenInvalid(_) => "id-token-invalid",
            Self::SamlInvalid(_) => "saml-invalid",
            Self::ScopeNotAllowed(_) => "scope-not-allowed",
            Self::Catalog(_) => "catalog-error",
            Self::MissingParameter(_) => "missing-parameter",
            Self::Crypto(_) => "crypto-error",
            Self::Database(_) => "database-error",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn status_code_mapping() {
        assert_eq!(OAuthError::ProviderNotConfigured.status_code(), 400);
        assert_eq!(OAuthError::UserAccessDenied.status_code(), 403);
        assert_eq!(
            OAuthError::InvalidState(StateError::Expired).status_code(),
            401
        );
        assert_eq!(
            OAuthError::ProviderError {
                error: "invalid_grant".into(),
                description: None,
            }
            .status_code(),
            502
        );
    }

    #[test]
    fn problem_type_is_stable() {
        assert_eq!(
            OAuthError::ProviderNotConfigured.problem_type(),
            "provider-not-configured"
        );
        assert_eq!(
            OAuthError::UserAccessDenied.problem_type(),
            "user-access-denied"
        );
    }

    #[test]
    fn display_formats() {
        let err = OAuthError::PurposeNotAllowed(OAuthPurpose::Login);
        assert!(err.to_string().contains("login") || err.to_string().contains("Login"));
    }
}
