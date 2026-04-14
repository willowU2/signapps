# OAuth Crate Implementation Plan (Plan 2 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `signapps-oauth` crate (Block 2 of the OAuth roadmap) — catalog of providers, stateless HMAC-signed `FlowState`, scope resolver, and database schema. No HTTP engine yet — that's Plan 3.

**Architecture:** A new crate `signapps-oauth` sits alongside `signapps-keystore` and `signapps-common`. It defines the types and primitives the engine will use: `ProviderDefinition` (embedded catalog + DB overrides via `oauth_providers` table), `FlowState` (signed stateless state for OAuth callbacks), `ScopeResolver` (org-aware visibility checks), and `OAuthError` (RFC 7807-ready error type). Database schema for `oauth_providers`, `oauth_provider_configs`, `oauth_user_overrides`, `oauth_provider_purpose_overrides` is landed via a single migration file.

**Tech Stack:** Rust, `hmac` 0.12 + `sha2` 0.10 (state signing), `base64` 0.22 (state encoding), `serde_json` (catalog parsing), `uuid`, `chrono`, `sqlx` (DB access), `thiserror`.

**Dependencies:** Plan 1 (signapps-keystore + EncryptedField trait). The crate references `signapps_common::crypto::EncryptedField` and `signapps_keystore::DataEncryptionKey` only in type signatures of structures that hold encrypted credentials.

**Plans that depend on this one:**
- Plan 3 (Engine v2 + HTTP handlers)
- Plan 4 (Migration + Event bus)
- Plan 5 (Refresh + Admin UI)

---

## File Structure

### Created
- `crates/signapps-oauth/Cargo.toml`
- `crates/signapps-oauth/catalog.json` — embedded provider catalog (seed with 10 high-value providers)
- `crates/signapps-oauth/build.rs` — compile-time catalog validation
- `crates/signapps-oauth/src/lib.rs` — public API + module wiring
- `crates/signapps-oauth/src/protocol.rs` — `Protocol`, `ProviderCategory`, `OAuthPurpose`, `TokenPlacement` enums
- `crates/signapps-oauth/src/provider.rs` — `ProviderDefinition`, `ProviderConfig`, `ProviderSummary` structs
- `crates/signapps-oauth/src/catalog.rs` — `Catalog` struct, `load_embedded()`, `resolve()`
- `crates/signapps-oauth/src/state.rs` — `FlowState`, `StateError`, `sign()`, `verify()`
- `crates/signapps-oauth/src/error.rs` — `OAuthError`
- `crates/signapps-oauth/src/scope.rs` — `ScopeResolver`, `UserContext` (stub for org integration)
- `crates/signapps-oauth/src/config_store.rs` — `ConfigStore` trait + `PgConfigStore` impl
- `crates/signapps-oauth/tests/catalog_load.rs` — integration test for embedded catalog
- `crates/signapps-oauth/tests/state_roundtrip.rs` — integration test for sign/verify roundtrip
- `migrations/302_oauth_unified.sql` — 4 tables + indexes + triggers placeholder

### Modified
- `Cargo.toml` (workspace) — add `crates/signapps-oauth` to members
- `CLAUDE.md` — add `signapps-oauth` to crates table + Shared Crate Conventions
- `.env.example` — document `OAUTH_STATE_SECRET` env var

---

## Task 1: Scaffold signapps-oauth crate

**Files:**
- Create: `crates/signapps-oauth/Cargo.toml`
- Create: `crates/signapps-oauth/src/lib.rs`
- Modify: `Cargo.toml` (workspace)

- [ ] **Step 1: Verify directory does not exist**

Run: `ls crates/signapps-oauth 2>&1`
Expected: `No such file or directory`

- [ ] **Step 2: Add crate to workspace members**

In `Cargo.toml` (workspace root), add `"crates/signapps-oauth",` alphabetically in the `members` array.

- [ ] **Step 3: Create crate Cargo.toml**

```toml
[package]
name = "signapps-oauth"
version.workspace = true
edition = "2021"
rust-version = "1.75"
license.workspace = true
description = "OAuth2/OIDC/SAML unified state machine, catalog, and scope resolver"
publish = false

[dependencies]
# Crypto primitives for HMAC state signing
hmac = { workspace = true }
sha2 = { workspace = true }
base64 = { workspace = true }
# Catalog
serde = { workspace = true }
serde_json = { workspace = true }
# Errors + logging
thiserror = { workspace = true }
tracing = { workspace = true }
# DB
sqlx = { workspace = true, features = ["postgres", "runtime-tokio-rustls", "uuid", "chrono", "json"] }
uuid = { workspace = true }
chrono = { workspace = true }
# Shared
signapps-common = { path = "../signapps-common" }
signapps-keystore = { path = "../signapps-keystore" }
async-trait = { workspace = true }

[build-dependencies]
serde_json = { workspace = true }

[dev-dependencies]
tokio = { workspace = true }
```

Check that all these deps are in workspace `[workspace.dependencies]`. Add any that are missing — `hmac` in particular may not be there. If missing, add `hmac = "0.12"` alphabetically.

- [ ] **Step 4: Create the skeleton lib.rs with module stubs**

```rust
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
```

- [ ] **Step 5: Create placeholder module files**

Create each module file with a minimal stub that will be fleshed out in later tasks:

`crates/signapps-oauth/src/protocol.rs`:
```rust
//! OAuth protocol and related enums.
```

`crates/signapps-oauth/src/provider.rs`:
```rust
//! Provider definitions (embedded + DB override).
```

`crates/signapps-oauth/src/catalog.rs`:
```rust
//! Embedded provider catalog and DB-backed overrides.

use thiserror::Error;

/// Errors from catalog operations.
#[derive(Debug, Error)]
pub enum CatalogError {
    /// Catalog JSON is malformed.
    #[error("catalog JSON parse error: {0}")]
    Parse(#[from] serde_json::Error),
    /// Provider not found by key.
    #[error("provider {0:?} not found in catalog")]
    NotFound(String),
}

/// Placeholder — implemented in Task 5.
pub struct Catalog;
```

`crates/signapps-oauth/src/state.rs`:
```rust
//! Stateless HMAC-signed FlowState for OAuth callbacks.

use thiserror::Error;

/// Errors from state signing/verification.
#[derive(Debug, Error)]
pub enum StateError {
    /// State token is malformed (missing separator, invalid base64, etc).
    #[error("malformed state token")]
    Malformed,
    /// HMAC signature does not verify.
    #[error("bad signature")]
    BadSignature,
    /// State has expired.
    #[error("state expired")]
    Expired,
    /// JSON deserialization failed.
    #[error("invalid state payload: {0}")]
    InvalidPayload(#[from] serde_json::Error),
}

/// Placeholder — implemented in Task 9.
pub struct FlowState;
```

`crates/signapps-oauth/src/error.rs`:
```rust
//! Top-level OAuth errors.

use thiserror::Error;

/// All OAuth-level errors.
#[derive(Debug, Error)]
pub enum OAuthError {
    /// Catalog-related error.
    #[error(transparent)]
    Catalog(#[from] crate::catalog::CatalogError),
    /// State-related error.
    #[error(transparent)]
    State(#[from] crate::state::StateError),
}
```

`crates/signapps-oauth/src/scope.rs`:
```rust
//! Scope resolver — org-aware provider visibility + scope filtering.

/// Placeholder — implemented in Task 11.
pub struct ScopeResolver;

/// Snapshot of an user's org context for visibility checks.
pub struct UserContext;
```

`crates/signapps-oauth/src/config_store.rs`:
```rust
//! Tenant-level provider config storage (Postgres-backed).

/// Placeholder trait — implemented in Task 13.
#[async_trait::async_trait]
pub trait ConfigStore: Send + Sync {}

/// Placeholder impl — Task 13.
pub struct PgConfigStore;
```

- [ ] **Step 6: Verify compile**

Run: `cargo check -p signapps-oauth 2>&1 | tail -10`
Expected: success. Warnings about unused types acceptable.

- [ ] **Step 7: Commit**

```bash
rtk git add Cargo.toml crates/signapps-oauth/
rtk git commit -m "$(cat <<'EOF'
feat(oauth): scaffold signapps-oauth crate

New crate for OAuth2/OIDC/SAML state machine, catalog, and scope
resolver. Companion to signapps-keystore + signapps-common::crypto.

Public API surface defined:
- Catalog / CatalogError (Task 5)
- FlowState / StateError (Task 9)
- ScopeResolver / UserContext (Task 11)
- ConfigStore / PgConfigStore (Task 13)
- ProviderDefinition / ProviderConfig (Task 4)
- Protocol / ProviderCategory / OAuthPurpose (Task 3)
- OAuthError

All methods are placeholders filled in subsequent tasks.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add build.rs placeholder

**Files:**
- Create: `crates/signapps-oauth/build.rs`

- [ ] **Step 1: Create minimal build.rs**

```rust
//! Build script — validates `catalog.json` at compile time.
//!
//! The actual validation logic is filled in Task 7. For now this
//! only declares the rebuild trigger so Cargo tracks the catalog file.

fn main() {
    // Once catalog.json exists (Task 4), this will be validated here.
    println!("cargo:rerun-if-changed=catalog.json");
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cargo check -p signapps-oauth 2>&1 | tail -5`
Expected: success.

- [ ] **Step 3: Commit**

```bash
rtk git add crates/signapps-oauth/build.rs
rtk git commit -m "feat(oauth): add build.rs placeholder for catalog validation

Validation logic filled in Task 7 once catalog.json exists.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Implement Protocol + ProviderCategory + OAuthPurpose + TokenPlacement enums

**Files:**
- Modify: `crates/signapps-oauth/src/protocol.rs`

- [ ] **Step 1: Write the full file**

Replace `crates/signapps-oauth/src/protocol.rs`:

```rust
//! OAuth protocol and related enums.

use serde::{Deserialize, Serialize};

/// Supported OAuth-family protocols.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Protocol {
    /// OAuth 2.0 authorization code grant.
    OAuth2,
    /// OAuth 1.0a (legacy, Twitter v1a, Trello).
    OAuth1a,
    /// OpenID Connect (OAuth 2.0 + id_token).
    Oidc,
    /// SAML 2.0 (POST binding).
    Saml,
}

/// Why is the user going through this OAuth flow?
///
/// Login = establishing a session via SSO.
/// Integration = adding a connected account (mail, calendar, drive, ...).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum OAuthPurpose {
    /// Authenticating a user for session / login (SSO).
    Login,
    /// Connecting a third-party service for ongoing API use.
    Integration,
}

impl OAuthPurpose {
    /// Short string representation for DB storage and admin UI.
    #[must_use]
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Login => "login",
            Self::Integration => "integration",
        }
    }
}

/// Provider category for admin UI grouping and catalog filtering.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ProviderCategory {
    /// Email providers (Gmail, Outlook, Fastmail, ...).
    Mail,
    /// Calendar providers (Google Calendar, Microsoft Graph, ...).
    Calendar,
    /// File storage / drive (Google Drive, OneDrive, Dropbox, ...).
    Drive,
    /// Social media (Twitter, LinkedIn, Facebook, ...).
    Social,
    /// Enterprise or consumer SSO (Okta, Keycloak, GitHub, ...).
    Sso,
    /// Chat / messaging (Slack, Discord, Teams, ...).
    Chat,
    /// Developer platforms (GitHub, GitLab, Bitbucket, ...).
    Dev,
    /// CRM / customer data (Salesforce, HubSpot, ...).
    Crm,
    /// Everything else.
    Other,
}

/// Where the access token is placed on outgoing API calls.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TokenPlacement {
    /// `Authorization: Bearer <token>` header (default for most providers).
    Header,
    /// `?access_token=<token>` query string.
    Query,
    /// Form body `access_token=<token>`.
    Body,
}

impl Default for TokenPlacement {
    fn default() -> Self {
        Self::Header
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn purpose_as_str_roundtrip() {
        assert_eq!(OAuthPurpose::Login.as_str(), "login");
        assert_eq!(OAuthPurpose::Integration.as_str(), "integration");
    }

    #[test]
    fn purpose_serde() {
        let json = serde_json::to_string(&OAuthPurpose::Login).unwrap();
        assert_eq!(json, "\"login\"");
        let back: OAuthPurpose = serde_json::from_str("\"integration\"").unwrap();
        assert_eq!(back, OAuthPurpose::Integration);
    }

    #[test]
    fn protocol_serde() {
        let json = serde_json::to_string(&Protocol::OAuth2).unwrap();
        assert_eq!(json, "\"OAuth2\"");
        let back: Protocol = serde_json::from_str("\"Oidc\"").unwrap();
        assert_eq!(back, Protocol::Oidc);
    }

    #[test]
    fn token_placement_default_is_header() {
        assert_eq!(TokenPlacement::default(), TokenPlacement::Header);
    }
}
```

- [ ] **Step 2: Run tests**

Run: `cargo test -p signapps-oauth --lib protocol 2>&1 | tail -10`
Expected: 4 tests pass.

- [ ] **Step 3: Commit**

```bash
rtk git add crates/signapps-oauth/src/protocol.rs
rtk git commit -m "feat(oauth): implement Protocol, OAuthPurpose, ProviderCategory, TokenPlacement enums

All with Serde + Debug + Copy. OAuthPurpose::as_str for DB storage.
TokenPlacement::default = Header (most common OAuth2 pattern).
4 unit tests for serde round-trips and as_str.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Implement ProviderDefinition + ProviderConfig + ProviderSummary structs

**Files:**
- Modify: `crates/signapps-oauth/src/provider.rs`

- [ ] **Step 1: Write the file**

Replace `crates/signapps-oauth/src/provider.rs`:

```rust
//! Provider definitions — embedded (catalog.json) and DB-backed override.

use crate::protocol::{Protocol, ProviderCategory, TokenPlacement};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Static definition of an OAuth/OIDC/SAML provider from the embedded catalog.
///
/// Catalog JSON is loaded via [`crate::Catalog::load_embedded()`] and
/// overrides are fetched from the `oauth_providers` DB table per tenant.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ProviderDefinition {
    /// Unique slug (e.g., "google", "microsoft", "keycloak-acme").
    pub key: String,
    /// Human-readable name shown in admin/user UI.
    pub display_name: String,
    /// Protocol flavor.
    pub protocol: Protocol,
    /// Authorization URL (where the user is redirected in step 1).
    pub authorize_url: String,
    /// Token endpoint (where we exchange the code for tokens).
    pub access_url: String,
    /// Refresh endpoint (falls back to `access_url` if None).
    #[serde(default)]
    pub refresh_url: Option<String>,
    /// UserInfo endpoint (where we fetch the user profile).
    #[serde(default)]
    pub profile_url: Option<String>,
    /// Token revocation endpoint.
    #[serde(default)]
    pub revoke_url: Option<String>,
    /// Character used to join multiple scopes into the `scope` param.
    #[serde(default = "default_scope_delimiter")]
    pub scope_delimiter: String,
    /// Default scopes to request if the caller does not specify any.
    #[serde(default)]
    pub default_scopes: Vec<String>,
    /// Whether this provider requires PKCE (S256).
    #[serde(default)]
    pub pkce_required: bool,
    /// Whether this provider issues refresh tokens.
    #[serde(default = "default_true")]
    pub supports_refresh: bool,
    /// How to send the access token on outgoing API calls.
    #[serde(default)]
    pub token_placement: TokenPlacement,
    /// JSONPath to the user ID in the profile response.
    #[serde(default = "default_user_id_field")]
    pub user_id_field: String,
    /// JSONPath to the user email.
    #[serde(default)]
    pub user_email_field: Option<String>,
    /// JSONPath to the user display name.
    #[serde(default)]
    pub user_name_field: Option<String>,
    /// Categories this provider serves (can be in multiple: e.g., Google
    /// appears in Mail + Calendar + Drive + Sso).
    #[serde(default)]
    pub categories: Vec<ProviderCategory>,
    /// Template variables required in URL substitution (e.g., `{"tenant"}`
    /// for Microsoft's `/:tenant/oauth2/v2.0/authorize`).
    #[serde(default)]
    pub template_vars: Vec<String>,
    /// Extra parameters that must be provided via `extra_params_enc` for
    /// this provider to work (e.g., Apple key_id, SAML IdP cert).
    #[serde(default)]
    pub extra_params_required: Vec<String>,
    /// Free-form notes for operators (quirks, URL params, etc.).
    #[serde(default)]
    pub notes: Option<String>,
}

/// Tenant-level configuration for a provider (from `oauth_provider_configs`).
///
/// Sensitive fields (`client_id_enc`, `client_secret_enc`, `extra_params_enc`)
/// are stored encrypted via [`signapps_common::crypto::EncryptedField`] and
/// only decrypted just before use.
#[derive(Debug, Clone)]
pub struct ProviderConfig {
    /// Row ID.
    pub id: Uuid,
    /// Tenant this config belongs to.
    pub tenant_id: Uuid,
    /// Provider key (matches `ProviderDefinition.key` or custom `oauth_providers.key`).
    pub provider_key: String,
    /// Encrypted client_id.
    pub client_id_enc: Option<Vec<u8>>,
    /// Encrypted client_secret.
    pub client_secret_enc: Option<Vec<u8>>,
    /// Encrypted extra params (JSON map).
    pub extra_params_enc: Option<Vec<u8>>,
    /// Whether this provider is enabled for the tenant.
    pub enabled: bool,
    /// Which OAuth purposes are allowed (login, integration).
    pub purposes: Vec<String>,
    /// Scopes the admin allows users to request for this provider.
    pub allowed_scopes: Vec<String>,
    /// Visibility rule: "all" or "restricted".
    pub visibility: String,
    /// If restricted: visible to these org nodes.
    pub visible_to_org_nodes: Vec<Uuid>,
    /// If restricted: visible to these groups.
    pub visible_to_groups: Vec<Uuid>,
    /// If restricted: visible to users with any of these roles.
    pub visible_to_roles: Vec<String>,
    /// If restricted: visible to these specific users (overrides group/role filters).
    pub visible_to_users: Vec<Uuid>,
    /// Whether users can supply their own client_id/secret for this provider.
    pub allow_user_override: bool,
    /// Whether this provider is configured as the tenant's SSO IdP.
    pub is_tenant_sso: bool,
    /// When `is_tenant_sso`, whether to auto-provision new users on first login.
    pub auto_provision_users: bool,
    /// Default role assigned to auto-provisioned users.
    pub default_role: Option<String>,
}

/// Summary of a provider for the admin/user UI (safe to return over API).
///
/// No encrypted fields — just the display metadata.
#[derive(Debug, Clone, Serialize)]
pub struct ProviderSummary {
    /// Provider key.
    pub key: String,
    /// Display name.
    pub display_name: String,
    /// Categories.
    pub categories: Vec<ProviderCategory>,
    /// Is this enabled for this tenant?
    pub enabled: bool,
    /// Allowed purposes (login / integration).
    pub purposes: Vec<String>,
    /// Is the provider visible to the current user (post-ScopeResolver)?
    pub visible: bool,
}

fn default_scope_delimiter() -> String {
    " ".to_string()
}

fn default_true() -> bool {
    true
}

fn default_user_id_field() -> String {
    "$.sub".to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn minimal_provider_definition_parses() {
        let json = r#"{
            "key": "google",
            "display_name": "Google",
            "protocol": "OAuth2",
            "authorize_url": "https://accounts.google.com/o/oauth2/v2/auth",
            "access_url": "https://oauth2.googleapis.com/token"
        }"#;
        let pd: ProviderDefinition = serde_json::from_str(json).unwrap();
        assert_eq!(pd.key, "google");
        assert_eq!(pd.protocol, Protocol::OAuth2);
        assert_eq!(pd.scope_delimiter, " ", "default scope_delimiter");
        assert!(pd.supports_refresh, "supports_refresh defaults to true");
        assert_eq!(pd.user_id_field, "$.sub", "default user_id_field");
        assert_eq!(pd.token_placement, TokenPlacement::Header);
    }

    #[test]
    fn full_provider_definition_parses() {
        let json = r#"{
            "key": "twitter",
            "display_name": "Twitter",
            "protocol": "OAuth2",
            "authorize_url": "https://twitter.com/i/oauth2/authorize",
            "access_url": "https://api.twitter.com/2/oauth2/token",
            "profile_url": "https://api.twitter.com/2/users/me",
            "scope_delimiter": " ",
            "default_scopes": ["tweet.read", "users.read", "offline.access"],
            "pkce_required": true,
            "supports_refresh": true,
            "user_id_field": "$.data.id",
            "user_name_field": "$.data.name",
            "categories": ["Social"]
        }"#;
        let pd: ProviderDefinition = serde_json::from_str(json).unwrap();
        assert_eq!(pd.key, "twitter");
        assert!(pd.pkce_required);
        assert_eq!(pd.default_scopes.len(), 3);
        assert_eq!(pd.categories, vec![ProviderCategory::Social]);
    }
}
```

- [ ] **Step 2: Run tests**

Run: `cargo test -p signapps-oauth --lib provider 2>&1 | tail -10`
Expected: 2 tests pass.

- [ ] **Step 3: Commit**

```bash
rtk git add crates/signapps-oauth/src/provider.rs
rtk git commit -m "feat(oauth): implement ProviderDefinition + ProviderConfig + ProviderSummary

- ProviderDefinition: mirrors catalog.json entry, with sensible Serde
  defaults (scope_delimiter=\" \", supports_refresh=true, user_id_field=\$.sub).
- ProviderConfig: DB row shape for oauth_provider_configs. Encrypted
  fields are Vec<u8> (ciphertext via EncryptedField).
- ProviderSummary: API-safe subset (no encrypted fields, no raw URLs).
- 2 tests: minimal JSON uses defaults, full JSON round-trips.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Create seed catalog.json with 10 providers

**Files:**
- Create: `crates/signapps-oauth/catalog.json`

- [ ] **Step 1: Write catalog.json**

```json
{
  "version": "1.0",
  "providers": {
    "google": {
      "key": "google",
      "display_name": "Google",
      "protocol": "OAuth2",
      "authorize_url": "https://accounts.google.com/o/oauth2/v2/auth",
      "access_url": "https://oauth2.googleapis.com/token",
      "refresh_url": "https://oauth2.googleapis.com/token",
      "profile_url": "https://www.googleapis.com/oauth2/v3/userinfo",
      "revoke_url": "https://oauth2.googleapis.com/revoke",
      "scope_delimiter": " ",
      "default_scopes": ["openid", "email", "profile"],
      "pkce_required": false,
      "supports_refresh": true,
      "token_placement": "Header",
      "user_id_field": "$.sub",
      "user_email_field": "$.email",
      "user_name_field": "$.name",
      "categories": ["Mail", "Calendar", "Drive", "Sso"],
      "notes": "Use access_type=offline + prompt=consent to get refresh_token"
    },
    "microsoft": {
      "key": "microsoft",
      "display_name": "Microsoft",
      "protocol": "OAuth2",
      "authorize_url": "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize",
      "access_url": "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token",
      "profile_url": "https://graph.microsoft.com/v1.0/me",
      "scope_delimiter": " ",
      "default_scopes": ["openid", "email", "profile", "offline_access"],
      "pkce_required": false,
      "supports_refresh": true,
      "token_placement": "Header",
      "user_id_field": "$.id",
      "user_email_field": "$.mail",
      "user_name_field": "$.displayName",
      "categories": ["Mail", "Calendar", "Drive", "Sso", "Chat"],
      "template_vars": ["tenant"],
      "notes": "{tenant} = 'common' for multi-tenant, or a specific tenant_id"
    },
    "github": {
      "key": "github",
      "display_name": "GitHub",
      "protocol": "OAuth2",
      "authorize_url": "https://github.com/login/oauth/authorize",
      "access_url": "https://github.com/login/oauth/access_token",
      "profile_url": "https://api.github.com/user",
      "scope_delimiter": " ",
      "default_scopes": ["read:user", "user:email"],
      "pkce_required": false,
      "supports_refresh": false,
      "token_placement": "Header",
      "user_id_field": "$.id",
      "user_email_field": "$.email",
      "user_name_field": "$.name",
      "categories": ["Dev", "Sso"],
      "notes": "GitHub access tokens do not expire — supports_refresh=false"
    },
    "gitlab": {
      "key": "gitlab",
      "display_name": "GitLab",
      "protocol": "OAuth2",
      "authorize_url": "https://gitlab.com/oauth/authorize",
      "access_url": "https://gitlab.com/oauth/token",
      "profile_url": "https://gitlab.com/api/v4/user",
      "scope_delimiter": " ",
      "default_scopes": ["read_user"],
      "pkce_required": true,
      "supports_refresh": true,
      "token_placement": "Header",
      "user_id_field": "$.id",
      "user_email_field": "$.email",
      "user_name_field": "$.name",
      "categories": ["Dev", "Sso"]
    },
    "slack": {
      "key": "slack",
      "display_name": "Slack",
      "protocol": "OAuth2",
      "authorize_url": "https://slack.com/oauth/v2/authorize",
      "access_url": "https://slack.com/api/oauth.v2.access",
      "scope_delimiter": ",",
      "default_scopes": ["users:read"],
      "pkce_required": false,
      "supports_refresh": false,
      "token_placement": "Header",
      "user_id_field": "$.authed_user.id",
      "categories": ["Chat"],
      "notes": "Slack uses comma-delimited scopes. OAuth response wraps user in authed_user."
    },
    "dropbox": {
      "key": "dropbox",
      "display_name": "Dropbox",
      "protocol": "OAuth2",
      "authorize_url": "https://www.dropbox.com/oauth2/authorize",
      "access_url": "https://api.dropboxapi.com/oauth2/token",
      "profile_url": "https://api.dropboxapi.com/2/users/get_current_account",
      "scope_delimiter": " ",
      "default_scopes": ["account_info.read"],
      "pkce_required": false,
      "supports_refresh": true,
      "token_placement": "Header",
      "user_id_field": "$.account_id",
      "user_email_field": "$.email",
      "user_name_field": "$.name.display_name",
      "categories": ["Drive"],
      "notes": "Use token_access_type=offline to receive refresh token"
    },
    "discord": {
      "key": "discord",
      "display_name": "Discord",
      "protocol": "OAuth2",
      "authorize_url": "https://discord.com/api/oauth2/authorize",
      "access_url": "https://discord.com/api/oauth2/token",
      "profile_url": "https://discord.com/api/users/@me",
      "scope_delimiter": " ",
      "default_scopes": ["identify", "email"],
      "pkce_required": false,
      "supports_refresh": true,
      "token_placement": "Header",
      "user_id_field": "$.id",
      "user_email_field": "$.email",
      "user_name_field": "$.username",
      "categories": ["Chat", "Sso"]
    },
    "linkedin": {
      "key": "linkedin",
      "display_name": "LinkedIn",
      "protocol": "OAuth2",
      "authorize_url": "https://www.linkedin.com/oauth/v2/authorization",
      "access_url": "https://www.linkedin.com/oauth/v2/accessToken",
      "profile_url": "https://api.linkedin.com/v2/userinfo",
      "scope_delimiter": " ",
      "default_scopes": ["openid", "email", "profile"],
      "pkce_required": false,
      "supports_refresh": true,
      "token_placement": "Header",
      "user_id_field": "$.sub",
      "user_email_field": "$.email",
      "user_name_field": "$.name",
      "categories": ["Social"]
    },
    "keycloak_generic": {
      "key": "keycloak_generic",
      "display_name": "Keycloak (generic)",
      "protocol": "Oidc",
      "authorize_url": "{base_url}/realms/{realm}/protocol/openid-connect/auth",
      "access_url": "{base_url}/realms/{realm}/protocol/openid-connect/token",
      "profile_url": "{base_url}/realms/{realm}/protocol/openid-connect/userinfo",
      "scope_delimiter": " ",
      "default_scopes": ["openid", "email", "profile"],
      "pkce_required": true,
      "supports_refresh": true,
      "token_placement": "Header",
      "user_id_field": "$.sub",
      "user_email_field": "$.email",
      "user_name_field": "$.name",
      "categories": ["Sso"],
      "template_vars": ["base_url", "realm"],
      "notes": "Configure base_url + realm via extra_params_enc"
    },
    "oidc_generic": {
      "key": "oidc_generic",
      "display_name": "OIDC (generic)",
      "protocol": "Oidc",
      "authorize_url": "{authorize_url}",
      "access_url": "{access_url}",
      "profile_url": "{profile_url}",
      "scope_delimiter": " ",
      "default_scopes": ["openid", "email", "profile"],
      "pkce_required": true,
      "supports_refresh": true,
      "token_placement": "Header",
      "user_id_field": "$.sub",
      "user_email_field": "$.email",
      "user_name_field": "$.name",
      "categories": ["Sso"],
      "template_vars": ["authorize_url", "access_url", "profile_url"],
      "notes": "Fully generic OIDC provider — all URLs supplied via extra_params"
    }
  }
}
```

- [ ] **Step 2: Sanity-check JSON is valid**

Run: `cat crates/signapps-oauth/catalog.json | python -m json.tool > /dev/null && echo VALID` (on Windows you may have `python` or `py`; if neither is available, use `node -e "JSON.parse(require('fs').readFileSync('crates/signapps-oauth/catalog.json','utf8'))" && echo VALID`)

Expected: `VALID`.

If neither Python nor Node is available, skip this step — the build.rs in Task 7 will catch malformed JSON at compile time.

- [ ] **Step 3: Commit**

```bash
rtk git add crates/signapps-oauth/catalog.json
rtk git commit -m "feat(oauth): seed catalog.json with 10 providers

Seed providers covering:
- Google, Microsoft (mail/calendar/drive/sso)
- GitHub, GitLab (dev, sso)
- Slack, Discord (chat)
- Dropbox (drive)
- LinkedIn (social)
- Keycloak / generic OIDC (enterprise SSO)

Template vars: {tenant} (microsoft), {base_url}+{realm} (keycloak),
{authorize_url}+... (oidc_generic).

More providers come in later plans; this seed covers the high-value
dev/enterprise providers needed for Plan 3 integration tests.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Implement Catalog::load_embedded + resolve

**Files:**
- Modify: `crates/signapps-oauth/src/catalog.rs`

- [ ] **Step 1: Write the implementation**

Replace `crates/signapps-oauth/src/catalog.rs`:

```rust
//! Embedded provider catalog and DB-backed overrides.

use crate::provider::ProviderDefinition;
use serde::Deserialize;
use std::collections::HashMap;
use thiserror::Error;

/// Errors from catalog operations.
#[derive(Debug, Error)]
pub enum CatalogError {
    /// Catalog JSON is malformed.
    #[error("catalog JSON parse error: {0}")]
    Parse(#[from] serde_json::Error),
    /// Provider not found by key.
    #[error("provider {0:?} not found in catalog")]
    NotFound(String),
}

/// Root of the embedded catalog.json file.
#[derive(Debug, Deserialize)]
struct CatalogFile {
    #[allow(dead_code)]
    version: String,
    providers: HashMap<String, ProviderDefinition>,
}

/// Embedded provider catalog + DB lookup.
///
/// Use [`Catalog::load_embedded`] to get the static catalog compiled
/// into the binary from `catalog.json`. Future versions will layer
/// tenant-specific DB overrides on top via a `resolve(tenant_id, key)`
/// method that consults the `oauth_providers` table.
#[derive(Debug)]
pub struct Catalog {
    providers: HashMap<String, ProviderDefinition>,
}

impl Catalog {
    /// Load the embedded catalog compiled into the binary.
    ///
    /// # Errors
    ///
    /// Returns [`CatalogError::Parse`] if the embedded `catalog.json` is
    /// malformed. In practice this is impossible if `build.rs` is working,
    /// since it validates at compile time.
    pub fn load_embedded() -> Result<Self, CatalogError> {
        const CATALOG_JSON: &str = include_str!("../catalog.json");
        let file: CatalogFile = serde_json::from_str(CATALOG_JSON)?;
        Ok(Self {
            providers: file.providers,
        })
    }

    /// Look up a provider by its key.
    ///
    /// # Errors
    ///
    /// Returns [`CatalogError::NotFound`] if no provider with this key
    /// exists in the embedded catalog. Future versions will also consult
    /// the tenant's `oauth_providers` table for custom providers.
    pub fn get(&self, key: &str) -> Result<&ProviderDefinition, CatalogError> {
        self.providers
            .get(key)
            .ok_or_else(|| CatalogError::NotFound(key.to_string()))
    }

    /// Iterator over all embedded provider definitions.
    pub fn iter(&self) -> impl Iterator<Item = (&str, &ProviderDefinition)> {
        self.providers.iter().map(|(k, v)| (k.as_str(), v))
    }

    /// Number of providers in the embedded catalog.
    #[must_use]
    pub fn len(&self) -> usize {
        self.providers.len()
    }

    /// True if the catalog is empty.
    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.providers.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocol::Protocol;

    #[test]
    fn loads_embedded_catalog() {
        let cat = Catalog::load_embedded().expect("embedded catalog loads");
        assert!(cat.len() >= 10, "catalog should have ≥ 10 providers");
    }

    #[test]
    fn can_find_google() {
        let cat = Catalog::load_embedded().unwrap();
        let g = cat.get("google").expect("google should be in catalog");
        assert_eq!(g.display_name, "Google");
        assert_eq!(g.protocol, Protocol::OAuth2);
        assert!(g.supports_refresh);
    }

    #[test]
    fn rejects_unknown_provider() {
        let cat = Catalog::load_embedded().unwrap();
        let err = cat.get("nonexistent_provider_xyz").unwrap_err();
        assert!(matches!(err, CatalogError::NotFound(_)));
    }

    #[test]
    fn microsoft_has_template_var() {
        let cat = Catalog::load_embedded().unwrap();
        let ms = cat.get("microsoft").unwrap();
        assert!(ms.template_vars.contains(&"tenant".to_string()));
    }
}
```

- [ ] **Step 2: Run tests**

Run: `cargo test -p signapps-oauth --lib catalog 2>&1 | tail -10`
Expected: 4 tests pass.

- [ ] **Step 3: Commit**

```bash
rtk git add crates/signapps-oauth/src/catalog.rs
rtk git commit -m "feat(oauth): implement Catalog::load_embedded + get + iter

Loads catalog.json at compile time via include_str!.
Catalog exposes get(key), iter(), len(), is_empty().
4 tests: catalog loads with ≥10 providers, google found with correct
metadata, unknown provider rejects, microsoft has tenant template_var.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Populate build.rs with catalog validation

**Files:**
- Modify: `crates/signapps-oauth/build.rs`

- [ ] **Step 1: Write full build.rs**

Replace `crates/signapps-oauth/build.rs`:

```rust
//! Build script — validates `catalog.json` at compile time.
//!
//! If the catalog is malformed (invalid JSON, missing required fields,
//! unparseable URLs), the build FAILS — we never ship a broken catalog.

use serde_json::Value;
use std::fs;

fn main() {
    println!("cargo:rerun-if-changed=catalog.json");

    let content = match fs::read_to_string("catalog.json") {
        Ok(c) => c,
        Err(e) => panic!("build.rs: cannot read catalog.json: {e}"),
    };

    let value: Value = match serde_json::from_str(&content) {
        Ok(v) => v,
        Err(e) => panic!("build.rs: catalog.json is not valid JSON: {e}"),
    };

    let root = value.as_object().expect("root must be an object");
    let _version = root
        .get("version")
        .and_then(|v| v.as_str())
        .expect("catalog.json must have `version` string");
    let providers = root
        .get("providers")
        .and_then(|v| v.as_object())
        .expect("catalog.json must have `providers` object");

    for (key, def) in providers {
        validate_provider(key, def);
    }
}

fn validate_provider(key: &str, def: &Value) {
    let obj = def
        .as_object()
        .unwrap_or_else(|| panic!("provider {key:?} must be an object"));

    // Required fields
    for field in [
        "key",
        "display_name",
        "protocol",
        "authorize_url",
        "access_url",
    ] {
        obj.get(field)
            .unwrap_or_else(|| panic!("provider {key:?} missing required field {field:?}"));
    }

    // `key` field must equal the outer map key
    let inner_key = obj.get("key").and_then(|v| v.as_str()).unwrap();
    assert_eq!(
        inner_key, key,
        "provider {key:?}: inner `key` field {inner_key:?} must match outer map key"
    );

    // Protocol must be one of the known values
    let protocol = obj.get("protocol").and_then(|v| v.as_str()).unwrap();
    assert!(
        matches!(protocol, "OAuth2" | "OAuth1a" | "Oidc" | "Saml"),
        "provider {key:?}: unknown protocol {protocol:?}"
    );

    // URLs must parse (allow {placeholders} for template_vars)
    for field in ["authorize_url", "access_url", "refresh_url", "profile_url", "revoke_url"] {
        if let Some(u) = obj.get(field).and_then(|v| v.as_str()) {
            let cleaned = strip_template_vars(u);
            if let Err(e) = url::Url::parse(&cleaned) {
                panic!(
                    "provider {key:?}: field {field:?} is not a valid URL ({e}): {u:?}"
                );
            }
        }
    }
}

/// Replace `{placeholder}` substrings with harmless literal values so
/// the URL parser accepts them. This is only for validation — the real
/// substitution happens at runtime in the engine.
fn strip_template_vars(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut iter = s.chars().peekable();
    while let Some(c) = iter.next() {
        if c == '{' {
            // skip until matching }
            for d in iter.by_ref() {
                if d == '}' {
                    out.push_str("placeholder");
                    break;
                }
            }
        } else {
            out.push(c);
        }
    }
    out
}
```

- [ ] **Step 2: Add `url` to build-dependencies**

In `crates/signapps-oauth/Cargo.toml`, under `[build-dependencies]`:

```toml
[build-dependencies]
serde_json = { workspace = true }
url = "2"
```

- [ ] **Step 3: Test the validation**

Run: `cargo build -p signapps-oauth 2>&1 | tail -10`
Expected: success.

Temporarily break the catalog (manually edit `catalog.json`, change `"OAuth2"` → `"OAuth7"` in one provider) and rebuild:
Run: `cargo build -p signapps-oauth 2>&1 | tail -5`
Expected: panic with "unknown protocol".

**Revert the manual break** before committing:
Run: `rtk git diff crates/signapps-oauth/catalog.json | head -5`

If any diff remains, restore with: `rtk git checkout crates/signapps-oauth/catalog.json`

Then rebuild to confirm clean state: `cargo build -p signapps-oauth 2>&1 | tail -5` → success.

- [ ] **Step 4: Commit**

```bash
rtk git add crates/signapps-oauth/build.rs crates/signapps-oauth/Cargo.toml
rtk git commit -m "feat(oauth): validate catalog.json at compile time in build.rs

- Validates all required fields (key, display_name, protocol,
  authorize_url, access_url)
- Ensures inner 'key' field matches outer map key
- Rejects unknown protocols (must be OAuth2/OAuth1a/Oidc/Saml)
- URL-parses all URL fields, replacing {template_vars} with placeholder
- Panics with a descriptive message if any check fails — no broken
  catalog can reach production.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Implement OAuthError with RFC 7807 support

**Files:**
- Modify: `crates/signapps-oauth/src/error.rs`

- [ ] **Step 1: Write the full error type**

Replace `crates/signapps-oauth/src/error.rs`:

```rust
//! Top-level OAuth errors, mapped to RFC 7807 Problem Details.

use crate::catalog::CatalogError;
use crate::protocol::OAuthPurpose;
use crate::state::StateError;
use thiserror::Error;

/// All OAuth-level errors.
///
/// These map 1:1 to RFC 7807 Problem Details responses via the
/// conversion into `signapps_common::AppError` (Plan 3).
#[derive(Debug, Error)]
pub enum OAuthError {
    /// Provider is not configured for this tenant.
    #[error("provider not configured for this tenant")]
    ProviderNotConfigured,

    /// Provider is configured but not enabled.
    #[error("provider disabled")]
    ProviderDisabled,

    /// User does not have access to this provider (failed ScopeResolver check).
    #[error("user not allowed to use this provider")]
    UserAccessDenied,

    /// Purpose (login/integration) not allowed for this provider.
    #[error("purpose {0:?} not allowed for this provider")]
    PurposeNotAllowed(OAuthPurpose),

    /// FlowState token invalid (tampered, expired, malformed).
    #[error("invalid state: {0}")]
    InvalidState(#[from] StateError),

    /// Provider returned an error during the OAuth exchange.
    #[error("provider returned error: {error}: {description:?}")]
    ProviderError {
        /// Error code from the provider.
        error: String,
        /// Human-readable description.
        description: Option<String>,
    },

    /// id_token validation failed (OIDC).
    #[error("id_token validation failed: {0}")]
    IdTokenInvalid(String),

    /// SAML assertion validation failed.
    #[error("saml assertion invalid: {0}")]
    SamlInvalid(String),

    /// Requested scope is not in the tenant's allowed_scopes.
    #[error("scope {0:?} not in allowed_scopes")]
    ScopeNotAllowed(String),

    /// Catalog error.
    #[error(transparent)]
    Catalog(#[from] CatalogError),

    /// Required template variable or extra param missing.
    #[error("required parameter missing: {0}")]
    MissingParameter(String),

    /// Crypto error when handling encrypted config fields.
    #[error("crypto error: {0}")]
    Crypto(String),

    /// Database error.
    #[error("database error: {0}")]
    Database(String),
}

impl OAuthError {
    /// Map to an HTTP status code for RFC 7807 responses.
    #[must_use]
    pub fn status_code(&self) -> u16 {
        match self {
            Self::ProviderNotConfigured
            | Self::ProviderDisabled
            | Self::MissingParameter(_)
            | Self::ScopeNotAllowed(_) => 400,
            Self::UserAccessDenied | Self::PurposeNotAllowed(_) => 403,
            Self::InvalidState(_) | Self::IdTokenInvalid(_) | Self::SamlInvalid(_) => 401,
            Self::ProviderError { .. } => 502,
            Self::Catalog(CatalogError::NotFound(_)) => 404,
            Self::Catalog(CatalogError::Parse(_)) | Self::Crypto(_) | Self::Database(_) => 500,
        }
    }

    /// Return the RFC 7807 `type` URI fragment.
    ///
    /// Full URIs are namespaced under `https://errors.signapps.com/oauth/`
    /// and assembled by the HTTP layer.
    #[must_use]
    pub fn problem_type(&self) -> &'static str {
        match self {
            Self::ProviderNotConfigured => "provider-not-configured",
            Self::ProviderDisabled => "provider-disabled",
            Self::UserAccessDenied => "user-access-denied",
            Self::PurposeNotAllowed(_) => "purpose-not-allowed",
            Self::InvalidState(_) => "invalid-state",
            Self::ProviderError { .. } => "provider-error",
            Self::IdTokenInvalid(_) => "id-token-invalid",
            Self::SamlInvalid(_) => "saml-invalid",
            Self::ScopeNotAllowed(_) => "scope-not-allowed",
            Self::Catalog(_) => "catalog-error",
            Self::MissingParameter(_) => "missing-parameter",
            Self::Crypto(_) => "crypto-error",
            Self::Database(_) => "database-error",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn status_code_mapping() {
        assert_eq!(OAuthError::ProviderNotConfigured.status_code(), 400);
        assert_eq!(OAuthError::UserAccessDenied.status_code(), 403);
        assert_eq!(
            OAuthError::InvalidState(StateError::Expired).status_code(),
            401
        );
        assert_eq!(
            OAuthError::ProviderError {
                error: "invalid_grant".into(),
                description: None,
            }
            .status_code(),
            502
        );
    }

    #[test]
    fn problem_type_is_stable() {
        assert_eq!(
            OAuthError::ProviderNotConfigured.problem_type(),
            "provider-not-configured"
        );
        assert_eq!(
            OAuthError::UserAccessDenied.problem_type(),
            "user-access-denied"
        );
    }

    #[test]
    fn display_formats() {
        let err = OAuthError::PurposeNotAllowed(OAuthPurpose::Login);
        assert!(err.to_string().contains("login") || err.to_string().contains("Login"));
    }
}
```

- [ ] **Step 2: Run tests**

Run: `cargo test -p signapps-oauth --lib error 2>&1 | tail -10`
Expected: 3 tests pass.

- [ ] **Step 3: Commit**

```bash
rtk git add crates/signapps-oauth/src/error.rs
rtk git commit -m "feat(oauth): implement OAuthError with RFC 7807 support

12 error variants covering all OAuth failure modes (not configured,
disabled, user denied, purpose not allowed, state invalid, provider
error, id_token invalid, SAML invalid, scope denied, catalog, missing
param, crypto, database).

status_code() maps each variant to HTTP 400/401/403/404/500/502.
problem_type() returns a stable slug for RFC 7807 type URIs.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Implement FlowState struct

**Files:**
- Modify: `crates/signapps-oauth/src/state.rs`

- [ ] **Step 1: Write FlowState struct (no sign/verify yet)**

Replace the placeholder in `crates/signapps-oauth/src/state.rs` with:

```rust
//! Stateless HMAC-signed FlowState for OAuth callbacks.

use crate::protocol::OAuthPurpose;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;

/// Default lifetime of a FlowState token (10 minutes).
pub const FLOW_STATE_TTL_SECONDS: i64 = 600;

/// Errors from state signing/verification.
#[derive(Debug, Error)]
pub enum StateError {
    /// State token is malformed (missing separator, invalid base64, etc).
    #[error("malformed state token")]
    Malformed,
    /// HMAC signature does not verify.
    #[error("bad signature")]
    BadSignature,
    /// State has expired past its `expires_at` timestamp.
    #[error("state expired")]
    Expired,
    /// JSON deserialization of the payload failed.
    #[error("invalid state payload: {0}")]
    InvalidPayload(#[from] serde_json::Error),
}

/// The payload carried in the OAuth `state` query parameter.
///
/// Stateless design: the state machine keeps no server-side session.
/// All flow context rides in this struct, which is JSON-serialized,
/// then HMAC-signed via [`FlowState::sign`] and base64url-encoded.
/// The signed form is passed to the provider as the `state` param and
/// returned verbatim in the callback URL.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowState {
    /// Unique ID for this flow (logging, debug, analytics).
    pub flow_id: Uuid,
    /// The user initiating the flow (None for Login purpose — no session yet).
    pub user_id: Option<Uuid>,
    /// Tenant this flow belongs to.
    pub tenant_id: Uuid,
    /// Provider key (matches catalog.json entry or oauth_providers.key).
    pub provider_key: String,
    /// Login (SSO) or Integration (mail/calendar/drive/social).
    pub purpose: OAuthPurpose,
    /// Where to redirect the user after the flow completes.
    pub redirect_after: Option<String>,
    /// PKCE code verifier (if the provider requires PKCE).
    pub pkce_verifier: Option<String>,
    /// Anti-CSRF nonce — 32 random bytes base64-encoded.
    pub nonce: String,
    /// Unix timestamp (seconds) when the state was signed.
    pub issued_at: i64,
    /// Unix timestamp (seconds) after which the state is rejected.
    pub expires_at: i64,
    /// Scopes the caller requested.
    pub requested_scopes: Vec<String>,
    /// If the user supplied their own client_id/secret via oauth_user_overrides.
    pub override_client_id: Option<Uuid>,
}

impl FlowState {
    /// Build a fresh FlowState, setting issued_at and expires_at to
    /// now and now+TTL respectively.
    ///
    /// The caller is responsible for supplying the rest of the fields.
    #[must_use]
    pub fn new(
        tenant_id: Uuid,
        provider_key: String,
        purpose: OAuthPurpose,
        nonce: String,
    ) -> Self {
        let now = Utc::now().timestamp();
        Self {
            flow_id: Uuid::new_v4(),
            user_id: None,
            tenant_id,
            provider_key,
            purpose,
            redirect_after: None,
            pkce_verifier: None,
            nonce,
            issued_at: now,
            expires_at: now + FLOW_STATE_TTL_SECONDS,
            requested_scopes: Vec::new(),
            override_client_id: None,
        }
    }

    /// True if the state has already expired at the current time.
    #[must_use]
    pub fn is_expired(&self) -> bool {
        Utc::now().timestamp() > self.expires_at
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_sets_issued_and_expires() {
        let s = FlowState::new(
            Uuid::new_v4(),
            "google".to_string(),
            OAuthPurpose::Login,
            "nonce123".to_string(),
        );
        assert!(s.expires_at > s.issued_at);
        assert_eq!(s.expires_at - s.issued_at, FLOW_STATE_TTL_SECONDS);
        assert_eq!(s.purpose, OAuthPurpose::Login);
        assert!(!s.is_expired(), "fresh state should not be expired");
    }

    #[test]
    fn manually_expired_state_detected() {
        let mut s = FlowState::new(
            Uuid::new_v4(),
            "x".into(),
            OAuthPurpose::Login,
            "n".into(),
        );
        s.expires_at = 0; // in the past
        assert!(s.is_expired());
    }

    #[test]
    fn serde_roundtrips() {
        let s = FlowState::new(
            Uuid::new_v4(),
            "microsoft".into(),
            OAuthPurpose::Integration,
            "nonceABCDEF".into(),
        );
        let json = serde_json::to_string(&s).unwrap();
        let back: FlowState = serde_json::from_str(&json).unwrap();
        assert_eq!(back.flow_id, s.flow_id);
        assert_eq!(back.provider_key, s.provider_key);
        assert_eq!(back.purpose, s.purpose);
    }
}
```

Note: `OAuthPurpose` now needs `PartialEq` for the test. Go back to `crates/signapps-oauth/src/protocol.rs` and confirm `#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]` is on `OAuthPurpose`. If not, add it.

- [ ] **Step 2: Run tests**

Run: `cargo test -p signapps-oauth --lib state 2>&1 | tail -10`
Expected: 3 tests pass.

- [ ] **Step 3: Commit**

```bash
rtk git add crates/signapps-oauth/src/state.rs crates/signapps-oauth/src/protocol.rs
rtk git commit -m "feat(oauth): define FlowState struct with Serde + TTL

FlowState carries the full OAuth flow context — flow_id, user_id
(None for Login), tenant_id, provider_key, purpose, redirect_after,
pkce_verifier, nonce, issued_at, expires_at, requested_scopes,
override_client_id.

FlowState::new sets issued_at=now and expires_at=now+600s (10min TTL).
is_expired() returns true if past expires_at.

Serde round-trip tested. Sign + verify land in Task 10.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Implement FlowState::sign + FlowState::verify

**Files:**
- Modify: `crates/signapps-oauth/src/state.rs`
- Create: `crates/signapps-oauth/tests/state_roundtrip.rs`

- [ ] **Step 1: Add sign + verify methods**

Append to `crates/signapps-oauth/src/state.rs` (inside `impl FlowState`):

```rust
impl FlowState {
    // ... existing `new` and `is_expired` ...

    /// Sign this state with the given HMAC secret and return the
    /// base64url-encoded `payload.signature` token.
    ///
    /// The secret must be at least 32 bytes (enforced by caller; no
    /// runtime check here to avoid panic paths — use a 32-byte key
    /// generated by `openssl rand -hex 32` or similar).
    ///
    /// # Panics
    ///
    /// Never — HMAC-SHA256 accepts any key length, and JSON serialization
    /// of our owned-String fields is infallible.
    #[must_use]
    pub fn sign(&self, secret: &[u8]) -> String {
        use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
        use hmac::{Hmac, Mac};
        use sha2::Sha256;

        let payload = serde_json::to_vec(self).expect("FlowState serialize never fails");
        let payload_b64 = URL_SAFE_NO_PAD.encode(&payload);

        let mut mac = Hmac::<Sha256>::new_from_slice(secret).expect("HMAC accepts any key size");
        mac.update(payload_b64.as_bytes());
        let sig = mac.finalize().into_bytes();
        let sig_b64 = URL_SAFE_NO_PAD.encode(sig);

        format!("{payload_b64}.{sig_b64}")
    }

    /// Verify a signed state token and deserialize the payload.
    ///
    /// # Errors
    ///
    /// - [`StateError::Malformed`] if the token is missing the `.`
    ///   separator or has invalid base64url
    /// - [`StateError::BadSignature`] if the HMAC does not match
    /// - [`StateError::Expired`] if `expires_at` is in the past
    /// - [`StateError::InvalidPayload`] if the payload JSON is malformed
    pub fn verify(token: &str, secret: &[u8]) -> Result<Self, StateError> {
        use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
        use hmac::{Hmac, Mac};
        use sha2::Sha256;
        use subtle::ConstantTimeEq;

        let (payload_b64, sig_b64) = token.split_once('.').ok_or(StateError::Malformed)?;
        let payload = URL_SAFE_NO_PAD
            .decode(payload_b64)
            .map_err(|_| StateError::Malformed)?;
        let sig = URL_SAFE_NO_PAD
            .decode(sig_b64)
            .map_err(|_| StateError::Malformed)?;

        // Verify HMAC in constant time
        let mut mac = Hmac::<Sha256>::new_from_slice(secret).expect("HMAC accepts any key size");
        mac.update(payload_b64.as_bytes());
        let expected = mac.finalize().into_bytes();

        if sig.ct_eq(&expected).unwrap_u8() != 1 {
            return Err(StateError::BadSignature);
        }

        let state: FlowState = serde_json::from_slice(&payload)?;
        if state.is_expired() {
            return Err(StateError::Expired);
        }
        Ok(state)
    }
}
```

- [ ] **Step 2: Add `subtle` dep**

In `crates/signapps-oauth/Cargo.toml`, under `[dependencies]`:

```toml
subtle = "2"
```

(Also ensure it's in workspace `[workspace.dependencies]` — add `subtle = "2"` if missing.)

- [ ] **Step 3: Write integration test for roundtrip**

Create `crates/signapps-oauth/tests/state_roundtrip.rs`:

```rust
//! End-to-end sign/verify roundtrip + failure modes for FlowState.

use signapps_oauth::{FlowState, OAuthPurpose, StateError};
use uuid::Uuid;

const SECRET: &[u8] = b"0123456789abcdef0123456789abcdef";

fn mk_state() -> FlowState {
    FlowState::new(
        Uuid::new_v4(),
        "google".to_string(),
        OAuthPurpose::Login,
        "nonce-abc-def-123".to_string(),
    )
}

#[test]
fn sign_verify_roundtrip() {
    let s = mk_state();
    let token = s.sign(SECRET);
    let back = FlowState::verify(&token, SECRET).expect("verify");
    assert_eq!(back.flow_id, s.flow_id);
    assert_eq!(back.provider_key, s.provider_key);
}

#[test]
fn verify_rejects_tampered_payload() {
    let s = mk_state();
    let mut token = s.sign(SECRET);
    // Flip one bit in the payload section
    let bytes: &mut [u8] = unsafe { token.as_bytes_mut() };
    bytes[5] ^= 0x01;
    let err = FlowState::verify(&token, SECRET).unwrap_err();
    // Tampered payload either fails signature check or JSON decode
    assert!(matches!(err, StateError::BadSignature | StateError::InvalidPayload(_) | StateError::Malformed));
}

#[test]
fn verify_rejects_tampered_signature() {
    let s = mk_state();
    let token = s.sign(SECRET);
    let mut parts = token.split('.');
    let payload = parts.next().unwrap();
    let sig = parts.next().unwrap();
    // Flip the last character of the sig (still valid base64url, different bytes)
    let mut sig_bytes: Vec<u8> = sig.bytes().collect();
    let last = sig_bytes.len() - 1;
    sig_bytes[last] = if sig_bytes[last] == b'A' { b'B' } else { b'A' };
    let tampered = format!("{}.{}", payload, std::str::from_utf8(&sig_bytes).unwrap());
    let err = FlowState::verify(&tampered, SECRET).unwrap_err();
    assert!(matches!(err, StateError::BadSignature));
}

#[test]
fn verify_rejects_malformed_token() {
    let err = FlowState::verify("no-separator-here", SECRET).unwrap_err();
    assert!(matches!(err, StateError::Malformed));

    let err = FlowState::verify("not_base64.also_not", SECRET).unwrap_err();
    assert!(matches!(err, StateError::Malformed));
}

#[test]
fn verify_rejects_wrong_secret() {
    let s = mk_state();
    let token = s.sign(SECRET);
    let wrong = b"wrong-secret-never-used-this-00";
    let err = FlowState::verify(&token, wrong).unwrap_err();
    assert!(matches!(err, StateError::BadSignature));
}

#[test]
fn verify_rejects_expired_state() {
    let mut s = mk_state();
    s.issued_at = 0;
    s.expires_at = 1; // 1970-01-01 — definitely expired
    let token = s.sign(SECRET);
    let err = FlowState::verify(&token, SECRET).unwrap_err();
    assert!(matches!(err, StateError::Expired));
}
```

- [ ] **Step 4: Run the tests**

Run: `cargo test -p signapps-oauth 2>&1 | tail -15`

Expected: all tests pass including the 6 new integration tests.

- [ ] **Step 5: Commit**

```bash
rtk git add crates/signapps-oauth/
rtk git commit -m "$(cat <<'EOF'
feat(oauth): implement FlowState::sign + verify with HMAC-SHA256

- sign() JSON-serializes the state, base64url encodes it, HMAC-SHA256
  signs the base64 payload, and returns "payload.signature"
- verify() splits on '.', decodes base64, verifies HMAC in constant
  time via `subtle`, decodes JSON, and checks expiration

6 integration tests:
- roundtrip: sign then verify preserves all fields
- tampered payload: caught as BadSignature / InvalidPayload / Malformed
- tampered signature: caught as BadSignature
- malformed token: caught as Malformed
- wrong secret: caught as BadSignature
- expired state: caught as Expired

Uses `subtle` crate for constant-time signature comparison.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Implement ScopeResolver

**Files:**
- Modify: `crates/signapps-oauth/src/scope.rs`

- [ ] **Step 1: Write the full ScopeResolver**

Replace `crates/signapps-oauth/src/scope.rs`:

```rust
//! Scope resolver — org-aware provider visibility + scope filtering.

use crate::error::OAuthError;
use crate::protocol::OAuthPurpose;
use crate::provider::ProviderConfig;
use uuid::Uuid;

/// Snapshot of an user's org context for visibility checks.
///
/// Supplied by the caller (typically assembled from `signapps-db-identity`'s
/// org graph). `ScopeResolver` is agnostic to how the context is fetched.
#[derive(Debug, Clone)]
pub struct UserContext {
    /// The user.
    pub user_id: Uuid,
    /// Org nodes the user belongs to (departments, business units, ...).
    pub org_nodes: Vec<Uuid>,
    /// Cross-functional groups the user is a member of.
    pub groups: Vec<Uuid>,
    /// RBAC roles (admin, manager, user, ...).
    pub roles: Vec<String>,
}

/// Evaluates provider visibility, purpose allowance, and scope filtering.
///
/// Stateless — every check takes the `ProviderConfig` and `UserContext`
/// by reference; the resolver itself holds no state.
#[derive(Debug, Default, Clone, Copy)]
pub struct ScopeResolver;

impl ScopeResolver {
    /// Check whether the user has access to a provider based on the
    /// provider's visibility rules and the user's org context.
    ///
    /// Visibility = OR between (org_nodes ∪ groups ∪ roles) + override
    /// via `visible_to_users` (nominal whitelist, highest priority).
    ///
    /// # Errors
    ///
    /// Returns [`OAuthError::UserAccessDenied`] if the user is not
    /// allowed to use this provider.
    pub fn check_user_access(
        user_ctx: &UserContext,
        config: &ProviderConfig,
    ) -> Result<(), OAuthError> {
        // visible_to_users is a nominal override — highest priority.
        if config.visible_to_users.contains(&user_ctx.user_id) {
            return Ok(());
        }

        if config.visibility == "all" {
            return Ok(());
        }

        // "restricted" — OR between the 4 criteria.
        let allowed = config
            .visible_to_org_nodes
            .iter()
            .any(|n| user_ctx.org_nodes.contains(n))
            || config
                .visible_to_groups
                .iter()
                .any(|g| user_ctx.groups.contains(g))
            || config
                .visible_to_roles
                .iter()
                .any(|r| user_ctx.roles.contains(r));

        if allowed {
            Ok(())
        } else {
            Err(OAuthError::UserAccessDenied)
        }
    }

    /// Check whether the given purpose is allowed for this provider.
    ///
    /// # Errors
    ///
    /// Returns [`OAuthError::PurposeNotAllowed`] if the purpose is not
    /// in the config's `purposes` array.
    pub fn check_purpose_allowed(
        config: &ProviderConfig,
        purpose: OAuthPurpose,
    ) -> Result<(), OAuthError> {
        if !config
            .purposes
            .iter()
            .any(|p| p == purpose.as_str())
        {
            return Err(OAuthError::PurposeNotAllowed(purpose));
        }
        Ok(())
    }

    /// Validate that every requested scope is in `allowed_scopes`.
    ///
    /// # Errors
    ///
    /// Returns [`OAuthError::ScopeNotAllowed`] on the first scope not in
    /// the config's allowed list.
    pub fn filter_scopes(
        requested: &[String],
        config: &ProviderConfig,
    ) -> Result<Vec<String>, OAuthError> {
        for scope in requested {
            if !config.allowed_scopes.contains(scope) {
                return Err(OAuthError::ScopeNotAllowed(scope.clone()));
            }
        }
        Ok(requested.to_vec())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mk_config(
        visibility: &str,
        nodes: Vec<Uuid>,
        groups: Vec<Uuid>,
        roles: Vec<&str>,
        users: Vec<Uuid>,
        purposes: Vec<&str>,
        allowed_scopes: Vec<&str>,
    ) -> ProviderConfig {
        ProviderConfig {
            id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            provider_key: "test".into(),
            client_id_enc: None,
            client_secret_enc: None,
            extra_params_enc: None,
            enabled: true,
            purposes: purposes.into_iter().map(String::from).collect(),
            allowed_scopes: allowed_scopes.into_iter().map(String::from).collect(),
            visibility: visibility.into(),
            visible_to_org_nodes: nodes,
            visible_to_groups: groups,
            visible_to_roles: roles.into_iter().map(String::from).collect(),
            visible_to_users: users,
            allow_user_override: false,
            is_tenant_sso: false,
            auto_provision_users: false,
            default_role: None,
        }
    }

    fn mk_user(nodes: Vec<Uuid>, groups: Vec<Uuid>, roles: Vec<&str>) -> UserContext {
        UserContext {
            user_id: Uuid::new_v4(),
            org_nodes: nodes,
            groups,
            roles: roles.into_iter().map(String::from).collect(),
        }
    }

    #[test]
    fn visibility_all_accepts_everyone() {
        let config = mk_config("all", vec![], vec![], vec![], vec![], vec![], vec![]);
        let user = mk_user(vec![], vec![], vec![]);
        ScopeResolver::check_user_access(&user, &config).unwrap();
    }

    #[test]
    fn visibility_restricted_rejects_orphan_user() {
        let node = Uuid::new_v4();
        let config = mk_config("restricted", vec![node], vec![], vec![], vec![], vec![], vec![]);
        let user = mk_user(vec![Uuid::new_v4()], vec![], vec![]);
        let err = ScopeResolver::check_user_access(&user, &config).unwrap_err();
        assert!(matches!(err, OAuthError::UserAccessDenied));
    }

    #[test]
    fn visibility_restricted_accepts_matching_node() {
        let node = Uuid::new_v4();
        let config = mk_config("restricted", vec![node], vec![], vec![], vec![], vec![], vec![]);
        let user = mk_user(vec![node], vec![], vec![]);
        ScopeResolver::check_user_access(&user, &config).unwrap();
    }

    #[test]
    fn user_override_wins_over_visibility() {
        let user_id = Uuid::new_v4();
        // Config is restricted to a node the user doesn't belong to,
        // BUT user is in visible_to_users.
        let config = mk_config(
            "restricted",
            vec![Uuid::new_v4()],
            vec![],
            vec![],
            vec![user_id],
            vec![],
            vec![],
        );
        let user = UserContext {
            user_id,
            org_nodes: vec![],
            groups: vec![],
            roles: vec![],
        };
        ScopeResolver::check_user_access(&user, &config).unwrap();
    }

    #[test]
    fn visibility_by_role() {
        let config = mk_config(
            "restricted",
            vec![],
            vec![],
            vec!["admin"],
            vec![],
            vec![],
            vec![],
        );
        let user = mk_user(vec![], vec![], vec!["admin", "user"]);
        ScopeResolver::check_user_access(&user, &config).unwrap();

        let user2 = mk_user(vec![], vec![], vec!["user"]);
        let err = ScopeResolver::check_user_access(&user2, &config).unwrap_err();
        assert!(matches!(err, OAuthError::UserAccessDenied));
    }

    #[test]
    fn purpose_allowed() {
        let config = mk_config("all", vec![], vec![], vec![], vec![], vec!["login"], vec![]);
        ScopeResolver::check_purpose_allowed(&config, OAuthPurpose::Login).unwrap();

        let err = ScopeResolver::check_purpose_allowed(&config, OAuthPurpose::Integration)
            .unwrap_err();
        assert!(matches!(err, OAuthError::PurposeNotAllowed(OAuthPurpose::Integration)));
    }

    #[test]
    fn filter_scopes_passthrough_when_allowed() {
        let config = mk_config(
            "all",
            vec![],
            vec![],
            vec![],
            vec![],
            vec![],
            vec!["email", "profile", "openid"],
        );
        let requested = vec!["email".into(), "openid".into()];
        let out = ScopeResolver::filter_scopes(&requested, &config).unwrap();
        assert_eq!(out, requested);
    }

    #[test]
    fn filter_scopes_rejects_disallowed() {
        let config = mk_config("all", vec![], vec![], vec![], vec![], vec![], vec!["email"]);
        let requested = vec!["email".into(), "admin".into()];
        let err = ScopeResolver::filter_scopes(&requested, &config).unwrap_err();
        assert!(matches!(err, OAuthError::ScopeNotAllowed(s) if s == "admin"));
    }
}
```

- [ ] **Step 2: Run tests**

Run: `cargo test -p signapps-oauth --lib scope 2>&1 | tail -15`
Expected: 8 tests pass.

- [ ] **Step 3: Commit**

```bash
rtk git add crates/signapps-oauth/src/scope.rs
rtk git commit -m "$(cat <<'EOF'
feat(oauth): implement ScopeResolver for org-aware visibility

ScopeResolver has 3 stateless static methods:
- check_user_access: enforces visibility=all vs restricted with OR
  between (org_nodes, groups, roles). visible_to_users is a nominal
  whitelist override with highest priority.
- check_purpose_allowed: verifies the requested purpose is in the
  provider config's purposes array.
- filter_scopes: validates every requested scope is in allowed_scopes;
  rejects with ScopeNotAllowed on first violation.

UserContext is the input snapshot — org_nodes, groups, roles.
Assembly from the org graph lives in signapps-db-identity (not this
crate — ScopeResolver is pure business logic).

8 unit tests cover: visibility all, restricted with org_node match,
visible_to_users override, role match, purpose allow/deny, scope
pass/fail.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Create DB migration for oauth_* tables

**Files:**
- Create: `migrations/302_oauth_unified.sql`

- [ ] **Step 1: Check last migration number**

Run: `ls migrations/ | sort | tail -5`
Expected: `301_backfill_calendar_tenant_id.sql` is the latest. Our migration is `302`.

- [ ] **Step 2: Create the migration file**

```sql
-- Migration 302: OAuth unified architecture — provider catalog, per-tenant configs,
-- user overrides, and refresh queue placeholder.
--
-- Plan 2 (signapps-oauth crate foundation): creates the 4 configuration tables.
-- Plan 3 (engine v2) will consume these tables.
-- Plan 4 (migration + event bus) will add the encrypted columns to existing
-- per-service tables (mail_accounts, calendar_provider_connections, ...).

-- ────────────────────────────────────────────────────────────────────────────
-- 1. oauth_providers — custom providers (Keycloak tenant, OIDC generic, SAML)
--    that are not in the embedded catalog.json. The embedded ~10-200 providers
--    are NOT duplicated here.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE oauth_providers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    key             TEXT NOT NULL,
    display_name    TEXT NOT NULL,
    protocol        TEXT NOT NULL CHECK (protocol IN ('OAuth2', 'OAuth1a', 'Oidc', 'Saml')),
    authorize_url   TEXT NOT NULL,
    access_url      TEXT NOT NULL,
    refresh_url     TEXT,
    profile_url     TEXT,
    revoke_url      TEXT,
    scope_delimiter TEXT NOT NULL DEFAULT ' ',
    default_scopes  TEXT[] NOT NULL DEFAULT '{}',
    pkce_required   BOOLEAN NOT NULL DEFAULT false,
    supports_refresh BOOLEAN NOT NULL DEFAULT true,
    categories      TEXT[] NOT NULL DEFAULT '{}',
    user_id_field   TEXT NOT NULL DEFAULT '$.sub',
    user_email_field TEXT,
    user_name_field TEXT,
    template_vars   TEXT[] NOT NULL DEFAULT '{}',
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, key)
);

CREATE INDEX idx_oauth_providers_tenant ON oauth_providers (tenant_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 2. oauth_provider_configs — per-tenant config for a provider (catalog or custom).
--    Credentials are stored encrypted (AES-256-GCM via signapps-common::crypto).
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE oauth_provider_configs (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    provider_key      TEXT NOT NULL,

    -- Encrypted credentials (ciphertext: version || nonce || ct+tag)
    client_id_enc     BYTEA,
    client_secret_enc BYTEA,
    extra_params_enc  BYTEA,

    -- Activation
    enabled           BOOLEAN NOT NULL DEFAULT false,
    -- CHECK constraint: subset of {'login','integration'}
    purposes          TEXT[] NOT NULL DEFAULT '{}'
                      CHECK (purposes <@ ARRAY['login','integration']),

    -- Allowed scopes (whitelist filtered by ScopeResolver::filter_scopes)
    allowed_scopes    TEXT[] NOT NULL DEFAULT '{}',

    -- Visibility
    visibility        TEXT NOT NULL DEFAULT 'all'
                      CHECK (visibility IN ('all','restricted')),
    visible_to_org_nodes UUID[] NOT NULL DEFAULT '{}',
    visible_to_groups    UUID[] NOT NULL DEFAULT '{}',
    visible_to_roles     TEXT[] NOT NULL DEFAULT '{}',
    visible_to_users     UUID[] NOT NULL DEFAULT '{}',

    -- User customization
    allow_user_override  BOOLEAN NOT NULL DEFAULT false,

    -- SSO tenant-level
    is_tenant_sso        BOOLEAN NOT NULL DEFAULT false,
    auto_provision_users BOOLEAN NOT NULL DEFAULT false,
    default_role         TEXT,

    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, provider_key)
);

CREATE INDEX idx_oauth_provider_configs_tenant   ON oauth_provider_configs (tenant_id);
CREATE INDEX idx_oauth_provider_configs_enabled  ON oauth_provider_configs (tenant_id, enabled);

-- ────────────────────────────────────────────────────────────────────────────
-- 3. oauth_provider_purpose_overrides — per-(config, purpose) visibility override.
--    Allows "login for everyone, integration only for R&D" type policies.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE oauth_provider_purpose_overrides (
    provider_config_id UUID NOT NULL REFERENCES oauth_provider_configs(id) ON DELETE CASCADE,
    purpose            TEXT NOT NULL CHECK (purpose IN ('login','integration')),
    visibility         TEXT NOT NULL DEFAULT 'all'
                       CHECK (visibility IN ('all','restricted')),
    visible_to_org_nodes UUID[] NOT NULL DEFAULT '{}',
    visible_to_groups    UUID[] NOT NULL DEFAULT '{}',
    visible_to_roles     TEXT[] NOT NULL DEFAULT '{}',
    visible_to_users     UUID[] NOT NULL DEFAULT '{}',
    PRIMARY KEY (provider_config_id, purpose)
);

-- ────────────────────────────────────────────────────────────────────────────
-- 4. oauth_user_overrides — a user's personal client_id/secret for a provider.
--    Only usable when the tenant admin set allow_user_override = true.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE oauth_user_overrides (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    provider_key      TEXT NOT NULL,
    client_id_enc     BYTEA NOT NULL,
    client_secret_enc BYTEA NOT NULL,
    extra_params_enc  BYTEA,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, provider_key)
);

CREATE INDEX idx_oauth_user_overrides_user ON oauth_user_overrides (user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- Triggers: updated_at maintenance
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION oauth_touch_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER oauth_providers_touch_updated_at
    BEFORE UPDATE ON oauth_providers
    FOR EACH ROW EXECUTE FUNCTION oauth_touch_updated_at();

CREATE TRIGGER oauth_provider_configs_touch_updated_at
    BEFORE UPDATE ON oauth_provider_configs
    FOR EACH ROW EXECUTE FUNCTION oauth_touch_updated_at();
```

- [ ] **Step 2: Verify the migration runs**

Make sure PostgreSQL is running (`just db-start`).

Run:
```bash
just db-migrate 2>&1 | tail -20
```

Expected: migration 302 applied successfully.

If migration fails:
- Check that `tenants` and `users` tables exist in an earlier migration (they should — tenants is from the org structure and users is foundational)
- Report the exact error

- [ ] **Step 3: Verify tables exist**

Run:
```bash
psql "$DATABASE_URL" -c "\\dt oauth_*"
```

Expected: 4 tables listed (oauth_providers, oauth_provider_configs, oauth_provider_purpose_overrides, oauth_user_overrides).

- [ ] **Step 4: Commit**

```bash
rtk git add migrations/302_oauth_unified.sql
rtk git commit -m "$(cat <<'EOF'
feat(migrations): 302 — oauth unified tables

Creates 4 tables for the OAuth unified architecture:

1. oauth_providers — custom providers (Keycloak, OIDC generic, SAML)
   not in the embedded catalog. Per-tenant scoped via UNIQUE (tenant_id, key).

2. oauth_provider_configs — per-tenant activation, credentials
   (encrypted: client_id_enc, client_secret_enc, extra_params_enc),
   purposes (login/integration subset CHECK), allowed_scopes, visibility
   (all/restricted), org-aware filtering (org_nodes, groups, roles, users),
   allow_user_override, SSO tenant-level flags.

3. oauth_provider_purpose_overrides — per-(config, purpose) visibility
   override. Enables "login for all, integration for R&D only".

4. oauth_user_overrides — user's personal client_id/secret for a provider.

Triggers: updated_at maintained automatically on UPDATE for providers
and configs tables.

Encrypted columns (BYTEA) stored via signapps-common::crypto::EncryptedField
— version(1) || nonce(12) || ct+tag.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Implement ConfigStore trait + PgConfigStore

**Files:**
- Modify: `crates/signapps-oauth/src/config_store.rs`

- [ ] **Step 1: Write the implementation**

Replace `crates/signapps-oauth/src/config_store.rs`:

```rust
//! Tenant-level provider config storage (Postgres-backed).

use crate::error::OAuthError;
use crate::provider::ProviderConfig;
use async_trait::async_trait;
use sqlx::PgPool;
use tracing::instrument;
use uuid::Uuid;

/// Trait for fetching per-tenant provider configs.
///
/// Implemented by [`PgConfigStore`] for Postgres; can be mocked in tests.
#[async_trait]
pub trait ConfigStore: Send + Sync {
    /// Fetch the config for a (tenant, provider_key) pair.
    ///
    /// Returns `Ok(None)` if no config exists for this pair (not an error).
    ///
    /// # Errors
    ///
    /// Returns [`OAuthError::Database`] on connection or query errors.
    async fn get(
        &self,
        tenant_id: Uuid,
        provider_key: &str,
    ) -> Result<Option<ProviderConfig>, OAuthError>;

    /// List all configs (enabled or not) for a tenant.
    ///
    /// # Errors
    ///
    /// Returns [`OAuthError::Database`] on connection or query errors.
    async fn list_for_tenant(
        &self,
        tenant_id: Uuid,
    ) -> Result<Vec<ProviderConfig>, OAuthError>;
}

/// Postgres-backed [`ConfigStore`] using sqlx.
#[derive(Debug, Clone)]
pub struct PgConfigStore {
    pool: PgPool,
}

impl PgConfigStore {
    /// Build a new config store from a shared Postgres pool.
    #[must_use]
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl ConfigStore for PgConfigStore {
    #[instrument(skip(self))]
    async fn get(
        &self,
        tenant_id: Uuid,
        provider_key: &str,
    ) -> Result<Option<ProviderConfig>, OAuthError> {
        let row = sqlx::query_as::<_, ProviderConfigRow>(
            r#"
            SELECT id, tenant_id, provider_key,
                   client_id_enc, client_secret_enc, extra_params_enc,
                   enabled, purposes, allowed_scopes,
                   visibility, visible_to_org_nodes, visible_to_groups,
                   visible_to_roles, visible_to_users,
                   allow_user_override, is_tenant_sso, auto_provision_users,
                   default_role
            FROM oauth_provider_configs
            WHERE tenant_id = $1 AND provider_key = $2
            "#,
        )
        .bind(tenant_id)
        .bind(provider_key)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| OAuthError::Database(e.to_string()))?;
        Ok(row.map(Into::into))
    }

    #[instrument(skip(self))]
    async fn list_for_tenant(
        &self,
        tenant_id: Uuid,
    ) -> Result<Vec<ProviderConfig>, OAuthError> {
        let rows = sqlx::query_as::<_, ProviderConfigRow>(
            r#"
            SELECT id, tenant_id, provider_key,
                   client_id_enc, client_secret_enc, extra_params_enc,
                   enabled, purposes, allowed_scopes,
                   visibility, visible_to_org_nodes, visible_to_groups,
                   visible_to_roles, visible_to_users,
                   allow_user_override, is_tenant_sso, auto_provision_users,
                   default_role
            FROM oauth_provider_configs
            WHERE tenant_id = $1
            ORDER BY provider_key
            "#,
        )
        .bind(tenant_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| OAuthError::Database(e.to_string()))?;
        Ok(rows.into_iter().map(Into::into).collect())
    }
}

/// Row mirror of `oauth_provider_configs` for sqlx::FromRow.
#[derive(Debug, sqlx::FromRow)]
struct ProviderConfigRow {
    id: Uuid,
    tenant_id: Uuid,
    provider_key: String,
    client_id_enc: Option<Vec<u8>>,
    client_secret_enc: Option<Vec<u8>>,
    extra_params_enc: Option<Vec<u8>>,
    enabled: bool,
    purposes: Vec<String>,
    allowed_scopes: Vec<String>,
    visibility: String,
    visible_to_org_nodes: Vec<Uuid>,
    visible_to_groups: Vec<Uuid>,
    visible_to_roles: Vec<String>,
    visible_to_users: Vec<Uuid>,
    allow_user_override: bool,
    is_tenant_sso: bool,
    auto_provision_users: bool,
    default_role: Option<String>,
}

impl From<ProviderConfigRow> for ProviderConfig {
    fn from(r: ProviderConfigRow) -> Self {
        Self {
            id: r.id,
            tenant_id: r.tenant_id,
            provider_key: r.provider_key,
            client_id_enc: r.client_id_enc,
            client_secret_enc: r.client_secret_enc,
            extra_params_enc: r.extra_params_enc,
            enabled: r.enabled,
            purposes: r.purposes,
            allowed_scopes: r.allowed_scopes,
            visibility: r.visibility,
            visible_to_org_nodes: r.visible_to_org_nodes,
            visible_to_groups: r.visible_to_groups,
            visible_to_roles: r.visible_to_roles,
            visible_to_users: r.visible_to_users,
            allow_user_override: r.allow_user_override,
            is_tenant_sso: r.is_tenant_sso,
            auto_provision_users: r.auto_provision_users,
            default_role: r.default_role,
        }
    }
}
```

- [ ] **Step 2: Verify compile**

Run: `cargo check -p signapps-oauth 2>&1 | tail -5`
Expected: success.

- [ ] **Step 3: Run all keystore/oauth tests**

Run: `cargo test -p signapps-oauth -p signapps-keystore 2>&1 | tail -15`
Expected: all pass (no regression).

- [ ] **Step 4: Commit**

```bash
rtk git add crates/signapps-oauth/src/config_store.rs
rtk git commit -m "$(cat <<'EOF'
feat(oauth): implement ConfigStore trait + PgConfigStore

- ConfigStore: async trait with get(tenant, key) and list_for_tenant(tenant)
- PgConfigStore: sqlx-backed impl using the oauth_provider_configs table
- ProviderConfigRow: #[sqlx::FromRow] mirror, converted via From impl
- Errors mapped to OAuthError::Database with the sqlx error string
- #[instrument] spans for observability; skips self (no secrets)

No unit tests in this task — requires a live DB. Integration tests
with a real Postgres pool come in Task 15 and Plan 3 E2E tests.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Update CLAUDE.md + .env.example

**Files:**
- Modify: `CLAUDE.md`
- Modify: `.env.example`

- [ ] **Step 1: Add signapps-oauth to CLAUDE.md crates table**

Locate the crates block (between `signapps-keystore` and `signapps-runtime`) and insert:

```
  signapps-oauth/     → OAuth2/OIDC/SAML catalog, state machine, scope resolver
```

Between `signapps-keystore/` and `signapps-runtime/` alphabetically (k < o < r).

- [ ] **Step 2: Add signapps-oauth to Shared Crate Conventions**

Below the existing `signapps-keystore` entry, add:

```
**signapps-oauth:** `Catalog` (embedded JSON + DB overrides), `FlowState` (HMAC-signed stateless state), `ScopeResolver` (org-aware visibility + purpose + scope filtering), `ConfigStore` (async trait) + `PgConfigStore`, `OAuthError` (RFC 7807-ready). No HTTP engine yet — that's in Plan 3.
```

- [ ] **Step 3: Document OAUTH_STATE_SECRET in .env.example**

Append to `.env.example`:

```bash

# ─────────────────────────────────────────────────────────────
# signapps-oauth — HMAC secret for stateless FlowState tokens
# ─────────────────────────────────────────────────────────────
# 32 bytes hex-encoded (64 characters). Generate with:
#   bash scripts/generate-master-key.sh   # re-uses the key generator
#
# This secret signs the OAuth `state` param. MUST be distinct from
# JWT_SECRET and KEYSTORE_MASTER_KEY. Rotating invalidates any flows
# in progress (callbacks arriving with state signed by the old secret
# will be rejected as BadSignature — acceptable given the 10min TTL).
OAUTH_STATE_SECRET=
```

- [ ] **Step 4: Commit**

```bash
rtk git add CLAUDE.md .env.example
rtk git commit -m "docs(oauth): document signapps-oauth crate + OAUTH_STATE_SECRET env var

- CLAUDE.md: crates/ block + Shared Crate Conventions section
- .env.example: new block for OAUTH_STATE_SECRET (32-byte hex, HMAC key)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: Full workspace validation

**Files:**
- None (validation only)

- [ ] **Step 1: cargo check workspace**

Run: `cargo check --workspace --all-features 2>&1 | tail -10`
Expected: success.

- [ ] **Step 2: clippy strict on new crate**

Run: `cargo clippy -p signapps-oauth --all-features --tests -- -D warnings 2>&1 | tail -10`
Expected: clean.

- [ ] **Step 3: All oauth + keystore tests**

Run: `cargo test -p signapps-oauth -p signapps-keystore -p signapps-common 2>&1 | tail -15`

Expected count:
- signapps-oauth unit: 4 (protocol) + 2 (provider) + 4 (catalog) + 3 (error) + 3 (state) + 8 (scope) = 24 tests
- signapps-oauth integration: 6 (state_roundtrip) = 6 tests
- signapps-oauth total: 30 tests
- signapps-keystore: 23 tests (same as Plan 1)
- signapps-common: 37 tests (same as Plan 1)

Total: ~90 tests should pass.

- [ ] **Step 4: cargo fmt check**

Run: `cargo fmt --all -- --check 2>&1 | tail -5`

If there's a diff in Plan 2 files only, apply fmt:
```bash
cargo fmt -p signapps-oauth
rtk git add -u crates/signapps-oauth/
rtk git commit -m "style(oauth): cargo fmt on Plan 2 files

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

If diffs are in unrelated files, skip (don't mass-format).

- [ ] **Step 5: Identity still builds**

Run: `cargo build -p signapps-identity 2>&1 | tail -5`
Expected: success.

- [ ] **Step 6: Doctor still green**

Run: `export KEYSTORE_MASTER_KEY=$(bash scripts/generate-master-key.sh | tr -d '\r\n') && bash scripts/doctor.sh 2>&1 | tail -20`

Expected: all checks pass (including the 22/22 from Plan 1).

- [ ] **Step 7: Final git log summary**

Run: `rtk git log --oneline -20`

Verify Plan 2 commits are present (15 tasks × ~1 commit = 15 commits + formatting if any).

---

**Self-review checklist for the plan author:**

- ✅ Spec section 4.1 Catalog hybride → Tasks 1-7
- ✅ Spec section 4.2 Configuration par tenant → Tasks 12-13
- ✅ Spec section 4.3 Override par purpose → Task 12 (migration)
- ✅ Spec section 4.4 Overrides utilisateur → Task 12 (migration)
- ✅ Spec section 5.1 State signé HMAC → Tasks 9-10
- ✅ Spec section 5.5 Gestion d'erreurs RFC 7807 → Task 8
- ✅ Spec section 9.2 ScopeResolver (for admin UI, but logic lives here) → Task 11
- ✅ Section 6 Format catalogue → Tasks 4, 5, 7

**Not covered in Plan 2 (intentional, for later plans):**
- Engine v2 (start/callback) — Plan 3
- HTTP handlers — Plan 3
- OIDC id_token validation — Plan 3
- Event bus `oauth.tokens.acquired` — Plan 4
- Refresh queue — Plan 5
- Admin UI — Plan 5

Plan 3 will be written after Plan 2 is implemented and validated.
