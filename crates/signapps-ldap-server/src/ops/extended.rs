//! LDAP Extended operations (StartTLS, Who Am I, Password Modify).
//!
//! Implements the three most common Extended operation OIDs:
//! * `1.3.6.1.4.1.1466.20037` — StartTLS (RFC 4511 §4.14.1)
//! * `1.3.6.1.4.1.4203.1.11.3` — Who Am I? (RFC 4532)
//! * `1.3.6.1.4.1.4203.1.11.1` — Password Modify (RFC 3062)

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
/// - Password Modify (not yet implemented).
/// - Any unrecognised OID.
///
/// # Panics
///
/// Never panics.
#[tracing::instrument(skip(_request_value), fields(oid = request_oid))]
pub async fn handle_extended(
    request_oid: &str,
    _request_value: Option<&[u8]>,
    is_tls: bool,
    bound_dn: Option<&str>,
) -> ExtendedResult {
    match request_oid {
        oid::START_TLS => handle_start_tls(is_tls),
        oid::WHO_AM_I => handle_who_am_i(bound_dn),
        oid::PASSWORD_MODIFY => handle_password_modify(),
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

/// Handles the Password Modify Extended operation (RFC 3062).
///
/// Not yet implemented — will be wired to the identity service password update
/// path in a follow-up.
fn handle_password_modify() -> ExtendedResult {
    tracing::info!("Password modify requested (not yet implemented)");
    ExtendedResult {
        success: false,
        oid: Some(oid::PASSWORD_MODIFY.to_string()),
        value: None,
        error_message: "Not yet implemented".to_string(),
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
    async fn password_modify_not_implemented() {
        let result = handle_extended(oid::PASSWORD_MODIFY, None, false, None).await;
        assert!(!result.success);
        assert!(result.error_message.contains("Not yet implemented"));
    }

    #[tokio::test]
    async fn unknown_oid() {
        let result = handle_extended("1.2.3.4.5", None, false, None).await;
        assert!(!result.success);
        assert!(result.error_message.contains("1.2.3.4.5"));
    }
}
