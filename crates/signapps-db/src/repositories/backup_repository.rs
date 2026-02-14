//! Backup repository for database operations.

use crate::models::{BackupProfile, BackupRun, CreateBackupProfile, UpdateBackupProfile};
use crate::DatabasePool;
use signapps_common::Result;
use uuid::Uuid;

/// Repository for backup operations.
pub struct BackupRepository<'a> {
    pool: &'a DatabasePool,
}

impl<'a> BackupRepository<'a> {
    pub fn new(pool: &'a DatabasePool) -> Self {
        Self { pool }
    }

    // === Profiles ===

    /// List all backup profiles.
    pub async fn list_profiles(&self) -> Result<Vec<BackupProfile>> {
        let profiles = sqlx::query_as::<_, BackupProfile>(
            "SELECT * FROM containers.backup_profiles ORDER BY created_at DESC",
        )
        .fetch_all(self.pool.inner())
        .await?;

        Ok(profiles)
    }

    /// List profiles by owner.
    pub async fn list_profiles_by_owner(&self, owner_id: Uuid) -> Result<Vec<BackupProfile>> {
        let profiles = sqlx::query_as::<_, BackupProfile>(
            "SELECT * FROM containers.backup_profiles WHERE owner_id = $1 ORDER BY created_at DESC",
        )
        .bind(owner_id)
        .fetch_all(self.pool.inner())
        .await?;

        Ok(profiles)
    }

    /// Find a profile by ID.
    pub async fn find_profile(&self, id: Uuid) -> Result<Option<BackupProfile>> {
        let profile = sqlx::query_as::<_, BackupProfile>(
            "SELECT * FROM containers.backup_profiles WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(self.pool.inner())
        .await?;

        Ok(profile)
    }

    /// Create a new backup profile.
    pub async fn create_profile(
        &self,
        profile: CreateBackupProfile,
        owner_id: Option<Uuid>,
    ) -> Result<BackupProfile> {
        let created = sqlx::query_as::<_, BackupProfile>(
            r#"
            INSERT INTO containers.backup_profiles
                (name, container_ids, schedule, destination_type, destination_config,
                 retention_policy, password_encrypted, owner_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
            "#,
        )
        .bind(&profile.name)
        .bind(&profile.container_ids)
        .bind(&profile.schedule)
        .bind(&profile.destination_type)
        .bind(&profile.destination_config)
        .bind(&profile.retention_policy)
        .bind(&profile.password)
        .bind(owner_id)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(created)
    }

    /// Update an existing backup profile.
    pub async fn update_profile(
        &self,
        id: Uuid,
        update: UpdateBackupProfile,
    ) -> Result<BackupProfile> {
        let updated = sqlx::query_as::<_, BackupProfile>(
            r#"
            UPDATE containers.backup_profiles SET
                name = COALESCE($2, name),
                container_ids = COALESCE($3, container_ids),
                schedule = COALESCE($4, schedule),
                destination_type = COALESCE($5, destination_type),
                destination_config = COALESCE($6, destination_config),
                retention_policy = COALESCE($7, retention_policy),
                enabled = COALESCE($8, enabled),
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(&update.name)
        .bind(&update.container_ids)
        .bind(&update.schedule)
        .bind(&update.destination_type)
        .bind(&update.destination_config)
        .bind(&update.retention_policy)
        .bind(update.enabled)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(updated)
    }

    /// Delete a backup profile.
    pub async fn delete_profile(&self, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM containers.backup_profiles WHERE id = $1")
            .bind(id)
            .execute(self.pool.inner())
            .await?;

        Ok(())
    }

    /// Update last_run_at for a profile.
    pub async fn update_last_run(&self, id: Uuid) -> Result<()> {
        sqlx::query(
            "UPDATE containers.backup_profiles SET last_run_at = NOW(), updated_at = NOW() WHERE id = $1",
        )
        .bind(id)
        .execute(self.pool.inner())
        .await?;

        Ok(())
    }

    // === Runs ===

    /// List runs for a profile.
    pub async fn list_runs(&self, profile_id: Uuid, limit: i64) -> Result<Vec<BackupRun>> {
        let runs = sqlx::query_as::<_, BackupRun>(
            "SELECT * FROM containers.backup_runs WHERE profile_id = $1 ORDER BY started_at DESC LIMIT $2",
        )
        .bind(profile_id)
        .bind(limit)
        .fetch_all(self.pool.inner())
        .await?;

        Ok(runs)
    }

    /// Create a new run.
    pub async fn create_run(&self, profile_id: Uuid) -> Result<BackupRun> {
        let run = sqlx::query_as::<_, BackupRun>(
            "INSERT INTO containers.backup_runs (profile_id) VALUES ($1) RETURNING *",
        )
        .bind(profile_id)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(run)
    }

    /// Complete a run with success.
    pub async fn complete_run(
        &self,
        run_id: Uuid,
        snapshot_id: &str,
        size_bytes: i64,
        files_new: i32,
        files_changed: i32,
        duration_seconds: i32,
    ) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE containers.backup_runs SET
                status = 'success',
                snapshot_id = $2,
                size_bytes = $3,
                files_new = $4,
                files_changed = $5,
                duration_seconds = $6,
                completed_at = NOW()
            WHERE id = $1
            "#,
        )
        .bind(run_id)
        .bind(snapshot_id)
        .bind(size_bytes)
        .bind(files_new)
        .bind(files_changed)
        .bind(duration_seconds)
        .execute(self.pool.inner())
        .await?;

        Ok(())
    }

    /// Fail a run with an error message.
    pub async fn fail_run(&self, run_id: Uuid, error: &str, duration_seconds: i32) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE containers.backup_runs SET
                status = 'failed',
                error_message = $2,
                duration_seconds = $3,
                completed_at = NOW()
            WHERE id = $1
            "#,
        )
        .bind(run_id)
        .bind(error)
        .bind(duration_seconds)
        .execute(self.pool.inner())
        .await?;

        Ok(())
    }
}
