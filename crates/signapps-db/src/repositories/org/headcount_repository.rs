//! CRUD + rollup for `org_headcount_plan` — SO3 scale & power.

use anyhow::Result;
use chrono::NaiveDate;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::org::{HeadcountPlan, HeadcountRollup};

/// Repository for the canonical `org_headcount_plan` table.
pub struct HeadcountRepository<'a> {
    pool: &'a PgPool,
}

impl<'a> HeadcountRepository<'a> {
    /// Construct a new repository bound to the given pool.
    pub fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    /// List every plan for a tenant, optionally filtered by node.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn list_by_tenant(
        &self,
        tenant_id: Uuid,
        node_id: Option<Uuid>,
    ) -> Result<Vec<HeadcountPlan>> {
        let rows = match node_id {
            Some(n) => sqlx::query_as::<_, HeadcountPlan>(
                "SELECT * FROM org_headcount_plan
                 WHERE tenant_id = $1 AND node_id = $2
                 ORDER BY target_date",
            )
            .bind(tenant_id)
            .bind(n)
            .fetch_all(self.pool)
            .await?,
            None => sqlx::query_as::<_, HeadcountPlan>(
                "SELECT * FROM org_headcount_plan
                 WHERE tenant_id = $1
                 ORDER BY target_date",
            )
            .bind(tenant_id)
            .fetch_all(self.pool)
            .await?,
        };
        Ok(rows)
    }

    /// Fetch a single plan by primary key.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn get(&self, id: Uuid) -> Result<Option<HeadcountPlan>> {
        let row = sqlx::query_as::<_, HeadcountPlan>(
            "SELECT * FROM org_headcount_plan WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(self.pool)
        .await?;
        Ok(row)
    }

    /// Insert a new plan.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error (FK violation, CHECK).
    pub async fn create(
        &self,
        tenant_id: Uuid,
        node_id: Uuid,
        target_head_count: i32,
        target_date: NaiveDate,
        notes: Option<&str>,
    ) -> Result<HeadcountPlan> {
        let row = sqlx::query_as::<_, HeadcountPlan>(
            "INSERT INTO org_headcount_plan
                (tenant_id, node_id, target_head_count, target_date, notes)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *",
        )
        .bind(tenant_id)
        .bind(node_id)
        .bind(target_head_count)
        .bind(target_date)
        .bind(notes)
        .fetch_one(self.pool)
        .await?;
        Ok(row)
    }

    /// Update an existing plan — partial.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn update(
        &self,
        id: Uuid,
        target_head_count: Option<i32>,
        target_date: Option<NaiveDate>,
        notes: Option<&str>,
    ) -> Result<Option<HeadcountPlan>> {
        let row = sqlx::query_as::<_, HeadcountPlan>(
            "UPDATE org_headcount_plan
                SET target_head_count = COALESCE($2, target_head_count),
                    target_date       = COALESCE($3, target_date),
                    notes             = COALESCE($4, notes),
                    updated_at        = now()
              WHERE id = $1
              RETURNING *",
        )
        .bind(id)
        .bind(target_head_count)
        .bind(target_date)
        .bind(notes)
        .fetch_optional(self.pool)
        .await?;
        Ok(row)
    }

    /// Delete a plan.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn delete(&self, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM org_headcount_plan WHERE id = $1")
            .bind(id)
            .execute(self.pool)
            .await?;
        Ok(())
    }

    /// Compute a headcount rollup for a single node.
    ///
    /// Returns `{filled, positions_sum, target, gap, status}` where:
    /// - `filled`         = COUNT(incumbents active) sur les positions du node
    /// - `positions_sum`  = SUM(head_count) des positions actives du node
    /// - `target`         = target_head_count du plan le plus proche dans le futur (>= today)
    /// - `gap`            = target - filled (None si pas de plan)
    /// - `status`         = `on_track` si |gap|<=1, `understaffed` si gap>1, `over_plan` si gap<-1
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn compute_rollup(
        &self,
        tenant_id: Uuid,
        node_id: Uuid,
    ) -> Result<HeadcountRollup> {
        // filled = active incumbents on positions of this node
        let filled: i64 = sqlx::query_scalar(
            "SELECT count(*)::bigint FROM org_position_incumbents pi
             JOIN org_positions p ON p.id = pi.position_id
             WHERE p.node_id = $1 AND pi.active = true AND p.active = true",
        )
        .bind(node_id)
        .fetch_one(self.pool)
        .await?;

        // positions_sum = SUM(head_count) of active positions on this node
        let positions_sum: i64 = sqlx::query_scalar(
            "SELECT COALESCE(SUM(head_count)::bigint, 0) FROM org_positions
             WHERE node_id = $1 AND active = true",
        )
        .bind(node_id)
        .fetch_one(self.pool)
        .await?;

        // target = plan the closest in the future
        let target: Option<i32> = sqlx::query_scalar(
            "SELECT target_head_count FROM org_headcount_plan
             WHERE tenant_id = $1 AND node_id = $2 AND target_date >= CURRENT_DATE
             ORDER BY target_date ASC
             LIMIT 1",
        )
        .bind(tenant_id)
        .bind(node_id)
        .fetch_optional(self.pool)
        .await?;

        let gap = target.map(|t| t - i32::try_from(filled).unwrap_or(i32::MAX));
        let status = match gap {
            None => "no_plan".to_string(),
            Some(g) if g.abs() <= 1 => "on_track".to_string(),
            Some(g) if g > 1 => "understaffed".to_string(),
            Some(_) => "over_plan".to_string(),
        };

        Ok(HeadcountRollup {
            node_id,
            filled,
            positions_sum,
            target,
            gap,
            status,
        })
    }
}
