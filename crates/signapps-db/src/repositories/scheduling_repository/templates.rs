//! SchedulingTemplateRepository — scheduling template CRUD operations.

use crate::models::{CreateSchedulingTemplate, SchedulingTemplate};
use crate::DatabasePool;
use signapps_common::Result;
use uuid::Uuid;

/// Repository for scheduling template CRUD operations.
pub struct SchedulingTemplateRepository<'a> {
    pool: &'a DatabasePool,
}

impl<'a> SchedulingTemplateRepository<'a> {
    pub fn new(pool: &'a DatabasePool) -> Self {
        Self { pool }
    }

    /// Find template by ID.
    pub async fn find_by_id(&self, id: Uuid) -> Result<Option<SchedulingTemplate>> {
        let template = sqlx::query_as::<_, SchedulingTemplate>(
            "SELECT * FROM scheduling.templates WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(self.pool.inner())
        .await?;

        Ok(template)
    }

    /// List templates for a tenant.
    pub async fn list(&self, tenant_id: Uuid) -> Result<Vec<SchedulingTemplate>> {
        let templates = sqlx::query_as::<_, SchedulingTemplate>(
            "SELECT * FROM scheduling.templates WHERE tenant_id = $1 OR is_public = true ORDER BY name",
        )
        .bind(tenant_id)
        .fetch_all(self.pool.inner())
        .await?;

        Ok(templates)
    }

    /// List templates by category.
    pub async fn list_by_category(
        &self,
        tenant_id: Uuid,
        category: &str,
    ) -> Result<Vec<SchedulingTemplate>> {
        let templates = sqlx::query_as::<_, SchedulingTemplate>(
            "SELECT * FROM scheduling.templates WHERE (tenant_id = $1 OR is_public = true) AND category = $2 ORDER BY name",
        )
        .bind(tenant_id)
        .bind(category)
        .fetch_all(self.pool.inner())
        .await?;

        Ok(templates)
    }

    /// Create a template.
    pub async fn create(
        &self,
        tenant_id: Uuid,
        created_by: Uuid,
        template: CreateSchedulingTemplate,
    ) -> Result<SchedulingTemplate> {
        let items_json = serde_json::to_value(&template.items)
            .unwrap_or_else(|_| serde_json::Value::Array(vec![]));

        let created = sqlx::query_as::<_, SchedulingTemplate>(
            r#"
            INSERT INTO scheduling.templates (tenant_id, name, description, category, items, created_by)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
            "#,
        )
        .bind(tenant_id)
        .bind(&template.name)
        .bind(&template.description)
        .bind(&template.category)
        .bind(&items_json)
        .bind(created_by)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(created)
    }

    /// Delete a template.
    pub async fn delete(&self, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM scheduling.templates WHERE id = $1")
            .bind(id)
            .execute(self.pool.inner())
            .await?;

        Ok(())
    }
}
