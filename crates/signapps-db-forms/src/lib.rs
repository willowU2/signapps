// Enforce documentation on all public items (only during `cargo doc`, not clippy)
#![cfg_attr(doc, warn(missing_docs))]

//! # SignApps DB Forms
//!
//! Forms domain database models and repositories for the SignApps Platform.
//!
//! Contains models and repositories for:
//! - Form definitions with typed fields (text, choice, rating, date, email, number)
//! - Form responses / submissions
//!
//! This is Phase 4 of the `signapps-db` bounded-context split.
//! See `docs/architecture/refactors/01-split-signapps-db.md`.

pub mod models;
pub mod repositories;

pub use models::form::*;

pub use repositories::FormRepository;
