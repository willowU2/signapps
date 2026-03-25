//! Trust Level System for API operations.
//!
//! Defines hierarchical trust levels and middleware to enforce minimum trust per endpoint.

use axum::{extract::Request, middleware::Next, response::Response, http::StatusCode};

/// Trust levels in ascending order of privilege.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, serde::Serialize, serde::Deserialize)]
#[repr(u8)]
pub enum TrustLevel {
    Guest = 0,
    User = 1,
    Editor = 2,
    Admin = 3,
    SuperAdmin = 4,
}

impl TrustLevel {
    pub fn from_u8(v: u8) -> Self {
        match v {
            0 => Self::Guest,
            1 => Self::User,
            2 => Self::Editor,
            3 => Self::Admin,
            4 => Self::SuperAdmin,
            _ => Self::Guest,
        }
    }

    pub fn label(&self) -> &'static str {
        match self {
            Self::Guest => "guest",
            Self::User => "user",
            Self::Editor => "editor",
            Self::Admin => "admin",
            Self::SuperAdmin => "superadmin",
        }
    }
}

impl std::fmt::Display for TrustLevel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.label())
    }
}

/// Axum middleware that checks the user's trust level from request extensions.
///
/// Usage:
/// ```rust,ignore
/// use axum::middleware;
/// use signapps_common::trust_level::{require_trust, TrustLevel};
///
/// let app = Router::new()
///     .route("/admin/users", get(list_users))
///     .layer(middleware::from_fn(|req, next| require_trust(TrustLevel::Admin, req, next)));
/// ```
pub async fn require_trust(
    min_level: TrustLevel,
    req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let user_level = req
        .extensions()
        .get::<TrustLevel>()
        .copied()
        .unwrap_or(TrustLevel::Guest);

    if user_level >= min_level {
        Ok(next.run(req).await)
    } else {
        tracing::warn!(
            required = %min_level,
            actual = %user_level,
            "Insufficient trust level"
        );
        Err(StatusCode::FORBIDDEN)
    }
}
