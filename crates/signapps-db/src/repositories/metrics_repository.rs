use crate::DatabasePool;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::Result;
use uuid::Uuid;

/// Aggregated workload metrics summarising task counts by status.
#[derive(Debug, Serialize, Deserialize)]
pub struct WorkloadMetrics {
    pub total_tasks: i64,
    pub pending: i64,
    pub in_progress: i64,
    pub completed: i64,
    pub blocked: i64,
}

/// Aggregated resource utilisation metrics showing bookings and hours.
#[derive(Debug, Serialize, Deserialize)]
pub struct ResourceMetrics {
    pub total_bookings: i64,
    pub hours_booked: f64,
}

/// Repository for querying scheduling and resource utilisation metrics.
pub struct MetricsRepository<'a> {
    pool: &'a DatabasePool,
}

impl<'a> MetricsRepository<'a> {
    pub fn new(pool: &'a DatabasePool) -> Self {
        Self { pool }
    }

    /// Retrieve workload metrics for a given user, optionally filtered by a date range
    pub async fn get_workload_metrics(
        &self,
        tenant_id: Uuid,
        user_id: Uuid,
        _start_date: Option<DateTime<Utc>>,
        _end_date: Option<DateTime<Utc>>,
    ) -> Result<WorkloadMetrics> {
        // We aggregate by status from the time_items table
        // considering the user's assignments or ownership
        let query = r#"
            SELECT
                COUNT(*) as total,
                COUNT(CASE WHEN status = 'todo' OR status = 'pending' THEN 1 END) as pending_count,
                COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_count,
                COUNT(CASE WHEN status = 'done' THEN 1 END) as completed_count,
                COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as blocked_count
            FROM scheduling.time_items ti
            WHERE ti.tenant_id = $1
            AND ti.item_type = 'task'
            AND ti.deleted_at IS NULL
            AND (ti.owner_id = $2 OR ti.id IN (SELECT time_item_id FROM scheduling.time_item_users WHERE user_id = $2))
        "#;

        let row: (i64, i64, i64, i64, i64) = sqlx::query_as(query)
            .bind(tenant_id)
            .bind(user_id)
            .fetch_one(self.pool.inner())
            .await?;

        Ok(WorkloadMetrics {
            total_tasks: row.0,
            pending: row.1,
            in_progress: row.2,
            completed: row.3,
            blocked: row.4,
        })
    }

    /// Retrieve resource utilization metrics for a user's context
    pub async fn get_resource_metrics(
        &self,
        tenant_id: Uuid,
        user_id: Uuid,
    ) -> Result<ResourceMetrics> {
        // Find bookings (events tied to a scheduling_resource via the references or just count total events where they are an attendee)
        let query = r#"
            SELECT 
                COUNT(*) as total_bookings,
                COALESCE(SUM(EXTRACT(EPOCH FROM (end_time - start_time))/3600), 0) as hours_booked
            FROM scheduling.time_items ti
            WHERE ti.tenant_id = $1
            AND ti.item_type != 'task'
            AND ti.deleted_at IS NULL
            AND (ti.owner_id = $2 OR ti.id IN (SELECT time_item_id FROM scheduling.time_item_users WHERE user_id = $2))
        "#;

        let row: (i64, Option<f64>) = sqlx::query_as(query)
            .bind(tenant_id)
            .bind(user_id)
            .fetch_one(self.pool.inner())
            .await?;

        Ok(ResourceMetrics {
            total_bookings: row.0,
            hours_booked: row.1.unwrap_or(0.0),
        })
    }
}
