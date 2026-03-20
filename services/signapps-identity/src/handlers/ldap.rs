//! LDAP/Active Directory handlers.

use axum::{extract::State, http::StatusCode, Json};
use base64::Engine;
use serde::{Deserialize, Serialize};
use tracing::{error, info};

use crate::ldap::LdapService;
use crate::AppState;
use signapps_common::{Error, Result};
use signapps_db::models::{LdapConfigResponse, LdapGroup, LdapTestResult};
use signapps_db::repositories::LdapRepository;

/// Request to create LDAP configuration.
#[derive(Debug, Deserialize)]
pub struct CreateLdapConfigRequest {
    pub server_url: String,
    pub bind_dn: String,
    pub bind_password: String,
    pub base_dn: String,
    pub user_filter: Option<String>,
    pub group_filter: Option<String>,
    pub admin_groups: Option<Vec<String>>,
    pub user_groups: Option<Vec<String>>,
    pub use_tls: Option<bool>,
    pub skip_tls_verify: Option<bool>,
    pub sync_interval_minutes: Option<i32>,
    pub fallback_local_auth: Option<bool>,
}

/// Request to update LDAP configuration.
#[derive(Debug, Deserialize)]
pub struct UpdateLdapConfigRequest {
    pub enabled: Option<bool>,
    pub server_url: Option<String>,
    pub bind_dn: Option<String>,
    pub bind_password: Option<String>,
    pub base_dn: Option<String>,
    pub user_filter: Option<String>,
    pub group_filter: Option<String>,
    pub admin_groups: Option<Vec<String>>,
    pub user_groups: Option<Vec<String>>,
    pub use_tls: Option<bool>,
    pub skip_tls_verify: Option<bool>,
    pub sync_interval_minutes: Option<i32>,
    pub fallback_local_auth: Option<bool>,
}

/// Sync result response.
#[derive(Debug, Serialize)]
pub struct SyncResultResponse {
    pub users_created: i32,
    pub users_updated: i32,
    pub users_disabled: i32,
    pub groups_synced: i32,
    pub errors: Vec<String>,
}

/// Get current LDAP configuration.
pub async fn get_config(State(state): State<AppState>) -> Result<Json<LdapConfigResponse>> {
    let config = LdapRepository::get_config(&state.pool)
        .await?
        .ok_or_else(|| Error::NotFound("LDAP configuration not found".to_string()))?;

    Ok(Json(config.into()))
}

/// Create or update LDAP configuration.
pub async fn create_config(
    State(state): State<AppState>,
    Json(payload): Json<CreateLdapConfigRequest>,
) -> Result<(StatusCode, Json<LdapConfigResponse>)> {
    // Encrypt the bind password (in production, use proper encryption)
    // For now, we'll use base64 as a placeholder - should use AES-256-GCM
    let encrypted_password =
        base64::engine::general_purpose::STANDARD.encode(payload.bind_password.as_bytes());

    let create_config = signapps_db::models::CreateLdapConfig {
        server_url: payload.server_url,
        bind_dn: payload.bind_dn,
        bind_password: payload.bind_password.clone(),
        base_dn: payload.base_dn,
        user_filter: payload.user_filter,
        group_filter: payload.group_filter,
        admin_groups: payload.admin_groups,
        user_groups: payload.user_groups,
        use_tls: payload.use_tls,
        skip_tls_verify: payload.skip_tls_verify,
        sync_interval_minutes: payload.sync_interval_minutes,
        fallback_local_auth: payload.fallback_local_auth,
    };

    let config =
        LdapRepository::create_config(&state.pool, create_config, &encrypted_password).await?;

    info!("LDAP configuration created/updated");
    Ok((StatusCode::CREATED, Json(config.into())))
}

/// Update LDAP configuration.
pub async fn update_config(
    State(state): State<AppState>,
    Json(payload): Json<UpdateLdapConfigRequest>,
) -> Result<Json<LdapConfigResponse>> {
    let existing = LdapRepository::get_config(&state.pool)
        .await?
        .ok_or_else(|| Error::NotFound("LDAP configuration not found".to_string()))?;

    // Encrypt password if provided
    let encrypted_password = payload
        .bind_password
        .as_ref()
        .map(|p| base64::engine::general_purpose::STANDARD.encode(p.as_bytes()));

    let update = signapps_db::models::UpdateLdapConfig {
        enabled: payload.enabled,
        server_url: payload.server_url,
        bind_dn: payload.bind_dn,
        bind_password: payload.bind_password,
        base_dn: payload.base_dn,
        user_filter: payload.user_filter,
        group_filter: payload.group_filter,
        admin_groups: payload.admin_groups,
        user_groups: payload.user_groups,
        use_tls: payload.use_tls,
        skip_tls_verify: payload.skip_tls_verify,
        sync_interval_minutes: payload.sync_interval_minutes,
        fallback_local_auth: payload.fallback_local_auth,
    };

    let config = LdapRepository::update_config(
        &state.pool,
        existing.id,
        update,
        encrypted_password.as_deref(),
    )
    .await?;

    info!("LDAP configuration updated");
    Ok(Json(config.into()))
}

/// Test LDAP connection.
pub async fn test_connection(State(state): State<AppState>) -> Result<Json<LdapTestResult>> {
    let config = LdapRepository::get_config(&state.pool)
        .await?
        .ok_or_else(|| Error::NotFound("LDAP configuration not found".to_string()))?;

    // Decrypt password
    let password = decrypt_password(&config.bind_password_encrypted)?;

    let result = LdapService::test_connection(&config, &password).await?;

    if result.success {
        info!("LDAP connection test successful");
    } else {
        error!("LDAP connection test failed: {}", result.message);
    }

    Ok(Json(result))
}

/// List AD groups.
pub async fn list_groups(State(state): State<AppState>) -> Result<Json<Vec<LdapGroup>>> {
    let config = LdapRepository::get_config(&state.pool)
        .await?
        .ok_or_else(|| Error::NotFound("LDAP configuration not found".to_string()))?;

    if !config.enabled {
        return Err(Error::BadRequest("LDAP is not enabled".to_string()));
    }

    let password = decrypt_password(&config.bind_password_encrypted)?;
    let groups = LdapService::list_groups(&config, &password).await?;

    Ok(Json(groups))
}

/// Sync users from AD.
pub async fn sync_users(State(state): State<AppState>) -> Result<Json<SyncResultResponse>> {
    let config = LdapRepository::get_config(&state.pool)
        .await?
        .ok_or_else(|| Error::NotFound("LDAP configuration not found".to_string()))?;

    if !config.enabled {
        return Err(Error::BadRequest("LDAP is not enabled".to_string()));
    }

    let password = decrypt_password(&config.bind_password_encrypted)?;
    let (users, mut sync_result) = LdapService::sync_users(&config, &password).await?;

    // Sync users to local database
    for ldap_user in users {
        use signapps_db::repositories::UserRepository;

        // Check if user already exists
        match UserRepository::find_by_username(&state.pool, &ldap_user.username).await {
            Ok(Some(existing)) => {
                // Update existing user
                let update = signapps_db::models::UpdateUser {
                    email: ldap_user.email.clone(),
                    display_name: ldap_user.display_name.clone(),
                    role: if ldap_user.is_admin { Some(2) } else { Some(1) },
                    ldap_dn: Some(ldap_user.dn.clone()),
                    ldap_groups: Some(ldap_user.groups.clone()),
                    avatar_url: None,
                };
                if let Err(e) = UserRepository::update(&state.pool, existing.id, update).await {
                    sync_result
                        .errors
                        .push(format!("Failed to update {}: {}", ldap_user.username, e));
                } else {
                    sync_result.users_updated += 1;
                }
            },
            Ok(None) => {
                // Create new user
                let create = signapps_db::models::CreateUser {
                    username: ldap_user.username.clone(),
                    email: ldap_user.email,
                    password: None, // LDAP users don't have local passwords
                    display_name: ldap_user.display_name,
                    role: if ldap_user.is_admin { 2 } else { 1 },
                    auth_provider: "ldap".to_string(),
                    ldap_dn: Some(ldap_user.dn),
                    ldap_groups: Some(ldap_user.groups),
                    avatar_url: None,
                };
                if let Err(e) = UserRepository::create(&state.pool, create).await {
                    sync_result
                        .errors
                        .push(format!("Failed to create {}: {}", ldap_user.username, e));
                } else {
                    sync_result.users_created += 1;
                }
            },
            Err(e) => {
                sync_result
                    .errors
                    .push(format!("Failed to check {}: {}", ldap_user.username, e));
            },
        }
    }

    info!(
        "LDAP sync complete: {} created, {} updated, {} errors",
        sync_result.users_created,
        sync_result.users_updated,
        sync_result.errors.len()
    );

    Ok(Json(SyncResultResponse {
        users_created: sync_result.users_created,
        users_updated: sync_result.users_updated,
        users_disabled: sync_result.users_disabled,
        groups_synced: sync_result.groups_synced,
        errors: sync_result.errors,
    }))
}

/// Decrypt password (placeholder - use proper encryption in production).
fn decrypt_password(encrypted: &str) -> Result<String> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(encrypted)
        .map_err(|e| Error::Internal(format!("Failed to decrypt password: {}", e)))?;

    String::from_utf8(bytes)
        .map_err(|e| Error::Internal(format!("Invalid password encoding: {}", e)))
}
