//! Admin storage settings management.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use signapps_common::{Error, Result};
use uuid::Uuid;

use crate::AppState;

/// Storage Rule Model
#[derive(Debug, Serialize, Deserialize)]
pub struct StorageRule {
    pub id: Uuid,
    pub file_type: String,
    pub mime_type_pattern: Option<String>,
    pub target_bucket: String,
    pub target_backend: String,
    pub is_active: bool,
}

/// Create/Update Storage Rule Request
#[derive(Debug, Deserialize)]
pub struct UpsertStorageRule {
    pub file_type: String,
    pub mime_type_pattern: Option<String>,
    pub target_bucket: String,
    pub target_backend: String,
    pub is_active: bool,
}

/// AI Indexing Rule Model
#[derive(Debug, Serialize, Deserialize)]
pub struct IndexingRule {
    pub id: Uuid,
    pub folder_path: String,
    pub bucket: String,
    pub include_subfolders: bool,
    pub file_types_allowed: Option<Vec<String>>,
    pub collection_name: Option<String>,
    pub is_active: bool,
}

/// Create/Update AI Indexing Rule Request
#[derive(Debug, Deserialize)]
pub struct UpsertIndexingRule {
    pub folder_path: String,
    pub bucket: String,
    pub include_subfolders: bool,
    pub file_types_allowed: Option<Vec<String>>,
    pub collection_name: Option<String>,
    pub is_active: bool,
}

// =========================================================================
// Storage Rules Handlers
// =========================================================================

/// List all storage rules
#[tracing::instrument(skip(state))]
pub async fn list_storage_rules(State(state): State<AppState>) -> Result<Json<Vec<StorageRule>>> {
    let rules = sqlx::query_as!(
        StorageRule,
        r#"
        SELECT id, file_type, mime_type_pattern, target_bucket, target_backend, is_active
        FROM storage_rules
        ORDER BY created_at DESC
        "#,
    )
    .fetch_all(state.pool.inner())
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    Ok(Json(rules))
}

/// Create a new storage rule
#[tracing::instrument(skip(state, payload))]
pub async fn create_storage_rule(
    State(state): State<AppState>,
    Json(payload): Json<UpsertStorageRule>,
) -> Result<Json<StorageRule>> {
    let rule = sqlx::query_as!(
        StorageRule,
        r#"
        INSERT INTO storage_rules (file_type, mime_type_pattern, target_bucket, target_backend, is_active)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, file_type, mime_type_pattern, target_bucket, target_backend, is_active
        "#,
        payload.file_type,
        payload.mime_type_pattern,
        payload.target_bucket,
        payload.target_backend,
        payload.is_active
    )
    .fetch_one(state.pool.inner())
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    Ok(Json(rule))
}

/// Update a storage rule
#[tracing::instrument(skip(state, payload))]
pub async fn update_storage_rule(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpsertStorageRule>,
) -> Result<Json<StorageRule>> {
    let rule = sqlx::query_as!(
        StorageRule,
        r#"
        UPDATE storage_rules
        SET file_type = $1, mime_type_pattern = $2, target_bucket = $3, target_backend = $4, is_active = $5, updated_at = NOW()
        WHERE id = $6
        RETURNING id, file_type, mime_type_pattern, target_bucket, target_backend, is_active
        "#,
        payload.file_type,
        payload.mime_type_pattern,
        payload.target_bucket,
        payload.target_backend,
        payload.is_active,
        id
    )
    .fetch_one(state.pool.inner())
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    Ok(Json(rule))
}

/// Delete a storage rule
#[tracing::instrument(skip(state))]
pub async fn delete_storage_rule(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    sqlx::query!(
        r#"
        DELETE FROM storage_rules WHERE id = $1
        "#,
        id
    )
    .execute(state.pool.inner())
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    Ok(StatusCode::NO_CONTENT)
}

// =========================================================================
// AI Indexing Rules Handlers
// =========================================================================

/// List all AI indexing rules
#[tracing::instrument(skip(state))]
pub async fn list_indexing_rules(State(state): State<AppState>) -> Result<Json<Vec<IndexingRule>>> {
    let rules = sqlx::query_as!(
        IndexingRule,
        r#"
        SELECT id, folder_path, bucket, include_subfolders, file_types_allowed, collection_name, is_active
        FROM ai_indexing_rules
        ORDER BY created_at DESC
        "#,
    )
    .fetch_all(state.pool.inner())
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    Ok(Json(rules))
}

/// Create a new indexing rule
#[tracing::instrument(skip(state, payload))]
pub async fn create_indexing_rule(
    State(state): State<AppState>,
    Json(payload): Json<UpsertIndexingRule>,
) -> Result<Json<IndexingRule>> {
    let rule = sqlx::query_as!(
        IndexingRule,
        r#"
        INSERT INTO ai_indexing_rules (folder_path, bucket, include_subfolders, file_types_allowed, collection_name, is_active)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, folder_path, bucket, include_subfolders, file_types_allowed, collection_name, is_active
        "#,
        payload.folder_path,
        payload.bucket,
        payload.include_subfolders,
        payload.file_types_allowed.as_deref(),
        payload.collection_name,
        payload.is_active
    )
    .fetch_one(state.pool.inner())
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    Ok(Json(rule))
}

/// Update an indexing rule
#[tracing::instrument(skip(state, payload))]
pub async fn update_indexing_rule(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpsertIndexingRule>,
) -> Result<Json<IndexingRule>> {
    let rule = sqlx::query_as!(
        IndexingRule,
        r#"
        UPDATE ai_indexing_rules
        SET folder_path = $1, bucket = $2, include_subfolders = $3, file_types_allowed = $4, collection_name = $5, is_active = $6, updated_at = NOW()
        WHERE id = $7
        RETURNING id, folder_path, bucket, include_subfolders, file_types_allowed, collection_name, is_active
        "#,
        payload.folder_path,
        payload.bucket,
        payload.include_subfolders,
        payload.file_types_allowed.as_deref(),
        payload.collection_name,
        payload.is_active,
        id
    )
    .fetch_one(state.pool.inner())
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    Ok(Json(rule))
}

/// Delete an indexing rule
#[tracing::instrument(skip(state))]
pub async fn delete_indexing_rule(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    sqlx::query!(
        r#"
        DELETE FROM ai_indexing_rules WHERE id = $1
        "#,
        id
    )
    .execute(state.pool.inner())
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    Ok(StatusCode::NO_CONTENT)
}

/// System Setting Model
#[derive(Debug, Serialize, Deserialize)]
pub struct SystemSetting {
    pub setting_value: String,
}

/// Create/Update System Setting Request
#[derive(Debug, Deserialize)]
pub struct UpsertSystemSetting {
    pub setting_value: String,
}

// =========================================================================
// System Settings Handlers
// =========================================================================

/// Get a specific system setting
#[tracing::instrument(skip(state))]
pub async fn get_system_setting(
    State(state): axum::extract::State<crate::AppState>,
    axum::extract::Path(key): axum::extract::Path<String>,
) -> signapps_common::Result<axum::Json<SystemSetting>> {
    let setting = sqlx::query(
        r#"
        SELECT setting_value
        FROM admin_system_settings
        WHERE setting_key = $1
        "#,
    )
    .bind(key)
    .fetch_optional(state.pool.inner())
    .await;

    match setting {
        Ok(Some(row)) => {
            use sqlx::Row;
            let val: String = row
                .try_get("setting_value")
                .unwrap_or_else(|_| "false".to_string());
            Ok(axum::Json(SystemSetting { setting_value: val }))
        },
        Ok(None) | Err(_) => Ok(axum::Json(SystemSetting {
            setting_value: "false".to_string(),
        })),
    }
}

/// Update a specific system setting
#[tracing::instrument(skip(state, payload))]
pub async fn update_system_setting(
    State(state): axum::extract::State<crate::AppState>,
    axum::extract::Path(key): axum::extract::Path<String>,
    axum::Json(payload): axum::Json<UpsertSystemSetting>,
) -> signapps_common::Result<axum::Json<SystemSetting>> {
    let row = sqlx::query(
        r#"
        INSERT INTO admin_system_settings (setting_key, setting_value)
        VALUES ($1, $2)
        ON CONFLICT (setting_key) DO UPDATE 
        SET setting_value = EXCLUDED.setting_value, updated_at = NOW()
        RETURNING setting_value
        "#,
    )
    .bind(key)
    .bind(payload.setting_value)
    .fetch_one(state.pool.inner())
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    use sqlx::Row;
    let setting_value: String = row
        .try_get("setting_value")
        .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    Ok(axum::Json(SystemSetting { setting_value }))
}
