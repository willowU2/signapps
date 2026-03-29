//! HR repositories for calendar-related entities:
//! categories, presence rules, leave balances, timesheet entries, approval workflows.

use crate::models::calendar::{
    ApprovalWorkflow, Category, CreateApprovalWorkflow, CreateCategory, CreatePresenceRule,
    LeaveBalance, PresenceRule, TimesheetEntry,
};
use crate::DatabasePool;
use signapps_common::Result;
use uuid::Uuid;

// ============================================================================
// CategoryRepository
// ============================================================================
pub struct CategoryRepository<'a> {
    pool: &'a DatabasePool,
}

impl<'a> CategoryRepository<'a> {
    pub fn new(pool: &'a DatabasePool) -> Self {
        Self { pool }
    }

    /// List categories visible to a user or org.
    pub async fn list(
        &self,
        owner_id: Option<Uuid>,
        org_id: Option<Uuid>,
    ) -> Result<Vec<Category>> {
        let rows = sqlx::query_as::<_, Category>(
            "SELECT * FROM calendar.categories \
             WHERE (owner_id = $1 AND $1 IS NOT NULL) \
                OR (org_id = $2 AND $2 IS NOT NULL) \
             ORDER BY name",
        )
        .bind(owner_id)
        .bind(org_id)
        .fetch_all(self.pool.inner())
        .await?;
        Ok(rows)
    }

    /// Get a category by ID.
    pub async fn find_by_id(&self, id: Uuid) -> Result<Option<Category>> {
        let row = sqlx::query_as::<_, Category>("SELECT * FROM calendar.categories WHERE id = $1")
            .bind(id)
            .fetch_optional(self.pool.inner())
            .await?;
        Ok(row)
    }

    /// Create a new category.
    pub async fn create(&self, owner_id: Uuid, input: &CreateCategory) -> Result<Category> {
        let row = sqlx::query_as::<_, Category>(
            "INSERT INTO calendar.categories (name, color, icon, owner_id, org_id, rules) \
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
        )
        .bind(&input.name)
        .bind(input.color.as_deref().unwrap_or("#6b7280"))
        .bind(&input.icon)
        .bind(owner_id)
        .bind(input.org_id)
        .bind(&input.rules)
        .fetch_one(self.pool.inner())
        .await?;
        Ok(row)
    }

    /// Update an existing category.
    pub async fn update(&self, id: Uuid, input: &CreateCategory) -> Result<Category> {
        let row = sqlx::query_as::<_, Category>(
            "UPDATE calendar.categories \
             SET name = $2, color = $3, icon = $4, rules = $5 \
             WHERE id = $1 RETURNING *",
        )
        .bind(id)
        .bind(&input.name)
        .bind(input.color.as_deref().unwrap_or("#6b7280"))
        .bind(&input.icon)
        .bind(&input.rules)
        .fetch_one(self.pool.inner())
        .await?;
        Ok(row)
    }

    /// Delete a category.
    pub async fn delete(&self, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM calendar.categories WHERE id = $1")
            .bind(id)
            .execute(self.pool.inner())
            .await?;
        Ok(())
    }
}

// ============================================================================
// PresenceRuleRepository
// ============================================================================
pub struct PresenceRuleRepository<'a> {
    pool: &'a DatabasePool,
}

impl<'a> PresenceRuleRepository<'a> {
    pub fn new(pool: &'a DatabasePool) -> Self {
        Self { pool }
    }

    /// List presence rules for an org (and optionally a team).
    pub async fn list(&self, org_id: Uuid, team_id: Option<Uuid>) -> Result<Vec<PresenceRule>> {
        let rows = sqlx::query_as::<_, PresenceRule>(
            "SELECT * FROM calendar.presence_rules \
             WHERE org_id = $1 \
               AND ($2::uuid IS NULL OR team_id = $2) \
             ORDER BY created_at DESC",
        )
        .bind(org_id)
        .bind(team_id)
        .fetch_all(self.pool.inner())
        .await?;
        Ok(rows)
    }

    /// Get a presence rule by ID.
    pub async fn find_by_id(&self, id: Uuid) -> Result<Option<PresenceRule>> {
        let row = sqlx::query_as::<_, PresenceRule>(
            "SELECT * FROM calendar.presence_rules WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(self.pool.inner())
        .await?;
        Ok(row)
    }

    /// Create a new presence rule.
    pub async fn create(&self, input: &CreatePresenceRule) -> Result<PresenceRule> {
        let row = sqlx::query_as::<_, PresenceRule>(
            "INSERT INTO calendar.presence_rules \
             (org_id, team_id, rule_type, rule_config, enforcement) \
             VALUES ($1, $2, $3::calendar.rule_type, $4, $5::calendar.enforcement_level) \
             RETURNING *",
        )
        .bind(input.org_id)
        .bind(input.team_id)
        .bind(&input.rule_type)
        .bind(&input.rule_config)
        .bind(input.enforcement.as_deref().unwrap_or("soft"))
        .fetch_one(self.pool.inner())
        .await?;
        Ok(row)
    }

    /// Update a presence rule.
    pub async fn update(&self, id: Uuid, input: &CreatePresenceRule) -> Result<PresenceRule> {
        let row = sqlx::query_as::<_, PresenceRule>(
            "UPDATE calendar.presence_rules \
             SET rule_type = $2::calendar.rule_type, rule_config = $3, \
                 enforcement = $4::calendar.enforcement_level, team_id = $5 \
             WHERE id = $1 RETURNING *",
        )
        .bind(id)
        .bind(&input.rule_type)
        .bind(&input.rule_config)
        .bind(input.enforcement.as_deref().unwrap_or("soft"))
        .bind(input.team_id)
        .fetch_one(self.pool.inner())
        .await?;
        Ok(row)
    }

    /// Toggle the active flag.
    pub async fn set_active(&self, id: Uuid, active: bool) -> Result<()> {
        sqlx::query("UPDATE calendar.presence_rules SET active = $2 WHERE id = $1")
            .bind(id)
            .bind(active)
            .execute(self.pool.inner())
            .await?;
        Ok(())
    }

    /// Delete a presence rule.
    pub async fn delete(&self, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM calendar.presence_rules WHERE id = $1")
            .bind(id)
            .execute(self.pool.inner())
            .await?;
        Ok(())
    }
}

// ============================================================================
// LeaveBalanceRepository
// ============================================================================
pub struct LeaveBalanceRepository<'a> {
    pool: &'a DatabasePool,
}

impl<'a> LeaveBalanceRepository<'a> {
    pub fn new(pool: &'a DatabasePool) -> Self {
        Self { pool }
    }

    /// List all leave balances for a user.
    pub async fn list_for_user(&self, user_id: Uuid) -> Result<Vec<LeaveBalance>> {
        let rows = sqlx::query_as::<_, LeaveBalance>(
            "SELECT * FROM calendar.leave_balances WHERE user_id = $1 ORDER BY year DESC, leave_type",
        )
        .bind(user_id)
        .fetch_all(self.pool.inner())
        .await?;
        Ok(rows)
    }

    /// Get a specific leave balance for user/type/year.
    pub async fn get_by_user_year(
        &self,
        user_id: Uuid,
        leave_type: &str,
        year: i32,
    ) -> Result<Option<LeaveBalance>> {
        let row = sqlx::query_as::<_, LeaveBalance>(
            "SELECT * FROM calendar.leave_balances \
             WHERE user_id = $1 AND leave_type = $2::calendar.leave_type AND year = $3",
        )
        .bind(user_id)
        .bind(leave_type)
        .bind(year)
        .fetch_optional(self.pool.inner())
        .await?;
        Ok(row)
    }

    /// Upsert a leave balance (insert or update total_days).
    pub async fn upsert(
        &self,
        user_id: Uuid,
        leave_type: &str,
        year: i32,
        total_days: f64,
    ) -> Result<LeaveBalance> {
        let row = sqlx::query_as::<_, LeaveBalance>(
            "INSERT INTO calendar.leave_balances (user_id, leave_type, year, total_days) \
             VALUES ($1, $2::calendar.leave_type, $3, $4) \
             ON CONFLICT (user_id, leave_type, year) \
             DO UPDATE SET total_days = EXCLUDED.total_days \
             RETURNING *",
        )
        .bind(user_id)
        .bind(leave_type)
        .bind(year)
        .bind(total_days)
        .fetch_one(self.pool.inner())
        .await?;
        Ok(row)
    }

    /// Increment used_days for a leave balance.
    pub async fn update_used_days(
        &self,
        user_id: Uuid,
        leave_type: &str,
        year: i32,
        delta: f64,
    ) -> Result<LeaveBalance> {
        let row = sqlx::query_as::<_, LeaveBalance>(
            "UPDATE calendar.leave_balances \
             SET used_days = used_days + $4 \
             WHERE user_id = $1 AND leave_type = $2::calendar.leave_type AND year = $3 \
             RETURNING *",
        )
        .bind(user_id)
        .bind(leave_type)
        .bind(year)
        .bind(delta)
        .fetch_one(self.pool.inner())
        .await?;
        Ok(row)
    }

    /// Increment pending_days for a leave balance.
    pub async fn update_pending_days(
        &self,
        user_id: Uuid,
        leave_type: &str,
        year: i32,
        delta: f64,
    ) -> Result<LeaveBalance> {
        let row = sqlx::query_as::<_, LeaveBalance>(
            "UPDATE calendar.leave_balances \
             SET pending_days = pending_days + $4 \
             WHERE user_id = $1 AND leave_type = $2::calendar.leave_type AND year = $3 \
             RETURNING *",
        )
        .bind(user_id)
        .bind(leave_type)
        .bind(year)
        .bind(delta)
        .fetch_one(self.pool.inner())
        .await?;
        Ok(row)
    }

    /// Delete a leave balance.
    pub async fn delete(&self, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM calendar.leave_balances WHERE id = $1")
            .bind(id)
            .execute(self.pool.inner())
            .await?;
        Ok(())
    }
}

// ============================================================================
// TimesheetRepository
// ============================================================================
pub struct TimesheetRepository<'a> {
    pool: &'a DatabasePool,
}

impl<'a> TimesheetRepository<'a> {
    pub fn new(pool: &'a DatabasePool) -> Self {
        Self { pool }
    }

    /// List timesheet entries for a user between two dates (inclusive).
    pub async fn list_for_user(
        &self,
        user_id: Uuid,
        from: chrono::NaiveDate,
        to: chrono::NaiveDate,
    ) -> Result<Vec<TimesheetEntry>> {
        let rows = sqlx::query_as::<_, TimesheetEntry>(
            "SELECT * FROM calendar.timesheet_entries \
             WHERE user_id = $1 AND date BETWEEN $2 AND $3 \
             ORDER BY date",
        )
        .bind(user_id)
        .bind(from)
        .bind(to)
        .fetch_all(self.pool.inner())
        .await?;
        Ok(rows)
    }

    /// List entries for a user for the ISO week containing a given date.
    pub async fn list_by_user_week(
        &self,
        user_id: Uuid,
        week_date: chrono::NaiveDate,
    ) -> Result<Vec<TimesheetEntry>> {
        let rows = sqlx::query_as::<_, TimesheetEntry>(
            "SELECT * FROM calendar.timesheet_entries \
             WHERE user_id = $1 \
               AND date_trunc('week', date::timestamptz) = date_trunc('week', $2::timestamptz) \
             ORDER BY date",
        )
        .bind(user_id)
        .bind(week_date)
        .fetch_all(self.pool.inner())
        .await?;
        Ok(rows)
    }

    /// Get a single timesheet entry by ID.
    pub async fn find_by_id(&self, id: Uuid) -> Result<Option<TimesheetEntry>> {
        let row = sqlx::query_as::<_, TimesheetEntry>(
            "SELECT * FROM calendar.timesheet_entries WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(self.pool.inner())
        .await?;
        Ok(row)
    }

    /// Create a timesheet entry.
    pub async fn create(
        &self,
        user_id: Uuid,
        event_id: Option<Uuid>,
        date: chrono::NaiveDate,
        hours: f64,
        category_id: Option<Uuid>,
        auto_generated: bool,
    ) -> Result<TimesheetEntry> {
        let row = sqlx::query_as::<_, TimesheetEntry>(
            "INSERT INTO calendar.timesheet_entries \
             (user_id, event_id, date, hours, category_id, auto_generated) \
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
        )
        .bind(user_id)
        .bind(event_id)
        .bind(date)
        .bind(hours)
        .bind(category_id)
        .bind(auto_generated)
        .fetch_one(self.pool.inner())
        .await?;
        Ok(row)
    }

    /// Update hours and category for an entry.
    pub async fn update(
        &self,
        id: Uuid,
        hours: f64,
        category_id: Option<Uuid>,
    ) -> Result<TimesheetEntry> {
        let row = sqlx::query_as::<_, TimesheetEntry>(
            "UPDATE calendar.timesheet_entries \
             SET hours = $2, category_id = $3 \
             WHERE id = $1 RETURNING *",
        )
        .bind(id)
        .bind(hours)
        .bind(category_id)
        .fetch_one(self.pool.inner())
        .await?;
        Ok(row)
    }

    /// Validate all entries for a user in the ISO week of a given date.
    pub async fn validate_week(&self, user_id: Uuid, week_date: chrono::NaiveDate) -> Result<u64> {
        let result = sqlx::query(
            "UPDATE calendar.timesheet_entries \
             SET validated = TRUE, validated_at = NOW() \
             WHERE user_id = $1 \
               AND date_trunc('week', date::timestamptz) = date_trunc('week', $2::timestamptz) \
               AND validated = FALSE",
        )
        .bind(user_id)
        .bind(week_date)
        .execute(self.pool.inner())
        .await?;
        Ok(result.rows_affected())
    }

    /// Mark entries as exported (set exported_at = NOW()).
    pub async fn mark_exported(&self, ids: &[Uuid]) -> Result<u64> {
        let result = sqlx::query(
            "UPDATE calendar.timesheet_entries \
             SET exported_at = NOW() \
             WHERE id = ANY($1)",
        )
        .bind(ids)
        .execute(self.pool.inner())
        .await?;
        Ok(result.rows_affected())
    }

    /// Delete a timesheet entry.
    pub async fn delete(&self, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM calendar.timesheet_entries WHERE id = $1")
            .bind(id)
            .execute(self.pool.inner())
            .await?;
        Ok(())
    }
}

// ============================================================================
// ApprovalWorkflowRepository
// ============================================================================
pub struct ApprovalWorkflowRepository<'a> {
    pool: &'a DatabasePool,
}

impl<'a> ApprovalWorkflowRepository<'a> {
    pub fn new(pool: &'a DatabasePool) -> Self {
        Self { pool }
    }

    /// List approval workflows for an org.
    pub async fn list(&self, org_id: Uuid) -> Result<Vec<ApprovalWorkflow>> {
        let rows = sqlx::query_as::<_, ApprovalWorkflow>(
            "SELECT * FROM calendar.approval_workflows WHERE org_id = $1 ORDER BY created_at DESC",
        )
        .bind(org_id)
        .fetch_all(self.pool.inner())
        .await?;
        Ok(rows)
    }

    /// Get a workflow by ID.
    pub async fn find_by_id(&self, id: Uuid) -> Result<Option<ApprovalWorkflow>> {
        let row = sqlx::query_as::<_, ApprovalWorkflow>(
            "SELECT * FROM calendar.approval_workflows WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(self.pool.inner())
        .await?;
        Ok(row)
    }

    /// Find active workflows for a given trigger type and org.
    pub async fn find_by_trigger(
        &self,
        org_id: Uuid,
        trigger_type: &str,
    ) -> Result<Vec<ApprovalWorkflow>> {
        let rows = sqlx::query_as::<_, ApprovalWorkflow>(
            "SELECT * FROM calendar.approval_workflows \
             WHERE org_id = $1 AND trigger_type = $2 AND active = TRUE \
             ORDER BY created_at",
        )
        .bind(org_id)
        .bind(trigger_type)
        .fetch_all(self.pool.inner())
        .await?;
        Ok(rows)
    }

    /// Create a new approval workflow.
    pub async fn create(&self, input: &CreateApprovalWorkflow) -> Result<ApprovalWorkflow> {
        let row = sqlx::query_as::<_, ApprovalWorkflow>(
            "INSERT INTO calendar.approval_workflows \
             (org_id, trigger_type, trigger_config, approvers) \
             VALUES ($1, $2, $3, $4) RETURNING *",
        )
        .bind(input.org_id)
        .bind(&input.trigger_type)
        .bind(&input.trigger_config)
        .bind(&input.approvers)
        .fetch_one(self.pool.inner())
        .await?;
        Ok(row)
    }

    /// Update an approval workflow.
    pub async fn update(
        &self,
        id: Uuid,
        input: &CreateApprovalWorkflow,
    ) -> Result<ApprovalWorkflow> {
        let row = sqlx::query_as::<_, ApprovalWorkflow>(
            "UPDATE calendar.approval_workflows \
             SET trigger_type = $2, trigger_config = $3, approvers = $4 \
             WHERE id = $1 RETURNING *",
        )
        .bind(id)
        .bind(&input.trigger_type)
        .bind(&input.trigger_config)
        .bind(&input.approvers)
        .fetch_one(self.pool.inner())
        .await?;
        Ok(row)
    }

    /// Toggle the active flag.
    pub async fn set_active(&self, id: Uuid, active: bool) -> Result<()> {
        sqlx::query("UPDATE calendar.approval_workflows SET active = $2 WHERE id = $1")
            .bind(id)
            .bind(active)
            .execute(self.pool.inner())
            .await?;
        Ok(())
    }

    /// Delete an approval workflow.
    pub async fn delete(&self, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM calendar.approval_workflows WHERE id = $1")
            .bind(id)
            .execute(self.pool.inner())
            .await?;
        Ok(())
    }
}
