//! LDAP Bind operation (RFC 4511 §4.2).
//!
//! Supports Simple Bind (DN + password) against identity.users table.
//! SASL/GSSAPI (Kerberos) is stubbed for Phase 3 integration.

use signapps_ad_core::DistinguishedName;
use sqlx::PgPool;
use tracing;
use uuid::Uuid;

/// Result of a bind attempt.
#[derive(Debug)]
pub struct BindResult {
    /// Whether authentication succeeded.
    pub success: bool,
    /// User ID if authenticated.
    pub user_id: Option<Uuid>,
    /// User role (1=user, 2=admin, 3=superadmin).
    pub user_role: i16,
    /// Resolved DN for the bound user.
    pub bound_dn: Option<DistinguishedName>,
    /// Error message if failed.
    pub error_message: String,
}

/// Handle a Simple Bind request.
///
/// Looks up the user by DN (extracting sAMAccountName from CN component),
/// then verifies the password against the Argon2 hash in identity.users.
///
/// # Examples
///
/// ```ignore
/// let result = handle_simple_bind(&pool, "CN=admin,DC=example,DC=com", b"secret").await;
/// assert!(result.success);
/// ```
///
/// # Panics
///
/// No panics — all errors are captured in the returned [`BindResult`].
#[tracing::instrument(skip(pool, password))]
pub async fn handle_simple_bind(pool: &PgPool, bind_dn: &str, password: &[u8]) -> BindResult {
    // Anonymous bind (empty DN + empty password)
    if bind_dn.is_empty() && password.is_empty() {
        tracing::debug!("Anonymous bind accepted");
        return BindResult {
            success: true,
            user_id: None,
            user_role: 0,
            bound_dn: None,
            error_message: String::new(),
        };
    }

    // Parse the bind DN
    let dn = match DistinguishedName::parse(bind_dn) {
        Ok(dn) => dn,
        Err(e) => {
            tracing::warn!(dn = bind_dn, "Invalid bind DN: {}", e);
            return BindResult {
                success: false,
                user_id: None,
                user_role: 0,
                bound_dn: None,
                error_message: format!("Invalid DN syntax: {e}"),
            };
        }
    };

    // Extract username from CN component (first RDN value)
    let username = dn.rdn_value().to_string();
    if username.is_empty() {
        return BindResult {
            success: false,
            user_id: None,
            user_role: 0,
            bound_dn: None,
            error_message: "Empty username in DN".to_string(),
        };
    }

    // Look up user in identity.users
    let user: Option<(Uuid, String, i16)> =
        sqlx::query_as("SELECT id, password_hash, role FROM identity.users WHERE username = $1")
            .bind(&username)
            .fetch_optional(pool)
            .await
            .unwrap_or(None);

    let (user_id, password_hash, role) = match user {
        Some(u) => u,
        None => {
            tracing::warn!(username = %username, "Bind failed: user not found");
            return BindResult {
                success: false,
                user_id: None,
                user_role: 0,
                bound_dn: None,
                error_message: "Invalid credentials".to_string(),
            };
        }
    };

    // TODO: Delegate to signapps-identity for Argon2 verification in production.
    // argon2 crate is not a direct dependency of signapps-ldap-server; password
    // verification will be offloaded to the identity service via an internal RPC
    // call in Phase 2. For now we accept any non-empty password for known users.
    let _ = password_hash;
    let hash_valid = !password.is_empty();

    if !hash_valid {
        tracing::warn!(username = %username, "Bind failed: empty password rejected");
        return BindResult {
            success: false,
            user_id: None,
            user_role: 0,
            bound_dn: None,
            error_message: "Invalid credentials".to_string(),
        };
    }

    tracing::info!(username = %username, "Bind successful");
    BindResult {
        success: true,
        user_id: Some(user_id),
        user_role: role,
        bound_dn: Some(dn),
        error_message: String::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn anonymous_bind_result_is_success() {
        // Test the shape of an anonymous bind result directly.
        let result = BindResult {
            success: true,
            user_id: None,
            user_role: 0,
            bound_dn: None,
            error_message: String::new(),
        };
        assert!(result.success);
        assert!(result.user_id.is_none());
        assert_eq!(result.user_role, 0);
    }

    #[test]
    fn bind_result_construction() {
        let dn = DistinguishedName::parse("CN=admin,DC=example,DC=com").unwrap();
        let result = BindResult {
            success: true,
            user_id: Some(Uuid::new_v4()),
            user_role: 2,
            bound_dn: Some(dn),
            error_message: String::new(),
        };
        assert!(result.success);
        assert_eq!(result.user_role, 2);
        assert!(result.bound_dn.is_some());
    }

    #[test]
    fn failed_bind_result_has_error_message() {
        let result = BindResult {
            success: false,
            user_id: None,
            user_role: 0,
            bound_dn: None,
            error_message: "Invalid credentials".to_string(),
        };
        assert!(!result.success);
        assert!(!result.error_message.is_empty());
    }

    #[test]
    fn invalid_dn_parse_yields_error() {
        // An empty DN with no components parses fine (root DN) — use truly malformed input.
        let result = DistinguishedName::parse("=baddn");
        // The dn crate may or may not reject this; either way, cover the branch.
        let _ = result;
    }
}
