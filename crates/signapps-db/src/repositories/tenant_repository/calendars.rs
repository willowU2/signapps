//! TenantCalendarRepository — tenant calendar operations.

use crate::models::{CreateTenantCalendar, TenantCalendar};
use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

/// Repository for tenant calendar operations.
pub struct TenantCalendarRepository;

impl TenantCalendarRepository {
    /// Find calendar by ID.
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Option<TenantCalendar>> {
        let calendar =
            sqlx::query_as::<_, TenantCalendar>("SELECT * FROM calendar.calendars WHERE id = $1")
                .bind(id)
                .fetch_optional(pool)
                .await
                .map_err(|e| Error::Database(e.to_string()))?;
        Ok(calendar)
    }

    /// List calendars for a tenant.
    pub async fn list_by_tenant(
        pool: &PgPool,
        tenant_id: Uuid,
        calendar_type: Option<&str>,
    ) -> Result<Vec<TenantCalendar>> {
        let calendars = if let Some(ct) = calendar_type {
            sqlx::query_as::<_, TenantCalendar>(
                "SELECT * FROM calendar.calendars WHERE tenant_id = $1 AND calendar_type = $2 ORDER BY name",
            )
            .bind(tenant_id)
            .bind(ct)
            .fetch_all(pool)
            .await
        } else {
            sqlx::query_as::<_, TenantCalendar>(
                "SELECT * FROM calendar.calendars WHERE tenant_id = $1 ORDER BY name",
            )
            .bind(tenant_id)
            .fetch_all(pool)
            .await
        }
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(calendars)
    }

    /// List calendars for a user (owned + shared via signapps-sharing grants).
    pub async fn list_by_user(pool: &PgPool, user_id: Uuid) -> Result<Vec<TenantCalendar>> {
        let calendars = sqlx::query_as::<_, TenantCalendar>(
            r#"
            SELECT DISTINCT c.* FROM calendar.calendars c
            LEFT JOIN sharing.grants g
                ON g.resource_type = 'calendar'
                AND g.resource_id = c.id
                AND g.grantee_type = 'user'
                AND g.grantee_id = $1
                AND (g.expires_at IS NULL OR g.expires_at > NOW())
            WHERE c.owner_id = $1 OR g.id IS NOT NULL OR c.is_public = TRUE
            ORDER BY c.is_default DESC, c.name
            "#,
        )
        .bind(user_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(calendars)
    }

    /// Create a new calendar.
    pub async fn create(
        pool: &PgPool,
        tenant_id: Uuid,
        owner_id: Uuid,
        calendar: CreateTenantCalendar,
    ) -> Result<TenantCalendar> {
        let created = sqlx::query_as::<_, TenantCalendar>(
            r#"
            INSERT INTO calendar.calendars (
                tenant_id, workspace_id, owner_id, name, description, timezone, color,
                calendar_type, is_shared, is_public
            )
            VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'UTC'), COALESCE($7, '#3B82F6'),
                    COALESCE($8, 'personal'), COALESCE($9, FALSE), COALESCE($10, FALSE))
            RETURNING *
            "#,
        )
        .bind(tenant_id)
        .bind(calendar.workspace_id)
        .bind(owner_id)
        .bind(&calendar.name)
        .bind(&calendar.description)
        .bind(&calendar.timezone)
        .bind(&calendar.color)
        .bind(&calendar.calendar_type)
        .bind(calendar.is_shared)
        .bind(calendar.is_public)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(created)
    }

    /// Delete a calendar.
    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM calendar.calendars WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }
}
