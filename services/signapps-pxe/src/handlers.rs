use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::models::{
    CreatePxeProfileRequest, PxeAsset, PxeProfile, RegisterPxeAssetRequest, UpdatePxeAssetRequest,
    UpdatePxeProfileRequest,
};
use crate::AppState;

// ============================================================================
// Profiles
// ============================================================================

#[utoipa::path(
    get,
    path = "/api/v1/pxe/profiles",
    responses(
        (status = 200, description = "List of PXE profiles", body = Vec<crate::models::PxeProfile>),
        (status = 500, description = "Database error"),
    ),
    security(("bearerAuth" = [])),
    tag = "pxe-profiles"
)]
pub async fn list_profiles(
    State(state): State<AppState>,
) -> Result<Json<Vec<PxeProfile>>, (StatusCode, String)> {
    let profiles = sqlx::query_as::<_, PxeProfile>(
        r#"
        SELECT id, name, description, boot_script, os_type, os_version, is_default, created_at, updated_at
        FROM pxe.profiles
        ORDER BY created_at DESC
        "#,
    )
    .fetch_all(state.db.inner())
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch pxe profiles: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Database error".to_string())
    })?;

    Ok(Json(profiles))
}

#[utoipa::path(
    get,
    path = "/api/v1/pxe/profiles/{id}",
    params(("id" = Uuid, Path, description = "Profile UUID")),
    responses(
        (status = 200, description = "PXE profile found", body = crate::models::PxeProfile),
        (status = 404, description = "Profile not found"),
        (status = 500, description = "Database error"),
    ),
    security(("bearerAuth" = [])),
    tag = "pxe-profiles"
)]
pub async fn get_profile(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<PxeProfile>, (StatusCode, String)> {
    let profile = sqlx::query_as::<_, PxeProfile>(
        r#"
        SELECT id, name, description, boot_script, os_type, os_version, is_default, created_at, updated_at
        FROM pxe.profiles WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(state.db.inner())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Profile not found".to_string()))?;

    Ok(Json(profile))
}

#[utoipa::path(
    post,
    path = "/api/v1/pxe/profiles",
    request_body = crate::models::CreatePxeProfileRequest,
    responses(
        (status = 201, description = "Profile created", body = crate::models::PxeProfile),
        (status = 500, description = "Database error"),
    ),
    security(("bearerAuth" = [])),
    tag = "pxe-profiles"
)]
pub async fn create_profile(
    State(state): State<AppState>,
    Json(payload): Json<CreatePxeProfileRequest>,
) -> Result<(StatusCode, Json<PxeProfile>), (StatusCode, String)> {
    // If setting as default, unset other defaults first
    if payload.is_default.unwrap_or(false) {
        let _ = sqlx::query("UPDATE pxe.profiles SET is_default = false WHERE is_default = true")
            .execute(state.db.inner())
            .await;
    }

    let profile = sqlx::query_as::<_, PxeProfile>(
        r#"
        INSERT INTO pxe.profiles (name, description, boot_script, os_type, os_version, is_default)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, name, description, boot_script, os_type, os_version, is_default, created_at, updated_at
        "#,
    )
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(&payload.boot_script)
    .bind(&payload.os_type)
    .bind(&payload.os_version)
    .bind(payload.is_default.unwrap_or(false))
    .fetch_one(state.db.inner())
    .await
    .map_err(|e| {
        tracing::error!("Failed to create pxe profile: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Database error".to_string())
    })?;

    Ok((StatusCode::CREATED, Json(profile)))
}

#[utoipa::path(
    put,
    path = "/api/v1/pxe/profiles/{id}",
    params(("id" = Uuid, Path, description = "Profile UUID")),
    request_body = crate::models::UpdatePxeProfileRequest,
    responses(
        (status = 200, description = "Profile updated", body = crate::models::PxeProfile),
        (status = 404, description = "Profile not found"),
        (status = 500, description = "Database error"),
    ),
    security(("bearerAuth" = [])),
    tag = "pxe-profiles"
)]
pub async fn update_profile(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdatePxeProfileRequest>,
) -> Result<Json<PxeProfile>, (StatusCode, String)> {
    // Check exists
    let exists = sqlx::query("SELECT id FROM pxe.profiles WHERE id = $1")
        .bind(id)
        .fetch_optional(state.db.inner())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    if exists.is_none() {
        return Err((StatusCode::NOT_FOUND, "Profile not found".to_string()));
    }

    // If setting as default, unset others
    if payload.is_default.unwrap_or(false) {
        let _ = sqlx::query("UPDATE pxe.profiles SET is_default = false WHERE is_default = true")
            .execute(state.db.inner())
            .await;
    }

    let profile = sqlx::query_as::<_, PxeProfile>(
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
    )
    .bind(payload.name.as_deref())
    .bind(payload.description.as_deref())
    .bind(payload.boot_script.as_deref())
    .bind(payload.os_type.as_deref())
    .bind(payload.os_version.as_deref())
    .bind(payload.is_default)
    .bind(id)
    .fetch_one(state.db.inner())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(profile))
}

#[utoipa::path(
    delete,
    path = "/api/v1/pxe/profiles/{id}",
    params(("id" = Uuid, Path, description = "Profile UUID")),
    responses(
        (status = 204, description = "Profile deleted"),
        (status = 404, description = "Profile not found"),
        (status = 500, description = "Database error"),
    ),
    security(("bearerAuth" = [])),
    tag = "pxe-profiles"
)]
pub async fn delete_profile(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    // TODO: add created_by column to pxe.profiles for user isolation
    let result = sqlx::query("DELETE FROM pxe.profiles WHERE id = $1")
        .bind(id)
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

#[utoipa::path(
    get,
    path = "/api/v1/pxe/assets",
    responses(
        (status = 200, description = "List of PXE assets", body = Vec<crate::models::PxeAsset>),
        (status = 500, description = "Database error"),
    ),
    security(("bearerAuth" = [])),
    tag = "pxe-assets"
)]
pub async fn list_assets(
    State(state): State<AppState>,
) -> Result<Json<Vec<PxeAsset>>, (StatusCode, String)> {
    let assets = sqlx::query_as::<_, PxeAsset>(
        r#"
        SELECT id, mac_address, hostname, ip_address, status, profile_id, assigned_user_id, metadata, last_seen, created_at, updated_at
        FROM pxe.assets
        ORDER BY last_seen DESC NULLS LAST, created_at DESC
        "#,
    )
    .fetch_all(state.db.inner())
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch pxe assets: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Database error".to_string())
    })?;

    Ok(Json(assets))
}

#[utoipa::path(
    get,
    path = "/api/v1/pxe/assets/{id}",
    params(("id" = Uuid, Path, description = "Asset UUID")),
    responses(
        (status = 200, description = "PXE asset found", body = crate::models::PxeAsset),
        (status = 404, description = "Asset not found"),
        (status = 500, description = "Database error"),
    ),
    security(("bearerAuth" = [])),
    tag = "pxe-assets"
)]
pub async fn get_asset(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<PxeAsset>, (StatusCode, String)> {
    let asset = sqlx::query_as::<_, PxeAsset>(
        r#"
        SELECT id, mac_address, hostname, ip_address, status, profile_id, assigned_user_id, metadata, last_seen, created_at, updated_at
        FROM pxe.assets WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(state.db.inner())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Asset not found".to_string()))?;

    Ok(Json(asset))
}

#[utoipa::path(
    post,
    path = "/api/v1/pxe/assets",
    request_body = crate::models::RegisterPxeAssetRequest,
    responses(
        (status = 201, description = "Asset registered or updated", body = crate::models::PxeAsset),
        (status = 500, description = "Database error"),
    ),
    security(("bearerAuth" = [])),
    tag = "pxe-assets"
)]
pub async fn register_asset(
    State(state): State<AppState>,
    Json(payload): Json<RegisterPxeAssetRequest>,
) -> Result<(StatusCode, Json<PxeAsset>), (StatusCode, String)> {
    // Upsert - if MAC exists, update it; else insert new
    let asset = sqlx::query_as::<_, PxeAsset>(
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
    )
    .bind(&payload.mac_address)
    .bind(&payload.hostname)
    .bind(payload.profile_id)
    .fetch_one(state.db.inner())
    .await
    .map_err(|e| {
        tracing::error!("Failed to register asset: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Database error".to_string())
    })?;

    Ok((StatusCode::CREATED, Json(asset)))
}

#[utoipa::path(
    put,
    path = "/api/v1/pxe/assets/{id}",
    params(("id" = Uuid, Path, description = "Asset UUID")),
    request_body = crate::models::UpdatePxeAssetRequest,
    responses(
        (status = 200, description = "Asset updated", body = crate::models::PxeAsset),
        (status = 404, description = "Asset not found"),
        (status = 500, description = "Database error"),
    ),
    security(("bearerAuth" = [])),
    tag = "pxe-assets"
)]
pub async fn update_asset(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdatePxeAssetRequest>,
) -> Result<Json<PxeAsset>, (StatusCode, String)> {
    let exists = sqlx::query("SELECT id FROM pxe.assets WHERE id = $1")
        .bind(id)
        .fetch_optional(state.db.inner())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    if exists.is_none() {
        return Err((StatusCode::NOT_FOUND, "Asset not found".to_string()));
    }

    let asset = sqlx::query_as::<_, PxeAsset>(
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
    )
    .bind(payload.hostname.as_deref())
    .bind(payload.status.as_deref())
    .bind(payload.profile_id)
    .bind(&payload.metadata)
    .bind(id)
    .fetch_one(state.db.inner())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(asset))
}

#[utoipa::path(
    delete,
    path = "/api/v1/pxe/assets/{id}",
    params(("id" = Uuid, Path, description = "Asset UUID")),
    responses(
        (status = 204, description = "Asset deleted"),
        (status = 404, description = "Asset not found"),
        (status = 500, description = "Database error"),
    ),
    security(("bearerAuth" = [])),
    tag = "pxe-assets"
)]
pub async fn delete_asset(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    // TODO: add created_by column to pxe.assets for user isolation
    let result = sqlx::query("DELETE FROM pxe.assets WHERE id = $1")
        .bind(id)
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
/// Query parameters for filtering and pagination.
pub struct IpxeQuery {
    pub mac: String,
}

#[utoipa::path(
    get,
    path = "/api/v1/pxe/boot.ipxe",
    params(("mac" = String, Query, description = "MAC address of the booting machine")),
    responses(
        (status = 200, description = "iPXE boot script (text/plain)", content_type = "text/plain"),
        (status = 500, description = "Database error"),
    ),
    tag = "pxe-boot"
)]
pub async fn generate_ipxe_script(
    State(state): State<AppState>,
    Query(query): Query<IpxeQuery>,
) -> Result<String, (StatusCode, String)> {
    // Update last_seen for the asset
    let _ = sqlx::query("UPDATE pxe.assets SET last_seen = NOW() WHERE mac_address = $1")
        .bind(&query.mac)
        .execute(state.db.inner())
        .await;

    // 1. Lookup the bare-metal MAC address in pxe.assets
    let asset = sqlx::query_as::<_, PxeAsset>(
        r#"
        SELECT id, mac_address, hostname, ip_address, status, profile_id, assigned_user_id, metadata, last_seen, created_at, updated_at
        FROM pxe.assets
        WHERE mac_address = $1
        "#,
    )
    .bind(&query.mac)
    .fetch_optional(state.db.inner())
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DB Error".to_string()))?;

    // 2. Determine which profile to boot
    let active_profile_id = match asset {
        Some(a) if a.profile_id.is_some() => a.profile_id,
        _ => {
            // Find default profile
            let row: Option<(Uuid,)> =
                sqlx::query_as("SELECT id FROM pxe.profiles WHERE is_default = true LIMIT 1")
                    .fetch_optional(state.db.inner())
                    .await
                    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "".to_string()))?;
            row.map(|(id,)| id)
        },
    };

    if let Some(pid) = active_profile_id {
        let profile = sqlx::query_as::<_, PxeProfile>(
            r#"SELECT id, name, description, boot_script, os_type, os_version, is_default, created_at, updated_at
               FROM pxe.profiles WHERE id = $1"#,
        )
        .bind(pid)
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
