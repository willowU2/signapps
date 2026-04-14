//! Admin-only handlers for the Identity service.
//!
//! All modules in this tree require the caller to hold at least admin role
//! (`Claims.role >= 2`). Enforcement is done at the router level via the
//! `require_admin` middleware — individual handlers still assert role as a
//! defence-in-depth measure.

pub mod oauth_providers;
