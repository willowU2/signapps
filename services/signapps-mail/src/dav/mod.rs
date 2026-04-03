//! CalDAV/CardDAV server module.
//!
//! Runs a separate Axum router on port 8443 (configurable via `DAV_PORT`).
//! Provides WebDAV endpoints for CalDAV (calendars/events) and CardDAV
//! (addressbooks/contacts), with HTTP Basic Auth against `mailserver.accounts`.
//!
//! # Submodules
//!
//! - [`server`] — Axum router setup and top-level DAV handler
//! - [`auth`] — HTTP Basic Auth for DAV clients
//! - [`caldav`] — CalDAV PROPFIND/GET/PUT/DELETE/REPORT handlers
//! - [`carddav`] — CardDAV PROPFIND/GET/PUT/DELETE/REPORT handlers

pub mod auth;
pub mod caldav;
pub mod carddav;
pub mod server;
