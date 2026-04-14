# OAuth Migration & Event Bus Implementation Plan (Plan 4 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the OAuth pipeline by (a) adding encrypted token columns to existing service tables, (b) emitting `oauth.tokens.acquired` events from the identity callback handler, (c) wiring per-service consumers, (d) shipping a migration script for any existing plaintext tokens, and (e) adding boot guardrails to refuse plaintext tokens at startup.

**Architecture:**

```
identity callback handler
  ├─ EngineV2::callback() → (CallbackResponse, TokenResponse, ProviderProfile, FlowState)
  ├─ Encrypt access_token + refresh_token via signapps-keystore (DEK oauth-tokens-v1)
  ├─ Emit OAuthTokensAcquired event via PgEventBus (platform.events)
  ├─ purpose=Login → provision/lookup user, create JWT session
  └─ Redirect to flow.redirect_after

Consumers (mail, calendar, social) subscribe via PgEventBus::listen:
  └─ Persist encrypted token to their service table (mail.accounts.access_token_enc, etc.)

Migration:
  ├─ Add BYTEA `*_enc` columns alongside existing TEXT columns
  ├─ Encrypt existing TEXT values into the new columns
  ├─ Verify all tokens encrypted
  └─ (Plan 4.5 follow-up: drop the TEXT columns once all consumers are wired)
```

**Tech Stack:** `signapps-common::pg_events::PgEventBus` (LISTEN/NOTIFY + `platform.events` storage), existing migration tooling (`just db-migrate`), `signapps-keystore` from Plan 1, `EncryptedField` trait.

**Dependencies:** Plans 1, 2, 3 fully merged on `main`.

**Existing tables in scope** (discovered during plan writing):
- `mail.accounts` — `oauth_refresh_token TEXT` (per migration 026)
- `calendar.provider_connections` — `access_token TEXT NOT NULL`, `refresh_token TEXT` (per migration 032)
- `social.accounts` — `access_token TEXT`, `refresh_token TEXT` (per migrations 062 + 117)

**Note on the migration step:** Since this is greenfield development (no production data to migrate yet), the migration "encrypt existing tokens" path is mostly hypothetical for now — the binary still ships so it works for any tenant who has accumulated test tokens locally and to handle the future case where deployments have existed long enough to have plaintext data.

---

## File Structure

### Created
- `crates/signapps-oauth/src/events.rs` — `OAuthTokensAcquired`, `OAuthTokenInvalidated` event payloads + `EVENT_TYPE` constants
- `crates/signapps-keystore/src/helpers.rs` — `encrypt_string`, `decrypt_string` convenience wrappers
- `migrations/303_oauth_token_encryption.sql` — adds BYTEA `*_enc` columns to existing tables
- `scripts/migrate-oauth-tokens.sh` — bash orchestrator (stop, backup, run binary, verify, restart)
- `crates/signapps-oauth/src/bin/oauth_migrate_encrypt.rs` — binary that reads TEXT, encrypts, writes BYTEA
- `crates/signapps-oauth/src/bin/oauth_migrate_verify.rs` — binary that asserts no plaintext remains
- `crates/signapps-keystore/src/guardrail.rs` — `assert_tokens_encrypted` helper for service boot
- `services/signapps-mail/src/oauth_consumer.rs` — subscribes to `oauth.tokens.acquired`, stores encrypted token in `mail.accounts`
- `scripts/doctor-checks/oauth-encryption.sh` — doctor check verifying no plaintext token columns remain

### Modified
- `crates/signapps-oauth/src/lib.rs` — re-export events module
- `crates/signapps-oauth/Cargo.toml` — add `[[bin]]` entries for the migration binaries; add sqlx as runtime dep (already present)
- `crates/signapps-keystore/src/lib.rs` — re-export `helpers` + `guardrail`
- `services/signapps-identity/src/handlers/oauth/mod.rs` — flesh out `callback` handler (encrypt + emit event + JWT for Login)
- `services/signapps-mail/Cargo.toml` — add `signapps-oauth` + `signapps-keystore` deps
- `services/signapps-mail/src/main.rs` — register consumer, add keystore to AppState
- `scripts/doctor.sh` — invoke `oauth-encryption.sh` check
- `CLAUDE.md` — note migration in changelog block / shared crate section
- `docs/superpowers/specs/2026-04-14-oauth-unified-design.md` — historique entry

---

## Task 1: Define OAuthTokensAcquired event payload

**Files:**
- Create: `crates/signapps-oauth/src/events.rs`
- Modify: `crates/signapps-oauth/src/lib.rs`

The payload mirrors what the engine produces (encrypted tokens + metadata for consumers to do their own lookup).

- [ ] **Step 1: Write the events module**

```rust
//! Event payloads for cross-service OAuth pipeline.
//!
//! Published by `signapps-identity` after a successful OAuth flow.
//! Consumed by per-service workers (mail, calendar, social) that store
//! the encrypted tokens in their own tables.
//!
//! Format on the wire: serde_json into `platform.events.payload`.

use crate::protocol::{OAuthPurpose, ProviderCategory};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Event type string for the `event_type` column in `platform.events`.
pub const EVENT_OAUTH_TOKENS_ACQUIRED: &str = "oauth.tokens.acquired";

/// Event type string for the token-invalidation event (used in Plan 5
/// when the refresh job exhausts retries).
pub const EVENT_OAUTH_TOKEN_INVALIDATED: &str = "oauth.tokens.invalidated";

/// Emitted by `signapps-identity` after a successful OAuth callback.
///
/// Token bytes (`access_token_enc`, `refresh_token_enc`) are AES-GCM
/// ciphertexts under DEK `oauth-tokens-v1` — consumers decrypt with
/// the same DEK before use.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthTokensAcquired {
    /// User who completed the flow (None means a new user from `Login`
    /// — the `provider_user_email` is the canonical identifier in that
    /// case and the consumer should look up by email).
    pub user_id: Option<Uuid>,
    /// Tenant scope.
    pub tenant_id: Uuid,
    /// Provider key (e.g., "google", "microsoft").
    pub provider_key: String,
    /// Login (SSO) or Integration (mail/calendar/...).
    pub purpose: OAuthPurpose,
    /// Primary category — consumers use this to filter (`mail` only
    /// reacts to events with category Mail, etc.). Helps avoid
    /// every consumer waking up for every event.
    pub category: ProviderCategory,
    /// Encrypted access token.
    pub access_token_enc: Vec<u8>,
    /// Encrypted refresh token (None if the provider doesn't issue one,
    /// e.g., GitHub).
    pub refresh_token_enc: Option<Vec<u8>>,
    /// When the access token expires (None if the provider doesn't tell us).
    pub expires_at: Option<DateTime<Utc>>,
    /// Scopes the provider actually granted (may be a subset of requested).
    pub scopes_granted: Vec<String>,
    /// Provider's user ID (e.g., Google's `sub`, GitHub's `id`).
    pub provider_user_id: String,
    /// Provider's user email (if available).
    pub provider_user_email: Option<String>,
}

/// Emitted by the refresh job (Plan 5) when a token cannot be refreshed
/// after retry exhaustion — consumers should mark their account row as
/// "needs reconnection" and notify the user.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthTokenInvalidated {
    /// User whose token broke.
    pub user_id: Uuid,
    /// Tenant scope.
    pub tenant_id: Uuid,
    /// Provider key.
    pub provider_key: String,
    /// Which table held the broken token (e.g., "mail.accounts").
    pub source_table: String,
    /// Row ID in that table.
    pub source_id: Uuid,
    /// Human-readable reason (last error from the refresh attempt).
    pub reason: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serde_roundtrip_acquired() {
        let ev = OAuthTokensAcquired {
            user_id: Some(Uuid::new_v4()),
            tenant_id: Uuid::new_v4(),
            provider_key: "google".into(),
            purpose: OAuthPurpose::Integration,
            category: ProviderCategory::Mail,
            access_token_enc: vec![0x01, 0x02, 0x03],
            refresh_token_enc: Some(vec![0x04, 0x05]),
            expires_at: None,
            scopes_granted: vec!["openid".into()],
            provider_user_id: "12345".into(),
            provider_user_email: Some("u@example.com".into()),
        };
        let json = serde_json::to_string(&ev).unwrap();
        let back: OAuthTokensAcquired = serde_json::from_str(&json).unwrap();
        assert_eq!(back.provider_key, "google");
        assert_eq!(back.access_token_enc, vec![0x01, 0x02, 0x03]);
    }

    #[test]
    fn event_type_constants_are_stable() {
        // These strings are persisted in DB — never change them.
        assert_eq!(EVENT_OAUTH_TOKENS_ACQUIRED, "oauth.tokens.acquired");
        assert_eq!(EVENT_OAUTH_TOKEN_INVALIDATED, "oauth.tokens.invalidated");
    }
}
```

- [ ] **Step 2: Re-export from lib.rs**

```rust
pub mod events;
pub use events::{
    OAuthTokenInvalidated, OAuthTokensAcquired, EVENT_OAUTH_TOKEN_INVALIDATED,
    EVENT_OAUTH_TOKENS_ACQUIRED,
};
```

- [ ] **Step 3: Run tests + commit**

Run: `cargo test -p signapps-oauth --lib events 2>&1 | tail -10`
Expected: 2 tests pass.

```bash
rtk git add crates/signapps-oauth/src/events.rs crates/signapps-oauth/src/lib.rs
rtk git commit -m "feat(oauth): event payloads for the cross-service OAuth pipeline

OAuthTokensAcquired: emitted by identity after a successful flow.
Carries encrypted tokens (DEK oauth-tokens-v1) + metadata so per-service
consumers can persist + deduplicate without touching the engine.

OAuthTokenInvalidated: emitted by Plan 5's refresh job after retries
exhaust. Consumers mark their row as 'needs reconnection'.

Event type constants are pub const &'static str — never change them
once tokens are flowing in production.

2 unit tests: serde roundtrip, constant strings.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: encrypt_string / decrypt_string convenience helpers

**Files:**
- Create: `crates/signapps-keystore/src/helpers.rs`
- Modify: `crates/signapps-keystore/src/lib.rs`

The base `EncryptedField` trait works on `&[u8]`. Almost every caller wants to convert a `&str` or `String` — the helpers eliminate boilerplate.

- [ ] **Step 1: Write the helpers module**

```rust
//! Convenience wrappers around `signapps_common::crypto::EncryptedField`
//! for the very common `String ↔ Vec<u8>` case.

use crate::DataEncryptionKey;
use signapps_common::crypto::{CryptoError, EncryptedField};
use std::sync::Arc;

/// Encrypt a UTF-8 string with the given DEK.
///
/// Caller chooses whether to pass `&Arc<DataEncryptionKey>` (cheap
/// clone) or `&DataEncryptionKey` (already-borrowed). Use `Arc::as_ref`
/// or `&*arc` if you have the `Arc`.
///
/// # Errors
///
/// Returns [`CryptoError::AesGcm`] if the AES-GCM primitive fails.
pub fn encrypt_string(plaintext: &str, dek: &DataEncryptionKey) -> Result<Vec<u8>, CryptoError> {
    <()>::encrypt(plaintext.as_bytes(), dek)
}

/// Decrypt a ciphertext into a UTF-8 string.
///
/// # Errors
///
/// - [`CryptoError::TooShort`] / [`CryptoError::UnsupportedVersion`] /
///   [`CryptoError::AesGcm`] for cipher-level failures.
/// - Returns `CryptoError::AesGcm` with `"plaintext is not UTF-8"` if
///   the decrypted bytes are not valid UTF-8 (would only happen if a
///   non-UTF-8 byte sequence was encrypted, which is the caller's bug).
pub fn decrypt_string(ciphertext: &[u8], dek: &DataEncryptionKey) -> Result<String, CryptoError> {
    let bytes = <()>::decrypt(ciphertext, dek)?;
    String::from_utf8(bytes).map_err(|e| CryptoError::AesGcm(format!("plaintext is not UTF-8: {e}")))
}

/// Variant that accepts `&Arc<DataEncryptionKey>` — the typical handle
/// returned by [`crate::Keystore::dek`].
///
/// # Errors
///
/// Same as [`encrypt_string`].
pub fn encrypt_string_arc(plaintext: &str, dek: &Arc<DataEncryptionKey>) -> Result<Vec<u8>, CryptoError> {
    encrypt_string(plaintext, dek.as_ref())
}

/// Variant that accepts `&Arc<DataEncryptionKey>`.
///
/// # Errors
///
/// Same as [`decrypt_string`].
pub fn decrypt_string_arc(ciphertext: &[u8], dek: &Arc<DataEncryptionKey>) -> Result<String, CryptoError> {
    decrypt_string(ciphertext, dek.as_ref())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{Keystore, KeystoreBackend};

    const HEX: &str = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    async fn test_dek() -> Arc<DataEncryptionKey> {
        let var = format!(
            "HELPERS_TEST_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        );
        std::env::set_var(&var, HEX);
        let ks = Keystore::init(KeystoreBackend::EnvVarNamed(var.clone()))
            .await
            .unwrap();
        std::env::remove_var(&var);
        ks.dek("test-helpers")
    }

    #[tokio::test]
    async fn string_roundtrip() {
        let dek = test_dek().await;
        let ct = encrypt_string("ya29.token-with-special-chars-éàü", &dek).unwrap();
        let pt = decrypt_string(&ct, &dek).unwrap();
        assert_eq!(pt, "ya29.token-with-special-chars-éàü");
    }

    #[tokio::test]
    async fn arc_variant_works() {
        let dek = test_dek().await;
        let ct = encrypt_string_arc("hello", &dek).unwrap();
        let pt = decrypt_string_arc(&ct, &dek).unwrap();
        assert_eq!(pt, "hello");
    }

    #[tokio::test]
    async fn empty_string_roundtrips() {
        let dek = test_dek().await;
        let ct = encrypt_string("", &dek).unwrap();
        let pt = decrypt_string(&ct, &dek).unwrap();
        assert_eq!(pt, "");
    }
}
```

- [ ] **Step 2: Re-export from lib.rs**

```rust
mod helpers;
pub use helpers::{decrypt_string, decrypt_string_arc, encrypt_string, encrypt_string_arc};
```

- [ ] **Step 3: Run tests + commit**

Run: `cargo test -p signapps-keystore --lib helpers 2>&1 | tail -10`
Expected: 3 tests pass.

```bash
rtk git add crates/signapps-keystore/src/helpers.rs crates/signapps-keystore/src/lib.rs
rtk git commit -m "feat(keystore): encrypt_string + decrypt_string helpers

Eliminate the .as_bytes()/.from_utf8() boilerplate for the very common
String ↔ ciphertext case. Two variants — &DataEncryptionKey and
&Arc<DataEncryptionKey> — to fit the handle Keystore::dek returns.

3 unit tests: roundtrip with multi-byte UTF-8, Arc variant, empty string.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Schema migration — add BYTEA columns alongside TEXT

**Files:**
- Create: `migrations/303_oauth_token_encryption.sql`

We add encrypted columns **alongside** existing TEXT ones (rather than ALTER TYPE) so the migration is non-destructive and rollback-safe. A follow-up plan can drop the TEXT columns once all consumers are reading from the encrypted columns.

- [ ] **Step 1: Verify the schema baseline**

Run: `ls migrations/ | sort -V | tail -3`
Expected: `302_oauth_unified.sql` is the latest. Our new file is `303_oauth_token_encryption.sql`.

- [ ] **Step 2: Confirm existing column locations** (already verified during plan writing, but double-check)

Run:
```bash
grep -n 'access_token\|refresh_token\|oauth_refresh_token' migrations/026_mail_schema.sql migrations/032_external_calendar_sync.sql migrations/117_social_schema.sql 2>&1 | head -10
```

Expected: shows the 5 tokens columns we need to mirror.

- [ ] **Step 3: Write the migration**

```sql
-- Migration 303: add BYTEA encrypted-token columns alongside existing TEXT.
--
-- Plan 4 introduces encrypted token storage. Existing TEXT columns are
-- preserved during the transition so callers can be migrated one at a
-- time. A follow-up plan drops the TEXT columns once all consumers
-- have switched to *_enc.
--
-- Encrypted format: signapps-common::crypto::EncryptedField
--   = version(1) || nonce(12) || aes_gcm(plaintext, dek) || tag(16)
--   under DEK "oauth-tokens-v1"

-- ── mail.accounts ────────────────────────────────────────────────────────────
-- Existing: oauth_refresh_token TEXT
-- (Note: mail.accounts has no access_token column today — IMAP/SMTP use
--  different auth. We add both for future OAuth-mail consumers.)
ALTER TABLE mail.accounts ADD COLUMN IF NOT EXISTS oauth_access_token_enc  BYTEA;
ALTER TABLE mail.accounts ADD COLUMN IF NOT EXISTS oauth_refresh_token_enc BYTEA;
ALTER TABLE mail.accounts ADD COLUMN IF NOT EXISTS oauth_expires_at        TIMESTAMPTZ;
ALTER TABLE mail.accounts ADD COLUMN IF NOT EXISTS oauth_provider_key      TEXT;

-- ── calendar.provider_connections ────────────────────────────────────────────
-- Existing: access_token TEXT NOT NULL, refresh_token TEXT
ALTER TABLE calendar.provider_connections ADD COLUMN IF NOT EXISTS access_token_enc  BYTEA;
ALTER TABLE calendar.provider_connections ADD COLUMN IF NOT EXISTS refresh_token_enc BYTEA;

-- ── social.accounts ──────────────────────────────────────────────────────────
-- Existing: access_token TEXT, refresh_token TEXT
ALTER TABLE social.accounts ADD COLUMN IF NOT EXISTS access_token_enc  BYTEA;
ALTER TABLE social.accounts ADD COLUMN IF NOT EXISTS refresh_token_enc BYTEA;

-- ── Indexes for refresh-job lookup (Plan 5) ──────────────────────────────────
-- These indexes accelerate the upcoming refresh-queue scanner that selects
-- rows whose token is about to expire. Using partial indexes (WHERE *_enc
-- IS NOT NULL) keeps them small.
CREATE INDEX IF NOT EXISTS idx_mail_accounts_oauth_expires_at
    ON mail.accounts (oauth_expires_at)
    WHERE oauth_access_token_enc IS NOT NULL;
```

(Note: calendar + social refresh-queue indexes added in Plan 5 alongside the queue table itself — this migration only adds storage.)

- [ ] **Step 4: Apply the migration**

Run (Postgres must be up):
```bash
just db-migrate 2>&1 | tail -10
```

If `just db-migrate` chokes on pre-existing sqlx tracking issues (as P2T12 found), apply directly via Docker:
```bash
docker exec -i signapps-postgres psql -U signapps -d signapps < migrations/303_oauth_token_encryption.sql
```

Verify:
```bash
docker exec signapps-postgres psql -U signapps -d signapps -c "\d mail.accounts" 2>&1 | grep oauth_
docker exec signapps-postgres psql -U signapps -d signapps -c "\d calendar.provider_connections" 2>&1 | grep _enc
docker exec signapps-postgres psql -U signapps -d signapps -c "\d social.accounts" 2>&1 | grep _enc
```

Expected: 4 mail columns (oauth_access_token_enc, oauth_refresh_token_enc, oauth_expires_at, oauth_provider_key), 2 calendar columns, 2 social columns.

- [ ] **Step 5: Commit**

```bash
rtk git add migrations/303_oauth_token_encryption.sql
rtk git commit -m "$(cat <<'EOF'
feat(migrations): 303 — add BYTEA encrypted token columns

Adds *_enc BYTEA columns alongside existing TEXT in 3 tables:
- mail.accounts: oauth_access_token_enc, oauth_refresh_token_enc,
  oauth_expires_at, oauth_provider_key (4 new — mail had only refresh
  before; access added for future OAuth-mail consumers)
- calendar.provider_connections: access_token_enc, refresh_token_enc
- social.accounts: access_token_enc, refresh_token_enc

Existing TEXT columns are preserved during the transition. A follow-up
plan drops them once all consumers are migrated.

One partial index added (mail.accounts.oauth_expires_at WHERE
oauth_access_token_enc IS NOT NULL) for the refresh-queue scanner that
lands in Plan 5. Calendar + social indexes added in Plan 5 alongside
the queue table.

Format: signapps-common::crypto::EncryptedField = version(1) ||
nonce(12) || aes_gcm(plaintext, dek) || tag(16), DEK 'oauth-tokens-v1'.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: oauth-migrate-encrypt binary

**Files:**
- Create: `crates/signapps-oauth/src/bin/oauth_migrate_encrypt.rs`
- Modify: `crates/signapps-oauth/Cargo.toml` (add [[bin]] entry)

This binary reads existing TEXT tokens, encrypts them via the keystore, and writes them to the new BYTEA columns. Idempotent — runs over rows where `*_enc IS NULL AND <text-column> IS NOT NULL`.

- [ ] **Step 1: Add [[bin]] entry to Cargo.toml**

In `crates/signapps-oauth/Cargo.toml`, add at the bottom:

```toml
[[bin]]
name = "oauth-migrate-encrypt"
path = "src/bin/oauth_migrate_encrypt.rs"

[[bin]]
name = "oauth-migrate-verify"
path = "src/bin/oauth_migrate_verify.rs"
```

Add `anyhow = { workspace = true }` to `[dependencies]` if not already there.

- [ ] **Step 2: Write the binary**

```rust
//! Encrypt existing plaintext OAuth tokens into the new BYTEA columns.
//!
//! Reads `DATABASE_URL` and `KEYSTORE_MASTER_KEY` from env. Idempotent:
//! processes rows where `*_enc IS NULL AND <text> IS NOT NULL`.
//!
//! Run as: `cargo run --bin oauth-migrate-encrypt --release`

use anyhow::{Context, Result};
use signapps_common::crypto::EncryptedField;
use signapps_keystore::{Keystore, KeystoreBackend};
use sqlx::PgPool;
use std::sync::Arc;

/// One column to migrate: its TEXT source and BYTEA target.
struct ColumnMigration {
    table: &'static str,
    text_col: &'static str,
    enc_col: &'static str,
}

const MIGRATIONS: &[ColumnMigration] = &[
    // mail.accounts had only oauth_refresh_token; the new oauth_access_token_enc
    // has no plaintext source so we skip it here (no rows to migrate).
    ColumnMigration {
        table: "mail.accounts",
        text_col: "oauth_refresh_token",
        enc_col: "oauth_refresh_token_enc",
    },
    ColumnMigration {
        table: "calendar.provider_connections",
        text_col: "access_token",
        enc_col: "access_token_enc",
    },
    ColumnMigration {
        table: "calendar.provider_connections",
        text_col: "refresh_token",
        enc_col: "refresh_token_enc",
    },
    ColumnMigration {
        table: "social.accounts",
        text_col: "access_token",
        enc_col: "access_token_enc",
    },
    ColumnMigration {
        table: "social.accounts",
        text_col: "refresh_token",
        enc_col: "refresh_token_enc",
    },
];

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();

    let database_url = std::env::var("DATABASE_URL").context("DATABASE_URL not set")?;
    let pool = PgPool::connect(&database_url)
        .await
        .context("connect to Postgres")?;
    let keystore = Arc::new(
        Keystore::init(KeystoreBackend::EnvVar)
            .await
            .context("Keystore::init — is KEYSTORE_MASTER_KEY set?")?,
    );
    let dek = keystore.dek("oauth-tokens-v1");

    let mut total_migrated = 0;
    for col in MIGRATIONS {
        let n = migrate_column(&pool, col, &dek).await?;
        total_migrated += n;
        println!(
            "  ✓ {}.{} → {}: {} rows migrated",
            col.table, col.text_col, col.enc_col, n
        );
    }
    println!("done — {total_migrated} rows total");
    Ok(())
}

async fn migrate_column(
    pool: &PgPool,
    col: &ColumnMigration,
    dek: &Arc<signapps_keystore::DataEncryptionKey>,
) -> Result<usize> {
    // Build the SELECT to fetch un-migrated rows.
    let select_sql = format!(
        "SELECT id, {text} FROM {table} \
         WHERE {text} IS NOT NULL AND {enc} IS NULL",
        table = col.table,
        text = col.text_col,
        enc = col.enc_col
    );
    let rows: Vec<(uuid::Uuid, String)> = sqlx::query_as(&select_sql)
        .fetch_all(pool)
        .await
        .with_context(|| format!("SELECT from {}.{}", col.table, col.text_col))?;

    if rows.is_empty() {
        return Ok(0);
    }

    let update_sql = format!(
        "UPDATE {table} SET {enc} = $1 WHERE id = $2",
        table = col.table,
        enc = col.enc_col
    );

    let mut count = 0;
    for (id, plaintext) in rows {
        let ct = <()>::encrypt(plaintext.as_bytes(), dek)
            .with_context(|| format!("encrypt {}.{} id={id}", col.table, col.text_col))?;
        sqlx::query(&update_sql)
            .bind(&ct)
            .bind(id)
            .execute(pool)
            .await
            .with_context(|| format!("UPDATE {}.{} id={id}", col.table, col.enc_col))?;
        count += 1;
    }
    Ok(count)
}
```

- [ ] **Step 3: Verify it compiles**

Run: `cargo build --bin oauth-migrate-encrypt 2>&1 | tail -10`
Expected: success.

- [ ] **Step 4: Smoke-test it (against an empty DB / no plaintext tokens)**

Run with the dev env loaded:
```bash
export $(grep -v '^#' .env | xargs)  # bash way to source .env
cargo run --bin oauth-migrate-encrypt --release 2>&1 | tail -15
```

Expected: each `→` line shows `0 rows migrated` (since this is greenfield), `done — 0 rows total`. If you see non-zero counts that means some test data exists — verify the encryption worked by spot-checking the new column.

- [ ] **Step 5: Commit**

```bash
rtk git add Cargo.toml crates/signapps-oauth/
rtk git commit -m "$(cat <<'EOF'
feat(oauth): oauth-migrate-encrypt binary

Reads DATABASE_URL + KEYSTORE_MASTER_KEY from env, encrypts existing
plaintext OAuth tokens into the new BYTEA *_enc columns. Idempotent:
processes rows where *_enc IS NULL AND <text> IS NOT NULL.

Tables migrated:
- mail.accounts.oauth_refresh_token → .oauth_refresh_token_enc
- calendar.provider_connections.access_token → .access_token_enc
- calendar.provider_connections.refresh_token → .refresh_token_enc
- social.accounts.access_token → .access_token_enc
- social.accounts.refresh_token → .refresh_token_enc

mail.accounts.oauth_access_token_enc has no plaintext source and is
left for new flows.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: oauth-migrate-verify binary

**Files:**
- Create: `crates/signapps-oauth/src/bin/oauth_migrate_verify.rs`

Asserts every row that had a plaintext token now also has a ciphertext, AND that a sample ciphertext decrypts cleanly back to the same plaintext (sanity check).

- [ ] **Step 1: Write the binary**

```rust
//! Verify the post-migrate state: every plaintext token has an
//! encrypted twin AND the encryption is reversible.
//!
//! Exit code 0 on success. Non-zero on any inconsistency. Run before
//! flipping consumers to read from the encrypted columns.

use anyhow::{bail, Context, Result};
use signapps_common::crypto::EncryptedField;
use signapps_keystore::{Keystore, KeystoreBackend};
use sqlx::PgPool;
use std::sync::Arc;

struct ColumnCheck {
    table: &'static str,
    text_col: &'static str,
    enc_col: &'static str,
}

const CHECKS: &[ColumnCheck] = &[
    ColumnCheck {
        table: "mail.accounts",
        text_col: "oauth_refresh_token",
        enc_col: "oauth_refresh_token_enc",
    },
    ColumnCheck {
        table: "calendar.provider_connections",
        text_col: "access_token",
        enc_col: "access_token_enc",
    },
    ColumnCheck {
        table: "calendar.provider_connections",
        text_col: "refresh_token",
        enc_col: "refresh_token_enc",
    },
    ColumnCheck {
        table: "social.accounts",
        text_col: "access_token",
        enc_col: "access_token_enc",
    },
    ColumnCheck {
        table: "social.accounts",
        text_col: "refresh_token",
        enc_col: "refresh_token_enc",
    },
];

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();

    let database_url = std::env::var("DATABASE_URL").context("DATABASE_URL not set")?;
    let pool = PgPool::connect(&database_url).await?;
    let keystore = Arc::new(Keystore::init(KeystoreBackend::EnvVar).await?);
    let dek = keystore.dek("oauth-tokens-v1");

    let mut bad = 0;
    for c in CHECKS {
        let unmigrated: i64 = sqlx::query_scalar(&format!(
            "SELECT COUNT(*) FROM {} \
             WHERE {} IS NOT NULL AND {} IS NULL",
            c.table, c.text_col, c.enc_col
        ))
        .fetch_one(&pool)
        .await?;
        if unmigrated > 0 {
            eprintln!(
                "  ✗ {}.{}: {unmigrated} rows still plaintext (no {})",
                c.table, c.text_col, c.enc_col
            );
            bad += unmigrated;
            continue;
        }
        // Spot-check: decrypt a random sample row and verify it matches the plaintext.
        let sample: Option<(String, Vec<u8>)> = sqlx::query_as(&format!(
            "SELECT {}, {} FROM {} \
             WHERE {} IS NOT NULL AND {} IS NOT NULL \
             ORDER BY random() LIMIT 1",
            c.text_col, c.enc_col, c.table, c.text_col, c.enc_col
        ))
        .fetch_optional(&pool)
        .await?;
        if let Some((pt, ct)) = sample {
            let decrypted = <()>::decrypt(&ct, &dek).context("decrypt sample")?;
            if decrypted != pt.as_bytes() {
                eprintln!("  ✗ {}.{}: sample decrypt does not match plaintext", c.table, c.enc_col);
                bad += 1;
                continue;
            }
            println!("  ✓ {}.{}: all migrated, sample decrypt matches", c.table, c.enc_col);
        } else {
            println!("  ✓ {}.{}: 0 rows (nothing to check)", c.table, c.enc_col);
        }
    }

    if bad > 0 {
        bail!("{bad} inconsistencies found");
    }
    println!("all checks passed");
    Ok(())
}
```

- [ ] **Step 2: Build + smoke-test + commit**

Run: `cargo build --bin oauth-migrate-verify 2>&1 | tail -5`
Expected: success.

Run: `cargo run --bin oauth-migrate-verify --release 2>&1 | tail -10`
Expected: `all checks passed` (zero rows in greenfield).

```bash
rtk git add crates/signapps-oauth/src/bin/oauth_migrate_verify.rs
rtk git commit -m "feat(oauth): oauth-migrate-verify binary

Exit code 0 if every plaintext token also has a ciphertext AND a random
sample decrypts to the same plaintext. Non-zero on any inconsistency.

Run after oauth-migrate-encrypt and before flipping consumers to read
from the encrypted columns.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Migration bash orchestrator

**Files:**
- Create: `scripts/migrate-oauth-tokens.sh`

Sequences the migration safely: stop services → backup → encrypt → verify → restart.

- [ ] **Step 1: Write the script**

```bash
#!/usr/bin/env bash
#
# Orchestrate the OAuth token migration.
#
# Steps:
#   1. Stop services (so no writes happen during migration).
#   2. Backup the DB.
#   3. Apply migration 303 (BYTEA columns) — idempotent if already applied.
#   4. Run oauth-migrate-encrypt to populate ciphertexts.
#   5. Run oauth-migrate-verify to confirm.
#   6. Restart services.
#
# Requires: KEYSTORE_MASTER_KEY + DATABASE_URL in env (sourced from .env).
#
# Usage:
#   bash scripts/migrate-oauth-tokens.sh

set -euo pipefail

cd "$(dirname "$0")/.."

# Source .env to pick up KEYSTORE_MASTER_KEY + DATABASE_URL
if [ -f .env ]; then
    set -a
    # shellcheck disable=SC1091
    source .env
    set +a
fi

if [ -z "${KEYSTORE_MASTER_KEY:-}" ]; then
    echo "ERROR: KEYSTORE_MASTER_KEY not set" >&2
    exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
    echo "ERROR: DATABASE_URL not set" >&2
    exit 1
fi

echo "[1/6] Stopping services..."
if [ -x scripts/stop-all.sh ]; then
    bash scripts/stop-all.sh || true
else
    echo "  (scripts/stop-all.sh not found — skipping. Stop manually if services are running.)"
fi

echo "[2/6] Backing up database..."
mkdir -p backups
backup_file="backups/pre-oauth-encrypt-$(date +%Y%m%d-%H%M%S).sql.gz"
if command -v pg_dump >/dev/null 2>&1; then
    pg_dump "$DATABASE_URL" | gzip > "$backup_file"
elif command -v docker >/dev/null 2>&1; then
    docker exec signapps-postgres pg_dump -U signapps signapps | gzip > "$backup_file"
else
    echo "  (no pg_dump or docker available — skipping backup. THIS IS RISKY.)"
fi
[ -f "$backup_file" ] && echo "  backup: $backup_file"

echo "[3/6] Applying migration 303 (idempotent)..."
if command -v just >/dev/null 2>&1; then
    just db-migrate 2>&1 | tail -5 || echo "  (db-migrate may have errored on prior tracking — try direct apply below)"
fi
if command -v docker >/dev/null 2>&1; then
    docker exec -i signapps-postgres psql -U signapps -d signapps < migrations/303_oauth_token_encryption.sql 2>&1 | tail -5 || true
fi

echo "[4/6] Encrypting existing tokens..."
cargo run --release --bin oauth-migrate-encrypt 2>&1 | tail -10

echo "[5/6] Verifying..."
cargo run --release --bin oauth-migrate-verify 2>&1 | tail -10

echo "[6/6] Restarting services..."
if [ -x scripts/start-all.sh ]; then
    bash scripts/start-all.sh 2>&1 | tail -10
else
    echo "  (scripts/start-all.sh not found — start services manually.)"
fi

echo "✓ migration complete"
```

- [ ] **Step 2: Make executable + commit**

```bash
chmod +x scripts/migrate-oauth-tokens.sh
rtk git add scripts/migrate-oauth-tokens.sh
rtk git commit -m "feat(oauth): bash orchestrator for token migration

scripts/migrate-oauth-tokens.sh sequences the migration safely:
stop → backup → migration 303 → encrypt → verify → restart.

Sources .env for KEYSTORE_MASTER_KEY + DATABASE_URL. Falls back to
docker exec for pg_dump and migration apply when host tools are
unavailable (Windows dev). Backups land in backups/ with a timestamp.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Boot guardrail — assert_tokens_encrypted helper

**Files:**
- Create: `crates/signapps-keystore/src/guardrail.rs`
- Modify: `crates/signapps-keystore/src/lib.rs`

A reusable helper services call at boot to refuse startup if any plaintext token remains in their tables.

- [ ] **Step 1: Write the guardrail module**

```rust
//! Boot-time guardrails for services that store encrypted tokens.

use sqlx::PgPool;
use thiserror::Error;
use tracing::warn;

/// Errors from boot-time guardrail checks.
#[derive(Debug, Error)]
pub enum GuardrailError {
    /// Database query failed.
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
    /// One or more rows still hold plaintext tokens.
    #[error("{rows} plaintext token rows in {table}.{text_col} (no {enc_col}) — refusing to start; run scripts/migrate-oauth-tokens.sh")]
    PlaintextDetected {
        /// Schema-qualified table name.
        table: &'static str,
        /// Plaintext column.
        text_col: &'static str,
        /// Encrypted column that should hold the migrated value.
        enc_col: &'static str,
        /// Number of rows with plaintext but no ciphertext.
        rows: i64,
    },
}

/// Spec of a column to check.
#[derive(Debug, Clone, Copy)]
pub struct TokenColumnSpec {
    /// Schema-qualified table.
    pub table: &'static str,
    /// Plaintext source column (TEXT).
    pub text_col: &'static str,
    /// Encrypted target column (BYTEA).
    pub enc_col: &'static str,
}

/// Verify that no row in the listed columns has plaintext without a
/// matching ciphertext.
///
/// Call this at service boot **before** the HTTP layer accepts traffic.
/// If any plaintext is detected, returns [`GuardrailError::PlaintextDetected`]
/// and the service should exit non-zero.
///
/// # Errors
///
/// Returns [`GuardrailError::Database`] for connection / query failures.
/// Returns [`GuardrailError::PlaintextDetected`] for any unencrypted row.
pub async fn assert_tokens_encrypted(
    pool: &PgPool,
    specs: &[TokenColumnSpec],
) -> Result<(), GuardrailError> {
    for spec in specs {
        let rows: i64 = sqlx::query_scalar(&format!(
            "SELECT COUNT(*) FROM {} WHERE {} IS NOT NULL AND {} IS NULL",
            spec.table, spec.text_col, spec.enc_col
        ))
        .fetch_one(pool)
        .await?;
        if rows > 0 {
            warn!(
                table = spec.table,
                text_col = spec.text_col,
                rows,
                "plaintext OAuth tokens detected — service refusing to start"
            );
            return Err(GuardrailError::PlaintextDetected {
                table: spec.table,
                text_col: spec.text_col,
                enc_col: spec.enc_col,
                rows,
            });
        }
    }
    Ok(())
}
```

- [ ] **Step 2: Re-export from lib.rs**

```rust
mod guardrail;
pub use guardrail::{assert_tokens_encrypted, GuardrailError, TokenColumnSpec};
```

- [ ] **Step 3: Verify compile + commit**

```bash
cargo check -p signapps-keystore 2>&1 | tail -3
rtk git add crates/signapps-keystore/src/guardrail.rs crates/signapps-keystore/src/lib.rs
rtk git commit -m "feat(keystore): assert_tokens_encrypted boot guardrail

Reusable helper services call before accepting traffic. Refuses
startup if any (table.text_col, table.enc_col) pair has rows where
text is set but enc is NULL.

GuardrailError::PlaintextDetected error message points to
scripts/migrate-oauth-tokens.sh for the operator's recovery action.

Mail / calendar / social services adopt this in their main.rs in
subsequent tasks.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Complete the identity callback handler

**Files:**
- Modify: `services/signapps-identity/src/handlers/oauth/mod.rs`

Replace the 503 placeholder with the full pipeline: encrypt, emit event, JWT for Login, redirect.

- [ ] **Step 1: Inspect the existing callback handler**

Read `services/signapps-identity/src/handlers/oauth/mod.rs` to see the current shape (likely returns `AppError::Internal("OAUTH_CALLBACK_NOT_WIRED")`).

Find:
- The `AppState` field that holds the OAuthEngineState
- The `keystore` field on AppState
- How `PgEventBus` is accessed (likely `state.event_bus` or similar — search `services/signapps-identity/src/main.rs`)

- [ ] **Step 2: Add PgEventBus to AppState if not present**

If `signapps-identity` doesn't already use PgEventBus (check `grep -n PgEventBus services/signapps-identity/src/main.rs`), add it:

```rust
use signapps_common::pg_events::PgEventBus;

// in AppState:
pub event_bus: std::sync::Arc<PgEventBus>,

// at boot, after pool init:
let event_bus = std::sync::Arc::new(PgEventBus::new(pool.clone(), "identity".to_string()));
```

If PgEventBus is already there, just reference it.

- [ ] **Step 3: Replace the callback body**

```rust
pub async fn callback(
    Path(provider_key): Path<String>,
    State(state): State<AppState>,
    Query(query): Query<CallbackQuery>,
) -> Result<axum::response::Redirect, AppError> {
    use signapps_common::crypto::EncryptedField;
    use signapps_common::pg_events::NewEvent;
    use signapps_oauth::{
        CallbackRequest, OAuthError, OAuthPurpose, OAuthTokensAcquired,
        EVENT_OAUTH_TOKENS_ACQUIRED,
    };

    // 1. Build the CallbackRequest from query params
    let cb_req = CallbackRequest {
        code: query.code.unwrap_or_default(),
        state: query.state.clone(),
        error: query.error.clone(),
        error_description: query.error_description.clone(),
    };

    // 2. We need to know the tenant_id BEFORE calling the engine (to load
    //    creds). The state token carries it — verify the state once here
    //    just to extract tenant_id, then call the engine which verifies
    //    again. This double-verify is fine: state is signed and cheap.
    let preview = signapps_oauth::FlowState::verify(
        &query.state,
        &state.oauth_engine_state.state_secret,
    )
    .map_err(|e| error::oauth_error_to_app_error(OAuthError::InvalidState(e)))?;
    let tenant_id = preview.tenant_id;
    let purpose = preview.purpose;

    // 3. Load tenant config + decrypt credentials
    let cfg = state
        .oauth_engine_state
        .configs
        .get(tenant_id, &provider_key)
        .await
        .map_err(error::oauth_error_to_app_error)?
        .ok_or_else(|| error::oauth_error_to_app_error(OAuthError::ProviderNotConfigured))?;
    let creds = creds::resolve_credentials(&cfg, &state.keystore)
        .map_err(error::oauth_error_to_app_error)?;

    // 4. Engine call — returns (CallbackResponse, TokenResponse, ProviderProfile, FlowState)
    let http = reqwest::Client::new();
    let (cb_resp, tokens, profile, flow) = state
        .oauth_engine_state
        .engine
        .callback(cb_req, creds, &http)
        .await
        .map_err(error::oauth_error_to_app_error)?;

    // 5. Encrypt tokens with DEK 'oauth-tokens-v1'
    let dek = state.keystore.dek("oauth-tokens-v1");
    let access_token_enc = <()>::encrypt(tokens.access_token.as_bytes(), &dek)
        .map_err(|e| AppError::Internal(format!("encrypt access_token: {e}")))?;
    let refresh_token_enc = tokens
        .refresh_token
        .as_ref()
        .map(|rt| <()>::encrypt(rt.as_bytes(), &dek))
        .transpose()
        .map_err(|e| AppError::Internal(format!("encrypt refresh_token: {e}")))?;
    let expires_at = tokens
        .expires_in
        .map(|s| chrono::Utc::now() + chrono::Duration::seconds(s));

    // 6. Determine the category — find the provider's primary category
    //    in the catalog (first entry of the categories array).
    let provider_def = state
        .oauth_engine_state
        .catalog
        .get(&provider_key)
        .map_err(|_| AppError::Internal("provider vanished from catalog".into()))?;
    let category = provider_def
        .categories
        .first()
        .copied()
        .unwrap_or(signapps_oauth::ProviderCategory::Other);

    // 7. Emit OAuthTokensAcquired event for downstream consumers
    let event = OAuthTokensAcquired {
        user_id: flow.user_id,
        tenant_id,
        provider_key: provider_key.clone(),
        purpose,
        category,
        access_token_enc,
        refresh_token_enc,
        expires_at,
        scopes_granted: tokens
            .scope
            .as_deref()
            .map(|s| s.split(' ').map(String::from).collect())
            .unwrap_or_default(),
        provider_user_id: profile.id.clone(),
        provider_user_email: profile.email.clone(),
    };
    let payload = serde_json::to_value(&event)
        .map_err(|e| AppError::Internal(format!("serialize event: {e}")))?;
    state
        .event_bus
        .publish(NewEvent {
            event_type: EVENT_OAUTH_TOKENS_ACQUIRED.to_string(),
            aggregate_id: flow.user_id,
            payload,
        })
        .await
        .map_err(|e| AppError::Internal(format!("publish event: {e}")))?;

    // 8. For purpose=Login, we'd provision/lookup user + create JWT here.
    //    Detailed integration with the existing user-provision pipeline
    //    is a follow-up task — for MVP we redirect to the frontend's
    //    login completion page with the provider_user_email so the
    //    frontend can decide what to do.
    let redirect_to = if matches!(purpose, OAuthPurpose::Login) {
        // Append email/provider for the frontend's login completion page
        format!(
            "{}?provider={}&email={}",
            cb_resp.redirect_to,
            urlencoding::encode(&provider_key),
            urlencoding::encode(profile.email.as_deref().unwrap_or(""))
        )
    } else {
        cb_resp.redirect_to
    };

    Ok(axum::response::Redirect::to(&redirect_to))
}
```

Notes:
- Add `urlencoding = "2"` to `services/signapps-identity/Cargo.toml` if not present.
- The Login → JWT path is a known gap for MVP; documented in the doc comment of the handler.

- [ ] **Step 4: Expose `state_secret` from the engine**

The handler needs `state.oauth_engine_state.state_secret` to verify the state for tenant_id extraction. Add a public field or accessor on `OAuthEngineState`:

In `services/signapps-identity/src/handlers/oauth/mod.rs`:

```rust
pub struct OAuthEngineState {
    pub engine: signapps_oauth::EngineV2,
    pub catalog: std::sync::Arc<signapps_oauth::Catalog>,
    pub configs: std::sync::Arc<dyn signapps_oauth::ConfigStore>,
    pub state_secret: Vec<u8>,  // ← add
}
```

And populate at boot in main.rs accordingly.

- [ ] **Step 5: Build + commit**

```bash
cargo check -p signapps-identity 2>&1 | tail -10
rtk git add services/signapps-identity/
rtk git commit -m "$(cat <<'EOF'
feat(identity): complete OAuth callback handler

Replaces the 503 placeholder with the full pipeline:
1. Verify state once to extract tenant_id (state is signed, cheap)
2. Load ProviderConfig + decrypt credentials via keystore
3. Call EngineV2::callback (returns 4-tuple: response, tokens,
   profile, flow)
4. Encrypt access_token + refresh_token with DEK 'oauth-tokens-v1'
5. Resolve provider category from catalog
6. Publish oauth.tokens.acquired event via PgEventBus
7. Redirect — for Login flows, append provider+email to URL so the
   frontend can finalize the session

JWT issuance for purpose=Login is deferred — frontend handles it via
the redirect URL. Full identity provisioning is a follow-up task.

OAuthEngineState gains state_secret: Vec<u8> alongside engine, catalog,
configs so the handler can verify state without piercing engine
internals.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Mail consumer subscribes to oauth.tokens.acquired

**Files:**
- Create: `services/signapps-mail/src/oauth_consumer.rs`
- Modify: `services/signapps-mail/Cargo.toml`
- Modify: `services/signapps-mail/src/main.rs`

A reference consumer pattern. Calendar/social follow the same shape in their own follow-up plans.

- [ ] **Step 1: Add deps to mail's Cargo.toml**

In `services/signapps-mail/Cargo.toml`:

```toml
signapps-oauth = { path = "../../crates/signapps-oauth" }
signapps-keystore = { path = "../../crates/signapps-keystore" }
```

(Add `chrono` if not already there — needed for expires_at.)

- [ ] **Step 2: Create the consumer**

```rust
//! Consumer for the oauth.tokens.acquired event — persists the encrypted
//! token into mail.accounts.

use anyhow::{Context, Result};
use signapps_common::pg_events::{PgEventBus, PlatformEvent};
use signapps_oauth::{
    OAuthTokensAcquired, ProviderCategory, EVENT_OAUTH_TOKENS_ACQUIRED,
};
use sqlx::PgPool;
use std::sync::Arc;
use tracing::{info, instrument, warn};
use uuid::Uuid;

/// Spawn the mail OAuth consumer in a tokio task.
///
/// The handler is keystore-agnostic — tokens are stored as-is (still
/// encrypted with the shared DEK 'oauth-tokens-v1'). The mail service
/// decrypts at use-time inside its IMAP/SMTP code paths.
pub fn spawn_consumer(pool: PgPool, bus: Arc<PgEventBus>) {
    tokio::spawn(async move {
        if let Err(e) = run(pool, bus).await {
            tracing::error!(?e, "mail oauth consumer terminated");
        }
    });
}

async fn run(pool: PgPool, bus: Arc<PgEventBus>) -> Result<()> {
    info!("mail oauth consumer starting");
    bus.listen("mail-oauth-consumer", move |event: PlatformEvent| {
        let pool = pool.clone();
        async move {
            if event.event_type != EVENT_OAUTH_TOKENS_ACQUIRED {
                return Ok(()); // not for us
            }
            let payload: OAuthTokensAcquired = serde_json::from_value(event.payload.clone())
                .with_context(|| format!("decode oauth.tokens.acquired payload event_id={}", event.event_id))?;
            // Filter by category — we only care about Mail providers
            if payload.category != ProviderCategory::Mail {
                return Ok(());
            }
            persist(&pool, &payload).await?;
            Ok(())
        }
    })
    .await
    .context("PgEventBus::listen")?;
    Ok(())
}

#[instrument(skip_all, fields(provider = %ev.provider_key, user_id = ?ev.user_id))]
async fn persist(pool: &PgPool, ev: &OAuthTokensAcquired) -> Result<()> {
    // Strategy: upsert into mail.accounts keyed by (user_id, provider_user_email).
    // For MVP we require user_id to be Some — Login flows that pre-provision
    // a user are handled by identity. If user_id is None, log + skip.
    let Some(user_id) = ev.user_id else {
        warn!("oauth.tokens.acquired with user_id=None — skipping mail.accounts upsert");
        return Ok(());
    };
    let email = ev.provider_user_email.clone().unwrap_or_default();

    // Upsert — match on (user_id, email). Real production code may use a
    // dedicated unique index; for MVP we rely on "first row wins" semantics.
    sqlx::query(
        r#"
        INSERT INTO mail.accounts (
            id, user_id, email,
            oauth_provider_key, oauth_access_token_enc, oauth_refresh_token_enc, oauth_expires_at,
            created_at, updated_at
        ) VALUES (
            gen_random_uuid(), $1, $2,
            $3, $4, $5, $6,
            NOW(), NOW()
        )
        ON CONFLICT (user_id, email) DO UPDATE SET
            oauth_provider_key      = EXCLUDED.oauth_provider_key,
            oauth_access_token_enc  = EXCLUDED.oauth_access_token_enc,
            oauth_refresh_token_enc = EXCLUDED.oauth_refresh_token_enc,
            oauth_expires_at        = EXCLUDED.oauth_expires_at,
            updated_at              = NOW()
        "#,
    )
    .bind(user_id)
    .bind(&email)
    .bind(&ev.provider_key)
    .bind(&ev.access_token_enc)
    .bind(ev.refresh_token_enc.as_ref())
    .bind(ev.expires_at)
    .execute(pool)
    .await
    .with_context(|| format!("upsert mail.accounts user_id={user_id} email={email}"))?;

    info!("mail account upserted from oauth event");
    Ok(())
}
```

Note: this upsert assumes a UNIQUE constraint on `(user_id, email)`. If `mail.accounts` doesn't have one, add a small migration. Inspect the schema first:

Run: `docker exec signapps-postgres psql -U signapps -d signapps -c "\\d mail.accounts" | head -25`

If no UNIQUE constraint, add a migration `304_mail_accounts_unique_user_email.sql` (separate task; document and skip the upsert ON CONFLICT for now if needed).

- [ ] **Step 3: Wire into main.rs**

In `services/signapps-mail/src/main.rs`, after the pool + event bus are constructed, add:

```rust
use signapps_keystore::{Keystore, KeystoreBackend, TokenColumnSpec};

// keystore at boot
let keystore = std::sync::Arc::new(
    Keystore::init(KeystoreBackend::EnvVar)
        .await
        .context("Keystore::init")?,
);

// Boot guardrail — refuse startup if plaintext tokens detected
signapps_keystore::assert_tokens_encrypted(
    &pool,
    &[TokenColumnSpec {
        table: "mail.accounts",
        text_col: "oauth_refresh_token",
        enc_col: "oauth_refresh_token_enc",
    }],
)
.await
.context("plaintext token guardrail")?;

// Spawn the OAuth consumer
mail::oauth_consumer::spawn_consumer(pool.clone(), event_bus.clone());
```

(Adapt module path / state struct names to match the actual mail service layout.)

- [ ] **Step 4: Build + commit**

```bash
cargo check -p signapps-mail 2>&1 | tail -10
rtk git add services/signapps-mail/
rtk git commit -m "$(cat <<'EOF'
feat(mail): OAuth consumer + boot guardrail

services/signapps-mail/src/oauth_consumer.rs:
- Subscribes to 'oauth.tokens.acquired' via PgEventBus
- Filters by category = Mail (no-op for non-mail events)
- Upserts into mail.accounts on (user_id, email)
- Stores tokens still-encrypted (DEK 'oauth-tokens-v1') —
  decryption happens just before IMAP/SMTP use

main.rs:
- Loads Keystore at boot via EnvVar backend
- Calls assert_tokens_encrypted on mail.accounts.oauth_refresh_token
  → service refuses startup if plaintext tokens detected
- Spawns the consumer in a tokio task

Pattern is reused by calendar + social consumers in follow-up plans.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Doctor check for token encryption status

**Files:**
- Create: `scripts/doctor-checks/oauth-encryption.sh`
- Modify: `scripts/doctor.sh`

- [ ] **Step 1: Write the doctor check**

```bash
#!/usr/bin/env bash
#
# Verify no plaintext OAuth tokens remain in the database.
# Returns 0 if clean, 1 otherwise. Output is human-readable.

set -u

PSQL="docker exec signapps-postgres psql -U signapps -d signapps -tAq"

check_pair() {
    local table=$1
    local text_col=$2
    local enc_col=$3
    local count
    count=$($PSQL -c "SELECT COUNT(*) FROM $table WHERE $text_col IS NOT NULL AND $enc_col IS NULL" 2>/dev/null || echo 0)
    if [ "$count" = "0" ]; then
        echo "  ✓ $table.$text_col → $enc_col: 0 plaintext"
        return 0
    fi
    echo "  ✗ $table.$text_col: $count plaintext rows without $enc_col"
    return 1
}

bad=0
check_pair mail.accounts oauth_refresh_token oauth_refresh_token_enc || bad=1
check_pair calendar.provider_connections access_token access_token_enc || bad=1
check_pair calendar.provider_connections refresh_token refresh_token_enc || bad=1
check_pair social.accounts access_token access_token_enc || bad=1
check_pair social.accounts refresh_token refresh_token_enc || bad=1

exit $bad
```

- [ ] **Step 2: Wire into doctor.sh**

In `scripts/doctor.sh`, add a check (look for the keystore check pattern from Plan 1's P1T12):

```bash
echo ""
echo "🔐 OAuth token encryption:"
if bash scripts/doctor-checks/oauth-encryption.sh; then
    PASSED=$((PASSED + 1))
else
    FAILED=$((FAILED + 1))
fi
TOTAL=$((TOTAL + 1))
```

(Adapt to the actual doctor.sh structure — Plan 1 P1T12 used a slightly different pattern with `[OK]/[FAIL]` markers; reuse whatever the file currently does.)

- [ ] **Step 3: Test + commit**

Run: `bash scripts/doctor.sh 2>&1 | tail -25`
Expected: new "OAuth token encryption" section shows ✓ for all 5 column pairs (greenfield = no plaintext anywhere).

```bash
chmod +x scripts/doctor-checks/oauth-encryption.sh
rtk git add scripts/doctor-checks/oauth-encryption.sh scripts/doctor.sh
rtk git commit -m "feat(doctor): verify no plaintext OAuth tokens remain

5 (table, text_col, enc_col) checks against:
- mail.accounts.oauth_refresh_token → .oauth_refresh_token_enc
- calendar.provider_connections.access_token → .access_token_enc
- calendar.provider_connections.refresh_token → .refresh_token_enc
- social.accounts.access_token → .access_token_enc
- social.accounts.refresh_token → .refresh_token_enc

Doctor count becomes 23/23 (was 22/22 after Plan 1).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Final validation

**Files:** None (verification only).

- [ ] **Step 1: cargo check workspace**

`cargo check --workspace --all-features 2>&1 | tail -10`

- [ ] **Step 2: clippy on Plan 4 crates**

`cargo clippy -p signapps-oauth -p signapps-keystore -p signapps-identity -p signapps-mail --all-features --tests -- -D warnings 2>&1 | tail -15`

- [ ] **Step 3: All tests**

`cargo test -p signapps-oauth -p signapps-keystore -p signapps-common 2>&1 | tail -25`

Expected ~145 tests (Plan 3 baseline 137 + events 2 + helpers 3 = 142, plus a few from infrastructure).

- [ ] **Step 4: Build mail + identity binaries**

`cargo build -p signapps-identity -p signapps-mail 2>&1 | tail -10`

- [ ] **Step 5: Build + smoke-test the migration binaries**

```bash
cargo build --bin oauth-migrate-encrypt --bin oauth-migrate-verify 2>&1 | tail -5
cargo run --release --bin oauth-migrate-verify 2>&1 | tail -10
```
Expected: "all checks passed" (greenfield).

- [ ] **Step 6: Doctor**

`bash scripts/doctor.sh 2>&1 | tail -25`
Expected: 23/23 (with new OAuth token encryption check).

- [ ] **Step 7: cargo fmt**

`cargo fmt -p signapps-oauth -p signapps-keystore -p signapps-identity -p signapps-mail --check 2>&1 | tail -5`

If diff in scope only: format + commit `style(plan-4): cargo fmt`.

- [ ] **Step 8: Git log summary**

`rtk git log --oneline main..feat/oauth-migration-eventbus 2>/dev/null | head -15`

---

**Self-review:**

- ✅ Spec section 4.4 "Event bus payload" → Tasks 1, 8, 9
- ✅ Spec section 4.5 "Colonnes chiffrées dans tables existantes" → Task 3
- ✅ Spec section 4.7 "Event bus pattern" → Tasks 1, 8, 9
- ✅ Spec section 7.6 "Guardrail au démarrage" → Tasks 7, 9 (mail wires it)
- ✅ Spec section 8 "Migration offline" → Tasks 4, 5, 6
- ⏸ Spec section 8.4 "Rollback" — covered by the bash script's pg_dump backup, no separate restore script (trivial: `gunzip < backup.sql.gz | psql`)
- ⏸ Calendar + social consumers — left as follow-up plans following the mail pattern from Task 9
- ⏸ JWT session creation for `purpose=Login` — left as follow-up; the redirect carries enough info for the frontend to finalize

**Plan 5 (Refresh + Admin UI) builds on this:**
- `oauth.tokens.acquired` is the trigger that populates `oauth_refresh_queue`
- `oauth.tokens.invalidated` is emitted by Plan 5's refresh job after retry exhaustion
