//! Kerberos password change service (port 464).

/// Result of a password change request.
#[derive(Debug)]
pub struct KpasswdResult {
    /// Whether the password change succeeded.
    pub success: bool,
    /// Error message when `success` is `false`.
    pub error_message: String,
}

/// Handle a kpasswd request (RFC 3244).
///
/// Will be wired to identity.users password update + key regeneration
/// once the crypto layer is complete.
///
/// # Examples
///
/// ```rust,no_run
/// # use sqlx::PgPool;
/// # use signapps_kerberos_kdc::handlers::kpasswd::handle_kpasswd;
/// # async fn example(pool: &PgPool) {
/// let result = handle_kpasswd(pool, "admin", b"old", b"new").await;
/// assert!(!result.success); // stub — not yet fully implemented
/// # }
/// ```
///
/// # Errors
///
/// Always returns `success: false` until fully implemented.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[tracing::instrument(skip_all)]
pub async fn handle_kpasswd(
    _pool: &sqlx::PgPool,
    principal: &str,
    _old_password: &[u8],
    _new_password: &[u8],
) -> KpasswdResult {
    tracing::info!(principal = principal, "Password change requested");
    // Will be wired to identity.users password update + key regeneration
    KpasswdResult {
        success: false,
        error_message: "Not yet fully implemented".to_string(),
    }
}
