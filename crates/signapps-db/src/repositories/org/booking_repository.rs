//! CRUD for `org_site_bookings` — SO7 réservations.
//!
//! A booking reserves a site (typically a `room` or `desk`) for a person
//! between `start_at` and `end_at`. Conflicts are detected via the
//! overlapping-range predicate : `NOT (existing.end_at <= new.start_at
//! OR existing.start_at >= new.end_at)` on status = 'confirmed'.

use anyhow::Result;
use chrono::{DateTime, NaiveDate, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::org::{BookingStatus, SiteBooking};

/// One bucket of the occupancy heatmap.
///
/// Ready for `utoipa::ToSchema` via the `openapi` feature on the crate.
#[derive(Debug, Clone, serde::Serialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct OccupancyBucket {
    /// Identifier of the bucket (ISO date for day granularity, hour
    /// stamp `YYYY-MM-DD HH:00` for hour granularity).
    pub key: String,
    /// Number of confirmed bookings overlapping the bucket.
    pub count: i64,
}

/// Repository for `org_site_bookings`.
pub struct BookingRepository<'a> {
    pool: &'a PgPool,
}

impl<'a> BookingRepository<'a> {
    /// Construct a new repository bound to the given pool.
    pub fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    /// Insert a new booking.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error (FK violation, CHECK
    /// `end_at > start_at`...).
    #[allow(clippy::too_many_arguments)]
    pub async fn create(
        &self,
        site_id: Uuid,
        person_id: Uuid,
        start_at: DateTime<Utc>,
        end_at: DateTime<Utc>,
        purpose: Option<&str>,
        status: BookingStatus,
        meet_room_id: Option<Uuid>,
    ) -> Result<SiteBooking> {
        let row = sqlx::query_as::<_, SiteBooking>(
            r#"INSERT INTO org_site_bookings
                (site_id, person_id, start_at, end_at, purpose, status, meet_room_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *"#,
        )
        .bind(site_id)
        .bind(person_id)
        .bind(start_at)
        .bind(end_at)
        .bind(purpose)
        .bind(status.as_str())
        .bind(meet_room_id)
        .fetch_one(self.pool)
        .await?;
        Ok(row)
    }

    /// Fetch one booking by id.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn get(&self, id: Uuid) -> Result<Option<SiteBooking>> {
        let row = sqlx::query_as::<_, SiteBooking>(
            "SELECT * FROM org_site_bookings WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(self.pool)
        .await?;
        Ok(row)
    }

    /// List bookings for a site between two timestamps.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn list_by_site(
        &self,
        site_id: Uuid,
        since: DateTime<Utc>,
        until: DateTime<Utc>,
    ) -> Result<Vec<SiteBooking>> {
        let rows = sqlx::query_as::<_, SiteBooking>(
            r#"SELECT * FROM org_site_bookings
                WHERE site_id = $1
                  AND end_at   > $2
                  AND start_at < $3
                ORDER BY start_at"#,
        )
        .bind(site_id)
        .bind(since)
        .bind(until)
        .fetch_all(self.pool)
        .await?;
        Ok(rows)
    }

    /// List upcoming confirmed bookings for a person.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn list_upcoming_for_person(
        &self,
        person_id: Uuid,
        now: DateTime<Utc>,
    ) -> Result<Vec<SiteBooking>> {
        let rows = sqlx::query_as::<_, SiteBooking>(
            r#"SELECT * FROM org_site_bookings
                WHERE person_id = $1
                  AND status = 'confirmed'
                  AND end_at > $2
                ORDER BY start_at
                LIMIT 100"#,
        )
        .bind(person_id)
        .bind(now)
        .fetch_all(self.pool)
        .await?;
        Ok(rows)
    }

    /// Detect any conflicting *confirmed* booking for a site in the
    /// requested range (overlap test). Used on POST before insert.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn has_conflict(
        &self,
        site_id: Uuid,
        start_at: DateTime<Utc>,
        end_at: DateTime<Utc>,
    ) -> Result<bool> {
        let row: Option<(i64,)> = sqlx::query_as(
            r#"SELECT 1::int8
                FROM org_site_bookings
               WHERE site_id = $1
                 AND status = 'confirmed'
                 AND NOT (end_at <= $2 OR start_at >= $3)
               LIMIT 1"#,
        )
        .bind(site_id)
        .bind(start_at)
        .bind(end_at)
        .fetch_optional(self.pool)
        .await?;
        Ok(row.is_some())
    }

    /// Cancel a booking.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn cancel(&self, id: Uuid) -> Result<bool> {
        let res = sqlx::query(
            "UPDATE org_site_bookings
                SET status = 'cancelled', updated_at = now()
              WHERE id = $1 AND status <> 'cancelled'",
        )
        .bind(id)
        .execute(self.pool)
        .await?;
        Ok(res.rows_affected() > 0)
    }

    /// Get the list of already-booked 15-minute slots for a site on a
    /// given UTC date. Returned as tuples `(start, end)` — callers
    /// compose availability by subtracting from a free day.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn day_bookings(
        &self,
        site_id: Uuid,
        day: NaiveDate,
    ) -> Result<Vec<SiteBooking>> {
        let since = day.and_hms_opt(0, 0, 0).unwrap_or_default().and_utc();
        let until = since + chrono::Duration::days(1);
        self.list_by_site(site_id, since, until).await
    }

    /// Occupancy aggregated per bucket. Two granularities :
    ///
    /// - `"day"`  : date_trunc('day',  start_at) → `YYYY-MM-DD`
    /// - `"hour"` : date_trunc('hour', start_at) → `YYYY-MM-DD HH:00`
    ///
    /// Invalid granularity strings are rejected.
    ///
    /// # Errors
    ///
    /// Returns an error for unknown granularities or the underlying sqlx
    /// error.
    pub async fn occupancy(
        &self,
        site_id: Uuid,
        since: DateTime<Utc>,
        until: DateTime<Utc>,
        granularity: &str,
    ) -> Result<Vec<OccupancyBucket>> {
        let (bucket_expr, fmt) = match granularity {
            "day" => ("date_trunc('day', start_at)", "YYYY-MM-DD"),
            "hour" => ("date_trunc('hour', start_at)", "YYYY-MM-DD HH24:00"),
            other => return Err(anyhow::anyhow!("unknown granularity: {other}")),
        };
        let sql = format!(
            r#"SELECT to_char({bucket_expr}, '{fmt}') AS key,
                      COUNT(*)::int8 AS count
                 FROM org_site_bookings
                WHERE site_id = $1
                  AND status = 'confirmed'
                  AND end_at   > $2
                  AND start_at < $3
                GROUP BY 1
                ORDER BY 1"#
        );
        let rows: Vec<(String, i64)> = sqlx::query_as(&sql)
            .bind(site_id)
            .bind(since)
            .bind(until)
            .fetch_all(self.pool)
            .await?;
        Ok(rows
            .into_iter()
            .map(|(key, count)| OccupancyBucket { key, count })
            .collect())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn overlap_predicate_semantics() {
        // Sanity check of the NOT (end <= a OR start >= b) predicate.
        // Given a booking 10:00-12:00, test conflicts.
        let a = 10;
        let b = 12;
        let conflict = |s: i32, e: i32| !(b <= s || a >= e);
        assert!(conflict(11, 13), "overlap right");
        assert!(conflict(9, 11), "overlap left");
        assert!(conflict(11, 11 + 1), "inside");
        assert!(!conflict(12, 13), "exact end boundary => no conflict");
        assert!(!conflict(8, 10), "exact start boundary => no conflict");
    }
}
