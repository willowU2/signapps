//! RAID management handlers.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use signapps_common::{Error, Result};
use signapps_db::models::{Disk, RaidArray, RaidEvent, RaidHealth};
use signapps_db::repositories::RaidRepository;
use uuid::Uuid;

use crate::AppState;

/// List query parameters.
#[derive(Debug, Deserialize)]
/// Query parameters for filtering results.
pub struct ListQuery {
    pub limit: Option<i64>,
}

/// Array response with disks.
#[derive(Debug, Serialize)]
/// Response for Array.
pub struct ArrayResponse {
    #[serde(flatten)]
    pub array: RaidArray,
    pub disks: Vec<Disk>,
    pub usage_percent: Option<f64>,
}

/// Disk action request.
#[derive(Debug, Deserialize)]
/// Request body for DiskAction.
pub struct DiskActionRequest {
    pub disk_path: String,
}

// =========================================================================
// Arrays
// =========================================================================

/// List all RAID arrays.
#[tracing::instrument(skip_all)]
pub async fn list_arrays(State(state): State<AppState>) -> Result<Json<Vec<ArrayResponse>>> {
    let repo = RaidRepository::new(&state.pool);
    let arrays = repo.list_arrays().await?;

    let mut responses = Vec::new();
    for array in arrays {
        let disks = repo.list_array_disks(array.id).await?;

        let usage_percent = match (array.total_size_bytes, array.used_size_bytes) {
            (Some(total), Some(used)) if total > 0 => Some((used as f64 / total as f64) * 100.0),
            _ => None,
        };

        responses.push(ArrayResponse {
            array,
            disks,
            usage_percent,
        });
    }

    Ok(Json(responses))
}

/// Get array by ID.
#[tracing::instrument(skip_all)]
pub async fn get_array(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ArrayResponse>> {
    let repo = RaidRepository::new(&state.pool);

    let array = repo
        .find_array(id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Array {}", id)))?;

    let disks = repo.list_array_disks(id).await?;

    let usage_percent = match (array.total_size_bytes, array.used_size_bytes) {
        (Some(total), Some(used)) if total > 0 => Some((used as f64 / total as f64) * 100.0),
        _ => None,
    };

    Ok(Json(ArrayResponse {
        array,
        disks,
        usage_percent,
    }))
}

/// Get array by name.
#[tracing::instrument(skip_all)]
pub async fn get_array_by_name(
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> Result<Json<ArrayResponse>> {
    let repo = RaidRepository::new(&state.pool);

    let array = repo
        .find_array_by_name(&name)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Array {}", name)))?;

    let disks = repo.list_array_disks(array.id).await?;

    let usage_percent = match (array.total_size_bytes, array.used_size_bytes) {
        (Some(total), Some(used)) if total > 0 => Some((used as f64 / total as f64) * 100.0),
        _ => None,
    };

    Ok(Json(ArrayResponse {
        array,
        disks,
        usage_percent,
    }))
}

/// Delete array (removes from monitoring, not actual array).
#[tracing::instrument(skip_all)]
pub async fn delete_array(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    let repo = RaidRepository::new(&state.pool);

    let _array = repo
        .find_array(id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Array {}", id)))?;

    repo.delete_array(id).await?;

    tracing::info!(array_id = %id, "Array removed from monitoring");

    Ok(StatusCode::NO_CONTENT)
}

// =========================================================================
// Disks
// =========================================================================

/// List all disks.
#[tracing::instrument(skip_all)]
pub async fn list_disks(State(state): State<AppState>) -> Result<Json<Vec<Disk>>> {
    let repo = RaidRepository::new(&state.pool);
    let disks = repo.list_disks().await?;
    Ok(Json(disks))
}

/// Get disk by ID.
#[tracing::instrument(skip_all)]
pub async fn get_disk(State(state): State<AppState>, Path(id): Path<Uuid>) -> Result<Json<Disk>> {
    let repo = RaidRepository::new(&state.pool);

    let disk = repo
        .find_disk(id)
        .await?
        .ok_or_else(|| Error::DiskNotFound(id.to_string()))?;

    Ok(Json(disk))
}

/// Scan for disks (refresh disk list).
#[tracing::instrument(skip_all)]
pub async fn scan_disks(State(state): State<AppState>) -> Result<Json<Vec<Disk>>> {
    let repo = RaidRepository::new(&state.pool);

    // Use sysinfo to detect disks (new API in 0.30+)
    let disks_info = sysinfo::Disks::new_with_refreshed_list();

    let mut disks = Vec::new();

    for disk in disks_info.list() {
        let path = disk.name().to_string_lossy().to_string();

        // Skip if not a block device path
        if !path.starts_with("/dev/") && !path.contains(':') {
            continue;
        }

        let size = disk.total_space() as i64;

        let db_disk = repo.upsert_disk(&path, None, None, Some(size)).await?;

        disks.push(db_disk);
    }

    tracing::info!(count = disks.len(), "Disk scan completed");

    Ok(Json(disks))
}

// =========================================================================
// Events
// =========================================================================

/// List recent RAID events.
#[tracing::instrument(skip_all)]
pub async fn list_events(
    State(state): State<AppState>,
    Query(query): Query<ListQuery>,
) -> Result<Json<Vec<RaidEvent>>> {
    let repo = RaidRepository::new(&state.pool);
    let limit = query.limit.unwrap_or(50).min(200);
    let events = repo.list_events(limit).await?;
    Ok(Json(events))
}

/// Get array events.
#[tracing::instrument(skip_all)]
pub async fn get_array_events(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(query): Query<ListQuery>,
) -> Result<Json<Vec<RaidEvent>>> {
    let repo = RaidRepository::new(&state.pool);

    // Verify array exists
    let _array = repo
        .find_array(id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Array {}", id)))?;

    // Get all events and filter (could optimize with SQL later)
    let all_events = repo.list_events(query.limit.unwrap_or(100)).await?;
    let events: Vec<_> = all_events
        .into_iter()
        .filter(|e| e.array_id == id)
        .collect();

    Ok(Json(events))
}

// =========================================================================
// Health
// =========================================================================

/// Get overall RAID health.
#[tracing::instrument(skip_all)]
pub async fn get_health(State(state): State<AppState>) -> Result<Json<RaidHealth>> {
    let repo = RaidRepository::new(&state.pool);
    let health = repo.get_health().await?;
    Ok(Json(health))
}

// =========================================================================
// Operations (requires actual mdadm/ZFS commands)
// =========================================================================

/// Trigger array rebuild.
#[tracing::instrument(skip_all)]
pub async fn rebuild_array(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    let repo = RaidRepository::new(&state.pool);

    let array = repo
        .find_array(id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Array {}", id)))?;

    // Log the rebuild request
    repo.create_event(
        id,
        "rebuild_requested",
        "info",
        Some("Manual rebuild requested"),
    )
    .await?;

    // In production, this would execute mdadm or zpool commands
    // For now, just log and return success
    tracing::info!(array = %array.name, "Rebuild requested");

    Ok(Json(serde_json::json!({
        "success": true,
        "message": format!("Rebuild requested for array {}", array.name),
        "array_id": id
    })))
}

/// Add disk to array.
#[tracing::instrument(skip_all)]
pub async fn add_disk_to_array(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<DiskActionRequest>,
) -> Result<Json<serde_json::Value>> {
    let repo = RaidRepository::new(&state.pool);

    let array = repo
        .find_array(id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Array {}", id)))?;

    let disk = repo
        .find_disk_by_path(&payload.disk_path)
        .await?
        .ok_or_else(|| Error::DiskNotFound(payload.disk_path.clone()))?;

    if disk.array_id.is_some() {
        return Err(Error::BadRequest("Disk is already in an array".to_string()));
    }

    // Get next slot number
    let current_disks = repo.list_array_disks(id).await?;
    let next_slot = current_disks
        .iter()
        .filter_map(|d| d.slot_number)
        .max()
        .unwrap_or(-1)
        + 1;

    // Assign disk to array
    repo.assign_to_array(disk.id, id, next_slot).await?;

    // Log event
    repo.create_event(
        id,
        "disk_added",
        "info",
        Some(&format!("Disk {} added to array", payload.disk_path)),
    )
    .await?;

    tracing::info!(array = %array.name, disk = %payload.disk_path, "Disk added to array");

    Ok(Json(serde_json::json!({
        "success": true,
        "message": format!("Disk {} added to array {}", payload.disk_path, array.name),
        "array_id": id,
        "disk_id": disk.id
    })))
}

/// Remove disk from array.
#[tracing::instrument(skip_all)]
pub async fn remove_disk_from_array(
    State(state): State<AppState>,
    Path((array_id, disk_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>> {
    let repo = RaidRepository::new(&state.pool);

    let array = repo
        .find_array(array_id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Array {}", array_id)))?;

    let disk = repo
        .find_disk(disk_id)
        .await?
        .ok_or_else(|| Error::DiskNotFound(disk_id.to_string()))?;

    if disk.array_id != Some(array_id) {
        return Err(Error::BadRequest("Disk is not in this array".to_string()));
    }

    // Remove from array (set array_id to NULL)
    sqlx::query("UPDATE storage.disks SET array_id = NULL, slot_number = NULL WHERE id = $1")
        .bind(disk_id)
        .execute(state.pool.inner())
        .await?;

    // Log event
    repo.create_event(
        array_id,
        "disk_removed",
        "warning",
        Some(&format!("Disk {} removed from array", disk.device_path)),
    )
    .await?;

    tracing::info!(array = %array.name, disk = %disk.device_path, "Disk removed from array");

    Ok(Json(serde_json::json!({
        "success": true,
        "message": format!("Disk removed from array {}", array.name),
        "array_id": array_id,
        "disk_id": disk_id
    })))
}
