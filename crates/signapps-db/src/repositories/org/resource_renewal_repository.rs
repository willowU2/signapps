//! CRUD for `org_resource_renewals` — SO9 cycle de renouvellement.

use anyhow::Result;
use chrono::{DateTime, NaiveDate, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::org::{RenewalKind, RenewalStatus, ResourceRenewal};

/// Repository for `org_resource_renewals`.
pub struct ResourceRenewalRepository<'a> {
    pool: &'a PgPool,
}

/// Filters pour [`ResourceRenewalRepository::list`].
#[derive(Debug, Default, Clone)]
pub struct RenewalListFilters {
    /// Tenant.
    pub tenant_id: Uuid,
    /// Filter par resource_id.
    pub resource_id: Option<Uuid>,
    /// Filter par kind.
    pub kind: Option<RenewalKind>,
    /// Filter par status.
    pub status: Option<RenewalStatus>,
    /// Filter par due_date >= date.
    pub due_from: Option<NaiveDate>,
    /// Filter par due_date <= date.
    pub due_to: Option<NaiveDate>,
}

/// Payload pour créer un renouvellement.
#[derive(Debug, Clone)]
pub struct NewResourceRenewal {
    /// Tenant propriétaire.
    pub tenant_id: Uuid,
    /// Ressource.
    pub resource_id: Uuid,
    /// Type.
    pub kind: RenewalKind,
    /// Échéance.
    pub due_date: NaiveDate,
    /// Grace period en jours.
    pub grace_period_days: i32,
    /// Statut initial (par défaut `pending`).
    pub status: RenewalStatus,
    /// Notes initiales.
    pub renewal_notes: Option<String>,
}

impl<'a> ResourceRenewalRepository<'a> {
    /// Bind to a pool.
    #[must_use]
    pub fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    /// Insert a new renewal row.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn create(&self, input: NewResourceRenewal) -> Result<ResourceRenewal> {
        let row = sqlx::query_as::<_, ResourceRenewal>(
            r"
            INSERT INTO org_resource_renewals
              (tenant_id, resource_id, kind, due_date, grace_period_days,
               status, renewal_notes)
            VALUES
              ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
            ",
        )
        .bind(input.tenant_id)
        .bind(input.resource_id)
        .bind(input.kind.as_str())
        .bind(input.due_date)
        .bind(input.grace_period_days)
        .bind(input.status.as_str())
        .bind(&input.renewal_notes)
        .fetch_one(self.pool)
        .await?;
        Ok(row)
    }

    /// Fetch by id.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn get(&self, id: Uuid) -> Result<Option<ResourceRenewal>> {
        let row = sqlx::query_as::<_, ResourceRenewal>(
            "SELECT * FROM org_resource_renewals WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(self.pool)
        .await?;
        Ok(row)
    }

    /// List by filters.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn list(&self, filters: RenewalListFilters) -> Result<Vec<ResourceRenewal>> {
        let kind_str = filters.kind.map(|k| k.as_str().to_string());
        let status_str = filters.status.map(|s| s.as_str().to_string());
        let rows = sqlx::query_as::<_, ResourceRenewal>(
            r"
            SELECT * FROM org_resource_renewals
             WHERE tenant_id = $1
               AND ($2::uuid IS NULL OR resource_id = $2)
               AND ($3::text IS NULL OR kind = $3)
               AND ($4::text IS NULL OR status = $4)
               AND ($5::date IS NULL OR due_date >= $5)
               AND ($6::date IS NULL OR due_date <= $6)
             ORDER BY due_date, created_at
             LIMIT 500
            ",
        )
        .bind(filters.tenant_id)
        .bind(filters.resource_id)
        .bind(kind_str)
        .bind(status_str)
        .bind(filters.due_from)
        .bind(filters.due_to)
        .fetch_all(self.pool)
        .await?;
        Ok(rows)
    }

    /// Mark a renewal as renewed.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn mark_renewed(
        &self,
        id: Uuid,
        renewed_at: DateTime<Utc>,
        renewed_by_user_id: Option<Uuid>,
        notes: Option<String>,
    ) -> Result<Option<ResourceRenewal>> {
        let row = sqlx::query_as::<_, ResourceRenewal>(
            r"
            UPDATE org_resource_renewals
               SET status = 'renewed',
                   renewed_at = $2,
                   renewed_by_user_id = $3,
                   renewal_notes = COALESCE($4, renewal_notes),
                   updated_at = now()
             WHERE id = $1
             RETURNING *
            ",
        )
        .bind(id)
        .bind(renewed_at)
        .bind(renewed_by_user_id)
        .bind(&notes)
        .fetch_optional(self.pool)
        .await?;
        Ok(row)
    }

    /// Snooze a renewal to a future date.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn snooze(&self, id: Uuid, until: NaiveDate) -> Result<Option<ResourceRenewal>> {
        let row = sqlx::query_as::<_, ResourceRenewal>(
            r"
            UPDATE org_resource_renewals
               SET status = 'snoozed',
                   snoozed_until = $2,
                   updated_at = now()
             WHERE id = $1
             RETURNING *
            ",
        )
        .bind(id)
        .bind(until)
        .fetch_optional(self.pool)
        .await?;
        Ok(row)
    }

    /// Cancel a renewal.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn cancel(&self, id: Uuid) -> Result<Option<ResourceRenewal>> {
        let row = sqlx::query_as::<_, ResourceRenewal>(
            r"
            UPDATE org_resource_renewals
               SET status = 'cancelled', updated_at = now()
             WHERE id = $1
             RETURNING *
            ",
        )
        .bind(id)
        .fetch_optional(self.pool)
        .await?;
        Ok(row)
    }

    /// Flag a renewal as escalated (past due + grace).
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn escalate(&self, id: Uuid, reminded_at: DateTime<Utc>) -> Result<Option<ResourceRenewal>> {
        let row = sqlx::query_as::<_, ResourceRenewal>(
            r"
            UPDATE org_resource_renewals
               SET status = 'escalated',
                   last_reminded_at = $2,
                   updated_at = now()
             WHERE id = $1
             RETURNING *
            ",
        )
        .bind(id)
        .bind(reminded_at)
        .fetch_optional(self.pool)
        .await?;
        Ok(row)
    }

    /// Update `last_reminded_at` on a pending row (for tick/bump).
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn bump_reminder(
        &self,
        id: Uuid,
        reminded_at: DateTime<Utc>,
    ) -> Result<Option<ResourceRenewal>> {
        let row = sqlx::query_as::<_, ResourceRenewal>(
            r"
            UPDATE org_resource_renewals
               SET last_reminded_at = $2, updated_at = now()
             WHERE id = $1
             RETURNING *
            ",
        )
        .bind(id)
        .bind(reminded_at)
        .fetch_optional(self.pool)
        .await?;
        Ok(row)
    }

    /// List open renewals (pending / snoozed / escalated) due within
    /// `horizon_days` of `today`.
    ///
    /// Used by the `resource_renewals_daily` cron.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn list_open_due_within(
        &self,
        today: NaiveDate,
        horizon_days: i64,
    ) -> Result<Vec<ResourceRenewal>> {
        let rows = sqlx::query_as::<_, ResourceRenewal>(
            r"
            SELECT * FROM org_resource_renewals
             WHERE status IN ('pending','snoozed','escalated')
               AND due_date - $1 <= $2
             ORDER BY due_date, tenant_id
            ",
        )
        .bind(today)
        .bind(horizon_days as i32)
        .fetch_all(self.pool)
        .await?;
        Ok(rows)
    }

    /// Delete a row.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn delete(&self, id: Uuid) -> Result<bool> {
        let res = sqlx::query("DELETE FROM org_resource_renewals WHERE id = $1")
            .bind(id)
            .execute(self.pool)
            .await?;
        Ok(res.rows_affected() > 0)
    }

    /// Count renewals grouped by (kind, status).
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn count_by_kind_status(
        &self,
        tenant_id: Uuid,
    ) -> Result<Vec<(String, String, i64)>> {
        let rows: Vec<(String, String, i64)> = sqlx::query_as(
            "SELECT kind, status, COUNT(*)::BIGINT FROM org_resource_renewals
              WHERE tenant_id = $1
              GROUP BY kind, status
              ORDER BY kind, status",
        )
        .bind(tenant_id)
        .fetch_all(self.pool)
        .await?;
        Ok(rows)
    }
}
