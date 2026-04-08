//! AuditRepository — org structure audit log insert and query operations.

use crate::models::org_audit::{AuditQuery, CreateAuditEntry, OrgAuditEntry};
use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

/// Repository for the org structure audit log.
pub struct AuditRepository;

impl AuditRepository {
    /// Append an audit entry to the partitioned log.
    pub async fn log_audit(pool: &PgPool, entry: CreateAuditEntry) -> Result<()> {
        sqlx::query(
            r#"
            INSERT INTO workforce_org_audit_log
                (tenant_id, actor_id, actor_type, action, entity_type, entity_id,
                 changes, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, '{}'))
            "#,
        )
        .bind(entry.tenant_id)
        .bind(entry.actor_id)
        .bind(&entry.actor_type)
        .bind(&entry.action)
        .bind(&entry.entity_type)
        .bind(entry.entity_id)
        .bind(&entry.changes)
        .bind(&entry.metadata)
        .execute(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }

    /// Query the audit log with flexible filters.
    ///
    /// All filter parameters in `AuditQuery` are optional except `tenant_id`.
    /// Builds a dynamic WHERE clause using parameterized conditions.
    pub async fn query_audit(pool: &PgPool, query: AuditQuery) -> Result<Vec<OrgAuditEntry>> {
        // Build the query dynamically with optional filters.
        // We use a base query and conditionally narrow using AND clauses
        // that are always-true when the parameter is NULL.
        let entries = sqlx::query_as::<_, OrgAuditEntry>(
            r#"
            SELECT * FROM workforce_org_audit_log
            WHERE tenant_id = $1
              AND ($2::text   IS NULL OR entity_type = $2)
              AND ($3::uuid   IS NULL OR entity_id   = $3)
              AND ($4::uuid   IS NULL OR actor_id    = $4)
              AND ($5::text   IS NULL OR action      = $5)
              AND ($6::timestamptz IS NULL OR created_at >= $6)
              AND ($7::timestamptz IS NULL OR created_at <= $7)
            ORDER BY created_at DESC
            LIMIT COALESCE($8, 50)
            OFFSET COALESCE($9, 0)
            "#,
        )
        .bind(query.tenant_id)
        .bind(&query.entity_type)
        .bind(query.entity_id)
        .bind(query.actor_id)
        .bind(&query.action)
        .bind(query.from_date)
        .bind(query.to_date)
        .bind(query.limit)
        .bind(query.offset)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(entries)
    }

    /// Get the full change history for a specific entity, newest first.
    pub async fn get_entity_history(
        pool: &PgPool,
        tenant_id: Uuid,
        entity_type: &str,
        entity_id: Uuid,
    ) -> Result<Vec<OrgAuditEntry>> {
        let entries = sqlx::query_as::<_, OrgAuditEntry>(
            r#"
            SELECT * FROM workforce_org_audit_log
            WHERE tenant_id = $1
              AND entity_type = $2
              AND entity_id = $3
            ORDER BY created_at DESC
            "#,
        )
        .bind(tenant_id)
        .bind(entity_type)
        .bind(entity_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(entries)
    }
}
