//! CRUD for `org_assignments`.

use anyhow::Result;
use chrono::NaiveDate;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::org::{Assignment, Axis};

/// Repository for the canonical `org_assignments` table.
pub struct AssignmentRepository<'a> {
    pool: &'a PgPool,
}

impl<'a> AssignmentRepository<'a> {
    /// Construct a new repository bound to the given pool.
    pub fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    /// Insert a new assignment.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error if the insert fails (FK
    /// violation on `person_id` or `node_id`, ...).
    #[allow(clippy::too_many_arguments)]
    pub async fn create(
        &self,
        tenant_id: Uuid,
        person_id: Uuid,
        node_id: Uuid,
        axis: Axis,
        role: Option<&str>,
        is_primary: bool,
        start_date: Option<NaiveDate>,
        end_date: Option<NaiveDate>,
    ) -> Result<Assignment> {
        let row = sqlx::query_as::<_, Assignment>(
            "INSERT INTO org_assignments
                (tenant_id, person_id, node_id, axis, role, is_primary, start_date, end_date)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *",
        )
        .bind(tenant_id)
        .bind(person_id)
        .bind(node_id)
        .bind(axis)
        .bind(role)
        .bind(is_primary)
        .bind(start_date)
        .bind(end_date)
        .fetch_one(self.pool)
        .await?;
        Ok(row)
    }

    /// List every assignment of one person, optionally filtered by axis.
    pub async fn list_by_person(
        &self,
        person_id: Uuid,
        axis: Option<Axis>,
    ) -> Result<Vec<Assignment>> {
        let rows = match axis {
            Some(a) => sqlx::query_as::<_, Assignment>(
                "SELECT * FROM org_assignments
                 WHERE person_id = $1 AND axis = $2
                 ORDER BY created_at",
            )
            .bind(person_id)
            .bind(a)
            .fetch_all(self.pool)
            .await?,
            None => sqlx::query_as::<_, Assignment>(
                "SELECT * FROM org_assignments
                 WHERE person_id = $1
                 ORDER BY axis, created_at",
            )
            .bind(person_id)
            .fetch_all(self.pool)
            .await?,
        };
        Ok(rows)
    }

    /// List assignments for a tenant, optionally filtered by axis.
    ///
    /// Utilisé par le endpoint `/org/assignments?tenant_id=X&axis=focus`
    /// et le dashboard SO1 "focus & comités".
    pub async fn list_by_tenant(
        &self,
        tenant_id: Uuid,
        axis: Option<Axis>,
    ) -> Result<Vec<Assignment>> {
        let rows = match axis {
            Some(a) => sqlx::query_as::<_, Assignment>(
                "SELECT * FROM org_assignments
                 WHERE tenant_id = $1 AND axis = $2
                 ORDER BY created_at",
            )
            .bind(tenant_id)
            .bind(a)
            .fetch_all(self.pool)
            .await?,
            None => sqlx::query_as::<_, Assignment>(
                "SELECT * FROM org_assignments
                 WHERE tenant_id = $1
                 ORDER BY axis, created_at",
            )
            .bind(tenant_id)
            .fetch_all(self.pool)
            .await?,
        };
        Ok(rows)
    }

    /// List every assignment attached to one node.
    pub async fn list_by_node(&self, node_id: Uuid) -> Result<Vec<Assignment>> {
        let rows = sqlx::query_as::<_, Assignment>(
            "SELECT * FROM org_assignments
             WHERE node_id = $1
             ORDER BY axis, created_at",
        )
        .bind(node_id)
        .fetch_all(self.pool)
        .await?;
        Ok(rows)
    }

    /// Hard delete an assignment by primary key.
    pub async fn delete(&self, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM org_assignments WHERE id = $1")
            .bind(id)
            .execute(self.pool)
            .await?;
        Ok(())
    }
}
