//! OAuth2/OIDC/SAML unified state machine, catalog, and scope resolver.
//!
//! Companion crate to `signapps-keystore` (master key + DEKs) and
//! `signapps-common::crypto` (`EncryptedField` trait). Used by
//! `signapps-identity` to serve unified OAuth endpoints across all
//! providers (Google, Microsoft, GitHub, custom OIDC/SAML).
#![warn(missing_docs)]

mod catalog;
mod config_store;
mod engine_v2;
mod error;
pub mod events;
pub mod oidc;
pub mod pkce;
mod profile;
mod protocol;
mod provider;
pub mod refresh;
mod scope;
mod state;
pub mod token_table;
mod types;

pub use catalog::{Catalog, CatalogError};
pub use config_store::{ConfigStore, PgConfigStore};
pub use engine_v2::{EngineV2, EngineV2Config};
pub use error::OAuthError;
pub use events::{
    OAuthTokenInvalidated, OAuthTokensAcquired, EVENT_OAUTH_TOKENS_ACQUIRED,
    EVENT_OAUTH_TOKEN_INVALIDATED,
};
pub use profile::extract_profile;
pub use protocol::{OAuthPurpose, Protocol, ProviderCategory, TokenPlacement};
pub use provider::{ProviderConfig, ProviderDefinition, ProviderSummary};
pub use scope::{ScopeResolver, UserContext};
pub use state::{FlowState, StateError};
pub use refresh::{try_refresh, RefreshOutcome};
pub use token_table::{
    CalendarConnectionsTable, EncryptedTokens, MailAccountsTable, SocialAccountsTable, TokenTable,
};
pub use types::{
    CallbackRequest, CallbackResponse, ProviderProfile, ResolvedCredentials, StartRequest,
    StartResponse, TokenResponse,
};
