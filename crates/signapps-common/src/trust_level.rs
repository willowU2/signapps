//! Trust Level System for API operations.
//!
//! Defines hierarchical trust levels and middleware to enforce minimum trust per endpoint.

use axum::{extract::Request, http::StatusCode, middleware::Next, response::Response};

/// Trust levels in ascending order of privilege.
#[derive(
    Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, serde::Serialize, serde::Deserialize,
)]
#[repr(u8)]
/// Enum representing TrustLevel variants.
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_trust_level_ordering() {
        assert!(TrustLevel::Guest < TrustLevel::User);
        assert!(TrustLevel::User < TrustLevel::Editor);
        assert!(TrustLevel::Editor < TrustLevel::Admin);
        assert!(TrustLevel::Admin < TrustLevel::SuperAdmin);
    }

    #[test]
    fn test_trust_level_from_u8() {
        assert_eq!(TrustLevel::from_u8(0), TrustLevel::Guest);
        assert_eq!(TrustLevel::from_u8(1), TrustLevel::User);
        assert_eq!(TrustLevel::from_u8(2), TrustLevel::Editor);
        assert_eq!(TrustLevel::from_u8(3), TrustLevel::Admin);
        assert_eq!(TrustLevel::from_u8(4), TrustLevel::SuperAdmin);
        // Out-of-range defaults to Guest
        assert_eq!(TrustLevel::from_u8(99), TrustLevel::Guest);
    }

    #[test]
    fn test_trust_level_label() {
        assert_eq!(TrustLevel::Guest.label(), "guest");
        assert_eq!(TrustLevel::User.label(), "user");
        assert_eq!(TrustLevel::Editor.label(), "editor");
        assert_eq!(TrustLevel::Admin.label(), "admin");
        assert_eq!(TrustLevel::SuperAdmin.label(), "superadmin");
    }

    #[test]
    fn test_trust_level_display() {
        assert_eq!(format!("{}", TrustLevel::Admin), "admin");
        assert_eq!(format!("{}", TrustLevel::SuperAdmin), "superadmin");
    }

    #[test]
    fn test_sufficient_trust_passes() {
        // Admin satisfies a requirement of Editor
        assert!(TrustLevel::Admin >= TrustLevel::Editor);
        // SuperAdmin satisfies Admin
        assert!(TrustLevel::SuperAdmin >= TrustLevel::Admin);
    }

    #[test]
    fn test_insufficient_trust_rejected() {
        // User does NOT satisfy Editor requirement
        assert!(!(TrustLevel::User >= TrustLevel::Editor));
        // Guest does NOT satisfy User requirement
        assert!(!(TrustLevel::Guest >= TrustLevel::User));
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
