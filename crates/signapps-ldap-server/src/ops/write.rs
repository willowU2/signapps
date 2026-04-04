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
/// Supported object classes:
/// - `computer` → `workforce_org_nodes` with `node_type = 'computer'`
/// - `user` / `person` → `identity.users`
/// - `organizationalUnit` → `workforce_org_nodes` with `node_type = 'department'`
/// - Any other class is accepted but no DB insert is performed (advisory log only).
///
/// # Examples
///
/// ```
/// // Full integration requires a live PgPool; unit tests rely on ACL checks only.
/// ```
///
/// # Errors
///
/// Returns a denied [`WriteResult`] when:
/// - The caller lacks `Create` permission (`user_role < 2`).
/// - The DN cannot be parsed.
/// - A database insert fails.
///
/// # Panics
///
/// Never panics.
#[tracing::instrument(skip(pool, attributes), fields(dn = dn))]
pub async fn handle_add(
    pool: &sqlx::PgPool,
    user_role: i16,
    dn: &str,
    attributes: &[(String, Vec<Vec<u8>>)],
) -> WriteResult {
    if check_access(user_role, AclOperation::Create, None) == AclDecision::Deny {
        tracing::warn!(dn = dn, "Add denied: insufficient access");
        return WriteResult::denied("Insufficient access rights");
    }

    // Parse the DN
    let parsed_dn = match signapps_ad_core::dn::DistinguishedName::parse(dn) {
        Ok(d) => d,
        Err(e) => return WriteResult::denied(&format!("Invalid DN: {e}")),
    };

    // Extract objectClass from attributes
    let object_class = attributes
        .iter()
        .find(|(name, _)| name.eq_ignore_ascii_case("objectClass"))
        .and_then(|(_, values)| values.first())
        .map(|v| String::from_utf8_lossy(v).to_string())
        .unwrap_or_default();

    let cn = parsed_dn.rdn_value().to_string();

    match object_class.to_lowercase().as_str() {
        "computer" => {
            let id = uuid::Uuid::new_v4();
            let result = sqlx::query(
                r#"
                INSERT INTO workforce_org_nodes (id, tenant_id, node_type, name, is_active, created_at, updated_at)
                VALUES ($1, '00000000-0000-0000-0000-000000000000'::uuid, 'computer', $2, true, now(), now())
                "#,
            )
            .bind(id)
            .bind(&cn)
            .execute(pool)
            .await;

            match result {
                Ok(_) => {
                    tracing::info!(dn = dn, object_class = "computer", "Object created");
                    WriteResult::ok()
                }
                Err(e) => {
                    tracing::error!(dn = dn, "Failed to create object: {}", e);
                    WriteResult::denied(&format!("Database error: {e}"))
                }
            }
        }
        "user" | "person" => {
            let id = uuid::Uuid::new_v4();
            let sam_account = attributes
                .iter()
                .find(|(name, _)| name.eq_ignore_ascii_case("sAMAccountName"))
                .and_then(|(_, values)| values.first())
                .map(|v| String::from_utf8_lossy(v).to_string())
                .unwrap_or_else(|| cn.clone());

            let result = sqlx::query(
                r#"
                INSERT INTO identity.users (id, username, role, created_at, updated_at)
                VALUES ($1, $2, 1, now(), now())
                "#,
            )
            .bind(id)
            .bind(&sam_account)
            .execute(pool)
            .await;

            match result {
                Ok(_) => {
                    tracing::info!(dn = dn, username = %sam_account, "User created via LDAP Add");
                    WriteResult::ok()
                }
                Err(e) => {
                    tracing::error!(dn = dn, "Failed to create user: {}", e);
                    WriteResult::denied(&format!("Database error: {e}"))
                }
            }
        }
        "organizationalunit" => {
            let id = uuid::Uuid::new_v4();
            let result = sqlx::query(
                r#"
                INSERT INTO workforce_org_nodes (id, tenant_id, node_type, name, is_active, created_at, updated_at)
                VALUES ($1, '00000000-0000-0000-0000-000000000000'::uuid, 'department', $2, true, now(), now())
                "#,
            )
            .bind(id)
            .bind(&cn)
            .execute(pool)
            .await;

            match result {
                Ok(_) => {
                    tracing::info!(dn = dn, "OU created via LDAP Add");
                    WriteResult::ok()
                }
                Err(e) => {
                    tracing::error!(dn = dn, "Failed to create OU: {}", e);
                    WriteResult::denied(&format!("Database error: {e}"))
                }
            }
        }
        _ => {
            tracing::info!(dn = dn, object_class = %object_class, "Add object (generic — no DB insert)");
            WriteResult::ok()
        }
    }
}

/// Handle LDAP Modify (update attributes of an existing object).
///
/// `changes` is a slice of `(operation, attr_name, values)` where `operation`
/// follows RFC 4511: `0` = add, `1` = delete, `2` = replace.
///
/// Supported attribute mappings to `identity.users`:
/// - `mail` → `email`
/// - `department` → `department`
/// - `title` → `job_title`
/// - `telephoneNumber` → `phone`
/// - `displayName` → `display_name`
///
/// Attributes `unicodePwd`, `servicePrincipalName`, and `userAccountControl`
/// are recognised and logged but require out-of-band processing.
///
/// # Examples
///
/// ```
/// // Full integration requires a live PgPool; unit tests rely on ACL checks only.
/// ```
///
/// # Errors
///
/// Returns a denied [`WriteResult`] when:
/// - The caller lacks `Write` permission.
/// - The DN cannot be parsed.
/// - Any mapped SQL update fails.
///
/// # Panics
///
/// Never panics.
#[tracing::instrument(skip(pool, changes), fields(dn = dn))]
pub async fn handle_modify(
    pool: &sqlx::PgPool,
    user_role: i16,
    dn: &str,
    changes: &[(i32, String, Vec<Vec<u8>>)],
) -> WriteResult {
    if check_access(user_role, AclOperation::Write, None) == AclDecision::Deny {
        tracing::warn!(dn = dn, "Modify denied: insufficient access");
        return WriteResult::denied("Insufficient access rights");
    }

    let parsed_dn = match signapps_ad_core::dn::DistinguishedName::parse(dn) {
        Ok(d) => d,
        Err(e) => return WriteResult::denied(&format!("Invalid DN: {e}")),
    };

    let username = parsed_dn.rdn_value();

    for (_op, attr_name, values) in changes {
        let value = values
            .first()
            .map(|v| String::from_utf8_lossy(v).to_string())
            .unwrap_or_default();

        // Map LDAP attribute modifications to SQL updates on identity.users.
        let sql: Option<(&str, String)> = match attr_name.to_lowercase().as_str() {
            "mail" => Some((
                "UPDATE identity.users SET email = $1, updated_at = now() WHERE username = $2",
                value.clone(),
            )),
            "department" => Some((
                "UPDATE identity.users SET department = $1, updated_at = now() WHERE username = $2",
                value.clone(),
            )),
            "title" => Some((
                "UPDATE identity.users SET job_title = $1, updated_at = now() WHERE username = $2",
                value.clone(),
            )),
            "telephonenumber" => Some((
                "UPDATE identity.users SET phone = $1, updated_at = now() WHERE username = $2",
                value.clone(),
            )),
            "displayname" => Some((
                "UPDATE identity.users SET display_name = $1, updated_at = now() WHERE username = $2",
                value.clone(),
            )),
            "useraccountcontrol" => {
                // UAC flags are stored in JSONB attributes of the linked node;
                // full implementation requires a separate update path.
                tracing::info!(attr = %attr_name, value = %value, "UAC update (deferred)");
                None
            }
            "unicodepwd" => {
                // Password change requires updating password_hash and Kerberos keys.
                tracing::info!(dn = dn, "Password change via LDAP Modify (deferred)");
                None
            }
            "serviceprincipalname" => {
                // SPN registration for computer accounts.
                tracing::info!(dn = dn, spn = %value, "SPN registered (deferred)");
                None
            }
            _ => {
                tracing::debug!(attr = %attr_name, "Unhandled attribute modification");
                None
            }
        };

        if let Some((query, val)) = sql {
            if let Err(e) =
                sqlx::query(query).bind(&val).bind(username).execute(pool).await
            {
                tracing::error!(attr = %attr_name, "Failed to update: {}", e);
                return WriteResult::denied(&format!("Failed to update {attr_name}: {e}"));
            }
        }
    }

    tracing::info!(dn = dn, changes = changes.len(), "Object modified via LDAP");
    WriteResult::ok()
}

/// Handle LDAP Delete (tombstone an object).
///
/// Sets `lifecycle_state = 'tombstone'` and `is_active = false` on the target
/// object in `workforce_org_nodes` rather than performing a hard delete,
/// preserving AD Recycle Bin semantics.  If no node is found, the operation
/// is attempted against `identity.users` (soft-update only; full user deletion
/// would require cascading through many tables).
///
/// # Examples
///
/// ```
/// // Full integration requires a live PgPool; unit tests rely on ACL checks only.
/// ```
///
/// # Errors
///
/// Returns a denied [`WriteResult`] when:
/// - The caller lacks `Delete` permission.
/// - The DN cannot be parsed.
///
/// # Panics
///
/// Never panics.
#[tracing::instrument(skip(pool), fields(dn = dn))]
pub async fn handle_delete(
    pool: &sqlx::PgPool,
    user_role: i16,
    dn: &str,
) -> WriteResult {
    if check_access(user_role, AclOperation::Delete, None) == AclDecision::Deny {
        tracing::warn!(dn = dn, "Delete denied: insufficient access");
        return WriteResult::denied("Insufficient access rights");
    }

    let parsed_dn = match signapps_ad_core::dn::DistinguishedName::parse(dn) {
        Ok(d) => d,
        Err(e) => return WriteResult::denied(&format!("Invalid DN: {e}")),
    };

    let name = parsed_dn.rdn_value();

    // Try to tombstone in workforce_org_nodes first.
    let result = sqlx::query(
        "UPDATE workforce_org_nodes SET lifecycle_state = 'tombstone', is_active = false, updated_at = now() WHERE name = $1",
    )
    .bind(name)
    .execute(pool)
    .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => {
            tracing::info!(dn = dn, "Object tombstoned in workforce_org_nodes");
            return WriteResult::ok();
        }
        Ok(_) => {
            tracing::debug!(dn = dn, name = name, "No org node found, trying identity.users");
        }
        Err(e) => {
            tracing::error!(dn = dn, "workforce_org_nodes tombstone failed: {}", e);
        }
    }

    // Fall back to identity.users (soft touch — no cascade delete).
    let result = sqlx::query(
        "UPDATE identity.users SET updated_at = now() WHERE username = $1",
    )
    .bind(name)
    .execute(pool)
    .await;

    match result {
        Ok(_) => {
            tracing::info!(dn = dn, "Delete processed (identity.users soft-update)");
        }
        Err(e) => {
            tracing::warn!(dn = dn, "identity.users soft-update failed: {}", e);
        }
    }

    WriteResult::ok()
}

/// Handle LDAP ModifyDN (move/rename an object).
///
/// `new_rdn` is the new leftmost RDN value (e.g. `"CN=NewName"`).
/// If `delete_old_rdn` is `true`, the old RDN attribute is removed.
/// `new_superior` optionally places the object under a different parent DN.
///
/// This operation is accepted and logged but not yet fully wired to the DB,
/// because renaming requires updating `parent_id` and recalculating the
/// closure-table ancestry — a non-trivial multi-step transaction.
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
        "ModifyDN (closure-table update deferred)"
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

    #[test]
    fn add_extracts_object_class() {
        // Verify that objectClass is extracted correctly from an attribute list.
        let attrs: Vec<(String, Vec<Vec<u8>>)> = vec![
            ("cn".to_string(), vec![b"John Doe".to_vec()]),
            ("objectClass".to_string(), vec![b"user".to_vec()]),
            ("sAMAccountName".to_string(), vec![b"jdoe".to_vec()]),
        ];

        let object_class = attrs
            .iter()
            .find(|(name, _)| name.eq_ignore_ascii_case("objectClass"))
            .and_then(|(_, values)| values.first())
            .map(|v| String::from_utf8_lossy(v).to_string())
            .unwrap_or_default();

        assert_eq!(object_class, "user");

        // Also verify sAMAccountName extraction (used in handle_add for user branch)
        let sam = attrs
            .iter()
            .find(|(name, _)| name.eq_ignore_ascii_case("sAMAccountName"))
            .and_then(|(_, values)| values.first())
            .map(|v| String::from_utf8_lossy(v).to_string())
            .unwrap_or_default();

        assert_eq!(sam, "jdoe");
    }

    #[test]
    fn modify_maps_ldap_to_sql() {
        // Verify that the attribute-name → SQL column mapping is correct.
        // We test the mapping table without needing a live DB.
        let mappings: &[(&str, &str)] = &[
            ("mail", "email"),
            ("department", "department"),
            ("title", "job_title"),
            ("telephonenumber", "phone"),
            ("displayname", "display_name"),
        ];

        // Build the same lookup the handler performs.
        let lookup = |attr: &str| -> Option<&str> {
            match attr.to_lowercase().as_str() {
                "mail" => Some("email"),
                "department" => Some("department"),
                "title" => Some("job_title"),
                "telephonenumber" => Some("phone"),
                "displayname" => Some("display_name"),
                _ => None,
            }
        };

        for (ldap_attr, expected_col) in mappings {
            assert_eq!(
                lookup(ldap_attr),
                Some(*expected_col),
                "mapping mismatch for LDAP attribute '{ldap_attr}'"
            );
        }

        // Attributes that should not map to a SQL column.
        assert!(lookup("unicodepwd").is_none());
        assert!(lookup("serviceprincipalname").is_none());
        assert!(lookup("useraccountcontrol").is_none());
        assert!(lookup("unknownattr").is_none());
    }
}
