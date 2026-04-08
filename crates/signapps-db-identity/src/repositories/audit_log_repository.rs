use crate::models::audit_log::AuditLogEntry;
use sqlx::PgPool;
use uuid::Uuid;

/// Repository for persisting and querying immutable audit log entries.
pub struct AuditLogRepository {
    pool: PgPool,
}

impl AuditLogRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn append(
        &self,
        actor_id: Option<Uuid>,
        actor_ip: Option<&str>,
        action: &str,
        entity_type: &str,
        entity_id: Uuid,
        old_data: Option<serde_json::Value>,
        new_data: Option<serde_json::Value>,
        workspace_id: Option<Uuid>,
    ) -> Result<AuditLogEntry, sqlx::Error> {
        sqlx::query_as::<_, AuditLogEntry>(
            r#"INSERT INTO platform.audit_log (id, actor_id, actor_ip, action, entity_type, entity_id, old_data, new_data, workspace_id)
               VALUES (gen_uuid_v7(), $1, $2, $3, $4, $5, $6, $7, $8)
               RETURNING *"#,
        )
        .bind(actor_id)
        .bind(actor_ip)
        .bind(action)
        .bind(entity_type)
        .bind(entity_id)
        .bind(&old_data)
        .bind(&new_data)
        .bind(workspace_id)
        .fetch_one(&self.pool)
        .await
    }

    pub async fn query_by_entity(
        &self,
        entity_type: &str,
        entity_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<AuditLogEntry>, sqlx::Error> {
        sqlx::query_as::<_, AuditLogEntry>(
            r#"SELECT * FROM platform.audit_log WHERE entity_type = $1 AND entity_id = $2
               ORDER BY created_at DESC LIMIT $3 OFFSET $4"#,
        )
        .bind(entity_type)
        .bind(entity_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await
    }

    pub async fn query_by_actor(
        &self,
        actor_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<AuditLogEntry>, sqlx::Error> {
        sqlx::query_as::<_, AuditLogEntry>(
            r#"SELECT * FROM platform.audit_log WHERE actor_id = $1
               ORDER BY created_at DESC LIMIT $2 OFFSET $3"#,
        )
        .bind(actor_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await
    }
}
