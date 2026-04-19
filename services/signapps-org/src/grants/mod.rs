//! Access grant issuance, verification, and HTTP-layer redirect.
//!
//! The grant subsystem issues short-lived, HMAC-signed URLs that allow
//! an external (or unauthenticated) caller to reach a specific
//! resource with a bounded permission set. The flow is:
//!
//! 1. An authenticated user POSTs to `/api/v1/org/grants` with
//!    `{ tenant_id, resource_type, resource_id, permissions, expires_at }`.
//! 2. Server generates a UUID, builds a payload, signs it with the
//!    per-tenant HMAC secret (see [`token`]) and stores a SHA-256 hash
//!    of the token in `org_access_grants`.
//! 3. Client receives `{ id, token, url }`. The URL is
//!    `/g/<token>`.
//! 4. On visit, [`redirect`] re-verifies the token, bumps
//!    `last_used_at`, injects a `grant_token` cookie and 302-redirects
//!    to the resource URL.

pub mod redirect;
pub mod token;
