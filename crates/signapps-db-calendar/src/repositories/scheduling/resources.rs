//! SchedulingResourceRepository — scheduling resource CRUD operations.

use crate::models::{CreateSchedulingResource, SchedulingResource};
use signapps_db_shared::DatabasePool;
use signapps_common::Result;
use uuid::Uuid;

/// Repository for scheduling resource CRUD operations.
pub struct SchedulingResourceRepository<'a> {
    pool: &'a DatabasePool,
}

impl<'a> SchedulingResourceRepository<'a> {
    pub fn new(pool: &'a DatabasePool) -> Self {
        Self { pool }
    }

    /// Find resource by ID.
    pub async fn find_by_id(&self, id: Uuid) -> Result<Option<SchedulingResource>> {
        let resource = sqlx::query_as::<_, SchedulingResource>(
            "SELECT * FROM scheduling.resources WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(self.pool.inner())
        .await?;

        Ok(resource)
    }

    /// List all resources for a tenant.
    pub async fn list(&self, tenant_id: Uuid) -> Result<Vec<SchedulingResource>> {
        let resources = sqlx::query_as::<_, SchedulingResource>(
            "SELECT * FROM scheduling.resources WHERE tenant_id = $1 AND is_active = true ORDER BY name",
        )
        .bind(tenant_id)
        .fetch_all(self.pool.inner())
        .await?;

        Ok(resources)
    }

    /// List resources by type.
    pub async fn list_by_type(
        &self,
        tenant_id: Uuid,
        resource_type: &str,
    ) -> Result<Vec<SchedulingResource>> {
        let resources = sqlx::query_as::<_, SchedulingResource>(
            "SELECT * FROM scheduling.resources WHERE tenant_id = $1 AND resource_type = $2 AND is_active = true ORDER BY name",
        )
        .bind(tenant_id)
        .bind(resource_type)
        .fetch_all(self.pool.inner())
        .await?;

        Ok(resources)
    }

    /// Create a resource.
    pub async fn create(
        &self,
        tenant_id: Uuid,
        resource: CreateSchedulingResource,
    ) -> Result<SchedulingResource> {
        let created = sqlx::query_as::<_, SchedulingResource>(
            r#"
            INSERT INTO scheduling.resources (tenant_id, name, resource_type, description, capacity, location, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, '{}'))
            RETURNING *
            "#,
        )
        .bind(tenant_id)
        .bind(&resource.name)
        .bind(&resource.resource_type)
        .bind(&resource.description)
        .bind(resource.capacity)
        .bind(&resource.location)
        .bind(&resource.metadata)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(created)
    }

    /// Deactivate a resource.
    pub async fn deactivate(&self, id: Uuid) -> Result<()> {
        sqlx::query(
            "UPDATE scheduling.resources SET is_active = false, updated_at = NOW() WHERE id = $1",
        )
        .bind(id)
        .execute(self.pool.inner())
        .await?;

        Ok(())
    }

    /// Delete a resource.
    pub async fn delete(&self, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM scheduling.resources WHERE id = $1")
            .bind(id)
            .execute(self.pool.inner())
            .await?;

        Ok(())
    }
}
