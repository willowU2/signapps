//! Shared seed helpers — re-used across all seeding modules.

use chrono::{NaiveDate, TimeZone, Utc};
use tracing::info;
use uuid::Uuid;

/// Ensures a calendar exists in `calendar.calendars` for the given owner.
///
/// Uses `ON CONFLICT DO NOTHING` for idempotency. Returns the generated UUID
/// (which may not be the actual row UUID if a conflict was ignored, but the
/// caller only needs it for subsequent operations within the same seed run).
///
/// # Errors
///
/// Returns an error if the database query fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
pub async fn ensure_calendar(
    pool: &sqlx::PgPool,
    owner_id: Uuid,
    name: &str,
) -> Result<Uuid, Box<dyn std::error::Error>> {
    let id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO calendar.calendars
            (id, owner_id, name, timezone, created_at, updated_at)
        VALUES ($1, $2, $3, 'Europe/Paris', NOW(), NOW())
        ON CONFLICT DO NOTHING
        "#,
    )
    .bind(id)
    .bind(owner_id)
    .bind(name)
    .execute(pool)
    .await?;

    info!(calendar_id = %id, owner_id = %owner_id, name, "calendar ensured");
    Ok(id)
}

/// Parameters for inserting a `scheduling.time_item`.
///
/// All NOT NULL columns must be provided. Optional columns can be `None`.
pub struct TimeItemParams<'a> {
    pub item_type: &'a str,
    pub title: &'a str,
    pub tenant_id: Uuid,
    pub owner_id: Uuid,
    pub created_by: Uuid,
    /// Offset in days from today for start_time (None = no start_time).
    pub start_day_offset: Option<i32>,
    /// Start hour (0–23), used together with `start_day_offset`.
    pub start_hour: Option<i32>,
    /// Duration in minutes (0 = no duration / all-day tasks).
    pub duration_minutes: i32,
    pub all_day: bool,
    pub scope: &'a str,
    pub visibility: &'a str,
    pub status: &'a str,
    pub priority: &'a str,
    /// Optional project foreign key.
    pub project_id: Option<Uuid>,
    /// Optional calendar foreign key.
    pub calendar_id: Option<Uuid>,
    /// Deadline offset in days from today (None = no deadline).
    pub deadline_day_offset: Option<i32>,
}

/// Inserts a single row into `scheduling.time_items`.
///
/// Uses `ON CONFLICT DO NOTHING` for idempotency.
///
/// # Errors
///
/// Returns an error if the database query fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
pub async fn insert_time_item(
    pool: &sqlx::PgPool,
    p: TimeItemParams<'_>,
) -> Result<Uuid, Box<dyn std::error::Error>> {
    let id = Uuid::new_v4();

    // Build start_time and end_time SQL fragments
    let (start_sql, end_sql) = match (p.start_day_offset, p.start_hour) {
        (Some(day), Some(hour)) => {
            let start = format!(
                "DATE_TRUNC('day', NOW()) + INTERVAL '{day} days' + INTERVAL '{hour}:00:00'"
            );
            let end = format!(
                "DATE_TRUNC('day', NOW()) + INTERVAL '{day} days' + INTERVAL '{hour}:00:00' + INTERVAL '{} minutes'",
                p.duration_minutes
            );
            (format!("{start}"), format!("{end}"))
        }
        _ => ("NULL".to_string(), "NULL".to_string()),
    };

    let deadline_sql = match p.deadline_day_offset {
        Some(d) => format!("NOW() + INTERVAL '{d} days'"),
        None => "NULL".to_string(),
    };

    // calendar_id does not exist as a column in scheduling.time_items — silently ignored.
    let _ = p.calendar_id;

    // Use string formatting for computed SQL expressions
    let sql = format!(
        r#"
        INSERT INTO scheduling.time_items
            (id, item_type, title, tenant_id, owner_id, created_by,
             start_time, end_time, duration_minutes, all_day,
             scope, visibility, status, priority,
             project_id, deadline,
             created_at, updated_at)
        VALUES
            ($1, $2, $3, $4, $5, $6,
             {start_sql}, {end_sql}, $7, $8,
             $9, $10, $11, $12,
             $13, {deadline_sql},
             NOW(), NOW())
        ON CONFLICT DO NOTHING
        "#
    );

    sqlx::query(&sql)
        .bind(id)
        .bind(p.item_type)
        .bind(p.title)
        .bind(p.tenant_id)
        .bind(p.owner_id)
        .bind(p.created_by)
        .bind(p.duration_minutes)
        .bind(p.all_day)
        .bind(p.scope)
        .bind(p.visibility)
        .bind(p.status)
        .bind(p.priority)
        .bind(p.project_id)
        .execute(pool)
        .await?;

    Ok(id)
}

/// Picks an element from a slice using modulo arithmetic.
///
/// Never panics — panics only if `items` is empty (which is a caller bug).
///
/// # Panics
///
/// Panics if `items` is empty.
pub fn pick<T>(items: &[T], index: usize) -> &T {
    &items[index % items.len()]
}

/// Returns a `NaiveDate` for day-of-year `ordinal` in 2026 (1-based).
///
/// Clamps to valid range: 1–365.
///
/// # Panics
///
/// No panics — ordinal is clamped before use.
#[allow(dead_code)]
pub fn date_2026(ordinal: u32) -> NaiveDate {
    let clamped = ordinal.clamp(1, 365);
    NaiveDate::from_yo_opt(2026, clamped).unwrap_or_else(|| NaiveDate::from_ymd_opt(2026, 1, 1).expect("valid date"))
}

/// Combines a `NaiveDate` with an hour to produce a UTC `DateTime`.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[allow(dead_code)]
pub fn datetime_at(date: NaiveDate, hour: u32) -> chrono::DateTime<Utc> {
    let naive = date.and_hms_opt(hour, 0, 0).unwrap_or_else(|| date.and_hms_opt(0, 0, 0).expect("valid time"));
    Utc.from_utc_datetime(&naive)
}
