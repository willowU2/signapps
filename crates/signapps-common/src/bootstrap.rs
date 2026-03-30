//! Service Bootstrap Module
//!
//! Provides unified initialization for SignApps microservices.
//!
//! ## Features
//!
//! - Tracing initialization with sensible defaults
//! - Environment loading with dotenv
//! - JWT configuration
//! - Database pool creation
//! - Common middleware stack
//!
//! ## Usage
//!
//! ```rust,ignore
//! use signapps_common::bootstrap::{init_tracing, load_env, ServiceConfig};
//!
//! #[tokio::main]
//! async fn main() -> anyhow::Result<()> {
//!     init_tracing("my_service");
//!     load_env();
//!
//!     let config = ServiceConfig::from_env("my-service", 3001);
//!     let pool = config.create_pool().await?;
//!     let jwt_config = config.jwt_config();
//!
//!     // Build your app...
//!     Ok(())
//! }
//! ```

use crate::JwtConfig;
use axum::{middleware, Router};
use std::net::SocketAddr;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

// OpenTelemetry integrations
use opentelemetry::KeyValue;
use opentelemetry_otlp::WithExportConfig;
use opentelemetry_sdk::{trace as sdktrace, Resource};

// ═══════════════════════════════════════════════════════════════════════════
// TRACING INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

/// Initialize tracing with sensible defaults for a service.
///
/// The default filter is: `info,signapps=debug,sqlx=warn,tower_http=debug`
/// Override with `RUST_LOG` environment variable.
///
/// Log format is controlled by `RUST_LOG_FORMAT`:
/// - `json` → JSON output (recommended for production / log aggregators)
/// - `pretty` or unset → human-readable pretty output (default for development)
pub fn init_tracing(service_name: &str) {
    let default_filter = format!(
        "info,signapps=debug,{}=debug,sqlx=warn,tower_http=debug",
        service_name.replace('-', "_")
    );

    let env_filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| default_filter.into());

    let log_format = std::env::var("RUST_LOG_FORMAT").unwrap_or_default();
    let use_json = log_format.eq_ignore_ascii_case("json");

    // We use Option<L> layers so all 4 combinations share the same monomorphized type.
    // Only one of json_layer / text_layer is Some at a time.
    let json_layer = if use_json {
        Some(tracing_subscriber::fmt::layer().json())
    } else {
        None
    };
    let text_layer = if use_json {
        None
    } else {
        Some(tracing_subscriber::fmt::layer())
    };

    let otel_layer = std::env::var("OTEL_EXPORTER_OTLP_ENDPOINT")
        .ok()
        .map(|endpoint| {
            let tracer = opentelemetry_otlp::new_pipeline()
                .tracing()
                .with_exporter(
                    opentelemetry_otlp::new_exporter()
                        .http()
                        .with_endpoint(endpoint),
                )
                .with_trace_config(sdktrace::config().with_resource(Resource::new(vec![
                    KeyValue::new("service.name", service_name.to_string()),
                ])))
                .install_batch(opentelemetry_sdk::runtime::Tokio)
                .expect("Failed to initialize OTLP tracer");

            tracing_opentelemetry::layer().with_tracer(tracer)
        });

    tracing_subscriber::registry()
        .with(env_filter)
        .with(json_layer)
        .with(text_layer)
        .with(otel_layer)
        .init();
}

/// Initialize tracing with a custom filter.
pub fn init_tracing_with_filter(filter: &str) {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| filter.into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();
}

// ═══════════════════════════════════════════════════════════════════════════
// ENVIRONMENT LOADING
// ═══════════════════════════════════════════════════════════════════════════

/// Load environment variables from .env file.
/// Returns true if a .env file was found, false otherwise.
pub fn load_env() -> bool {
    dotenvy::dotenv().is_ok()
}

/// Get an environment variable with a default value.
pub fn env_or(key: &str, default: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| default.to_string())
}

/// Get an environment variable, panic if not set.
pub fn env_required(key: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| panic!("{} must be set", key))
}

/// Validates critical environment variables at startup.
/// Logs warnings for missing optional vars, panics for invalid required vars.
pub fn validate_env(service_name: &str) {
    // DATABASE_URL is required
    let db_url = std::env::var("DATABASE_URL").unwrap_or_default();
    if db_url.is_empty() {
        panic!("[{}] DATABASE_URL must be set", service_name);
    }

    // JWT_SECRET check
    match std::env::var("JWT_SECRET") {
        Ok(s) if s.contains("dev-secret") || s.contains("change-me") => {
            tracing::warn!(
                "[{}] JWT_SECRET contains default value - change for production!",
                service_name
            );
        },
        Ok(_) => {},
        Err(_) => {
            tracing::warn!("[{}] JWT_SECRET not set", service_name);
        },
    }

    // SERVER_PORT check
    if let Ok(port_str) = std::env::var("SERVER_PORT") {
        if port_str.parse::<u16>().is_err() {
            panic!(
                "[{}] SERVER_PORT '{}' is not a valid port number",
                service_name, port_str
            );
        }
    }

    tracing::info!("[{}] Environment validated", service_name);
}

// ═══════════════════════════════════════════════════════════════════════════
// SERVICE CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

/// Configuration for a SignApps service.
#[derive(Debug, Clone)]
pub struct ServiceConfig {
    /// Service name (e.g., "signapps-identity")
    pub name: String,
    /// Default port for this service
    pub default_port: u16,
    /// Database URL
    pub database_url: String,
    /// JWT secret
    pub jwt_secret: String,
    /// Host to bind to
    pub host: String,
    /// Port to bind to
    pub port: u16,
}

impl ServiceConfig {
    /// Create a new service configuration from environment variables.
    ///
    /// Required:
    /// - `DATABASE_URL` (or uses fallback)
    ///
    /// Optional:
    /// - `JWT_SECRET` (defaults to insecure dev secret)
    /// - `SERVER_HOST` (defaults to "0.0.0.0")
    /// - `SERVER_PORT` (defaults to provided default_port)
    pub fn from_env(name: &str, default_port: u16) -> Self {
        validate_env(name);

        let database_url = env_or(
            "DATABASE_URL",
            "postgres://signapps:password@localhost:5432/signapps",
        );

        let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| {
            if std::env::var("SIGNAPPS_DEV").is_ok() || cfg!(debug_assertions) {
                tracing::warn!("JWT_SECRET not set, using insecure dev default — set JWT_SECRET in production!");
                "dev_secret_change_in_production_32chars".to_string()
            } else {
                panic!("JWT_SECRET environment variable must be set in production. Set SIGNAPPS_DEV=1 to use an insecure default for development.");
            }
        });

        let host = env_or("SERVER_HOST", "0.0.0.0");
        let port: u16 = env_or("SERVER_PORT", &default_port.to_string())
            .parse()
            .unwrap_or(default_port);

        Self {
            name: name.to_string(),
            default_port,
            database_url,
            jwt_secret,
            host,
            port,
        }
    }

    /// Get the socket address for this service.
    pub fn socket_addr(&self) -> SocketAddr {
        format!("{}:{}", self.host, self.port)
            .parse()
            .expect("Invalid socket address")
    }

    /// Create a JWT configuration for this service.
    pub fn jwt_config(&self) -> JwtConfig {
        JwtConfig {
            secret: self.jwt_secret.clone(),
            issuer: "signapps".to_string(),
            audience: self.name.clone(),
            access_expiration: 900,     // 15 minutes
            refresh_expiration: 604800, // 7 days
        }
    }

    /// Create a database pool.
    /// Note: This requires the signapps_db crate to be available.
    pub async fn create_pool(&self) -> anyhow::Result<sqlx::PgPool> {
        let pool = sqlx::postgres::PgPoolOptions::new()
            .max_connections(10)
            .connect(&self.database_url)
            .await?;
        tracing::info!("Database connection established");
        Ok(pool)
    }

    /// Log the service startup message.
    pub fn log_startup(&self) {
        tracing::info!(
            "Starting {} v{} on {}:{}",
            self.name,
            env!("CARGO_PKG_VERSION"),
            self.host,
            self.port
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// MIDDLEWARE STACK
// ═══════════════════════════════════════════════════════════════════════════

/// Create the standard middleware stack for a service.
///
/// Includes:
/// - Request ID middleware
/// - Logging middleware
/// - CORS (permissive)
///
/// Note: Auth middleware should be added per-route as needed.
/// The router should have its state already applied via `.with_state()`.
pub fn middleware_stack(router: Router) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list([
            "http://localhost:3000"
                .parse()
                .expect("valid localhost origin"),
            "http://127.0.0.1:3000"
                .parse()
                .expect("valid localhost origin"),
        ]))
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PUT,
            axum::http::Method::PATCH,
            axum::http::Method::DELETE,
            axum::http::Method::OPTIONS,
        ])
        .allow_headers([
            axum::http::header::CONTENT_TYPE,
            axum::http::header::AUTHORIZATION,
            axum::http::header::ACCEPT,
            axum::http::header::ORIGIN,
            "x-workspace-id".parse().expect("valid header name"),
        ])
        .allow_credentials(true);

    router
        .layer(middleware::from_fn(
            crate::middleware::request_id_middleware,
        ))
        .layer(middleware::from_fn(crate::middleware::logging_middleware))
        .layer(cors)
}

// ═══════════════════════════════════════════════════════════════════════════
// SERVICE RUNNER
// ═══════════════════════════════════════════════════════════════════════════

/// Run an Axum server with the given router and configuration.
///
/// Note: The router should have its state already applied via `.with_state()`.
/// This function expects a `Router<()>` (stateless router).
///
/// This version supports graceful shutdown via Ctrl+C or SIGTERM.
pub async fn run_server(router: Router, config: &ServiceConfig) -> anyhow::Result<()> {
    let addr = config.socket_addr();
    tracing::info!("Listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;

    // Setup graceful shutdown
    let shutdown_signal = async {
        shutdown_signal().await;
        tracing::info!("Shutdown signal received, stopping server...");
    };

    axum::serve(listener, router)
        .with_graceful_shutdown(shutdown_signal)
        .await?;

    // Flush any pending OpenTelemetry spans before exit
    opentelemetry::global::shutdown_tracer_provider();
    tracing::info!("Server stopped gracefully, traces flushed");
    Ok(())
}

/// Run an Axum server with a custom shutdown signal.
///
/// Use this when running as a Windows service where you need to control
/// the shutdown signal externally.
pub async fn run_server_with_shutdown<F>(
    router: Router,
    config: &ServiceConfig,
    shutdown: F,
) -> anyhow::Result<()>
where
    F: std::future::Future<Output = ()> + Send + 'static,
{
    let addr = config.socket_addr();
    tracing::info!("Listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;

    axum::serve(listener, router)
        .with_graceful_shutdown(shutdown)
        .await?;

    tracing::info!("Server stopped gracefully");
    Ok(())
}

/// Wait for a shutdown signal (Ctrl+C or SIGTERM).
async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("Failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("Failed to install SIGTERM handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
}

/// Gracefully shutdown the service on receiving Ctrl+C or SIGTERM.
///
/// This function waits for a shutdown signal and logs when it's received.
/// It handles both Unix signals (SIGTERM) and cross-platform signals (Ctrl+C).
///
/// # Usage
///
/// Typically used as a shutdown signal for Axum servers:
///
/// ```rust,ignore
/// use signapps_common::bootstrap::graceful_shutdown;
///
/// let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;
/// axum::serve(listener, router)
///     .with_graceful_shutdown(graceful_shutdown())
///     .await?;
/// ```
pub async fn graceful_shutdown() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("Failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("Failed to install SIGTERM handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {
            tracing::info!("Received Ctrl+C, initiating graceful shutdown...");
        }
        _ = terminate => {
            tracing::info!("Received SIGTERM, initiating graceful shutdown...");
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// BOOTSTRAP MACRO
// ═══════════════════════════════════════════════════════════════════════════

/// Macro for quick service bootstrap.
///
/// This macro handles the common initialization pattern for SignApps services.
///
/// # Example
///
/// ```rust,ignore
/// use signapps_common::bootstrap_service;
///
/// bootstrap_service! {
///     name: "signapps-myservice",
///     port: 3020,
///     init: |config, pool| {
///         // Create your AppState here
///         let state = MyAppState { pool, jwt_config: config.jwt_config() };
///         // Return your router
///         create_router(state)
///     }
/// }
/// ```
#[macro_export]
macro_rules! bootstrap_service {
    (
        name: $name:expr,
        port: $port:expr,
        init: |$config:ident, $pool:ident| $body:block
    ) => {
        #[tokio::main]
        async fn main() -> anyhow::Result<()> {
            // Initialize tracing
            $crate::bootstrap::init_tracing($name);

            // Load environment
            $crate::bootstrap::load_env();

            // Create configuration
            let $config = $crate::bootstrap::ServiceConfig::from_env($name, $port);
            $config.log_startup();

            // Create database pool
            let $pool = $config.create_pool().await?;

            // Run migrations
            if let Err(e) = signapps_db::run_migrations(&$pool).await {
                tracing::warn!(
                    "Database migrations could not be completed, continuing anyway: {}",
                    e
                );
            }

            // User-provided initialization
            let router = $body;

            // Apply middleware and run
            let router = $crate::bootstrap::middleware_stack(router);
            $crate::bootstrap::run_server(router, &$config).await
        }
    };

    // Version without database
    (
        name: $name:expr,
        port: $port:expr,
        no_db,
        init: |$config:ident| $body:block
    ) => {
        #[tokio::main]
        async fn main() -> anyhow::Result<()> {
            // Initialize tracing
            $crate::bootstrap::init_tracing($name);

            // Load environment
            $crate::bootstrap::load_env();

            // Create configuration
            let $config = $crate::bootstrap::ServiceConfig::from_env($name, $port);
            $config.log_startup();

            // User-provided initialization
            let router = $body;

            // Apply middleware and run
            let router = $crate::bootstrap::middleware_stack(router);
            $crate::bootstrap::run_server(router, &$config).await
        }
    };
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_env_or() {
        // Test with non-existent variable
        let result = env_or("NONEXISTENT_VAR_12345", "default_value");
        assert_eq!(result, "default_value");
    }

    #[test]
    fn test_service_config() {
        // Temporarily set env vars
        std::env::set_var("DATABASE_URL", "postgres://test:test@localhost/test");
        std::env::set_var("JWT_SECRET", "test_secret_32_characters_long__");
        std::env::set_var("SERVER_PORT", "9999");

        let config = ServiceConfig::from_env("test-service", 3000);

        assert_eq!(config.name, "test-service");
        assert_eq!(config.port, 9999);
        assert_eq!(config.database_url, "postgres://test:test@localhost/test");
        assert_eq!(config.jwt_secret, "test_secret_32_characters_long__");

        // Cleanup
        std::env::remove_var("DATABASE_URL");
        std::env::remove_var("JWT_SECRET");
        std::env::remove_var("SERVER_PORT");
    }

    #[test]
    fn test_jwt_config() {
        let config = ServiceConfig {
            name: "test-service".to_string(),
            default_port: 3000,
            database_url: "postgres://localhost/test".to_string(),
            jwt_secret: "test_secret".to_string(),
            host: "0.0.0.0".to_string(),
            port: 3000,
        };

        let jwt = config.jwt_config();

        assert_eq!(jwt.issuer, "signapps");
        assert_eq!(jwt.audience, "test-service");
        assert_eq!(jwt.access_expiration, 900);
        assert_eq!(jwt.refresh_expiration, 604800);
    }
}
