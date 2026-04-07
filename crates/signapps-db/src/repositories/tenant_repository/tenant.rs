//! TenantRepository — core tenant CRUD operations.

use crate::models::{CreateTenant, Tenant, UpdateTenant};
use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

/// Repository for tenant operations.
pub struct TenantRepository;

impl TenantRepository {
    /// Set the current tenant context for RLS.
    pub async fn set_tenant_context(pool: &PgPool, tenant_id: Uuid) -> Result<()> {
        // Use set_config() with a bound parameter instead of string interpolation
        // to eliminate the SQL injection vector in the previous format!() approach.
        sqlx::query("SELECT set_config('app.current_tenant_id', $1::text, true)")
            .bind(tenant_id.to_string())
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }

    /// Find tenant by ID.
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Option<Tenant>> {
        let tenant = sqlx::query_as::<_, Tenant>("SELECT * FROM identity.tenants WHERE id = $1")
            .bind(id)
            .fetch_optional(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(tenant)
    }

    /// Find tenant by slug.
    pub async fn find_by_slug(pool: &PgPool, slug: &str) -> Result<Option<Tenant>> {
        let tenant = sqlx::query_as::<_, Tenant>("SELECT * FROM identity.tenants WHERE slug = $1")
            .bind(slug)
            .fetch_optional(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(tenant)
    }

    /// Find tenant by domain.
    pub async fn find_by_domain(pool: &PgPool, domain: &str) -> Result<Option<Tenant>> {
        let tenant =
            sqlx::query_as::<_, Tenant>("SELECT * FROM identity.tenants WHERE domain = $1")
                .bind(domain)
                .fetch_optional(pool)
                .await
                .map_err(|e| Error::Database(e.to_string()))?;
        Ok(tenant)
    }

    /// List all tenants with pagination.
    pub async fn list(pool: &PgPool, limit: i64, offset: i64) -> Result<Vec<Tenant>> {
        let tenants = sqlx::query_as::<_, Tenant>(
            "SELECT * FROM identity.tenants WHERE is_active = TRUE ORDER BY name LIMIT $1 OFFSET $2",
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(tenants)
    }

    /// Create a new tenant.
    pub async fn create(pool: &PgPool, tenant: CreateTenant) -> Result<Tenant> {
        let created = sqlx::query_as::<_, Tenant>(
            r#"
            INSERT INTO identity.tenants (name, slug, domain, logo_url, plan)
            VALUES ($1, $2, $3, $4, COALESCE($5, 'free'))
            RETURNING *
            "#,
        )
        .bind(&tenant.name)
        .bind(&tenant.slug)
        .bind(&tenant.domain)
        .bind(&tenant.logo_url)
        .bind(&tenant.plan)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(created)
    }

    /// Update a tenant.
    pub async fn update(pool: &PgPool, id: Uuid, update: UpdateTenant) -> Result<Tenant> {
        let updated = sqlx::query_as::<_, Tenant>(
            r#"
            UPDATE identity.tenants
            SET name = COALESCE($2, name),
                domain = COALESCE($3, domain),
                logo_url = COALESCE($4, logo_url),
                settings = COALESCE($5, settings),
                plan = COALESCE($6, plan),
                max_users = COALESCE($7, max_users),
                max_resources = COALESCE($8, max_resources),
                max_workspaces = COALESCE($9, max_workspaces),
                is_active = COALESCE($10, is_active),
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(&update.name)
        .bind(&update.domain)
        .bind(&update.logo_url)
        .bind(&update.settings)
        .bind(&update.plan)
        .bind(update.max_users)
        .bind(update.max_resources)
        .bind(update.max_workspaces)
        .bind(update.is_active)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(updated)
    }

    /// Delete a tenant (soft delete by setting is_active to false).
    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<()> {
        sqlx::query(
            "UPDATE identity.tenants SET is_active = FALSE, updated_at = NOW() WHERE id = $1",
        )
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }

    /// Count users in a tenant.
    pub async fn count_users(pool: &PgPool, tenant_id: Uuid) -> Result<i64> {
        let count: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM identity.users WHERE tenant_id = $1")
                .bind(tenant_id)
                .fetch_one(pool)
                .await
                .map_err(|e| Error::Database(e.to_string()))?;
        Ok(count.0)
    }
}
