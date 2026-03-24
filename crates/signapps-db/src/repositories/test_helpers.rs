//! Test utilities for signapps-db repository unit tests.
//!
//! # Design Principles
//!
//! Repository tests in this crate follow a **no-live-database** strategy for
//! unit tests:
//!
//! - Models are constructed directly (all fields are public) to verify that
//!   field names, types, and `FromRow` derives compile correctly.
//! - SQL strings are validated structurally (table names, parameter
//!   placeholders, SQL keywords) without executing them.
//! - Serialisation round-trips (`serde_json`) confirm that the JSON shape the
//!   API exposes matches the model definition.
//! - Business-logic helpers (e.g. "is over quota?") are extracted into pure
//!   functions and tested independently of the repository struct.
//!
//! Integration tests that require a real PostgreSQL instance live under
//! `tests/` at the crate root and are gated behind the `integration` feature
//! flag so that `cargo test` in CI never blocks on database availability.
//!
//! # How to add tests for a new repository
//!
//! 1. Import the model types you need and the factory helpers below.
//! 2. Build model instances with `make_*` helpers or construct them inline —
//!    both styles are fine; inline construction is preferred when testing a
//!    single field.
//! 3. Copy the SQL strings from the repository implementation verbatim into
//!    `assert!(sql.contains(…))` checks.  This keeps the tests in sync with
//!    the implementation and makes regressions visible immediately.
//! 4. If the model is `Serialize + Deserialize`, add a round-trip test.
//!
//! # Example
//!
//! ```rust
//! #[cfg(test)]
//! mod tests {
//!     use crate::models::MyModel;
//!     use crate::repositories::test_helpers::make_uuid;
//!     use chrono::Utc;
//!
//!     fn make_my_model() -> MyModel {
//!         MyModel {
//!             id: make_uuid(),
//!             name: "test".to_string(),
//!             created_at: Utc::now(),
//!             updated_at: Utc::now(),
//!         }
//!     }
//!
//!     // Example test:
//!     fn test_my_model_serializes() {
//!         let m = make_my_model();
//!         let json = serde_json::to_string(&m).unwrap();
//!         assert!(json.contains("test"));
//!     }
//!
//!     // Example test:
//!     fn test_sql_select_uses_correct_table() {
//!         let sql = "SELECT * FROM my_schema.my_table WHERE id = $1";
//!         assert!(sql.contains("my_schema.my_table"));
//!         assert!(sql.contains("$1"));
//!     }
//! }
//! ```

// ============================================================================
// Public helpers (available in test cfg only)
// ============================================================================

#[cfg(test)]
pub mod helpers {
    use chrono::{DateTime, Utc};
    use uuid::Uuid;

    // -----------------------------------------------------------------------
    // UUID / timestamp utilities
    // -----------------------------------------------------------------------

    /// Return a freshly-generated random [`Uuid`].
    ///
    /// Prefer this over `Uuid::new_v4()` directly so that test code is easier
    /// to grep for and can be swapped out centrally if the generation strategy
    /// changes.
    pub fn make_uuid() -> Uuid {
        Uuid::new_v4()
    }

    /// Return the current UTC timestamp.
    ///
    /// Used to populate `created_at`/`updated_at` fields in model fixtures.
    pub fn now() -> DateTime<Utc> {
        Utc::now()
    }

    // -----------------------------------------------------------------------
    // SQL validation helpers
    // -----------------------------------------------------------------------

    /// Assert that a SQL string targets the expected `schema.table`.
    ///
    /// Panics with a descriptive message if the table reference is absent.
    ///
    /// # Example
    /// ```
    /// assert_sql_table("SELECT * FROM storage.quotas WHERE id = $1", "storage.quotas");
    /// ```
    pub fn assert_sql_table(sql: &str, schema_table: &str) {
        assert!(
            sql.contains(schema_table),
            "expected SQL to reference table `{schema_table}` but it doesn't.\nSQL:\n{sql}"
        );
    }

    /// Assert that a SQL string contains a specific parameter placeholder.
    ///
    /// # Example
    /// ```
    /// assert_sql_param("SELECT * FROM t WHERE id = $1 AND name = $2", "$2");
    /// ```
    pub fn assert_sql_param(sql: &str, placeholder: &str) {
        assert!(
            sql.contains(placeholder),
            "expected SQL to contain parameter `{placeholder}` but it doesn't.\nSQL:\n{sql}"
        );
    }

    /// Assert that a SQL string contains an `ON CONFLICT … DO UPDATE` clause,
    /// i.e. that the query is an upsert.
    pub fn assert_sql_is_upsert(sql: &str) {
        assert!(
            sql.contains("ON CONFLICT") && sql.contains("DO UPDATE"),
            "expected an upsert (ON CONFLICT … DO UPDATE) but clause is missing.\nSQL:\n{sql}"
        );
    }

    /// Assert that a SQL string ends with a `RETURNING` clause.
    pub fn assert_sql_returns_row(sql: &str) {
        assert!(
            sql.contains("RETURNING"),
            "expected SQL to contain RETURNING clause.\nSQL:\n{sql}"
        );
    }

    // -----------------------------------------------------------------------
    // JSON round-trip helper
    // -----------------------------------------------------------------------

    /// Serialise `value` to JSON and immediately deserialise it back.
    ///
    /// Panics if either step fails.  Use this to verify that a model's
    /// `Serialize`/`Deserialize` implementations are consistent.
    pub fn json_roundtrip<T>(value: &T) -> T
    where
        T: serde::Serialize + serde::de::DeserializeOwned,
    {
        let json = serde_json::to_string(value).expect("value must serialise to JSON");
        serde_json::from_str(&json).expect("value must deserialise from its own JSON")
    }
}

// ============================================================================
// Self-tests for the helper module itself
// ============================================================================

#[cfg(test)]
mod tests {
    use super::helpers::*;
    use crate::models::{SetQuotaLimits, StorageQuota, UpdateQuotaUsage};

    #[test]
    fn test_make_uuid_returns_non_nil() {
        let id = make_uuid();
        assert_ne!(id, uuid::Uuid::nil());
    }

    #[test]
    fn test_make_uuid_unique() {
        // Two successive calls must return different values.
        assert_ne!(make_uuid(), make_uuid());
    }

    #[test]
    fn test_now_returns_recent_timestamp() {
        let before = chrono::Utc::now();
        let ts = now();
        let after = chrono::Utc::now();
        assert!(ts >= before);
        assert!(ts <= after);
    }

    #[test]
    fn test_assert_sql_table_passes() {
        assert_sql_table(
            "SELECT * FROM storage.quotas WHERE id = $1",
            "storage.quotas",
        );
    }

    #[test]
    #[should_panic(expected = "expected SQL to reference table")]
    fn test_assert_sql_table_fails_on_wrong_table() {
        assert_sql_table("SELECT * FROM wrong.table WHERE id = $1", "storage.quotas");
    }

    #[test]
    fn test_assert_sql_param_passes() {
        assert_sql_param("SELECT * FROM t WHERE id = $1 AND name = $2", "$2");
    }

    #[test]
    #[should_panic(expected = "expected SQL to contain parameter")]
    fn test_assert_sql_param_fails_on_missing_placeholder() {
        assert_sql_param("SELECT * FROM t WHERE id = $1", "$2");
    }

    #[test]
    fn test_assert_sql_is_upsert_passes() {
        let sql = "INSERT INTO t (a) VALUES ($1) ON CONFLICT (a) DO UPDATE SET a = $1";
        assert_sql_is_upsert(sql);
    }

    #[test]
    #[should_panic(expected = "expected an upsert")]
    fn test_assert_sql_is_upsert_fails_on_plain_insert() {
        assert_sql_is_upsert("INSERT INTO t (a) VALUES ($1)");
    }

    #[test]
    fn test_assert_sql_returns_row_passes() {
        assert_sql_returns_row("INSERT INTO t (a) VALUES ($1) RETURNING *");
    }

    #[test]
    #[should_panic(expected = "expected SQL to contain RETURNING clause")]
    fn test_assert_sql_returns_row_fails_when_absent() {
        assert_sql_returns_row("INSERT INTO t (a) VALUES ($1)");
    }

    #[test]
    fn test_json_roundtrip_storage_quota() {
        let q = StorageQuota {
            user_id: make_uuid(),
            max_storage_bytes: Some(1_000_000),
            max_files: Some(500),
            max_file_size_bytes: None,
            used_storage_bytes: 42_000,
            file_count: 7,
            allowed_buckets: Some(vec!["docs".to_string()]),
            created_at: now(),
            updated_at: now(),
        };

        let decoded = json_roundtrip(&q);
        assert_eq!(decoded.user_id, q.user_id);
        assert_eq!(decoded.max_storage_bytes, q.max_storage_bytes);
        assert_eq!(decoded.used_storage_bytes, q.used_storage_bytes);
        assert_eq!(decoded.file_count, q.file_count);
        assert_eq!(decoded.allowed_buckets, q.allowed_buckets);
    }

    #[test]
    fn test_json_roundtrip_set_quota_limits() {
        // SetQuotaLimits is Deserialize only; verify serde_json can handle it
        // as a JSON value parsed from a known string.
        let json = r#"{
            "max_storage_bytes": 5000000000,
            "max_files": null,
            "max_file_size_bytes": 104857600,
            "allowed_buckets": ["uploads", "media"]
        }"#;

        let dto: SetQuotaLimits =
            serde_json::from_str(json).expect("SetQuotaLimits must deserialise from JSON");

        assert_eq!(dto.max_storage_bytes, Some(5_000_000_000));
        assert!(dto.max_files.is_none());
        assert_eq!(dto.max_file_size_bytes, Some(104_857_600));
        let buckets = dto.allowed_buckets.as_ref().unwrap();
        assert_eq!(buckets[0], "uploads");
        assert_eq!(buckets[1], "media");
    }

    #[test]
    fn test_json_roundtrip_update_quota_usage() {
        let json = r#"{"used_storage_bytes": 123456, "file_count": 99}"#;

        let dto: UpdateQuotaUsage =
            serde_json::from_str(json).expect("UpdateQuotaUsage must deserialise from JSON");

        assert_eq!(dto.used_storage_bytes, 123_456);
        assert_eq!(dto.file_count, 99);
    }
}
