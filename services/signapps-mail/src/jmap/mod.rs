//! JMAP (RFC 8620/8621) endpoint handlers for the mail service.
//!
//! Provides a standards-compliant JMAP interface alongside the existing REST
//! API.  The module exposes:
//!
//! - `GET /.well-known/jmap` — Session resource discovery
//! - `POST /jmap` — Method dispatch endpoint
//! - `POST /jmap/upload/:account_id` — Blob upload
//! - `GET /jmap/download/:account_id/:blob_id/:name` — Blob download

pub mod api;
pub mod email;
pub mod identity;
pub mod mailbox;
pub mod session;
pub mod thread;
