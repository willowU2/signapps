//! Deterministic UUID generation for Acme Corp demo data.
//!
//! Uses UUID namespace v5 — same input (kind, key) always produces the
//! same UUID. This guarantees seeders are idempotent and cross-service
//! references stay consistent across re-runs.

use uuid::Uuid;

/// Namespace for all Acme Corp demo UUIDs.
///
/// The bytes form a recognisable, opaque namespace distinct from the
/// standard DNS / URL / OID namespaces. Combined with (kind, key), v5
/// hashes into a stable UUID.
pub const ACME_NS: Uuid = Uuid::from_bytes([
    0x00, 0x00, 0x00, 0x00, 0xac, 0xbe, 0x50, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01,
]);

/// Generate a deterministic UUID from (kind, key).
///
/// # Examples
///
/// ```
/// use signapps_seed::uuid::acme_uuid;
/// let a = acme_uuid("user", "marie.dupont");
/// let b = acme_uuid("user", "marie.dupont");
/// assert_eq!(a, b);
/// ```
pub fn acme_uuid(kind: &str, key: &str) -> Uuid {
    Uuid::new_v5(&ACME_NS, format!("{}:{}", kind, key).as_bytes())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_deterministic() {
        let a = acme_uuid("user", "marie.dupont");
        let b = acme_uuid("user", "marie.dupont");
        assert_eq!(a, b);
    }

    #[test]
    fn test_different_keys_different_uuids() {
        let a = acme_uuid("user", "marie.dupont");
        let b = acme_uuid("user", "jean.martin");
        assert_ne!(a, b);
    }

    #[test]
    fn test_different_kinds_different_uuids() {
        let a = acme_uuid("user", "marie.dupont");
        let b = acme_uuid("contact", "marie.dupont");
        assert_ne!(a, b);
    }
}
