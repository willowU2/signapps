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
