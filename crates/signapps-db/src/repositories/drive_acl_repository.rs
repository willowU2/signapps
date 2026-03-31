//! Drive ACL, audit log, and alert configuration repositories.

use crate::models::drive_acl::{
    AuditAlertConfig, AuditLogFilters, CreateAcl, DriveAcl, DriveAuditLog, UpdateAcl,
    UpdateAlertConfig,
};
use crate::DatabasePool;
use signapps_common::{Error, Result};
use uuid::Uuid;

// ============================================================================
// ACL Repository
// ============================================================================

/// Repository for drive ACL grant operations.
pub struct AclRepository<'a> {
    pool: &'a DatabasePool,
}

impl<'a> AclRepository<'a> {
    /// Create a new `AclRepository`.
    pub fn new(pool: &'a DatabasePool) -> Self {
        Self { pool }
    }

    /// List all non-expired ACL grants for a drive node.
    pub async fn list_by_node(&self, node_id: Uuid) -> Result<Vec<DriveAcl>> {
        let rows = sqlx::query_as::<_, DriveAcl>(
            r#"SELECT * FROM drive.acl
               WHERE node_id = $1
                 AND (expires_at IS NULL OR expires_at > NOW())
               ORDER BY created_at ASC"#,
        )
        .bind(node_id)
        .fetch_all(self.pool.inner())
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(rows)
    }

    /// Create an ACL grant on a node.
    pub async fn create(
        &self,
        node_id: Uuid,
        granted_by: Uuid,
        input: CreateAcl,
    ) -> Result<DriveAcl> {
        let row = sqlx::query_as::<_, DriveAcl>(
            r#"INSERT INTO drive.acl
                   (node_id, grantee_type, grantee_id, role, inherit, granted_by, expires_at)
               VALUES ($1, $2, $3, $4::drive.acl_role, $5, $6, $7)
               RETURNING *"#,
        )
        .bind(node_id)
        .bind(&input.grantee_type)
        .bind(input.grantee_id)
        .bind(&input.role)
        .bind(input.inherit)
        .bind(granted_by)
        .bind(input.expires_at)
        .fetch_one(self.pool.inner())
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(row)
    }

    /// Update an existing ACL grant (role / inherit / expiry).
    pub async fn update(&self, acl_id: Uuid, input: UpdateAcl) -> Result<DriveAcl> {
        let row = sqlx::query_as::<_, DriveAcl>(
            r#"UPDATE drive.acl
               SET role       = COALESCE($2::drive.acl_role, role),
                   inherit    = COALESCE($3, inherit),
                   expires_at = COALESCE($4, expires_at),
                   updated_at = NOW()
               WHERE id = $1
               RETURNING *"#,
        )
        .bind(acl_id)
        .bind(input.role.as_deref())
        .bind(input.inherit)
        .bind(input.expires_at)
        .fetch_one(self.pool.inner())
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(row)
    }

    /// Delete an ACL grant by ID. Returns `true` if a row was deleted.
    pub async fn delete(&self, acl_id: Uuid) -> Result<bool> {
        let result = sqlx::query("DELETE FROM drive.acl WHERE id = $1")
            .bind(acl_id)
            .execute(self.pool.inner())
            .await
            .map_err(|e| Error::Database(e.to_string()))?;

        Ok(result.rows_affected() > 0)
    }

    /// List all ACL grants for a specific grantee across all nodes.
    pub async fn list_by_grantee(
        &self,
        grantee_type: &str,
        grantee_id: Option<Uuid>,
    ) -> Result<Vec<DriveAcl>> {
        let rows = sqlx::query_as::<_, DriveAcl>(
            r#"SELECT * FROM drive.acl
               WHERE grantee_type = $1
                 AND ($2::uuid IS NULL OR grantee_id = $2)
                 AND (expires_at IS NULL OR expires_at > NOW())
               ORDER BY created_at ASC"#,
        )
        .bind(grantee_type)
        .bind(grantee_id)
        .fetch_all(self.pool.inner())
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(rows)
    }
}

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
