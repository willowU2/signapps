//! Top-level OAuth errors.

use thiserror::Error;

/// All OAuth-level errors.
#[derive(Debug, Error)]
pub enum OAuthError {
    /// Catalog-related error.
    #[error(transparent)]
    Catalog(#[from] crate::catalog::CatalogError),
    /// State-related error.
    #[error(transparent)]
    State(#[from] crate::state::StateError),
}
