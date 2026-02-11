//! Mount point management handlers.
//!
//! Provides endpoints to list, mount, and unmount filesystems.
#![allow(dead_code)]

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use signapps_common::{Error, Result};
use std::collections::HashMap;
use uuid::Uuid;

use crate::AppState;

/// Mount point information.
#[derive(Debug, Clone, Serialize)]
pub struct MountPoint {
    pub id: Uuid,
    pub device: String,
    pub mount_path: String,
    pub fs_type: String,
    pub options: Vec<String>,
    pub total_bytes: Option<u64>,
    pub used_bytes: Option<u64>,
    pub available_bytes: Option<u64>,
    pub usage_percent: Option<f64>,
    pub is_removable: bool,
    pub is_readonly: bool,
}

/// Request to mount a device.
#[derive(Debug, Deserialize)]
pub struct MountRequest {
    /// Device path (e.g., /dev/sdb1)
    pub device: String,
    /// Mount point path (e.g., /mnt/data)
    pub mount_path: String,
    /// Filesystem type (e.g., ext4, ntfs, vfat)
    pub fs_type: Option<String>,
    /// Mount options (e.g., ["ro", "noexec"])
    pub options: Option<Vec<String>>,
}

/// Response after a mount operation.
#[derive(Debug, Serialize)]
pub struct MountResponse {
    pub success: bool,
    pub mount_point: Option<MountPoint>,
    pub message: String,
}

/// List all mount points.
#[tracing::instrument(skip(_state))]
pub async fn list_mounts(
    State(_state): State<AppState>,
) -> Result<Json<Vec<MountPoint>>> {
    let mounts = get_system_mounts().await?;
    Ok(Json(mounts))
}

/// Mount a device.
#[tracing::instrument(skip(_state))]
pub async fn mount(
    State(_state): State<AppState>,
    Json(payload): Json<MountRequest>,
) -> Result<Json<MountResponse>> {
    // Validate device path
    if !payload.device.starts_with("/dev/") {
        return Err(Error::Validation("Device path must start with /dev/".to_string()));
    }

    // Validate mount path
    if !payload.mount_path.starts_with('/') {
        return Err(Error::Validation("Mount path must be absolute".to_string()));
    }

    // Check if device exists
    if !tokio::fs::try_exists(&payload.device).await.unwrap_or(false) {
        return Err(Error::NotFound(format!("Device {} not found", payload.device)));
    }

    // Create mount point directory if it doesn't exist
    if !tokio::fs::try_exists(&payload.mount_path).await.unwrap_or(false) {
        tokio::fs::create_dir_all(&payload.mount_path).await
            .map_err(|e| Error::Storage(format!("Failed to create mount point: {}", e)))?;
    }

    // Build mount command
    let mut cmd = tokio::process::Command::new("mount");

    // Add filesystem type if specified
    if let Some(ref fs_type) = payload.fs_type {
        cmd.arg("-t").arg(fs_type);
    }

    // Add options if specified
    if let Some(ref options) = payload.options {
        if !options.is_empty() {
            cmd.arg("-o").arg(options.join(","));
        }
    }

    cmd.arg(&payload.device).arg(&payload.mount_path);

    // Execute mount command
    let output = cmd.output().await
        .map_err(|e| Error::Storage(format!("Failed to execute mount: {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        tracing::error!(device = %payload.device, mount_path = %payload.mount_path, error = %stderr, "Mount failed");
        return Err(Error::Storage(format!("Mount failed: {}", stderr)));
    }

    tracing::info!(device = %payload.device, mount_path = %payload.mount_path, "Device mounted successfully");

    // Get info about the new mount
    let mounts = get_system_mounts().await?;
    let mount_point = mounts.into_iter()
        .find(|m| m.mount_path == payload.mount_path);

    Ok(Json(MountResponse {
        success: true,
        mount_point,
        message: format!("Device {} mounted at {}", payload.device, payload.mount_path),
    }))
}

/// Unmount a filesystem.
#[tracing::instrument(skip(_state))]
pub async fn unmount(
    State(_state): State<AppState>,
    Path(path): Path<String>,
) -> Result<StatusCode> {
    // Decode the path (it's URL encoded)
    let mount_path = urlencoding::decode(&path)
        .map_err(|e| Error::Validation(format!("Invalid path encoding: {}", e)))?
        .to_string();

    // Validate mount path
    if !mount_path.starts_with('/') {
        return Err(Error::Validation("Mount path must be absolute".to_string()));
    }

    // Don't allow unmounting critical system paths
    let protected_paths = ["/", "/boot", "/home", "/var", "/usr", "/etc", "/tmp"];
    if protected_paths.contains(&mount_path.as_str()) {
        return Err(Error::Forbidden(format!("Cannot unmount system path: {}", mount_path)));
    }

    // Check if path is actually mounted
    let mounts = get_system_mounts().await?;
    let is_mounted = mounts.iter().any(|m| m.mount_path == mount_path);
    if !is_mounted {
        return Err(Error::NotFound(format!("Path {} is not mounted", mount_path)));
    }

    // Execute unmount command
    let output = tokio::process::Command::new("umount")
        .arg(&mount_path)
        .output()
        .await
        .map_err(|e| Error::Storage(format!("Failed to execute umount: {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        tracing::error!(mount_path = %mount_path, error = %stderr, "Unmount failed");
        return Err(Error::Storage(format!("Unmount failed: {}", stderr)));
    }

    tracing::info!(mount_path = %mount_path, "Filesystem unmounted successfully");

    Ok(StatusCode::NO_CONTENT)
}

/// Get system mount points using sysinfo and /proc/mounts.
async fn get_system_mounts() -> Result<Vec<MountPoint>> {
    let mut mounts = Vec::new();
    let mut seen_paths = std::collections::HashSet::new();

    // Use sysinfo to get disk information with space usage
    let disks = sysinfo::Disks::new_with_refreshed_list();
    let mut disk_info: HashMap<String, (u64, u64, u64, bool)> = HashMap::new();

    for disk in disks.list() {
        let mount_path = disk.mount_point().to_string_lossy().to_string();
        disk_info.insert(
            mount_path,
            (
                disk.total_space(),
                disk.total_space() - disk.available_space(),
                disk.available_space(),
                disk.is_removable(),
            ),
        );
    }

    // Read /proc/mounts for detailed mount information (Linux)
    #[cfg(target_os = "linux")]
    {
        if let Ok(content) = tokio::fs::read_to_string("/proc/mounts").await {
            for line in content.lines() {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 4 {
                    let device = parts[0].to_string();
                    let mount_path = parts[1].to_string();
                    let fs_type = parts[2].to_string();
                    let options: Vec<String> = parts[3].split(',').map(|s| s.to_string()).collect();

                    // Skip pseudo filesystems
                    if device == "none" || device.starts_with("proc") || device.starts_with("sys")
                        || device.starts_with("devpts") || device.starts_with("tmpfs") && mount_path.starts_with("/sys")
                        || fs_type == "cgroup" || fs_type == "cgroup2" || fs_type == "autofs"
                        || fs_type == "debugfs" || fs_type == "tracefs" || fs_type == "securityfs"
                        || fs_type == "pstore" || fs_type == "configfs" || fs_type == "fusectl"
                        || fs_type == "mqueue" || fs_type == "hugetlbfs" || fs_type == "binfmt_misc"
                    {
                        continue;
                    }

                    // Skip if we've already seen this path
                    if !seen_paths.insert(mount_path.clone()) {
                        continue;
                    }

                    let is_readonly = options.contains(&"ro".to_string());
                    let (total, used, available, is_removable) = disk_info
                        .get(&mount_path)
                        .copied()
                        .unwrap_or((0, 0, 0, false));

                    let usage_percent = if total > 0 {
                        Some((used as f64 / total as f64) * 100.0)
                    } else {
                        None
                    };

                    mounts.push(MountPoint {
                        id: Uuid::new_v5(&Uuid::NAMESPACE_OID, mount_path.as_bytes()),
                        device,
                        mount_path,
                        fs_type,
                        options,
                        total_bytes: if total > 0 { Some(total) } else { None },
                        used_bytes: if used > 0 { Some(used) } else { None },
                        available_bytes: if available > 0 { Some(available) } else { None },
                        usage_percent,
                        is_removable,
                        is_readonly,
                    });
                }
            }
        }
    }

    // Windows fallback - use sysinfo only
    #[cfg(target_os = "windows")]
    {
        for disk in disks.list() {
            let mount_path = disk.mount_point().to_string_lossy().to_string();
            let device = disk.name().to_string_lossy().to_string();

            if seen_paths.insert(mount_path.clone()) {
                let total = disk.total_space();
                let available = disk.available_space();
                let used = total - available;

                mounts.push(MountPoint {
                    id: Uuid::new_v5(&Uuid::NAMESPACE_OID, mount_path.as_bytes()),
                    device,
                    mount_path,
                    fs_type: format!("{:?}", disk.file_system()),
                    options: vec![],
                    total_bytes: Some(total),
                    used_bytes: Some(used),
                    available_bytes: Some(available),
                    usage_percent: if total > 0 { Some((used as f64 / total as f64) * 100.0) } else { None },
                    is_removable: disk.is_removable(),
                    is_readonly: false,
                });
            }
        }
    }

    Ok(mounts)
}
