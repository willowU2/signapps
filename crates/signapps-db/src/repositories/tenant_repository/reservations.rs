//! ReservationRepository — resource reservation operations.

use crate::models::{CreateReservation, Reservation, UpdateReservationStatus};
use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

/// Repository for reservation operations.
pub struct ReservationRepository;

impl ReservationRepository {
    /// Find reservation by ID.
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Option<Reservation>> {
        let reservation =
            sqlx::query_as::<_, Reservation>("SELECT * FROM calendar.reservations WHERE id = $1")
                .bind(id)
                .fetch_optional(pool)
                .await
                .map_err(|e| Error::Database(e.to_string()))?;
        Ok(reservation)
    }

    /// List reservations for a resource.
    pub async fn list_by_resource(
        pool: &PgPool,
        resource_id: Uuid,
        status: Option<&str>,
    ) -> Result<Vec<Reservation>> {
        let reservations = if let Some(s) = status {
            sqlx::query_as::<_, Reservation>(
                "SELECT * FROM calendar.reservations WHERE resource_id = $1 AND status = $2 ORDER BY created_at DESC",
            )
            .bind(resource_id)
            .bind(s)
            .fetch_all(pool)
            .await
        } else {
            sqlx::query_as::<_, Reservation>(
                "SELECT * FROM calendar.reservations WHERE resource_id = $1 ORDER BY created_at DESC",
            )
            .bind(resource_id)
            .fetch_all(pool)
            .await
        }
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(reservations)
    }

    /// List pending reservations for approval.
    pub async fn list_pending_for_approver(
        pool: &PgPool,
        approver_id: Uuid,
    ) -> Result<Vec<Reservation>> {
        let reservations = sqlx::query_as::<_, Reservation>(
            r#"
            SELECT r.* FROM calendar.reservations r
            INNER JOIN calendar.tenant_resources tr ON r.resource_id = tr.id
            WHERE r.status = 'pending' AND $1 = ANY(tr.approver_ids)
            ORDER BY r.created_at
            "#,
        )
        .bind(approver_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(reservations)
    }

    /// List reservations for a user (my reservations).
    pub async fn list_by_user(
        pool: &PgPool,
        user_id: Uuid,
        status: Option<&str>,
    ) -> Result<Vec<Reservation>> {
        let reservations = if let Some(s) = status {
            sqlx::query_as::<_, Reservation>(
                "SELECT * FROM calendar.reservations WHERE requested_by = $1 AND status = $2 ORDER BY created_at DESC",
            )
            .bind(user_id)
            .bind(s)
            .fetch_all(pool)
            .await
        } else {
            sqlx::query_as::<_, Reservation>(
                "SELECT * FROM calendar.reservations WHERE requested_by = $1 ORDER BY created_at DESC",
            )
            .bind(user_id)
            .fetch_all(pool)
            .await
        }
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(reservations)
    }

    /// Create a new reservation.
    pub async fn create(
        pool: &PgPool,
        tenant_id: Uuid,
        requested_by: Uuid,
        reservation: CreateReservation,
    ) -> Result<Reservation> {
        // Check if resource requires approval
        let requires_approval: (bool,) =
            sqlx::query_as("SELECT requires_approval FROM calendar.tenant_resources WHERE id = $1")
                .bind(reservation.resource_id)
                .fetch_one(pool)
                .await
                .map_err(|e| Error::Database(e.to_string()))?;

        let status = if requires_approval.0 {
            "pending"
        } else {
            "approved"
        };

        let created = sqlx::query_as::<_, Reservation>(
            r#"
            INSERT INTO calendar.reservations (tenant_id, resource_id, event_id, requested_by, status, notes)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
            "#,
        )
        .bind(tenant_id)
        .bind(reservation.resource_id)
        .bind(reservation.event_id)
        .bind(requested_by)
        .bind(status)
        .bind(&reservation.notes)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(created)
    }

    /// Update reservation status (approve/reject/cancel).
    pub async fn update_status(
        pool: &PgPool,
        id: Uuid,
        approver_id: Uuid,
        update: UpdateReservationStatus,
    ) -> Result<Reservation> {
        let updated = sqlx::query_as::<_, Reservation>(
            r#"
            UPDATE calendar.reservations
            SET status = $2,
                approved_by = $3,
                approved_at = CASE WHEN $2 IN ('approved', 'rejected') THEN NOW() ELSE approved_at END,
                rejection_reason = $4,
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(&update.status)
        .bind(approver_id)
        .bind(&update.rejection_reason)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(updated)
    }
}
