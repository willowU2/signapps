//! External Calendar Sync repository for database operations.

use crate::models::*;
use crate::DatabasePool;
use chrono::Utc;
use signapps_common::Result;
use uuid::Uuid;

// ============================================================================
// Provider Connection Repository
// ============================================================================
pub struct ProviderConnectionRepository<'a> {
    pool: &'a DatabasePool,
}

impl<'a> ProviderConnectionRepository<'a> {
    pub fn new(pool: &'a DatabasePool) -> Self {
        Self { pool }
    }

    /// Find connection by ID.
    pub async fn find_by_id(&self, id: Uuid) -> Result<Option<ProviderConnection>> {
        let conn = sqlx::query_as::<_, ProviderConnection>(
            "SELECT * FROM calendar.provider_connections WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(self.pool.inner())
        .await?;

        Ok(conn)
    }

    /// Find connection by user and provider.
    pub async fn find_by_user_provider(
        &self,
        user_id: Uuid,
        provider: &str,
    ) -> Result<Option<ProviderConnection>> {
        let conn = sqlx::query_as::<_, ProviderConnection>(
            "SELECT * FROM calendar.provider_connections WHERE user_id = $1 AND provider = $2",
        )
        .bind(user_id)
        .bind(provider)
        .fetch_optional(self.pool.inner())
        .await?;

        Ok(conn)
    }

    /// List all connections for a user.
    pub async fn list_for_user(&self, user_id: Uuid) -> Result<Vec<ProviderConnection>> {
        let conns = sqlx::query_as::<_, ProviderConnection>(
            "SELECT * FROM calendar.provider_connections WHERE user_id = $1 ORDER BY created_at DESC",
        )
        .bind(user_id)
        .fetch_all(self.pool.inner())
        .await?;

        Ok(conns)
    }

    /// Create a new connection.
    pub async fn create(
        &self,
        user_id: Uuid,
        conn: CreateProviderConnection,
    ) -> Result<ProviderConnection> {
        let created = sqlx::query_as::<_, ProviderConnection>(
            r#"
            INSERT INTO calendar.provider_connections
                (user_id, provider, access_token, refresh_token, token_expires_at,
                 account_email, account_name, caldav_url, caldav_username)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (user_id, provider) DO UPDATE SET
                access_token = EXCLUDED.access_token,
                refresh_token = COALESCE(EXCLUDED.refresh_token, calendar.provider_connections.refresh_token),
                token_expires_at = EXCLUDED.token_expires_at,
                account_email = COALESCE(EXCLUDED.account_email, calendar.provider_connections.account_email),
                account_name = COALESCE(EXCLUDED.account_name, calendar.provider_connections.account_name),
                is_connected = true,
                sync_status = 'idle',
                sync_error = NULL,
                updated_at = NOW()
            RETURNING *
            "#,
        )
        .bind(user_id)
        .bind(&conn.provider)
        .bind(&conn.access_token)
        .bind(&conn.refresh_token)
        .bind(conn.token_expires_at)
        .bind(&conn.account_email)
        .bind(&conn.account_name)
        .bind(&conn.caldav_url)
        .bind(&conn.caldav_username)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(created)
    }

    /// Update connection tokens.
    pub async fn update_tokens(
        &self,
        id: Uuid,
        access_token: &str,
        refresh_token: Option<&str>,
        expires_at: Option<chrono::DateTime<Utc>>,
    ) -> Result<ProviderConnection> {
        let updated = sqlx::query_as::<_, ProviderConnection>(
            r#"
            UPDATE calendar.provider_connections SET
                access_token = $2,
                refresh_token = COALESCE($3, refresh_token),
                token_expires_at = $4,
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(access_token)
        .bind(refresh_token)
        .bind(expires_at)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(updated)
    }

    /// Update sync status.
    pub async fn update_sync_status(
        &self,
        id: Uuid,
        status: &str,
        error: Option<&str>,
    ) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE calendar.provider_connections SET
                sync_status = $2,
                sync_error = $3,
                last_sync_at = CASE WHEN $2 = 'idle' AND $3 IS NULL THEN NOW() ELSE last_sync_at END,
                updated_at = NOW()
            WHERE id = $1
            "#,
        )
        .bind(id)
        .bind(status)
        .bind(error)
        .execute(self.pool.inner())
        .await?;

        Ok(())
    }

    /// Disconnect (soft delete).
    pub async fn disconnect(&self, id: Uuid) -> Result<()> {
        sqlx::query(
            "UPDATE calendar.provider_connections SET is_connected = false, updated_at = NOW() WHERE id = $1",
        )
        .bind(id)
        .execute(self.pool.inner())
        .await?;

        Ok(())
    }

    /// Delete connection.
    pub async fn delete(&self, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM calendar.provider_connections WHERE id = $1")
            .bind(id)
            .execute(self.pool.inner())
            .await?;

        Ok(())
    }
}

// ============================================================================
// External Calendar Repository
// ============================================================================
pub struct ExternalCalendarRepository<'a> {
    pool: &'a DatabasePool,
}

impl<'a> ExternalCalendarRepository<'a> {
    pub fn new(pool: &'a DatabasePool) -> Self {
        Self { pool }
    }

    /// Find by ID.
    pub async fn find_by_id(&self, id: Uuid) -> Result<Option<ExternalCalendar>> {
        let cal = sqlx::query_as::<_, ExternalCalendar>(
            "SELECT * FROM calendar.external_calendars WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(self.pool.inner())
        .await?;

        Ok(cal)
    }

    /// List calendars for a connection.
    pub async fn list_for_connection(&self, connection_id: Uuid) -> Result<Vec<ExternalCalendar>> {
        let cals = sqlx::query_as::<_, ExternalCalendar>(
            "SELECT * FROM calendar.external_calendars WHERE connection_id = $1 ORDER BY is_primary DESC, name",
        )
        .bind(connection_id)
        .fetch_all(self.pool.inner())
        .await?;

        Ok(cals)
    }

    /// Create or update external calendar.
    pub async fn upsert(
        &self,
        connection_id: Uuid,
        cal: CreateExternalCalendar,
    ) -> Result<ExternalCalendar> {
        let created = sqlx::query_as::<_, ExternalCalendar>(
            r#"
            INSERT INTO calendar.external_calendars
                (connection_id, external_id, name, description, color, timezone, is_primary, is_readonly)
            VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, false), COALESCE($8, false))
            ON CONFLICT (connection_id, external_id) DO UPDATE SET
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                color = EXCLUDED.color,
                timezone = EXCLUDED.timezone,
                updated_at = NOW()
            RETURNING *
            "#,
        )
        .bind(connection_id)
        .bind(&cal.external_id)
        .bind(&cal.name)
        .bind(&cal.description)
        .bind(&cal.color)
        .bind(&cal.timezone)
        .bind(cal.is_primary)
        .bind(cal.is_readonly)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(created)
    }

    /// Update sync settings.
    pub async fn update_sync_settings(
        &self,
        id: Uuid,
        sync_enabled: bool,
        sync_token: Option<&str>,
    ) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE calendar.external_calendars SET
                sync_enabled = $2,
                sync_token = COALESCE($3, sync_token),
                last_sync_at = CASE WHEN $2 THEN NOW() ELSE last_sync_at END,
                updated_at = NOW()
            WHERE id = $1
            "#,
        )
        .bind(id)
        .bind(sync_enabled)
        .bind(sync_token)
        .execute(self.pool.inner())
        .await?;

        Ok(())
    }

    /// Delete by connection (cascade).
    pub async fn delete_by_connection(&self, connection_id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM calendar.external_calendars WHERE connection_id = $1")
            .bind(connection_id)
            .execute(self.pool.inner())
            .await?;

        Ok(())
    }
}

// ============================================================================
// Sync Config Repository
// ============================================================================
pub struct SyncConfigRepository<'a> {
    pool: &'a DatabasePool,
}

impl<'a> SyncConfigRepository<'a> {
    pub fn new(pool: &'a DatabasePool) -> Self {
        Self { pool }
    }

    /// Find by ID.
    pub async fn find_by_id(&self, id: Uuid) -> Result<Option<SyncConfig>> {
        let config =
            sqlx::query_as::<_, SyncConfig>("SELECT * FROM calendar.sync_configs WHERE id = $1")
                .bind(id)
                .fetch_optional(self.pool.inner())
                .await?;

        Ok(config)
    }

    /// List configs for a user.
    pub async fn list_for_user(&self, user_id: Uuid) -> Result<Vec<SyncConfig>> {
        let configs = sqlx::query_as::<_, SyncConfig>(
            "SELECT * FROM calendar.sync_configs WHERE user_id = $1 ORDER BY created_at DESC",
        )
        .bind(user_id)
        .fetch_all(self.pool.inner())
        .await?;

        Ok(configs)
    }

    /// Create sync config.
    pub async fn create(&self, user_id: Uuid, config: CreateSyncConfig) -> Result<SyncConfig> {
        let created = sqlx::query_as::<_, SyncConfig>(
            r#"
            INSERT INTO calendar.sync_configs
                (user_id, local_calendar_id, external_calendar_id, sync_direction, conflict_resolution,
                 sync_events, sync_reminders, sync_attendees, sync_past_events, past_events_days,
                 auto_sync_enabled, auto_sync_interval_minutes)
            VALUES ($1, $2, $3, COALESCE($4, 'bidirectional'), COALESCE($5, 'newest'),
                    COALESCE($6, true), COALESCE($7, true), COALESCE($8, true), COALESCE($9, false), $10,
                    COALESCE($11, true), COALESCE($12, 15))
            RETURNING *
            "#,
        )
        .bind(user_id)
        .bind(config.local_calendar_id)
        .bind(config.external_calendar_id)
        .bind(&config.sync_direction)
        .bind(&config.conflict_resolution)
        .bind(config.sync_events)
        .bind(config.sync_reminders)
        .bind(config.sync_attendees)
        .bind(config.sync_past_events)
        .bind(config.past_events_days)
        .bind(config.auto_sync_enabled)
        .bind(config.auto_sync_interval_minutes)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(created)
    }

    /// Update sync config.
    pub async fn update(&self, id: Uuid, config: UpdateSyncConfig) -> Result<SyncConfig> {
        let updated = sqlx::query_as::<_, SyncConfig>(
            r#"
            UPDATE calendar.sync_configs SET
                sync_direction = COALESCE($2, sync_direction),
                conflict_resolution = COALESCE($3, conflict_resolution),
                sync_events = COALESCE($4, sync_events),
                sync_reminders = COALESCE($5, sync_reminders),
                sync_attendees = COALESCE($6, sync_attendees),
                sync_past_events = COALESCE($7, sync_past_events),
                past_events_days = COALESCE($8, past_events_days),
                auto_sync_enabled = COALESCE($9, auto_sync_enabled),
                auto_sync_interval_minutes = COALESCE($10, auto_sync_interval_minutes),
                is_active = COALESCE($11, is_active),
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(&config.sync_direction)
        .bind(&config.conflict_resolution)
        .bind(config.sync_events)
        .bind(config.sync_reminders)
        .bind(config.sync_attendees)
        .bind(config.sync_past_events)
        .bind(config.past_events_days)
        .bind(config.auto_sync_enabled)
        .bind(config.auto_sync_interval_minutes)
        .bind(config.is_active)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(updated)
    }

    /// Delete sync config.
    pub async fn delete(&self, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM calendar.sync_configs WHERE id = $1")
            .bind(id)
            .execute(self.pool.inner())
            .await?;

        Ok(())
    }

    /// Get configs due for auto-sync.
    pub async fn get_due_for_sync(&self) -> Result<Vec<SyncConfig>> {
        let configs = sqlx::query_as::<_, SyncConfig>(
            r#"
            SELECT * FROM calendar.sync_configs
            WHERE is_active = true
              AND auto_sync_enabled = true
              AND (last_auto_sync_at IS NULL
                   OR last_auto_sync_at + (auto_sync_interval_minutes || ' minutes')::interval < NOW())
            "#,
        )
        .fetch_all(self.pool.inner())
        .await?;

        Ok(configs)
    }

    /// Mark as synced.
    pub async fn mark_synced(&self, id: Uuid) -> Result<()> {
        sqlx::query(
            "UPDATE calendar.sync_configs SET last_auto_sync_at = NOW(), updated_at = NOW() WHERE id = $1",
        )
        .bind(id)
        .execute(self.pool.inner())
        .await?;

        Ok(())
    }
}

// ============================================================================
// Sync Log Repository
// ============================================================================
pub struct SyncLogRepository<'a> {
    pool: &'a DatabasePool,
}

impl<'a> SyncLogRepository<'a> {
    pub fn new(pool: &'a DatabasePool) -> Self {
        Self { pool }
    }

    /// Create sync log.
    pub async fn create(&self, config_id: Uuid, log: CreateSyncLog) -> Result<SyncLog> {
        let created = sqlx::query_as::<_, SyncLog>(
            r#"
            INSERT INTO calendar.sync_logs
                (sync_config_id, direction, status, events_imported, events_exported,
                 events_updated, events_deleted, conflicts_detected, error_message, error_details)
            VALUES ($1, $2, $3, COALESCE($4, 0), COALESCE($5, 0), COALESCE($6, 0),
                    COALESCE($7, 0), COALESCE($8, 0), $9, $10)
            RETURNING *
            "#,
        )
        .bind(config_id)
        .bind(&log.direction)
        .bind(&log.status)
        .bind(log.events_imported)
        .bind(log.events_exported)
        .bind(log.events_updated)
        .bind(log.events_deleted)
        .bind(log.conflicts_detected)
        .bind(&log.error_message)
        .bind(&log.error_details)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(created)
    }

    /// Complete sync log.
    pub async fn complete(&self, id: Uuid, status: &str, error: Option<&str>) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE calendar.sync_logs SET
                status = $2,
                error_message = $3,
                completed_at = NOW(),
                duration_ms = EXTRACT(MILLISECONDS FROM NOW() - started_at)::integer
            WHERE id = $1
            "#,
        )
        .bind(id)
        .bind(status)
        .bind(error)
        .execute(self.pool.inner())
        .await?;

        Ok(())
    }

    /// List logs for a config.
    pub async fn list_for_config(&self, config_id: Uuid, limit: i64) -> Result<Vec<SyncLog>> {
        let logs = sqlx::query_as::<_, SyncLog>(
            "SELECT * FROM calendar.sync_logs WHERE sync_config_id = $1 ORDER BY started_at DESC LIMIT $2",
        )
        .bind(config_id)
        .bind(limit)
        .fetch_all(self.pool.inner())
        .await?;

        Ok(logs)
    }
}

// ============================================================================
// Sync Conflict Repository
// ============================================================================
pub struct SyncConflictRepository<'a> {
    pool: &'a DatabasePool,
}

impl<'a> SyncConflictRepository<'a> {
    pub fn new(pool: &'a DatabasePool) -> Self {
        Self { pool }
    }

    /// Create conflict.
    pub async fn create(
        &self,
        config_id: Uuid,
        conflict: CreateSyncConflict,
    ) -> Result<SyncConflict> {
        let created = sqlx::query_as::<_, SyncConflict>(
            r#"
            INSERT INTO calendar.sync_conflicts
                (sync_config_id, local_event_id, external_event_id, conflict_type,
                 local_data, remote_data, local_updated_at, external_updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
            "#,
        )
        .bind(config_id)
        .bind(conflict.local_event_id)
        .bind(&conflict.external_event_id)
        .bind(&conflict.conflict_type)
        .bind(&conflict.local_data)
        .bind(&conflict.remote_data)
        .bind(conflict.local_updated_at)
        .bind(conflict.external_updated_at)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(created)
    }

    /// List unresolved conflicts for a config.
    pub async fn list_unresolved(&self, config_id: Uuid) -> Result<Vec<SyncConflict>> {
        let conflicts = sqlx::query_as::<_, SyncConflict>(
            "SELECT * FROM calendar.sync_conflicts WHERE sync_config_id = $1 AND resolved = false ORDER BY created_at",
        )
        .bind(config_id)
        .fetch_all(self.pool.inner())
        .await?;

        Ok(conflicts)
    }

    /// Resolve conflict.
    pub async fn resolve(&self, id: Uuid, resolution: &str, user_id: Uuid) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE calendar.sync_conflicts SET
                resolved = true,
                resolution = $2,
                resolved_at = NOW(),
                resolved_by = $3
            WHERE id = $1
            "#,
        )
        .bind(id)
        .bind(resolution)
        .bind(user_id)
        .execute(self.pool.inner())
        .await?;

        Ok(())
    }

    /// Resolve all conflicts for a config.
    pub async fn resolve_all(
        &self,
        config_id: Uuid,
        resolution: &str,
        user_id: Uuid,
    ) -> Result<i64> {
        let result = sqlx::query(
            r#"
            UPDATE calendar.sync_conflicts SET
                resolved = true,
                resolution = $2,
                resolved_at = NOW(),
                resolved_by = $3
            WHERE sync_config_id = $1 AND resolved = false
            "#,
        )
        .bind(config_id)
        .bind(resolution)
        .bind(user_id)
        .execute(self.pool.inner())
        .await?;

        Ok(result.rows_affected() as i64)
    }
}

// ============================================================================
// OAuth State Repository
// ============================================================================
pub struct OAuthStateRepository<'a> {
    pool: &'a DatabasePool,
}

impl<'a> OAuthStateRepository<'a> {
    pub fn new(pool: &'a DatabasePool) -> Self {
        Self { pool }
    }

    /// Create OAuth state.
    pub async fn create(&self, user_id: Uuid, state: CreateOAuthState) -> Result<OAuthState> {
        let created = sqlx::query_as::<_, OAuthState>(
            r#"
            INSERT INTO calendar.oauth_states (user_id, state, provider, redirect_uri)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            "#,
        )
        .bind(user_id)
        .bind(&state.state)
        .bind(&state.provider)
        .bind(&state.redirect_uri)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(created)
    }

    /// Find and consume state.
    pub async fn consume(&self, state: &str) -> Result<Option<OAuthState>> {
        let oauth_state = sqlx::query_as::<_, OAuthState>(
            r#"
            DELETE FROM calendar.oauth_states
            WHERE state = $1 AND expires_at > NOW()
            RETURNING *
            "#,
        )
        .bind(state)
        .fetch_optional(self.pool.inner())
        .await?;

        Ok(oauth_state)
    }

    /// Cleanup expired states.
    pub async fn cleanup_expired(&self) -> Result<i64> {
        let result = sqlx::query("DELETE FROM calendar.oauth_states WHERE expires_at < NOW()")
            .execute(self.pool.inner())
            .await?;

        Ok(result.rows_affected() as i64)
    }
}

// ============================================================================
// Event Mapping Repository
// ============================================================================
pub struct EventMappingRepository<'a> {
    pool: &'a DatabasePool,
}

impl<'a> EventMappingRepository<'a> {
    pub fn new(pool: &'a DatabasePool) -> Self {
        Self { pool }
    }

    /// Find by local event.
    pub async fn find_by_local_event(
        &self,
        config_id: Uuid,
        local_event_id: Uuid,
    ) -> Result<Option<EventMapping>> {
        let mapping = sqlx::query_as::<_, EventMapping>(
            "SELECT * FROM calendar.event_mappings WHERE sync_config_id = $1 AND local_event_id = $2",
        )
        .bind(config_id)
        .bind(local_event_id)
        .fetch_optional(self.pool.inner())
        .await?;

        Ok(mapping)
    }

    /// Find by external event.
    pub async fn find_by_external_event(
        &self,
        config_id: Uuid,
        external_event_id: &str,
    ) -> Result<Option<EventMapping>> {
        let mapping = sqlx::query_as::<_, EventMapping>(
            "SELECT * FROM calendar.event_mappings WHERE sync_config_id = $1 AND external_event_id = $2",
        )
        .bind(config_id)
        .bind(external_event_id)
        .fetch_optional(self.pool.inner())
        .await?;

        Ok(mapping)
    }

    /// Create or update mapping.
    pub async fn upsert(
        &self,
        config_id: Uuid,
        mapping: CreateEventMapping,
    ) -> Result<EventMapping> {
        let created = sqlx::query_as::<_, EventMapping>(
            r#"
            INSERT INTO calendar.event_mappings
                (sync_config_id, local_event_id, external_event_id, local_etag, external_etag, local_checksum, external_checksum)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (sync_config_id, local_event_id) DO UPDATE SET
                external_event_id = EXCLUDED.external_event_id,
                local_etag = EXCLUDED.local_etag,
                external_etag = EXCLUDED.external_etag,
                local_checksum = EXCLUDED.local_checksum,
                external_checksum = EXCLUDED.external_checksum,
                last_synced_at = NOW()
            RETURNING *
            "#,
        )
        .bind(config_id)
        .bind(mapping.local_event_id)
        .bind(&mapping.external_event_id)
        .bind(&mapping.local_etag)
        .bind(&mapping.external_etag)
        .bind(&mapping.local_checksum)
        .bind(&mapping.external_checksum)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(created)
    }

    /// Delete mapping.
    pub async fn delete(&self, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM calendar.event_mappings WHERE id = $1")
            .bind(id)
            .execute(self.pool.inner())
            .await?;

        Ok(())
    }
}
