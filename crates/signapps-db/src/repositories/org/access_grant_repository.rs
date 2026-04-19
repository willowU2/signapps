//! CRUD for `org_access_grants`.

use anyhow::Result;
use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::org::AccessGrant;

/// Repository for the canonical `org_access_grants` table.
pub struct AccessGrantRepository<'a> {
    pool: &'a PgPool,
}

impl<'a> AccessGrantRepository<'a> {
    /// Construct a new repository bound to the given pool.
    pub fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    /// Insert a new grant. The caller passes the SHA-256 hash of the
    /// HMAC-signed token; the live token is never persisted.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error if the insert fails (UNIQUE
    /// violation on `token_hash`, FK violation, ...).
    #[allow(clippy::too_many_arguments)]
    pub async fn create(
        &self,
        tenant_id: Uuid,
        granted_by: Uuid,
        granted_to: Option<Uuid>,
        resource_type: &str,
        resource_id: Uuid,
        permissions: serde_json::Value,
        token_hash: &str,
        expires_at: Option<DateTime<Utc>>,
    ) -> Result<AccessGrant> {
        let row = sqlx::query_as::<_, AccessGrant>(
            "INSERT INTO org_access_grants
                (tenant_id, granted_by, granted_to, resource_type, resource_id,
                 permissions, token_hash, expires_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *",
        )
        .bind(tenant_id)
        .bind(granted_by)
        .bind(granted_to)
        .bind(resource_type)
        .bind(resource_id)
        .bind(permissions)
        .bind(token_hash)
        .bind(expires_at)
        .fetch_one(self.pool)
        .await?;
        Ok(row)
    }

    /// Look up a grant by token hash.
    pub async fn get_by_token(&self, token_hash: &str) -> Result<Option<AccessGrant>> {
        let row = sqlx::query_as::<_, AccessGrant>(
            "SELECT * FROM org_access_grants WHERE token_hash = $1",
        )
        .bind(token_hash)
        .fetch_optional(self.pool)
        .await?;
        Ok(row)
    }

    /// List every active (non-revoked, non-expired) grant on a
    /// resource.
    pub async fn list_for_resource(
        &self,
        resource_type: &str,
        resource_id: Uuid,
    ) -> Result<Vec<AccessGrant>> {
        let rows = sqlx::query_as::<_, AccessGrant>(
            "SELECT * FROM org_access_grants
              WHERE resource_type = $1 AND resource_id = $2
                AND revoked_at IS NULL
                AND (expires_at IS NULL OR expires_at > now())
              ORDER BY created_at DESC",
        )
        .bind(resource_type)
        .bind(resource_id)
        .fetch_all(self.pool)
        .await?;
        Ok(rows)
    }

    /// Revoke a grant (sets `revoked_at = now()`).
    pub async fn revoke(&self, id: Uuid) -> Result<()> {
        sqlx::query("UPDATE org_access_grants SET revoked_at = now() WHERE id = $1")
            .bind(id)
            .execute(self.pool)
            .await?;
        Ok(())
    }

    /// Bump `last_used_at` to `now()` on a grant — called on every
    /// successful redirect.
    pub async fn bump_last_used(&self, id: Uuid) -> Result<()> {
        sqlx::query("UPDATE org_access_grants SET last_used_at = now() WHERE id = $1")
            .bind(id)
            .execute(self.pool)
            .await?;
        Ok(())
    }
}
