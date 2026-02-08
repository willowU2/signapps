//! RAID management models.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// RAID level type.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RaidLevel {
    Raid0,
    Raid1,
    Raid5,
    Raid6,
    Raid10,
    Raidz,
    Raidz2,
    Raidz3,
}

/// RAID array status.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RaidStatus {
    Active,
    Degraded,
    Rebuilding,
    Failed,
    Inactive,
}

/// RAID array entity.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct RaidArray {
    pub id: Uuid,
    pub name: String,
    pub device_path: String,
    pub raid_level: String,
    pub status: String,
    pub total_size_bytes: Option<i64>,
    pub used_size_bytes: Option<i64>,
    pub metadata: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Create RAID array request.
#[derive(Debug, Clone, Deserialize)]
pub struct CreateRaidArray {
    pub name: String,
    pub raid_level: RaidLevel,
    pub disks: Vec<String>,
}

/// Disk entity.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Disk {
    pub id: Uuid,
    pub device_path: String,
    pub serial_number: Option<String>,
    pub model: Option<String>,
    pub size_bytes: Option<i64>,
    pub status: String,
    pub smart_data: Option<serde_json::Value>,
    pub array_id: Option<Uuid>,
    pub slot_number: Option<i32>,
    pub last_check: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Disk status.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DiskStatus {
    Healthy,
    Warning,
    Failing,
    Failed,
    Spare,
}

/// RAID event entity.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct RaidEvent {
    pub id: Uuid,
    pub array_id: Uuid,
    pub event_type: String,
    pub severity: String,
    pub message: Option<String>,
    pub metadata: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
}

/// Event severity levels.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EventSeverity {
    Info,
    Warning,
    Critical,
}

/// RAID health summary.
#[derive(Debug, Clone, Serialize)]
pub struct RaidHealth {
    pub total_arrays: i32,
    pub healthy_arrays: i32,
    pub degraded_arrays: i32,
    pub failed_arrays: i32,
    pub total_disks: i32,
    pub healthy_disks: i32,
    pub warning_disks: i32,
    pub failed_disks: i32,
    pub last_check: DateTime<Utc>,
}
