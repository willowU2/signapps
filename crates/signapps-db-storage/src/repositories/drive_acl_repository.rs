//! Drive audit log and alert configuration repositories.
//!
//! The `AclRepository` (drive.acl) has been removed; permission management is
//! now handled exclusively by the `signapps-sharing` crate via `SharingEngine`.

use crate::models::drive_acl::{
    AuditAlertConfig, AuditLogFilters, DriveAuditLog, UpdateAlertConfig,
};
use signapps_common::{Error, Result};
use signapps_db_shared::pool::DatabasePool;
use uuid::Uuid;

// ============================================================================
// Audit Log Repository
// ============================================================================

/// Repository for the drive forensic audit log.
pub struct DriveAuditLogRepository<'a> {
    pool: &'a DatabasePool,
}

impl<'a> DriveAuditLogRepository<'a> {
    /// Create a new `DriveAuditLogRepository`.
    pub fn new(pool: &'a DatabasePool) -> Self {
        Self { pool }
    }

    /// Insert a new audit log entry.
    pub async fn insert(&self, log: &DriveAuditLog) -> Result<DriveAuditLog> {
        let row = sqlx::query_as::<_, DriveAuditLog>(
            r#"INSERT INTO drive.audit_log
                   (node_id, node_path, action, actor_id, actor_ip, actor_geo,
                    file_hash, details, prev_log_hash, log_hash, created_at)
               VALUES ($1, $2, $3::drive.audit_action, $4, $5::inet, $6,
                       $7, $8, $9, $10, $11)
               RETURNING *"#,
        )
        .bind(log.node_id)
        .bind(&log.node_path)
        .bind(&log.action)
        .bind(log.actor_id)
        .bind(log.actor_ip.as_deref())
        .bind(log.actor_geo.as_deref())
        .bind(log.file_hash.as_deref())
        .bind(&log.details)
        .bind(log.prev_log_hash.as_deref())
        .bind(&log.log_hash)
        .bind(log.created_at)
        .fetch_one(self.pool.inner())
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(row)
    }

    /// Query audit log entries with optional filters, pagination.
    pub async fn list(
        &self,
        filters: &AuditLogFilters,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<DriveAuditLog>> {
        let rows = sqlx::query_as::<_, DriveAuditLog>(
            r#"SELECT * FROM drive.audit_log
               WHERE ($1::uuid IS NULL OR node_id  = $1)
                 AND ($2::uuid IS NULL OR actor_id = $2)
                 AND ($3::text IS NULL OR action   = $3::drive.audit_action)
                 AND ($4::timestamptz IS NULL OR created_at >= $4)
                 AND ($5::timestamptz IS NULL OR created_at <= $5)
               ORDER BY created_at DESC
               LIMIT $6 OFFSET $7"#,
        )
        .bind(filters.node_id)
        .bind(filters.actor_id)
        .bind(filters.action.as_deref())
        .bind(filters.since)
        .bind(filters.until)
        .bind(limit)
        .bind(offset)
        .fetch_all(self.pool.inner())
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(rows)
    }

    /// Get the hash of the most recent audit log entry (for chain linking).
    pub async fn get_last_hash(&self) -> Result<Option<String>> {
        let hash = sqlx::query_scalar::<_, String>(
            "SELECT log_hash FROM drive.audit_log ORDER BY created_at DESC LIMIT 1",
        )
        .fetch_optional(self.pool.inner())
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(hash)
    }

    /// Count total audit log entries.
    pub async fn count(&self) -> Result<i64> {
        let n = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM drive.audit_log")
            .fetch_one(self.pool.inner())
            .await
            .map_err(|e| Error::Database(e.to_string()))?;

        Ok(n)
    }
}

// ============================================================================
// Alert Config Repository
// ============================================================================

/// Repository for audit alert configuration.
pub struct AuditAlertConfigRepository<'a> {
    pool: &'a DatabasePool,
}

impl<'a> AuditAlertConfigRepository<'a> {
    /// Create a new `AuditAlertConfigRepository`.
    pub fn new(pool: &'a DatabasePool) -> Self {
        Self { pool }
    }

    /// List all alert configurations for an organisation.
    pub async fn list(&self, org_id: Uuid) -> Result<Vec<AuditAlertConfig>> {
        let rows = sqlx::query_as::<_, AuditAlertConfig>(
            "SELECT * FROM drive.audit_alert_config WHERE org_id = $1 ORDER BY created_at ASC",
        )
        .bind(org_id)
        .fetch_all(self.pool.inner())
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(rows)
    }

    /// Update an alert configuration by ID.
    pub async fn update(&self, id: Uuid, config: UpdateAlertConfig) -> Result<AuditAlertConfig> {
        let row = sqlx::query_as::<_, AuditAlertConfig>(
            r#"UPDATE drive.audit_alert_config
               SET threshold     = COALESCE($2, threshold),
                   enabled       = COALESCE($3, enabled),
                   notify_emails = COALESCE($4, notify_emails),
                   updated_at    = NOW()
               WHERE id = $1
               RETURNING *"#,
        )
        .bind(id)
        .bind(config.threshold)
        .bind(config.enabled)
        .bind(config.notify_emails)
        .fetch_one(self.pool.inner())
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(row)
    }
}
