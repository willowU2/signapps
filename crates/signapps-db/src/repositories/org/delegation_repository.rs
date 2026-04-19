//! CRUD for `org_delegations`.

use anyhow::Result;
use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::org::{Delegation, DelegationScope};

/// Repository for the canonical `org_delegations` table.
pub struct DelegationRepository<'a> {
    pool: &'a PgPool,
}

impl<'a> DelegationRepository<'a> {
    /// Construct a new repository bound to the given pool.
    pub fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    /// Insert a new delegation.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error (FK / CHECK violations).
    #[allow(clippy::too_many_arguments)]
    pub async fn create(
        &self,
        tenant_id: Uuid,
        delegator_person_id: Uuid,
        delegate_person_id: Uuid,
        node_id: Option<Uuid>,
        scope: DelegationScope,
        start_at: DateTime<Utc>,
        end_at: DateTime<Utc>,
        reason: Option<&str>,
        created_by: Option<Uuid>,
    ) -> Result<Delegation> {
        let row = sqlx::query_as::<_, Delegation>(
            "INSERT INTO org_delegations
                (tenant_id, delegator_person_id, delegate_person_id, node_id,
                 scope, start_at, end_at, reason, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *",
        )
        .bind(tenant_id)
        .bind(delegator_person_id)
        .bind(delegate_person_id)
        .bind(node_id)
        .bind(scope)
        .bind(start_at)
        .bind(end_at)
        .bind(reason)
        .bind(created_by)
        .fetch_one(self.pool)
        .await?;
        Ok(row)
    }

    /// Fetch one delegation.
    pub async fn get(&self, id: Uuid) -> Result<Option<Delegation>> {
        let row = sqlx::query_as::<_, Delegation>("SELECT * FROM org_delegations WHERE id = $1")
            .bind(id)
            .fetch_optional(self.pool)
            .await?;
        Ok(row)
    }

    /// List active delegations where `person_id` is the delegator.
    pub async fn list_active_for_delegator(&self, person_id: Uuid) -> Result<Vec<Delegation>> {
        let rows = sqlx::query_as::<_, Delegation>(
            "SELECT * FROM org_delegations
             WHERE delegator_person_id = $1
               AND active = true
               AND now() BETWEEN start_at AND end_at
             ORDER BY end_at",
        )
        .bind(person_id)
        .fetch_all(self.pool)
        .await?;
        Ok(rows)
    }

    /// List active delegations where `person_id` is the delegate.
    pub async fn list_active_for_delegate(&self, person_id: Uuid) -> Result<Vec<Delegation>> {
        let rows = sqlx::query_as::<_, Delegation>(
            "SELECT * FROM org_delegations
             WHERE delegate_person_id = $1
               AND active = true
               AND now() BETWEEN start_at AND end_at
             ORDER BY end_at",
        )
        .bind(person_id)
        .fetch_all(self.pool)
        .await?;
        Ok(rows)
    }

    /// List every delegation for a tenant (optionally filter active only).
    pub async fn list_by_tenant(
        &self,
        tenant_id: Uuid,
        active_only: bool,
    ) -> Result<Vec<Delegation>> {
        let rows = if active_only {
            sqlx::query_as::<_, Delegation>(
                "SELECT * FROM org_delegations
                 WHERE tenant_id = $1
                   AND active = true
                   AND now() BETWEEN start_at AND end_at
                 ORDER BY end_at",
            )
            .bind(tenant_id)
            .fetch_all(self.pool)
            .await?
        } else {
            sqlx::query_as::<_, Delegation>(
                "SELECT * FROM org_delegations
                 WHERE tenant_id = $1
                 ORDER BY created_at DESC",
            )
            .bind(tenant_id)
            .fetch_all(self.pool)
            .await?
        };
        Ok(rows)
    }

    /// Soft-revoke a delegation (active = false, updated_at bumped).
    pub async fn revoke(&self, id: Uuid) -> Result<Option<Delegation>> {
        let row = sqlx::query_as::<_, Delegation>(
            "UPDATE org_delegations
                SET active = false, updated_at = now()
              WHERE id = $1
              RETURNING *",
        )
        .bind(id)
        .fetch_optional(self.pool)
        .await?;
        Ok(row)
    }

    /// Hard delete — admin only.
    pub async fn delete(&self, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM org_delegations WHERE id = $1")
            .bind(id)
            .execute(self.pool)
            .await?;
        Ok(())
    }

    /// Soft-expire every delegation whose `end_at < now()` and still
    /// `active = true`. Returns the list of expired ids (one row per
    /// delegation that was flipped), used by the cron to emit events.
    pub async fn expire_due(&self, now: DateTime<Utc>) -> Result<Vec<Uuid>> {
        let rows: Vec<(Uuid,)> = sqlx::query_as(
            "UPDATE org_delegations
                SET active = false, updated_at = now()
              WHERE active = true AND end_at < $1
              RETURNING id",
        )
        .bind(now)
        .fetch_all(self.pool)
        .await?;
        Ok(rows.into_iter().map(|(id,)| id).collect())
    }
}
