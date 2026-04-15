//! Scheduled maintenance worker.
//!
//! Polls the `scheduled_maintenance` table every 30 seconds. For each window
//! whose status is `scheduled` and whose `scheduled_at` is due, enables the
//! maintenance flag and transitions to `active`. For windows that are `active`
//! and whose `scheduled_at + duration_minutes` has elapsed, disables the flag
//! and transitions to `completed`.
//!
//! This worker is its own binary (`signapps-deploy-scheduler`) so it runs as
//! a long-lived process — typically a systemd service or a supervisor job
//! separate from the deploy CLI.
//!
//! Since P3c.3, the maintenance flag is stored in the shared `maintenance_flags`
//! table (migration 309) and is therefore visible to the proxy on every request.

use crate::maintenance;
use anyhow::{Context, Result};
use chrono::{DateTime, Duration as ChronoDuration, Utc};
use sqlx::PgPool;
use std::time::Duration;
use tokio::time::sleep;
use uuid::Uuid;

const POLL_INTERVAL: Duration = Duration::from_secs(30);

/// Runtime dependencies for the scheduler loop.
pub struct SchedulerDeps {
    /// Shared Postgres pool used for both the `scheduled_maintenance` table
    /// and the `maintenance_flags` row that the proxy reads.
    pub pool: PgPool,
}

#[derive(Debug)]
struct Window {
    id: Uuid,
    env: String,
    scheduled_at: DateTime<Utc>,
    duration_minutes: i32,
    status: String,
}

async fn fetch_active_or_due_windows(pool: &PgPool) -> Result<Vec<Window>> {
    let rows: Vec<(Uuid, String, DateTime<Utc>, i32, String)> = sqlx::query_as(
        "SELECT id, env, scheduled_at, duration_minutes, status \
         FROM scheduled_maintenance \
         WHERE status IN ('scheduled', 'active') \
           AND scheduled_at <= now() + interval '1 minute' \
         ORDER BY scheduled_at ASC",
    )
    .fetch_all(pool)
    .await
    .context("fetch scheduled maintenance")?;

    Ok(rows
        .into_iter()
        .map(|(id, env, scheduled_at, duration_minutes, status)| Window {
            id,
            env,
            scheduled_at,
            duration_minutes,
            status,
        })
        .collect())
}

async fn start_window(pool: &PgPool, w: &Window) -> Result<()> {
    maintenance::enable(pool, &w.env).await?;
    sqlx::query(
        "UPDATE scheduled_maintenance SET status = 'active', started_at = now() WHERE id = $1",
    )
    .bind(w.id)
    .execute(pool)
    .await
    .context("mark window active")?;
    tracing::warn!(env = %w.env, id = %w.id, "maintenance window ACTIVATED");
    Ok(())
}

async fn end_window(pool: &PgPool, w: &Window) -> Result<()> {
    maintenance::disable(pool, &w.env).await?;
    sqlx::query(
        "UPDATE scheduled_maintenance SET status = 'completed', completed_at = now() WHERE id = $1",
    )
    .bind(w.id)
    .execute(pool)
    .await
    .context("mark window completed")?;
    tracing::info!(env = %w.env, id = %w.id, "maintenance window COMPLETED");
    Ok(())
}

async fn tick(deps: &SchedulerDeps) -> Result<()> {
    let now = Utc::now();
    for w in fetch_active_or_due_windows(&deps.pool).await? {
        let end = w.scheduled_at + ChronoDuration::minutes(w.duration_minutes as i64);
        match w.status.as_str() {
            "scheduled" if w.scheduled_at <= now => {
                start_window(&deps.pool, &w).await?;
            },
            "active" if end <= now => {
                end_window(&deps.pool, &w).await?;
            },
            _ => { /* not time yet or already handled */ },
        }
    }
    Ok(())
}

/// Run the scheduler loop forever. Poll every [`POLL_INTERVAL`].
pub async fn run(deps: SchedulerDeps) -> Result<()> {
    tracing::info!("scheduled maintenance worker starting");
    loop {
        if let Err(e) = tick(&deps).await {
            tracing::error!(error = %e, "scheduler tick failed, will retry");
        }
        sleep(POLL_INTERVAL).await;
    }
}
