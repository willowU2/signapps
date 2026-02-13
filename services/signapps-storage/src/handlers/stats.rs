//! Storage statistics handler.

use axum::{extract::State, Json};
use serde::Serialize;
use signapps_common::Result;
use signapps_db::repositories::RaidRepository;

use crate::AppState;

#[derive(Serialize)]
pub struct StorageStatsResponse {
    pub total_bytes: i64,
    pub used_bytes: i64,
    pub free_bytes: i64,
    pub buckets_count: usize,
    pub files_count: usize,
    pub arrays_count: usize,
    pub health_status: String,
}

/// Get aggregated storage statistics.
pub async fn get_stats(State(state): State<AppState>) -> Result<Json<StorageStatsResponse>> {
    let buckets = state.minio.list_buckets().await.unwrap_or_default();
    let buckets_count = buckets.len();

    // Aggregate object stats across all buckets
    let mut total_objects = 0usize;
    let mut total_size: i64 = 0;
    for bucket in &buckets {
        if let Ok(stats) = state.minio.get_bucket_stats(&bucket.name).await {
            total_objects += stats.total_objects;
            total_size += stats.total_size_bytes;
        }
    }

    // Count RAID arrays
    let raid_repo = RaidRepository::new(&state.pool);
    let arrays_count = raid_repo
        .list_arrays()
        .await
        .map(|a| a.len())
        .unwrap_or(0);

    // Health: healthy if MinIO is reachable
    let health_status = if state.minio.list_buckets().await.is_ok() {
        "healthy"
    } else {
        "critical"
    };

    Ok(Json(StorageStatsResponse {
        total_bytes: 0,
        used_bytes: total_size,
        free_bytes: 0,
        buckets_count,
        files_count: total_objects,
        arrays_count,
        health_status: health_status.to_string(),
    }))
}
