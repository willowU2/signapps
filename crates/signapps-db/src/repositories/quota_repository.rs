//! Storage quota repository.

use crate::models::{SetQuotaLimits, StorageQuota, UpdateQuotaUsage};
use crate::DatabasePool;
use signapps_common::{Error, Result};
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
        let quota = sqlx::query_as::<_, StorageQuota>(
            "SELECT * FROM storage.quotas WHERE user_id = $1",
        )
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
