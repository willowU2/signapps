use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

/// Trait for entities that can be linked cross-service and tracked in activity/audit.
pub trait Linkable {
    /// Returns the entity type label used in audit and activity records (e.g. `"document"`, `"user"`).
    fn entity_type(&self) -> &'static str;
    /// Returns the unique identifier of this entity.
    fn entity_id(&self) -> Uuid;
    /// Returns a human-readable title for display in activity feeds and audit logs.
    fn entity_title(&self) -> String;
}

/// Log an activity entry to the platform.activities table.
pub async fn log_activity(
    pool: &PgPool,
    actor_id: Uuid,
    action: &str,
    entity: &dyn Linkable,
    workspace_id: Option<Uuid>,
    metadata: Value,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"INSERT INTO platform.activities (id, actor_id, action, entity_type, entity_id, entity_title, metadata, workspace_id)
           VALUES (gen_uuid_v7(), $1, $2, $3, $4, $5, $6, $7)"#,
    )
    .bind(actor_id)
    .bind(action)
    .bind(entity.entity_type())
    .bind(entity.entity_id())
    .bind(entity.entity_title())
    .bind(&metadata)
    .bind(workspace_id)
    .execute(pool)
    .await?;
    Ok(())
}

/// Append an immutable audit log entry to platform.audit_log.
pub async fn audit(
    pool: &PgPool,
    actor_id: Option<Uuid>,
    actor_ip: Option<&str>,
    action: &str,
    entity: &dyn Linkable,
    old_data: Option<Value>,
    new_data: Option<Value>,
    workspace_id: Option<Uuid>,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"INSERT INTO platform.audit_log (id, actor_id, actor_ip, action, entity_type, entity_id, old_data, new_data, workspace_id)
           VALUES (gen_uuid_v7(), $1, $2, $3, $4, $5, $6, $7, $8)"#,
    )
    .bind(actor_id)
    .bind(actor_ip)
    .bind(action)
    .bind(entity.entity_type())
    .bind(entity.entity_id())
    .bind(&old_data)
    .bind(&new_data)
    .bind(workspace_id)
    .execute(pool)
    .await?;
    Ok(())
}
