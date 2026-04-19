//! Insert + query helpers for `org_ad_sync_log`.

use anyhow::Result;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::org::AdSyncLog;

/// Repository for the canonical `org_ad_sync_log` table.
pub struct AdSyncLogRepository<'a> {
    pool: &'a PgPool,
}

impl<'a> AdSyncLogRepository<'a> {
    /// Construct a new repository bound to the given pool.
    pub fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    /// Insert one sync-log row.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error if the insert fails.
    pub async fn insert(
        &self,
        tenant_id: Uuid,
        run_id: Uuid,
        entry_dn: &str,
        direction: &str,
        status: &str,
        diff: serde_json::Value,
        error: Option<&str>,
    ) -> Result<AdSyncLog> {
        let row = sqlx::query_as::<_, AdSyncLog>(
            "INSERT INTO org_ad_sync_log
                (tenant_id, run_id, entry_dn, direction, status, diff, error)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *",
        )
        .bind(tenant_id)
        .bind(run_id)
        .bind(entry_dn)
        .bind(direction)
        .bind(status)
        .bind(diff)
        .bind(error)
        .fetch_one(self.pool)
        .await?;
        Ok(row)
    }

    /// List every entry produced by one sync run.
    pub async fn list_by_run(&self, run_id: Uuid) -> Result<Vec<AdSyncLog>> {
        let rows = sqlx::query_as::<_, AdSyncLog>(
            "SELECT * FROM org_ad_sync_log
              WHERE run_id = $1
              ORDER BY created_at",
        )
        .bind(run_id)
        .fetch_all(self.pool)
        .await?;
        Ok(rows)
    }

    /// List every entry whose status is `error` and that has not yet
    /// been retried — used by the W3 retry worker.
    pub async fn list_pending_retry(&self, tenant_id: Uuid) -> Result<Vec<AdSyncLog>> {
        let rows = sqlx::query_as::<_, AdSyncLog>(
            "SELECT * FROM org_ad_sync_log
              WHERE tenant_id = $1 AND status = 'error'
              ORDER BY created_at",
        )
        .bind(tenant_id)
        .fetch_all(self.pool)
        .await?;
        Ok(rows)
    }
}
