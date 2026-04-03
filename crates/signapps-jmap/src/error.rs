//! JMAP error types (RFC 8620 Section 3.6).
//!
//! Defines the standard error responses that JMAP methods can return.
//! Each error carries a `type` URI, a human-readable `description`, and
//! optional structured `properties` identifying the offending fields.

use serde::{Deserialize, Serialize};

/// Standard JMAP method-level error (RFC 8620 Section 3.6.2).
///
/// Returned inside a `MethodResponse` when a method invocation fails.
/// The `error_type` field maps to the JMAP `type` property.
///
/// # Examples
///
/// ```
/// use signapps_jmap::error::MethodError;
///
/// let err = MethodError::not_found("Email abc-123 not found");
/// assert_eq!(err.error_type, "notFound");
/// ```
///
/// # Errors
///
/// This type *represents* errors; it does not return `Result`.
///
/// # Panics
///
/// None — all constructors are infallible.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MethodError {
    /// JMAP error type identifier (e.g. `"notFound"`, `"invalidArguments"`).
    #[serde(rename = "type")]
    pub error_type: String,

    /// Human-readable error description.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// List of property names that caused the error.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub properties: Option<Vec<String>>,
}

impl MethodError {
    /// Create a `serverFail` error.
    pub fn server_fail(description: impl Into<String>) -> Self {
        Self {
            error_type: "serverFail".to_string(),
            description: Some(description.into()),
            properties: None,
        }
    }

    /// Create a `notFound` error.
    pub fn not_found(description: impl Into<String>) -> Self {
        Self {
            error_type: "notFound".to_string(),
            description: Some(description.into()),
            properties: None,
        }
    }

    /// Create an `invalidArguments` error.
    pub fn invalid_arguments(description: impl Into<String>) -> Self {
        Self {
            error_type: "invalidArguments".to_string(),
            description: Some(description.into()),
            properties: None,
        }
    }

    /// Create an `invalidArguments` error with specific property names.
    pub fn invalid_properties(description: impl Into<String>, properties: Vec<String>) -> Self {
        Self {
            error_type: "invalidArguments".to_string(),
            description: Some(description.into()),
            properties: Some(properties),
        }
    }

    /// Create an `unknownMethod` error.
    pub fn unknown_method(method_name: &str) -> Self {
        Self {
            error_type: "unknownMethod".to_string(),
            description: Some(format!("Unknown method: {method_name}")),
            properties: None,
        }
    }

    /// Create a `forbidden` error.
    pub fn forbidden(description: impl Into<String>) -> Self {
        Self {
            error_type: "forbidden".to_string(),
            description: Some(description.into()),
            properties: None,
        }
    }

    /// Create an `accountNotFound` error.
    pub fn account_not_found() -> Self {
        Self {
            error_type: "accountNotFound".to_string(),
            description: Some("The accountId does not correspond to a valid account".to_string()),
            properties: None,
        }
    }

    /// Create a `stateMismatch` error (used for conditional updates).
    pub fn state_mismatch(description: impl Into<String>) -> Self {
        Self {
            error_type: "stateMismatch".to_string(),
            description: Some(description.into()),
            properties: None,
        }
    }

    /// Create a `cannotCalculateChanges` error.
    pub fn cannot_calculate_changes() -> Self {
        Self {
            error_type: "cannotCalculateChanges".to_string(),
            description: Some(
                "The server cannot calculate the changes since the given state".to_string(),
            ),
            properties: None,
        }
    }

    /// Create a `tooLarge` error.
    pub fn too_large(description: impl Into<String>) -> Self {
        Self {
            error_type: "tooLarge".to_string(),
            description: Some(description.into()),
            properties: None,
        }
    }
}

/// Top-level JMAP request-level error (RFC 8620 Section 3.6.1).
///
/// Returned when the entire request is malformed before any method is dispatched.
#[derive(Debug, Clone, thiserror::Error)]
pub enum RequestError {
    /// The request body is not valid JSON.
    #[error("not JSON: {0}")]
    NotJson(String),

    /// The request is valid JSON but not a valid JMAP Request object.
    #[error("not a valid JMAP request: {0}")]
    NotRequest(String),

    /// A required capability in `using` is not supported.
    #[error("unknown capability: {0}")]
    UnknownCapability(String),

    /// The request exceeds server limits (too many method calls, etc.).
    #[error("request too large: {0}")]
    Limit(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn method_error_serializes_correctly() {
        let err = MethodError::not_found("Email not found");
        let json = serde_json::to_value(&err).expect("serialize");
        assert_eq!(json["type"], "notFound");
        assert_eq!(json["description"], "Email not found");
        assert!(json.get("properties").is_none());
    }

    #[test]
    fn method_error_with_properties() {
        let err = MethodError::invalid_properties(
            "Bad fields",
            vec!["from".to_string(), "to".to_string()],
        );
        let json = serde_json::to_value(&err).expect("serialize");
        assert_eq!(json["type"], "invalidArguments");
        let props = json["properties"].as_array().expect("array");
        assert_eq!(props.len(), 2);
    }

    #[test]
    fn method_error_deserializes() {
        let json = r#"{"type":"serverFail","description":"DB down"}"#;
        let err: MethodError = serde_json::from_str(json).expect("deserialize");
        assert_eq!(err.error_type, "serverFail");
        assert_eq!(err.description.as_deref(), Some("DB down"));
    }
}
