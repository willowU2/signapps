//! CRUD + lookup queries for `org_persons`.

use anyhow::Result;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::org::Person;

/// Repository for the canonical `org_persons` table.
pub struct PersonRepository<'a> {
    pool: &'a PgPool,
}

impl<'a> PersonRepository<'a> {
    /// Construct a new repository bound to the given pool.
    pub fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    /// Insert a new person.
    ///
    /// `email` is required and unique within `tenant_id` (DB-enforced).
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error if the insert fails
    /// (UNIQUE violation, ...).
    pub async fn create(
        &self,
        tenant_id: Uuid,
        email: &str,
        first_name: Option<&str>,
        last_name: Option<&str>,
        dn: Option<&str>,
    ) -> Result<Person> {
        let row = sqlx::query_as::<_, Person>(
            "INSERT INTO org_persons (tenant_id, email, first_name, last_name, dn)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *",
        )
        .bind(tenant_id)
        .bind(email)
        .bind(first_name)
        .bind(last_name)
        .bind(dn)
        .fetch_one(self.pool)
        .await?;
        Ok(row)
    }

    /// Fetch by primary key.
    pub async fn get(&self, id: Uuid) -> Result<Option<Person>> {
        let row = sqlx::query_as::<_, Person>("SELECT * FROM org_persons WHERE id = $1")
            .bind(id)
            .fetch_optional(self.pool)
            .await?;
        Ok(row)
    }

    /// Fetch by `(tenant_id, email)` — UNIQUE pair.
    pub async fn get_by_email(&self, tenant_id: Uuid, email: &str) -> Result<Option<Person>> {
        let row = sqlx::query_as::<_, Person>(
            "SELECT * FROM org_persons WHERE tenant_id = $1 AND email = $2",
        )
        .bind(tenant_id)
        .bind(email)
        .fetch_optional(self.pool)
        .await?;
        Ok(row)
    }

    /// Fetch by LDAP distinguished name (used by the AD sync engine).
    pub async fn get_by_dn(&self, dn: &str) -> Result<Option<Person>> {
        let row = sqlx::query_as::<_, Person>("SELECT * FROM org_persons WHERE dn = $1")
            .bind(dn)
            .fetch_optional(self.pool)
            .await?;
        Ok(row)
    }

    /// List every active person for a tenant, ordered by last/first name.
    pub async fn list_by_tenant(&self, tenant_id: Uuid) -> Result<Vec<Person>> {
        let rows = sqlx::query_as::<_, Person>(
            "SELECT * FROM org_persons
             WHERE tenant_id = $1 AND active = true
             ORDER BY last_name NULLS LAST, first_name NULLS LAST, email",
        )
        .bind(tenant_id)
        .fetch_all(self.pool)
        .await?;
        Ok(rows)
    }

    /// Soft-delete a person (sets `active = false`).
    pub async fn archive(&self, id: Uuid) -> Result<()> {
        sqlx::query("UPDATE org_persons SET active = false, updated_at = now() WHERE id = $1")
            .bind(id)
            .execute(self.pool)
            .await?;
        Ok(())
    }

    /// Stamp the sync markers `(last_synced_at = now(), last_synced_by = $2)`.
    ///
    /// Used by the AD sync engine (S1 W3) to record which side applied
    /// the most recent change and to enforce a debounce window on the
    /// opposite direction, preventing AD↔Org ping-pong.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error if the update fails.
    pub async fn mark_synced(&self, id: Uuid, by: &str) -> Result<()> {
        sqlx::query(
            "UPDATE org_persons SET
                last_synced_at = now(),
                last_synced_by = $2
             WHERE id = $1",
        )
        .bind(id)
        .bind(by)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    /// `true` when the person row was synced FROM AD within the given
    /// `debounce` window (typically 30 s). OrgToAd callers should
    /// skip rows that return `true` to avoid ping-pong.
    ///
    /// Returns `false` when the column is NULL or when the last sync
    /// was applied from the Org side.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error if the query fails.
    pub async fn is_within_ad_debounce(
        &self,
        id: Uuid,
        debounce_secs: i32,
    ) -> Result<bool> {
        let row: Option<(bool,)> = sqlx::query_as(
            "SELECT last_synced_by = 'ad'
                 AND last_synced_at IS NOT NULL
                 AND last_synced_at > now() - make_interval(secs => $2)
             FROM org_persons
             WHERE id = $1",
        )
        .bind(id)
        .bind(f64::from(debounce_secs))
        .fetch_optional(self.pool)
        .await?;
        Ok(row.map(|r| r.0).unwrap_or(false))
    }
}
