// Enforce documentation on all public items (only during `cargo doc`, not clippy)
#![cfg_attr(doc, warn(missing_docs))]

//! # SignApps DB Billing
//!
//! Billing and proxy domain database models and repositories for the SignApps Platform.
//!
//! Contains models and repositories for:
//! - TLS certificates and ACME accounts (Let's Encrypt, proxy TLS)
//! - Proxy routes (reverse proxy, redirect, load balancer, static)
//!
//! This is Phase 5 of the `signapps-db` bounded-context split.
//! See `docs/architecture/refactors/01-split-signapps-db.md`.

pub mod models;
pub mod repositories;

pub use models::certificate::*;
pub use models::route::*;

pub use repositories::{CertificateRepository, RouteRepository};
