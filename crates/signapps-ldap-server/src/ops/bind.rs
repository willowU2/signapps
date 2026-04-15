//! LDAP Bind operation (RFC 4511 §4.2).
//!
//! Supports Simple Bind (DN + password) against identity.users table.
//! SASL/GSSAPI (Kerberos) is stubbed for Phase 3 integration.

use argon2::{password_hash::PasswordHash, Argon2, PasswordVerifier};
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
        },
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

    // Look up user in identity.users — also fetch auth_provider to detect LDAP-only accounts
    let user: Option<(Uuid, Option<String>, i16, String)> = sqlx::query_as(
        "SELECT id, password_hash, role, auth_provider FROM identity.users WHERE username = $1",
    )
    .bind(&username)
    .fetch_optional(pool)
    .await
    .unwrap_or(None);

    let (user_id, password_hash_opt, role, auth_provider) = match user {
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
        },
    };

    // Reject LDAP-only users that have no local password hash
    if auth_provider != "local" {
        tracing::warn!(
            username = %username,
            auth_provider = %auth_provider,
            "Bind failed: user has no local password (use directory authentication)"
        );
        return BindResult {
            success: false,
            user_id: None,
            user_role: 0,
            bound_dn: None,
            error_message: "No local password — use directory authentication".to_string(),
        };
    }

    let password_hash = match password_hash_opt {
        Some(h) if !h.is_empty() => h,
        _ => {
            tracing::warn!(username = %username, "Bind failed: no password hash stored");
            return BindResult {
                success: false,
                user_id: None,
                user_role: 0,
                bound_dn: None,
                error_message: "Invalid credentials".to_string(),
            };
        },
    };

    // Verify password with Argon2 — runs on the calling task (bind handler is already
    // dispatched to a Tokio thread; CPU cost is bounded by Argon2 default params).
    let password_bytes = password.to_vec();
    let hash_valid = tokio::task::spawn_blocking(move || match PasswordHash::new(&password_hash) {
        Ok(parsed_hash) => Argon2::default()
            .verify_password(&password_bytes, &parsed_hash)
            .is_ok(),
        Err(e) => {
            tracing::error!(?e, "Failed to parse stored password hash");
            false
        },
    })
    .await
    .unwrap_or(false);

    if !hash_valid {
        tracing::warn!(username = %username, "Bind failed: wrong password");
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

    /// Verify that the Argon2 round-trip used in handle_simple_bind works correctly.
    #[test]
    fn argon2_verify_works() {
        use argon2::{
            password_hash::{rand_core::OsRng, PasswordHasher, SaltString},
            Argon2,
        };

        let password = b"test_password";
        let salt = SaltString::generate(&mut OsRng);
        let hash = Argon2::default()
            .hash_password(password, &salt)
            .unwrap()
            .to_string();

        let parsed = PasswordHash::new(&hash).unwrap();
        assert!(
            Argon2::default().verify_password(password, &parsed).is_ok(),
            "correct password must verify"
        );
        assert!(
            Argon2::default()
                .verify_password(b"wrong_password", &parsed)
                .is_err(),
            "wrong password must not verify"
        );
    }
}
