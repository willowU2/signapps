//! Embedded provider catalog and DB-backed overrides.

use crate::provider::ProviderDefinition;
use serde::Deserialize;
use std::collections::HashMap;
use thiserror::Error;

/// Errors from catalog operations.
#[derive(Debug, Error)]
pub enum CatalogError {
    /// Catalog JSON is malformed.
    #[error("catalog JSON parse error: {0}")]
    Parse(#[from] serde_json::Error),
    /// Provider not found by key.
    #[error("provider {0:?} not found in catalog")]
    NotFound(String),
}

/// Root of the embedded catalog.json file.
#[derive(Debug, Deserialize)]
struct CatalogFile {
    #[allow(dead_code)]
    version: String,
    providers: HashMap<String, ProviderDefinition>,
}

/// Embedded provider catalog + DB lookup.
///
/// Use [`Catalog::load_embedded`] to get the static catalog compiled
/// into the binary from `catalog.json`. Future versions will layer
/// tenant-specific DB overrides on top via a `resolve(tenant_id, key)`
/// method that consults the `oauth_providers` table.
#[derive(Debug)]
pub struct Catalog {
    providers: HashMap<String, ProviderDefinition>,
}

impl Catalog {
    /// Load the embedded catalog compiled into the binary.
    ///
    /// # Errors
    ///
    /// Returns [`CatalogError::Parse`] if the embedded `catalog.json` is
    /// malformed. In practice this is impossible if `build.rs` is working,
    /// since it validates at compile time.
    pub fn load_embedded() -> Result<Self, CatalogError> {
        const CATALOG_JSON: &str = include_str!("../catalog.json");
        let file: CatalogFile = serde_json::from_str(CATALOG_JSON)?;
        Ok(Self {
            providers: file.providers,
        })
    }

    /// Look up a provider by its key.
    ///
    /// # Errors
    ///
    /// Returns [`CatalogError::NotFound`] if no provider with this key
    /// exists in the embedded catalog. Future versions will also consult
    /// the tenant's `oauth_providers` table for custom providers.
    pub fn get(&self, key: &str) -> Result<&ProviderDefinition, CatalogError> {
        self.providers
            .get(key)
            .ok_or_else(|| CatalogError::NotFound(key.to_string()))
    }

    /// Iterator over all embedded provider definitions.
    pub fn iter(&self) -> impl Iterator<Item = (&str, &ProviderDefinition)> {
        self.providers.iter().map(|(k, v)| (k.as_str(), v))
    }

    /// Number of providers in the embedded catalog.
    #[must_use]
    pub fn len(&self) -> usize {
        self.providers.len()
    }

    /// True if the catalog is empty.
    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.providers.is_empty()
    }

    /// Build a catalog from an explicit map of providers — useful for tests
    /// and for custom tenant catalogs from the oauth_providers table.
    #[must_use]
    pub fn from_providers(providers: HashMap<String, ProviderDefinition>) -> Self {
        Self { providers }
    }

    /// Return a new catalog with `additions` overlaid on top of the
    /// embedded catalog (additions win on key collision).
    ///
    /// # Errors
    ///
    /// Returns [`CatalogError::Parse`] if the embedded catalog is malformed
    /// (impossible if build.rs validation is in place).
    pub fn with_overrides(
        additions: HashMap<String, ProviderDefinition>,
    ) -> Result<Self, CatalogError> {
        let mut base = Self::load_embedded()?;
        base.providers.extend(additions);
        Ok(base)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocol::Protocol;

    #[test]
    fn loads_embedded_catalog() {
        let cat = Catalog::load_embedded().expect("embedded catalog loads");
        assert!(cat.len() >= 10, "catalog should have ≥ 10 providers");
    }

    #[test]
    fn can_find_google() {
        let cat = Catalog::load_embedded().unwrap();
        let g = cat.get("google").expect("google should be in catalog");
        assert_eq!(g.display_name, "Google");
        assert_eq!(g.protocol, Protocol::OAuth2);
        assert!(g.supports_refresh);
    }

    #[test]
    fn rejects_unknown_provider() {
        let cat = Catalog::load_embedded().unwrap();
        let err = cat.get("nonexistent_provider_xyz").unwrap_err();
        assert!(matches!(err, CatalogError::NotFound(_)));
    }

    #[test]
    fn microsoft_has_template_var() {
        let cat = Catalog::load_embedded().unwrap();
        let ms = cat.get("microsoft").unwrap();
        assert!(ms.template_vars.contains(&"tenant".to_string()));
    }

    #[test]
    fn override_replaces_embedded_provider() {
        use crate::protocol::Protocol;

        let mut overrides = HashMap::new();
        overrides.insert(
            "google".to_string(),
            ProviderDefinition {
                key: "google".into(),
                display_name: "Google (test)".into(),
                protocol: Protocol::OAuth2,
                authorize_url: "https://test.example/authorize".into(),
                access_url: "https://test.example/token".into(),
                refresh_url: None,
                profile_url: None,
                revoke_url: None,
                scope_delimiter: " ".into(),
                default_scopes: vec![],
                pkce_required: false,
                supports_refresh: false,
                token_placement: crate::protocol::TokenPlacement::Header,
                user_id_field: "$.sub".into(),
                user_email_field: None,
                user_name_field: None,
                categories: vec![],
                template_vars: vec![],
                extra_params_required: vec![],
                notes: None,
            },
        );
        let catalog = Catalog::with_overrides(overrides).unwrap();
        let g = catalog.get("google").unwrap();
        assert_eq!(g.display_name, "Google (test)");
        assert_eq!(g.authorize_url, "https://test.example/authorize");
        // microsoft is still from the embedded catalog
        assert!(catalog.get("microsoft").is_ok());
    }
}
