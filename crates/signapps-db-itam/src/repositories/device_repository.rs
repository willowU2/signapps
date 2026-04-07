//! Device repository for VPN management.

use crate::models::device::{CreateDevice, Device, UpdateDevice};
use signapps_db_shared::DatabasePool;
use signapps_common::Result;
use uuid::Uuid;

/// Repository for device operations.
pub struct DeviceRepository<'a> {
    pool: &'a DatabasePool,
}

impl<'a> DeviceRepository<'a> {
    pub fn new(pool: &'a DatabasePool) -> Self {
        Self { pool }
    }

    /// Find device by ID.
    pub async fn find(&self, id: Uuid) -> Result<Option<Device>> {
        let device = sqlx::query_as::<_, Device>("SELECT * FROM securelink.devices WHERE id = $1")
            .bind(id)
            .fetch_optional(self.pool.inner())
            .await?;

        Ok(device)
    }

    /// Find device by name.
    pub async fn find_by_name(&self, name: &str) -> Result<Option<Device>> {
        let device =
            sqlx::query_as::<_, Device>("SELECT * FROM securelink.devices WHERE name = $1")
                .bind(name)
                .fetch_optional(self.pool.inner())
                .await?;

        Ok(device)
    }

    /// Find device by public key.
    pub async fn find_by_public_key(&self, public_key: &str) -> Result<Option<Device>> {
        let device =
            sqlx::query_as::<_, Device>("SELECT * FROM securelink.devices WHERE public_key = $1")
                .bind(public_key)
                .fetch_optional(self.pool.inner())
                .await?;

        Ok(device)
    }

    /// List all devices.
    pub async fn list(&self) -> Result<Vec<Device>> {
        let devices = sqlx::query_as::<_, Device>("SELECT * FROM securelink.devices ORDER BY name")
            .fetch_all(self.pool.inner())
            .await?;

        Ok(devices)
    }

    /// List active (non-blocked) devices.
    pub async fn list_active(&self) -> Result<Vec<Device>> {
        let devices = sqlx::query_as::<_, Device>(
            "SELECT * FROM securelink.devices WHERE blocked = false ORDER BY name",
        )
        .fetch_all(self.pool.inner())
        .await?;

        Ok(devices)
    }

    /// List lighthouses.
    pub async fn list_lighthouses(&self) -> Result<Vec<Device>> {
        let devices = sqlx::query_as::<_, Device>(
            "SELECT * FROM securelink.devices WHERE is_lighthouse = true AND blocked = false",
        )
        .fetch_all(self.pool.inner())
        .await?;

        Ok(devices)
    }

    /// Create a new device.
    pub async fn create(
        &self,
        device: &CreateDevice,
        public_key: &str,
        ip_address: &str,
    ) -> Result<Device> {
        let created = sqlx::query_as::<_, Device>(
            r#"
            INSERT INTO securelink.devices (name, nickname, public_key, ip_address, is_lighthouse, is_relay)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
            "#
        )
        .bind(&device.name)
        .bind(&device.nickname)
        .bind(public_key)
        .bind(ip_address)
        .bind(device.is_lighthouse)
        .bind(device.is_relay)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(created)
    }

    /// Update a device.
    pub async fn update(&self, id: Uuid, update: &UpdateDevice) -> Result<Device> {
        let mut sets = Vec::new();
        let mut param_count = 1;

        if update.nickname.is_some() {
            param_count += 1;
            sets.push(format!("nickname = ${}", param_count));
        }
        if update.blocked.is_some() {
            param_count += 1;
            sets.push(format!("blocked = ${}", param_count));
        }
        if update.is_lighthouse.is_some() {
            param_count += 1;
            sets.push(format!("is_lighthouse = ${}", param_count));
        }
        if update.is_relay.is_some() {
            param_count += 1;
            sets.push(format!("is_relay = ${}", param_count));
        }

        if sets.is_empty() {
            // No updates, return existing device
            return self
                .find(id)
                .await?
                .ok_or_else(|| signapps_common::Error::NotFound(format!("Device {}", id)));
        }

        let query = format!(
            "UPDATE securelink.devices SET {} WHERE id = $1 RETURNING *",
            sets.join(", ")
        );

        let mut q = sqlx::query_as::<_, Device>(&query).bind(id);

        if let Some(ref nickname) = update.nickname {
            q = q.bind(nickname);
        }
        if let Some(blocked) = update.blocked {
            q = q.bind(blocked);
        }
        if let Some(is_lighthouse) = update.is_lighthouse {
            q = q.bind(is_lighthouse);
        }
        if let Some(is_relay) = update.is_relay {
            q = q.bind(is_relay);
        }

        let updated = q.fetch_one(self.pool.inner()).await?;

        Ok(updated)
    }

    /// Delete a device.
    pub async fn delete(&self, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM securelink.devices WHERE id = $1")
            .bind(id)
            .execute(self.pool.inner())
            .await?;

        Ok(())
    }

    /// Update last seen timestamp.
    pub async fn update_last_seen(&self, id: Uuid) -> Result<()> {
        sqlx::query("UPDATE securelink.devices SET last_seen = NOW() WHERE id = $1")
            .bind(id)
            .execute(self.pool.inner())
            .await?;

        Ok(())
    }

    /// Block a device.
    pub async fn block(&self, id: Uuid) -> Result<Device> {
        let device = sqlx::query_as::<_, Device>(
            "UPDATE securelink.devices SET blocked = true WHERE id = $1 RETURNING *",
        )
        .bind(id)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(device)
    }

    /// Unblock a device.
    pub async fn unblock(&self, id: Uuid) -> Result<Device> {
        let device = sqlx::query_as::<_, Device>(
            "UPDATE securelink.devices SET blocked = false WHERE id = $1 RETURNING *",
        )
        .bind(id)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(device)
    }

    /// Get next available IP in the VPN network.
    pub async fn get_next_ip(&self, network_prefix: &str) -> Result<String> {
        // Get all used IPs
        let used_ips: Vec<String> = sqlx::query_scalar("SELECT ip_address FROM securelink.devices")
            .fetch_all(self.pool.inner())
            .await?;

        // Parse network prefix (e.g., "10.42.0")
        let parts: Vec<&str> = network_prefix.split('.').collect();
        if parts.len() != 3 {
            return Err(signapps_common::Error::Validation(
                "Invalid network prefix".to_string(),
            ));
        }

        // Find first available IP (skip .0 and .1 which are reserved)
        for i in 2..255 {
            let ip = format!("{}.{}", network_prefix, i);
            if !used_ips.contains(&ip) {
                return Ok(ip);
            }
        }

        Err(signapps_common::Error::Internal(
            "No available IP addresses in network".to_string(),
        ))
    }

    /// Count devices.
    pub async fn count(&self) -> Result<i64> {
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM securelink.devices")
            .fetch_one(self.pool.inner())
            .await?;

        Ok(count.0)
    }

    /// Count active devices.
    pub async fn count_active(&self) -> Result<i64> {
        let count: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM securelink.devices WHERE blocked = false")
                .fetch_one(self.pool.inner())
                .await?;

        Ok(count.0)
    }
}
