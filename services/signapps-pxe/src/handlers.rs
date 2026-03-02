use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::models::{
    CreatePxeProfileRequest, PxeAsset, PxeProfile, RegisterPxeAssetRequest,
    UpdatePxeAssetRequest, UpdatePxeProfileRequest,
};
use crate::AppState;

// ============================================================================
// Profiles
// ============================================================================

pub async fn list_profiles(
    State(state): State<AppState>,
) -> Result<Json<Vec<PxeProfile>>, (StatusCode, String)> {
    let profiles = sqlx::query_as!(
        PxeProfile,
        r#"
        SELECT id, name, description, boot_script, os_type, os_version, is_default, created_at, updated_at
        FROM pxe.profiles
        ORDER BY created_at DESC
        "#
    )
    .fetch_all(state.db.inner())
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch pxe profiles: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Database error".to_string())
    })?;

    Ok(Json(profiles))
}

pub async fn get_profile(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<PxeProfile>, (StatusCode, String)> {
    let profile = sqlx::query_as!(
        PxeProfile,
        r#"
        SELECT id, name, description, boot_script, os_type, os_version, is_default, created_at, updated_at
        FROM pxe.profiles WHERE id = $1
        "#,
        id
    )
    .fetch_optional(state.db.inner())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Profile not found".to_string()))?;

    Ok(Json(profile))
}

pub async fn create_profile(
    State(state): State<AppState>,
    Json(payload): Json<CreatePxeProfileRequest>,
) -> Result<(StatusCode, Json<PxeProfile>), (StatusCode, String)> {
    // If setting as default, unset other defaults first
    if payload.is_default.unwrap_or(false) {
        let _ = sqlx::query!("UPDATE pxe.profiles SET is_default = false WHERE is_default = true")
            .execute(state.db.inner())
            .await;
    }

    let profile = sqlx::query_as!(
        PxeProfile,
        r#"
        INSERT INTO pxe.profiles (name, description, boot_script, os_type, os_version, is_default)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, name, description, boot_script, os_type, os_version, is_default, created_at, updated_at
        "#,
        payload.name,
        payload.description,
        payload.boot_script,
        payload.os_type,
        payload.os_version,
        payload.is_default.unwrap_or(false)
    )
    .fetch_one(state.db.inner())
    .await
    .map_err(|e| {
        tracing::error!("Failed to create pxe profile: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Database error".to_string())
    })?;

    Ok((StatusCode::CREATED, Json(profile)))
}

pub async fn update_profile(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdatePxeProfileRequest>,
) -> Result<Json<PxeProfile>, (StatusCode, String)> {
    // Check exists
    let _ = sqlx::query!("SELECT id FROM pxe.profiles WHERE id = $1", id)
        .fetch_optional(state.db.inner())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Profile not found".to_string()))?;

    // If setting as default, unset others
    if payload.is_default.unwrap_or(false) {
        let _ = sqlx::query!("UPDATE pxe.profiles SET is_default = false WHERE is_default = true")
            .execute(state.db.inner())
            .await;
    }

    let profile = sqlx::query_as!(
        PxeProfile,
        r#"
        UPDATE pxe.profiles SET
            name = COALESCE($1, name),
            description = COALESCE($2, description),
            boot_script = COALESCE($3, boot_script),
            os_type = COALESCE($4, os_type),
            os_version = COALESCE($5, os_version),
            is_default = COALESCE($6, is_default),
            updated_at = NOW()
        WHERE id = $7
        RETURNING id, name, description, boot_script, os_type, os_version, is_default, created_at, updated_at
        "#,
        payload.name,
        payload.description,
        payload.boot_script,
        payload.os_type,
        payload.os_version,
        payload.is_default,
        id
    )
    .fetch_one(state.db.inner())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(profile))
}

pub async fn delete_profile(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    let result = sqlx::query!("DELETE FROM pxe.profiles WHERE id = $1", id)
        .execute(state.db.inner())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Profile not found".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}

// ============================================================================
// Assets
// ============================================================================

pub async fn list_assets(
    State(state): State<AppState>,
) -> Result<Json<Vec<PxeAsset>>, (StatusCode, String)> {
    let assets = sqlx::query_as!(
        PxeAsset,
        r#"
        SELECT id, mac_address, hostname, ip_address, status, profile_id, assigned_user_id, metadata, last_seen, created_at, updated_at
        FROM pxe.assets
        ORDER BY last_seen DESC NULLS LAST, created_at DESC
        "#
    )
    .fetch_all(state.db.inner())
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch pxe assets: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Database error".to_string())
    })?;

    Ok(Json(assets))
}

pub async fn get_asset(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<PxeAsset>, (StatusCode, String)> {
    let asset = sqlx::query_as!(
        PxeAsset,
        r#"
        SELECT id, mac_address, hostname, ip_address, status, profile_id, assigned_user_id, metadata, last_seen, created_at, updated_at
        FROM pxe.assets WHERE id = $1
        "#,
        id
    )
    .fetch_optional(state.db.inner())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Asset not found".to_string()))?;

    Ok(Json(asset))
}

pub async fn register_asset(
    State(state): State<AppState>,
    Json(payload): Json<RegisterPxeAssetRequest>,
) -> Result<(StatusCode, Json<PxeAsset>), (StatusCode, String)> {
    // Upsert - if MAC exists, update it; else insert new
    let asset = sqlx::query_as!(
        PxeAsset,
        r#"
        INSERT INTO pxe.assets (mac_address, hostname, profile_id, status, last_seen)
        VALUES ($1, $2, $3, 'discovered', NOW())
        ON CONFLICT (mac_address) DO UPDATE SET
            hostname = COALESCE($2, pxe.assets.hostname),
            profile_id = COALESCE($3, pxe.assets.profile_id),
            last_seen = NOW(),
            updated_at = NOW()
        RETURNING id, mac_address, hostname, ip_address, status, profile_id, assigned_user_id, metadata, last_seen, created_at, updated_at
        "#,
        payload.mac_address,
        payload.hostname,
        payload.profile_id
    )
    .fetch_one(state.db.inner())
    .await
    .map_err(|e| {
        tracing::error!("Failed to register asset: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Database error".to_string())
    })?;

    Ok((StatusCode::CREATED, Json(asset)))
}

pub async fn update_asset(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdatePxeAssetRequest>,
) -> Result<Json<PxeAsset>, (StatusCode, String)> {
    let _ = sqlx::query!("SELECT id FROM pxe.assets WHERE id = $1", id)
        .fetch_optional(state.db.inner())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Asset not found".to_string()))?;

    let asset = sqlx::query_as!(
        PxeAsset,
        r#"
        UPDATE pxe.assets SET
            hostname = COALESCE($1, hostname),
            status = COALESCE($2, status),
            profile_id = COALESCE($3, profile_id),
            metadata = COALESCE($4, metadata),
            updated_at = NOW()
        WHERE id = $5
        RETURNING id, mac_address, hostname, ip_address, status, profile_id, assigned_user_id, metadata, last_seen, created_at, updated_at
        "#,
        payload.hostname,
        payload.status,
        payload.profile_id,
        payload.metadata,
        id
    )
    .fetch_one(state.db.inner())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(asset))
}

pub async fn delete_asset(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    let result = sqlx::query!("DELETE FROM pxe.assets WHERE id = $1", id)
        .execute(state.db.inner())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Asset not found".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}

// ============================================================================
// iPXE Script Generation
// ============================================================================

#[derive(Deserialize)]
pub struct IpxeQuery {
    pub mac: String,
}

pub async fn generate_ipxe_script(
    State(state): State<AppState>,
    Query(query): Query<IpxeQuery>,
) -> Result<String, (StatusCode, String)> {
    // Update last_seen for the asset
    let _ = sqlx::query!(
        "UPDATE pxe.assets SET last_seen = NOW() WHERE mac_address = $1",
        query.mac
    )
    .execute(state.db.inner())
    .await;

    // 1. Lookup the bare-metal MAC address in pxe.assets
    let asset = sqlx::query_as!(
        PxeAsset,
        r#"
        SELECT id, mac_address, hostname, ip_address, status, profile_id, assigned_user_id, metadata, last_seen, created_at, updated_at
        FROM pxe.assets
        WHERE mac_address = $1
        "#,
        query.mac
    )
    .fetch_optional(state.db.inner())
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DB Error".to_string()))?;

    // 2. Determine which profile to boot
    let active_profile_id = match asset {
        Some(a) if a.profile_id.is_some() => a.profile_id,
        _ => {
            // Find default profile
            let dev =
                sqlx::query!(r#"SELECT id FROM pxe.profiles WHERE is_default = true LIMIT 1"#)
                    .fetch_optional(state.db.inner())
                    .await
                    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "".to_string()))?;
            dev.map(|row| row.id)
        }
    };

    if let Some(pid) = active_profile_id {
        let profile = sqlx::query_as!(
            PxeProfile,
            r#"SELECT id, name, description, boot_script, os_type, os_version, is_default, created_at, updated_at
               FROM pxe.profiles WHERE id = $1"#,
            pid
        )
        .fetch_one(state.db.inner())
        .await
        .map_err(|_| (StatusCode::NOT_FOUND, "".to_string()))?;

        // 3. Return the dynamic iPXE script natively from the database profile
        return Ok(profile.boot_script);
    }

    Ok(String::from(
        "#!ipxe\necho No PXE Profile assigned for this MAC.\nexit\n",
    ))
}
