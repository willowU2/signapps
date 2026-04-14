# OAuth Token Refresh Implementation Plan (Plan 5 of 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement OAuth token refresh — both the proactive scheduler (push every 5 min, refresh tokens expiring < 15 min) and the lazy pull (`checkout_token` called by services just before API use). On retry exhaustion, emit `oauth.tokens.invalidated` so consumers can mark accounts as needing reconnection.

**Architecture:**

```
oauth_refresh_queue (denormalized view)
  ├─ Maintained by triggers on mail.accounts, calendar.provider_connections,
  │  social.accounts (INSERT/UPDATE/DELETE → upsert into queue)
  ├─ Tracks: source_table, source_id, expires_at, consecutive_failures,
  │  disabled, last_error, last_refresh_attempt_at
  └─ Single source of truth for the scanner

OAuthRefreshJob (tokio task in signapps-identity)
  ├─ Wakes every 5 min
  ├─ SELECT rows expiring < 15 min, not disabled, not retried in last 2 min
  ├─ For each row (parallelism bounded to 10):
  │   ├─ Load creds for the (tenant, provider) pair (decrypt via keystore)
  │   ├─ Load refresh_token from source_table (decrypt)
  │   ├─ POST to provider's refresh_url
  │   ├─ Parse new TokenResponse
  │   ├─ Encrypt + UPDATE source_table.{access_token_enc, refresh_token_enc, expires_at}
  │   └─ Reset consecutive_failures, last_error
  ├─ On 4xx (refresh_token revoked): disabled = true immediately
  ├─ On network/5xx: consecutive_failures += 1
  └─ On consecutive_failures >= 10 OR disabled: emit oauth.tokens.invalidated

checkout_token(table, id) (called by service handlers right before API use)
  ├─ Load row, check expires_at
  ├─ If > 60s ahead: decrypt access_token, return
  ├─ Else: POST /api/v1/oauth/internal/refresh (identity does the refresh)
  └─ Return the refreshed access_token + new expires_at
```

**Tech Stack:** Same as Plans 1-4 (no new crates). Tokio task + interval for the scheduler — no `tokio-cron-scheduler` dep needed for the simple every-5-min pattern.

**Dependencies:** Plans 1, 2, 3, 4 fully merged on `main`.

**Note on scope:**
- Refresh job lives **in signapps-identity** for MVP — extracting to a separate `signapps-scheduler` service is a follow-up. Identity already owns the OAuth pipeline + has the keystore + ConfigStore + catalog.
- Admin UI (`/admin/oauth-providers`, `/account/connections`) is **deferred to Plan 6** — separating UI work keeps this plan focused on backend correctness.

---

## File Structure

### Created
- `migrations/304_oauth_refresh_queue.sql` — queue table + triggers on 3 source tables
- `crates/signapps-oauth/src/refresh.rs` — `RefreshClient`, `RefreshOutcome`, refresh logic (HTTP POST + new TokenResponse handling)
- `crates/signapps-oauth/src/token_table.rs` — `TokenTable` trait + 3 impls (Mail, Calendar, Social)
- `services/signapps-identity/src/refresh_job.rs` — `OAuthRefreshJob` that wakes every 5 min
- `services/signapps-identity/src/handlers/oauth/internal_refresh.rs` — `POST /api/v1/oauth/internal/refresh`
- `crates/signapps-oauth/src/checkout.rs` — `checkout_token` helper for services
- `scripts/doctor-checks/oauth-refresh-queue.sh` — doctor check (queue size, disabled count)

### Modified
- `crates/signapps-oauth/src/lib.rs` — re-export refresh + token_table + checkout
- `services/signapps-identity/src/main.rs` — spawn the refresh job at boot
- `services/signapps-identity/src/handlers/oauth/mod.rs` — register internal_refresh route
- `scripts/doctor.sh` — invoke oauth-refresh-queue check
- `CLAUDE.md` — note in Shared Crate Conventions

---

## Task 1: oauth_refresh_queue table + triggers (migration 304)

**Files:**
- Create: `migrations/304_oauth_refresh_queue.sql`

The queue is a denormalized view alimented by triggers on the source tables. Single index on `expires_at` accelerates the scanner.

- [ ] **Step 1: Verify migration baseline**

Run: `ls migrations/ | sort -V | tail -3`
Expected: `303_oauth_token_encryption.sql` is the latest. Our new file is `304_oauth_refresh_queue.sql`.

- [ ] **Step 2: Write the migration**

```sql
-- Migration 304: OAuth refresh queue + maintenance triggers.
--
-- The queue is a denormalized view of (source_table, source_id, expires_at,
-- consecutive_failures, disabled) maintained by triggers on the underlying
-- token tables. Single source of truth for the scheduler that performs
-- refresh attempts every 5 minutes.

CREATE TABLE IF NOT EXISTS identity.oauth_refresh_queue (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_table             TEXT NOT NULL,            -- e.g., 'mail.accounts'
    source_id                UUID NOT NULL,
    tenant_id                UUID NOT NULL,
    user_id                  UUID NOT NULL,
    provider_key             TEXT NOT NULL,
    expires_at               TIMESTAMPTZ NOT NULL,
    last_refresh_attempt_at  TIMESTAMPTZ,
    consecutive_failures     INT NOT NULL DEFAULT 0,
    last_error               TEXT,
    disabled                 BOOLEAN NOT NULL DEFAULT false,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (source_table, source_id)
);

-- Hot scanner index: rows due for refresh, not disabled, not just-retried.
CREATE INDEX IF NOT EXISTS idx_oauth_refresh_queue_expiring
    ON identity.oauth_refresh_queue (expires_at)
    WHERE disabled = false AND consecutive_failures < 10;

-- ── Trigger function: maintain queue from any token-bearing table ────────────
CREATE OR REPLACE FUNCTION identity.sync_oauth_refresh_queue() RETURNS trigger AS $$
DECLARE
    v_table  TEXT := TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME;
    v_user_id UUID;
    v_tenant_id UUID;
    v_provider_key TEXT;
    v_expires_at TIMESTAMPTZ;
    v_has_refresh BOOLEAN;
BEGIN
    IF TG_OP = 'DELETE' THEN
        DELETE FROM identity.oauth_refresh_queue
         WHERE source_table = v_table AND source_id = OLD.id;
        RETURN OLD;
    END IF;

    -- Per-table extraction of (user_id, tenant_id, provider_key, expires_at,
    -- has_refresh). Using IF rather than dynamic SQL to keep PG happy.
    IF v_table = 'mail.accounts' THEN
        v_user_id      := NEW.user_id;
        v_tenant_id    := NEW.tenant_id;
        v_provider_key := COALESCE(NEW.oauth_provider_key, '');
        v_expires_at   := NEW.oauth_expires_at;
        v_has_refresh  := NEW.oauth_refresh_token_enc IS NOT NULL;
    ELSIF v_table = 'calendar.provider_connections' THEN
        v_user_id      := NEW.user_id;
        v_tenant_id    := NEW.tenant_id;
        v_provider_key := COALESCE(NEW.provider, '');
        v_expires_at   := NEW.expires_at;
        v_has_refresh  := NEW.refresh_token_enc IS NOT NULL;
    ELSIF v_table = 'social.accounts' THEN
        v_user_id      := NEW.user_id;
        v_tenant_id    := COALESCE(NEW.tenant_id, NEW.workspace_id);
        v_provider_key := COALESCE(NEW.platform, NEW.provider, '');
        v_expires_at   := NEW.expires_at;
        v_has_refresh  := NEW.refresh_token_enc IS NOT NULL;
    ELSE
        RAISE NOTICE 'sync_oauth_refresh_queue: unknown table %', v_table;
        RETURN NEW;
    END IF;

    -- Only enqueue rows that have a refresh token AND a known expiry.
    IF v_has_refresh AND v_expires_at IS NOT NULL THEN
        INSERT INTO identity.oauth_refresh_queue (
            source_table, source_id, tenant_id, user_id, provider_key, expires_at
        ) VALUES (
            v_table, NEW.id, v_tenant_id, v_user_id, v_provider_key, v_expires_at
        )
        ON CONFLICT (source_table, source_id) DO UPDATE
            SET expires_at           = EXCLUDED.expires_at,
                consecutive_failures = 0,
                last_error           = NULL,
                disabled             = false,
                updated_at           = NOW();
    ELSE
        -- Refresh token gone or expiry unknown — purge from queue
        DELETE FROM identity.oauth_refresh_queue
         WHERE source_table = v_table AND source_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── Triggers on the 3 token-bearing tables ───────────────────────────────────
DROP TRIGGER IF EXISTS sync_mail_accounts_refresh_queue ON mail.accounts;
CREATE TRIGGER sync_mail_accounts_refresh_queue
    AFTER INSERT OR UPDATE OR DELETE ON mail.accounts
    FOR EACH ROW EXECUTE FUNCTION identity.sync_oauth_refresh_queue();

DROP TRIGGER IF EXISTS sync_calendar_provider_connections_refresh_queue ON calendar.provider_connections;
CREATE TRIGGER sync_calendar_provider_connections_refresh_queue
    AFTER INSERT OR UPDATE OR DELETE ON calendar.provider_connections
    FOR EACH ROW EXECUTE FUNCTION identity.sync_oauth_refresh_queue();

DROP TRIGGER IF EXISTS sync_social_accounts_refresh_queue ON social.accounts;
CREATE TRIGGER sync_social_accounts_refresh_queue
    AFTER INSERT OR UPDATE OR DELETE ON social.accounts
    FOR EACH ROW EXECUTE FUNCTION identity.sync_oauth_refresh_queue();

-- updated_at trigger on the queue itself
DROP TRIGGER IF EXISTS oauth_refresh_queue_touch_updated_at ON identity.oauth_refresh_queue;
CREATE TRIGGER oauth_refresh_queue_touch_updated_at
    BEFORE UPDATE ON identity.oauth_refresh_queue
    FOR EACH ROW EXECUTE FUNCTION oauth_touch_updated_at();
```

**Adapt notes:**
- The trigger references column names (e.g., `NEW.oauth_provider_key`, `NEW.provider`, `NEW.platform`) that the implementer must verify against the actual schemas. Run `\d mail.accounts`, `\d calendar.provider_connections`, `\d social.accounts` first and adapt the column references to whatever the real columns are. Document any deviations.
- Some tables may not have `tenant_id` directly — `social.accounts` may use `workspace_id` instead. The COALESCE pattern handles that.

- [ ] **Step 3: Apply the migration**

Run:
```bash
docker exec -i signapps-postgres psql -U signapps -d signapps < migrations/304_oauth_refresh_queue.sql 2>&1 | tail -10
```

If errors mention undefined columns, the trigger function references columns that don't exist on the actual tables — adapt and re-apply. Report any adjustments.

- [ ] **Step 4: Verify the table + triggers exist**

```bash
docker exec signapps-postgres psql -U signapps -d signapps -c "\d identity.oauth_refresh_queue"
docker exec signapps-postgres psql -U signapps -d signapps -c "SELECT tgname FROM pg_trigger WHERE tgname LIKE 'sync_%refresh_queue'" 2>&1
```

Expected: 1 table + 3 triggers (one per source table).

- [ ] **Step 5: Commit**

```bash
rtk git add migrations/304_oauth_refresh_queue.sql
rtk git commit -m "$(cat <<'EOF'
feat(migrations): 304 — oauth_refresh_queue + maintenance triggers

Single denormalized view of (source_table, source_id, expires_at,
consecutive_failures, disabled) maintained by triggers on the
3 token-bearing tables (mail.accounts, calendar.provider_connections,
social.accounts).

The hot scanner index is partial (WHERE disabled = false AND
consecutive_failures < 10) — keeps it small as failures pile up.

Each trigger upserts/deletes the queue row based on whether the
NEW row has a refresh_token_enc AND an expires_at. Tables without
refresh tokens (e.g. github accounts) never enter the queue.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: TokenTable trait + 3 impls

**Files:**
- Create: `crates/signapps-oauth/src/token_table.rs`
- Modify: `crates/signapps-oauth/src/lib.rs`

A registry pattern so the refresh job stays generic. Adding a 4th token table = implementing `TokenTable` + registering — no changes to the scanner.

- [ ] **Step 1: Write the trait + impls**

```rust
//! Generic abstraction over per-service token tables.
//!
//! The refresh job uses this trait to load + update tokens without
//! hardcoding 3 separate code paths. Adding a 4th service that holds
//! tokens = implementing `TokenTable` + registering its concrete type
//! in the dispatch table at `OAuthRefreshJob::resolve_table`.

use crate::error::OAuthError;
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

/// Encrypted (access_token_enc, refresh_token_enc) pair plus expiry.
#[derive(Debug, Clone)]
pub struct EncryptedTokens {
    /// AES-GCM ciphertext of the access token.
    pub access_token_enc: Vec<u8>,
    /// AES-GCM ciphertext of the refresh token.
    pub refresh_token_enc: Vec<u8>,
    /// When the access token expires.
    pub expires_at: Option<DateTime<Utc>>,
}

/// Trait implemented by per-service token tables.
#[async_trait]
pub trait TokenTable: Send + Sync {
    /// Schema-qualified table name (e.g., "mail.accounts").
    fn name(&self) -> &'static str;

    /// Load (access, refresh) ciphertexts for a row.
    ///
    /// # Errors
    ///
    /// Returns `OAuthError::Database` on connection / query failures.
    /// Returns `OAuthError::MissingParameter("refresh_token")` if the row
    /// has no refresh_token_enc (cannot refresh).
    async fn load(&self, pool: &PgPool, id: Uuid) -> Result<EncryptedTokens, OAuthError>;

    /// Update access + refresh + expires_at after a successful refresh.
    ///
    /// # Errors
    ///
    /// Returns `OAuthError::Database` on failure.
    async fn update(
        &self,
        pool: &PgPool,
        id: Uuid,
        access_enc: &[u8],
        refresh_enc: &[u8],
        expires_at: DateTime<Utc>,
    ) -> Result<(), OAuthError>;
}

// ── Concrete impls ──────────────────────────────────────────────────────────

/// `mail.accounts` (oauth_access_token_enc, oauth_refresh_token_enc,
/// oauth_expires_at).
pub struct MailAccountsTable;

#[async_trait]
impl TokenTable for MailAccountsTable {
    fn name(&self) -> &'static str { "mail.accounts" }

    async fn load(&self, pool: &PgPool, id: Uuid) -> Result<EncryptedTokens, OAuthError> {
        let row = sqlx::query_as::<_, (Option<Vec<u8>>, Option<Vec<u8>>, Option<DateTime<Utc>>)>(
            "SELECT oauth_access_token_enc, oauth_refresh_token_enc, oauth_expires_at \
             FROM mail.accounts WHERE id = $1",
        )
        .bind(id)
        .fetch_one(pool)
        .await
        .map_err(|e| OAuthError::Database(e.to_string()))?;

        let access = row.0.ok_or_else(|| OAuthError::MissingParameter("oauth_access_token_enc".into()))?;
        let refresh = row.1.ok_or_else(|| OAuthError::MissingParameter("oauth_refresh_token_enc".into()))?;
        Ok(EncryptedTokens {
            access_token_enc: access,
            refresh_token_enc: refresh,
            expires_at: row.2,
        })
    }

    async fn update(
        &self,
        pool: &PgPool,
        id: Uuid,
        access_enc: &[u8],
        refresh_enc: &[u8],
        expires_at: DateTime<Utc>,
    ) -> Result<(), OAuthError> {
        sqlx::query(
            "UPDATE mail.accounts \
             SET oauth_access_token_enc = $1, oauth_refresh_token_enc = $2, \
                 oauth_expires_at = $3, updated_at = NOW() \
             WHERE id = $4",
        )
        .bind(access_enc)
        .bind(refresh_enc)
        .bind(expires_at)
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| OAuthError::Database(e.to_string()))?;
        Ok(())
    }
}

/// `calendar.provider_connections` (access_token_enc, refresh_token_enc,
/// expires_at).
pub struct CalendarConnectionsTable;

#[async_trait]
impl TokenTable for CalendarConnectionsTable {
    fn name(&self) -> &'static str { "calendar.provider_connections" }

    async fn load(&self, pool: &PgPool, id: Uuid) -> Result<EncryptedTokens, OAuthError> {
        let row = sqlx::query_as::<_, (Option<Vec<u8>>, Option<Vec<u8>>, Option<DateTime<Utc>>)>(
            "SELECT access_token_enc, refresh_token_enc, expires_at \
             FROM calendar.provider_connections WHERE id = $1",
        )
        .bind(id)
        .fetch_one(pool)
        .await
        .map_err(|e| OAuthError::Database(e.to_string()))?;
        let access = row.0.ok_or_else(|| OAuthError::MissingParameter("access_token_enc".into()))?;
        let refresh = row.1.ok_or_else(|| OAuthError::MissingParameter("refresh_token_enc".into()))?;
        Ok(EncryptedTokens { access_token_enc: access, refresh_token_enc: refresh, expires_at: row.2 })
    }

    async fn update(
        &self,
        pool: &PgPool,
        id: Uuid,
        access_enc: &[u8],
        refresh_enc: &[u8],
        expires_at: DateTime<Utc>,
    ) -> Result<(), OAuthError> {
        sqlx::query(
            "UPDATE calendar.provider_connections \
             SET access_token_enc = $1, refresh_token_enc = $2, \
                 expires_at = $3, updated_at = NOW() \
             WHERE id = $4",
        )
        .bind(access_enc)
        .bind(refresh_enc)
        .bind(expires_at)
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| OAuthError::Database(e.to_string()))?;
        Ok(())
    }
}

/// `social.accounts` (access_token_enc, refresh_token_enc, expires_at).
pub struct SocialAccountsTable;

#[async_trait]
impl TokenTable for SocialAccountsTable {
    fn name(&self) -> &'static str { "social.accounts" }

    async fn load(&self, pool: &PgPool, id: Uuid) -> Result<EncryptedTokens, OAuthError> {
        let row = sqlx::query_as::<_, (Option<Vec<u8>>, Option<Vec<u8>>, Option<DateTime<Utc>>)>(
            "SELECT access_token_enc, refresh_token_enc, expires_at \
             FROM social.accounts WHERE id = $1",
        )
        .bind(id)
        .fetch_one(pool)
        .await
        .map_err(|e| OAuthError::Database(e.to_string()))?;
        let access = row.0.ok_or_else(|| OAuthError::MissingParameter("access_token_enc".into()))?;
        let refresh = row.1.ok_or_else(|| OAuthError::MissingParameter("refresh_token_enc".into()))?;
        Ok(EncryptedTokens { access_token_enc: access, refresh_token_enc: refresh, expires_at: row.2 })
    }

    async fn update(
        &self,
        pool: &PgPool,
        id: Uuid,
        access_enc: &[u8],
        refresh_enc: &[u8],
        expires_at: DateTime<Utc>,
    ) -> Result<(), OAuthError> {
        sqlx::query(
            "UPDATE social.accounts \
             SET access_token_enc = $1, refresh_token_enc = $2, \
                 expires_at = $3, updated_at = NOW() \
             WHERE id = $4",
        )
        .bind(access_enc)
        .bind(refresh_enc)
        .bind(expires_at)
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| OAuthError::Database(e.to_string()))?;
        Ok(())
    }
}
```

**Adapt notes:** the actual `social.accounts` may not have `updated_at` — verify via `\d` and remove the `updated_at = NOW()` clause if it doesn't exist. Same for `calendar.provider_connections`.

- [ ] **Step 2: Re-export**

In `crates/signapps-oauth/src/lib.rs`:

```rust
pub mod token_table;
pub use token_table::{
    CalendarConnectionsTable, EncryptedTokens, MailAccountsTable, SocialAccountsTable, TokenTable,
};
```

- [ ] **Step 3: Compile + commit**

Run: `cargo check -p signapps-oauth 2>&1 | tail -5`
Expected: success.

```bash
rtk git add crates/signapps-oauth/
rtk git commit -m "feat(oauth): TokenTable trait + 3 service impls

TokenTable lets the refresh job load + update tokens for any service
table without hardcoding per-table SQL. Each impl knows the column
names + schema for its service.

3 impls:
- MailAccountsTable (mail.accounts oauth_*_enc cols)
- CalendarConnectionsTable (calendar.provider_connections *_enc cols)
- SocialAccountsTable (social.accounts *_enc cols)

Adding a 4th service = new impl + register in OAuthRefreshJob's
dispatch table.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: RefreshClient — single-row refresh logic

**Files:**
- Create: `crates/signapps-oauth/src/refresh.rs`
- Modify: `crates/signapps-oauth/src/lib.rs`

The actual HTTP call to the provider's refresh_url + new TokenResponse parsing. Pure function — caller handles encryption + DB writes.

- [ ] **Step 1: Write the module**

```rust
//! Refresh-token exchange against the provider's token endpoint.
//!
//! Pure function: given (provider, client_id, client_secret, refresh_token),
//! POSTs to `provider.refresh_url` (or `access_url` if refresh_url is None),
//! parses the new TokenResponse, returns it. Encryption + DB writes are
//! the caller's responsibility (`OAuthRefreshJob` does them).

use crate::error::OAuthError;
use crate::provider::ProviderDefinition;
use crate::types::TokenResponse;

/// Outcome of a refresh attempt.
#[derive(Debug, Clone)]
pub enum RefreshOutcome {
    /// Success — caller encrypts + persists the new tokens.
    Refreshed(TokenResponse),
    /// Provider explicitly revoked the refresh_token (4xx with error in body).
    /// Caller should mark the row as disabled and emit token-invalidated.
    Revoked {
        /// HTTP status from the provider.
        status: u16,
        /// Provider's error code (e.g., "invalid_grant").
        error: String,
        /// Optional human-readable description.
        description: Option<String>,
    },
    /// Transient failure (network, 5xx). Caller increments
    /// consecutive_failures and retries on the next scan.
    Transient {
        /// Reason string for last_error.
        reason: String,
    },
}

/// Try to refresh a token via the provider's refresh endpoint.
///
/// Never panics. All errors converted to `RefreshOutcome::Transient` or
/// `Revoked` so the caller's retry logic can decide what to do.
pub async fn try_refresh(
    http: &reqwest::Client,
    provider: &ProviderDefinition,
    client_id: &str,
    client_secret: &str,
    refresh_token: &str,
) -> RefreshOutcome {
    let endpoint = provider.refresh_url.as_deref().unwrap_or(&provider.access_url);

    let resp = match http
        .post(endpoint)
        .form(&[
            ("grant_type", "refresh_token"),
            ("refresh_token", refresh_token),
            ("client_id", client_id),
            ("client_secret", client_secret),
        ])
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => return RefreshOutcome::Transient { reason: format!("network: {e}") },
    };

    let status = resp.status();

    if status.is_client_error() {
        // 4xx — most providers signal token revocation here. Try to parse
        // the OAuth error body. If we can't, surface the raw status.
        let body = resp.text().await.unwrap_or_default();
        // A typical body: {"error":"invalid_grant","error_description":"..."}
        let parsed: Option<OAuthErrBody> = serde_json::from_str(&body).ok();
        return RefreshOutcome::Revoked {
            status: status.as_u16(),
            error: parsed
                .as_ref()
                .map(|p| p.error.clone())
                .unwrap_or_else(|| format!("http_{}", status.as_u16())),
            description: parsed.and_then(|p| p.error_description),
        };
    }

    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        return RefreshOutcome::Transient {
            reason: format!("http_{}: {body}", status.as_u16()),
        };
    }

    match resp.json::<TokenResponse>().await {
        Ok(tokens) => RefreshOutcome::Refreshed(tokens),
        Err(e) => RefreshOutcome::Transient {
            reason: format!("invalid token JSON: {e}"),
        },
    }
}

#[derive(serde::Deserialize)]
struct OAuthErrBody {
    error: String,
    #[serde(default)]
    error_description: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn revoked_outcome_carries_provider_error() {
        // Smoke check on the enum shape — full HTTP roundtrip in
        // integration tests once we have wiremock infrastructure
        // working for the engine (P3T7 marked that as a follow-up).
        let r = RefreshOutcome::Revoked {
            status: 400,
            error: "invalid_grant".into(),
            description: Some("token revoked".into()),
        };
        match r {
            RefreshOutcome::Revoked { status, .. } => assert_eq!(status, 400),
            _ => panic!("wrong variant"),
        }
    }
}
```

Note: the unused-import lints may bite if `OAuthError` isn't actually used here. Remove the `use crate::error::OAuthError;` line if clippy complains.

- [ ] **Step 2: Re-export from lib.rs**

```rust
pub mod refresh;
pub use refresh::{try_refresh, RefreshOutcome};
```

- [ ] **Step 3: Compile + test + commit**

```bash
cargo test -p signapps-oauth --lib refresh 2>&1 | tail -10
cargo clippy -p signapps-oauth --tests -- -D warnings 2>&1 | tail -5

rtk git add crates/signapps-oauth/
rtk git commit -m "$(cat <<'EOF'
feat(oauth): RefreshClient — try_refresh + RefreshOutcome

Pure async function that POSTs to provider.refresh_url with the
refresh_token + client_id/secret form params. Returns:
- Refreshed(TokenResponse) on success
- Revoked { status, error, description } on 4xx (provider parsed)
- Transient { reason } on network/5xx failures

Caller (OAuthRefreshJob) handles encryption + DB writes + retry
counters + invalidation events. This module is purely IO + parsing.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: OAuthRefreshJob — the periodic scanner

**Files:**
- Create: `services/signapps-identity/src/refresh_job.rs`
- Modify: `services/signapps-identity/src/main.rs`

Wakes every 5 minutes, scans `oauth_refresh_queue` for tokens expiring < 15 min, refreshes them in parallel (bounded to 10).

- [ ] **Step 1: Write the job module**

```rust
//! Periodic OAuth token refresh job.
//!
//! Spawned as a tokio task at boot. Wakes every 5 minutes, processes a
//! batch of up to 200 tokens that expire within the next 15 minutes.
//! Parallelism bounded to 10 concurrent refreshes to avoid hammering
//! providers.

use crate::AppState;
use anyhow::Context;
use chrono::{DateTime, Utc};
use futures::stream::{FuturesUnordered, StreamExt};
use signapps_common::pg_events::NewEvent;
use signapps_oauth::{
    try_refresh, CalendarConnectionsTable, EncryptedTokens, MailAccountsTable, OAuthError,
    OAuthTokenInvalidated, OAuthTokensAcquired, RefreshOutcome, SocialAccountsTable, TokenTable,
    EVENT_OAUTH_TOKEN_INVALIDATED,
};
use signapps_keystore::{decrypt_string, encrypt_string};
use sqlx::PgPool;
use std::sync::Arc;
use std::time::Duration;
use tokio::time::{interval, MissedTickBehavior};
use tracing::{error, info, instrument, warn};
use uuid::Uuid;

const SCAN_INTERVAL: Duration = Duration::from_secs(300); // 5 min
const MAX_PARALLEL_REFRESHES: usize = 10;
const BATCH_SIZE: i64 = 200;

/// Spawn the refresh job in a tokio task.
pub fn spawn(state: AppState) {
    tokio::spawn(async move {
        info!("oauth refresh job starting (every {:?})", SCAN_INTERVAL);
        let mut tick = interval(SCAN_INTERVAL);
        tick.set_missed_tick_behavior(MissedTickBehavior::Skip);
        // Run once immediately on boot, then on every tick.
        tick.tick().await;
        loop {
            tick.tick().await;
            if let Err(e) = run_one_pass(&state).await {
                error!(?e, "oauth refresh pass failed (will retry next tick)");
            }
        }
    });
}

#[instrument(skip(state))]
async fn run_one_pass(state: &AppState) -> anyhow::Result<()> {
    let rows: Vec<RefreshQueueRow> = sqlx::query_as(
        r#"
        SELECT id, source_table, source_id, tenant_id, user_id, provider_key, expires_at,
               consecutive_failures
        FROM identity.oauth_refresh_queue
        WHERE disabled = false
          AND consecutive_failures < 10
          AND expires_at < NOW() + INTERVAL '15 minutes'
          AND (last_refresh_attempt_at IS NULL
               OR last_refresh_attempt_at < NOW() - INTERVAL '2 minutes')
        ORDER BY expires_at ASC
        LIMIT $1
        "#,
    )
    .bind(BATCH_SIZE)
    .fetch_all(&state.pool.inner().clone())
    .await
    .context("scan oauth_refresh_queue")?;

    if rows.is_empty() {
        return Ok(());
    }
    info!(count = rows.len(), "refreshing tokens");

    let pool = state.pool.inner().clone();
    let mut futs: FuturesUnordered<_> = rows
        .into_iter()
        .map(|row| refresh_one(state.clone(), pool.clone(), row))
        .collect();

    let mut bounded = FuturesUnordered::new();
    while let Some(f) = futs.next().await {
        bounded.push(async { f });
        if bounded.len() >= MAX_PARALLEL_REFRESHES {
            bounded.next().await;
        }
    }
    while bounded.next().await.is_some() {}
    Ok(())
}

#[instrument(skip(state, pool, row), fields(provider = %row.provider_key))]
async fn refresh_one(state: AppState, pool: PgPool, row: RefreshQueueRow) {
    let table_handle: Box<dyn TokenTable> = match row.source_table.as_str() {
        "mail.accounts" => Box::new(MailAccountsTable),
        "calendar.provider_connections" => Box::new(CalendarConnectionsTable),
        "social.accounts" => Box::new(SocialAccountsTable),
        other => {
            warn!(table = other, "unknown source_table — skipping");
            record_failure(&pool, row.id, "unknown source_table", false).await;
            return;
        }
    };

    let outcome = match attempt(&state, &pool, &table_handle, &row).await {
        Ok(o) => o,
        Err(e) => RefreshOutcome::Transient {
            reason: format!("attempt setup error: {e}"),
        },
    };

    match outcome {
        RefreshOutcome::Refreshed(_tokens) => {
            // Already persisted by attempt(); reset failure counter.
            let _ = sqlx::query(
                "UPDATE identity.oauth_refresh_queue \
                 SET last_refresh_attempt_at = NOW(), consecutive_failures = 0, \
                     last_error = NULL, updated_at = NOW() \
                 WHERE id = $1",
            )
            .bind(row.id)
            .execute(&pool)
            .await;
        }
        RefreshOutcome::Revoked { status, error, description } => {
            let reason = format!("revoked: status={status} {error}: {description:?}");
            warn!(reason = %reason, "refresh token revoked — disabling");
            // Hard failure — disable + emit invalidation event
            let _ = sqlx::query(
                "UPDATE identity.oauth_refresh_queue \
                 SET last_refresh_attempt_at = NOW(), disabled = true, last_error = $2, updated_at = NOW() \
                 WHERE id = $1",
            )
            .bind(row.id)
            .bind(&reason)
            .execute(&pool)
            .await;

            let event = OAuthTokenInvalidated {
                user_id: row.user_id,
                tenant_id: row.tenant_id,
                provider_key: row.provider_key.clone(),
                source_table: row.source_table.clone(),
                source_id: row.source_id,
                reason,
            };
            if let Ok(payload) = serde_json::to_value(&event) {
                let _ = state
                    .event_bus
                    .publish(NewEvent {
                        event_type: EVENT_OAUTH_TOKEN_INVALIDATED.to_string(),
                        aggregate_id: Some(row.user_id),
                        payload,
                    })
                    .await;
            }
        }
        RefreshOutcome::Transient { reason } => {
            let now_disabled = (row.consecutive_failures + 1) >= 10;
            let _ = sqlx::query(
                "UPDATE identity.oauth_refresh_queue \
                 SET last_refresh_attempt_at = NOW(), \
                     consecutive_failures = consecutive_failures + 1, \
                     last_error = $2, \
                     disabled = $3, \
                     updated_at = NOW() \
                 WHERE id = $1",
            )
            .bind(row.id)
            .bind(&reason)
            .bind(now_disabled)
            .execute(&pool)
            .await;

            if now_disabled {
                warn!(reason = %reason, "10 consecutive failures — disabling");
                let event = OAuthTokenInvalidated {
                    user_id: row.user_id,
                    tenant_id: row.tenant_id,
                    provider_key: row.provider_key.clone(),
                    source_table: row.source_table.clone(),
                    source_id: row.source_id,
                    reason,
                };
                if let Ok(payload) = serde_json::to_value(&event) {
                    let _ = state
                        .event_bus
                        .publish(NewEvent {
                            event_type: EVENT_OAUTH_TOKEN_INVALIDATED.to_string(),
                            aggregate_id: Some(row.user_id),
                            payload,
                        })
                        .await;
                }
            }
        }
    }
}

async fn attempt(
    state: &AppState,
    pool: &PgPool,
    table: &Box<dyn TokenTable>,
    row: &RefreshQueueRow,
) -> Result<RefreshOutcome, anyhow::Error> {
    // 1. Load encrypted tokens
    let enc = table.load(pool, row.source_id).await?;
    let dek = state.keystore.dek("oauth-tokens-v1");

    // 2. Decrypt refresh_token
    let refresh_token = decrypt_string(&enc.refresh_token_enc, dek.as_ref())
        .context("decrypt refresh_token")?;

    // 3. Resolve provider + creds
    let provider = state.oauth_engine_state.catalog.get(&row.provider_key)
        .context("catalog get")?;
    let cfg = state
        .oauth_engine_state
        .configs
        .get(row.tenant_id, &row.provider_key)
        .await
        .map_err(|e| anyhow::anyhow!("{:?}", e))?
        .context("provider config not found")?;
    let creds = crate::handlers::oauth::creds::resolve_credentials(&cfg, &state.keystore)
        .map_err(|e| anyhow::anyhow!("{:?}", e))?;

    // 4. HTTP refresh
    let http = reqwest::Client::new();
    let outcome = try_refresh(
        &http,
        provider,
        &creds.client_id,
        &creds.client_secret,
        &refresh_token,
    )
    .await;

    // 5. On success, encrypt + persist
    if let RefreshOutcome::Refreshed(ref tokens) = outcome {
        let access_enc = encrypt_string(&tokens.access_token, dek.as_ref())
            .context("encrypt access_token")?;
        let new_refresh_enc = if let Some(ref rt) = tokens.refresh_token {
            encrypt_string(rt, dek.as_ref()).context("encrypt new refresh_token")?
        } else {
            // Provider didn't issue a new refresh token — keep the existing one.
            enc.refresh_token_enc.clone()
        };
        let new_expires_at = tokens
            .expires_in
            .map(|s| Utc::now() + chrono::Duration::seconds(s))
            .unwrap_or_else(|| Utc::now() + chrono::Duration::hours(1));
        table
            .update(pool, row.source_id, &access_enc, &new_refresh_enc, new_expires_at)
            .await
            .map_err(|e| anyhow::anyhow!("{:?}", e))?;
    }
    Ok(outcome)
}

async fn record_failure(pool: &PgPool, id: Uuid, reason: &str, hard: bool) {
    let _ = sqlx::query(
        "UPDATE identity.oauth_refresh_queue \
         SET last_refresh_attempt_at = NOW(), \
             consecutive_failures = consecutive_failures + 1, \
             last_error = $2, \
             disabled = $3, \
             updated_at = NOW() \
         WHERE id = $1",
    )
    .bind(id)
    .bind(reason)
    .bind(hard)
    .execute(pool)
    .await;
}

#[derive(Debug, sqlx::FromRow)]
struct RefreshQueueRow {
    id: Uuid,
    source_table: String,
    source_id: Uuid,
    tenant_id: Uuid,
    user_id: Uuid,
    provider_key: String,
    #[allow(dead_code)]
    expires_at: DateTime<Utc>,
    consecutive_failures: i32,
}
```

**Note:** This module references `crate::handlers::oauth::creds::resolve_credentials` — check the actual visibility (the P3T10 review made `creds` `pub mod`). Also references `state.pool.inner()` — adapt to whatever the actual `AppState.pool` field type is.

- [ ] **Step 2: Wire spawn into main.rs**

In `services/signapps-identity/src/main.rs`, after AppState is constructed:

```rust
mod refresh_job;

// ... after let state = AppState { ... };
refresh_job::spawn(state.clone());
info!("oauth refresh job spawned");
```

(`AppState` must be `Clone` — it already is since fields are `Arc<...>`. Verify.)

- [ ] **Step 3: Build + commit**

Run: `cargo check -p signapps-identity 2>&1 | tail -10`
Expected: success.

```bash
rtk git add services/signapps-identity/
rtk git commit -m "$(cat <<'EOF'
feat(identity): OAuthRefreshJob — periodic token refresh

Tokio task spawned at boot. Wakes every 5 minutes, processes up to
200 tokens expiring within 15 minutes. Bounded parallelism (10
concurrent refreshes) prevents hammering providers.

Per-row flow:
1. Resolve TokenTable handle from source_table
2. Load encrypted tokens, decrypt refresh_token
3. Resolve provider + creds (decrypt via keystore)
4. POST to provider's refresh_url
5. Outcome:
   - Refreshed → encrypt new tokens, UPDATE source table, reset failure counter
   - Revoked (4xx) → disabled = true, emit oauth.tokens.invalidated event
   - Transient → consecutive_failures += 1; if reaches 10, disable + invalidate

The 2-minute lockout (last_refresh_attempt_at < NOW() - 2 min) prevents
the same row from being retried in back-to-back ticks.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: checkout_token helper for services

**Files:**
- Create: `crates/signapps-oauth/src/checkout.rs`
- Modify: `crates/signapps-oauth/src/lib.rs`

Lazy pull. Services call this just before an outbound API call. If the token is fresh, decrypt + return. If it's < 60 s from expiry or already expired, ask identity to refresh synchronously then return the new token.

- [ ] **Step 1: Write the helper**

```rust
//! Lazy refresh helper used by service handlers right before they call
//! the upstream API.
//!
//! Most calls hit the fast path (decrypt + return). Only when the token
//! is < 60 s from expiry do we make a synchronous request to identity's
//! `/api/v1/oauth/internal/refresh` endpoint, which performs the refresh
//! and returns the fresh access token.

use crate::error::OAuthError;
use crate::token_table::TokenTable;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_keystore::{decrypt_string, Keystore};
use sqlx::PgPool;
use std::sync::Arc;
use std::time::Duration;
use uuid::Uuid;

/// Result of a `checkout_token` call.
#[derive(Debug)]
pub struct TokenCheckout {
    /// Plaintext access token, ready to use as a Bearer.
    pub access_token: String,
    /// When the access token expires.
    pub expires_at: DateTime<Utc>,
}

/// Default freshness margin — refresh if the token is within this window.
pub const FRESHNESS_MARGIN: Duration = Duration::from_secs(60);

/// Get a usable access token for `id` in `table`, refreshing via
/// identity if necessary.
///
/// # Errors
///
/// - `OAuthError::Database` on row load failure
/// - `OAuthError::MissingParameter` if no expires_at recorded
/// - `OAuthError::Crypto` on decrypt failure
/// - `OAuthError::ProviderError` if identity's refresh endpoint fails
pub async fn checkout_token<T: TokenTable + ?Sized>(
    pool: &PgPool,
    keystore: &Arc<Keystore>,
    table: &T,
    id: Uuid,
    identity_base_url: &str,
    internal_token: &str,
) -> Result<TokenCheckout, OAuthError> {
    let enc = table.load(pool, id).await?;
    let expires_at = enc
        .expires_at
        .ok_or_else(|| OAuthError::MissingParameter("expires_at".into()))?;

    let dek = keystore.dek("oauth-tokens-v1");

    // Fast path: still fresh, decrypt and return.
    if expires_at > Utc::now() + chrono::Duration::from_std(FRESHNESS_MARGIN).unwrap() {
        let access_token = decrypt_string(&enc.access_token_enc, dek.as_ref())
            .map_err(|e| OAuthError::Crypto(e.to_string()))?;
        return Ok(TokenCheckout { access_token, expires_at });
    }

    // Slow path: ask identity to refresh.
    let resp = reqwest::Client::new()
        .post(format!("{identity_base_url}/api/v1/oauth/internal/refresh"))
        .header("X-Internal-Token", internal_token)
        .json(&InternalRefreshRequest { source_table: table.name().to_string(), source_id: id })
        .timeout(Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| OAuthError::ProviderError {
            error: "refresh_call_failed".into(),
            description: Some(e.to_string()),
        })?;

    if !resp.status().is_success() {
        return Err(OAuthError::ProviderError {
            error: format!("refresh_http_{}", resp.status().as_u16()),
            description: resp.text().await.ok(),
        });
    }
    let body: InternalRefreshResponse = resp.json().await.map_err(|e| OAuthError::ProviderError {
        error: "refresh_response_invalid".into(),
        description: Some(e.to_string()),
    })?;
    Ok(TokenCheckout {
        access_token: body.access_token,
        expires_at: body.expires_at,
    })
}

#[derive(Serialize)]
struct InternalRefreshRequest {
    source_table: String,
    source_id: Uuid,
}

#[derive(Deserialize)]
struct InternalRefreshResponse {
    access_token: String,
    expires_at: DateTime<Utc>,
}
```

- [ ] **Step 2: Re-export**

In `crates/signapps-oauth/src/lib.rs`:

```rust
pub mod checkout;
pub use checkout::{checkout_token, TokenCheckout, FRESHNESS_MARGIN};
```

- [ ] **Step 3: Compile + commit**

```bash
cargo check -p signapps-oauth 2>&1 | tail -5
rtk git add crates/signapps-oauth/
rtk git commit -m "feat(oauth): checkout_token lazy-refresh helper

Services call this right before an outbound API call. Fast path
(token fresh) decrypts and returns inline. Slow path (token < 60s
from expiry) calls identity's POST /api/v1/oauth/internal/refresh
which performs the refresh and returns the fresh access token.

Generic over TokenTable so any service's handle works.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Internal refresh endpoint

**Files:**
- Create: `services/signapps-identity/src/handlers/oauth/internal_refresh.rs`
- Modify: `services/signapps-identity/src/handlers/oauth/mod.rs`
- Modify: `services/signapps-identity/src/main.rs` (add route)

`POST /api/v1/oauth/internal/refresh` — protected by an `X-Internal-Token` header, accepts `{ source_table, source_id }`, performs a synchronous refresh, returns `{ access_token, expires_at }`.

- [ ] **Step 1: Write the handler**

```rust
//! Internal endpoint used by service `checkout_token` for synchronous refresh.

use crate::AppState;
use axum::extract::{Json, State};
use axum::http::HeaderMap;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::AppError;
use signapps_oauth::{
    try_refresh, CalendarConnectionsTable, MailAccountsTable, OAuthError, RefreshOutcome,
    SocialAccountsTable, TokenTable,
};
use signapps_keystore::{decrypt_string, encrypt_string};
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct InternalRefreshBody {
    pub source_table: String,
    pub source_id: Uuid,
}

#[derive(Debug, Serialize)]
pub struct InternalRefreshResponse {
    pub access_token: String,
    pub expires_at: DateTime<Utc>,
}

#[tracing::instrument(skip(state, headers, body))]
pub async fn internal_refresh(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<InternalRefreshBody>,
) -> Result<Json<InternalRefreshResponse>, AppError> {
    // Auth: simple shared-secret check via X-Internal-Token header.
    let expected = std::env::var("OAUTH_INTERNAL_TOKEN").unwrap_or_default();
    let provided = headers
        .get("X-Internal-Token")
        .and_then(|h| h.to_str().ok())
        .unwrap_or_default();
    if expected.is_empty() || provided != expected {
        return Err(AppError::Unauthorized);
    }

    // Resolve TokenTable handle
    let table: Box<dyn TokenTable> = match body.source_table.as_str() {
        "mail.accounts" => Box::new(MailAccountsTable),
        "calendar.provider_connections" => Box::new(CalendarConnectionsTable),
        "social.accounts" => Box::new(SocialAccountsTable),
        other => {
            return Err(AppError::BadRequest(format!("unknown source_table: {other}")))
        }
    };

    // Discover the queue row to know which (tenant, provider, user) to refresh
    let pool = state.pool.inner().clone();
    let q: Option<(Uuid, Uuid, String)> = sqlx::query_as(
        "SELECT tenant_id, user_id, provider_key \
         FROM identity.oauth_refresh_queue \
         WHERE source_table = $1 AND source_id = $2",
    )
    .bind(&body.source_table)
    .bind(body.source_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| AppError::Internal(format!("queue lookup: {e}")))?;
    let (tenant_id, _user_id, provider_key) = q
        .ok_or_else(|| AppError::NotFound(format!("no queue row for {}.{}", body.source_table, body.source_id)))?;

    // Load encrypted tokens + decrypt refresh
    let enc = table.load(&pool, body.source_id).await
        .map_err(crate::handlers::oauth::error::oauth_error_to_app_error)?;
    let dek = state.keystore.dek("oauth-tokens-v1");
    let refresh_token = decrypt_string(&enc.refresh_token_enc, dek.as_ref())
        .map_err(|e| AppError::Internal(format!("decrypt refresh: {e}")))?;

    // Resolve provider + creds
    let provider = state.oauth_engine_state.catalog.get(&provider_key)
        .map_err(|e| crate::handlers::oauth::error::oauth_error_to_app_error(e.into()))?;
    let cfg = state.oauth_engine_state.configs.get(tenant_id, &provider_key).await
        .map_err(crate::handlers::oauth::error::oauth_error_to_app_error)?
        .ok_or_else(|| crate::handlers::oauth::error::oauth_error_to_app_error(OAuthError::ProviderNotConfigured))?;
    let creds = crate::handlers::oauth::creds::resolve_credentials(&cfg, &state.keystore)
        .map_err(crate::handlers::oauth::error::oauth_error_to_app_error)?;

    // Refresh
    let http = reqwest::Client::new();
    let outcome = try_refresh(&http, provider, &creds.client_id, &creds.client_secret, &refresh_token).await;

    match outcome {
        RefreshOutcome::Refreshed(tokens) => {
            let access_enc = encrypt_string(&tokens.access_token, dek.as_ref())
                .map_err(|e| AppError::Internal(format!("encrypt access: {e}")))?;
            let new_refresh_enc = match tokens.refresh_token.as_ref() {
                Some(rt) => encrypt_string(rt, dek.as_ref())
                    .map_err(|e| AppError::Internal(format!("encrypt new refresh: {e}")))?,
                None => enc.refresh_token_enc.clone(),
            };
            let new_expires_at = tokens
                .expires_in
                .map(|s| Utc::now() + chrono::Duration::seconds(s))
                .unwrap_or_else(|| Utc::now() + chrono::Duration::hours(1));

            table.update(&pool, body.source_id, &access_enc, &new_refresh_enc, new_expires_at).await
                .map_err(crate::handlers::oauth::error::oauth_error_to_app_error)?;

            Ok(Json(InternalRefreshResponse {
                access_token: tokens.access_token,
                expires_at: new_expires_at,
            }))
        }
        RefreshOutcome::Revoked { error, description, .. } => {
            Err(AppError::BadGateway(format!("revoked: {error} {description:?}")))
        }
        RefreshOutcome::Transient { reason } => {
            Err(AppError::BadGateway(reason))
        }
    }
}
```

Adapt `AppError` variants to whatever the real enum has (P3T9 found `BadRequest`, `Unauthorized`, `Forbidden`, `NotFound`, `BadGateway`, `Internal`).

- [ ] **Step 2: Register the route**

In `services/signapps-identity/src/handlers/oauth/mod.rs` add `pub mod internal_refresh;`.

In `services/signapps-identity/src/main.rs`, alongside the other oauth routes:

```rust
.route("/api/v1/oauth/internal/refresh", post(handlers::oauth::internal_refresh::internal_refresh))
```

This route is on `public_routes` since the auth is via the `X-Internal-Token` header check inside the handler — NOT JWT. Document this clearly.

- [ ] **Step 3: Build + commit**

```bash
cargo check -p signapps-identity 2>&1 | tail -10
rtk git add services/signapps-identity/
rtk git commit -m "$(cat <<'EOF'
feat(identity): POST /api/v1/oauth/internal/refresh

Internal endpoint for service-to-identity lazy refresh. Auth via
shared X-Internal-Token header (env OAUTH_INTERNAL_TOKEN).

Body: { source_table, source_id }
Response: { access_token, expires_at }

Used by signapps-oauth::checkout_token when a token is < 60s from
expiry. Performs a synchronous refresh (decrypt → POST provider →
encrypt → UPDATE) and returns the fresh access token to the caller.

Routes are registered on public_routes since the X-Internal-Token
check substitutes for JWT auth at the network boundary.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Doctor check for refresh queue health

**Files:**
- Create: `scripts/doctor-checks/oauth-refresh-queue.sh`
- Modify: `scripts/doctor.sh`

- [ ] **Step 1: Write the check**

```bash
#!/usr/bin/env bash
#
# Report the OAuth refresh queue status:
#  - total rows in queue
#  - rows currently disabled (operator action needed)
#  - rows with consecutive_failures > 3 (warning sign)
# Exit 0 always — this is informational, not a blocker.

set -u

PSQL="docker exec signapps-postgres psql -U signapps -d signapps -tAq"

total=$($PSQL -c "SELECT COUNT(*) FROM identity.oauth_refresh_queue" 2>/dev/null || echo "?")
disabled=$($PSQL -c "SELECT COUNT(*) FROM identity.oauth_refresh_queue WHERE disabled = true" 2>/dev/null || echo "?")
warning=$($PSQL -c "SELECT COUNT(*) FROM identity.oauth_refresh_queue WHERE consecutive_failures BETWEEN 3 AND 9" 2>/dev/null || echo "?")

echo "OAuth refresh queue: $total rows ($disabled disabled, $warning warning)"
exit 0
```

- [ ] **Step 2: Wire into doctor.sh**

Add after the OAuth encryption check (P4T10):

```bash
_orq_msg=$(bash "$BASE_DIR/scripts/doctor-checks/oauth-refresh-queue.sh" 2>&1) && _orq_ok=0 || _orq_ok=$?
if [ "${_orq_ok:-0}" -eq 0 ]; then
    echo -e "  ${GREEN}[OK]${NC}   ${_orq_msg}"
    PASS=$((PASS+1))
else
    echo -e "  ${RED}[FAIL]${NC} ${_orq_msg}"
    FAIL=$((FAIL+1))
fi
unset _orq_msg _orq_ok
```

- [ ] **Step 3: Test + commit**

```bash
chmod +x scripts/doctor-checks/oauth-refresh-queue.sh
bash scripts/doctor.sh 2>&1 | grep -i "refresh queue"
```

Expected: `[OK] OAuth refresh queue: 0 rows (0 disabled, 0 warning)` (greenfield).

```bash
rtk git add scripts/doctor-checks/oauth-refresh-queue.sh scripts/doctor.sh
rtk git commit -m "feat(doctor): report oauth_refresh_queue status

Informational check: total rows / disabled / warning (3-9 failures).
Always exits 0 — operator action is to look at the disabled count
and ask affected users to reconnect.

Doctor count becomes 24/24 (was 23/23 after Plan 4).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Final validation

**Files:** None (verification only).

- [ ] **Step 1: cargo check workspace**

`cargo check --workspace --all-features 2>&1 | tail -10`

- [ ] **Step 2: clippy on Plan 5 crates**

`cargo clippy -p signapps-oauth -p signapps-identity --all-features --tests -- -D warnings 2>&1 | tail -10`

- [ ] **Step 3: All tests**

`cargo test -p signapps-oauth -p signapps-keystore -p signapps-common 2>&1 | tail -25`

Expected: ~125 tests pass (Plan 4 baseline + 1 refresh smoke).

- [ ] **Step 4: Identity builds**

`cargo build -p signapps-identity 2>&1 | tail -5` (or `cargo check` if binary locked).

- [ ] **Step 5: Migration applied + queue exists**

```bash
docker exec signapps-postgres psql -U signapps -d signapps -c "\d identity.oauth_refresh_queue" 2>&1 | head -15
docker exec signapps-postgres psql -U signapps -d signapps -c "SELECT tgname FROM pg_trigger WHERE tgname LIKE 'sync_%refresh_queue'" 2>&1
```

Expected: 1 table + 3 triggers.

- [ ] **Step 6: Doctor**

`bash scripts/doctor.sh 2>&1 | tail -25`
Expected: 24/24 (added the refresh queue check).

- [ ] **Step 7: cargo fmt**

`cargo fmt -p signapps-oauth -p signapps-identity --check 2>&1 | tail -5`. Format if needed (scope only).

- [ ] **Step 8: Git log summary**

`rtk git log --oneline main..feat/oauth-refresh 2>/dev/null | head -15`

---

**Self-review:**

- ✅ Spec section 8.1 "Double stratégie push + pull" → Tasks 4 (push) + 5 (pull)
- ✅ Spec section 8.2 "Table oauth_refresh_queue" → Task 1
- ✅ Spec section 8.3 "Trait TokenTable" → Task 2
- ✅ Spec section 8.4 "Escalade" → Task 4 (revoked + 10-failure logic)
- ✅ Spec section 8.5 "Pull lazy" → Tasks 5 + 6
- ⏸ Spec section 8.6 "Métriques Prometheus" — deferred (can be added incrementally without changing schema)
- ⏸ Spec section 9 "Admin UI" — deferred to Plan 6 (separate from backend)

**Plan 6 (if you want it next): Admin UI**
- `/admin/oauth-providers` page + drawer + 5 tabs
- VisibilityPicker reusable component (groups/roles/nodes/users)
- HTTP endpoints `GET/POST/PATCH/DELETE /api/v1/admin/oauth-providers`
- `/account/connections` user UI
- OIDC discovery wizard for custom providers
- SAML metadata XML upload for SAML providers
