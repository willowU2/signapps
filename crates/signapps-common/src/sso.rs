//! Single Sign-On (SSO) foundation and provider registry.
//!
//! Provides core abstractions for SAML2 and OIDC SSO integrations,
//! with a registry for managing multiple SSO providers.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

/// SSO protocol types.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum SsoProtocol {
    /// SAML 2.0 protocol
    Saml2,
    /// OpenID Connect protocol
    Oidc,
}

impl std::fmt::Display for SsoProtocol {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SsoProtocol::Saml2 => write!(f, "SAML2"),
            SsoProtocol::Oidc => write!(f, "OIDC"),
        }
    }
}

/// SSO configuration for authentication endpoints and credentials.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SsoConfig {
    /// Identity provider issuer URL
    pub issuer_url: String,
    /// OAuth2/OIDC client ID
    pub client_id: String,
    /// OAuth2/OIDC client secret (should be stored securely)
    pub client_secret: String,
    /// Redirect URI after authentication
    pub redirect_uri: String,
    /// Metadata endpoint URL (for OIDC discovery)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata_url: Option<String>,
}

impl SsoConfig {
    /// Create a new SSO configuration.
    pub fn new(
        issuer_url: String,
        client_id: String,
        client_secret: String,
        redirect_uri: String,
    ) -> Self {
        Self {
            issuer_url,
            client_id,
            client_secret,
            redirect_uri,
            metadata_url: None,
        }
    }

    /// Set the metadata URL for OIDC discovery.
    pub fn with_metadata_url(mut self, metadata_url: String) -> Self {
        self.metadata_url = Some(metadata_url);
        self
    }
}

/// SSO Provider configuration and state.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SsoProvider {
    /// Unique provider identifier
    pub id: Uuid,
    /// Human-readable provider name (e.g., "Azure AD", "Okta", "Google")
    pub name: String,
    /// SSO protocol type (SAML2 or OIDC)
    pub protocol: SsoProtocol,
    /// Provider configuration
    pub config: SsoConfig,
    /// Whether this provider is enabled
    pub enabled: bool,
}

impl SsoProvider {
    /// Create a new SSO provider.
    pub fn new(name: String, protocol: SsoProtocol, config: SsoConfig) -> Self {
        Self {
            id: Uuid::new_v4(),
            name,
            protocol,
            config,
            enabled: true,
        }
    }

    /// Disable this provider.
    pub fn disable(&mut self) {
        self.enabled = false;
    }

    /// Enable this provider.
    pub fn enable(&mut self) {
        self.enabled = true;
    }
}

/// Registry for managing SSO providers.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SsoProviderRegistry {
    providers: HashMap<Uuid, SsoProvider>,
}

impl SsoProviderRegistry {
    /// Create a new empty registry.
    pub fn new() -> Self {
        Self {
            providers: HashMap::new(),
        }
    }

    /// Register a new SSO provider.
    pub fn register(&mut self, provider: SsoProvider) -> Uuid {
        let id = provider.id;
        self.providers.insert(id, provider);
        id
    }

    /// Get a provider by ID.
    pub fn get(&self, id: Uuid) -> Option<&SsoProvider> {
        self.providers.get(&id)
    }

    /// Get a mutable reference to a provider by ID.
    pub fn get_mut(&mut self, id: Uuid) -> Option<&mut SsoProvider> {
        self.providers.get_mut(&id)
    }

    /// List all registered providers.
    pub fn list(&self) -> Vec<&SsoProvider> {
        self.providers.values().collect()
    }

    /// List only enabled providers.
    pub fn list_enabled(&self) -> Vec<&SsoProvider> {
        self.providers
            .values()
            .filter(|p| p.enabled)
            .collect()
    }

    /// Validate SSO configuration for a provider.
    pub fn validate_config(&self, provider: &SsoProvider) -> Result<(), String> {
        // Validate issuer URL
        if provider.config.issuer_url.is_empty() {
            return Err("Issuer URL cannot be empty".to_string());
        }

        // Validate client ID
        if provider.config.client_id.is_empty() {
            return Err("Client ID cannot be empty".to_string());
        }

        // Validate client secret
        if provider.config.client_secret.is_empty() {
            return Err("Client secret cannot be empty".to_string());
        }

        // Validate redirect URI
        if provider.config.redirect_uri.is_empty() {
            return Err("Redirect URI cannot be empty".to_string());
        }

        // Validate URL format (basic check)
        if !provider.config.issuer_url.starts_with("http://")
            && !provider.config.issuer_url.starts_with("https://")
        {
            return Err("Issuer URL must start with http:// or https://".to_string());
        }

        if !provider.config.redirect_uri.starts_with("http://")
            && !provider.config.redirect_uri.starts_with("https://")
        {
            return Err("Redirect URI must start with http:// or https://".to_string());
        }

        // For OIDC, metadata URL is recommended
        if provider.protocol == SsoProtocol::Oidc && provider.config.metadata_url.is_none() {
            return Err("OIDC providers should have a metadata URL".to_string());
        }

        Ok(())
    }

    /// Remove a provider by ID.
    pub fn remove(&mut self, id: Uuid) -> Option<SsoProvider> {
        self.providers.remove(&id)
    }

    /// Get provider count.
    pub fn count(&self) -> usize {
        self.providers.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sso_provider_creation() {
        let config = SsoConfig::new(
            "https://example.okta.com".to_string(),
            "client123".to_string(),
            "secret456".to_string(),
            "https://app.local/auth/callback".to_string(),
        );

        let provider = SsoProvider::new("Okta".to_string(), SsoProtocol::Oidc, config);

        assert_eq!(provider.name, "Okta");
        assert_eq!(provider.protocol, SsoProtocol::Oidc);
        assert!(provider.enabled);
    }

    #[test]
    fn test_sso_registry_operations() {
        let mut registry = SsoProviderRegistry::new();

        let config = SsoConfig::new(
            "https://example.okta.com".to_string(),
            "client123".to_string(),
            "secret456".to_string(),
            "https://app.local/auth/callback".to_string(),
        );
        let provider = SsoProvider::new("Okta".to_string(), SsoProtocol::Oidc, config);
        let id = provider.id;

        registry.register(provider);
        assert_eq!(registry.count(), 1);
        assert!(registry.get(id).is_some());

        let list = registry.list();
        assert_eq!(list.len(), 1);
    }

    #[test]
    fn test_validate_config_valid() {
        let config = SsoConfig::new(
            "https://example.okta.com".to_string(),
            "client123".to_string(),
            "secret456".to_string(),
            "https://app.local/auth/callback".to_string(),
        )
        .with_metadata_url("https://example.okta.com/.well-known/openid-configuration".to_string());

        let provider = SsoProvider::new("Okta".to_string(), SsoProtocol::Oidc, config);
        let registry = SsoProviderRegistry::new();

        assert!(registry.validate_config(&provider).is_ok());
    }

    #[test]
    fn test_validate_config_missing_fields() {
        let config = SsoConfig::new(String::new(), String::new(), String::new(), String::new());
        let provider = SsoProvider::new("Invalid".to_string(), SsoProtocol::Saml2, config);
        let registry = SsoProviderRegistry::new();

        assert!(registry.validate_config(&provider).is_err());
    }

    #[test]
    fn test_validate_config_invalid_url() {
        let config = SsoConfig::new(
            "not-a-url".to_string(),
            "client123".to_string(),
            "secret456".to_string(),
            "https://app.local/auth/callback".to_string(),
        );
        let provider = SsoProvider::new("Invalid".to_string(), SsoProtocol::Oidc, config);
        let registry = SsoProviderRegistry::new();

        assert!(registry.validate_config(&provider).is_err());
    }
}
