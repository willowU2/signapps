//! HTTP middleware for SignApps services.
//!
//! Provides common middleware components:
//! - Authentication (JWT verification)
//! - Authorization (role-based access control)
//! - Request logging with tracing
//! - Request ID propagation

use axum::{
    body::Body,
    extract::{Request, State},
    http::header,
    middleware::Next,
    response::Response,
};

use crate::auth::JwtConfig;
use crate::{Claims, Error};

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
    let auth_header = request
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|h| h.to_str().ok());

    let token = match auth_header {
        Some(h) if h.starts_with("Bearer ") => &h[7..],
        _ => return Err(Error::Unauthorized),
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

    // Add claims to request extensions for handlers to access
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
    if let Some(auth_header) = request
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|h| h.to_str().ok())
    {
        if let Some(token) = auth_header.strip_prefix("Bearer ") {
            if let Ok(claims) = verify_token(token, state.jwt_config()) {
                let now = chrono::Utc::now().timestamp();
                if claims.exp >= now && claims.token_type == "access" {
                    request.extensions_mut().insert(claims);
                }
            }
        }
    }

    next.run(request).await
}

/// Require admin role (role == 0).
/// Role hierarchy: 0 = Admin, 1 = User, 2 = Viewer
pub async fn require_admin(request: Request, next: Next) -> Result<Response, Error> {
    let claims = request
        .extensions()
        .get::<Claims>()
        .ok_or(Error::Unauthorized)?;

    // Role 0 is Admin - lower number = higher privilege
    if claims.role != 0 {
        return Err(Error::Forbidden("Admin access required".to_string()));
    }

    Ok(next.run(request).await)
}

/// Require at least user role (role <= 1, excludes viewers).
/// Role hierarchy: 0 = Admin, 1 = User, 2 = Viewer
pub async fn require_user(request: Request, next: Next) -> Result<Response, Error> {
    let claims = request
        .extensions()
        .get::<Claims>()
        .ok_or(Error::Unauthorized)?;

    // Roles 0 (Admin) and 1 (User) can access, role 2 (Viewer) cannot
    if claims.role > 1 {
        return Err(Error::Forbidden("User access required".to_string()));
    }

    Ok(next.run(request).await)
}

/// Log request details with tracing.
pub async fn logging_middleware(request: Request, next: Next) -> Response {
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

    let _guard = span.enter();

    let response = next.run(request).await;

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

    request.headers_mut().insert(
        "x-request-id",
        request_id.parse().unwrap(),
    );

    let mut response = next.run(request).await;

    response.headers_mut().insert(
        "x-request-id",
        request_id.parse().unwrap(),
    );

    response
}

/// Verify a JWT token and extract claims.
fn verify_token(token: &str, config: &JwtConfig) -> Result<Claims, Error> {
    use jsonwebtoken::{decode, DecodingKey, Validation};

    let mut validation = Validation::default();
    validation.set_issuer(&[&config.issuer]);
    validation.set_audience(&[&config.audience]);

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
}

impl RequestClaimsExt for Request<Body> {
    fn claims(&self) -> Option<&Claims> {
        self.extensions().get::<Claims>()
    }

    fn claims_required(&self) -> Result<&Claims, Error> {
        self.claims().ok_or(Error::Unauthorized)
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
}
