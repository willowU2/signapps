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
}
