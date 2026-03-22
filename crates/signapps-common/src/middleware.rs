//! HTTP middleware for SignApps services.
//!
//! Provides common middleware components:
//! - Authentication (JWT verification)
//! - Authorization (role-based access control)
//! - Request logging with tracing
//! - Request ID propagation
//! - Prometheus metrics

use axum::{
    body::Body,
    extract::{Request, State},
    http::header,
    middleware::Next,
    response::Response,
};

use uuid::Uuid;

use crate::auth::JwtConfig;
use crate::{Claims, Error};

/// Tenant context for multi-tenant isolation.
#[derive(Debug, Clone)]
pub struct TenantContext {
    /// The tenant ID for the current request.
    pub tenant_id: Uuid,
    /// Workspace IDs the user has access to (if any).
    pub workspace_ids: Vec<Uuid>,
}

/// Trait for application state that supports authentication.
///
/// Implement this trait for your service's AppState to enable auth middleware.
pub trait AuthState: Clone + Send + Sync + 'static {
    /// Get the JWT configuration.
    fn jwt_config(&self) -> &JwtConfig;
}

/// Extract and verify JWT token from Authorization header.
///
/// On success, injects `Claims` into request extensions.
pub async fn auth_middleware<S: AuthState>(
    State(state): State<S>,
    mut request: Request,
    next: Next,
) -> Result<Response, Error> {
    let mut token = None;

    // First try Authorization header
    if let Some(auth_header) = request.headers().get(header::AUTHORIZATION).and_then(|h| h.to_str().ok()) {
        if let Some(t) = auth_header.strip_prefix("Bearer ") {
            token = Some(t);
        }
    }

    // Fallback to Cookies
    if token.is_none() {
        if let Some(cookie_header) = request.headers().get(header::COOKIE).and_then(|h| h.to_str().ok()) {
            for cookie in cookie_header.split(';') {
                let cookie = cookie.trim();
                if let Some(t) = cookie.strip_prefix("access_token=") {
                    token = Some(t);
                    break;
                }
            }
        }
    }

    let token = match token {
        Some(t) => t,
        None => return Err(Error::Unauthorized),
    };

    // Verify JWT token
    let claims = verify_token(token, state.jwt_config())?;

    // Check if token is expired
    let now = chrono::Utc::now().timestamp();
    if claims.exp < now {
        return Err(Error::TokenExpired);
    }

    // Check token type
    if claims.token_type != "access" {
        return Err(Error::InvalidToken);
    }

    // Add claims and user ID to request extensions for handlers to access
    request.extensions_mut().insert(claims.sub);
    request.extensions_mut().insert(claims);

    Ok(next.run(request).await)
}

/// Optional authentication middleware.
///
/// If a valid token is present, injects `Claims` into request extensions.
/// If no token is present or token is invalid, continues without claims.
pub async fn optional_auth_middleware<S: AuthState>(
    State(state): State<S>,
    mut request: Request,
    next: Next,
) -> Response {
    let mut token = None;

    if let Some(auth_header) = request.headers().get(header::AUTHORIZATION).and_then(|h| h.to_str().ok()) {
        if let Some(t) = auth_header.strip_prefix("Bearer ") {
            token = Some(t);
        }
    }

    if token.is_none() {
        if let Some(cookie_header) = request.headers().get(header::COOKIE).and_then(|h| h.to_str().ok()) {
            for cookie in cookie_header.split(';') {
                let cookie = cookie.trim();
                if let Some(t) = cookie.strip_prefix("access_token=") {
                    token = Some(t);
                    break;
                }
            }
        }
    }

    if let Some(t) = token {
        if let Ok(claims) = verify_token(t, state.jwt_config()) {
            let now = chrono::Utc::now().timestamp();
            if claims.exp >= now && claims.token_type == "access" {
                request.extensions_mut().insert(claims);
            }
        }
    }

    next.run(request).await
}

/// Require admin role (role >= 2).
/// Role hierarchy: 1 = User, 2 = Admin, 3 = SuperAdmin (matches UserRole enum)
pub async fn require_admin(request: Request, next: Next) -> Result<Response, Error> {
    let claims = request
        .extensions()
        .get::<Claims>()
        .ok_or(Error::Unauthorized)?;

    // Admin = 2, SuperAdmin = 3
    if claims.role < 2 {
        return Err(Error::Forbidden("Admin access required".to_string()));
    }

    Ok(next.run(request).await)
}

/// Require at least user role (role >= 1).
/// Role hierarchy: 1 = User, 2 = Admin, 3 = SuperAdmin (matches UserRole enum)
pub async fn require_user(request: Request, next: Next) -> Result<Response, Error> {
    let claims = request
        .extensions()
        .get::<Claims>()
        .ok_or(Error::Unauthorized)?;

    // User = 1, Admin = 2, SuperAdmin = 3
    if claims.role < 1 {
        return Err(Error::Forbidden("User access required".to_string()));
    }

    Ok(next.run(request).await)
}

/// Extract tenant context from authenticated request.
///
/// This middleware should be applied AFTER `auth_middleware`.
/// It extracts the tenant_id from the JWT claims and injects a `TenantContext`
/// into the request extensions for use by handlers and repositories.
///
/// Returns Forbidden if the user doesn't have a tenant_id (not yet assigned to a tenant).
pub async fn tenant_context_middleware(request: Request, next: Next) -> Result<Response, Error> {
    let claims = request
        .extensions()
        .get::<Claims>()
        .ok_or(Error::Unauthorized)?;

    let tenant_id = claims
        .tenant_id
        .ok_or_else(|| Error::Forbidden("User not assigned to any tenant".to_string()))?;

    let workspace_ids = claims.workspace_ids.clone().unwrap_or_default();

    let context = TenantContext {
        tenant_id,
        workspace_ids,
    };

    let mut request = request;
    request.extensions_mut().insert(context);

    Ok(next.run(request).await)
}

/// Optional tenant context middleware.
///
/// If claims contain a tenant_id, injects `TenantContext` into request extensions.
/// If not, continues without tenant context (for super-admin or system endpoints).
pub async fn optional_tenant_context_middleware(request: Request, next: Next) -> Response {
    let context = request.extensions().get::<Claims>().and_then(|claims| {
        claims.tenant_id.map(|tenant_id| TenantContext {
            tenant_id,
            workspace_ids: claims.workspace_ids.clone().unwrap_or_default(),
        })
    });

    let mut request = request;
    if let Some(ctx) = context {
        request.extensions_mut().insert(ctx);
    }

    next.run(request).await
}

/// Require access to a specific workspace.
///
/// Checks if the user has access to the workspace_id provided in the path.
/// This middleware should be used for workspace-specific endpoints.
pub async fn require_workspace_access(request: Request, next: Next) -> Result<Response, Error> {
    let context = request
        .extensions()
        .get::<TenantContext>()
        .ok_or_else(|| Error::Forbidden("Tenant context required".to_string()))?;

    // Extract workspace_id from path if present
    // This is a simplified version - actual implementation would need to
    // extract from path params based on route definition
    let workspace_id = request.extensions().get::<Uuid>().copied();

    if let Some(ws_id) = workspace_id {
        // Check if user has access to this workspace
        if !context.workspace_ids.contains(&ws_id) {
            return Err(Error::Forbidden("No access to this workspace".to_string()));
        }
    }

    Ok(next.run(request).await)
}

/// Log request details with tracing.
pub async fn logging_middleware(request: Request, next: Next) -> Response {
    use tracing::Instrument;

    let method = request.method().clone();
    let uri = request.uri().clone();
    let version = request.version();

    let request_id = request
        .headers()
        .get("x-request-id")
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string())
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

    let start = std::time::Instant::now();

    let span = tracing::info_span!(
        "request",
        method = %method,
        uri = %uri,
        version = ?version,
        request_id = %request_id,
    );

    let response = next.run(request).instrument(span).await;

    let duration = start.elapsed();
    let status = response.status();

    if status.is_server_error() {
        tracing::error!(
            status = %status,
            duration_ms = duration.as_millis(),
            "Request completed with error"
        );
    } else if status.is_client_error() {
        tracing::warn!(
            status = %status,
            duration_ms = duration.as_millis(),
            "Request completed with client error"
        );
    } else {
        tracing::info!(
            status = %status,
            duration_ms = duration.as_millis(),
            "Request completed"
        );
    }

    response
}

/// Add request ID to all requests.
pub async fn request_id_middleware(mut request: Request, next: Next) -> Response {
    let request_id = request
        .headers()
        .get("x-request-id")
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string())
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

    request
        .headers_mut()
        .insert("x-request-id", request_id.parse().unwrap());

    let mut response = next.run(request).await;

    response
        .headers_mut()
        .insert("x-request-id", request_id.parse().unwrap());

    response
}

/// Verify a JWT token and extract claims.
fn verify_token(token: &str, config: &JwtConfig) -> Result<Claims, Error> {
    use jsonwebtoken::{decode, DecodingKey, Validation};

    let mut validation = Validation::default();
    // Tokens don't include iss/aud claims, so disable validation for these
    validation.validate_aud = false;
    validation.set_required_spec_claims(&["exp", "sub"]);

    let key = DecodingKey::from_secret(config.secret.as_bytes());

    let token_data = decode::<Claims>(token, &key, &validation)?;

    Ok(token_data.claims)
}

/// Extension trait to extract claims from request.
pub trait RequestClaimsExt {
    /// Get claims from request extensions.
    fn claims(&self) -> Option<&Claims>;

    /// Get claims or return Unauthorized error.
    fn claims_required(&self) -> Result<&Claims, Error>;

    /// Get tenant context from request extensions.
    fn tenant_context(&self) -> Option<&TenantContext>;

    /// Get tenant context or return Forbidden error.
    fn tenant_context_required(&self) -> Result<&TenantContext, Error>;

    /// Get tenant ID from claims or context.
    fn tenant_id(&self) -> Option<Uuid>;

    /// Get tenant ID or return Forbidden error.
    fn tenant_id_required(&self) -> Result<Uuid, Error>;
}

impl RequestClaimsExt for Request<Body> {
    fn claims(&self) -> Option<&Claims> {
        self.extensions().get::<Claims>()
    }

    fn claims_required(&self) -> Result<&Claims, Error> {
        self.claims().ok_or(Error::Unauthorized)
    }

    fn tenant_context(&self) -> Option<&TenantContext> {
        self.extensions().get::<TenantContext>()
    }

    fn tenant_context_required(&self) -> Result<&TenantContext, Error> {
        self.tenant_context()
            .ok_or_else(|| Error::Forbidden("Tenant context required".to_string()))
    }

    fn tenant_id(&self) -> Option<Uuid> {
        self.tenant_context()
            .map(|ctx| ctx.tenant_id)
            .or_else(|| self.claims().and_then(|c| c.tenant_id))
    }

    fn tenant_id_required(&self) -> Result<Uuid, Error> {
        self.tenant_id()
            .ok_or_else(|| Error::Forbidden("Tenant ID required".to_string()))
    }
}

/// Prometheus metrics middleware and handlers.
///
/// Tracks HTTP request metrics:
/// - `http_requests_total`: Counter with labels (method, path, status)
/// - `http_request_duration_seconds`: Histogram with labels (method, path)
///
/// # Usage
///
/// Add the metrics middleware to your Axum router:
///
/// ```ignore
/// use axum::middleware;
/// use signapps_common::metrics_middleware;
///
/// let app = Router::new()
///     .route("/api/users", post(create_user))
///     .route("/metrics", get(metrics_handler))
///     .layer(middleware::from_fn(metrics_middleware));
/// ```
///
/// The `/metrics` endpoint will expose metrics in Prometheus text format.
pub mod metrics {
    use axum::response::IntoResponse;
    use prometheus::{HistogramVec, TextEncoder, Encoder, Registry, IntCounterVec};
    use std::time::Instant;
    use once_cell::sync::Lazy;

    /// Global registry for metrics.
    pub static REGISTRY: Lazy<Registry> = Lazy::new(|| Registry::new());

    /// Total HTTP requests counter.
    pub static HTTP_REQUESTS_TOTAL: Lazy<IntCounterVec> = Lazy::new(|| {
        let counter = IntCounterVec::new(
            prometheus::Opts::new("http_requests_total", "Total HTTP requests"),
            &["method", "path", "status"],
        ).expect("Failed to create http_requests_total counter");
        REGISTRY.register(Box::new(counter.clone())).expect("Failed to register counter");
        counter
    });

    /// HTTP request duration histogram.
    pub static HTTP_REQUEST_DURATION_SECONDS: Lazy<HistogramVec> = Lazy::new(|| {
        let histogram = HistogramVec::new(
            prometheus::HistogramOpts::new("http_request_duration_seconds", "HTTP request duration in seconds"),
            &["method", "path"],
        ).expect("Failed to create http_request_duration_seconds histogram");
        REGISTRY.register(Box::new(histogram.clone())).expect("Failed to register histogram");
        histogram
    });

    /// Metrics collector for HTTP requests.
    #[derive(Clone, Default)]
    pub struct MetricsCollector;

    impl MetricsCollector {
        /// Create a new metrics collector.
        pub fn new() -> Self {
            // Ensure statics are initialized
            let _ = &*HTTP_REQUESTS_TOTAL;
            let _ = &*HTTP_REQUEST_DURATION_SECONDS;
            Self
        }

        /// Record an HTTP request with method, path, and status.
        pub fn record_request(&self, method: &str, path: &str, status: u16, duration_secs: f64) {
            // Record counter with labels
            HTTP_REQUESTS_TOTAL
                .with_label_values(&[method, path, &status.to_string()])
                .inc();

            // Record histogram with labels (duration in seconds)
            HTTP_REQUEST_DURATION_SECONDS
                .with_label_values(&[method, path])
                .observe(duration_secs);
        }
    }

    /// Metrics middleware handler.
    ///
    /// Tracks request duration and records metrics when request completes.
    pub async fn metrics_middleware(
        request: axum::extract::Request,
        next: axum::middleware::Next,
    ) -> axum::response::Response {
        let method = request.method().to_string();
        let path = request.uri().path().to_string();
        let start = Instant::now();

        let response = next.run(request).await;

        let duration = start.elapsed();
        let duration_secs = duration.as_secs_f64();
        let status = response.status().as_u16();

        let collector = MetricsCollector::new();
        collector.record_request(&method, &path, status, duration_secs);

        response
    }

    /// Handler to expose metrics in Prometheus text format.
    ///
    /// Collects metrics from all collectors registered in the global registry
    /// and returns them in Prometheus exposition format.
    pub async fn metrics_handler() -> impl IntoResponse {
        let encoder = TextEncoder::new();
        let metric_families = REGISTRY.gather();
        let mut buffer = vec![];
        encoder.encode(&metric_families, &mut buffer).unwrap_or(());

        (
            [(axum::http::header::CONTENT_TYPE, "text/plain; charset=utf-8")],
            String::from_utf8(buffer).unwrap_or_default(),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_jwt_config_default() {
        let config = JwtConfig::default();
        assert_eq!(config.access_expiration, 900);
        assert_eq!(config.refresh_expiration, 604800);
    }

    #[test]
    fn test_metrics_collector_creation() {
        let collector = metrics::MetricsCollector::new();
        // Record a test metric
        collector.record_request("GET", "/api/test", 200, 0.1);
        // If this runs without panic, the metrics collector is working
    }
}
