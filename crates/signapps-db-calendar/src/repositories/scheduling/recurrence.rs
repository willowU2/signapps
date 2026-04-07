//! RecurrenceRuleRepository — recurrence rule CRUD operations.

use crate::models::{RecurrenceRule, RecurrenceRuleInput};
use signapps_db_shared::DatabasePool;
use chrono::{DateTime, Utc};
use signapps_common::Result;
use uuid::Uuid;

/// Repository for recurrence rule CRUD operations.
pub struct RecurrenceRuleRepository<'a> {
    pool: &'a DatabasePool,
}

impl<'a> RecurrenceRuleRepository<'a> {
    pub fn new(pool: &'a DatabasePool) -> Self {
        Self { pool }
    }

    /// Find recurrence rule for a time item.
    pub async fn find_by_time_item(&self, time_item_id: Uuid) -> Result<Option<RecurrenceRule>> {
        let rule = sqlx::query_as::<_, RecurrenceRule>(
            "SELECT * FROM scheduling.recurrence_rules WHERE time_item_id = $1",
        )
        .bind(time_item_id)
        .fetch_optional(self.pool.inner())
        .await?;

        Ok(rule)
    }

    /// Create a recurrence rule.
    pub async fn create(
        &self,
        time_item_id: Uuid,
        rule: RecurrenceRuleInput,
    ) -> Result<RecurrenceRule> {
        let created = sqlx::query_as::<_, RecurrenceRule>(
            r#"
            INSERT INTO scheduling.recurrence_rules (
                time_item_id, frequency, interval_value, days_of_week,
                day_of_month, month_of_year, week_of_month, end_date, occurrence_count
            )
            VALUES ($1, $2, COALESCE($3, 1), COALESCE($4, '{}'), $5, $6, $7, $8, $9)
            ON CONFLICT (time_item_id) DO UPDATE SET
                frequency = $2,
                interval_value = COALESCE($3, 1),
                days_of_week = COALESCE($4, '{}'),
                day_of_month = $5,
                month_of_year = $6,
                week_of_month = $7,
                end_date = $8,
                occurrence_count = $9,
                updated_at = NOW()
            RETURNING *
            "#,
        )
        .bind(time_item_id)
        .bind(&rule.frequency)
        .bind(rule.interval)
        .bind(rule.days_of_week.clone().unwrap_or_default())
        .bind(rule.day_of_month)
        .bind(rule.month_of_year)
        .bind(rule.week_of_month)
        .bind(rule.end_date)
        .bind(rule.count)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(created)
    }

    /// Add an exception date.
    pub async fn add_exception(
        &self,
        time_item_id: Uuid,
        exception_date: DateTime<Utc>,
    ) -> Result<()> {
        sqlx::query(
            "UPDATE scheduling.recurrence_rules SET exceptions = array_append(exceptions, $2), updated_at = NOW() WHERE time_item_id = $1",
        )
        .bind(time_item_id)
        .bind(exception_date)
        .execute(self.pool.inner())
        .await?;

        Ok(())
    }

    /// Delete recurrence rule.
    pub async fn delete(&self, time_item_id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM scheduling.recurrence_rules WHERE time_item_id = $1")
            .bind(time_item_id)
            .execute(self.pool.inner())
            .await?;

        Ok(())
    }
}
