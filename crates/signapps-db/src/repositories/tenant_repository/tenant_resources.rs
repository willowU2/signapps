//! TenantResourceRepository — tenant resource (rooms, equipment, etc.) operations.

use crate::models::{CreateTenantResource, TenantResource, UpdateTenantResource};
use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

/// Repository for tenant resource operations (rooms, equipment, etc.).
pub struct TenantResourceRepository;

impl TenantResourceRepository {
    /// Find resource by ID.
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Option<TenantResource>> {
        let resource = sqlx::query_as::<_, TenantResource>(
            "SELECT * FROM calendar.tenant_resources WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(resource)
    }

    /// List resources for a tenant.
    pub async fn list_by_tenant(
        pool: &PgPool,
        tenant_id: Uuid,
        resource_type: Option<&str>,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<TenantResource>> {
        let resources = if let Some(rt) = resource_type {
            sqlx::query_as::<_, TenantResource>(
                r#"
                SELECT * FROM calendar.tenant_resources
                WHERE tenant_id = $1 AND resource_type = $2 AND is_available = TRUE
                ORDER BY name LIMIT $3 OFFSET $4
                "#,
            )
            .bind(tenant_id)
            .bind(rt)
            .bind(limit)
            .bind(offset)
            .fetch_all(pool)
            .await
        } else {
            sqlx::query_as::<_, TenantResource>(
                r#"
                SELECT * FROM calendar.tenant_resources
                WHERE tenant_id = $1 AND is_available = TRUE
                ORDER BY name LIMIT $2 OFFSET $3
                "#,
            )
            .bind(tenant_id)
            .bind(limit)
            .bind(offset)
            .fetch_all(pool)
            .await
        }
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(resources)
    }

    /// Create a new resource.
    pub async fn create(
        pool: &PgPool,
        tenant_id: Uuid,
        owner_id: Uuid,
        resource: CreateTenantResource,
    ) -> Result<TenantResource> {
        let created = sqlx::query_as::<_, TenantResource>(
            r#"
            INSERT INTO calendar.tenant_resources (
                tenant_id, resource_type_id, name, resource_type, description,
                capacity, location, floor, building, amenities,
                requires_approval, approver_ids, owner_id
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11, FALSE), $12, $13)
            RETURNING *
            "#,
        )
        .bind(tenant_id)
        .bind(resource.resource_type_id)
        .bind(&resource.name)
        .bind(&resource.resource_type)
        .bind(&resource.description)
        .bind(resource.capacity)
        .bind(&resource.location)
        .bind(&resource.floor)
        .bind(&resource.building)
        .bind(&resource.amenities)
        .bind(resource.requires_approval)
        .bind(&resource.approver_ids)
        .bind(owner_id)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(created)
    }

    /// Update a resource.
    pub async fn update(
        pool: &PgPool,
        id: Uuid,
        update: UpdateTenantResource,
    ) -> Result<TenantResource> {
        let updated = sqlx::query_as::<_, TenantResource>(
            r#"
            UPDATE calendar.tenant_resources
            SET name = COALESCE($2, name),
                description = COALESCE($3, description),
                capacity = COALESCE($4, capacity),
                location = COALESCE($5, location),
                floor = COALESCE($6, floor),
                building = COALESCE($7, building),
                amenities = COALESCE($8, amenities),
                photo_urls = COALESCE($9, photo_urls),
                availability_rules = COALESCE($10, availability_rules),
                booking_rules = COALESCE($11, booking_rules),
                requires_approval = COALESCE($12, requires_approval),
                approver_ids = COALESCE($13, approver_ids),
                is_available = COALESCE($14, is_available),
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(&update.name)
        .bind(&update.description)
        .bind(update.capacity)
        .bind(&update.location)
        .bind(&update.floor)
        .bind(&update.building)
        .bind(&update.amenities)
        .bind(&update.photo_urls)
        .bind(&update.availability_rules)
        .bind(&update.booking_rules)
        .bind(update.requires_approval)
        .bind(&update.approver_ids)
        .bind(update.is_available)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(updated)
    }

    /// Delete a resource.
    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM calendar.tenant_resources WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }
}
