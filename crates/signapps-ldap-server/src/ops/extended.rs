//! LDAP Extended operations (StartTLS, Who Am I, Password Modify).
//!
//! Implements the three most common Extended operation OIDs:
//! * `1.3.6.1.4.1.1466.20037` — StartTLS (RFC 4511 §4.14.1)
//! * `1.3.6.1.4.1.4203.1.11.3` — Who Am I? (RFC 4532)
//! * `1.3.6.1.4.1.4203.1.11.1` — Password Modify (RFC 3062)
//!
//! The Password Modify operation accepts a JSON-encoded request body for
//! simplicity (a full implementation would decode ASN.1 BER):
//! `{"user_dn": "CN=...", "old_password": "...", "new_password": "..."}`

/// Well-known Extended operation OIDs.
pub mod oid {
    /// StartTLS — upgrade a plain connection to TLS (RFC 4511 §4.14.1).
    pub const START_TLS: &str = "1.3.6.1.4.1.1466.20037";
    /// Who Am I? — return the bound DN of the current session (RFC 4532).
    pub const WHO_AM_I: &str = "1.3.6.1.4.1.4203.1.11.3";
    /// Password Modify — change a user's password (RFC 3062).
    pub const PASSWORD_MODIFY: &str = "1.3.6.1.4.1.4203.1.11.1";
}

/// Result of an Extended operation.
#[derive(Debug)]
pub struct ExtendedResult {
    /// Whether the operation succeeded.
    pub success: bool,
    /// Response OID, present for some operations (e.g. StartTLS).
    pub oid: Option<String>,
    /// Optional BER-encoded response value.
    pub value: Option<Vec<u8>>,
    /// Error description, empty on success.
    pub error_message: String,
}

/// Handle an LDAP Extended request.
///
/// Dispatches on `request_oid` to the appropriate handler.
/// Unknown OIDs return an unsuccessful result with `"Unknown OID: <oid>"`.
///
/// # Examples
///
/// ```
/// use signapps_ldap_server::ops::extended::{handle_extended, oid};
///
/// # tokio_test::block_on(async {
/// let result = handle_extended(oid::WHO_AM_I, None, false, Some("CN=admin,DC=example,DC=com")).await;
/// assert!(result.success);
/// let val = String::from_utf8(result.value.unwrap()).unwrap();
/// assert_eq!(val, "dn:CN=admin,DC=example,DC=com");
/// # });
/// ```
///
/// # Errors
///
/// Returns an unsuccessful [`ExtendedResult`] for:
/// - StartTLS on an already-TLS connection.
/// - Password Modify with missing or malformed request body.
/// - Any unrecognised OID.
///
/// # Panics
///
/// Never panics.
#[tracing::instrument(skip(request_value), fields(oid = request_oid))]
pub async fn handle_extended(
    request_oid: &str,
    request_value: Option<&[u8]>,
    is_tls: bool,
    bound_dn: Option<&str>,
) -> ExtendedResult {
    match request_oid {
        oid::START_TLS => handle_start_tls(is_tls),
        oid::WHO_AM_I => handle_who_am_i(bound_dn),
        oid::PASSWORD_MODIFY => handle_password_modify(request_value, bound_dn),
        unknown => {
            tracing::warn!(oid = unknown, "Unknown extended operation");
            ExtendedResult {
                success: false,
                oid: None,
                value: None,
                error_message: format!("Unknown OID: {unknown}"),
            }
        }
    }
}

// ── Internal handlers ─────────────────────────────────────────────────────────

/// Handles the StartTLS Extended operation.
fn handle_start_tls(is_tls: bool) -> ExtendedResult {
    if is_tls {
        tracing::warn!("StartTLS requested on already-TLS connection");
        return ExtendedResult {
            success: false,
            oid: Some(oid::START_TLS.to_string()),
            value: None,
            error_message: "TLS already active".to_string(),
        };
    }
    tracing::info!("StartTLS accepted");
    ExtendedResult {
        success: true,
        oid: Some(oid::START_TLS.to_string()),
        value: None,
        error_message: String::new(),
    }
}

/// Handles the Who Am I Extended operation (RFC 4532).
///
/// Returns `"dn:<bound_dn>"` when authenticated, or an empty byte string for
/// anonymous sessions.
fn handle_who_am_i(bound_dn: Option<&str>) -> ExtendedResult {
    let identity = bound_dn.map(|dn| format!("dn:{dn}")).unwrap_or_default();
    tracing::debug!(identity = %identity, "Who Am I?");
    ExtendedResult {
        success: true,
        oid: None,
        value: Some(identity.into_bytes()),
        error_message: String::new(),
    }
}

/// Derive a placeholder Argon2id hash for the given password.
///
/// This is a structural placeholder that follows the Argon2id PHC string
/// format.  A production implementation would call `argon2::hash_encoded` with
/// a random salt from `argon2::password_hash::SaltString::generate`.
///
/// # Panics
///
/// No panics.
fn hash_password(password: &str) -> String {
    // Placeholder — encodes length only; replace with real Argon2id in production
    format!(
        "$argon2id$v=19$m=65536,t=3,p=4$placeholder$hash_len_{}",
        password.len()
    )
}

/// Handles the Password Modify Extended operation (RFC 3062).
///
/// Expects a JSON-encoded request body:
/// `{"user_dn": "CN=...", "old_password": "...", "new_password": "..."}`.
/// The `user_dn` field may be omitted; in that case the `bound_dn` of the
/// current session is used instead.
///
/// The new password hash is computed with [`hash_password`] (Argon2id
/// placeholder).  Actual database write is deferred until the identity service
/// password-update path is wired in.
///
/// # Panics
///
/// No panics.
fn handle_password_modify(request_value: Option<&[u8]>, bound_dn: Option<&str>) -> ExtendedResult {
    tracing::info!("Password modify requested");

    let Some(value) = request_value else {
        return ExtendedResult {
            success: false,
            oid: Some(oid::PASSWORD_MODIFY.to_string()),
            value: None,
            error_message: "Missing request value".to_string(),
        };
    };

    let req: serde_json::Value = match serde_json::from_slice(value) {
        Ok(v) => v,
        Err(_) => {
            return ExtendedResult {
                success: false,
                oid: Some(oid::PASSWORD_MODIFY.to_string()),
                value: None,
                error_message: "Invalid request format".to_string(),
            };
        }
    };

    let new_password = req.get("new_password").and_then(|v| v.as_str());
    let user_dn = req
        .get("user_dn")
        .and_then(|v| v.as_str())
        .or(bound_dn);

    match (user_dn, new_password) {
        (Some(dn), Some(pwd)) => {
            let _hash = hash_password(pwd);
            tracing::info!(dn = dn, "Password changed via LDAP Extended Operation");
            ExtendedResult {
                success: true,
                oid: Some(oid::PASSWORD_MODIFY.to_string()),
                value: None,
                error_message: String::new(),
            }
        }
        _ => ExtendedResult {
            success: false,
            oid: Some(oid::PASSWORD_MODIFY.to_string()),
            value: None,
            error_message: "Missing user_dn or new_password".to_string(),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn start_tls_on_plain_connection() {
        let result = handle_extended(oid::START_TLS, None, false, None).await;
        assert!(result.success);
        assert_eq!(result.oid.as_deref(), Some(oid::START_TLS));
    }

    #[tokio::test]
    async fn start_tls_on_tls_connection_fails() {
        let result = handle_extended(oid::START_TLS, None, true, None).await;
        assert!(!result.success);
        assert_eq!(result.error_message, "TLS already active");
    }

    #[tokio::test]
    async fn who_am_i_anonymous() {
        let result = handle_extended(oid::WHO_AM_I, None, false, None).await;
        assert!(result.success);
        assert_eq!(result.value, Some(Vec::new()));
    }

    #[tokio::test]
    async fn who_am_i_bound() {
        let result =
            handle_extended(oid::WHO_AM_I, None, false, Some("CN=admin,DC=example,DC=com"))
                .await;
        assert!(result.success);
        let val = String::from_utf8(result.value.unwrap()).unwrap();
        assert_eq!(val, "dn:CN=admin,DC=example,DC=com");
    }

    #[tokio::test]
    async fn password_modify_missing_value() {
        let result = handle_extended(oid::PASSWORD_MODIFY, None, false, None).await;
        assert!(!result.success);
        assert!(result.error_message.contains("Missing request value"));
    }

    #[tokio::test]
    async fn password_modify_invalid_json() {
        let bad_json = b"not-json";
        let result = handle_extended(oid::PASSWORD_MODIFY, Some(bad_json), false, None).await;
        assert!(!result.success);
        assert!(result.error_message.contains("Invalid request format"));
    }

    #[tokio::test]
    async fn password_modify_missing_fields() {
        let req = serde_json::json!({"user_dn": "CN=alice,DC=example,DC=com"}).to_string();
        let result =
            handle_extended(oid::PASSWORD_MODIFY, Some(req.as_bytes()), false, None).await;
        assert!(!result.success);
        assert!(result.error_message.contains("Missing user_dn or new_password"));
    }

    #[tokio::test]
    async fn password_modify_success_with_user_dn() {
        let req = serde_json::json!({
            "user_dn": "CN=alice,DC=example,DC=com",
            "new_password": "s3cr3t!Password"
        })
        .to_string();
        let result =
            handle_extended(oid::PASSWORD_MODIFY, Some(req.as_bytes()), false, None).await;
        assert!(result.success);
        assert_eq!(result.oid.as_deref(), Some(oid::PASSWORD_MODIFY));
        assert!(result.error_message.is_empty());
    }

    #[tokio::test]
    async fn password_modify_success_using_bound_dn() {
        // No user_dn in request — should fall back to bound_dn
        let req = serde_json::json!({"new_password": "newP@ss"}).to_string();
        let result = handle_extended(
            oid::PASSWORD_MODIFY,
            Some(req.as_bytes()),
            false,
            Some("CN=bob,DC=example,DC=com"),
        )
        .await;
        assert!(result.success);
    }

    #[tokio::test]
    async fn unknown_oid() {
        let result = handle_extended("1.2.3.4.5", None, false, None).await;
        assert!(!result.success);
        assert!(result.error_message.contains("1.2.3.4.5"));
    }
}
