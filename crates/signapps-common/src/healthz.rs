//! Standardised health check handler — IDEA-111
//!
//! Provides a consistent `GET /health` response across all SignApps services.
//! Each service self-declares its frontend app metadata so the gateway can
//! dynamically discover all available applications.
//!
//! Response format:
//! ```json
//! {
//!   "status": "ok",
//!   "service": "signapps-calendar",
//!   "version": "0.1.0",
//!   "uptime_seconds": 123,
//!   "app": {
//!     "id": "calendar",
//!     "label": "Calendrier",
//!     "description": "Agenda, événements et gestion du temps",
//!     "icon": "Calendar",
//!     "category": "Organisation",
//!     "color": "text-blue-500",
//!     "href": "/cal",
//!     "port": 3011
//!   }
//! }
//! ```
//!
//! Usage in a service main.rs:
//! ```rust,ignore
//! use signapps_common::healthz::{health_with_app, AppMetadata};
//! let app = AppMetadata::new("calendar", "Calendrier", "Agenda", "Calendar", "Organisation", "text-blue-500", "/cal", 3011);
//! let public = Router::new().route("/health", get(move || health_with_app("signapps-calendar", app.clone())));
//! ```

use axum::{response::IntoResponse, Json};
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;
use std::time::Instant;

static START_TIME: OnceLock<Instant> = OnceLock::new();

/// Call once at process startup to record the process start time.
pub fn init_start_time() {
    START_TIME.get_or_init(Instant::now);
}

/// Returns uptime in seconds since `init_start_time` was called (or 0).
pub fn uptime_seconds() -> u64 {
    START_TIME.get().map(|t| t.elapsed().as_secs()).unwrap_or(0)
}

/// Frontend application metadata declared by each service.
///
/// The gateway collects this from every service's `/health` response
/// to build a dynamic application registry for the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppMetadata {
    /// Unique application identifier (e.g. `"calendar"`).
    pub id: String,
    /// Human-readable label shown in the UI (e.g. `"Calendrier"`).
    pub label: String,
    /// Short description of the application.
    pub description: String,
    /// Lucide icon name (e.g. `"Calendar"`).
    pub icon: String,
    /// Application category for grouping (e.g. `"Organisation"`).
    pub category: String,
    /// Tailwind CSS color class (e.g. `"text-blue-500"`).
    pub color: String,
    /// Frontend route path (e.g. `"/cal"`).
    pub href: String,
    /// Backend service port.
    pub port: u16,
}

impl AppMetadata {
    /// Creates a new `AppMetadata` instance.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_common::healthz::AppMetadata;
    /// let app = AppMetadata::new(
    ///     "calendar", "Calendrier", "Agenda et gestion du temps",
    ///     "Calendar", "Organisation", "text-blue-500", "/cal", 3011,
    /// );
    /// assert_eq!(app.id, "calendar");
    /// ```
    ///
    /// # Errors
    ///
    /// This function does not return errors.
    ///
    /// # Panics
    ///
    /// No panics possible.
    pub fn new(
        id: &str,
        label: &str,
        description: &str,
        icon: &str,
        category: &str,
        color: &str,
        href: &str,
        port: u16,
    ) -> Self {
        Self {
            id: id.to_string(),
            label: label.to_string(),
            description: description.to_string(),
            icon: icon.to_string(),
            category: category.to_string(),
            color: color.to_string(),
            href: href.to_string(),
            port,
        }
    }
}

/// Response payload returned by the `/health` endpoint.
#[derive(Debug, Serialize)]
pub struct HealthResponse {
    /// Fixed string `"ok"` when the service is healthy.
    pub status: &'static str,
    /// Name of the service (e.g. `"signapps-identity"`).
    pub service: String,
    /// Semver version string from `CARGO_PKG_VERSION`.
    pub version: &'static str,
    /// Seconds elapsed since `init_start_time` was called at process startup.
    pub uptime_seconds: u64,
    /// Frontend app metadata for dynamic discovery.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub app: Option<AppMetadata>,
}

/// Returns a standard health JSON response (without app metadata).
///
/// Suitable for use as an Axum handler via a closure:
/// ```rust,ignore
/// let svc = "signapps-identity";
/// router.route("/health", get(move || health(svc)));
/// ```
pub async fn health(service: &'static str) -> impl IntoResponse {
    Json(HealthResponse {
        status: "ok",
        service: service.to_string(),
        version: env!("CARGO_PKG_VERSION"),
        uptime_seconds: uptime_seconds(),
        app: None,
    })
}

/// Returns a health JSON response enriched with frontend app metadata.
///
/// Used by services that expose a frontend application so the gateway
/// can dynamically discover all available apps.
///
/// # Examples
///
/// ```rust,ignore
/// use signapps_common::healthz::{health_with_app, AppMetadata};
/// let app = AppMetadata::new("calendar", "Calendrier", "Agenda", "Calendar", "Organisation", "text-blue-500", "/cal", 3011);
/// router.route("/health", get(move || health_with_app("signapps-calendar", app.clone())));
/// ```
///
/// # Errors
///
/// This function does not return errors.
///
/// # Panics
///
/// No panics possible.
pub async fn health_with_app(service: &'static str, app: AppMetadata) -> impl IntoResponse {
    Json(HealthResponse {
        status: "ok",
        service: service.to_string(),
        version: env!("CARGO_PKG_VERSION"),
        uptime_seconds: uptime_seconds(),
        app: Some(app),
    })
}
