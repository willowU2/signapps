//! LDAP Compare operation (RFC 4511 §4.10).
//!
//! Checks whether a named attribute of a directory entry holds a given value,
//! without returning the full entry.  Requires at least read access.

/// Result of a compare operation.
#[derive(Debug, PartialEq)]
pub enum CompareResult {
    /// The attribute value matches.
    True,
    /// The attribute value does not match, or the attribute is absent.
    False,
    /// No object exists at the specified DN.
    NoSuchObject,
    /// An error occurred (e.g. access denied).
    Error(String),
}

/// Handle LDAP Compare request.
///
/// Checks if the specified attribute of the entry identified by `dn` holds
/// `value`.  The caller must have at least `user_role >= 1` (authenticated).
///
/// Full implementation is deferred until [`DirectoryEntry`] loading is wired
/// to the PostgreSQL backend; the handler currently returns
/// [`CompareResult::NoSuchObject`] for every lookup.
///
/// # Examples
///
/// ```
/// // Full integration requires a live PgPool; unit tests rely on role checks only.
/// ```
///
/// # Errors
///
/// Returns [`CompareResult::Error`] when `user_role < 1` (unauthenticated).
///
/// # Panics
///
/// Never panics.
#[tracing::instrument(skip(_pool, value), fields(dn = dn, attribute = attribute))]
pub async fn handle_compare(
    _pool: &sqlx::PgPool,
    user_role: i16,
    dn: &str,
    attribute: &str,
    value: &[u8],
) -> CompareResult {
    if user_role < 1 {
        tracing::warn!(dn = dn, "Compare denied: unauthenticated");
        return CompareResult::Error("Insufficient access".to_string());
    }
    tracing::debug!(dn = dn, attr = attribute, value_len = value.len(), "Compare operation");
    // Will be implemented when DirectoryEntry loading is wired to PostgreSQL.
    CompareResult::NoSuchObject
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compare_result_variants() {
        assert_eq!(CompareResult::True, CompareResult::True);
        assert_ne!(CompareResult::True, CompareResult::False);
        assert_ne!(CompareResult::NoSuchObject, CompareResult::False);
    }

    #[test]
    fn compare_result_error_neq() {
        // Two Error variants with different messages are not equal.
        assert_ne!(
            CompareResult::Error("a".to_string()),
            CompareResult::Error("b".to_string())
        );
        assert_eq!(
            CompareResult::Error("same".to_string()),
            CompareResult::Error("same".to_string())
        );
    }
}
