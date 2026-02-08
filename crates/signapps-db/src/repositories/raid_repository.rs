//! RAID repository for storage management.

use crate::models::{RaidArray, Disk, RaidEvent, RaidHealth};
use crate::DatabasePool;
use signapps_common::Result;
use chrono::Utc;
use uuid::Uuid;

/// Repository for RAID operations.
pub struct RaidRepository<'a> {
    pool: &'a DatabasePool,
}

impl<'a> RaidRepository<'a> {
    pub fn new(pool: &'a DatabasePool) -> Self {
        Self { pool }
    }

    // === Arrays ===

    /// Find array by ID.
    pub async fn find_array(&self, id: Uuid) -> Result<Option<RaidArray>> {
        let array = sqlx::query_as::<_, RaidArray>(
            "SELECT * FROM storage.raid_arrays WHERE id = $1"
        )
        .bind(id)
        .fetch_optional(self.pool.inner())
        .await?;

        Ok(array)
    }

    /// Find array by name.
    pub async fn find_array_by_name(&self, name: &str) -> Result<Option<RaidArray>> {
        let array = sqlx::query_as::<_, RaidArray>(
            "SELECT * FROM storage.raid_arrays WHERE name = $1"
        )
        .bind(name)
        .fetch_optional(self.pool.inner())
        .await?;

        Ok(array)
    }

    /// List all arrays.
    pub async fn list_arrays(&self) -> Result<Vec<RaidArray>> {
        let arrays = sqlx::query_as::<_, RaidArray>(
            "SELECT * FROM storage.raid_arrays ORDER BY name"
        )
        .fetch_all(self.pool.inner())
        .await?;

        Ok(arrays)
    }

    /// Create a new array record.
    pub async fn create_array(&self, name: &str, device_path: &str, raid_level: &str) -> Result<RaidArray> {
        let array = sqlx::query_as::<_, RaidArray>(
            r#"
            INSERT INTO storage.raid_arrays (name, device_path, raid_level, status)
            VALUES ($1, $2, $3, 'active')
            RETURNING *
            "#
        )
        .bind(name)
        .bind(device_path)
        .bind(raid_level)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(array)
    }

    /// Update array status.
    pub async fn update_array_status(&self, id: Uuid, status: &str) -> Result<()> {
        sqlx::query(
            "UPDATE storage.raid_arrays SET status = $2, updated_at = NOW() WHERE id = $1"
        )
        .bind(id)
        .bind(status)
        .execute(self.pool.inner())
        .await?;

        Ok(())
    }

    /// Update array size info.
    pub async fn update_array_size(&self, id: Uuid, total: i64, used: i64) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE storage.raid_arrays
            SET total_size_bytes = $2, used_size_bytes = $3, updated_at = NOW()
            WHERE id = $1
            "#
        )
        .bind(id)
        .bind(total)
        .bind(used)
        .execute(self.pool.inner())
        .await?;

        Ok(())
    }

    /// Delete array.
    pub async fn delete_array(&self, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM storage.raid_arrays WHERE id = $1")
            .bind(id)
            .execute(self.pool.inner())
            .await?;

        Ok(())
    }

    // === Disks ===

    /// Find disk by ID.
    pub async fn find_disk(&self, id: Uuid) -> Result<Option<Disk>> {
        let disk = sqlx::query_as::<_, Disk>(
            "SELECT * FROM storage.disks WHERE id = $1"
        )
        .bind(id)
        .fetch_optional(self.pool.inner())
        .await?;

        Ok(disk)
    }

    /// Find disk by device path.
    pub async fn find_disk_by_path(&self, path: &str) -> Result<Option<Disk>> {
        let disk = sqlx::query_as::<_, Disk>(
            "SELECT * FROM storage.disks WHERE device_path = $1"
        )
        .bind(path)
        .fetch_optional(self.pool.inner())
        .await?;

        Ok(disk)
    }

    /// List all disks.
    pub async fn list_disks(&self) -> Result<Vec<Disk>> {
        let disks = sqlx::query_as::<_, Disk>(
            "SELECT * FROM storage.disks ORDER BY device_path"
        )
        .fetch_all(self.pool.inner())
        .await?;

        Ok(disks)
    }

    /// List disks in an array.
    pub async fn list_array_disks(&self, array_id: Uuid) -> Result<Vec<Disk>> {
        let disks = sqlx::query_as::<_, Disk>(
            "SELECT * FROM storage.disks WHERE array_id = $1 ORDER BY slot_number"
        )
        .bind(array_id)
        .fetch_all(self.pool.inner())
        .await?;

        Ok(disks)
    }

    /// Create or update disk.
    pub async fn upsert_disk(&self, path: &str, serial: Option<&str>, model: Option<&str>, size: Option<i64>) -> Result<Disk> {
        let disk = sqlx::query_as::<_, Disk>(
            r#"
            INSERT INTO storage.disks (device_path, serial_number, model, size_bytes, status)
            VALUES ($1, $2, $3, $4, 'healthy')
            ON CONFLICT (device_path) DO UPDATE SET
                serial_number = COALESCE($2, storage.disks.serial_number),
                model = COALESCE($3, storage.disks.model),
                size_bytes = COALESCE($4, storage.disks.size_bytes),
                updated_at = NOW()
            RETURNING *
            "#
        )
        .bind(path)
        .bind(serial)
        .bind(model)
        .bind(size)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(disk)
    }

    /// Update disk status.
    pub async fn update_disk_status(&self, id: Uuid, status: &str) -> Result<()> {
        sqlx::query(
            "UPDATE storage.disks SET status = $2, updated_at = NOW() WHERE id = $1"
        )
        .bind(id)
        .bind(status)
        .execute(self.pool.inner())
        .await?;

        Ok(())
    }

    /// Assign disk to array.
    pub async fn assign_to_array(&self, disk_id: Uuid, array_id: Uuid, slot: i32) -> Result<()> {
        sqlx::query(
            "UPDATE storage.disks SET array_id = $2, slot_number = $3, updated_at = NOW() WHERE id = $1"
        )
        .bind(disk_id)
        .bind(array_id)
        .bind(slot)
        .execute(self.pool.inner())
        .await?;

        Ok(())
    }

    // === Events ===

    /// Create event.
    pub async fn create_event(&self, array_id: Uuid, event_type: &str, severity: &str, message: Option<&str>) -> Result<RaidEvent> {
        let event = sqlx::query_as::<_, RaidEvent>(
            r#"
            INSERT INTO storage.raid_events (array_id, event_type, severity, message)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            "#
        )
        .bind(array_id)
        .bind(event_type)
        .bind(severity)
        .bind(message)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(event)
    }

    /// List recent events.
    pub async fn list_events(&self, limit: i64) -> Result<Vec<RaidEvent>> {
        let events = sqlx::query_as::<_, RaidEvent>(
            "SELECT * FROM storage.raid_events ORDER BY created_at DESC LIMIT $1"
        )
        .bind(limit)
        .fetch_all(self.pool.inner())
        .await?;

        Ok(events)
    }

    /// Get health summary.
    pub async fn get_health(&self) -> Result<RaidHealth> {
        let arrays = self.list_arrays().await?;
        let disks = self.list_disks().await?;

        let healthy_arrays = arrays.iter().filter(|a| a.status == "active").count() as i32;
        let degraded_arrays = arrays.iter().filter(|a| a.status == "degraded").count() as i32;
        let failed_arrays = arrays.iter().filter(|a| a.status == "failed").count() as i32;

        let healthy_disks = disks.iter().filter(|d| d.status == "healthy").count() as i32;
        let warning_disks = disks.iter().filter(|d| d.status == "warning").count() as i32;
        let failed_disks = disks.iter().filter(|d| d.status == "failed").count() as i32;

        Ok(RaidHealth {
            total_arrays: arrays.len() as i32,
            healthy_arrays,
            degraded_arrays,
            failed_arrays,
            total_disks: disks.len() as i32,
            healthy_disks,
            warning_disks,
            failed_disks,
            last_check: Utc::now(),
        })
    }
}
