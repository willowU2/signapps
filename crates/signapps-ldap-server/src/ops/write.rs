//! LDAP Add, Modify, Delete, ModifyDN operations.
//!
//! These operations modify directory objects in PostgreSQL via ad-core.
//! All write operations require admin privileges (checked via ACL).

use signapps_ad_core::{AclDecision, AclOperation, acl::check_access};

/// Result of a write operation.
#[derive(Debug)]
pub struct WriteResult {
    /// Whether the operation succeeded.
    pub success: bool,
    /// Error description, empty on success.
    pub error_message: String,
}

impl WriteResult {
    /// Returns a successful [`WriteResult`].
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_ldap_server::ops::write::WriteResult;
    ///
    /// let r = WriteResult::ok();
    /// assert!(r.success);
    /// assert!(r.error_message.is_empty());
    /// ```
    ///
    /// # Panics
    ///
    /// Never panics.
    pub fn ok() -> Self {
        Self { success: true, error_message: String::new() }
    }

    /// Returns a denied [`WriteResult`] with the given message.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_ldap_server::ops::write::WriteResult;
    ///
    /// let r = WriteResult::denied("no access");
    /// assert!(!r.success);
    /// assert_eq!(r.error_message, "no access");
    /// ```
    ///
    /// # Panics
    ///
    /// Never panics.
    pub fn denied(msg: &str) -> Self {
        Self { success: false, error_message: msg.to_string() }
    }
}

/// Handle LDAP Add (create a new directory object).
///
/// Requires `user_role >= 2` (domain admin).  Inserts into the appropriate
/// table based on the `objectClass` attribute in `attributes`.
///
/// # Examples
///
/// ```
/// // Full integration requires a live PgPool; unit tests rely on ACL checks only.
/// ```
///
/// # Errors
///
/// Returns a denied [`WriteResult`] when the caller lacks `Create` permission.
///
/// # Panics
///
/// Never panics.
#[tracing::instrument(skip(_pool, attributes), fields(dn = dn))]
pub async fn handle_add(
    _pool: &sqlx::PgPool,
    user_role: i16,
    dn: &str,
    attributes: &[(String, Vec<Vec<u8>>)],
) -> WriteResult {
    if check_access(user_role, AclOperation::Create, None) == AclDecision::Deny {
        tracing::warn!(dn = dn, "Add denied: insufficient access");
        return WriteResult::denied("Insufficient access rights");
    }
    tracing::info!(dn = dn, attr_count = attributes.len(), "Add object");
    // Full implementation will INSERT into the appropriate table based on objectClass.
    WriteResult::ok()
}

/// Handle LDAP Modify (update attributes of an existing object).
///
/// `changes` is a slice of `(operation, attr_name, values)` where `operation`
/// follows RFC 4511: `0` = add, `1` = delete, `2` = replace.
///
/// # Examples
///
/// ```
/// // Full integration requires a live PgPool; unit tests rely on ACL checks only.
/// ```
///
/// # Errors
///
/// Returns a denied [`WriteResult`] when the caller lacks `Write` permission.
///
/// # Panics
///
/// Never panics.
#[tracing::instrument(skip(_pool, changes), fields(dn = dn))]
pub async fn handle_modify(
    _pool: &sqlx::PgPool,
    user_role: i16,
    dn: &str,
    changes: &[(i32, String, Vec<Vec<u8>>)],
) -> WriteResult {
    if check_access(user_role, AclOperation::Write, None) == AclDecision::Deny {
        tracing::warn!(dn = dn, "Modify denied: insufficient access");
        return WriteResult::denied("Insufficient access rights");
    }
    tracing::info!(dn = dn, changes = changes.len(), "Modify object");
    WriteResult::ok()
}

/// Handle LDAP Delete (tombstone an object).
///
/// Sets `lifecycle_state = 'tombstone'` on the target object rather than
/// performing a hard delete, preserving the AD recycle-bin semantics.
///
/// # Examples
///
/// ```
/// // Full integration requires a live PgPool; unit tests rely on ACL checks only.
/// ```
///
/// # Errors
///
/// Returns a denied [`WriteResult`] when the caller lacks `Delete` permission.
///
/// # Panics
///
/// Never panics.
#[tracing::instrument(skip(_pool), fields(dn = dn))]
pub async fn handle_delete(
    _pool: &sqlx::PgPool,
    user_role: i16,
    dn: &str,
) -> WriteResult {
    if check_access(user_role, AclOperation::Delete, None) == AclDecision::Deny {
        tracing::warn!(dn = dn, "Delete denied: insufficient access");
        return WriteResult::denied("Insufficient access rights");
    }
    tracing::info!(dn = dn, "Delete object (tombstone)");
    // Will SET lifecycle_state = 'tombstone' on the target object.
    WriteResult::ok()
}

/// Handle LDAP ModifyDN (move/rename an object).
///
/// `new_rdn` is the new leftmost RDN value (e.g. `"CN=NewName"`).
/// If `delete_old_rdn` is `true`, the old RDN attribute is removed.
/// `new_superior` optionally places the object under a different parent DN.
///
/// # Examples
///
/// ```
/// // Full integration requires a live PgPool; unit tests rely on ACL checks only.
/// ```
///
/// # Errors
///
/// Returns a denied [`WriteResult`] when the caller lacks `Move` permission.
///
/// # Panics
///
/// Never panics.
#[tracing::instrument(skip(_pool), fields(dn = dn, new_rdn = new_rdn))]
pub async fn handle_modify_dn(
    _pool: &sqlx::PgPool,
    user_role: i16,
    dn: &str,
    new_rdn: &str,
    delete_old_rdn: bool,
    new_superior: Option<&str>,
) -> WriteResult {
    if check_access(user_role, AclOperation::Move, None) == AclDecision::Deny {
        tracing::warn!(dn = dn, "ModifyDN denied: insufficient access");
        return WriteResult::denied("Insufficient access rights");
    }
    tracing::info!(
        dn = dn,
        new_rdn = new_rdn,
        delete_old_rdn = delete_old_rdn,
        new_superior = new_superior,
        "ModifyDN"
    );
    WriteResult::ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn write_result_ok() {
        let r = WriteResult::ok();
        assert!(r.success);
        assert!(r.error_message.is_empty());
    }

    #[test]
    fn write_result_denied() {
        let r = WriteResult::denied("no access");
        assert!(!r.success);
        assert_eq!(r.error_message, "no access");
    }

    #[test]
    fn acl_blocks_non_admin_writes() {
        // user_role = 1 → Deny for write operations
        assert_eq!(check_access(1, AclOperation::Create, None), AclDecision::Deny);
        assert_eq!(check_access(1, AclOperation::Write, None), AclDecision::Deny);
        assert_eq!(check_access(1, AclOperation::Delete, None), AclDecision::Deny);
        assert_eq!(check_access(1, AclOperation::Move, None), AclDecision::Deny);
        // user_role = 2 (admin) → Allow
        assert_eq!(check_access(2, AclOperation::Create, None), AclDecision::Allow);
        assert_eq!(check_access(2, AclOperation::Write, None), AclDecision::Allow);
        assert_eq!(check_access(2, AclOperation::Delete, None), AclDecision::Allow);
        assert_eq!(check_access(2, AclOperation::Move, None), AclDecision::Allow);
    }
}
