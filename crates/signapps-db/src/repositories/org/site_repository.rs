//! CRUD for `org_sites` + `org_site_persons` — SO7.
//!
//! Hiérarchie building > floor > room > desk matérialisée par
//! `parent_id`. On remonte l'arbre via une requête récursive côté SQL
//! (pas de LTREE sur ce modèle : la profondeur est bornée à 4 niveaux,
//! le coût reste négligeable).

use anyhow::Result;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::org::{OrgSite, Person, SiteKind, SitePerson, SitePersonRole};

/// Repository for `org_sites` + `org_site_persons`.
pub struct SiteRepository<'a> {
    pool: &'a PgPool,
}

impl<'a> SiteRepository<'a> {
    /// Construct a new repository bound to the given pool.
    pub fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    /// Insert a new site row.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error (FK violation, unique clash...).
    #[allow(clippy::too_many_arguments)]
    pub async fn create(
        &self,
        tenant_id: Uuid,
        parent_id: Option<Uuid>,
        slug: &str,
        name: &str,
        kind: SiteKind,
        address: Option<&str>,
        gps: Option<serde_json::Value>,
        timezone: Option<&str>,
        capacity: Option<i32>,
        equipment: serde_json::Value,
        bookable: bool,
    ) -> Result<OrgSite> {
        let row = sqlx::query_as::<_, OrgSite>(
            r#"INSERT INTO org_sites
                (tenant_id, parent_id, slug, name, kind, address, gps,
                 timezone, capacity, equipment, bookable)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING *"#,
        )
        .bind(tenant_id)
        .bind(parent_id)
        .bind(slug)
        .bind(name)
        .bind(kind.as_str())
        .bind(address)
        .bind(gps)
        .bind(timezone)
        .bind(capacity)
        .bind(equipment)
        .bind(bookable)
        .fetch_one(self.pool)
        .await?;
        Ok(row)
    }

    /// Fetch one site by id.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn get(&self, id: Uuid) -> Result<Option<OrgSite>> {
        let row = sqlx::query_as::<_, OrgSite>("SELECT * FROM org_sites WHERE id = $1")
            .bind(id)
            .fetch_optional(self.pool)
            .await?;
        Ok(row)
    }

    /// Fetch by slug.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn get_by_slug(&self, tenant_id: Uuid, slug: &str) -> Result<Option<OrgSite>> {
        let row = sqlx::query_as::<_, OrgSite>(
            "SELECT * FROM org_sites WHERE tenant_id = $1 AND slug = $2",
        )
        .bind(tenant_id)
        .bind(slug)
        .fetch_optional(self.pool)
        .await?;
        Ok(row)
    }

    /// List active sites for a tenant, optionally filtered by kind.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn list_by_tenant(
        &self,
        tenant_id: Uuid,
        kind: Option<SiteKind>,
    ) -> Result<Vec<OrgSite>> {
        let rows = if let Some(k) = kind {
            sqlx::query_as::<_, OrgSite>(
                "SELECT * FROM org_sites
                 WHERE tenant_id = $1 AND active AND kind = $2
                 ORDER BY name",
            )
            .bind(tenant_id)
            .bind(k.as_str())
            .fetch_all(self.pool)
            .await?
        } else {
            sqlx::query_as::<_, OrgSite>(
                "SELECT * FROM org_sites
                 WHERE tenant_id = $1 AND active
                 ORDER BY name",
            )
            .bind(tenant_id)
            .fetch_all(self.pool)
            .await?
        };
        Ok(rows)
    }

    /// Return the immediate children of a site.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn list_children(&self, parent_id: Uuid) -> Result<Vec<OrgSite>> {
        let rows = sqlx::query_as::<_, OrgSite>(
            "SELECT * FROM org_sites WHERE parent_id = $1 AND active ORDER BY name",
        )
        .bind(parent_id)
        .fetch_all(self.pool)
        .await?;
        Ok(rows)
    }

    /// Return every active descendant of `root_id` (inclusive).
    ///
    /// Uses a WITH RECURSIVE query — safe thanks to the 4-level bound on
    /// the hierarchy (building > floor > room > desk).
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn subtree(&self, root_id: Uuid) -> Result<Vec<OrgSite>> {
        let rows = sqlx::query_as::<_, OrgSite>(
            r#"WITH RECURSIVE tree AS (
                SELECT * FROM org_sites WHERE id = $1 AND active
                UNION ALL
                SELECT s.* FROM org_sites s
                  JOIN tree t ON s.parent_id = t.id
                 WHERE s.active
              )
              SELECT * FROM tree ORDER BY kind, name"#,
        )
        .bind(root_id)
        .fetch_all(self.pool)
        .await?;
        Ok(rows)
    }

    /// Update mutable fields of a site.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    #[allow(clippy::too_many_arguments)]
    pub async fn update(
        &self,
        id: Uuid,
        name: &str,
        address: Option<&str>,
        gps: Option<serde_json::Value>,
        timezone: Option<&str>,
        capacity: Option<i32>,
        equipment: serde_json::Value,
        bookable: bool,
    ) -> Result<Option<OrgSite>> {
        let row = sqlx::query_as::<_, OrgSite>(
            r#"UPDATE org_sites
                SET name = $2,
                    address = $3,
                    gps = $4,
                    timezone = $5,
                    capacity = $6,
                    equipment = $7,
                    bookable = $8,
                    updated_at = now()
              WHERE id = $1
              RETURNING *"#,
        )
        .bind(id)
        .bind(name)
        .bind(address)
        .bind(gps)
        .bind(timezone)
        .bind(capacity)
        .bind(equipment)
        .bind(bookable)
        .fetch_optional(self.pool)
        .await?;
        Ok(row)
    }

    /// Archive a site (active = false).
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn archive(&self, id: Uuid) -> Result<bool> {
        let res =
            sqlx::query("UPDATE org_sites SET active = false, updated_at = now() WHERE id = $1")
                .bind(id)
                .execute(self.pool)
                .await?;
        Ok(res.rows_affected() > 0)
    }

    // ─── Site persons ─────────────────────────────────────────────────

    /// Upsert a site-person link (primary OR secondary).
    ///
    /// Because `idx_site_persons_primary` is unique over `person_id`
    /// when `role = 'primary'`, we delete any existing primary rows for
    /// the person before inserting a new primary assignment.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn attach_person(
        &self,
        person_id: Uuid,
        site_id: Uuid,
        role: SitePersonRole,
        desk_id: Option<Uuid>,
    ) -> Result<SitePerson> {
        if matches!(role, SitePersonRole::Primary) {
            sqlx::query(
                "DELETE FROM org_site_persons WHERE person_id = $1 AND role = 'primary'",
            )
            .bind(person_id)
            .execute(self.pool)
            .await?;
        }
        let role_s = match role {
            SitePersonRole::Primary => "primary",
            SitePersonRole::Secondary => "secondary",
        };
        let row = sqlx::query_as::<_, SitePerson>(
            r#"INSERT INTO org_site_persons
                (person_id, site_id, role, desk_id)
             VALUES ($1, $2, $3, $4)
             RETURNING *"#,
        )
        .bind(person_id)
        .bind(site_id)
        .bind(role_s)
        .bind(desk_id)
        .fetch_one(self.pool)
        .await?;
        Ok(row)
    }

    /// List site-person links for a site.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn list_persons(&self, site_id: Uuid) -> Result<Vec<SitePerson>> {
        let rows = sqlx::query_as::<_, SitePerson>(
            "SELECT * FROM org_site_persons WHERE site_id = $1",
        )
        .bind(site_id)
        .fetch_all(self.pool)
        .await?;
        Ok(rows)
    }

    /// List site-person links for a person.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn list_sites_for_person(&self, person_id: Uuid) -> Result<Vec<SitePerson>> {
        let rows = sqlx::query_as::<_, SitePerson>(
            "SELECT * FROM org_site_persons WHERE person_id = $1 ORDER BY role, created_at",
        )
        .bind(person_id)
        .fetch_all(self.pool)
        .await?;
        Ok(rows)
    }

    /// Aggregate persons under a site subtree (building + children).
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn subtree_persons(&self, root_id: Uuid) -> Result<Vec<Person>> {
        let rows = sqlx::query_as::<_, Person>(
            r#"WITH RECURSIVE tree AS (
                SELECT id FROM org_sites WHERE id = $1 AND active
                UNION ALL
                SELECT s.id FROM org_sites s
                  JOIN tree t ON s.parent_id = t.id
                 WHERE s.active
              )
              SELECT DISTINCT p.*
                FROM org_persons p
                JOIN org_site_persons sp ON sp.person_id = p.id
                JOIN tree t ON t.id = sp.site_id
               WHERE p.active
               ORDER BY p.first_name NULLS LAST, p.last_name NULLS LAST"#,
        )
        .bind(root_id)
        .fetch_all(self.pool)
        .await?;
        Ok(rows)
    }

    /// Remove a site-person link by id.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn detach_person(&self, id: Uuid) -> Result<bool> {
        let res = sqlx::query("DELETE FROM org_site_persons WHERE id = $1")
            .bind(id)
            .execute(self.pool)
            .await?;
        Ok(res.rows_affected() > 0)
    }
}
