//! ResourceTypeRepository — tenant resource type operations.

use crate::models::{CreateResourceType, ResourceType};
use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

/// Repository for resource type operations.
pub struct ResourceTypeRepository;

impl ResourceTypeRepository {
    /// List resource types for a tenant.
    pub async fn list_by_tenant(pool: &PgPool, tenant_id: Uuid) -> Result<Vec<ResourceType>> {
        let types = sqlx::query_as::<_, ResourceType>(
            "SELECT * FROM calendar.resource_types WHERE tenant_id = $1 ORDER BY name",
        )
        .bind(tenant_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(types)
    }

    /// Create a new resource type.
    pub async fn create(
        pool: &PgPool,
        tenant_id: Uuid,
        resource_type: CreateResourceType,
    ) -> Result<ResourceType> {
        let created = sqlx::query_as::<_, ResourceType>(
            r#"
            INSERT INTO calendar.resource_types (tenant_id, name, icon, color, requires_approval)
            VALUES ($1, $2, $3, $4, COALESCE($5, FALSE))
            RETURNING *
            "#,
        )
        .bind(tenant_id)
        .bind(&resource_type.name)
        .bind(&resource_type.icon)
        .bind(&resource_type.color)
        .bind(resource_type.requires_approval)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(created)
    }

    /// Delete a resource type.
    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM calendar.resource_types WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }
}
