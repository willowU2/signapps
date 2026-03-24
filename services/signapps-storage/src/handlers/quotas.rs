//! User storage quota handlers.
//!
//! All persistence is delegated to `signapps_db::QuotaRepository` so that
//! quota logic is reusable across services and is tested in one place.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use signapps_common::{Error, Result};
use signapps_db::{
    models::{SetQuotaLimits, StorageQuota, UpdateQuotaUsage},
    QuotaRepository,
};
use uuid::Uuid;

use crate::AppState;

// ─── Response types ──────────────────────────────────────────────────────────

/// Quota usage summary returned to callers.
#[derive(Debug, Serialize)]
pub struct QuotaUsage {
    pub user_id: Uuid,
    pub storage: UsageInfo,
    pub files: UsageInfo,
    pub buckets: Vec<BucketUsage>,
}

/// Usage info for a single resource dimension.
#[derive(Debug, Serialize)]
pub struct UsageInfo {
    pub used: i64,
    pub limit: Option<i64>,
    /// Percentage of limit consumed (None when unlimited).
    pub percentage: Option<f32>,
}

/// Per-bucket usage (populated on demand; empty in basic path).
#[derive(Debug, Serialize)]
pub struct BucketUsage {
    pub bucket: String,
    pub used_bytes: i64,
    pub file_count: i64,
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

/// Severity of a quota alert.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum QuotaAlertType {
    Warning,  // > 80 %
    Critical, // > 90 %
    Exceeded, // > 100 %
}

// ─── Request types ────────────────────────────────────────────────────────────

/// Admin request to configure limits for a user.
#[derive(Debug, Deserialize)]
pub struct SetQuotaRequest {
    pub max_storage_bytes: Option<i64>,
    pub max_files: Option<i64>,
    pub max_file_size_bytes: Option<i64>,
    pub allowed_buckets: Option<Vec<String>>,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

fn default_quota(user_id: Uuid) -> StorageQuota {
    StorageQuota {
        user_id,
        max_storage_bytes: Some(10 * 1024 * 1024 * 1024), // 10 GiB
        max_files: Some(1_000),
        max_file_size_bytes: None,
        used_storage_bytes: 0,
        file_count: 0,
        allowed_buckets: None,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
}

fn quota_to_usage(quota: StorageQuota) -> QuotaUsage {
    let storage_pct = quota.max_storage_bytes.map(|limit| {
        if limit > 0 {
            (quota.used_storage_bytes as f32 / limit as f32) * 100.0
        } else {
            0.0
        }
    });
    let files_pct = quota.max_files.map(|limit| {
        if limit > 0 {
            (quota.file_count as f32 / limit as f32) * 100.0
        } else {
            0.0
        }
    });

    QuotaUsage {
        user_id: quota.user_id,
        storage: UsageInfo {
            used: quota.used_storage_bytes,
            limit: quota.max_storage_bytes,
            percentage: storage_pct,
        },
        files: UsageInfo {
            used: quota.file_count,
            limit: quota.max_files,
            percentage: files_pct,
        },
        buckets: vec![],
    }
}

/// Determine alert level for a resource dimension.
pub fn calculate_alert_type(used: i64, limit: Option<i64>) -> Option<QuotaAlertType> {
    let limit = limit?;
    if limit <= 0 {
        return None;
    }
    let pct = (used as f64 / limit as f64) * 100.0;
    if pct >= 100.0 {
        Some(QuotaAlertType::Exceeded)
    } else if pct >= 90.0 {
        Some(QuotaAlertType::Critical)
    } else if pct >= 80.0 {
        Some(QuotaAlertType::Warning)
    } else {
        None
    }
}

// ─── Core: get_quota ─────────────────────────────────────────────────────────

/// Fetch quota usage for any user, falling back to defaults when no row exists.
async fn get_quota_impl(state: &AppState, user_id: Uuid) -> Result<QuotaUsage> {
    let repo = QuotaRepository::new(&state.pool);
    let quota = repo
        .get_quota(user_id)
        .await?
        .unwrap_or_else(|| default_quota(user_id));
    Ok(quota_to_usage(quota))
}

// ─── Core: update_quota ──────────────────────────────────────────────────────

/// Directly overwrite the usage counters for a user (admin / recalculate path).
async fn update_quota_impl(
    state: &AppState,
    user_id: Uuid,
    used_storage_bytes: i64,
    file_count: i64,
) -> Result<StorageQuota> {
    let repo = QuotaRepository::new(&state.pool);
    repo.update_quota_usage(
        user_id,
        UpdateQuotaUsage {
            used_storage_bytes,
            file_count,
        },
    )
    .await
}

// ─── HTTP handlers ────────────────────────────────────────────────────────────

/// GET /quotas/me — current user's quota usage.
#[tracing::instrument(skip(state, user_id))]
pub async fn get_my_quota(
    State(state): State<AppState>,
    axum::Extension(user_id): axum::Extension<Uuid>,
) -> Result<Json<QuotaUsage>> {
    get_quota_impl(&state, user_id).await.map(Json)
}

/// GET /quotas/users/:user_id — admin: fetch any user's quota usage.
#[tracing::instrument(skip(state))]
pub async fn get_user_quota(
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
) -> Result<Json<QuotaUsage>> {
    get_quota_impl(&state, user_id).await.map(Json)
}

/// PUT /quotas/users/:user_id — admin: set quota limits for a user.
#[tracing::instrument(skip(state))]
pub async fn set_user_quota(
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
    Json(req): Json<SetQuotaRequest>,
) -> Result<Json<StorageQuota>> {
    let repo = QuotaRepository::new(&state.pool);
    let quota = repo
        .set_quota_limits(
            user_id,
            SetQuotaLimits {
                max_storage_bytes: req.max_storage_bytes,
                max_files: req.max_files,
                max_file_size_bytes: req.max_file_size_bytes,
                allowed_buckets: req.allowed_buckets,
            },
        )
        .await?;
    Ok(Json(quota))
}

/// DELETE /quotas/users/:user_id — admin: remove quota row (user reverts to defaults).
#[tracing::instrument(skip(state))]
pub async fn delete_user_quota(
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
) -> Result<StatusCode> {
    let repo = QuotaRepository::new(&state.pool);
    let deleted = repo.delete_quota(user_id).await?;
    if deleted {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(Error::NotFound(format!(
            "Quota for user {} not found",
            user_id
        )))
    }
}

/// GET /quotas/me/alerts — active quota alerts for the current user.
#[tracing::instrument(skip(state, user_id))]
pub async fn get_quota_alerts(
    State(state): State<AppState>,
    axum::Extension(user_id): axum::Extension<Uuid>,
) -> Result<Json<Vec<QuotaAlert>>> {
    let usage = get_quota_impl(&state, user_id).await?;
    let mut alerts = Vec::new();

    let push_alert = |alerts: &mut Vec<QuotaAlert>,
                      resource: &str,
                      info: &UsageInfo,
                      alert_type: QuotaAlertType| {
        let limit = info.limit.unwrap_or(0);
        let pct = info.percentage.unwrap_or(0.0);
        let msg = match alert_type {
            QuotaAlertType::Exceeded => format!("{resource} quota exceeded"),
            QuotaAlertType::Critical => format!("{resource} quota critical"),
            QuotaAlertType::Warning => format!("{resource} quota warning"),
        };
        alerts.push(QuotaAlert {
            alert_type,
            resource: resource.to_string(),
            current: info.used,
            limit,
            percentage: pct,
            message: msg,
        });
    };

    if let Some(alert) = calculate_alert_type(usage.storage.used, usage.storage.limit) {
        push_alert(&mut alerts, "storage", &usage.storage, alert);
    }
    if let Some(alert) = calculate_alert_type(usage.files.used, usage.files.limit) {
        push_alert(&mut alerts, "files", &usage.files, alert);
    }

    Ok(Json(alerts))
}

/// POST /quotas/users/:user_id/recalculate — admin: recalculate usage from storage.files.
#[tracing::instrument(skip(state))]
pub async fn recalculate_usage(
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
) -> Result<Json<QuotaUsage>> {
    let repo = QuotaRepository::new(&state.pool);
    let quota = repo.recalculate_from_files(user_id).await?;
    Ok(Json(quota_to_usage(quota)))
}

/// GET /quotas/over-limit — admin: list users who have exceeded their quota.
#[tracing::instrument(skip(state))]
pub async fn get_users_over_quota(State(state): State<AppState>) -> Result<Json<Vec<QuotaUsage>>> {
    let repo = QuotaRepository::new(&state.pool);
    let rows = repo.list_over_quota().await?;
    let usages = rows.into_iter().map(quota_to_usage).collect();
    Ok(Json(usages))
}

// ─── Internal helpers called by files.rs ─────────────────────────────────────

/// Check whether an upload of `file_size` bytes would exceed the user's quota.
pub async fn check_quota(state: &AppState, user_id: Uuid, file_size: i64) -> Result<()> {
    let repo = QuotaRepository::new(&state.pool);
    let Some(quota) = repo.get_quota(user_id).await? else {
        return Ok(()); // No quota row → no limits enforced
    };

    if let Some(max_size) = quota.max_file_size_bytes {
        if file_size > max_size {
            return Err(Error::BadRequest(format!(
                "File size {file_size} bytes exceeds per-file limit of {max_size} bytes"
            )));
        }
    }
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

    Ok(())
}

/// Record a successful upload: insert file row and atomically increment quota.
pub async fn record_upload(
    state: &AppState,
    user_id: Uuid,
    bucket: &str,
    key: &str,
    file_size: i64,
    content_type: Option<&str>,
) -> Result<Uuid> {
    let mut tx = state
        .pool
        .inner()
        .begin()
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

    // 1. Persist file record (upsert on duplicate path).
    let row = sqlx::query(
        r#"
        INSERT INTO storage.files (user_id, bucket, key, size, content_type)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id, bucket, key) DO UPDATE SET
            size         = EXCLUDED.size,
            content_type = EXCLUDED.content_type,
            updated_at   = NOW()
        RETURNING id
        "#,
    )
    .bind(user_id)
    .bind(bucket)
    .bind(key)
    .bind(file_size)
    .bind(content_type)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    use sqlx::Row as _;
    let file_id: Uuid = row.get("id");

    // 2. Atomically increment quota counters.
    sqlx::query(
        r#"
        INSERT INTO storage.quotas (user_id, used_storage_bytes, file_count)
        VALUES ($1, $2, 1)
        ON CONFLICT (user_id) DO UPDATE SET
            used_storage_bytes = storage.quotas.used_storage_bytes + $2,
            file_count         = storage.quotas.file_count + 1,
            updated_at         = NOW()
        "#,
    )
    .bind(user_id)
    .bind(file_size)
    .execute(&mut *tx)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    tx.commit()
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

    Ok(file_id)
}

/// Record a deletion: remove file row and atomically decrement quota.
pub async fn record_delete(
    state: &AppState,
    user_id: Uuid,
    bucket: &str,
    key: &str,
    file_size: i64,
) -> Result<()> {
    let mut tx = state
        .pool
        .inner()
        .begin()
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

    sqlx::query("DELETE FROM storage.files WHERE user_id = $1 AND bucket = $2 AND key = $3")
        .bind(user_id)
        .bind(bucket)
        .bind(key)
        .execute(&mut *tx)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

    sqlx::query(
        r#"
        UPDATE storage.quotas
        SET used_storage_bytes = GREATEST(0, used_storage_bytes - $2),
            file_count         = GREATEST(0, file_count - 1),
            updated_at         = NOW()
        WHERE user_id = $1
        "#,
    )
    .bind(user_id)
    .bind(file_size)
    .execute(&mut *tx)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    tx.commit()
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

    Ok(())
}

/// Record a move (rename): update the file path without changing quota counters.
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
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    Ok(())
}

/// Record a copy: insert destination file row and increment quota by the source size.
pub async fn record_copy(
    state: &AppState,
    user_id: Uuid,
    src_bucket: &str,
    src_key: &str,
    dst_bucket: &str,
    dst_key: &str,
) -> Result<()> {
    let mut tx = state
        .pool
        .inner()
        .begin()
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

    use sqlx::Row as _;

    let file_row = sqlx::query(
        "SELECT size, content_type FROM storage.files WHERE user_id = $1 AND bucket = $2 AND key = $3",
    )
    .bind(user_id)
    .bind(src_bucket)
    .bind(src_key)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    if let Some(row) = file_row {
        let size: i64 = row.get("size");
        let content_type: Option<String> = row.get("content_type");

        sqlx::query(
            r#"
            INSERT INTO storage.files (user_id, bucket, key, size, content_type)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (user_id, bucket, key) DO UPDATE SET
                size         = EXCLUDED.size,
                content_type = EXCLUDED.content_type,
                updated_at   = NOW()
            "#,
        )
        .bind(user_id)
        .bind(dst_bucket)
        .bind(dst_key)
        .bind(size)
        .bind(content_type)
        .execute(&mut *tx)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        sqlx::query(
            r#"
            INSERT INTO storage.quotas (user_id, used_storage_bytes, file_count)
            VALUES ($1, $2, 1)
            ON CONFLICT (user_id) DO UPDATE SET
                used_storage_bytes = storage.quotas.used_storage_bytes + $2,
                file_count         = storage.quotas.file_count + 1,
                updated_at         = NOW()
            "#,
        )
        .bind(user_id)
        .bind(size)
        .execute(&mut *tx)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
    }

    tx.commit()
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

    Ok(())
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_quota_alert_logic() {
        let limit = Some(1_000_i64);

        assert_eq!(calculate_alert_type(500, limit), None);
        assert_eq!(calculate_alert_type(799, limit), None);

        assert_eq!(
            calculate_alert_type(800, limit),
            Some(QuotaAlertType::Warning)
        );
        assert_eq!(
            calculate_alert_type(899, limit),
            Some(QuotaAlertType::Warning)
        );
        assert_eq!(
            calculate_alert_type(900, limit),
            Some(QuotaAlertType::Critical)
        );
        assert_eq!(
            calculate_alert_type(999, limit),
            Some(QuotaAlertType::Critical)
        );
        assert_eq!(
            calculate_alert_type(1_000, limit),
            Some(QuotaAlertType::Exceeded)
        );
        assert_eq!(
            calculate_alert_type(1_100, limit),
            Some(QuotaAlertType::Exceeded)
        );
    }

    #[test]
    fn test_quota_alert_no_limit() {
        assert_eq!(calculate_alert_type(1_000, None), None);
    }

    #[test]
    fn test_quota_alert_zero_limit() {
        assert_eq!(calculate_alert_type(1_000, Some(0)), None);
    }
}
