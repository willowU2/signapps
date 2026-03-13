//! Authentication types and utilities.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// JWT claims for access tokens.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    /// Subject (user ID)
    pub sub: Uuid,
    /// Username
    pub username: String,
    /// User role
    pub role: i16,
    /// Tenant ID for multi-tenant isolation (optional for backwards compatibility)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tenant_id: Option<Uuid>,
    /// Workspace IDs the user has access to (optional)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub workspace_ids: Option<Vec<Uuid>>,
    /// Expiration timestamp (Unix time)
    pub exp: i64,
    /// Issued at timestamp (Unix time)
    pub iat: i64,
    /// Token type ("access" or "refresh")
    pub token_type: String,
}

impl Claims {
    /// Get the tenant ID, returning None if not set.
    pub fn tenant_id(&self) -> Option<Uuid> {
        self.tenant_id
    }

    /// Check if the user has access to a specific workspace.
    pub fn has_workspace_access(&self, workspace_id: Uuid) -> bool {
        self.workspace_ids
            .as_ref()
            .is_some_and(|ids| ids.contains(&workspace_id))
    }
}

/// JWT configuration for token generation and validation.
#[derive(Debug, Clone)]
pub struct JwtConfig {
    /// Secret key for signing/verifying tokens.
    pub secret: String,
    /// Token issuer (iss claim).
    pub issuer: String,
    /// Token audience (aud claim).
    pub audience: String,
    /// Access token expiration in seconds.
    pub access_expiration: i64,
    /// Refresh token expiration in seconds.
    pub refresh_expiration: i64,
}

impl Default for JwtConfig {
    fn default() -> Self {
        Self {
            secret: "change-me-in-production".to_string(),
            issuer: "signapps".to_string(),
            audience: "signapps".to_string(),
            access_expiration: 900,     // 15 minutes
            refresh_expiration: 604800, // 7 days
        }
    }
}

/// Token pair returned after authentication.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenPair {
    /// Access token (short-lived)
    pub access_token: String,
    /// Refresh token (long-lived)
    pub refresh_token: String,
    /// Token type (always "Bearer")
    pub token_type: String,
    /// Access token expiration in seconds
    pub expires_in: i64,
}
