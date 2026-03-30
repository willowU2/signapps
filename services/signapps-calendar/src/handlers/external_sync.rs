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
/// Request body for InitOAuth.
pub struct InitOAuthRequest {
    pub provider: String,
    pub redirect_uri: String,
}

#[derive(Debug, Serialize)]
/// Response for InitOAuth.
pub struct InitOAuthResponse {
    pub url: String,
    pub state: String,
}

#[derive(Debug, Deserialize)]
/// Request body for OAuthCallback.
pub struct OAuthCallbackRequest {
    pub code: String,
    pub state: String,
}

#[derive(Debug, Deserialize)]
/// Query parameters for filtering results.
pub struct ListLogsQuery {
    #[serde(default = "default_limit")]
    pub limit: i64,
}

fn default_limit() -> i64 {
    50
}

#[derive(Debug, Deserialize)]
/// Request body for ResolveAllConflicts.
pub struct ResolveAllConflictsRequest {
    pub resolution: String,
}

// ============================================================================
// Provider Connection Handlers
// ============================================================================

/// List all provider connections for the current user.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/external_sync",
    responses((status = 200, description = "Success")),
    tag = "Calendar"
)]
#[tracing::instrument(skip_all)]
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
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/external_sync",
    responses((status = 200, description = "Success")),
    tag = "Calendar"
)]
#[tracing::instrument(skip_all)]
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
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/external_sync",
    responses((status = 200, description = "Success")),
    tag = "Calendar"
)]
#[tracing::instrument(skip_all)]
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
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/external_sync",
    responses((status = 200, description = "Success")),
    tag = "Calendar"
)]
#[tracing::instrument(skip_all)]
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

    let oauth_state =
        oauth_state.ok_or(CalendarError::bad_request("Invalid or expired OAuth state"))?;

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
#[tracing::instrument(skip_all)]
#[utoipa::path(
    put,
    path = "/api/v1/external_sync",
    responses((status = 200, description = "Success")),
    tag = "Calendar"
)]
#[tracing::instrument(skip_all)]
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
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/external_sync",
    responses((status = 200, description = "Success")),
    tag = "Calendar"
)]
#[tracing::instrument(skip_all)]
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
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/external_sync",
    responses((status = 200, description = "Success")),
    tag = "Calendar"
)]
#[tracing::instrument(skip_all)]
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
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/external_sync",
    responses((status = 200, description = "Success")),
    tag = "Calendar"
)]
#[tracing::instrument(skip_all)]
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
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/external_sync",
    responses((status = 200, description = "Success")),
    tag = "Calendar"
)]
#[tracing::instrument(skip_all)]
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
#[tracing::instrument(skip_all)]
#[utoipa::path(
    post,
    path = "/api/v1/external_sync",
    responses((status = 201, description = "Success")),
    tag = "Calendar"
)]
#[tracing::instrument(skip_all)]
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
#[tracing::instrument(skip_all)]
#[utoipa::path(
    put,
    path = "/api/v1/external_sync",
    responses((status = 200, description = "Success")),
    tag = "Calendar"
)]
#[tracing::instrument(skip_all)]
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
#[tracing::instrument(skip_all)]
#[utoipa::path(
    delete,
    path = "/api/v1/external_sync",
    responses((status = 204, description = "Success")),
    tag = "Calendar"
)]
#[tracing::instrument(skip_all)]
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

/// Trigger manual sync — spawns a background task and returns immediately.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/external_sync",
    responses((status = 200, description = "Success")),
    tag = "Calendar"
)]
#[tracing::instrument(skip_all)]
pub async fn trigger_sync(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<(StatusCode, Json<serde_json::Value>), CalendarError> {
    let config_repo = SyncConfigRepository::new(&state.pool);
    let config = config_repo
        .find_by_id(id)
        .await
        .map_err(|_| CalendarError::InternalError)?
        .ok_or(CalendarError::NotFound)?;

    if config.user_id != claims.sub {
        return Err(CalendarError::Forbidden);
    }

    // Create an initial sync log entry
    let log_repo = SyncLogRepository::new(&state.pool);
    let sync_log = log_repo
        .create(
            id,
            signapps_db::models::CreateSyncLog {
                direction: "import".to_string(),
                status: "running".to_string(),
                events_imported: None,
                events_exported: None,
                events_updated: None,
                events_deleted: None,
                conflicts_detected: None,
                error_message: None,
                error_details: None,
            },
        )
        .await
        .map_err(|_| CalendarError::InternalError)?;

    let log_id = sync_log.id;
    let state_clone = state.clone();

    // Spawn background sync task
    tokio::spawn(async move {
        match run_calendar_sync(&state_clone, &config).await {
            Ok(imported) => {
                let log_repo = SyncLogRepository::new(&state_clone.pool);
                let _ = log_repo.complete(log_id, "success", None).await;
                tracing::info!("Calendar sync {}: imported {} events", config.id, imported);
            },
            Err(e) => {
                let err_msg = format!("{}", e);
                let log_repo = SyncLogRepository::new(&state_clone.pool);
                let _ = log_repo.complete(log_id, "error", Some(&err_msg)).await;
                tracing::error!("Calendar sync {} failed: {}", config.id, err_msg);
            },
        }
    });

    Ok((
        StatusCode::ACCEPTED,
        Json(serde_json::json!({
            "status": "started",
            "sync_log_id": log_id,
            "message": "Sync started in background"
        })),
    ))
}

/// Perform the actual calendar sync for a given config.
async fn run_calendar_sync(
    state: &AppState,
    config: &signapps_db::models::SyncConfig,
) -> Result<usize, CalendarError> {
    use signapps_db::repositories::{
        EventRepository, ExternalCalendarRepository, ProviderConnectionRepository,
    };

    // 1. Get external calendar to find the connection
    let ext_cal_repo = ExternalCalendarRepository::new(&state.pool);
    let ext_cal = ext_cal_repo
        .find_by_id(config.external_calendar_id)
        .await
        .map_err(|_| CalendarError::InternalError)?
        .ok_or(CalendarError::NotFound)?;

    // 2. Get provider connection
    let conn_repo = ProviderConnectionRepository::new(&state.pool);
    let mut connection = conn_repo
        .find_by_id(ext_cal.connection_id)
        .await
        .map_err(|_| CalendarError::InternalError)?
        .ok_or(CalendarError::NotFound)?;

    // 3. Refresh token if expired
    if let Some(expires_at) = connection.token_expires_at {
        if chrono::Utc::now() >= expires_at - chrono::Duration::minutes(5) {
            if let Some(ref refresh_token) = connection.refresh_token.clone() {
                match refresh_oauth_token(&connection.provider, refresh_token).await {
                    Ok(new_tokens) => {
                        // Update stored tokens
                        let _ = conn_repo
                            .update_tokens(
                                connection.id,
                                &new_tokens.access_token,
                                new_tokens.refresh_token.as_deref(),
                                new_tokens.expires_at,
                            )
                            .await;
                        connection.access_token = new_tokens.access_token;
                    },
                    Err(e) => {
                        tracing::warn!("Token refresh failed: {}", e);
                    },
                }
            }
        }
    }

    // 4. Fetch events from external provider
    let events = fetch_events_from_provider(&connection, &ext_cal.external_id).await?;
    let imported = events.len();

    // 5. Insert each event into local calendar
    let event_repo = EventRepository::new(&state.pool);
    for event in events {
        let _ = event_repo
            .create(
                config.local_calendar_id,
                signapps_db::models::CreateEvent {
                    title: event.title,
                    description: event.description,
                    location: event.location,
                    start_time: event.start_time,
                    end_time: event.end_time,
                    rrule: None,
                    timezone: Some(
                        ext_cal
                            .timezone
                            .clone()
                            .unwrap_or_else(|| "UTC".to_string()),
                    ),
                    is_all_day: Some(false),
                    event_type: None,
                    scope: None,
                    status: None,
                    priority: None,
                    parent_event_id: None,
                    resource_id: None,
                    category_id: None,
                    leave_type: None,
                    presence_mode: None,
                    approval_by: None,
                    approval_comment: None,
                    energy_level: None,
                    cron_expression: None,
                    cron_target: None,
                    assigned_to: None,
                    project_id: None,
                    tags: None,
                },
                config.user_id,
            )
            .await;
    }

    Ok(imported)
}

/// Minimal event struct returned from external providers.
struct ExternalEvent {
    title: String,
    description: Option<String>,
    location: Option<String>,
    start_time: chrono::DateTime<chrono::Utc>,
    end_time: chrono::DateTime<chrono::Utc>,
}

/// Fetch events from a provider using its API.
async fn fetch_events_from_provider(
    connection: &signapps_db::models::ProviderConnection,
    calendar_id: &str,
) -> Result<Vec<ExternalEvent>, CalendarError> {
    match connection.provider.as_str() {
        "google" => fetch_google_calendar_events(&connection.access_token, calendar_id).await,
        "microsoft" => fetch_microsoft_calendar_events(&connection.access_token, calendar_id).await,
        _ => Ok(vec![]),
    }
}

async fn fetch_google_calendar_events(
    access_token: &str,
    calendar_id: &str,
) -> Result<Vec<ExternalEvent>, CalendarError> {
    #[derive(serde::Deserialize)]
    struct GoogleEventDateTime {
        #[serde(rename = "dateTime")]
        date_time: Option<String>,
        date: Option<String>,
    }

    #[derive(serde::Deserialize)]
    struct GoogleEvent {
        summary: Option<String>,
        description: Option<String>,
        location: Option<String>,
        start: GoogleEventDateTime,
        end: GoogleEventDateTime,
    }

    #[derive(serde::Deserialize)]
    struct GoogleEventsResponse {
        items: Option<Vec<GoogleEvent>>,
    }

    let now = chrono::Utc::now();
    let time_min = (now - chrono::Duration::days(30)).to_rfc3339();
    let time_max = (now + chrono::Duration::days(90)).to_rfc3339();

    let url = format!(
        "https://www.googleapis.com/calendar/v3/calendars/{}/events?timeMin={}&timeMax={}&singleEvents=true&maxResults=250",
        urlencoding::encode(calendar_id),
        urlencoding::encode(&time_min),
        urlencoding::encode(&time_max)
    );

    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|e| CalendarError::internal(&format!("Google Calendar API error: {}", e)))?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        tracing::warn!("Google Calendar API failed: {}", body);
        return Ok(vec![]);
    }

    let data: GoogleEventsResponse = resp
        .json()
        .await
        .map_err(|e| CalendarError::internal(&format!("Google Calendar parse error: {}", e)))?;

    let mut events = vec![];
    for item in data.items.unwrap_or_default() {
        let start_str = item
            .start
            .date_time
            .or(item.start.date)
            .unwrap_or_else(|| now.to_rfc3339());
        let end_str = item
            .end
            .date_time
            .or(item.end.date)
            .unwrap_or_else(|| now.to_rfc3339());

        let start = chrono::DateTime::parse_from_rfc3339(&start_str)
            .map(|dt| dt.with_timezone(&chrono::Utc))
            .unwrap_or(now);
        let end = chrono::DateTime::parse_from_rfc3339(&end_str)
            .map(|dt| dt.with_timezone(&chrono::Utc))
            .unwrap_or(now + chrono::Duration::hours(1));

        events.push(ExternalEvent {
            title: item.summary.unwrap_or_else(|| "(No title)".to_string()),
            description: item.description,
            location: item.location,
            start_time: start,
            end_time: end,
        });
    }

    Ok(events)
}

async fn fetch_microsoft_calendar_events(
    access_token: &str,
    calendar_id: &str,
) -> Result<Vec<ExternalEvent>, CalendarError> {
    #[derive(serde::Deserialize)]
    struct MsDateTime {
        #[serde(rename = "dateTime")]
        date_time: Option<String>,
    }

    #[allow(dead_code)]
    #[derive(serde::Deserialize)]
    struct MsEvent {
        subject: Option<String>,
        body: Option<serde_json::Value>,
        location: Option<serde_json::Value>,
        start: MsDateTime,
        end: MsDateTime,
    }

    #[derive(serde::Deserialize)]
    struct MsEventsResponse {
        value: Option<Vec<MsEvent>>,
    }

    let now = chrono::Utc::now();
    let start_dt = (now - chrono::Duration::days(30))
        .format("%Y-%m-%dT%H:%M:%S%.0fZ")
        .to_string();
    let end_dt = (now + chrono::Duration::days(90))
        .format("%Y-%m-%dT%H:%M:%S%.0fZ")
        .to_string();

    let url = format!(
        "https://graph.microsoft.com/v1.0/me/calendars/{}/events?$filter=start/dateTime ge '{}' and end/dateTime le '{}'&$top=250",
        calendar_id, start_dt, end_dt
    );

    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|e| CalendarError::internal(&format!("Microsoft Graph API error: {}", e)))?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        tracing::warn!("Microsoft Graph API failed: {}", body);
        return Ok(vec![]);
    }

    let data: MsEventsResponse = resp
        .json()
        .await
        .map_err(|e| CalendarError::internal(&format!("Microsoft Calendar parse error: {}", e)))?;

    let mut events = vec![];
    for item in data.value.unwrap_or_default() {
        let start_str = item.start.date_time.unwrap_or_else(|| now.to_rfc3339());
        let end_str = item
            .end
            .date_time
            .unwrap_or_else(|| (now + chrono::Duration::hours(1)).to_rfc3339());

        let start = chrono::DateTime::parse_from_rfc3339(&start_str)
            .map(|dt| dt.with_timezone(&chrono::Utc))
            .unwrap_or(now);
        let end = chrono::DateTime::parse_from_rfc3339(&end_str)
            .map(|dt| dt.with_timezone(&chrono::Utc))
            .unwrap_or(now + chrono::Duration::hours(1));

        let location = item.location.and_then(|l| {
            l.get("displayName")
                .and_then(|d| d.as_str())
                .map(|s| s.to_string())
        });

        events.push(ExternalEvent {
            title: item.subject.unwrap_or_else(|| "(No title)".to_string()),
            description: None,
            location,
            start_time: start,
            end_time: end,
        });
    }

    Ok(events)
}

// ============================================================================
// Sync Log Handlers
// ============================================================================

/// List sync logs for a config.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/external_sync",
    responses((status = 200, description = "Success")),
    tag = "Calendar"
)]
#[tracing::instrument(skip_all)]
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
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/external_sync",
    responses((status = 200, description = "Success")),
    tag = "Calendar"
)]
#[tracing::instrument(skip_all)]
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
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/external_sync",
    responses((status = 200, description = "Success")),
    tag = "Calendar"
)]
#[tracing::instrument(skip_all)]
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
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/external_sync",
    responses((status = 200, description = "Success")),
    tag = "Calendar"
)]
#[tracing::instrument(skip_all)]
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

/// Deserialize response from OAuth2 token endpoints.
#[allow(dead_code)]
#[derive(Debug, serde::Deserialize)]
struct OAuthTokenResponse {
    access_token: String,
    token_type: Option<String>,
    expires_in: Option<i64>,
    refresh_token: Option<String>,
    scope: Option<String>,
    id_token: Option<String>,
    // Google userinfo (if included)
    email: Option<String>,
}

async fn exchange_oauth_code(
    provider: &str,
    code: &str,
    redirect_uri: &str,
) -> Result<OAuthTokens, CalendarError> {
    let (token_url, client_id_env, client_secret_env) = match provider {
        "google" => (
            "https://oauth2.googleapis.com/token",
            "GOOGLE_CLIENT_ID",
            "GOOGLE_CLIENT_SECRET",
        ),
        "microsoft" => (
            "https://login.microsoftonline.com/common/oauth2/v2.0/token",
            "MICROSOFT_CLIENT_ID",
            "MICROSOFT_CLIENT_SECRET",
        ),
        _ => return Err(CalendarError::bad_request("Unsupported OAuth provider")),
    };

    let client_id = std::env::var(client_id_env).unwrap_or_default();
    let client_secret = std::env::var(client_secret_env).unwrap_or_default();

    if client_id.is_empty() || client_secret.is_empty() {
        return Err(CalendarError::internal(&format!(
            "OAuth credentials not configured for {}",
            provider
        )));
    }

    let client = reqwest::Client::new();
    let resp = client
        .post(token_url)
        .form(&[
            ("code", code),
            ("client_id", &client_id),
            ("client_secret", &client_secret),
            ("redirect_uri", redirect_uri),
            ("grant_type", "authorization_code"),
        ])
        .send()
        .await
        .map_err(|e| CalendarError::internal(&format!("OAuth HTTP error: {}", e)))?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        tracing::error!("OAuth token exchange failed for {}: {}", provider, body);
        return Err(CalendarError::internal("OAuth token exchange failed"));
    }

    let token_resp: OAuthTokenResponse = resp
        .json()
        .await
        .map_err(|e| CalendarError::internal(&format!("OAuth response parse error: {}", e)))?;

    let expires_at = token_resp
        .expires_in
        .map(|secs| chrono::Utc::now() + chrono::Duration::seconds(secs));

    // For Google: fetch email from userinfo if not in token response
    let account_email = if provider == "google" && token_resp.email.is_none() {
        fetch_google_email(&token_resp.access_token).await.ok()
    } else {
        token_resp.email
    };

    Ok(OAuthTokens {
        access_token: token_resp.access_token,
        refresh_token: token_resp.refresh_token,
        expires_at,
        account_email,
        account_name: None,
    })
}

async fn fetch_google_email(access_token: &str) -> Result<String, CalendarError> {
    #[derive(serde::Deserialize)]
    struct UserInfo {
        email: Option<String>,
    }

    let client = reqwest::Client::new();
    let resp = client
        .get("https://www.googleapis.com/oauth2/v2/userinfo")
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|e| CalendarError::internal(&format!("Userinfo request failed: {}", e)))?;

    let info: UserInfo = resp
        .json()
        .await
        .map_err(|e| CalendarError::internal(&format!("Userinfo parse error: {}", e)))?;

    info.email
        .ok_or_else(|| CalendarError::internal("No email in userinfo"))
}

async fn refresh_oauth_token(
    provider: &str,
    refresh_token: &str,
) -> Result<OAuthTokens, CalendarError> {
    let (token_url, client_id_env, client_secret_env) = match provider {
        "google" => (
            "https://oauth2.googleapis.com/token",
            "GOOGLE_CLIENT_ID",
            "GOOGLE_CLIENT_SECRET",
        ),
        "microsoft" => (
            "https://login.microsoftonline.com/common/oauth2/v2.0/token",
            "MICROSOFT_CLIENT_ID",
            "MICROSOFT_CLIENT_SECRET",
        ),
        _ => {
            return Err(CalendarError::bad_request(
                "Unsupported OAuth provider for refresh",
            ))
        },
    };

    let client_id = std::env::var(client_id_env).unwrap_or_default();
    let client_secret = std::env::var(client_secret_env).unwrap_or_default();

    if client_id.is_empty() || client_secret.is_empty() {
        return Err(CalendarError::internal(&format!(
            "OAuth refresh credentials not configured for {}",
            provider
        )));
    }

    let client = reqwest::Client::new();
    let resp = client
        .post(token_url)
        .form(&[
            ("refresh_token", refresh_token),
            ("client_id", &client_id),
            ("client_secret", &client_secret),
            ("grant_type", "refresh_token"),
        ])
        .send()
        .await
        .map_err(|e| CalendarError::internal(&format!("OAuth refresh HTTP error: {}", e)))?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        tracing::error!("OAuth token refresh failed for {}: {}", provider, body);
        return Err(CalendarError::internal("OAuth token refresh failed"));
    }

    let token_resp: OAuthTokenResponse = resp
        .json()
        .await
        .map_err(|e| CalendarError::internal(&format!("OAuth refresh parse error: {}", e)))?;

    let expires_at = token_resp
        .expires_in
        .map(|secs| chrono::Utc::now() + chrono::Duration::seconds(secs));

    Ok(OAuthTokens {
        access_token: token_resp.access_token,
        refresh_token: token_resp
            .refresh_token
            .or_else(|| Some(refresh_token.to_string())),
        expires_at,
        account_email: None,
        account_name: None,
    })
}

async fn fetch_external_calendars(
    connection: &ProviderConnection,
) -> Result<Vec<CreateExternalCalendar>, CalendarError> {
    // NOTE: External calendar fetch requires provider-specific OAuth flows (Google Calendar API,
    //   CalDAV protocol) — tracked in backlog. Currently returns a placeholder primary calendar.
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

#[cfg(test)]
mod tests {
    #[allow(unused_imports)]
    use super::*;

    #[test]
    fn module_compiles() {
        // Verify this handler module compiles correctly.
        // Integration tests require a running database and service.
        assert!(true, "{} handler module loaded", module_path!());
    }
}
