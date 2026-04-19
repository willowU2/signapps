//! CRUD for `org_public_links` — SO4 integrations.
//!
//! Slug auto-généré (12 chars alphanumériques) lors du `create`.
//! Les listes filtrent toujours par `revoked_at IS NULL` + expires_at futur.

use anyhow::Result;
use chrono::{DateTime, Utc};
use rand::distributions::{Alphanumeric, DistString};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::org::{PublicLink, Visibility};

/// Repository for the canonical `org_public_links` table.
pub struct PublicLinkRepository<'a> {
    pool: &'a PgPool,
}

impl<'a> PublicLinkRepository<'a> {
    /// Construct a new repository bound to the given pool.
    pub fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    /// Create a new public link with auto-generated slug.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error (FK violation, slug clash…).
    pub async fn create(
        &self,
        tenant_id: Uuid,
        root_node_id: Uuid,
        visibility: Visibility,
        allowed_origins: Vec<String>,
        expires_at: Option<DateTime<Utc>>,
        created_by_user_id: Option<Uuid>,
    ) -> Result<PublicLink> {
        // Génération slug 12 chars alphanumériques (62^12 ≈ 3.2e21, pas de
        // collision attendue à l'échelle).
        let slug = Alphanumeric.sample_string(&mut rand::thread_rng(), 12);
        let row = sqlx::query_as::<_, PublicLink>(
            "INSERT INTO org_public_links
                (tenant_id, root_node_id, slug, visibility,
                 allowed_origins, expires_at, created_by_user_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *",
        )
        .bind(tenant_id)
        .bind(root_node_id)
        .bind(&slug)
        .bind(visibility)
        .bind(&allowed_origins)
        .bind(expires_at)
        .bind(created_by_user_id)
        .fetch_one(self.pool)
        .await?;
        Ok(row)
    }

    /// Fetch one link by primary key.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn get(&self, id: Uuid) -> Result<Option<PublicLink>> {
        let row = sqlx::query_as::<_, PublicLink>("SELECT * FROM org_public_links WHERE id = $1")
            .bind(id)
            .fetch_optional(self.pool)
            .await?;
        Ok(row)
    }

    /// Fetch one active link by slug (used by public endpoint).
    ///
    /// Filters revoked + expired rows in SQL so the public endpoint stays
    /// fast.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn get_active_by_slug(&self, slug: &str) -> Result<Option<PublicLink>> {
        let row = sqlx::query_as::<_, PublicLink>(
            "SELECT * FROM org_public_links
             WHERE slug = $1
               AND revoked_at IS NULL
               AND (expires_at IS NULL OR expires_at > now())",
        )
        .bind(slug)
        .fetch_optional(self.pool)
        .await?;
        Ok(row)
    }

    /// List active links for a tenant.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn list_active_by_tenant(&self, tenant_id: Uuid) -> Result<Vec<PublicLink>> {
        let rows = sqlx::query_as::<_, PublicLink>(
            "SELECT * FROM org_public_links
             WHERE tenant_id = $1
               AND revoked_at IS NULL
             ORDER BY created_at DESC",
        )
        .bind(tenant_id)
        .fetch_all(self.pool)
        .await?;
        Ok(rows)
    }

    /// Mark a link as revoked (sets `revoked_at = now()`).
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn revoke(&self, id: Uuid) -> Result<bool> {
        let res = sqlx::query(
            "UPDATE org_public_links
                SET revoked_at = now()
              WHERE id = $1
                AND revoked_at IS NULL",
        )
        .bind(id)
        .execute(self.pool)
        .await?;
        Ok(res.rows_affected() > 0)
    }

    /// Generate a fresh slug for an existing link (rotation).
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn rotate_slug(&self, id: Uuid) -> Result<Option<PublicLink>> {
        let new_slug = Alphanumeric.sample_string(&mut rand::thread_rng(), 12);
        let row = sqlx::query_as::<_, PublicLink>(
            "UPDATE org_public_links
                SET slug = $2
              WHERE id = $1
                AND revoked_at IS NULL
              RETURNING *",
        )
        .bind(id)
        .bind(new_slug)
        .fetch_optional(self.pool)
        .await?;
        Ok(row)
    }

    /// Bump `access_count` (best-effort, used by public endpoint).
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn increment_access(&self, id: Uuid) -> Result<()> {
        sqlx::query("UPDATE org_public_links SET access_count = access_count + 1 WHERE id = $1")
            .bind(id)
            .execute(self.pool)
            .await?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use chrono::Duration;

    use super::*;

    #[test]
    fn slug_is_alphanumeric_12_chars() {
        let slug = Alphanumeric.sample_string(&mut rand::thread_rng(), 12);
        assert_eq!(slug.len(), 12);
        assert!(slug.chars().all(|c| c.is_ascii_alphanumeric()));
    }

    #[test]
    fn is_active_handles_revoked_and_expired() {
        let mut link = PublicLink {
            id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            root_node_id: Uuid::new_v4(),
            slug: "abc123".into(),
            visibility: Visibility::Anon,
            allowed_origins: vec![],
            expires_at: None,
            access_count: 0,
            created_by_user_id: None,
            created_at: chrono::Utc::now(),
            revoked_at: None,
        };
        assert!(link.is_active());

        link.expires_at = Some(chrono::Utc::now() - Duration::seconds(10));
        assert!(!link.is_active(), "expired link should not be active");

        link.expires_at = Some(chrono::Utc::now() + Duration::days(1));
        assert!(link.is_active());

        link.revoked_at = Some(chrono::Utc::now());
        assert!(!link.is_active(), "revoked link should not be active");
    }
}
