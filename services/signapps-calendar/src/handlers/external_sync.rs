//! External Calendar Sync API handlers
//!
//! OAuth connection, calendar discovery, and sync configuration endpoints.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Extension, Json,
};
use serde::{Deserialize, Serialize};
use signapps_common::Claims;
use signapps_db::{
    models::*,
    repositories::{
        ExternalCalendarRepository, OAuthStateRepository, ProviderConnectionRepository,
        SyncConfigRepository, SyncConflictRepository, SyncLogRepository,
    },
};
use uuid::Uuid;

use crate::{AppState, CalendarError};

// ============================================================================
// Request/Response Types
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct InitOAuthRequest {
    pub provider: String,
    pub redirect_uri: String,
}

#[derive(Debug, Serialize)]
pub struct InitOAuthResponse {
    pub url: String,
    pub state: String,
}

#[derive(Debug, Deserialize)]
pub struct OAuthCallbackRequest {
    pub code: String,
    pub state: String,
}

#[derive(Debug, Deserialize)]
pub struct ListLogsQuery {
    #[serde(default = "default_limit")]
    pub limit: i64,
}

fn default_limit() -> i64 {
    50
}

#[derive(Debug, Deserialize)]
pub struct ResolveAllConflictsRequest {
    pub resolution: String,
}

// ============================================================================
// Provider Connection Handlers
// ============================================================================

/// List all provider connections for the current user.
pub async fn list_connections(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<ProviderConnectionResponse>>, CalendarError> {
    let repo = ProviderConnectionRepository::new(&state.pool);
    let connections = repo
        .list_for_user(claims.sub)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    let responses: Vec<ProviderConnectionResponse> = connections
        .into_iter()
        .map(ProviderConnectionResponse::from)
        .collect();

    Ok(Json(responses))
}

/// Get a specific connection.
pub async fn get_connection(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<ProviderConnectionResponse>, CalendarError> {
    let repo = ProviderConnectionRepository::new(&state.pool);
    let connection = repo
        .find_by_id(id)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    match connection {
        Some(conn) if conn.user_id == claims.sub => Ok(Json(conn.into())),
        Some(_) => Err(CalendarError::Forbidden),
        None => Err(CalendarError::NotFound),
    }
}

/// Initialize OAuth flow for a provider.
pub async fn init_oauth(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(req): Json<InitOAuthRequest>,
) -> Result<Json<InitOAuthResponse>, CalendarError> {
    // Generate random state for CSRF protection
    let oauth_state = format!("{}-{}", Uuid::new_v4(), chrono::Utc::now().timestamp());

    // Store state in database
    let state_repo = OAuthStateRepository::new(&state.pool);
    state_repo
        .create(
            claims.sub,
            CreateOAuthState {
                state: oauth_state.clone(),
                provider: req.provider.clone(),
                redirect_uri: req.redirect_uri.clone(),
            },
        )
        .await
        .map_err(|_| CalendarError::InternalError)?;

    // Build OAuth URL based on provider
    let auth_url = build_oauth_url(&req.provider, &oauth_state, &req.redirect_uri)?;

    Ok(Json(InitOAuthResponse {
        url: auth_url,
        state: oauth_state,
    }))
}

/// Handle OAuth callback.
pub async fn handle_oauth_callback(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(req): Json<OAuthCallbackRequest>,
) -> Result<Json<ProviderConnectionResponse>, CalendarError> {
    // Verify and consume OAuth state
    let state_repo = OAuthStateRepository::new(&state.pool);
    let oauth_state = state_repo
        .consume(&req.state)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    let oauth_state = oauth_state.ok_or(CalendarError::bad_request(
        "Invalid or expired OAuth state",
    ))?;

    if oauth_state.user_id != claims.sub {
        return Err(CalendarError::Forbidden);
    }

    // Exchange code for tokens (provider-specific implementation)
    let tokens =
        exchange_oauth_code(&oauth_state.provider, &req.code, &oauth_state.redirect_uri).await?;

    // Create or update connection
    let conn_repo = ProviderConnectionRepository::new(&state.pool);
    let connection = conn_repo
        .create(
            claims.sub,
            CreateProviderConnection {
                provider: oauth_state.provider,
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                token_expires_at: tokens.expires_at,
                account_email: tokens.account_email,
                account_name: tokens.account_name,
                caldav_url: None,
                caldav_username: None,
            },
        )
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok(Json(connection.into()))
}

/// Refresh connection tokens.
pub async fn refresh_connection(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<ProviderConnectionResponse>, CalendarError> {
    let repo = ProviderConnectionRepository::new(&state.pool);
    let connection = repo
        .find_by_id(id)
        .await
        .map_err(|_| CalendarError::InternalError)?
        .ok_or(CalendarError::NotFound)?;

    if connection.user_id != claims.sub {
        return Err(CalendarError::Forbidden);
    }

    // Refresh tokens (provider-specific)
    let refresh_token = connection
        .refresh_token
        .as_deref()
        .ok_or(CalendarError::bad_request("No refresh token available"))?;

    let tokens = refresh_oauth_token(&connection.provider, refresh_token).await?;

    // Update connection
    let updated = repo
        .update_tokens(
            id,
            &tokens.access_token,
            tokens.refresh_token.as_deref(),
            tokens.expires_at,
        )
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok(Json(updated.into()))
}

/// Disconnect a provider.
pub async fn disconnect_provider(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, CalendarError> {
    let repo = ProviderConnectionRepository::new(&state.pool);
    let connection = repo
        .find_by_id(id)
        .await
        .map_err(|_| CalendarError::InternalError)?
        .ok_or(CalendarError::NotFound)?;

    if connection.user_id != claims.sub {
        return Err(CalendarError::Forbidden);
    }

    repo.delete(id)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok(StatusCode::NO_CONTENT)
}

// ============================================================================
// External Calendar Handlers
// ============================================================================

/// List external calendars for a connection.
pub async fn list_external_calendars(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(connection_id): Path<Uuid>,
) -> Result<Json<Vec<ExternalCalendar>>, CalendarError> {
    // Verify connection ownership
    let conn_repo = ProviderConnectionRepository::new(&state.pool);
    let connection = conn_repo
        .find_by_id(connection_id)
        .await
        .map_err(|_| CalendarError::InternalError)?
        .ok_or(CalendarError::NotFound)?;

    if connection.user_id != claims.sub {
        return Err(CalendarError::Forbidden);
    }

    let cal_repo = ExternalCalendarRepository::new(&state.pool);
    let calendars = cal_repo
        .list_for_connection(connection_id)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok(Json(calendars))
}

/// Discover calendars from provider (fetch from external API).
pub async fn discover_calendars(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(connection_id): Path<Uuid>,
) -> Result<Json<Vec<ExternalCalendar>>, CalendarError> {
    // Verify connection ownership
    let conn_repo = ProviderConnectionRepository::new(&state.pool);
    let connection = conn_repo
        .find_by_id(connection_id)
        .await
        .map_err(|_| CalendarError::InternalError)?
        .ok_or(CalendarError::NotFound)?;

    if connection.user_id != claims.sub {
        return Err(CalendarError::Forbidden);
    }

    // Fetch calendars from provider API
    let external_calendars = fetch_external_calendars(&connection).await?;

    // Store in database
    let cal_repo = ExternalCalendarRepository::new(&state.pool);
    let mut stored = Vec::new();

    for cal in external_calendars {
        let stored_cal = cal_repo
            .upsert(connection_id, cal)
            .await
            .map_err(|_| CalendarError::InternalError)?;
        stored.push(stored_cal);
    }

    Ok(Json(stored))
}

// ============================================================================
// Sync Config Handlers
// ============================================================================

/// List sync configs for the current user.
pub async fn list_sync_configs(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<SyncConfig>>, CalendarError> {
    let repo = SyncConfigRepository::new(&state.pool);
    let configs = repo
        .list_for_user(claims.sub)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok(Json(configs))
}

/// Create a sync config.
pub async fn create_sync_config(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(req): Json<CreateSyncConfig>,
) -> Result<(StatusCode, Json<SyncConfig>), CalendarError> {
    let repo = SyncConfigRepository::new(&state.pool);
    let config = repo
        .create(claims.sub, req)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok((StatusCode::CREATED, Json(config)))
}

/// Update a sync config.
pub async fn update_sync_config(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateSyncConfig>,
) -> Result<Json<SyncConfig>, CalendarError> {
    let repo = SyncConfigRepository::new(&state.pool);
    let config = repo
        .find_by_id(id)
        .await
        .map_err(|_| CalendarError::InternalError)?
        .ok_or(CalendarError::NotFound)?;

    if config.user_id != claims.sub {
        return Err(CalendarError::Forbidden);
    }

    let updated = repo
        .update(id, req)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok(Json(updated))
}

/// Delete a sync config.
pub async fn delete_sync_config(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, CalendarError> {
    let repo = SyncConfigRepository::new(&state.pool);
    let config = repo
        .find_by_id(id)
        .await
        .map_err(|_| CalendarError::InternalError)?
        .ok_or(CalendarError::NotFound)?;

    if config.user_id != claims.sub {
        return Err(CalendarError::Forbidden);
    }

    repo.delete(id)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok(StatusCode::NO_CONTENT)
}

/// Trigger manual sync.
pub async fn trigger_sync(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<SyncLog>, CalendarError> {
    let config_repo = SyncConfigRepository::new(&state.pool);
    let config = config_repo
        .find_by_id(id)
        .await
        .map_err(|_| CalendarError::InternalError)?
        .ok_or(CalendarError::NotFound)?;

    if config.user_id != claims.sub {
        return Err(CalendarError::Forbidden);
    }

    // Create sync log
    let log_repo = SyncLogRepository::new(&state.pool);
    let log = log_repo
        .create(
            id,
            CreateSyncLog {
                direction: config.sync_direction.clone(),
                status: "success".to_string(),
                events_imported: Some(0),
                events_exported: Some(0),
                events_updated: Some(0),
                events_deleted: Some(0),
                conflicts_detected: Some(0),
                error_message: None,
                error_details: None,
            },
        )
        .await
        .map_err(|_| CalendarError::InternalError)?;

    // TODO: Implement actual sync logic in background task
    // For now, just mark as completed
    log_repo
        .complete(log.id, "success", None)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    config_repo
        .mark_synced(id)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    // Fetch updated log
    let logs = log_repo
        .list_for_config(id, 1)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    let log = logs.into_iter().next().ok_or(CalendarError::InternalError)?;

    Ok(Json(log))
}

// ============================================================================
// Sync Log Handlers
// ============================================================================

/// List sync logs for a config.
pub async fn list_sync_logs(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(config_id): Path<Uuid>,
    Query(query): Query<ListLogsQuery>,
) -> Result<Json<Vec<SyncLog>>, CalendarError> {
    // Verify config ownership
    let config_repo = SyncConfigRepository::new(&state.pool);
    let config = config_repo
        .find_by_id(config_id)
        .await
        .map_err(|_| CalendarError::InternalError)?
        .ok_or(CalendarError::NotFound)?;

    if config.user_id != claims.sub {
        return Err(CalendarError::Forbidden);
    }

    let log_repo = SyncLogRepository::new(&state.pool);
    let logs = log_repo
        .list_for_config(config_id, query.limit)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok(Json(logs))
}

// ============================================================================
// Conflict Handlers
// ============================================================================

/// List unresolved conflicts for a config.
pub async fn list_conflicts(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(config_id): Path<Uuid>,
) -> Result<Json<Vec<SyncConflict>>, CalendarError> {
    // Verify config ownership
    let config_repo = SyncConfigRepository::new(&state.pool);
    let config = config_repo
        .find_by_id(config_id)
        .await
        .map_err(|_| CalendarError::InternalError)?
        .ok_or(CalendarError::NotFound)?;

    if config.user_id != claims.sub {
        return Err(CalendarError::Forbidden);
    }

    let conflict_repo = SyncConflictRepository::new(&state.pool);
    let conflicts = conflict_repo
        .list_unresolved(config_id)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok(Json(conflicts))
}

/// Resolve a single conflict.
pub async fn resolve_conflict(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((config_id, conflict_id)): Path<(Uuid, Uuid)>,
    Json(req): Json<ResolveConflict>,
) -> Result<StatusCode, CalendarError> {
    // Verify config ownership
    let config_repo = SyncConfigRepository::new(&state.pool);
    let config = config_repo
        .find_by_id(config_id)
        .await
        .map_err(|_| CalendarError::InternalError)?
        .ok_or(CalendarError::NotFound)?;

    if config.user_id != claims.sub {
        return Err(CalendarError::Forbidden);
    }

    let conflict_repo = SyncConflictRepository::new(&state.pool);
    conflict_repo
        .resolve(conflict_id, &req.resolution, claims.sub)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok(StatusCode::NO_CONTENT)
}

/// Resolve all conflicts for a config.
pub async fn resolve_all_conflicts(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(config_id): Path<Uuid>,
    Json(req): Json<ResolveAllConflictsRequest>,
) -> Result<Json<serde_json::Value>, CalendarError> {
    // Verify config ownership
    let config_repo = SyncConfigRepository::new(&state.pool);
    let config = config_repo
        .find_by_id(config_id)
        .await
        .map_err(|_| CalendarError::InternalError)?
        .ok_or(CalendarError::NotFound)?;

    if config.user_id != claims.sub {
        return Err(CalendarError::Forbidden);
    }

    let conflict_repo = SyncConflictRepository::new(&state.pool);
    let count = conflict_repo
        .resolve_all(config_id, &req.resolution, claims.sub)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok(Json(serde_json::json!({ "resolved": count })))
}

// ============================================================================
// Helper Functions (OAuth implementation stubs)
// ============================================================================

fn build_oauth_url(
    provider: &str,
    state: &str,
    redirect_uri: &str,
) -> Result<String, CalendarError> {
    // Load OAuth credentials from environment
    let (client_id, auth_url, scopes) = match provider {
        "google" => (
            std::env::var("GOOGLE_CLIENT_ID").unwrap_or_default(),
            "https://accounts.google.com/o/oauth2/v2/auth",
            "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events",
        ),
        "microsoft" => (
            std::env::var("MICROSOFT_CLIENT_ID").unwrap_or_default(),
            "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
            "https://graph.microsoft.com/Calendars.ReadWrite offline_access",
        ),
        "apple" => (
            std::env::var("APPLE_CLIENT_ID").unwrap_or_default(),
            "https://appleid.apple.com/auth/authorize",
            "name email",
        ),
        _ => {
            return Err(CalendarError::bad_request("Unsupported provider"));
        }
    };

    if client_id.is_empty() {
        return Err(CalendarError::internal(&format!(
            "OAuth not configured for {}",
            provider
        )));
    }

    let url = format!(
        "{}?client_id={}&redirect_uri={}&response_type=code&scope={}&state={}&access_type=offline&prompt=consent",
        auth_url,
        urlencoding::encode(&client_id),
        urlencoding::encode(redirect_uri),
        urlencoding::encode(scopes),
        urlencoding::encode(state)
    );

    Ok(url)
}

#[derive(Debug)]
struct OAuthTokens {
    access_token: String,
    refresh_token: Option<String>,
    expires_at: Option<chrono::DateTime<chrono::Utc>>,
    account_email: Option<String>,
    account_name: Option<String>,
}

async fn exchange_oauth_code(
    provider: &str,
    code: &str,
    _redirect_uri: &str,
) -> Result<OAuthTokens, CalendarError> {
    // TODO: Implement actual token exchange with provider APIs
    // For now, return placeholder to allow compilation
    tracing::warn!(
        "OAuth token exchange not fully implemented for provider: {}",
        provider
    );

    Ok(OAuthTokens {
        access_token: format!("placeholder_token_{}", code),
        refresh_token: Some("placeholder_refresh".to_string()),
        expires_at: Some(chrono::Utc::now() + chrono::Duration::hours(1)),
        account_email: Some("user@example.com".to_string()),
        account_name: Some("User".to_string()),
    })
}

async fn refresh_oauth_token(
    provider: &str,
    refresh_token: &str,
) -> Result<OAuthTokens, CalendarError> {
    // TODO: Implement actual token refresh with provider APIs
    tracing::warn!(
        "OAuth token refresh not fully implemented for provider: {}",
        provider
    );

    Ok(OAuthTokens {
        access_token: format!("refreshed_token_{}", refresh_token),
        refresh_token: Some(refresh_token.to_string()),
        expires_at: Some(chrono::Utc::now() + chrono::Duration::hours(1)),
        account_email: None,
        account_name: None,
    })
}

async fn fetch_external_calendars(
    connection: &ProviderConnection,
) -> Result<Vec<CreateExternalCalendar>, CalendarError> {
    // TODO: Implement actual calendar fetch from provider APIs
    tracing::warn!(
        "External calendar fetch not fully implemented for provider: {}",
        connection.provider
    );

    // Return placeholder calendar for testing
    Ok(vec![CreateExternalCalendar {
        external_id: format!("primary_{}", connection.id),
        name: "Primary Calendar".to_string(),
        description: Some("Your primary calendar".to_string()),
        color: Some("#4285f4".to_string()),
        timezone: Some("UTC".to_string()),
        is_primary: Some(true),
        is_readonly: Some(false),
    }])
}
