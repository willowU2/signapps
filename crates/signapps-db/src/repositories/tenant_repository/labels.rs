//! LabelRepository — label and entity-label operations.

use crate::models::{CreateLabel, EntityLabel, Label};
use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

/// Repository for label operations.
pub struct LabelRepository;

impl LabelRepository {
    /// List labels for a tenant.
    pub async fn list_by_tenant(
        pool: &PgPool,
        tenant_id: Uuid,
        workspace_id: Option<Uuid>,
    ) -> Result<Vec<Label>> {
        let labels = if let Some(ws_id) = workspace_id {
            sqlx::query_as::<_, Label>(
                "SELECT * FROM calendar.labels WHERE tenant_id = $1 AND (workspace_id = $2 OR workspace_id IS NULL) ORDER BY name",
            )
            .bind(tenant_id)
            .bind(ws_id)
            .fetch_all(pool)
            .await
        } else {
            sqlx::query_as::<_, Label>(
                "SELECT * FROM calendar.labels WHERE tenant_id = $1 ORDER BY name",
            )
            .bind(tenant_id)
            .fetch_all(pool)
            .await
        }
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(labels)
    }

    /// Create a new label.
    pub async fn create(pool: &PgPool, tenant_id: Uuid, label: CreateLabel) -> Result<Label> {
        let created = sqlx::query_as::<_, Label>(
            r#"
            INSERT INTO calendar.labels (tenant_id, workspace_id, name, color)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            "#,
        )
        .bind(tenant_id)
        .bind(label.workspace_id)
        .bind(&label.name)
        .bind(&label.color)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(created)
    }

    /// Delete a label.
    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM calendar.labels WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }

    /// Add label to entity.
    pub async fn add_to_entity(
        pool: &PgPool,
        label_id: Uuid,
        entity_type: &str,
        entity_id: Uuid,
    ) -> Result<EntityLabel> {
        let created = sqlx::query_as::<_, EntityLabel>(
            r#"
            INSERT INTO calendar.entity_labels (label_id, entity_type, entity_id)
            VALUES ($1, $2, $3)
            ON CONFLICT (label_id, entity_type, entity_id) DO NOTHING
            RETURNING *
            "#,
        )
        .bind(label_id)
        .bind(entity_type)
        .bind(entity_id)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(created)
    }

    /// Remove label from entity.
    pub async fn remove_from_entity(
        pool: &PgPool,
        label_id: Uuid,
        entity_type: &str,
        entity_id: Uuid,
    ) -> Result<()> {
        sqlx::query(
            "DELETE FROM calendar.entity_labels WHERE label_id = $1 AND entity_type = $2 AND entity_id = $3",
        )
        .bind(label_id)
        .bind(entity_type)
        .bind(entity_id)
        .execute(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }

    /// Get labels for entity.
    pub async fn get_for_entity(
        pool: &PgPool,
        entity_type: &str,
        entity_id: Uuid,
    ) -> Result<Vec<Label>> {
        let labels = sqlx::query_as::<_, Label>(
            r#"
            SELECT l.* FROM calendar.labels l
            INNER JOIN calendar.entity_labels el ON l.id = el.label_id
            WHERE el.entity_type = $1 AND el.entity_id = $2
            ORDER BY l.name
            "#,
        )
        .bind(entity_type)
        .bind(entity_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(labels)
    }
}
