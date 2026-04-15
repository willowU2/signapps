//! ResourceBookingRepository -- CRUD for `resources.items` and `resources.reservations`.

use crate::models::{
    CreateResourceItem, CreateResourceReservation, ResourceItem, ResourceReservation,
    UpdateResourceItem,
};
use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

/// Repository for the standalone resource booking schema (`resources.*`).
pub struct ResourceBookingRepository;

impl ResourceBookingRepository {
    // ========================================================================
    // Resource Items
    // ========================================================================

    /// List resources, optionally filtered by type and availability.
    pub async fn list_items(
        pool: &PgPool,
        resource_type: Option<&str>,
        available_only: bool,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<ResourceItem>> {
        let items = if let Some(rt) = resource_type {
            if available_only {
                sqlx::query_as::<_, ResourceItem>(
                    r#"SELECT * FROM resources.items
                       WHERE resource_type = $1 AND available = TRUE
                       ORDER BY name LIMIT $2 OFFSET $3"#,
                )
                .bind(rt)
                .bind(limit)
                .bind(offset)
                .fetch_all(pool)
                .await
            } else {
                sqlx::query_as::<_, ResourceItem>(
                    r#"SELECT * FROM resources.items
                       WHERE resource_type = $1
                       ORDER BY name LIMIT $2 OFFSET $3"#,
                )
                .bind(rt)
                .bind(limit)
                .bind(offset)
                .fetch_all(pool)
                .await
            }
        } else if available_only {
            sqlx::query_as::<_, ResourceItem>(
                r#"SELECT * FROM resources.items
                   WHERE available = TRUE
                   ORDER BY name LIMIT $1 OFFSET $2"#,
            )
            .bind(limit)
            .bind(offset)
            .fetch_all(pool)
            .await
        } else {
            sqlx::query_as::<_, ResourceItem>(
                r#"SELECT * FROM resources.items
                   ORDER BY name LIMIT $1 OFFSET $2"#,
            )
            .bind(limit)
            .bind(offset)
            .fetch_all(pool)
            .await
        }
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(items)
    }

    /// Find a resource item by ID.
    pub async fn find_item_by_id(pool: &PgPool, id: Uuid) -> Result<Option<ResourceItem>> {
        let item = sqlx::query_as::<_, ResourceItem>("SELECT * FROM resources.items WHERE id = $1")
            .bind(id)
            .fetch_optional(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(item)
    }

    /// Create a new resource item.
    pub async fn create_item(pool: &PgPool, input: CreateResourceItem) -> Result<ResourceItem> {
        let item = sqlx::query_as::<_, ResourceItem>(
            r#"INSERT INTO resources.items (name, resource_type, description, location, capacity, amenities, image_url, metadata)
               VALUES ($1, $2, $3, $4, $5, COALESCE($6, '{}'), $7, COALESCE($8, '{}'))
               RETURNING *"#,
        )
        .bind(&input.name)
        .bind(&input.resource_type)
        .bind(&input.description)
        .bind(&input.location)
        .bind(input.capacity)
        .bind(&input.amenities)
        .bind(&input.image_url)
        .bind(&input.metadata)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(item)
    }

    /// Update an existing resource item.
    pub async fn update_item(
        pool: &PgPool,
        id: Uuid,
        input: UpdateResourceItem,
    ) -> Result<ResourceItem> {
        let item = sqlx::query_as::<_, ResourceItem>(
            r#"UPDATE resources.items SET
                name = COALESCE($2, name),
                resource_type = COALESCE($3, resource_type),
                description = COALESCE($4, description),
                location = COALESCE($5, location),
                capacity = COALESCE($6, capacity),
                amenities = COALESCE($7, amenities),
                image_url = COALESCE($8, image_url),
                available = COALESCE($9, available),
                metadata = COALESCE($10, metadata),
                updated_at = NOW()
               WHERE id = $1
               RETURNING *"#,
        )
        .bind(id)
        .bind(&input.name)
        .bind(&input.resource_type)
        .bind(&input.description)
        .bind(&input.location)
        .bind(input.capacity)
        .bind(&input.amenities)
        .bind(&input.image_url)
        .bind(input.available)
        .bind(&input.metadata)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(item)
    }

    /// Delete a resource item (cascades to reservations).
    pub async fn delete_item(pool: &PgPool, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM resources.items WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }

    // ========================================================================
    // Reservations
    // ========================================================================

    /// List reservations for a specific resource.
    pub async fn list_reservations_for_resource(
        pool: &PgPool,
        resource_id: Uuid,
    ) -> Result<Vec<ResourceReservation>> {
        let rows = sqlx::query_as::<_, ResourceReservation>(
            r#"SELECT * FROM resources.reservations
               WHERE resource_id = $1
               ORDER BY starts_at DESC"#,
        )
        .bind(resource_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(rows)
    }

    /// List reservations for a user (my reservations).
    pub async fn list_reservations_for_user(
        pool: &PgPool,
        user_id: Uuid,
    ) -> Result<Vec<ResourceReservation>> {
        let rows = sqlx::query_as::<_, ResourceReservation>(
            r#"SELECT * FROM resources.reservations
               WHERE user_id = $1
               ORDER BY starts_at DESC"#,
        )
        .bind(user_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(rows)
    }

    /// Find a reservation by ID.
    pub async fn find_reservation_by_id(
        pool: &PgPool,
        id: Uuid,
    ) -> Result<Option<ResourceReservation>> {
        let row = sqlx::query_as::<_, ResourceReservation>(
            "SELECT * FROM resources.reservations WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(row)
    }

    /// Create a new reservation.
    ///
    /// The database EXCLUDE constraint prevents overlapping bookings on the
    /// same resource. If a conflict is detected, a `Database` error is returned.
    pub async fn create_reservation(
        pool: &PgPool,
        user_id: Uuid,
        input: CreateResourceReservation,
    ) -> Result<ResourceReservation> {
        let row = sqlx::query_as::<_, ResourceReservation>(
            r#"INSERT INTO resources.reservations (resource_id, user_id, title, starts_at, ends_at, notes)
               VALUES ($1, $2, $3, $4, $5, $6)
               RETURNING *"#,
        )
        .bind(input.resource_id)
        .bind(user_id)
        .bind(&input.title)
        .bind(input.starts_at)
        .bind(input.ends_at)
        .bind(&input.notes)
        .fetch_one(pool)
        .await
        .map_err(|e| {
            // Detect EXCLUDE constraint violation for user-friendly error
            let msg = e.to_string();
            if msg.contains("conflicting key value violates exclusion constraint")
                || msg.contains("excludes")
            {
                Error::Conflict(
                    "Time slot conflicts with an existing reservation".to_string(),
                )
            } else {
                Error::Database(msg)
            }
        })?;
        Ok(row)
    }

    /// Cancel a reservation (set status to `cancelled`).
    pub async fn cancel_reservation(pool: &PgPool, id: Uuid) -> Result<()> {
        let result =
            sqlx::query("UPDATE resources.reservations SET status = 'cancelled' WHERE id = $1")
                .bind(id)
                .execute(pool)
                .await
                .map_err(|e| Error::Database(e.to_string()))?;
        if result.rows_affected() == 0 {
            return Err(Error::NotFound(format!("Reservation {}", id)));
        }
        Ok(())
    }
}
