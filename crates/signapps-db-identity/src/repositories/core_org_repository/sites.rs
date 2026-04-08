//! SiteRepository — geographic site operations and person/node attachments.

use crate::models::core_org::{CreateSite, NodeSite, Person, PersonSite, Site, UpdateSite};
use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

/// Repository for geographic site operations and person/node attachments.
pub struct SiteRepository;

impl SiteRepository {
    /// List all active sites for a tenant.
    pub async fn list(pool: &PgPool, tenant_id: Uuid) -> Result<Vec<Site>> {
        let sites = sqlx::query_as::<_, Site>(
            "SELECT * FROM core.sites WHERE tenant_id = $1 AND is_active = TRUE ORDER BY name",
        )
        .bind(tenant_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(sites)
    }

    /// Create a new site.
    pub async fn create(pool: &PgPool, input: CreateSite) -> Result<Site> {
        let site = sqlx::query_as::<_, Site>(
            r#"
            INSERT INTO core.sites
                (tenant_id, parent_id, site_type, name, address, city, country,
                 geo_lat, geo_lng, timezone, capacity)
            VALUES ($1, $2, $3::core.site_type, $4, $5, $6, $7, $8, $9,
                    COALESCE($10, 'Europe/Paris'), $11)
            RETURNING *
            "#,
        )
        .bind(input.tenant_id)
        .bind(input.parent_id)
        .bind(&input.site_type)
        .bind(&input.name)
        .bind(&input.address)
        .bind(&input.city)
        .bind(&input.country)
        .bind(input.geo_lat)
        .bind(input.geo_lng)
        .bind(&input.timezone)
        .bind(input.capacity)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(site)
    }

    /// Update an existing site.
    pub async fn update(pool: &PgPool, id: Uuid, input: UpdateSite) -> Result<Site> {
        let site = sqlx::query_as::<_, Site>(
            r#"
            UPDATE core.sites SET
                name      = COALESCE($2, name),
                address   = COALESCE($3, address),
                city      = COALESCE($4, city),
                country   = COALESCE($5, country),
                geo_lat   = COALESCE($6, geo_lat),
                geo_lng   = COALESCE($7, geo_lng),
                timezone  = COALESCE($8, timezone),
                capacity  = COALESCE($9, capacity),
                is_active = COALESCE($10, is_active),
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(&input.name)
        .bind(&input.address)
        .bind(&input.city)
        .bind(&input.country)
        .bind(input.geo_lat)
        .bind(input.geo_lng)
        .bind(&input.timezone)
        .bind(input.capacity)
        .bind(input.is_active)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(site)
    }

    /// Find a site by primary key.
    pub async fn find(pool: &PgPool, id: Uuid) -> Result<Option<Site>> {
        let site = sqlx::query_as::<_, Site>("SELECT * FROM core.sites WHERE id = $1")
            .bind(id)
            .fetch_optional(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(site)
    }

    /// Attach an org node to a site.
    pub async fn attach_node(
        pool: &PgPool,
        node_id: Uuid,
        site_id: Uuid,
        is_primary: bool,
    ) -> Result<NodeSite> {
        let ns = sqlx::query_as::<_, NodeSite>(
            r#"
            INSERT INTO core.node_sites (node_id, site_id, is_primary)
            VALUES ($1, $2, $3)
            ON CONFLICT (node_id, site_id) DO UPDATE SET is_primary = EXCLUDED.is_primary
            RETURNING *
            "#,
        )
        .bind(node_id)
        .bind(site_id)
        .bind(is_primary)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(ns)
    }

    /// Detach an org node from a site.
    pub async fn detach_node(pool: &PgPool, node_id: Uuid, site_id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM core.node_sites WHERE node_id = $1 AND site_id = $2")
            .bind(node_id)
            .bind(site_id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }

    /// Attach a person to a site for a given period.
    pub async fn attach_person(
        pool: &PgPool,
        person_id: Uuid,
        site_id: Uuid,
        is_primary: bool,
    ) -> Result<PersonSite> {
        let ps = sqlx::query_as::<_, PersonSite>(
            r#"
            INSERT INTO core.person_sites (person_id, site_id, is_primary)
            VALUES ($1, $2, $3)
            RETURNING *
            "#,
        )
        .bind(person_id)
        .bind(site_id)
        .bind(is_primary)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(ps)
    }

    /// End a person's site attachment (sets end_date to today).
    pub async fn detach_person(pool: &PgPool, person_site_id: Uuid) -> Result<()> {
        sqlx::query("UPDATE core.person_sites SET end_date = CURRENT_DATE WHERE id = $1")
            .bind(person_site_id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }

    /// List all persons currently assigned to a site (active attachments only).
    pub async fn list_persons(pool: &PgPool, site_id: Uuid) -> Result<Vec<Person>> {
        let persons = sqlx::query_as::<_, Person>(
            r#"
            SELECT p.* FROM core.persons p
            JOIN core.person_sites ps ON ps.person_id = p.id
            WHERE ps.site_id = $1
              AND (ps.end_date IS NULL OR ps.end_date >= CURRENT_DATE)
              AND p.is_active = TRUE
            ORDER BY p.last_name, p.first_name
            "#,
        )
        .bind(site_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(persons)
    }

    /// List sites attached to a given org node.
    pub async fn list_by_node(pool: &PgPool, node_id: Uuid) -> Result<Vec<Site>> {
        let sites = sqlx::query_as::<_, Site>(
            r#"
            SELECT s.* FROM core.sites s
            JOIN core.node_sites ns ON ns.site_id = s.id
            WHERE ns.node_id = $1 AND s.is_active = TRUE
            ORDER BY ns.is_primary DESC, s.name
            "#,
        )
        .bind(node_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(sites)
    }
}
