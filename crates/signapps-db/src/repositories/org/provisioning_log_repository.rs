//! Insert + lifecycle helpers for `org_provisioning_log`.

use anyhow::Result;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::org::ProvisioningLog;

/// Repository for the canonical `org_provisioning_log` table.
pub struct ProvisioningLogRepository<'a> {
    pool: &'a PgPool,
}

impl<'a> ProvisioningLogRepository<'a> {
    /// Construct a new repository bound to the given pool.
    pub fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    /// Insert a new provisioning log row (initial attempt).
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error if the insert fails (FK
    /// violation on `person_id`, ...).
    pub async fn insert(
        &self,
        tenant_id: Uuid,
        person_id: Uuid,
        topic: &str,
        service: &str,
        status: &str,
        error: Option<&str>,
    ) -> Result<ProvisioningLog> {
        let row = sqlx::query_as::<_, ProvisioningLog>(
            "INSERT INTO org_provisioning_log
                (tenant_id, person_id, topic, service, status, error)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *",
        )
        .bind(tenant_id)
        .bind(person_id)
        .bind(topic)
        .bind(service)
        .bind(status)
        .bind(error)
        .fetch_one(self.pool)
        .await?;
        Ok(row)
    }

    /// Increment the attempt counter on a row. Used by the W5 retry
    /// worker before re-trying a failed fan-out.
    pub async fn bump_attempts(&self, id: Uuid) -> Result<ProvisioningLog> {
        let row = sqlx::query_as::<_, ProvisioningLog>(
            "UPDATE org_provisioning_log
                SET attempts = attempts + 1, updated_at = now()
              WHERE id = $1
              RETURNING *",
        )
        .bind(id)
        .fetch_one(self.pool)
        .await?;
        Ok(row)
    }

    /// Update the status (and optional error) of a row.
    pub async fn mark_status(
        &self,
        id: Uuid,
        status: &str,
        error: Option<&str>,
    ) -> Result<ProvisioningLog> {
        let row = sqlx::query_as::<_, ProvisioningLog>(
            "UPDATE org_provisioning_log
                SET status = $2, error = $3, updated_at = now()
              WHERE id = $1
              RETURNING *",
        )
        .bind(id)
        .bind(status)
        .bind(error)
        .fetch_one(self.pool)
        .await?;
        Ok(row)
    }
}
