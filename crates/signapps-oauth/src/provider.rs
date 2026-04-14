//! Provider definitions — embedded (catalog.json) and DB-backed override.

use crate::protocol::{Protocol, ProviderCategory, TokenPlacement};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Static definition of an OAuth/OIDC/SAML provider from the embedded catalog.
///
/// Catalog JSON is loaded via [`crate::Catalog::load_embedded()`] and
/// overrides are fetched from the `oauth_providers` DB table per tenant.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ProviderDefinition {
    /// Unique slug (e.g., "google", "microsoft", "keycloak-acme").
    pub key: String,
    /// Human-readable name shown in admin/user UI.
    pub display_name: String,
    /// Protocol flavor.
    pub protocol: Protocol,
    /// Authorization URL (where the user is redirected in step 1).
    pub authorize_url: String,
    /// Token endpoint (where we exchange the code for tokens).
    pub access_url: String,
    /// Refresh endpoint (falls back to `access_url` if None).
    #[serde(default)]
    pub refresh_url: Option<String>,
    /// UserInfo endpoint (where we fetch the user profile).
    #[serde(default)]
    pub profile_url: Option<String>,
    /// Token revocation endpoint.
    #[serde(default)]
    pub revoke_url: Option<String>,
    /// Character used to join multiple scopes into the `scope` param.
    #[serde(default = "default_scope_delimiter")]
    pub scope_delimiter: String,
    /// Default scopes to request if the caller does not specify any.
    #[serde(default)]
    pub default_scopes: Vec<String>,
    /// Whether this provider requires PKCE (S256).
    #[serde(default)]
    pub pkce_required: bool,
    /// Whether this provider issues refresh tokens.
    #[serde(default = "default_true")]
    pub supports_refresh: bool,
    /// How to send the access token on outgoing API calls.
    #[serde(default)]
    pub token_placement: TokenPlacement,
    /// JSONPath to the user ID in the profile response.
    #[serde(default = "default_user_id_field")]
    pub user_id_field: String,
    /// JSONPath to the user email.
    #[serde(default)]
    pub user_email_field: Option<String>,
    /// JSONPath to the user display name.
    #[serde(default)]
    pub user_name_field: Option<String>,
    /// Categories this provider serves (can be in multiple: e.g., Google
    /// appears in Mail + Calendar + Drive + Sso).
    #[serde(default)]
    pub categories: Vec<ProviderCategory>,
    /// Template variables required in URL substitution (e.g., `{"tenant"}`
    /// for Microsoft's `/:tenant/oauth2/v2.0/authorize`).
    #[serde(default)]
    pub template_vars: Vec<String>,
    /// Extra parameters that must be provided via `extra_params_enc` for
    /// this provider to work (e.g., Apple key_id, SAML IdP cert).
    #[serde(default)]
    pub extra_params_required: Vec<String>,
    /// Free-form notes for operators (quirks, URL params, etc.).
    #[serde(default)]
    pub notes: Option<String>,
}

/// Tenant-level configuration for a provider (from `oauth_provider_configs`).
///
/// Sensitive fields (`client_id_enc`, `client_secret_enc`, `extra_params_enc`)
/// are stored encrypted via [`signapps_common::crypto::EncryptedField`] and
/// only decrypted just before use.
#[derive(Debug, Clone)]
pub struct ProviderConfig {
    /// Row ID.
    pub id: Uuid,
    /// Tenant this config belongs to.
    pub tenant_id: Uuid,
    /// Provider key (matches `ProviderDefinition.key` or custom `oauth_providers.key`).
    pub provider_key: String,
    /// Encrypted client_id.
    pub client_id_enc: Option<Vec<u8>>,
    /// Encrypted client_secret.
    pub client_secret_enc: Option<Vec<u8>>,
    /// Encrypted extra params (JSON map).
    pub extra_params_enc: Option<Vec<u8>>,
    /// Whether this provider is enabled for the tenant.
    pub enabled: bool,
    /// Which OAuth purposes are allowed (login, integration).
    pub purposes: Vec<String>,
    /// Scopes the admin allows users to request for this provider.
    pub allowed_scopes: Vec<String>,
    /// Visibility rule: "all" or "restricted".
    pub visibility: String,
    /// If restricted: visible to these org nodes.
    pub visible_to_org_nodes: Vec<Uuid>,
    /// If restricted: visible to these groups.
    pub visible_to_groups: Vec<Uuid>,
    /// If restricted: visible to users with any of these roles.
    pub visible_to_roles: Vec<String>,
    /// If restricted: visible to these specific users (overrides group/role filters).
    pub visible_to_users: Vec<Uuid>,
    /// Whether users can supply their own client_id/secret for this provider.
    pub allow_user_override: bool,
    /// Whether this provider is configured as the tenant's SSO IdP.
    pub is_tenant_sso: bool,
    /// When `is_tenant_sso`, whether to auto-provision new users on first login.
    pub auto_provision_users: bool,
    /// Default role assigned to auto-provisioned users.
    pub default_role: Option<String>,
}

/// Summary of a provider for the admin/user UI (safe to return over API).
///
/// No encrypted fields — just the display metadata.
#[derive(Debug, Clone, Serialize)]
pub struct ProviderSummary {
    /// Provider key.
    pub key: String,
    /// Display name.
    pub display_name: String,
    /// Categories.
    pub categories: Vec<ProviderCategory>,
    /// Is this enabled for this tenant?
    pub enabled: bool,
    /// Allowed purposes (login / integration).
    pub purposes: Vec<String>,
    /// Is the provider visible to the current user (post-ScopeResolver)?
    pub visible: bool,
}

fn default_scope_delimiter() -> String {
    " ".to_string()
}

fn default_true() -> bool {
    true
}

fn default_user_id_field() -> String {
    "$.sub".to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn minimal_provider_definition_parses() {
        let json = r#"{
            "key": "google",
            "display_name": "Google",
            "protocol": "OAuth2",
            "authorize_url": "https://accounts.google.com/o/oauth2/v2/auth",
            "access_url": "https://oauth2.googleapis.com/token"
        }"#;
        let pd: ProviderDefinition = serde_json::from_str(json).unwrap();
        assert_eq!(pd.key, "google");
        assert_eq!(pd.protocol, Protocol::OAuth2);
        assert_eq!(pd.scope_delimiter, " ", "default scope_delimiter");
        assert!(pd.supports_refresh, "supports_refresh defaults to true");
        assert_eq!(pd.user_id_field, "$.sub", "default user_id_field");
        assert_eq!(pd.token_placement, TokenPlacement::Header);
    }

    #[test]
    fn full_provider_definition_parses() {
        let json = r#"{
            "key": "twitter",
            "display_name": "Twitter",
            "protocol": "OAuth2",
            "authorize_url": "https://twitter.com/i/oauth2/authorize",
            "access_url": "https://api.twitter.com/2/oauth2/token",
            "profile_url": "https://api.twitter.com/2/users/me",
            "scope_delimiter": " ",
            "default_scopes": ["tweet.read", "users.read", "offline.access"],
            "pkce_required": true,
            "supports_refresh": true,
            "user_id_field": "$.data.id",
            "user_name_field": "$.data.name",
            "categories": ["Social"]
        }"#;
        let pd: ProviderDefinition = serde_json::from_str(json).unwrap();
        assert_eq!(pd.key, "twitter");
        assert!(pd.pkce_required);
        assert_eq!(pd.default_scopes.len(), 3);
        assert_eq!(pd.categories, vec![ProviderCategory::Social]);
    }
}
