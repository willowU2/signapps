//! CRUD for `org_raci` — RACI matrix (SO2 governance).

use anyhow::Result;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::org::{Raci, RaciRole};

/// Repository for the canonical `org_raci` table.
pub struct RaciRepository<'a> {
    pool: &'a PgPool,
}

impl<'a> RaciRepository<'a> {
    /// Construct a new repository bound to the given pool.
    pub fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    /// List every RACI row attached to a project.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn list_by_project(&self, project_id: Uuid) -> Result<Vec<Raci>> {
        let rows = sqlx::query_as::<_, Raci>(
            "SELECT * FROM org_raci
             WHERE project_id = $1
             ORDER BY role, created_at",
        )
        .bind(project_id)
        .fetch_all(self.pool)
        .await?;
        Ok(rows)
    }

    /// List every RACI row attached to a person (across projects).
    pub async fn list_by_person(&self, person_id: Uuid) -> Result<Vec<Raci>> {
        let rows = sqlx::query_as::<_, Raci>(
            "SELECT * FROM org_raci
             WHERE person_id = $1
             ORDER BY created_at DESC",
        )
        .bind(person_id)
        .fetch_all(self.pool)
        .await?;
        Ok(rows)
    }

    /// Insert a new RACI row. The SQL layer enforces:
    /// - UNIQUE (project_id, person_id, role)
    /// - partial unique idx_raci_one_accountable (only one A per project)
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error (UNIQUE violation surfaces as
    /// `sqlx::Error::Database` with constraint name — handlers map to
    /// HTTP 409).
    pub async fn create(
        &self,
        tenant_id: Uuid,
        project_id: Uuid,
        person_id: Uuid,
        role: RaciRole,
    ) -> Result<Raci> {
        let row = sqlx::query_as::<_, Raci>(
            "INSERT INTO org_raci (tenant_id, project_id, person_id, role)
             VALUES ($1, $2, $3, $4)
             RETURNING *",
        )
        .bind(tenant_id)
        .bind(project_id)
        .bind(person_id)
        .bind(role)
        .fetch_one(self.pool)
        .await?;
        Ok(row)
    }

    /// Hard-delete one row.
    pub async fn delete(&self, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM org_raci WHERE id = $1")
            .bind(id)
            .execute(self.pool)
            .await?;
        Ok(())
    }

    /// Replace every RACI row of `(project_id, person_id)` with the
    /// provided list of `roles`. Empty list = remove all roles for this
    /// pair. Idempotent. Runs inside a transaction to avoid a half-state.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error if the transaction fails.
    pub async fn bulk_set(
        &self,
        tenant_id: Uuid,
        project_id: Uuid,
        person_id: Uuid,
        roles: &[RaciRole],
    ) -> Result<Vec<Raci>> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("DELETE FROM org_raci WHERE project_id = $1 AND person_id = $2")
            .bind(project_id)
            .bind(person_id)
            .execute(&mut *tx)
            .await?;
        let mut out = Vec::with_capacity(roles.len());
        for role in roles {
            let row = sqlx::query_as::<_, Raci>(
                "INSERT INTO org_raci (tenant_id, project_id, person_id, role)
                 VALUES ($1, $2, $3, $4)
                 RETURNING *",
            )
            .bind(tenant_id)
            .bind(project_id)
            .bind(person_id)
            .bind(role)
            .fetch_one(&mut *tx)
            .await?;
            out.push(row);
        }
        tx.commit().await?;
        Ok(out)
    }
}
