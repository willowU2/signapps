//! OAuth2/OIDC/SAML unified state machine, catalog, and scope resolver.
//!
//! Companion crate to `signapps-keystore` (master key + DEKs) and
//! `signapps-common::crypto` (`EncryptedField` trait). Used by
//! `signapps-identity` to serve unified OAuth endpoints across all
//! providers (Google, Microsoft, GitHub, custom OIDC/SAML).
#![warn(missing_docs)]

mod catalog;
mod config_store;
mod error;
mod protocol;
mod provider;
mod scope;
mod state;

pub use catalog::{Catalog, CatalogError};
pub use config_store::{ConfigStore, PgConfigStore};
pub use error::OAuthError;
pub use protocol::{OAuthPurpose, Protocol, ProviderCategory, TokenPlacement};
pub use provider::{ProviderConfig, ProviderDefinition, ProviderSummary};
pub use scope::{ScopeResolver, UserContext};
pub use state::{FlowState, StateError};
