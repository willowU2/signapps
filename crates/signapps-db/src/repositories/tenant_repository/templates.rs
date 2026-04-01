//! TemplateRepository — project/task template operations.

use crate::models::{CreateTemplate, Template, UpdateTemplate};
use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

/// Repository for template operations.
pub struct TemplateRepository;

impl TemplateRepository {
    /// Find template by ID.
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Option<Template>> {
        let template = sqlx::query_as::<_, Template>(
            "SELECT * FROM calendar.templates WHERE id = $1 AND deleted_at IS NULL",
        )
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(template)
    }

    /// List templates for a tenant (including global templates).
    pub async fn list_by_tenant(
        pool: &PgPool,
        tenant_id: Uuid,
        template_type: Option<&str>,
    ) -> Result<Vec<Template>> {
        let templates = if let Some(tt) = template_type {
            sqlx::query_as::<_, Template>(
                r#"
                SELECT * FROM calendar.templates
                WHERE (tenant_id = $1 OR tenant_id IS NULL) AND template_type = $2 AND deleted_at IS NULL
                ORDER BY usage_count DESC, name
                "#,
            )
            .bind(tenant_id)
            .bind(tt)
            .fetch_all(pool)
            .await
        } else {
            sqlx::query_as::<_, Template>(
                r#"
                SELECT * FROM calendar.templates
                WHERE (tenant_id = $1 OR tenant_id IS NULL) AND deleted_at IS NULL
                ORDER BY usage_count DESC, name
                "#,
            )
            .bind(tenant_id)
            .fetch_all(pool)
            .await
        }
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(templates)
    }

    /// Create a new template.
    pub async fn create(
        pool: &PgPool,
        tenant_id: Uuid,
        created_by: Uuid,
        template: CreateTemplate,
    ) -> Result<Template> {
        let created = sqlx::query_as::<_, Template>(
            r#"
            INSERT INTO calendar.templates (
                tenant_id, workspace_id, name, description, template_type,
                content, icon, color, is_public, created_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, FALSE), $10)
            RETURNING *
            "#,
        )
        .bind(tenant_id)
        .bind(template.workspace_id)
        .bind(&template.name)
        .bind(&template.description)
        .bind(&template.template_type)
        .bind(&template.content)
        .bind(&template.icon)
        .bind(&template.color)
        .bind(template.is_public)
        .bind(created_by)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(created)
    }

    /// Update a template.
    pub async fn update(pool: &PgPool, id: Uuid, update: UpdateTemplate) -> Result<Template> {
        let updated = sqlx::query_as::<_, Template>(
            r#"
            UPDATE calendar.templates
            SET name = COALESCE($2, name),
                description = COALESCE($3, description),
                content = COALESCE($4, content),
                icon = COALESCE($5, icon),
                color = COALESCE($6, color),
                is_public = COALESCE($7, is_public),
                updated_at = NOW()
            WHERE id = $1 AND deleted_at IS NULL
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(&update.name)
        .bind(&update.description)
        .bind(&update.content)
        .bind(&update.icon)
        .bind(&update.color)
        .bind(update.is_public)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(updated)
    }

    /// Increment usage count.
    pub async fn increment_usage(pool: &PgPool, id: Uuid) -> Result<()> {
        sqlx::query("UPDATE calendar.templates SET usage_count = usage_count + 1 WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }

    /// Soft delete a template.
    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<()> {
        sqlx::query("UPDATE calendar.templates SET deleted_at = NOW() WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }
}
