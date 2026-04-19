//! CRUD for `org_positions` and `org_position_incumbents`.

use anyhow::Result;
use chrono::NaiveDate;
use serde_json::Value as JsonValue;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::org::{Position, PositionIncumbent};

/// Repository for the canonical `org_positions` +
/// `org_position_incumbents` tables.
pub struct PositionRepository<'a> {
    pool: &'a PgPool,
}

impl<'a> PositionRepository<'a> {
    /// Construct a new repository bound to the given pool.
    pub fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    // ─── Positions ──────────────────────────────────────────────────

    /// Insert a new position.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error if the insert fails (FK
    /// violation on `node_id`, constraint on `head_count >= 0`, ...).
    pub async fn create(
        &self,
        tenant_id: Uuid,
        node_id: Uuid,
        title: &str,
        head_count: i32,
        attributes: JsonValue,
    ) -> Result<Position> {
        let row = sqlx::query_as::<_, Position>(
            "INSERT INTO org_positions (tenant_id, node_id, title, head_count, attributes)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *",
        )
        .bind(tenant_id)
        .bind(node_id)
        .bind(title)
        .bind(head_count)
        .bind(attributes)
        .fetch_one(self.pool)
        .await?;
        Ok(row)
    }

    /// Fetch one position by primary key. Returns `None` if missing.
    pub async fn get(&self, id: Uuid) -> Result<Option<Position>> {
        let row = sqlx::query_as::<_, Position>("SELECT * FROM org_positions WHERE id = $1")
            .bind(id)
            .fetch_optional(self.pool)
            .await?;
        Ok(row)
    }

    /// List all active positions attached to a node, ordered by title.
    pub async fn list_by_node(&self, node_id: Uuid) -> Result<Vec<Position>> {
        let rows = sqlx::query_as::<_, Position>(
            "SELECT * FROM org_positions
             WHERE node_id = $1 AND active = true
             ORDER BY title, created_at",
        )
        .bind(node_id)
        .fetch_all(self.pool)
        .await?;
        Ok(rows)
    }

    /// List all active positions for a tenant, optionally filtered by node.
    pub async fn list_by_tenant(
        &self,
        tenant_id: Uuid,
        node_id: Option<Uuid>,
    ) -> Result<Vec<Position>> {
        let rows = match node_id {
            Some(nid) => sqlx::query_as::<_, Position>(
                "SELECT * FROM org_positions
                 WHERE tenant_id = $1 AND node_id = $2 AND active = true
                 ORDER BY title, created_at",
            )
            .bind(tenant_id)
            .bind(nid)
            .fetch_all(self.pool)
            .await?,
            None => sqlx::query_as::<_, Position>(
                "SELECT * FROM org_positions
                 WHERE tenant_id = $1 AND active = true
                 ORDER BY title, created_at",
            )
            .bind(tenant_id)
            .fetch_all(self.pool)
            .await?,
        };
        Ok(rows)
    }

    /// Partial update : title / head_count / attributes / active.
    pub async fn update(
        &self,
        id: Uuid,
        title: Option<&str>,
        head_count: Option<i32>,
        attributes: Option<JsonValue>,
        active: Option<bool>,
    ) -> Result<Option<Position>> {
        let row = sqlx::query_as::<_, Position>(
            "UPDATE org_positions
                SET title       = COALESCE($2, title),
                    head_count  = COALESCE($3, head_count),
                    attributes  = COALESCE($4, attributes),
                    active      = COALESCE($5, active),
                    updated_at  = now()
              WHERE id = $1
              RETURNING *",
        )
        .bind(id)
        .bind(title)
        .bind(head_count)
        .bind(attributes)
        .bind(active)
        .fetch_optional(self.pool)
        .await?;
        Ok(row)
    }

    /// Hard delete a position by primary key (cascade to incumbents).
    pub async fn delete(&self, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM org_positions WHERE id = $1")
            .bind(id)
            .execute(self.pool)
            .await?;
        Ok(())
    }

    // ─── Incumbents ─────────────────────────────────────────────────

    /// Attach a person to a position.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error if the insert fails (FK
    /// violation, UNIQUE conflict on `(position, person, start_date)`).
    pub async fn add_incumbent(
        &self,
        tenant_id: Uuid,
        position_id: Uuid,
        person_id: Uuid,
        start_date: Option<NaiveDate>,
    ) -> Result<PositionIncumbent> {
        let row = sqlx::query_as::<_, PositionIncumbent>(
            "INSERT INTO org_position_incumbents
                (tenant_id, position_id, person_id, start_date)
             VALUES ($1, $2, $3, COALESCE($4, CURRENT_DATE))
             RETURNING *",
        )
        .bind(tenant_id)
        .bind(position_id)
        .bind(person_id)
        .bind(start_date)
        .fetch_one(self.pool)
        .await?;
        Ok(row)
    }

    /// List every incumbent of a position (active **and** historical,
    /// ordered most-recent first).
    pub async fn list_incumbents(&self, position_id: Uuid) -> Result<Vec<PositionIncumbent>> {
        let rows = sqlx::query_as::<_, PositionIncumbent>(
            "SELECT * FROM org_position_incumbents
             WHERE position_id = $1
             ORDER BY active DESC, start_date DESC",
        )
        .bind(position_id)
        .fetch_all(self.pool)
        .await?;
        Ok(rows)
    }

    /// List positions occupied by a person (active only).
    pub async fn list_incumbents_by_person(
        &self,
        person_id: Uuid,
    ) -> Result<Vec<PositionIncumbent>> {
        let rows = sqlx::query_as::<_, PositionIncumbent>(
            "SELECT * FROM org_position_incumbents
             WHERE person_id = $1 AND active = true
             ORDER BY start_date DESC",
        )
        .bind(person_id)
        .fetch_all(self.pool)
        .await?;
        Ok(rows)
    }

    /// Soft-revoke an incumbent (set active=false + end_date).
    pub async fn revoke_incumbent(
        &self,
        id: Uuid,
        end_date: Option<NaiveDate>,
    ) -> Result<Option<PositionIncumbent>> {
        let row = sqlx::query_as::<_, PositionIncumbent>(
            "UPDATE org_position_incumbents
                SET active = false,
                    end_date = COALESCE($2, CURRENT_DATE)
              WHERE id = $1
              RETURNING *",
        )
        .bind(id)
        .bind(end_date)
        .fetch_optional(self.pool)
        .await?;
        Ok(row)
    }

    /// Count active incumbents vs head_count for a position.
    ///
    /// Returns `(filled, head_count)`.
    pub async fn occupancy(&self, position_id: Uuid) -> Result<(i64, i32)> {
        let row: (i64, i32) = sqlx::query_as(
            "SELECT
                (SELECT count(*)::bigint FROM org_position_incumbents
                   WHERE position_id = $1 AND active = true) AS filled,
                (SELECT head_count FROM org_positions WHERE id = $1) AS head_count",
        )
        .bind(position_id)
        .fetch_one(self.pool)
        .await?;
        Ok(row)
    }
}
