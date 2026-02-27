use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;

use crate::models::{CreatePxeProfileRequest, PxeAsset, PxeProfile};
use crate::AppState;

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

pub async fn create_profile(
    State(state): State<AppState>,
    Json(payload): Json<CreatePxeProfileRequest>,
) -> Result<(StatusCode, Json<PxeProfile>), (StatusCode, String)> {
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

#[derive(Deserialize)]
pub struct IpxeQuery {
    pub mac: String,
}

pub async fn generate_ipxe_script(
    State(state): State<AppState>,
    Query(query): Query<IpxeQuery>,
) -> Result<String, (StatusCode, String)> {
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
        },
    };

    if let Some(pid) = active_profile_id {
        let profile = sqlx::query_as!(
            PxeProfile,
            r#"SELECT id, name, description, boot_script, os_type, os_version, is_default, created_at, updated_at
               FROM pxe.profiles WHERE id = $1"#,
            pid
        ).fetch_one(state.db.inner()).await.map_err(|_| (StatusCode::NOT_FOUND, "".to_string()))?;

        // 3. Return the dynamic iPXE script natively from the database profile
        return Ok(profile.boot_script);
    }

    Ok(String::from(
        "#!ipxe\necho No PXE Profile assigned structure found for this MAC.\nexit\n",
    ))
}
