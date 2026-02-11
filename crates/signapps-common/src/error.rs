//! Error types for the SignApps Platform.
//!
//! Implements RFC 7807 Problem Details for HTTP APIs.
//! All errors are returned with consistent JSON structure.

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Result type alias using our Error type.
pub type Result<T> = std::result::Result<T, Error>;

/// Application-wide error type.
#[derive(Error, Debug)]
pub enum Error {
    // Authentication errors
    #[error("Invalid credentials")]
    InvalidCredentials,

    #[error("Token expired")]
    TokenExpired,

    #[error("Invalid token")]
    InvalidToken,

    #[error("Unauthorized")]
    Unauthorized,

    #[error("Forbidden: {0}")]
    Forbidden(String),

    #[error("MFA required")]
    MfaRequired,

    #[error("Invalid MFA code")]
    InvalidMfaCode,

    // LDAP/Active Directory errors
    #[error("LDAP connection failed: {0}")]
    LdapConnectionFailed(String),

    #[error("LDAP bind failed: {0}")]
    LdapBindFailed(String),

    #[error("LDAP user not found")]
    LdapUserNotFound,

    // Group management errors
    #[error("Group not found: {0}")]
    GroupNotFound(String),

    #[error("Group permission denied: {0}")]
    GroupPermissionDenied(String),

    // Container ownership errors
    #[error("Container not owned by user: {0}")]
    ContainerNotOwned(String),

    // Resource errors
    #[error("Resource not found: {0}")]
    NotFound(String),

    #[error("Resource already exists: {0}")]
    AlreadyExists(String),

    #[error("Conflict: {0}")]
    Conflict(String),

    // Validation errors
    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Bad request: {0}")]
    BadRequest(String),

    // Database errors
    #[error("Database error: {0}")]
    Database(String),

    // External service errors
    #[error("External service error: {0}")]
    ExternalService(String),

    #[error("Docker error: {0}")]
    Docker(String),

    #[error("Storage error: {0}")]
    Storage(String),

    #[error("AI service error: {0}")]
    AiService(String),

    // RAID errors
    #[error("RAID error: {0}")]
    Raid(String),

    #[error("Disk not found: {0}")]
    DiskNotFound(String),

    // Internal errors
    #[error("Internal error: {0}")]
    Internal(String),

    #[error("Configuration error: {0}")]
    Configuration(String),

    #[error(transparent)]
    Anyhow(#[from] anyhow::Error),
}

/// RFC 7807 Problem Details response body.
///
/// See: <https://datatracker.ietf.org/doc/html/rfc7807>
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProblemDetails {
    /// A URI reference that identifies the problem type.
    /// For SignApps, uses format: "urn:signapps:error:{type}"
    #[serde(rename = "type")]
    pub problem_type: String,

    /// A short, human-readable summary of the problem type.
    pub title: String,

    /// The HTTP status code.
    pub status: u16,

    /// A human-readable explanation specific to this occurrence.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,

    /// A URI reference that identifies the specific occurrence.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub instance: Option<String>,

    /// Extension: Machine-readable error code for client handling.
    pub error_code: String,

    /// Extension: Additional error context (validation errors, etc.)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub errors: Option<serde_json::Value>,

    /// Extension: Request ID for tracing.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub request_id: Option<String>,
}

impl ProblemDetails {
    /// Create a new ProblemDetails instance.
    pub fn new(status: StatusCode, error_code: &str, title: &str) -> Self {
        Self {
            problem_type: format!("urn:signapps:error:{}", error_code.to_lowercase()),
            title: title.to_string(),
            status: status.as_u16(),
            detail: None,
            instance: None,
            error_code: error_code.to_string(),
            errors: None,
            request_id: None,
        }
    }

    /// Add a detailed message.
    pub fn with_detail(mut self, detail: impl Into<String>) -> Self {
        self.detail = Some(detail.into());
        self
    }

    /// Add validation errors.
    pub fn with_errors(mut self, errors: serde_json::Value) -> Self {
        self.errors = Some(errors);
        self
    }

    /// Add request ID for tracing.
    pub fn with_request_id(mut self, request_id: impl Into<String>) -> Self {
        self.request_id = Some(request_id.into());
        self
    }

    /// Add instance URI.
    pub fn with_instance(mut self, instance: impl Into<String>) -> Self {
        self.instance = Some(instance.into());
        self
    }
}

impl Error {
    /// Get the HTTP status code for this error.
    pub fn status_code(&self) -> StatusCode {
        match self {
            Error::InvalidCredentials => StatusCode::UNAUTHORIZED,
            Error::TokenExpired => StatusCode::UNAUTHORIZED,
            Error::InvalidToken => StatusCode::UNAUTHORIZED,
            Error::Unauthorized => StatusCode::UNAUTHORIZED,
            Error::Forbidden(_) => StatusCode::FORBIDDEN,
            Error::MfaRequired => StatusCode::FORBIDDEN,
            Error::InvalidMfaCode => StatusCode::UNAUTHORIZED,
            Error::LdapConnectionFailed(_) => StatusCode::SERVICE_UNAVAILABLE,
            Error::LdapBindFailed(_) => StatusCode::UNAUTHORIZED,
            Error::LdapUserNotFound => StatusCode::UNAUTHORIZED,
            Error::GroupNotFound(_) => StatusCode::NOT_FOUND,
            Error::GroupPermissionDenied(_) => StatusCode::FORBIDDEN,
            Error::ContainerNotOwned(_) => StatusCode::FORBIDDEN,
            Error::NotFound(_) => StatusCode::NOT_FOUND,
            Error::AlreadyExists(_) => StatusCode::CONFLICT,
            Error::Conflict(_) => StatusCode::CONFLICT,
            Error::Validation(_) => StatusCode::BAD_REQUEST,
            Error::BadRequest(_) => StatusCode::BAD_REQUEST,
            Error::Database(_) => StatusCode::INTERNAL_SERVER_ERROR,
            Error::ExternalService(_) => StatusCode::BAD_GATEWAY,
            Error::Docker(_) => StatusCode::BAD_GATEWAY,
            Error::Storage(_) => StatusCode::BAD_GATEWAY,
            Error::AiService(_) => StatusCode::BAD_GATEWAY,
            Error::Raid(_) => StatusCode::INTERNAL_SERVER_ERROR,
            Error::DiskNotFound(_) => StatusCode::NOT_FOUND,
            Error::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
            Error::Configuration(_) => StatusCode::INTERNAL_SERVER_ERROR,
            Error::Anyhow(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    /// Get the error code for this error.
    pub fn error_code(&self) -> &'static str {
        match self {
            Error::InvalidCredentials => "INVALID_CREDENTIALS",
            Error::TokenExpired => "TOKEN_EXPIRED",
            Error::InvalidToken => "INVALID_TOKEN",
            Error::Unauthorized => "UNAUTHORIZED",
            Error::Forbidden(_) => "FORBIDDEN",
            Error::MfaRequired => "MFA_REQUIRED",
            Error::InvalidMfaCode => "INVALID_MFA_CODE",
            Error::LdapConnectionFailed(_) => "LDAP_CONNECTION_FAILED",
            Error::LdapBindFailed(_) => "LDAP_BIND_FAILED",
            Error::LdapUserNotFound => "LDAP_USER_NOT_FOUND",
            Error::GroupNotFound(_) => "GROUP_NOT_FOUND",
            Error::GroupPermissionDenied(_) => "GROUP_PERMISSION_DENIED",
            Error::ContainerNotOwned(_) => "CONTAINER_NOT_OWNED",
            Error::NotFound(_) => "NOT_FOUND",
            Error::AlreadyExists(_) => "ALREADY_EXISTS",
            Error::Conflict(_) => "CONFLICT",
            Error::Validation(_) => "VALIDATION_ERROR",
            Error::BadRequest(_) => "BAD_REQUEST",
            Error::Database(_) => "DATABASE_ERROR",
            Error::ExternalService(_) => "EXTERNAL_SERVICE_ERROR",
            Error::Docker(_) => "DOCKER_ERROR",
            Error::Storage(_) => "STORAGE_ERROR",
            Error::AiService(_) => "AI_SERVICE_ERROR",
            Error::Raid(_) => "RAID_ERROR",
            Error::DiskNotFound(_) => "DISK_NOT_FOUND",
            Error::Internal(_) => "INTERNAL_ERROR",
            Error::Configuration(_) => "CONFIGURATION_ERROR",
            Error::Anyhow(_) => "INTERNAL_ERROR",
        }
    }

    /// Get a short title for this error type.
    pub fn title(&self) -> &'static str {
        match self {
            Error::InvalidCredentials => "Invalid Credentials",
            Error::TokenExpired => "Token Expired",
            Error::InvalidToken => "Invalid Token",
            Error::Unauthorized => "Unauthorized",
            Error::Forbidden(_) => "Forbidden",
            Error::MfaRequired => "MFA Required",
            Error::InvalidMfaCode => "Invalid MFA Code",
            Error::LdapConnectionFailed(_) => "LDAP Connection Failed",
            Error::LdapBindFailed(_) => "LDAP Bind Failed",
            Error::LdapUserNotFound => "LDAP User Not Found",
            Error::GroupNotFound(_) => "Group Not Found",
            Error::GroupPermissionDenied(_) => "Group Permission Denied",
            Error::ContainerNotOwned(_) => "Container Not Owned",
            Error::NotFound(_) => "Resource Not Found",
            Error::AlreadyExists(_) => "Resource Already Exists",
            Error::Conflict(_) => "Conflict",
            Error::Validation(_) => "Validation Error",
            Error::BadRequest(_) => "Bad Request",
            Error::Database(_) => "Database Error",
            Error::ExternalService(_) => "External Service Error",
            Error::Docker(_) => "Docker Error",
            Error::Storage(_) => "Storage Error",
            Error::AiService(_) => "AI Service Error",
            Error::Raid(_) => "RAID Error",
            Error::DiskNotFound(_) => "Disk Not Found",
            Error::Internal(_) => "Internal Server Error",
            Error::Configuration(_) => "Configuration Error",
            Error::Anyhow(_) => "Internal Server Error",
        }
    }

    /// Convert to ProblemDetails.
    pub fn to_problem_details(&self) -> ProblemDetails {
        ProblemDetails::new(self.status_code(), self.error_code(), self.title())
            .with_detail(self.to_string())
    }
}

impl IntoResponse for Error {
    fn into_response(self) -> Response {
        let status = self.status_code();
        let body = self.to_problem_details();

        // Log internal errors
        match &self {
            Error::Database(_) | Error::Internal(_) | Error::Anyhow(_) => {
                tracing::error!(error = ?self, "Internal error occurred");
            },
            _ => {
                tracing::debug!(error = ?self, "Client error occurred");
            },
        }

        (
            status,
            [(axum::http::header::CONTENT_TYPE, "application/problem+json")],
            Json(body),
        )
            .into_response()
    }
}

// Conversion from common error types
impl From<sqlx::Error> for Error {
    fn from(err: sqlx::Error) -> Self {
        tracing::error!(error = ?err, "Database error");
        match &err {
            sqlx::Error::RowNotFound => Error::NotFound("Record not found".to_string()),
            sqlx::Error::Database(db_err) => {
                if let Some(code) = db_err.code() {
                    match code.as_ref() {
                        "23505" => Error::AlreadyExists("Record already exists".to_string()),
                        "23503" => {
                            Error::BadRequest("Foreign key constraint violation".to_string())
                        },
                        _ => Error::Database(err.to_string()),
                    }
                } else {
                    Error::Database(err.to_string())
                }
            },
            _ => Error::Database(err.to_string()),
        }
    }
}

impl From<jsonwebtoken::errors::Error> for Error {
    fn from(err: jsonwebtoken::errors::Error) -> Self {
        match err.kind() {
            jsonwebtoken::errors::ErrorKind::ExpiredSignature => Error::TokenExpired,
            _ => Error::InvalidToken,
        }
    }
}

impl From<validator::ValidationErrors> for Error {
    fn from(err: validator::ValidationErrors) -> Self {
        Error::Validation(err.to_string())
    }
}

impl From<std::io::Error> for Error {
    fn from(err: std::io::Error) -> Self {
        Error::Internal(format!("IO error: {}", err))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_problem_details_serialization() {
        let problem = ProblemDetails::new(StatusCode::NOT_FOUND, "NOT_FOUND", "Resource Not Found")
            .with_detail("User with ID 123 not found")
            .with_request_id("req-abc-123");

        let json = serde_json::to_string_pretty(&problem).unwrap();
        assert!(json.contains("urn:signapps:error:not_found"));
        assert!(json.contains("NOT_FOUND"));
        assert!(json.contains("404"));
    }

    #[test]
    fn test_error_status_codes() {
        assert_eq!(
            Error::InvalidCredentials.status_code(),
            StatusCode::UNAUTHORIZED
        );
        assert_eq!(
            Error::NotFound("test".into()).status_code(),
            StatusCode::NOT_FOUND
        );
        assert_eq!(
            Error::AlreadyExists("test".into()).status_code(),
            StatusCode::CONFLICT
        );
        assert_eq!(
            Error::Database("test".into()).status_code(),
            StatusCode::INTERNAL_SERVER_ERROR
        );
    }
}
