//! # SignApps Common
//!
//! Shared utilities, types, and middleware for the SignApps Platform.
//!
//! ## Modules
//!
//! - [`auth`] - Authentication types (JWT claims, tokens)
//! - [`config`] - Application configuration
//! - [`error`] - RFC 7807 Problem Details error handling
//! - [`middleware`] - HTTP middleware (auth, logging, request ID)
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

pub mod auth;
pub mod config;
pub mod error;
pub mod middleware;
pub mod types;

// Re-export commonly used items
pub use auth::{Claims, JwtConfig, TokenPair};
pub use config::AppConfig;
pub use error::{Error, ProblemDetails, Result};
pub use middleware::{AuthState, RequestClaimsExt};
pub use types::{Email, Password, PasswordHash, UserId, Username};

/// Crate version from Cargo.toml
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Crate name
pub const NAME: &str = env!("CARGO_PKG_NAME");
