//! OAuthError → AppError converter.
//!
//! Maps every [`signapps_oauth::OAuthError`] variant to the appropriate
//! [`signapps_common::Error`] variant, preserving both the HTTP status code
//! and the RFC 7807 `type` slug from [`OAuthError::problem_type`].
//!
//! The `problem_type` slug is embedded in the detail string so that API
//! clients can distinguish OAuth sub-errors even when they share the same
//! HTTP status code (e.g., 400 can be `provider-not-configured` or
//! `scope-not-allowed`).

use signapps_common::Error as AppError;
use signapps_oauth::OAuthError;

/// Convert [`OAuthError`] into [`AppError`], preserving status + type.
///
/// Called by P3T10 handlers once the credential resolver is wired. Declared
/// here to keep the mapping co-located with the error module.
///
/// # Examples
///
/// ```ignore
/// let err = OAuthError::ProviderNotConfigured;
/// let app_err = oauth_error_to_app_error(err);
/// // → AppError::BadRequest("oauth:provider-not-configured: provider not configured …")
/// ```
#[allow(dead_code)] // Used in P3T10 — exists here for co-location with error mapping.
pub fn oauth_error_to_app_error(err: OAuthError) -> AppError {
    let slug = err.problem_type();
    let detail = format!("oauth:{slug}: {err}");

    match err.status_code() {
        400 => AppError::BadRequest(detail),
        401 => AppError::Unauthorized,
        403 => AppError::Forbidden(detail),
        404 => AppError::NotFound(detail),
        502 => AppError::ExternalService(detail),
        _ => AppError::Internal(detail),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use signapps_oauth::{OAuthError, OAuthPurpose};

    #[test]
    fn provider_not_configured_is_bad_request() {
        let app_err = oauth_error_to_app_error(OAuthError::ProviderNotConfigured);
        assert!(matches!(app_err, AppError::BadRequest(_)));
    }

    #[test]
    fn user_access_denied_is_forbidden() {
        let app_err = oauth_error_to_app_error(OAuthError::UserAccessDenied);
        assert!(matches!(app_err, AppError::Forbidden(_)));
    }

    #[test]
    fn provider_error_is_external_service() {
        let app_err = oauth_error_to_app_error(OAuthError::ProviderError {
            error: "invalid_grant".into(),
            description: None,
        });
        assert!(matches!(app_err, AppError::ExternalService(_)));
    }

    #[test]
    fn purpose_not_allowed_is_forbidden() {
        let app_err = oauth_error_to_app_error(OAuthError::PurposeNotAllowed(OAuthPurpose::Login));
        assert!(matches!(app_err, AppError::Forbidden(_)));
    }
}
