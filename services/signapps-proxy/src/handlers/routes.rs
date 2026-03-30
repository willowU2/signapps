//! Route management handlers.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::Serialize;
use signapps_common::{Error, Result};
use signapps_db::models::{CreateRoute, HeadersConfig, Route, ShieldConfig, UpdateRoute};
use signapps_db::repositories::RouteRepository;
use uuid::Uuid;

use crate::AppState;

/// Route response with additional info.
#[derive(Debug, Serialize)]
pub struct RouteResponse {
    #[serde(flatten)]
    pub route: Route,
    pub shield: Option<ShieldConfig>,
    pub headers: Option<HeadersConfig>,
    pub dns_records: Option<serde_json::Value>,
    pub tls_config: Option<serde_json::Value>,
}

impl From<Route> for RouteResponse {
    fn from(route: Route) -> Self {
        let shield = route.get_shield_config();
        let headers = route.get_headers_config();
        let dns_records = route.dns_records.clone();
        let tls_config = route.tls_config.clone();
        Self {
            route,
            shield,
            headers,
            dns_records,
            tls_config,
        }
    }
}

/// List all routes.
#[tracing::instrument(skip_all)]
pub async fn list_routes(State(state): State<AppState>) -> Result<Json<Vec<RouteResponse>>> {
    let repo = RouteRepository::new(&state.pool);
    let routes = repo.list().await?;

    let responses: Vec<RouteResponse> = routes.into_iter().map(RouteResponse::from).collect();

    Ok(Json(responses))
}

/// Get route by ID.
#[tracing::instrument(skip_all)]
pub async fn get_route(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<RouteResponse>> {
    let repo = RouteRepository::new(&state.pool);

    let route = repo
        .find(id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Route {}", id)))?;

    Ok(Json(RouteResponse::from(route)))
}

/// Create a new route.
#[tracing::instrument(skip_all)]
pub async fn create_route(
    State(state): State<AppState>,
    Json(payload): Json<CreateRoute>,
) -> Result<(StatusCode, Json<RouteResponse>)> {
    let repo = RouteRepository::new(&state.pool);

    // Check if name or host already exists
    if repo.find_by_name(&payload.name).await?.is_some() {
        return Err(Error::AlreadyExists(format!("Route name {}", payload.name)));
    }

    if repo.find_by_host(&payload.host).await?.is_some() {
        return Err(Error::AlreadyExists(format!("Route host {}", payload.host)));
    }

    let route = repo.create(&payload).await?;

    tracing::info!(route_id = %route.id, name = %route.name, "Route created");

    // Refresh proxy route cache
    state.route_cache.force_refresh();

    Ok((StatusCode::CREATED, Json(RouteResponse::from(route))))
}

/// Update a route.
#[tracing::instrument(skip_all)]
pub async fn update_route(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateRoute>,
) -> Result<Json<RouteResponse>> {
    let repo = RouteRepository::new(&state.pool);

    // Verify route exists
    let _existing = repo
        .find(id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Route {}", id)))?;

    // Check for conflicts if changing name or host
    if let Some(ref name) = payload.name {
        if let Some(other) = repo.find_by_name(name).await? {
            if other.id != id {
                return Err(Error::AlreadyExists(format!("Route name {}", name)));
            }
        }
    }

    if let Some(ref host) = payload.host {
        if let Some(other) = repo.find_by_host(host).await? {
            if other.id != id {
                return Err(Error::AlreadyExists(format!("Route host {}", host)));
            }
        }
    }

    let route = repo.update(id, &payload).await?;

    tracing::info!(route_id = %route.id, "Route updated");

    // Refresh proxy route cache
    state.route_cache.force_refresh();

    Ok(Json(RouteResponse::from(route)))
}

/// Delete a route.
#[tracing::instrument(skip_all)]
pub async fn delete_route(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    let repo = RouteRepository::new(&state.pool);

    // Verify route exists
    let route = repo
        .find(id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Route {}", id)))?;

    repo.delete(id).await?;

    tracing::info!(route_id = %id, name = %route.name, "Route deleted");

    // Refresh proxy route cache
    state.route_cache.force_refresh();

    Ok(StatusCode::NO_CONTENT)
}

/// Enable a route.
#[tracing::instrument(skip_all)]
pub async fn enable_route(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<RouteResponse>> {
    let repo = RouteRepository::new(&state.pool);

    let route = repo.toggle_enabled(id, true).await?;

    tracing::info!(route_id = %route.id, "Route enabled");

    // Refresh proxy route cache
    state.route_cache.force_refresh();

    Ok(Json(RouteResponse::from(route)))
}

/// Disable a route.
#[tracing::instrument(skip_all)]
pub async fn disable_route(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<RouteResponse>> {
    let repo = RouteRepository::new(&state.pool);

    let route = repo.toggle_enabled(id, false).await?;

    tracing::info!(route_id = %route.id, "Route disabled");

    // Refresh proxy route cache
    state.route_cache.force_refresh();

    Ok(Json(RouteResponse::from(route)))
}
