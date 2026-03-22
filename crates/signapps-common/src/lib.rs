//! # SignApps Common
//!
//! Shared utilities, types, and middleware for the SignApps Platform.
//!
//! ## Modules
//!
//! - [`audit`] - Audit trail / activity log (in-memory, middleware + query endpoint)
//! - [`auth`] - Authentication types (JWT claims, tokens)
//! - [`config`] - Application configuration
//! - [`error`] - RFC 7807 Problem Details error handling
//! - [`events`] - Inter-service event bus (publish/subscribe domain events)
//! - [`middleware`] - HTTP middleware (auth, logging, request ID, Prometheus metrics)
//! - [`middleware::metrics`] - Prometheus metrics middleware and handlers
//! - [`plugins`] - Plugin system architecture (trait, manifest, registry)
//! - [`types`] - Value Objects (Email, Password, UserId, Username)
//!
//! ## Example
//!
//! ```rust,ignore
//! use signapps_common::{Error, Result, Email, Password, UserId};
//!
//! fn create_user(email: &str, password: &str) -> Result<UserId> {
//!     let email = Email::new(email)?;
//!     let password = Password::new(password)?;
//!     // ... create user logic
//!     Ok(UserId::new())
//! }
//! ```

pub mod audit;
pub mod auth;
pub mod bootstrap;
pub mod config;
pub mod error;
pub mod events;
pub mod indexer;
pub mod middleware;
pub mod openapi;
pub mod plugins;
pub mod traits;
pub mod types;

// Re-export commonly used items
pub use audit::{AuditAction, AuditEntry, AuditLog, AuditState, audit_middleware, list_audit_entries};
pub use auth::{Claims, JwtConfig, TokenPair};
pub use bootstrap::graceful_shutdown;
pub use config::AppConfig;
pub use error::{Error, ProblemDetails, Result};
pub use events::{DomainEvent, EventBus, EventEnvelope};
pub use indexer::AiIndexerClient;
pub use plugins::{Plugin, PluginManifest, PluginRegistry};
pub use middleware::{
    metrics::{MetricsCollector, metrics_handler, metrics_middleware},
    AuthState, RequestClaimsExt, TenantContext,
};
pub use openapi::create_openapi_router;
pub use types::{Email, Password, PasswordHash, PgQueryResult, UserId, Username};

/// Crate version from Cargo.toml
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Crate name
pub const NAME: &str = env!("CARGO_PKG_NAME");
