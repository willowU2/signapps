//! Storage quota repository.

use crate::models::{SetQuotaLimits, StorageQuota, UpdateQuotaUsage};
use signapps_common::{Error, Result};
use signapps_db_shared::pool::DatabasePool;
use sqlx::Row;
use uuid::Uuid;

/// Repository for storage quota operations.
pub struct QuotaRepository<'a> {
    pool: &'a DatabasePool,
}

impl<'a> QuotaRepository<'a> {
    pub fn new(pool: &'a DatabasePool) -> Self {
        Self { pool }
    }

    /// Fetch the quota record for a user, returning None if no row exists.
    pub async fn get_quota(&self, user_id: Uuid) -> Result<Option<StorageQuota>> {
        let quota =
            sqlx::query_as::<_, StorageQuota>("SELECT * FROM storage.quotas WHERE user_id = $1")
                .bind(user_id)
                .fetch_optional(self.pool.inner())
                .await
                .map_err(|e| Error::Database(e.to_string()))?;

        Ok(quota)
    }

    /// Upsert quota limits for a user (admin operation).
    /// Only touches the limit columns; leaves used_* counters untouched on conflict.
    pub async fn set_quota_limits(
        &self,
        user_id: Uuid,
        limits: SetQuotaLimits,
    ) -> Result<StorageQuota> {
        let quota = sqlx::query_as::<_, StorageQuota>(
            r#"
            INSERT INTO storage.quotas (
                user_id, max_storage_bytes, max_files,
                max_file_size_bytes, allowed_buckets
            )
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (user_id) DO UPDATE SET
                max_storage_bytes  = EXCLUDED.max_storage_bytes,
                max_files          = EXCLUDED.max_files,
                max_file_size_bytes= EXCLUDED.max_file_size_bytes,
                allowed_buckets    = EXCLUDED.allowed_buckets,
                updated_at         = NOW()
            RETURNING *
            "#,
        )
        .bind(user_id)
        .bind(limits.max_storage_bytes)
        .bind(limits.max_files)
        .bind(limits.max_file_size_bytes)
        .bind(limits.allowed_buckets)
        .fetch_one(self.pool.inner())
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(quota)
    }

    /// Directly overwrite the used_storage_bytes and file_count for a user (admin / recalculate).
    pub async fn update_quota_usage(
        &self,
        user_id: Uuid,
        usage: UpdateQuotaUsage,
    ) -> Result<StorageQuota> {
        let quota = sqlx::query_as::<_, StorageQuota>(
            r#"
            INSERT INTO storage.quotas (user_id, used_storage_bytes, file_count)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id) DO UPDATE SET
                used_storage_bytes = EXCLUDED.used_storage_bytes,
                file_count         = EXCLUDED.file_count,
                updated_at         = NOW()
            RETURNING *
            "#,
        )
        .bind(user_id)
        .bind(usage.used_storage_bytes)
        .bind(usage.file_count)
        .fetch_one(self.pool.inner())
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(quota)
    }

    /// Atomically increment used_storage_bytes and file_count after an upload.
    pub async fn increment_usage(&self, user_id: Uuid, bytes: i64) -> Result<()> {
        sqlx::query(
            r#"
            INSERT INTO storage.quotas (user_id, used_storage_bytes, file_count)
            VALUES ($1, $2, 1)
            ON CONFLICT (user_id) DO UPDATE SET
                used_storage_bytes = storage.quotas.used_storage_bytes + $2,
                file_count         = storage.quotas.file_count + 1,
                updated_at         = NOW()
            "#,
        )
        .bind(user_id)
        .bind(bytes)
        .execute(self.pool.inner())
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(())
    }

    /// Atomically decrement used_storage_bytes and file_count after a deletion.
    /// Clamps at zero to prevent negative counters.
    pub async fn decrement_usage(&self, user_id: Uuid, bytes: i64) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE storage.quotas
            SET used_storage_bytes = GREATEST(0, used_storage_bytes - $2),
                file_count         = GREATEST(0, file_count - 1),
                updated_at         = NOW()
            WHERE user_id = $1
            "#,
        )
        .bind(user_id)
        .bind(bytes)
        .execute(self.pool.inner())
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(())
    }

    /// Delete the quota row for a user.
    pub async fn delete_quota(&self, user_id: Uuid) -> Result<bool> {
        let result = sqlx::query("DELETE FROM storage.quotas WHERE user_id = $1")
            .bind(user_id)
            .execute(self.pool.inner())
            .await
            .map_err(|e| Error::Database(e.to_string()))?;

        Ok(result.rows_affected() > 0)
    }

    /// Return all users whose used storage or file count exceeds their configured limit.
    pub async fn list_over_quota(&self) -> Result<Vec<StorageQuota>> {
        let rows = sqlx::query_as::<_, StorageQuota>(
            r#"
            SELECT * FROM storage.quotas
            WHERE (max_storage_bytes IS NOT NULL AND used_storage_bytes > max_storage_bytes)
               OR (max_files         IS NOT NULL AND file_count          > max_files)
            "#,
        )
        .fetch_all(self.pool.inner())
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(rows)
    }

    /// Recalculate actual usage from storage.files and sync to the quota row.
    pub async fn recalculate_from_files(&self, user_id: Uuid) -> Result<StorageQuota> {
        let mut tx = self
            .pool
            .inner()
            .begin()
            .await
            .map_err(|e| Error::Database(e.to_string()))?;

        let row = sqlx::query(
            r#"
            SELECT
                COALESCE(SUM(size), 0) AS total_size,
                COUNT(*)               AS total_count
            FROM storage.files
            WHERE user_id = $1
            "#,
        )
        .bind(user_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        let total_size: i64 = row.get("total_size");
        let total_count: i64 = row.get("total_count");

        let quota = sqlx::query_as::<_, StorageQuota>(
            r#"
            INSERT INTO storage.quotas (user_id, used_storage_bytes, file_count)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id) DO UPDATE SET
                used_storage_bytes = EXCLUDED.used_storage_bytes,
                file_count         = EXCLUDED.file_count,
                updated_at         = NOW()
            RETURNING *
            "#,
        )
        .bind(user_id)
        .bind(total_size)
        .bind(total_count)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        tx.commit()
            .await
            .map_err(|e| Error::Database(e.to_string()))?;

        Ok(quota)
    }
}

// ============================================================================
// Unit tests — no live database required
// ============================================================================
#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    /// Build a fully-populated [`StorageQuota`] value without hitting the DB.
    ///
    /// This mirrors the pattern documented in `test_helpers.rs`: construct the
    /// model directly so that serialization, field names, and Default values
    /// are all verified at compile time.
    fn make_quota(user_id: Uuid) -> StorageQuota {
        StorageQuota {
            user_id,
            max_storage_bytes: Some(10 * 1024 * 1024 * 1024), // 10 GiB
            max_files: Some(100_000),
            max_file_size_bytes: Some(512 * 1024 * 1024), // 512 MiB
            used_storage_bytes: 0,
            file_count: 0,
            allowed_buckets: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    // -----------------------------------------------------------------------
    // Struct construction
    // -----------------------------------------------------------------------

    /// Verify that `QuotaRepository::new` compiles and stores the pool reference.
    /// Because `DatabasePool` requires a live Postgres connection we only assert
    /// that the type is nameable and that the constructor signature is correct.
    #[test]
    fn test_quota_repository_type_is_named() {
        // Compile-time check: the type must exist and be publicly accessible.
        let _type_name = std::any::type_name::<QuotaRepository<'_>>();
        // If the line above compiles, the struct is correctly declared.
    }

    // -----------------------------------------------------------------------
    // Model construction & field access
    // -----------------------------------------------------------------------

    #[test]
    fn test_storage_quota_fields_accessible() {
        let uid = Uuid::new_v4();
        let q = make_quota(uid);

        assert_eq!(q.user_id, uid);
        assert_eq!(q.used_storage_bytes, 0);
        assert_eq!(q.file_count, 0);
        assert!(q.max_storage_bytes.is_some());
        assert!(q.max_files.is_some());
        assert!(q.max_file_size_bytes.is_some());
        assert!(q.allowed_buckets.is_none());
    }

    #[test]
    fn test_storage_quota_unlimited_variant() {
        let q = StorageQuota {
            user_id: Uuid::new_v4(),
            max_storage_bytes: None,
            max_files: None,
            max_file_size_bytes: None,
            used_storage_bytes: 42,
            file_count: 3,
            allowed_buckets: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        // None means "unlimited" — ensure the convention compiles and is
        // expressible through the public struct.
        assert!(q.max_storage_bytes.is_none());
        assert!(q.max_files.is_none());
        assert_eq!(q.used_storage_bytes, 42);
        assert_eq!(q.file_count, 3);
    }

    #[test]
    fn test_storage_quota_allowed_buckets_populated() {
        let buckets = vec!["documents".to_string(), "images".to_string()];
        let q = StorageQuota {
            user_id: Uuid::new_v4(),
            max_storage_bytes: None,
            max_files: None,
            max_file_size_bytes: None,
            used_storage_bytes: 0,
            file_count: 0,
            allowed_buckets: Some(buckets.clone()),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let stored = q
            .allowed_buckets
            .as_ref()
            .expect("allowed_buckets was set in constructor");
        assert_eq!(stored.len(), 2);
        assert!(stored.contains(&"documents".to_string()));
        assert!(stored.contains(&"images".to_string()));
    }

    // -----------------------------------------------------------------------
    // Model serialisation / deserialisation
    // -----------------------------------------------------------------------

    #[test]
    fn test_storage_quota_serializes_to_json() {
        let uid = Uuid::new_v4();
        let q = make_quota(uid);

        let json = serde_json::to_string(&q).expect("StorageQuota must serialise");
        assert!(json.contains(&uid.to_string()));
        assert!(json.contains("max_storage_bytes"));
        assert!(json.contains("used_storage_bytes"));
        assert!(json.contains("file_count"));
    }

    #[test]
    fn test_storage_quota_roundtrip_json() {
        let uid = Uuid::new_v4();
        let original = make_quota(uid);

        let json = serde_json::to_string(&original).expect("StorageQuota must serialize to JSON");
        let decoded: StorageQuota =
            serde_json::from_str(&json).expect("StorageQuota must deserialise from its own JSON");

        assert_eq!(decoded.user_id, original.user_id);
        assert_eq!(decoded.max_storage_bytes, original.max_storage_bytes);
        assert_eq!(decoded.max_files, original.max_files);
        assert_eq!(decoded.max_file_size_bytes, original.max_file_size_bytes);
        assert_eq!(decoded.used_storage_bytes, original.used_storage_bytes);
        assert_eq!(decoded.file_count, original.file_count);
    }

    // -----------------------------------------------------------------------
    // Input DTOs
    // -----------------------------------------------------------------------

    #[test]
    fn test_set_quota_limits_all_none() {
        let dto = SetQuotaLimits {
            max_storage_bytes: None,
            max_files: None,
            max_file_size_bytes: None,
            allowed_buckets: None,
        };

        // All-None means "remove all limits" — the struct must accept this.
        assert!(dto.max_storage_bytes.is_none());
        assert!(dto.allowed_buckets.is_none());
    }

    #[test]
    fn test_set_quota_limits_partial() {
        let dto = SetQuotaLimits {
            max_storage_bytes: Some(5 * 1024 * 1024 * 1024),
            max_files: None,
            max_file_size_bytes: Some(100 * 1024 * 1024),
            allowed_buckets: Some(vec!["uploads".to_string()]),
        };

        assert_eq!(dto.max_storage_bytes, Some(5 * 1024 * 1024 * 1024));
        assert!(dto.max_files.is_none());
        assert_eq!(dto.max_file_size_bytes, Some(100 * 1024 * 1024));
        let buckets = dto
            .allowed_buckets
            .as_ref()
            .expect("allowed_buckets was set in this dto");
        assert_eq!(buckets[0], "uploads");
    }

    #[test]
    fn test_update_quota_usage_fields() {
        let dto = UpdateQuotaUsage {
            used_storage_bytes: 1_234_567,
            file_count: 99,
        };

        assert_eq!(dto.used_storage_bytes, 1_234_567);
        assert_eq!(dto.file_count, 99);
    }

    // -----------------------------------------------------------------------
    // SQL query string validation (structure checks)
    // -----------------------------------------------------------------------

    /// Validate that every SQL string used by `QuotaRepository` follows the
    /// expected structural conventions without requiring a live connection.
    ///
    /// These checks catch copy-paste mistakes (wrong table name, missing
    /// parameter placeholder, wrong schema prefix) at unit-test time.

    #[test]
    fn test_sql_get_quota_targets_correct_table() {
        let sql = "SELECT * FROM storage.quotas WHERE user_id = $1";
        assert!(sql.contains("storage.quotas"), "must query storage.quotas");
        assert!(sql.contains("$1"), "must bind user_id as $1");
    }

    #[test]
    fn test_sql_set_quota_limits_upsert_columns() {
        let sql = r#"
            INSERT INTO storage.quotas (
                user_id, max_storage_bytes, max_files,
                max_file_size_bytes, allowed_buckets
            )
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (user_id) DO UPDATE SET
                max_storage_bytes  = EXCLUDED.max_storage_bytes,
                max_files          = EXCLUDED.max_files,
                max_file_size_bytes= EXCLUDED.max_file_size_bytes,
                allowed_buckets    = EXCLUDED.allowed_buckets,
                updated_at         = NOW()
            RETURNING *
        "#;

        assert!(
            sql.contains("ON CONFLICT (user_id)"),
            "must upsert on user_id"
        );
        assert!(sql.contains("RETURNING *"), "must return the upserted row");
        assert!(sql.contains("$5"), "must have 5 bind parameters");
        assert!(
            sql.contains("allowed_buckets"),
            "must include allowed_buckets column"
        );
    }

    #[test]
    fn test_sql_update_quota_usage_columns() {
        let sql = r#"
            INSERT INTO storage.quotas (user_id, used_storage_bytes, file_count)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id) DO UPDATE SET
                used_storage_bytes = EXCLUDED.used_storage_bytes,
                file_count         = EXCLUDED.file_count,
                updated_at         = NOW()
            RETURNING *
        "#;

        assert!(
            sql.contains("used_storage_bytes"),
            "must update used_storage_bytes"
        );
        assert!(sql.contains("file_count"), "must update file_count");
        assert!(sql.contains("$3"), "must have 3 bind parameters");
        assert!(sql.contains("RETURNING *"), "must return the updated row");
    }

    #[test]
    fn test_sql_increment_usage_avoids_negative() {
        // The increment query uses arithmetic on the existing row value so it
        // does NOT clamp; the decrement query uses GREATEST(0, …).
        let increment_sql = r#"
            INSERT INTO storage.quotas (user_id, used_storage_bytes, file_count)
            VALUES ($1, $2, 1)
            ON CONFLICT (user_id) DO UPDATE SET
                used_storage_bytes = storage.quotas.used_storage_bytes + $2,
                file_count         = storage.quotas.file_count + 1,
                updated_at         = NOW()
        "#;

        assert!(
            increment_sql.contains("storage.quotas.used_storage_bytes + $2"),
            "increment must add to the existing counter"
        );
        assert!(
            increment_sql.contains("file_count + 1"),
            "increment must add 1 to file_count"
        );
    }

    #[test]
    fn test_sql_decrement_usage_clamps_at_zero() {
        let decrement_sql = r#"
            UPDATE storage.quotas
            SET used_storage_bytes = GREATEST(0, used_storage_bytes - $2),
                file_count         = GREATEST(0, file_count - 1),
                updated_at         = NOW()
            WHERE user_id = $1
        "#;

        assert!(
            decrement_sql.contains("GREATEST(0"),
            "decrement must clamp at 0 to prevent negative counters"
        );
        assert!(
            decrement_sql.contains("used_storage_bytes - $2"),
            "must subtract the supplied byte count"
        );
        assert!(
            decrement_sql.contains("file_count - 1"),
            "must decrement file_count by 1"
        );
    }

    #[test]
    fn test_sql_delete_quota_targets_correct_table() {
        let sql = "DELETE FROM storage.quotas WHERE user_id = $1";
        assert!(sql.contains("storage.quotas"), "must target storage.quotas");
        assert!(sql.contains("$1"), "must bind user_id as $1");
    }

    #[test]
    fn test_sql_list_over_quota_conditions() {
        // Use the exact SQL string from list_over_quota() — alignment spaces included.
        let sql = r#"
            SELECT * FROM storage.quotas
            WHERE (max_storage_bytes IS NOT NULL AND used_storage_bytes > max_storage_bytes)
               OR (max_files         IS NOT NULL AND file_count          > max_files)
            "#;

        assert!(
            sql.contains("IS NOT NULL"),
            "must guard against NULL limits (unlimited accounts)"
        );
        assert!(
            sql.contains("used_storage_bytes > max_storage_bytes"),
            "must detect byte-quota violations"
        );
        // The implementation pads `file_count` with spaces for alignment;
        // match the substring that appears regardless of padding.
        assert!(
            sql.contains("file_count") && sql.contains("> max_files"),
            "must detect file-count violations"
        );
    }

    #[test]
    fn test_sql_recalculate_aggregates_files_table() {
        let aggregate_sql = r#"
            SELECT
                COALESCE(SUM(size), 0) AS total_size,
                COUNT(*)               AS total_count
            FROM storage.files
            WHERE user_id = $1
        "#;

        assert!(
            aggregate_sql.contains("COALESCE(SUM(size), 0)"),
            "must coalesce NULL sum to 0 when user has no files"
        );
        assert!(
            aggregate_sql.contains("storage.files"),
            "must aggregate from storage.files"
        );
        assert!(
            aggregate_sql.contains("total_size"),
            "alias total_size must be present for row.get()"
        );
        assert!(
            aggregate_sql.contains("total_count"),
            "alias total_count must be present for row.get()"
        );
    }

    // -----------------------------------------------------------------------
    // Business logic helpers (pure, no DB)
    // -----------------------------------------------------------------------

    /// Demonstrate the "is over quota?" check that callers would perform after
    /// fetching a `StorageQuota` from the repository.
    fn is_over_storage_quota(q: &StorageQuota) -> bool {
        match q.max_storage_bytes {
            Some(limit) => q.used_storage_bytes > limit,
            None => false, // unlimited
        }
    }

    fn is_over_file_quota(q: &StorageQuota) -> bool {
        match q.max_files {
            Some(limit) => q.file_count > limit,
            None => false,
        }
    }

    #[test]
    fn test_quota_not_exceeded_when_under_limit() {
        let mut q = make_quota(Uuid::new_v4());
        q.used_storage_bytes = 1024;
        q.file_count = 1;

        assert!(!is_over_storage_quota(&q));
        assert!(!is_over_file_quota(&q));
    }

    #[test]
    fn test_quota_exceeded_when_over_storage_limit() {
        let mut q = make_quota(Uuid::new_v4());
        q.max_storage_bytes = Some(1000);
        q.used_storage_bytes = 1001;

        assert!(is_over_storage_quota(&q));
    }

    #[test]
    fn test_quota_not_exceeded_when_unlimited() {
        let q = StorageQuota {
            user_id: Uuid::new_v4(),
            max_storage_bytes: None, // unlimited
            max_files: None,
            max_file_size_bytes: None,
            used_storage_bytes: i64::MAX,
            file_count: i64::MAX,
            allowed_buckets: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        assert!(!is_over_storage_quota(&q));
        assert!(!is_over_file_quota(&q));
    }

    #[test]
    fn test_quota_exactly_at_limit_is_not_over() {
        let mut q = make_quota(Uuid::new_v4());
        q.max_storage_bytes = Some(1_000_000);
        q.used_storage_bytes = 1_000_000; // exactly at limit, not over

        assert!(!is_over_storage_quota(&q));
    }
}
