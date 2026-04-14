//! Embedded provider catalog and DB-backed overrides.

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

/// Placeholder — implemented in Task 6.
#[allow(dead_code)]
pub struct Catalog;
