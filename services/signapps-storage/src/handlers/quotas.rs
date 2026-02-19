//! User storage quotas handlers.
#![allow(dead_code)]

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::{Error, Result};
use sqlx::{FromRow, Row};
use uuid::Uuid;

use crate::AppState;

/// User storage quota.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct StorageQuota {
    pub user_id: Uuid,
    /// Maximum storage in bytes (None = unlimited)
    pub max_storage_bytes: Option<i64>,
    /// Maximum number of files (None = unlimited)
    pub max_files: Option<i64>,
    /// Maximum file size in bytes (None = unlimited)
    pub max_file_size_bytes: Option<i64>,
    /// Current used storage in bytes
    pub used_storage_bytes: i64,
    /// Current number of files
    pub file_count: i64,
    /// Allowed buckets (empty = all allowed)
    pub allowed_buckets: Option<Vec<String>>,
    /// Created at
    pub created_at: DateTime<Utc>,
    /// Updated at
    pub updated_at: DateTime<Utc>,
}

/// Quota usage summary.
#[derive(Debug, Serialize)]
pub struct QuotaUsage {
    pub user_id: Uuid,
    pub storage: UsageInfo,
    pub files: UsageInfo,
    pub buckets: Vec<BucketUsage>,
}

/// Usage info for a resource.
#[derive(Debug, Serialize)]
pub struct UsageInfo {
    pub used: i64,
    pub limit: Option<i64>,
    pub percentage: Option<f32>,
}

/// Per-bucket usage.
#[derive(Debug, Serialize)]
pub struct BucketUsage {
    pub bucket: String,
    pub used_bytes: i64,
    pub file_count: i64,
}

/// Set quota request.
#[derive(Debug, Deserialize)]
pub struct SetQuotaRequest {
    /// Maximum storage in bytes
    pub max_storage_bytes: Option<i64>,
    /// Maximum number of files
    pub max_files: Option<i64>,
    /// Maximum file size in bytes
    pub max_file_size_bytes: Option<i64>,
    /// Allowed buckets
    pub allowed_buckets: Option<Vec<String>>,
}

/// Quota alert.
#[derive(Debug, Serialize)]
pub struct QuotaAlert {
    pub alert_type: QuotaAlertType,
    pub resource: String,
    pub current: i64,
    pub limit: i64,
    pub percentage: f32,
    pub message: String,
}

/// Quota alert types.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum QuotaAlertType {
    Warning,  // > 80%
    Critical, // > 90%
    Exceeded, // > 100%
}

/// Get current user's quota usage.
#[tracing::instrument(skip(state, user_id))]
pub async fn get_my_quota(
    State(state): State<AppState>,
    axum::Extension(user_id): axum::Extension<Uuid>,
) -> Result<Json<QuotaUsage>> {
    get_quota_impl(&state, user_id).await.map(Json)
}

/// Get quota for a specific user (admin only).
#[tracing::instrument(skip(state))]
pub async fn get_user_quota(
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
) -> Result<Json<QuotaUsage>> {
    get_quota_impl(&state, user_id).await.map(Json)
}

async fn get_quota_impl(state: &AppState, user_id: Uuid) -> Result<QuotaUsage> {
    let quota = sqlx::query(
        r#"
        SELECT * FROM storage.quotas WHERE user_id = $1
        "#,
    )
    .bind(user_id)
    .fetch_optional(state.pool.inner())
    .await?
    .map(|row| StorageQuota::from_row(&row))
    .transpose()?
    .unwrap_or_else(|| StorageQuota {
        user_id,
        max_storage_bytes: Some(10 * 1024 * 1024 * 1024), // Default 10GB
        max_files: Some(1000),
        max_file_size_bytes: None,
        used_storage_bytes: 0,
        file_count: 0,
        allowed_buckets: None,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    });

    let storage_percentage = quota.max_storage_bytes.map(|limit| {
        if limit > 0 {
            (quota.used_storage_bytes as f32 / limit as f32) * 100.0
        } else {
            0.0
        }
    });

    let files_percentage = quota.max_files.map(|limit| {
        if limit > 0 {
            (quota.file_count as f32 / limit as f32) * 100.0
        } else {
            0.0
        }
    });

    Ok(QuotaUsage {
        user_id,
        storage: UsageInfo {
            used: quota.used_storage_bytes,
            limit: quota.max_storage_bytes,
            percentage: storage_percentage,
        },
        files: UsageInfo {
            used: quota.file_count,
            limit: quota.max_files,
            percentage: files_percentage,
        },
        buckets: vec![], // TODO: Implement per-bucket breakdown if needed
    })
}

/// Set quota for a user (admin only).
#[tracing::instrument(skip(state))]
pub async fn set_user_quota(
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
    Json(request): Json<SetQuotaRequest>,
) -> Result<Json<StorageQuota>> {
    let quota = sqlx::query(
        r#"
        INSERT INTO storage.quotas (user_id, max_storage_bytes, max_files, max_file_size_bytes, allowed_buckets)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id) DO UPDATE SET
            max_storage_bytes = EXCLUDED.max_storage_bytes,
            max_files = EXCLUDED.max_files,
            max_file_size_bytes = EXCLUDED.max_file_size_bytes,
            allowed_buckets = EXCLUDED.allowed_buckets,
            updated_at = NOW()
        RETURNING *
        "#,
    )
    .bind(user_id)
    .bind(request.max_storage_bytes)
    .bind(request.max_files)
    .bind(request.max_file_size_bytes)
    .bind(request.allowed_buckets)
    .fetch_one(state.pool.inner())
    .await?;

    Ok(Json(StorageQuota::from_row(&quota)?))
}

/// Delete quota for a user (admin only).
#[tracing::instrument(skip(state))]
pub async fn delete_user_quota(
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
) -> Result<StatusCode> {
    let result = sqlx::query("DELETE FROM storage.quotas WHERE user_id = $1")
        .bind(user_id)
        .execute(state.pool.inner())
        .await?;

    if result.rows_affected() == 0 {
        return Err(Error::NotFound(format!(
            "Quota for user {} not found",
            user_id
        )));
    }

    Ok(StatusCode::NO_CONTENT)
}

/// Get quota alerts for current user.
#[tracing::instrument(skip(state, user_id))]
pub async fn get_quota_alerts(
    State(state): State<AppState>,
    axum::Extension(user_id): axum::Extension<Uuid>,
) -> Result<Json<Vec<QuotaAlert>>> {
    let usage = get_quota_impl(&state, user_id).await?;
    let mut alerts = Vec::new();

    if let Some(pct) = usage.storage.percentage {
        let limit = usage.storage.limit.unwrap_or(0);
        if pct > 100.0 {
            alerts.push(QuotaAlert {
                alert_type: QuotaAlertType::Exceeded,
                resource: "storage".to_string(),
                current: usage.storage.used,
                limit,
                percentage: pct,
                message: "Storage quota exceeded".to_string(),
            });
        } else if pct > 95.0 {
            alerts.push(QuotaAlert {
                alert_type: QuotaAlertType::Critical,
                resource: "storage".to_string(),
                current: usage.storage.used,
                limit,
                percentage: pct,
                message: "Storage quota critical".to_string(),
            });
        } else if pct > 80.0 {
            alerts.push(QuotaAlert {
                alert_type: QuotaAlertType::Warning,
                resource: "storage".to_string(),
                current: usage.storage.used,
                limit,
                percentage: pct,
                message: "Storage quota warning".to_string(),
            });
        }
    }

    if let Some(pct) = usage.files.percentage {
        let limit = usage.files.limit.unwrap_or(0);
        if pct > 100.0 {
            alerts.push(QuotaAlert {
                alert_type: QuotaAlertType::Exceeded,
                resource: "files".to_string(),
                current: usage.files.used,
                limit,
                percentage: pct,
                message: "File count quota exceeded".to_string(),
            });
        } else if pct > 95.0 {
            alerts.push(QuotaAlert {
                alert_type: QuotaAlertType::Critical,
                resource: "files".to_string(),
                current: usage.files.used,
                limit,
                percentage: pct,
                message: "File count quota critical".to_string(),
            });
        } else if pct > 80.0 {
            alerts.push(QuotaAlert {
                alert_type: QuotaAlertType::Warning,
                resource: "files".to_string(),
                current: usage.files.used,
                limit,
                percentage: pct,
                message: "File count quota warning".to_string(),
            });
        }
    }

    Ok(Json(alerts))
}

/// Check if an upload would exceed quota.
pub async fn check_quota(state: &AppState, user_id: Uuid, file_size: i64) -> Result<()> {
    let quota = sqlx::query(r#"SELECT * FROM storage.quotas WHERE user_id = $1"#)
        .bind(user_id)
        .fetch_optional(state.pool.inner())
        .await?
        .map(|row| StorageQuota::from_row(&row))
        .transpose()?;

    if let Some(quota) = quota {
        // Check max file size
        if let Some(max_size) = quota.max_file_size_bytes {
            if file_size > max_size {
                return Err(Error::BadRequest(format!(
                    "File size {} bytes exceeds limit of {} bytes",
                    file_size, max_size
                )));
            }
        }

        // Check total storage and file count (only if we have limits)
        if quota.max_storage_bytes.is_some() || quota.max_files.is_some() {
            // For strict correctness, we might want to do this check in a transaction with the update
            // but for now checking against current state is sufficient

            if let Some(max_storage) = quota.max_storage_bytes {
                if quota.used_storage_bytes + file_size > max_storage {
                    return Err(Error::Forbidden("Storage quota exceeded".to_string()));
                }
            }

            if let Some(max_files) = quota.max_files {
                if quota.file_count + 1 > max_files {
                    return Err(Error::Forbidden("File count quota exceeded".to_string()));
                }
            }
        }
    }

    Ok(())
}

/// Update usage after upload.
pub async fn record_upload(
    state: &AppState,
    user_id: Uuid,
    bucket: &str,
    key: &str,
    file_size: i64,
    content_type: Option<&str>,
) -> Result<()> {
    let mut tx = state.pool.inner().begin().await?;

    // 1. Record the file
    sqlx::query(
        r#"
        INSERT INTO storage.files (user_id, bucket, key, size, content_type)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id, bucket, key) DO UPDATE SET
            size = EXCLUDED.size,
            content_type = EXCLUDED.content_type,
            updated_at = NOW()
        "#,
    )
    .bind(user_id)
    .bind(bucket)
    .bind(key)
    .bind(file_size)
    .bind(content_type)
    .execute(&mut *tx)
    .await?;

    // 2. Increment quota
    sqlx::query(
        r#"
        INSERT INTO storage.quotas (user_id, used_storage_bytes, file_count)
        VALUES ($1, $2, 1)
        ON CONFLICT (user_id) DO UPDATE SET
            used_storage_bytes = storage.quotas.used_storage_bytes + $2,
            file_count = storage.quotas.file_count + 1,
            updated_at = NOW()
        "#,
    )
    .bind(user_id)
    .bind(file_size)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(())
}

/// Update usage after delete.
pub async fn record_delete(
    state: &AppState,
    user_id: Uuid,
    bucket: &str,
    key: &str,
    file_size: i64,
) -> Result<()> {
    let mut tx = state.pool.inner().begin().await?;

    // 1. Remove file record
    sqlx::query(
        r#"
        DELETE FROM storage.files 
        WHERE user_id = $1 AND bucket = $2 AND key = $3
        "#,
    )
    .bind(user_id)
    .bind(bucket)
    .bind(key)
    .execute(&mut *tx)
    .await?;

    // 2. Decrement quota
    sqlx::query(
        r#"
        UPDATE storage.quotas
        SET used_storage_bytes = GREATEST(0, used_storage_bytes - $2),
            file_count = GREATEST(0, file_count - 1),
            updated_at = NOW()
        WHERE user_id = $1
        "#,
    )
    .bind(user_id)
    .bind(file_size)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(())
}

/// Recalculate usage for a user (admin operation).
#[tracing::instrument(skip(state))]
pub async fn recalculate_usage(
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
) -> Result<Json<QuotaUsage>> {
    let mut tx = state.pool.inner().begin().await?;

    // 1. Calculate actual totals from stored files
    let row = sqlx::query(
        r#"
        SELECT 
            COALESCE(SUM(size), 0) as total_size,
            COUNT(*) as total_count
        FROM storage.files
        WHERE user_id = $1
        "#,
    )
    .bind(user_id)
    .fetch_one(&mut *tx)
    .await?;

    let total_size: i64 = row.get("total_size");
    let total_count: i64 = row.get("total_count");

    // 2. Sync with storage backend (Optional but good: check if files actually exist)
    // For now we trust our `storage.files` table as the source of truth,
    // but in a production environment, one might want to list OpenDAL and reconcile.

    // 3. Update the quota record
    sqlx::query(
        r#"
        INSERT INTO storage.quotas (user_id, used_storage_bytes, file_count)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id) DO UPDATE SET
            used_storage_bytes = EXCLUDED.used_storage_bytes,
            file_count = EXCLUDED.file_count,
            updated_at = NOW()
        "#,
    )
    .bind(user_id)
    .bind(total_size)
    .bind(total_count)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    get_quota_impl(&state, user_id).await.map(Json)
}

/// Update usage after move.
pub async fn record_move(
    state: &AppState,
    user_id: Uuid,
    src_bucket: &str,
    src_key: &str,
    dst_bucket: &str,
    dst_key: &str,
) -> Result<()> {
    sqlx::query(
        r#"
        UPDATE storage.files
        SET bucket = $4, key = $5, updated_at = NOW()
        WHERE user_id = $1 AND bucket = $2 AND key = $3
        "#,
    )
    .bind(user_id)
    .bind(src_bucket)
    .bind(src_key)
    .bind(dst_bucket)
    .bind(dst_key)
    .execute(state.pool.inner())
    .await?;

    Ok(())
}

/// Update usage after copy.
pub async fn record_copy(
    state: &AppState,
    user_id: Uuid,
    src_bucket: &str,
    src_key: &str,
    dst_bucket: &str,
    dst_key: &str,
) -> Result<()> {
    let mut tx = state.pool.inner().begin().await?;

    // 1. Get info of source file
    let file_row = sqlx::query(
        r#"
        SELECT size, content_type FROM storage.files
        WHERE user_id = $1 AND bucket = $2 AND key = $3
        "#,
    )
    .bind(user_id)
    .bind(src_bucket)
    .bind(src_key)
    .fetch_optional(&mut *tx)
    .await?;

    if let Some(row) = file_row {
        let size: i64 = row.get::<i64, _>("size");
        let content_type: Option<String> = row.get::<Option<String>, _>("content_type");

        // 2. Record the new file
        sqlx::query(
            r#"
            INSERT INTO storage.files (user_id, bucket, key, size, content_type)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (user_id, bucket, key) DO UPDATE SET
                size = EXCLUDED.size,
                content_type = EXCLUDED.content_type,
                updated_at = NOW()
            "#,
        )
        .bind(user_id)
        .bind(dst_bucket)
        .bind(dst_key)
        .bind(size)
        .bind(content_type)
        .execute(&mut *tx)
        .await?;

        // 3. Increment quota
        sqlx::query(
            r#"
            INSERT INTO storage.quotas (user_id, used_storage_bytes, file_count)
            VALUES ($1, $2, 1)
            ON CONFLICT (user_id) DO UPDATE SET
                used_storage_bytes = storage.quotas.used_storage_bytes + $2,
                file_count = storage.quotas.file_count + 1,
                updated_at = NOW()
            "#,
        )
        .bind(user_id)
        .bind(size)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(())
}

/// Get all users over quota (admin only).

#[tracing::instrument(skip(state))]
pub async fn get_users_over_quota(State(state): State<AppState>) -> Result<Json<Vec<QuotaUsage>>> {
    // Simple query to find users where used > max
    let users = sqlx::query_as::<_, StorageQuota>(
        r#"
        SELECT * FROM storage.quotas 
        WHERE (max_storage_bytes IS NOT NULL AND used_storage_bytes > max_storage_bytes)
           OR (max_files IS NOT NULL AND file_count > max_files)
        "#,
    )
    .fetch_all(state.pool.inner())
    .await?;

    let mut usages = Vec::new();
    for quota in users {
        usages.push(QuotaUsage {
            user_id: quota.user_id,
            storage: UsageInfo {
                used: quota.used_storage_bytes,
                limit: quota.max_storage_bytes,
                percentage: Some(100.0), // Simplified
            },
            files: UsageInfo {
                used: quota.file_count,
                limit: quota.max_files,
                percentage: Some(100.0), // Simplified
            },
            buckets: vec![],
        });
    }

    Ok(Json(usages))
}

/// Determine the alert type based on usage and limits.
pub fn calculate_alert_type(used: i64, limit: Option<i64>) -> Option<QuotaAlertType> {
    let limit = limit?;
    if limit <= 0 {
        return None;
    }

    let percentage = (used as f64 / limit as f64) * 100.0;
    if percentage >= 100.0 {
        Some(QuotaAlertType::Exceeded)
    } else if percentage >= 90.0 {
        Some(QuotaAlertType::Critical)
    } else if percentage >= 80.0 {
        Some(QuotaAlertType::Warning)
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_quota_alert_logic() {
        let limit = Some(1000);

        // No alert
        assert_eq!(calculate_alert_type(500, limit), None);
        assert_eq!(calculate_alert_type(799, limit), None);

        // Warning (80%)
        assert_eq!(
            calculate_alert_type(800, limit),
            Some(QuotaAlertType::Warning)
        );
        assert_eq!(
            calculate_alert_type(899, limit),
            Some(QuotaAlertType::Warning)
        );

        // Critical (90%)
        assert_eq!(
            calculate_alert_type(900, limit),
            Some(QuotaAlertType::Critical)
        );
        assert_eq!(
            calculate_alert_type(999, limit),
            Some(QuotaAlertType::Critical)
        );

        // Exceeded (100%+)
        assert_eq!(
            calculate_alert_type(1000, limit),
            Some(QuotaAlertType::Exceeded)
        );
        assert_eq!(
            calculate_alert_type(1100, limit),
            Some(QuotaAlertType::Exceeded)
        );
    }

    #[test]
    fn test_quota_alert_no_limit() {
        assert_eq!(calculate_alert_type(1000, None), None);
    }

    #[test]
    fn test_quota_alert_zero_limit() {
        assert_eq!(calculate_alert_type(1000, Some(0)), None);
    }
}
