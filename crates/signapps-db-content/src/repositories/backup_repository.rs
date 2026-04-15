//! Backup repository for database operations.

use crate::models::backup::{
    BackupEntry, BackupPlan, BackupProfile, BackupRun, BackupSnapshot, CreateBackupPlan,
    CreateBackupProfile, UpdateBackupPlan, UpdateBackupProfile,
};
use signapps_common::Result;
use signapps_db_shared::DatabasePool;
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

// ============================================================
// Drive SP3 Backup Repository (storage schema)
// ============================================================

/// Repository for Drive SP3 backup plans, snapshots, and entries.
pub struct DriveBackupRepository<'a> {
    pool: &'a DatabasePool,
}

impl<'a> DriveBackupRepository<'a> {
    pub fn new(pool: &'a DatabasePool) -> Self {
        Self { pool }
    }

    // === Plans ===

    /// List all backup plans.
    pub async fn list_plans(&self) -> Result<Vec<BackupPlan>> {
        let plans = sqlx::query_as::<_, BackupPlan>(
            "SELECT id, name, schedule, backup_type::text, retention_days, max_snapshots,
                    include_paths, exclude_paths, enabled, last_run_at, next_run_at,
                    created_at, updated_at
             FROM storage.backup_plans ORDER BY created_at DESC",
        )
        .fetch_all(self.pool.inner())
        .await?;
        Ok(plans)
    }

    /// Find a plan by ID.
    pub async fn find_plan(&self, id: Uuid) -> Result<Option<BackupPlan>> {
        let plan = sqlx::query_as::<_, BackupPlan>(
            "SELECT id, name, schedule, backup_type::text, retention_days, max_snapshots,
                    include_paths, exclude_paths, enabled, last_run_at, next_run_at,
                    created_at, updated_at
             FROM storage.backup_plans WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(self.pool.inner())
        .await?;
        Ok(plan)
    }

    /// Create a new backup plan.
    pub async fn create_plan(&self, req: CreateBackupPlan) -> Result<BackupPlan> {
        let plan = sqlx::query_as::<_, BackupPlan>(
            r#"
            INSERT INTO storage.backup_plans
                (name, schedule, backup_type, retention_days, max_snapshots,
                 include_paths, exclude_paths, enabled)
            VALUES ($1, $2, $3::storage.backup_type, $4, $5, $6, $7, $8)
            RETURNING id, name, schedule, backup_type::text, retention_days, max_snapshots,
                      include_paths, exclude_paths, enabled, last_run_at, next_run_at,
                      created_at, updated_at
            "#,
        )
        .bind(&req.name)
        .bind(&req.schedule)
        .bind(&req.backup_type)
        .bind(req.retention_days)
        .bind(req.max_snapshots)
        .bind(&req.include_paths)
        .bind(&req.exclude_paths)
        .bind(req.enabled)
        .fetch_one(self.pool.inner())
        .await?;
        Ok(plan)
    }

    /// Update an existing backup plan.
    pub async fn update_plan(&self, id: Uuid, req: UpdateBackupPlan) -> Result<BackupPlan> {
        let plan = sqlx::query_as::<_, BackupPlan>(
            r#"
            UPDATE storage.backup_plans SET
                name = COALESCE($2, name),
                schedule = COALESCE($3, schedule),
                backup_type = COALESCE($4::storage.backup_type, backup_type),
                retention_days = COALESCE($5, retention_days),
                max_snapshots = COALESCE($6, max_snapshots),
                include_paths = COALESCE($7, include_paths),
                exclude_paths = COALESCE($8, exclude_paths),
                enabled = COALESCE($9, enabled),
                updated_at = NOW()
            WHERE id = $1
            RETURNING id, name, schedule, backup_type::text, retention_days, max_snapshots,
                      include_paths, exclude_paths, enabled, last_run_at, next_run_at,
                      created_at, updated_at
            "#,
        )
        .bind(id)
        .bind(&req.name)
        .bind(&req.schedule)
        .bind(&req.backup_type)
        .bind(req.retention_days)
        .bind(req.max_snapshots)
        .bind(&req.include_paths)
        .bind(&req.exclude_paths)
        .bind(req.enabled)
        .fetch_one(self.pool.inner())
        .await?;
        Ok(plan)
    }

    /// Delete a backup plan (cascades to snapshots and entries).
    pub async fn delete_plan(&self, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM storage.backup_plans WHERE id = $1")
            .bind(id)
            .execute(self.pool.inner())
            .await?;
        Ok(())
    }

    /// Update last_run_at and compute next_run_at (stub: +1 day) for a plan.
    pub async fn mark_plan_run(&self, id: Uuid) -> Result<()> {
        sqlx::query(
            r#"UPDATE storage.backup_plans SET
                last_run_at = NOW(),
                next_run_at = NOW() + INTERVAL '1 day',
                updated_at = NOW()
               WHERE id = $1"#,
        )
        .bind(id)
        .execute(self.pool.inner())
        .await?;
        Ok(())
    }

    /// List plans that are due to run.
    pub async fn list_due_plans(&self) -> Result<Vec<BackupPlan>> {
        let plans = sqlx::query_as::<_, BackupPlan>(
            r#"SELECT id, name, schedule, backup_type::text, retention_days, max_snapshots,
                      include_paths, exclude_paths, enabled, last_run_at, next_run_at,
                      created_at, updated_at
               FROM storage.backup_plans
               WHERE enabled = true
                 AND (next_run_at IS NULL OR next_run_at <= NOW())
               ORDER BY created_at"#,
        )
        .fetch_all(self.pool.inner())
        .await?;
        Ok(plans)
    }

    // === Snapshots ===

    /// List all snapshots, optionally filtered by plan.
    pub async fn list_snapshots(&self, plan_id: Option<Uuid>) -> Result<Vec<BackupSnapshot>> {
        let snapshots = if let Some(pid) = plan_id {
            sqlx::query_as::<_, BackupSnapshot>(
                r#"SELECT id, plan_id, backup_type::text, status::text, started_at,
                          completed_at, files_count, total_size, storage_path, error_message, created_at
                   FROM storage.backup_snapshots WHERE plan_id = $1 ORDER BY started_at DESC"#,
            )
            .bind(pid)
            .fetch_all(self.pool.inner())
            .await?
        } else {
            sqlx::query_as::<_, BackupSnapshot>(
                r#"SELECT id, plan_id, backup_type::text, status::text, started_at,
                          completed_at, files_count, total_size, storage_path, error_message, created_at
                   FROM storage.backup_snapshots ORDER BY started_at DESC LIMIT 100"#,
            )
            .fetch_all(self.pool.inner())
            .await?
        };
        Ok(snapshots)
    }

    /// Find a snapshot by ID.
    pub async fn find_snapshot(&self, id: Uuid) -> Result<Option<BackupSnapshot>> {
        let snapshot = sqlx::query_as::<_, BackupSnapshot>(
            r#"SELECT id, plan_id, backup_type::text, status::text, started_at,
                      completed_at, files_count, total_size, storage_path, error_message, created_at
               FROM storage.backup_snapshots WHERE id = $1"#,
        )
        .bind(id)
        .fetch_optional(self.pool.inner())
        .await?;
        Ok(snapshot)
    }

    /// Create a new snapshot with status=running.
    pub async fn create_snapshot(
        &self,
        plan_id: Uuid,
        backup_type: &str,
        storage_path: Option<&str>,
    ) -> Result<BackupSnapshot> {
        let snapshot = sqlx::query_as::<_, BackupSnapshot>(
            r#"INSERT INTO storage.backup_snapshots (plan_id, backup_type, storage_path)
               VALUES ($1, $2::storage.backup_type, $3)
               RETURNING id, plan_id, backup_type::text, status::text, started_at,
                         completed_at, files_count, total_size, storage_path, error_message, created_at"#,
        )
        .bind(plan_id)
        .bind(backup_type)
        .bind(storage_path)
        .fetch_one(self.pool.inner())
        .await?;
        Ok(snapshot)
    }

    /// Mark snapshot as completed.
    pub async fn complete_snapshot(
        &self,
        id: Uuid,
        files_count: i32,
        total_size: i64,
    ) -> Result<()> {
        sqlx::query(
            r#"UPDATE storage.backup_snapshots SET
                status = 'completed',
                completed_at = NOW(),
                files_count = $2,
                total_size = $3
               WHERE id = $1"#,
        )
        .bind(id)
        .bind(files_count)
        .bind(total_size)
        .execute(self.pool.inner())
        .await?;
        Ok(())
    }

    /// Mark snapshot as failed.
    pub async fn fail_snapshot(&self, id: Uuid, error: &str) -> Result<()> {
        sqlx::query(
            r#"UPDATE storage.backup_snapshots SET
                status = 'failed',
                completed_at = NOW(),
                error_message = $2
               WHERE id = $1"#,
        )
        .bind(id)
        .bind(error)
        .execute(self.pool.inner())
        .await?;
        Ok(())
    }

    /// Delete a snapshot (cascades to entries).
    pub async fn delete_snapshot(&self, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM storage.backup_snapshots WHERE id = $1")
            .bind(id)
            .execute(self.pool.inner())
            .await?;
        Ok(())
    }

    /// Delete old snapshots beyond retention limit for a plan.
    pub async fn cleanup_old_snapshots(&self, plan_id: Uuid, max_snapshots: i32) -> Result<()> {
        sqlx::query(
            r#"DELETE FROM storage.backup_snapshots
               WHERE plan_id = $1
                 AND id NOT IN (
                     SELECT id FROM storage.backup_snapshots
                     WHERE plan_id = $1
                     ORDER BY started_at DESC
                     LIMIT $2
                 )"#,
        )
        .bind(plan_id)
        .bind(max_snapshots as i64)
        .execute(self.pool.inner())
        .await?;
        Ok(())
    }

    // === Entries ===

    /// List entries for a snapshot.
    pub async fn list_entries(&self, snapshot_id: Uuid) -> Result<Vec<BackupEntry>> {
        let entries = sqlx::query_as::<_, BackupEntry>(
            r#"SELECT id, snapshot_id, node_id, node_path, file_hash, file_size, backup_key, created_at
               FROM storage.backup_entries WHERE snapshot_id = $1 ORDER BY node_path"#,
        )
        .bind(snapshot_id)
        .fetch_all(self.pool.inner())
        .await?;
        Ok(entries)
    }

    /// Create a backup entry for a file.
    pub async fn create_entry(
        &self,
        snapshot_id: Uuid,
        node_id: Option<Uuid>,
        node_path: &str,
        file_hash: Option<&str>,
        file_size: i64,
        backup_key: &str,
    ) -> Result<BackupEntry> {
        let entry = sqlx::query_as::<_, BackupEntry>(
            r#"INSERT INTO storage.backup_entries
                   (snapshot_id, node_id, node_path, file_hash, file_size, backup_key)
               VALUES ($1, $2, $3, $4, $5, $6)
               RETURNING id, snapshot_id, node_id, node_path, file_hash, file_size, backup_key, created_at"#,
        )
        .bind(snapshot_id)
        .bind(node_id)
        .bind(node_path)
        .bind(file_hash)
        .bind(file_size)
        .bind(backup_key)
        .fetch_one(self.pool.inner())
        .await?;
        Ok(entry)
    }
}
