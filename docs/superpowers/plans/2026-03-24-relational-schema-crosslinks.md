# Relational Schema Cross-Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unifier les microservices SignApps via un schéma relationnel cross-service avec entity references, activity feed, signature workflows (state machine), audit log immuable, soft deletes, LISTEN/NOTIFY, et chiffrement PII.

**Architecture:** Migration progressive — nouvelles tables dans la DB partagée (PostgreSQL), nouveaux models/repositories dans signapps-db, traits partagés dans signapps-common, API routes exposées depuis un nouveau service signapps-crosslinks, composants frontend React.

**Tech Stack:** Rust (sqlx, aes-gcm, uuid v7), PostgreSQL (triggers, LISTEN/NOTIFY, GIN), Next.js (React, Zustand, shadcn/ui)

**Spec:** `docs/superpowers/specs/2026-03-24-relational-schema-crosslinks-design.md`

---

## File Map

### Migrations (create)
- `crates/signapps-db/migrations/20260324000001_uuid_v7_function.up.sql`
- `crates/signapps-db/migrations/20260324000001_uuid_v7_function.down.sql`
- `crates/signapps-db/migrations/20260324000002_audit_log.up.sql`
- `crates/signapps-db/migrations/20260324000002_audit_log.down.sql`
- `crates/signapps-db/migrations/20260324000003_entity_references.up.sql`
- `crates/signapps-db/migrations/20260324000003_entity_references.down.sql`
- `crates/signapps-db/migrations/20260324000004_activities.up.sql`
- `crates/signapps-db/migrations/20260324000004_activities.down.sql`
- `crates/signapps-db/migrations/20260324000005_signature_envelopes.up.sql`
- `crates/signapps-db/migrations/20260324000005_signature_envelopes.down.sql`
- `crates/signapps-db/migrations/20260324000006_notify_triggers.up.sql`
- `crates/signapps-db/migrations/20260324000006_notify_triggers.down.sql`
- `crates/signapps-db/migrations/20260324000007_soft_deletes.up.sql`
- `crates/signapps-db/migrations/20260324000007_soft_deletes.down.sql`
- `crates/signapps-db/migrations/20260324000008_cross_service_fks.up.sql`
- `crates/signapps-db/migrations/20260324000008_cross_service_fks.down.sql`
- `crates/signapps-db/migrations/20260324000009_active_views.up.sql`
- `crates/signapps-db/migrations/20260324000009_active_views.down.sql`

### Rust — signapps-db models (create)
- `crates/signapps-db/src/models/audit_log.rs`
- `crates/signapps-db/src/models/entity_reference.rs`
- `crates/signapps-db/src/models/activity.rs`
- `crates/signapps-db/src/models/signature.rs`

### Rust — signapps-db repositories (create)
- `crates/signapps-db/src/repositories/audit_log_repository.rs`
- `crates/signapps-db/src/repositories/entity_reference_repository.rs`
- `crates/signapps-db/src/repositories/activity_repository.rs`
- `crates/signapps-db/src/repositories/signature_repository.rs`

### Rust — signapps-db (modify)
- `crates/signapps-db/src/models/mod.rs` — add new module exports
- `crates/signapps-db/src/repositories/mod.rs` — add new repository exports
- `crates/signapps-db/src/models/drive.rs` — add sha256_hash, mime_type, size_bytes, storage_path, encryption_key_id, deleted_at fields

### Rust — signapps-common (create)
- `crates/signapps-common/src/pii.rs` — PiiCipher (aes-gcm)
- `crates/signapps-common/src/pg_listener.rs` — PgListener helper
- `crates/signapps-common/src/traits/linkable.rs` — Linkable trait + log_activity + audit helpers

### Rust — signapps-common (modify)
- `crates/signapps-common/src/lib.rs` — add pii, pg_listener exports
- `crates/signapps-common/src/traits/mod.rs` — add linkable export
- `crates/signapps-common/Cargo.toml` — add aes-gcm dep

### Rust — workspace (modify)
- `Cargo.toml` — add uuid v7 feature, aes-gcm workspace dep

### Frontend (create)
- `client/src/lib/api/crosslinks.ts` — API client for links, activities, signatures, audit
- `client/src/types/crosslinks.ts` — TypeScript types
- `client/src/components/crosslinks/ActivityFeed.tsx`
- `client/src/components/crosslinks/EntityLinks.tsx`
- `client/src/components/crosslinks/AuditTrail.tsx`

---

## Phase 1: Foundation

### Task 1: UUID v7 — Workspace + SQL Function

**Files:**
- Modify: `Cargo.toml` (workspace root, line 106)
- Create: `crates/signapps-db/migrations/20260324000001_uuid_v7_function.up.sql`
- Create: `crates/signapps-db/migrations/20260324000001_uuid_v7_function.down.sql`

- [ ] **Step 1: Add v7 feature to uuid workspace dep**

In `Cargo.toml`, change line 106:
```toml
# before
uuid = { version = "1.7", features = ["v4", "v5", "serde"] }
# after
uuid = { version = "1.7", features = ["v4", "v5", "v7", "serde"] }
```

- [ ] **Step 2: Create UUID v7 SQL function migration (up)**

```sql
-- 20260324000001_uuid_v7_function.up.sql
CREATE OR REPLACE FUNCTION gen_uuid_v7() RETURNS UUID AS $$
DECLARE
    unix_ts_ms BIGINT;
    uuid_bytes BYTEA;
BEGIN
    unix_ts_ms = (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT;
    uuid_bytes = SET_BYTE(
        SET_BYTE(
            overlay(uuid_send(gen_random_uuid()) placing substring(int8send(unix_ts_ms) from 3) from 1 for 6),
        6, (GET_BYTE(uuid_send(gen_random_uuid()), 6) & 15) | 112),
    8, (GET_BYTE(uuid_send(gen_random_uuid()), 8) & 63) | 128);
    RETURN encode(uuid_bytes, 'hex')::UUID;
END;
$$ LANGUAGE plpgsql VOLATILE;
```

- [ ] **Step 3: Create down migration**

```sql
-- 20260324000001_uuid_v7_function.down.sql
DROP FUNCTION IF EXISTS gen_uuid_v7();
```

- [ ] **Step 4: Verify compilation**

Run: `cd C:/Prog/signapps-platform && cargo check --workspace 2>&1 | tail -5`
Expected: compilation success

- [ ] **Step 5: Commit**

```bash
git add Cargo.toml crates/signapps-db/migrations/20260324000001_*
git commit -m "feat(db): add UUID v7 support — workspace feature + SQL function"
```

---

### Task 2: PII Cipher Module (aes-gcm)

**Files:**
- Modify: `Cargo.toml` (workspace root)
- Modify: `crates/signapps-common/Cargo.toml`
- Create: `crates/signapps-common/src/pii.rs`
- Modify: `crates/signapps-common/src/lib.rs`

- [ ] **Step 1: Add aes-gcm workspace dep**

In root `Cargo.toml` `[workspace.dependencies]`:
```toml
aes-gcm = "0.10"
```

In `crates/signapps-common/Cargo.toml` `[dependencies]`:
```toml
aes-gcm = { workspace = true }
```

- [ ] **Step 2: Write PiiCipher tests**

Create `crates/signapps-common/src/pii.rs`:
```rust
use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Key, Nonce,
};
use aes_gcm::aead::rand_core::RngCore;

pub struct PiiCipher {
    cipher: Aes256Gcm,
}

impl PiiCipher {
    /// Create from a 32-byte hex-encoded key
    pub fn from_hex_key(hex_key: &str) -> Result<Self, String> {
        let key_bytes = hex::decode(hex_key).map_err(|e| format!("invalid hex key: {e}"))?;
        if key_bytes.len() != 32 {
            return Err(format!("key must be 32 bytes, got {}", key_bytes.len()));
        }
        let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
        Ok(Self {
            cipher: Aes256Gcm::new(key),
        })
    }

    /// Create from ENCRYPTION_KEY env var
    pub fn from_env() -> Result<Self, String> {
        let key = std::env::var("ENCRYPTION_KEY")
            .map_err(|_| "ENCRYPTION_KEY env var not set".to_string())?;
        Self::from_hex_key(&key)
    }

    /// Encrypt plaintext. Returns nonce (12 bytes) || ciphertext.
    pub fn encrypt(&self, plaintext: &str) -> Result<Vec<u8>, String> {
        let mut nonce_bytes = [0u8; 12];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);
        let ciphertext = self.cipher.encrypt(nonce, plaintext.as_bytes())
            .map_err(|e| format!("encryption failed: {e}"))?;
        let mut result = nonce_bytes.to_vec();
        result.extend(ciphertext);
        Ok(result)
    }

    /// Decrypt data (nonce || ciphertext). Returns plaintext.
    pub fn decrypt(&self, data: &[u8]) -> Result<String, String> {
        if data.len() < 13 {
            return Err("ciphertext too short".to_string());
        }
        let (nonce_bytes, ciphertext) = data.split_at(12);
        let nonce = Nonce::from_slice(nonce_bytes);
        let plaintext = self.cipher.decrypt(nonce, ciphertext)
            .map_err(|e| format!("decryption failed: {e}"))?;
        String::from_utf8(plaintext).map_err(|e| format!("invalid utf8: {e}"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_key() -> String {
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef".to_string()
    }

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let cipher = PiiCipher::from_hex_key(&test_key()).unwrap();
        let plaintext = "user@example.com";
        let encrypted = cipher.encrypt(plaintext).unwrap();
        assert_ne!(encrypted, plaintext.as_bytes());
        let decrypted = cipher.decrypt(&encrypted).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_different_nonces() {
        let cipher = PiiCipher::from_hex_key(&test_key()).unwrap();
        let e1 = cipher.encrypt("same text").unwrap();
        let e2 = cipher.encrypt("same text").unwrap();
        assert_ne!(e1, e2); // different nonces
        assert_eq!(cipher.decrypt(&e1).unwrap(), cipher.decrypt(&e2).unwrap());
    }

    #[test]
    fn test_invalid_key_length() {
        assert!(PiiCipher::from_hex_key("tooshort").is_err());
    }

    #[test]
    fn test_tampered_ciphertext() {
        let cipher = PiiCipher::from_hex_key(&test_key()).unwrap();
        let mut encrypted = cipher.encrypt("secret").unwrap();
        encrypted[15] ^= 0xFF; // tamper
        assert!(cipher.decrypt(&encrypted).is_err());
    }
}
```

- [ ] **Step 3: Export pii module**

In `crates/signapps-common/src/lib.rs`, add:
```rust
pub mod pii;
```

- [ ] **Step 4: Run tests**

Run: `cd C:/Prog/signapps-platform && cargo test -p signapps-common pii -- --nocapture`
Expected: 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add Cargo.toml crates/signapps-common/Cargo.toml crates/signapps-common/src/pii.rs crates/signapps-common/src/lib.rs
git commit -m "feat(common): add PiiCipher module — AES-256-GCM encryption for PII fields"
```

---

### Task 3: Linkable Trait + Activity/Audit Helpers

**Files:**
- Create: `crates/signapps-common/src/traits/linkable.rs`
- Modify: `crates/signapps-common/src/traits/mod.rs`

- [ ] **Step 1: Create Linkable trait**

Create `crates/signapps-common/src/traits/linkable.rs`:
```rust
use serde_json::Value;
use sqlx::PgPool;
use std::net::IpAddr;
use uuid::Uuid;

/// Trait for entities that can be linked cross-service and tracked in activity/audit.
pub trait Linkable {
    fn entity_type(&self) -> &'static str;
    fn entity_id(&self) -> Uuid;
    fn entity_title(&self) -> String;
}

/// Log an activity entry to the activities table.
pub async fn log_activity(
    pool: &PgPool,
    actor_id: Uuid,
    action: &str,
    entity: &dyn Linkable,
    workspace_id: Option<Uuid>,
    metadata: Value,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"INSERT INTO activities (id, actor_id, action, entity_type, entity_id, entity_title, metadata, workspace_id)
           VALUES (gen_uuid_v7(), $1, $2, $3, $4, $5, $6, $7)"#,
    )
    .bind(actor_id)
    .bind(action)
    .bind(entity.entity_type())
    .bind(entity.entity_id())
    .bind(entity.entity_title())
    .bind(&metadata)
    .bind(workspace_id)
    .execute(pool)
    .await?;
    Ok(())
}

/// Append an immutable audit log entry.
pub async fn audit(
    pool: &PgPool,
    actor_id: Option<Uuid>,
    actor_ip: Option<IpAddr>,
    action: &str,
    entity: &dyn Linkable,
    old_data: Option<Value>,
    new_data: Option<Value>,
    workspace_id: Option<Uuid>,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"INSERT INTO audit_log (id, actor_id, actor_ip, action, entity_type, entity_id, old_data, new_data, workspace_id)
           VALUES (gen_uuid_v7(), $1, $2, $3, $4, $5, $6, $7, $8)"#,
    )
    .bind(actor_id)
    .bind(actor_ip.map(|ip| ip.to_string()))
    .bind(action)
    .bind(entity.entity_type())
    .bind(entity.entity_id())
    .bind(&old_data)
    .bind(&new_data)
    .bind(workspace_id)
    .execute(pool)
    .await?;
    Ok(())
}
```

- [ ] **Step 2: Export in traits/mod.rs**

In `crates/signapps-common/src/traits/mod.rs`, add:
```rust
pub mod linkable;
pub use linkable::{Linkable, log_activity, audit};
```

- [ ] **Step 3: Verify compilation**

Run: `cargo check -p signapps-common 2>&1 | tail -5`
Expected: success

- [ ] **Step 4: Commit**

```bash
git add crates/signapps-common/src/traits/linkable.rs crates/signapps-common/src/traits/mod.rs
git commit -m "feat(common): add Linkable trait + log_activity + audit helpers"
```

---

## Phase 2: Core Tables

### Task 4: Audit Log — Migration + Model + Repository

**Files:**
- Create: `crates/signapps-db/migrations/20260324000002_audit_log.up.sql`
- Create: `crates/signapps-db/migrations/20260324000002_audit_log.down.sql`
- Create: `crates/signapps-db/src/models/audit_log.rs`
- Create: `crates/signapps-db/src/repositories/audit_log_repository.rs`
- Modify: `crates/signapps-db/src/models/mod.rs`
- Modify: `crates/signapps-db/src/repositories/mod.rs`

- [ ] **Step 1: Create audit_log migration (up)**

```sql
-- 20260324000002_audit_log.up.sql
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_uuid_v7(),
    actor_id UUID,
    actor_ip TEXT,
    action VARCHAR(64) NOT NULL,
    entity_type VARCHAR(32) NOT NULL,
    entity_id UUID NOT NULL,
    old_data JSONB,
    new_data JSONB,
    metadata JSONB DEFAULT '{}',
    workspace_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION prevent_audit_mutation() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'audit_log is append-only: % not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_immutable
    BEFORE UPDATE OR DELETE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();

CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_actor ON audit_log(actor_id, created_at DESC);
CREATE INDEX idx_audit_action ON audit_log(action, created_at DESC);
```

- [ ] **Step 2: Create down migration**

```sql
-- 20260324000002_audit_log.down.sql
DROP TRIGGER IF EXISTS audit_immutable ON audit_log;
DROP FUNCTION IF EXISTS prevent_audit_mutation();
DROP TABLE IF EXISTS audit_log;
```

- [ ] **Step 3: Create model**

Create `crates/signapps-db/src/models/audit_log.rs`:
```rust
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AuditLogEntry {
    pub id: Uuid,
    pub actor_id: Option<Uuid>,
    pub actor_ip: Option<String>,
    pub action: String,
    pub entity_type: String,
    pub entity_id: Uuid,
    pub old_data: Option<serde_json::Value>,
    pub new_data: Option<serde_json::Value>,
    pub metadata: serde_json::Value,
    pub workspace_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}
```

- [ ] **Step 4: Create repository**

Create `crates/signapps-db/src/repositories/audit_log_repository.rs`:
```rust
use crate::models::audit_log::AuditLogEntry;
use sqlx::PgPool;
use uuid::Uuid;

pub struct AuditLogRepository {
    pool: PgPool,
}

impl AuditLogRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn append(
        &self,
        actor_id: Option<Uuid>,
        actor_ip: Option<&str>,
        action: &str,
        entity_type: &str,
        entity_id: Uuid,
        old_data: Option<serde_json::Value>,
        new_data: Option<serde_json::Value>,
        workspace_id: Option<Uuid>,
    ) -> Result<AuditLogEntry, sqlx::Error> {
        sqlx::query_as::<_, AuditLogEntry>(
            r#"INSERT INTO audit_log (id, actor_id, actor_ip, action, entity_type, entity_id, old_data, new_data, workspace_id)
               VALUES (gen_uuid_v7(), $1, $2, $3, $4, $5, $6, $7, $8)
               RETURNING *"#,
        )
        .bind(actor_id)
        .bind(actor_ip)
        .bind(action)
        .bind(entity_type)
        .bind(entity_id)
        .bind(&old_data)
        .bind(&new_data)
        .bind(workspace_id)
        .fetch_one(&self.pool)
        .await
    }

    pub async fn query_by_entity(
        &self,
        entity_type: &str,
        entity_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<AuditLogEntry>, sqlx::Error> {
        sqlx::query_as::<_, AuditLogEntry>(
            r#"SELECT * FROM audit_log WHERE entity_type = $1 AND entity_id = $2
               ORDER BY created_at DESC LIMIT $3 OFFSET $4"#,
        )
        .bind(entity_type)
        .bind(entity_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await
    }

    pub async fn query_by_actor(
        &self,
        actor_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<AuditLogEntry>, sqlx::Error> {
        sqlx::query_as::<_, AuditLogEntry>(
            r#"SELECT * FROM audit_log WHERE actor_id = $1
               ORDER BY created_at DESC LIMIT $3 OFFSET $4"#,
        )
        .bind(actor_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await
    }
}
```

- [ ] **Step 5: Register in mod.rs files**

In `crates/signapps-db/src/models/mod.rs`, add:
```rust
pub mod audit_log;
```

In `crates/signapps-db/src/repositories/mod.rs`, add:
```rust
pub mod audit_log_repository;
pub use audit_log_repository::AuditLogRepository;
```

- [ ] **Step 6: Verify compilation**

Run: `cargo check -p signapps-db 2>&1 | tail -5`
Expected: success

- [ ] **Step 7: Commit**

```bash
git add crates/signapps-db/migrations/20260324000002_* crates/signapps-db/src/models/audit_log.rs crates/signapps-db/src/repositories/audit_log_repository.rs crates/signapps-db/src/models/mod.rs crates/signapps-db/src/repositories/mod.rs
git commit -m "feat(db): add audit_log — append-only immutable table with trigger protection"
```

---

### Task 5: Entity References — Migration + Model + Repository

**Files:**
- Create: `crates/signapps-db/migrations/20260324000003_entity_references.up.sql`
- Create: `crates/signapps-db/migrations/20260324000003_entity_references.down.sql`
- Create: `crates/signapps-db/src/models/entity_reference.rs`
- Create: `crates/signapps-db/src/repositories/entity_reference_repository.rs`
- Modify: `crates/signapps-db/src/models/mod.rs`
- Modify: `crates/signapps-db/src/repositories/mod.rs`

- [ ] **Step 1: Create entity_references migration (up)**

```sql
-- 20260324000003_entity_references.up.sql
CREATE TABLE entity_references (
    id UUID PRIMARY KEY DEFAULT gen_uuid_v7(),
    source_type VARCHAR(32) NOT NULL,
    source_id UUID NOT NULL,
    target_type VARCHAR(32) NOT NULL,
    target_id UUID NOT NULL,
    relation VARCHAR(32) NOT NULL DEFAULT 'related',
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(source_type, source_id, target_type, target_id, relation)
);
CREATE INDEX idx_entity_ref_source ON entity_references(source_type, source_id);
CREATE INDEX idx_entity_ref_target ON entity_references(target_type, target_id);
```

- [ ] **Step 2: Create down migration**

```sql
-- 20260324000003_entity_references.down.sql
DROP TABLE IF EXISTS entity_references;
```

- [ ] **Step 3: Create model**

Create `crates/signapps-db/src/models/entity_reference.rs`:
```rust
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct EntityReference {
    pub id: Uuid,
    pub source_type: String,
    pub source_id: Uuid,
    pub target_type: String,
    pub target_id: Uuid,
    pub relation: String,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct CreateEntityReference {
    pub source_type: String,
    pub source_id: Uuid,
    pub target_type: String,
    pub target_id: Uuid,
    pub relation: Option<String>,
}
```

- [ ] **Step 4: Create repository**

Create `crates/signapps-db/src/repositories/entity_reference_repository.rs`:
```rust
use crate::models::entity_reference::EntityReference;
use sqlx::PgPool;
use uuid::Uuid;

pub struct EntityReferenceRepository {
    pool: PgPool,
}

impl EntityReferenceRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn link(
        &self,
        source_type: &str,
        source_id: Uuid,
        target_type: &str,
        target_id: Uuid,
        relation: &str,
        created_by: Option<Uuid>,
    ) -> Result<EntityReference, sqlx::Error> {
        sqlx::query_as::<_, EntityReference>(
            r#"INSERT INTO entity_references (id, source_type, source_id, target_type, target_id, relation, created_by)
               VALUES (gen_uuid_v7(), $1, $2, $3, $4, $5, $6)
               ON CONFLICT (source_type, source_id, target_type, target_id, relation) DO UPDATE SET deleted_at = NULL
               RETURNING *"#,
        )
        .bind(source_type)
        .bind(source_id)
        .bind(target_type)
        .bind(target_id)
        .bind(relation)
        .bind(created_by)
        .fetch_one(&self.pool)
        .await
    }

    pub async fn unlink(&self, id: Uuid) -> Result<(), sqlx::Error> {
        sqlx::query("UPDATE entity_references SET deleted_at = now() WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn find_links(
        &self,
        entity_type: &str,
        entity_id: Uuid,
    ) -> Result<Vec<EntityReference>, sqlx::Error> {
        sqlx::query_as::<_, EntityReference>(
            r#"SELECT * FROM entity_references
               WHERE deleted_at IS NULL
                 AND ((source_type = $1 AND source_id = $2) OR (target_type = $1 AND target_id = $2))
               ORDER BY created_at DESC"#,
        )
        .bind(entity_type)
        .bind(entity_id)
        .fetch_all(&self.pool)
        .await
    }

    pub async fn find_links_by_type(
        &self,
        source_type: &str,
        source_id: Uuid,
        target_type: &str,
    ) -> Result<Vec<EntityReference>, sqlx::Error> {
        sqlx::query_as::<_, EntityReference>(
            r#"SELECT * FROM entity_references
               WHERE deleted_at IS NULL AND source_type = $1 AND source_id = $2 AND target_type = $3
               ORDER BY created_at DESC"#,
        )
        .bind(source_type)
        .bind(source_id)
        .bind(target_type)
        .fetch_all(&self.pool)
        .await
    }
}
```

- [ ] **Step 5: Register in mod.rs files**

Add to `models/mod.rs`: `pub mod entity_reference;`
Add to `repositories/mod.rs`:
```rust
pub mod entity_reference_repository;
pub use entity_reference_repository::EntityReferenceRepository;
```

- [ ] **Step 6: Verify compilation + Commit**

```bash
cargo check -p signapps-db
git add crates/signapps-db/migrations/20260324000003_* crates/signapps-db/src/models/entity_reference.rs crates/signapps-db/src/repositories/entity_reference_repository.rs crates/signapps-db/src/models/mod.rs crates/signapps-db/src/repositories/mod.rs
git commit -m "feat(db): add entity_references — cross-service polymorphic links"
```

---

### Task 6: Activities — Migration + Model + Repository

**Files:**
- Create: `crates/signapps-db/migrations/20260324000004_activities.up.sql`
- Create: `crates/signapps-db/migrations/20260324000004_activities.down.sql`
- Create: `crates/signapps-db/src/models/activity.rs`
- Create: `crates/signapps-db/src/repositories/activity_repository.rs`
- Modify: `crates/signapps-db/src/models/mod.rs`
- Modify: `crates/signapps-db/src/repositories/mod.rs`

- [ ] **Step 1: Create activities migration (up)**

```sql
-- 20260324000004_activities.up.sql
CREATE TABLE activities (
    id UUID PRIMARY KEY DEFAULT gen_uuid_v7(),
    actor_id UUID NOT NULL,
    action VARCHAR(32) NOT NULL,
    entity_type VARCHAR(32) NOT NULL,
    entity_id UUID NOT NULL,
    entity_title TEXT,
    metadata JSONB DEFAULT '{}',
    workspace_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_activities_actor ON activities(actor_id, created_at DESC);
CREATE INDEX idx_activities_workspace ON activities(workspace_id, created_at DESC);
CREATE INDEX idx_activities_entity ON activities(entity_type, entity_id);
CREATE INDEX idx_activities_metadata ON activities USING GIN(metadata);
```

- [ ] **Step 2: Create down migration**

```sql
-- 20260324000004_activities.down.sql
DROP TABLE IF EXISTS activities;
```

- [ ] **Step 3: Create model**

Create `crates/signapps-db/src/models/activity.rs`:
```rust
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Activity {
    pub id: Uuid,
    pub actor_id: Uuid,
    pub action: String,
    pub entity_type: String,
    pub entity_id: Uuid,
    pub entity_title: Option<String>,
    pub metadata: serde_json::Value,
    pub workspace_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}
```

- [ ] **Step 4: Create repository**

Create `crates/signapps-db/src/repositories/activity_repository.rs`:
```rust
use crate::models::activity::Activity;
use sqlx::PgPool;
use uuid::Uuid;

pub struct ActivityRepository {
    pool: PgPool,
}

impl ActivityRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn log(
        &self,
        actor_id: Uuid,
        action: &str,
        entity_type: &str,
        entity_id: Uuid,
        entity_title: Option<&str>,
        metadata: serde_json::Value,
        workspace_id: Option<Uuid>,
    ) -> Result<Activity, sqlx::Error> {
        sqlx::query_as::<_, Activity>(
            r#"INSERT INTO activities (id, actor_id, action, entity_type, entity_id, entity_title, metadata, workspace_id)
               VALUES (gen_uuid_v7(), $1, $2, $3, $4, $5, $6, $7)
               RETURNING *"#,
        )
        .bind(actor_id)
        .bind(action)
        .bind(entity_type)
        .bind(entity_id)
        .bind(entity_title)
        .bind(&metadata)
        .bind(workspace_id)
        .fetch_one(&self.pool)
        .await
    }

    pub async fn get_feed(
        &self,
        workspace_id: Option<Uuid>,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<Activity>, sqlx::Error> {
        if let Some(ws) = workspace_id {
            sqlx::query_as::<_, Activity>(
                "SELECT * FROM activities WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
            )
            .bind(ws)
            .bind(limit)
            .bind(offset)
            .fetch_all(&self.pool)
            .await
        } else {
            sqlx::query_as::<_, Activity>(
                "SELECT * FROM activities ORDER BY created_at DESC LIMIT $1 OFFSET $2",
            )
            .bind(limit)
            .bind(offset)
            .fetch_all(&self.pool)
            .await
        }
    }

    pub async fn get_entity_history(
        &self,
        entity_type: &str,
        entity_id: Uuid,
    ) -> Result<Vec<Activity>, sqlx::Error> {
        sqlx::query_as::<_, Activity>(
            "SELECT * FROM activities WHERE entity_type = $1 AND entity_id = $2 ORDER BY created_at DESC",
        )
        .bind(entity_type)
        .bind(entity_id)
        .fetch_all(&self.pool)
        .await
    }

    pub async fn get_user_recent(
        &self,
        actor_id: Uuid,
        limit: i64,
    ) -> Result<Vec<Activity>, sqlx::Error> {
        sqlx::query_as::<_, Activity>(
            "SELECT * FROM activities WHERE actor_id = $1 ORDER BY created_at DESC LIMIT $2",
        )
        .bind(actor_id)
        .bind(limit)
        .fetch_all(&self.pool)
        .await
    }
}
```

- [ ] **Step 5: Register in mod.rs + Verify + Commit**

```bash
cargo check -p signapps-db
git add crates/signapps-db/migrations/20260324000004_* crates/signapps-db/src/models/activity.rs crates/signapps-db/src/repositories/activity_repository.rs crates/signapps-db/src/models/mod.rs crates/signapps-db/src/repositories/mod.rs
git commit -m "feat(db): add activities table — unified cross-service activity feed"
```

---

## Phase 3: Signature Workflows

### Task 7: Signature Envelopes + Steps + Transitions — Migration + Models + Repository + State Machine

**Files:**
- Create: `crates/signapps-db/migrations/20260324000005_signature_envelopes.up.sql`
- Create: `crates/signapps-db/migrations/20260324000005_signature_envelopes.down.sql`
- Create: `crates/signapps-db/src/models/signature.rs`
- Create: `crates/signapps-db/src/repositories/signature_repository.rs`
- Modify: `crates/signapps-db/src/models/mod.rs`
- Modify: `crates/signapps-db/src/repositories/mod.rs`

- [ ] **Step 1: Create signature envelopes migration (up)**

```sql
-- 20260324000005_signature_envelopes.up.sql
CREATE TABLE signature_envelopes (
    id UUID PRIMARY KEY DEFAULT gen_uuid_v7(),
    title TEXT NOT NULL,
    document_id UUID NOT NULL,
    created_by UUID NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'sent', 'in_progress', 'completed', 'declined', 'expired', 'voided')),
    expires_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_envelopes_status ON signature_envelopes(status);
CREATE INDEX idx_envelopes_creator ON signature_envelopes(created_by, created_at DESC);
CREATE INDEX idx_envelopes_document ON signature_envelopes(document_id);
CREATE INDEX idx_envelopes_metadata ON signature_envelopes USING GIN(metadata);

CREATE TABLE envelope_steps (
    id UUID PRIMARY KEY DEFAULT gen_uuid_v7(),
    envelope_id UUID NOT NULL REFERENCES signature_envelopes(id) ON DELETE CASCADE,
    step_order SMALLINT NOT NULL,
    signer_email BYTEA NOT NULL,
    signer_user_id UUID,
    signer_name BYTEA,
    action VARCHAR(20) NOT NULL DEFAULT 'sign'
        CHECK (action IN ('sign', 'approve', 'witness', 'acknowledge', 'delegate')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'notified', 'viewed', 'signed', 'declined', 'delegated', 'expired')),
    signed_at TIMESTAMPTZ,
    signature_hash CHAR(64),
    ip_address INET,
    user_agent TEXT,
    decline_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(envelope_id, step_order)
);
CREATE INDEX idx_steps_envelope ON envelope_steps(envelope_id, step_order);
CREATE INDEX idx_steps_signer ON envelope_steps(signer_user_id);
CREATE INDEX idx_steps_status ON envelope_steps(status);

CREATE TABLE envelope_transitions (
    id UUID PRIMARY KEY DEFAULT gen_uuid_v7(),
    envelope_id UUID NOT NULL REFERENCES signature_envelopes(id),
    step_id UUID REFERENCES envelope_steps(id),
    from_status VARCHAR(20) NOT NULL,
    to_status VARCHAR(20) NOT NULL,
    triggered_by UUID,
    reason TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_transitions_envelope ON envelope_transitions(envelope_id, created_at);
```

- [ ] **Step 2: Create down migration**

```sql
-- 20260324000005_signature_envelopes.down.sql
DROP TABLE IF EXISTS envelope_transitions;
DROP TABLE IF EXISTS envelope_steps;
DROP TABLE IF EXISTS signature_envelopes;
```

- [ ] **Step 3: Create models with enums + state machine validation**

Create `crates/signapps-db/src/models/signature.rs`:
```rust
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// --- Enums ---

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "snake_case")]
pub enum EnvelopeStatus {
    Draft,
    Sent,
    InProgress,
    Completed,
    Declined,
    Expired,
    Voided,
}

impl EnvelopeStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Draft => "draft",
            Self::Sent => "sent",
            Self::InProgress => "in_progress",
            Self::Completed => "completed",
            Self::Declined => "declined",
            Self::Expired => "expired",
            Self::Voided => "voided",
        }
    }

    /// Returns valid next states from current state.
    pub fn valid_transitions(&self) -> &[EnvelopeStatus] {
        match self {
            Self::Draft => &[Self::Sent, Self::Voided],
            Self::Sent => &[Self::InProgress, Self::Voided, Self::Expired],
            Self::InProgress => &[Self::Completed, Self::Declined, Self::Voided, Self::Expired],
            Self::Completed | Self::Declined | Self::Expired | Self::Voided => &[],
        }
    }

    pub fn can_transition_to(&self, target: EnvelopeStatus) -> bool {
        self.valid_transitions().contains(&target)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "snake_case")]
pub enum StepStatus {
    Pending,
    Notified,
    Viewed,
    Signed,
    Declined,
    Delegated,
    Expired,
}

impl StepStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Pending => "pending",
            Self::Notified => "notified",
            Self::Viewed => "viewed",
            Self::Signed => "signed",
            Self::Declined => "declined",
            Self::Delegated => "delegated",
            Self::Expired => "expired",
        }
    }

    pub fn valid_transitions(&self) -> &[StepStatus] {
        match self {
            Self::Pending => &[Self::Notified, Self::Expired],
            Self::Notified => &[Self::Viewed, Self::Expired],
            Self::Viewed => &[Self::Signed, Self::Declined, Self::Delegated, Self::Expired],
            Self::Signed | Self::Declined | Self::Delegated | Self::Expired => &[],
        }
    }

    pub fn can_transition_to(&self, target: StepStatus) -> bool {
        self.valid_transitions().contains(&target)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "snake_case")]
pub enum StepAction {
    Sign,
    Approve,
    Witness,
    Acknowledge,
    Delegate,
}

// --- Structs ---

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SignatureEnvelope {
    pub id: Uuid,
    pub title: String,
    pub document_id: Uuid,
    pub created_by: Uuid,
    pub status: String,
    pub expires_at: Option<DateTime<Utc>>,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct EnvelopeStep {
    pub id: Uuid,
    pub envelope_id: Uuid,
    pub step_order: i16,
    pub signer_email: Vec<u8>,
    pub signer_user_id: Option<Uuid>,
    pub signer_name: Option<Vec<u8>>,
    pub action: String,
    pub status: String,
    pub signed_at: Option<DateTime<Utc>>,
    pub signature_hash: Option<String>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub decline_reason: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct EnvelopeTransition {
    pub id: Uuid,
    pub envelope_id: Uuid,
    pub step_id: Option<Uuid>,
    pub from_status: String,
    pub to_status: String,
    pub triggered_by: Option<Uuid>,
    pub reason: Option<String>,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

// --- Input types ---

#[derive(Debug, Deserialize)]
pub struct CreateEnvelope {
    pub title: String,
    pub document_id: Uuid,
    pub expires_at: Option<DateTime<Utc>>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct CreateStep {
    pub signer_email: Vec<u8>,
    pub signer_user_id: Option<Uuid>,
    pub signer_name: Option<Vec<u8>>,
    pub action: Option<String>,
}
```

- [ ] **Step 4: Create repository with state machine enforcement**

Create `crates/signapps-db/src/repositories/signature_repository.rs`:
```rust
use crate::models::signature::*;
use sqlx::PgPool;
use uuid::Uuid;

pub struct SignatureRepository {
    pool: PgPool,
}

impl SignatureRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    // --- Envelopes ---

    pub async fn create_envelope(
        &self,
        created_by: Uuid,
        input: &CreateEnvelope,
    ) -> Result<SignatureEnvelope, sqlx::Error> {
        sqlx::query_as::<_, SignatureEnvelope>(
            r#"INSERT INTO signature_envelopes (id, title, document_id, created_by, expires_at, metadata)
               VALUES (gen_uuid_v7(), $1, $2, $3, $4, COALESCE($5, '{}'))
               RETURNING *"#,
        )
        .bind(&input.title)
        .bind(input.document_id)
        .bind(created_by)
        .bind(input.expires_at)
        .bind(&input.metadata)
        .fetch_one(&self.pool)
        .await
    }

    pub async fn get_envelope(&self, id: Uuid) -> Result<Option<SignatureEnvelope>, sqlx::Error> {
        sqlx::query_as::<_, SignatureEnvelope>(
            "SELECT * FROM signature_envelopes WHERE id = $1 AND deleted_at IS NULL",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
    }

    pub async fn list_by_user(
        &self,
        user_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<SignatureEnvelope>, sqlx::Error> {
        sqlx::query_as::<_, SignatureEnvelope>(
            r#"SELECT * FROM signature_envelopes
               WHERE created_by = $1 AND deleted_at IS NULL
               ORDER BY created_at DESC LIMIT $2 OFFSET $3"#,
        )
        .bind(user_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await
    }

    /// Transition envelope status with state machine validation.
    /// Returns error if transition is invalid.
    pub async fn transition_envelope(
        &self,
        id: Uuid,
        to_status: EnvelopeStatus,
        triggered_by: Option<Uuid>,
        reason: Option<&str>,
    ) -> Result<SignatureEnvelope, String> {
        let envelope = self.get_envelope(id).await
            .map_err(|e| format!("db error: {e}"))?
            .ok_or_else(|| "envelope not found".to_string())?;

        let from = parse_envelope_status(&envelope.status)?;
        if !from.can_transition_to(to_status) {
            return Err(format!(
                "invalid transition: {} -> {}",
                from.as_str(),
                to_status.as_str()
            ));
        }

        let mut tx = self.pool.begin().await.map_err(|e| format!("tx error: {e}"))?;

        sqlx::query(
            "UPDATE signature_envelopes SET status = $1, updated_at = now() WHERE id = $2",
        )
        .bind(to_status.as_str())
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("update error: {e}"))?;

        sqlx::query(
            r#"INSERT INTO envelope_transitions (id, envelope_id, from_status, to_status, triggered_by, reason)
               VALUES (gen_uuid_v7(), $1, $2, $3, $4, $5)"#,
        )
        .bind(id)
        .bind(from.as_str())
        .bind(to_status.as_str())
        .bind(triggered_by)
        .bind(reason)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("transition log error: {e}"))?;

        tx.commit().await.map_err(|e| format!("commit error: {e}"))?;

        self.get_envelope(id).await
            .map_err(|e| format!("fetch error: {e}"))?
            .ok_or_else(|| "envelope disappeared".to_string())
    }

    // --- Steps ---

    pub async fn add_step(
        &self,
        envelope_id: Uuid,
        step_order: i16,
        input: &CreateStep,
    ) -> Result<EnvelopeStep, sqlx::Error> {
        sqlx::query_as::<_, EnvelopeStep>(
            r#"INSERT INTO envelope_steps (id, envelope_id, step_order, signer_email, signer_user_id, signer_name, action)
               VALUES (gen_uuid_v7(), $1, $2, $3, $4, $5, COALESCE($6, 'sign'))
               RETURNING *"#,
        )
        .bind(envelope_id)
        .bind(step_order)
        .bind(&input.signer_email)
        .bind(input.signer_user_id)
        .bind(&input.signer_name)
        .bind(&input.action)
        .fetch_one(&self.pool)
        .await
    }

    pub async fn get_steps(&self, envelope_id: Uuid) -> Result<Vec<EnvelopeStep>, sqlx::Error> {
        sqlx::query_as::<_, EnvelopeStep>(
            "SELECT * FROM envelope_steps WHERE envelope_id = $1 ORDER BY step_order",
        )
        .bind(envelope_id)
        .fetch_all(&self.pool)
        .await
    }

    /// Transition step status with state machine validation.
    pub async fn transition_step(
        &self,
        step_id: Uuid,
        to_status: StepStatus,
        triggered_by: Option<Uuid>,
        signature_hash: Option<&str>,
        ip_address: Option<&str>,
        user_agent: Option<&str>,
        decline_reason: Option<&str>,
    ) -> Result<EnvelopeStep, String> {
        let step = sqlx::query_as::<_, EnvelopeStep>(
            "SELECT * FROM envelope_steps WHERE id = $1",
        )
        .bind(step_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| format!("db error: {e}"))?
        .ok_or_else(|| "step not found".to_string())?;

        let from = parse_step_status(&step.status)?;
        if !from.can_transition_to(to_status) {
            return Err(format!(
                "invalid step transition: {} -> {}",
                from.as_str(),
                to_status.as_str()
            ));
        }

        let mut tx = self.pool.begin().await.map_err(|e| format!("tx error: {e}"))?;

        let signed_at = if to_status == StepStatus::Signed {
            Some(chrono::Utc::now())
        } else {
            None
        };

        sqlx::query(
            r#"UPDATE envelope_steps
               SET status = $1, updated_at = now(), signed_at = COALESCE($2, signed_at),
                   signature_hash = COALESCE($3, signature_hash),
                   ip_address = COALESCE($4::INET, ip_address),
                   user_agent = COALESCE($5, user_agent),
                   decline_reason = COALESCE($6, decline_reason)
               WHERE id = $7"#,
        )
        .bind(to_status.as_str())
        .bind(signed_at)
        .bind(signature_hash)
        .bind(ip_address)
        .bind(user_agent)
        .bind(decline_reason)
        .bind(step_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("update error: {e}"))?;

        sqlx::query(
            r#"INSERT INTO envelope_transitions (id, envelope_id, step_id, from_status, to_status, triggered_by)
               VALUES (gen_uuid_v7(), $1, $2, $3, $4, $5)"#,
        )
        .bind(step.envelope_id)
        .bind(step_id)
        .bind(from.as_str())
        .bind(to_status.as_str())
        .bind(triggered_by)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("transition log error: {e}"))?;

        tx.commit().await.map_err(|e| format!("commit error: {e}"))?;

        sqlx::query_as::<_, EnvelopeStep>("SELECT * FROM envelope_steps WHERE id = $1")
            .bind(step_id)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| format!("fetch error: {e}"))
    }

    // --- Transitions (read-only) ---

    pub async fn get_transitions(
        &self,
        envelope_id: Uuid,
    ) -> Result<Vec<EnvelopeTransition>, sqlx::Error> {
        sqlx::query_as::<_, EnvelopeTransition>(
            "SELECT * FROM envelope_transitions WHERE envelope_id = $1 ORDER BY created_at",
        )
        .bind(envelope_id)
        .fetch_all(&self.pool)
        .await
    }
}

fn parse_envelope_status(s: &str) -> Result<EnvelopeStatus, String> {
    match s {
        "draft" => Ok(EnvelopeStatus::Draft),
        "sent" => Ok(EnvelopeStatus::Sent),
        "in_progress" => Ok(EnvelopeStatus::InProgress),
        "completed" => Ok(EnvelopeStatus::Completed),
        "declined" => Ok(EnvelopeStatus::Declined),
        "expired" => Ok(EnvelopeStatus::Expired),
        "voided" => Ok(EnvelopeStatus::Voided),
        _ => Err(format!("unknown envelope status: {s}")),
    }
}

fn parse_step_status(s: &str) -> Result<StepStatus, String> {
    match s {
        "pending" => Ok(StepStatus::Pending),
        "notified" => Ok(StepStatus::Notified),
        "viewed" => Ok(StepStatus::Viewed),
        "signed" => Ok(StepStatus::Signed),
        "declined" => Ok(StepStatus::Declined),
        "delegated" => Ok(StepStatus::Delegated),
        "expired" => Ok(StepStatus::Expired),
        _ => Err(format!("unknown step status: {s}")),
    }
}
```

- [ ] **Step 5: Register in mod.rs + Verify + Commit**

```bash
cargo check -p signapps-db
git add crates/signapps-db/migrations/20260324000005_* crates/signapps-db/src/models/signature.rs crates/signapps-db/src/repositories/signature_repository.rs crates/signapps-db/src/models/mod.rs crates/signapps-db/src/repositories/mod.rs
git commit -m "feat(db): add signature envelopes — workflow state machine with steps + transitions"
```

---

### Task 8: LISTEN/NOTIFY Triggers + PgListener Helper

**Files:**
- Create: `crates/signapps-db/migrations/20260324000006_notify_triggers.up.sql`
- Create: `crates/signapps-db/migrations/20260324000006_notify_triggers.down.sql`
- Create: `crates/signapps-common/src/pg_listener.rs`
- Modify: `crates/signapps-common/src/lib.rs`

- [ ] **Step 1: Create NOTIFY triggers migration (up)**

```sql
-- 20260324000006_notify_triggers.up.sql

-- Signature events channel
CREATE OR REPLACE FUNCTION notify_signature_event() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('signature_events', json_build_object(
        'action', TG_OP,
        'table', TG_TABLE_NAME,
        'id', NEW.id,
        'envelope_id', CASE WHEN TG_TABLE_NAME = 'envelope_steps' THEN NEW.envelope_id ELSE NEW.id END,
        'status', NEW.status
    )::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_envelope_notify
    AFTER INSERT OR UPDATE ON signature_envelopes
    FOR EACH ROW EXECUTE FUNCTION notify_signature_event();

CREATE TRIGGER trg_step_notify
    AFTER INSERT OR UPDATE ON envelope_steps
    FOR EACH ROW EXECUTE FUNCTION notify_signature_event();

-- Generic entity change channel
CREATE OR REPLACE FUNCTION notify_entity_change() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('entity_changes', json_build_object(
        'table', TG_TABLE_NAME,
        'action', TG_OP,
        'id', NEW.id
    )::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_entity_ref_notify
    AFTER INSERT OR UPDATE ON entity_references
    FOR EACH ROW EXECUTE FUNCTION notify_entity_change();

CREATE TRIGGER trg_activity_notify
    AFTER INSERT ON activities
    FOR EACH ROW EXECUTE FUNCTION notify_entity_change();
```

- [ ] **Step 2: Create down migration**

```sql
-- 20260324000006_notify_triggers.down.sql
DROP TRIGGER IF EXISTS trg_envelope_notify ON signature_envelopes;
DROP TRIGGER IF EXISTS trg_step_notify ON envelope_steps;
DROP TRIGGER IF EXISTS trg_entity_ref_notify ON entity_references;
DROP TRIGGER IF EXISTS trg_activity_notify ON activities;
DROP FUNCTION IF EXISTS notify_signature_event();
DROP FUNCTION IF EXISTS notify_entity_change();
```

- [ ] **Step 3: Create PgListener helper**

Create `crates/signapps-common/src/pg_listener.rs`:
```rust
use serde::Deserialize;
use sqlx::PgPool;
use tokio::sync::broadcast;

#[derive(Debug, Clone, Deserialize)]
pub struct PgEvent {
    pub table: Option<String>,
    pub action: Option<String>,
    pub id: Option<uuid::Uuid>,
    pub envelope_id: Option<uuid::Uuid>,
    pub status: Option<String>,
}

/// Spawn a background task that listens to PostgreSQL NOTIFY channels
/// and forwards events to a broadcast sender.
pub async fn spawn_pg_listener(
    pool: &PgPool,
    channels: &[&str],
    tx: broadcast::Sender<PgEvent>,
) -> Result<(), sqlx::Error> {
    let mut listener = sqlx::postgres::PgListener::connect_with(pool).await?;
    for ch in channels {
        listener.listen(ch).await?;
    }
    tokio::spawn(async move {
        loop {
            match listener.recv().await {
                Ok(notification) => {
                    if let Ok(event) = serde_json::from_str::<PgEvent>(notification.payload()) {
                        let _ = tx.send(event);
                    }
                }
                Err(e) => {
                    tracing::error!("PgListener error: {e}");
                    tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                }
            }
        }
    });
    Ok(())
}
```

- [ ] **Step 4: Export in lib.rs**

Add to `crates/signapps-common/src/lib.rs`:
```rust
pub mod pg_listener;
```

- [ ] **Step 5: Verify + Commit**

```bash
cargo check -p signapps-common
git add crates/signapps-db/migrations/20260324000006_* crates/signapps-common/src/pg_listener.rs crates/signapps-common/src/lib.rs
git commit -m "feat: add LISTEN/NOTIFY triggers + PgListener helper for real-time events"
```

---

## Phase 4: Schema Evolution

### Task 9: Soft Deletes on Existing Tables

**Files:**
- Create: `crates/signapps-db/migrations/20260324000007_soft_deletes.up.sql`
- Create: `crates/signapps-db/migrations/20260324000007_soft_deletes.down.sql`

- [ ] **Step 1: Create soft deletes migration (up)**

```sql
-- 20260324000007_soft_deletes.up.sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE drive_nodes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE calendars ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE forms ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE form_responses ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
```

- [ ] **Step 2: Create down migration**

```sql
-- 20260324000007_soft_deletes.down.sql
ALTER TABLE users DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE drive_nodes DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE calendars DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE events DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE tasks DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE forms DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE form_responses DROP COLUMN IF EXISTS deleted_at;
```

- [ ] **Step 3: Commit**

```bash
git add crates/signapps-db/migrations/20260324000007_*
git commit -m "feat(db): add soft deletes (deleted_at) on core business tables"
```

---

### Task 10: Cross-Service FK Enrichment

**Files:**
- Create: `crates/signapps-db/migrations/20260324000008_cross_service_fks.up.sql`
- Create: `crates/signapps-db/migrations/20260324000008_cross_service_fks.down.sql`

- [ ] **Step 1: Create FK enrichment migration (up)**

```sql
-- 20260324000008_cross_service_fks.up.sql

-- Drive nodes: document metadata enrichment
ALTER TABLE drive_nodes ADD COLUMN IF NOT EXISTS sha256_hash CHAR(64);
ALTER TABLE drive_nodes ADD COLUMN IF NOT EXISTS mime_type VARCHAR(128);
ALTER TABLE drive_nodes ADD COLUMN IF NOT EXISTS size_bytes BIGINT;
ALTER TABLE drive_nodes ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE drive_nodes ADD COLUMN IF NOT EXISTS encryption_key_id UUID;
ALTER TABLE drive_nodes ADD COLUMN IF NOT EXISTS doc_id UUID;

-- Calendar ↔ Contacts
ALTER TABLE events ADD COLUMN IF NOT EXISTS organizer_contact_id UUID;

-- Forms ↔ Tasks
ALTER TABLE form_responses ADD COLUMN IF NOT EXISTS generated_task_id UUID;

-- Indexes on new FK columns
CREATE INDEX IF NOT EXISTS idx_drive_sha256 ON drive_nodes(sha256_hash) WHERE sha256_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_organizer_contact ON events(organizer_contact_id) WHERE organizer_contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_form_responses_task ON form_responses(generated_task_id) WHERE generated_task_id IS NOT NULL;
```

- [ ] **Step 2: Create down migration**

```sql
-- 20260324000008_cross_service_fks.down.sql
DROP INDEX IF EXISTS idx_drive_sha256;
DROP INDEX IF EXISTS idx_events_organizer_contact;
DROP INDEX IF EXISTS idx_form_responses_task;

ALTER TABLE drive_nodes DROP COLUMN IF EXISTS sha256_hash;
ALTER TABLE drive_nodes DROP COLUMN IF EXISTS mime_type;
ALTER TABLE drive_nodes DROP COLUMN IF EXISTS size_bytes;
ALTER TABLE drive_nodes DROP COLUMN IF EXISTS storage_path;
ALTER TABLE drive_nodes DROP COLUMN IF EXISTS encryption_key_id;
ALTER TABLE drive_nodes DROP COLUMN IF EXISTS doc_id;
ALTER TABLE events DROP COLUMN IF EXISTS organizer_contact_id;
ALTER TABLE form_responses DROP COLUMN IF EXISTS generated_task_id;
```

- [ ] **Step 3: Commit**

```bash
git add crates/signapps-db/migrations/20260324000008_*
git commit -m "feat(db): add cross-service FKs — drive metadata, calendar↔contacts, forms↔tasks"
```

---

### Task 11: Active Views

**Files:**
- Create: `crates/signapps-db/migrations/20260324000009_active_views.up.sql`
- Create: `crates/signapps-db/migrations/20260324000009_active_views.down.sql`

- [ ] **Step 1: Create active views migration (up)**

```sql
-- 20260324000009_active_views.up.sql
CREATE OR REPLACE VIEW active_users AS SELECT * FROM users WHERE deleted_at IS NULL;
CREATE OR REPLACE VIEW active_drive_nodes AS SELECT * FROM drive_nodes WHERE deleted_at IS NULL;
CREATE OR REPLACE VIEW active_calendars AS SELECT * FROM calendars WHERE deleted_at IS NULL;
CREATE OR REPLACE VIEW active_events AS SELECT * FROM events WHERE deleted_at IS NULL;
CREATE OR REPLACE VIEW active_envelopes AS SELECT * FROM signature_envelopes WHERE deleted_at IS NULL;
CREATE OR REPLACE VIEW active_entity_refs AS SELECT * FROM entity_references WHERE deleted_at IS NULL;
```

- [ ] **Step 2: Create down migration**

```sql
-- 20260324000009_active_views.down.sql
DROP VIEW IF EXISTS active_users;
DROP VIEW IF EXISTS active_drive_nodes;
DROP VIEW IF EXISTS active_calendars;
DROP VIEW IF EXISTS active_events;
DROP VIEW IF EXISTS active_envelopes;
DROP VIEW IF EXISTS active_entity_refs;
```

- [ ] **Step 3: Commit**

```bash
git add crates/signapps-db/migrations/20260324000009_*
git commit -m "feat(db): add active_* views for soft-deleted tables"
```

---

## Phase 5: Frontend

### Task 12: TypeScript Types + API Client

**Files:**
- Create: `client/src/types/crosslinks.ts`
- Create: `client/src/lib/api/crosslinks.ts`

- [ ] **Step 1: Create TypeScript types**

Create `client/src/types/crosslinks.ts`:
```typescript
export interface EntityReference {
  id: string;
  source_type: string;
  source_id: string;
  target_type: string;
  target_id: string;
  relation: string;
  created_by?: string;
  created_at: string;
}

export interface Activity {
  id: string;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  entity_title?: string;
  metadata: Record<string, unknown>;
  workspace_id?: string;
  created_at: string;
}

export interface SignatureEnvelope {
  id: string;
  title: string;
  document_id: string;
  created_by: string;
  status: 'draft' | 'sent' | 'in_progress' | 'completed' | 'declined' | 'expired' | 'voided';
  expires_at?: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface EnvelopeStep {
  id: string;
  envelope_id: string;
  step_order: number;
  signer_email: string;
  signer_user_id?: string;
  signer_name?: string;
  action: 'sign' | 'approve' | 'witness' | 'acknowledge' | 'delegate';
  status: 'pending' | 'notified' | 'viewed' | 'signed' | 'declined' | 'delegated' | 'expired';
  signed_at?: string;
  signature_hash?: string;
  decline_reason?: string;
  created_at: string;
}

export interface EnvelopeTransition {
  id: string;
  envelope_id: string;
  step_id?: string;
  from_status: string;
  to_status: string;
  triggered_by?: string;
  reason?: string;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  actor_id?: string;
  actor_ip?: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_data?: Record<string, unknown>;
  new_data?: Record<string, unknown>;
  metadata: Record<string, unknown>;
  workspace_id?: string;
  created_at: string;
}
```

- [ ] **Step 2: Create API client**

Create `client/src/lib/api/crosslinks.ts`:
```typescript
import { getClient, ServiceName } from './factory';
import type {
  EntityReference,
  Activity,
  SignatureEnvelope,
  EnvelopeStep,
  EnvelopeTransition,
  AuditLogEntry,
} from '@/types/crosslinks';

// Use identity service for cross-links routes (core service)
const client = () => getClient(ServiceName.IDENTITY);

// --- Entity References ---
export const linksApi = {
  find: (entityType: string, entityId: string) =>
    client().get<EntityReference[]>(`/links`, { params: { entity_type: entityType, entity_id: entityId } }),

  create: (data: { source_type: string; source_id: string; target_type: string; target_id: string; relation?: string }) =>
    client().post<EntityReference>('/links', data),

  remove: (id: string) =>
    client().delete(`/links/${id}`),
};

// --- Activities ---
export const activitiesApi = {
  feed: (params: { workspace_id?: string; limit?: number; offset?: number }) =>
    client().get<Activity[]>('/activities', { params }),

  entityHistory: (entityType: string, entityId: string) =>
    client().get<Activity[]>('/activities', { params: { entity_type: entityType, entity_id: entityId } }),

  recent: (limit = 20) =>
    client().get<Activity[]>('/activities', { params: { mine: true, limit } }),
};

// --- Signatures ---
export const signaturesApi = {
  create: (data: { title: string; document_id: string; expires_at?: string }) =>
    client().post<SignatureEnvelope>('/signatures', data),

  get: (id: string) =>
    client().get<SignatureEnvelope>(`/signatures/${id}`),

  list: (params?: { limit?: number; offset?: number }) =>
    client().get<SignatureEnvelope[]>('/signatures', { params }),

  send: (id: string) =>
    client().post<SignatureEnvelope>(`/signatures/${id}/send`),

  void: (id: string) =>
    client().post<SignatureEnvelope>(`/signatures/${id}/void`),

  addStep: (envelopeId: string, data: { signer_email: string; signer_name?: string; action?: string }) =>
    client().post<EnvelopeStep>(`/signatures/${envelopeId}/steps`, data),

  getSteps: (envelopeId: string) =>
    client().get<EnvelopeStep[]>(`/signatures/${envelopeId}/steps`),

  signStep: (envelopeId: string, stepId: string) =>
    client().post<EnvelopeStep>(`/signatures/${envelopeId}/steps/${stepId}/sign`),

  declineStep: (envelopeId: string, stepId: string, reason?: string) =>
    client().post<EnvelopeStep>(`/signatures/${envelopeId}/steps/${stepId}/decline`, { reason }),

  transitions: (envelopeId: string) =>
    client().get<EnvelopeTransition[]>(`/signatures/${envelopeId}/transitions`),
};

// --- Audit ---
export const auditApi = {
  query: (params: { entity_type: string; entity_id: string; limit?: number }) =>
    client().get<AuditLogEntry[]>('/audit', { params }),
};
```

- [ ] **Step 3: Commit**

```bash
git add client/src/types/crosslinks.ts client/src/lib/api/crosslinks.ts
git commit -m "feat(frontend): add crosslinks TypeScript types + API client"
```

---

### Task 13: Frontend Components — ActivityFeed, EntityLinks, AuditTrail

**Files:**
- Create: `client/src/components/crosslinks/ActivityFeed.tsx`
- Create: `client/src/components/crosslinks/EntityLinks.tsx`
- Create: `client/src/components/crosslinks/AuditTrail.tsx`

- [ ] **Step 1: Create ActivityFeed component**

Create `client/src/components/crosslinks/ActivityFeed.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';
import { activitiesApi } from '@/lib/api/crosslinks';
import type { Activity } from '@/types/crosslinks';

const ACTION_LABELS: Record<string, string> = {
  created: 'a créé',
  updated: 'a modifié',
  deleted: 'a supprimé',
  shared: 'a partagé',
  signed: 'a signé',
  sent: 'a envoyé',
  uploaded: 'a uploadé',
  declined: 'a refusé',
  approved: 'a approuvé',
};

interface Props {
  workspaceId?: string;
  entityType?: string;
  entityId?: string;
  limit?: number;
}

export function ActivityFeed({ workspaceId, entityType, entityId, limit = 50 }: Props) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = entityType && entityId
          ? await activitiesApi.entityHistory(entityType, entityId)
          : await activitiesApi.feed({ workspace_id: workspaceId, limit });
        setActivities(data);
      } catch (e) {
        console.error('Failed to load activities', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [workspaceId, entityType, entityId, limit]);

  if (loading) return <div className="animate-pulse h-20" />;

  return (
    <div className="space-y-2">
      {activities.map((a) => (
        <div key={a.id} className="flex items-start gap-3 p-2 rounded hover:bg-muted/50">
          <div className="flex-1 min-w-0">
            <p className="text-sm">
              <span className="font-medium">{a.actor_id.slice(0, 8)}</span>{' '}
              {ACTION_LABELS[a.action] || a.action}{' '}
              <span className="text-muted-foreground">{a.entity_type}</span>{' '}
              {a.entity_title && <span className="font-medium">{a.entity_title}</span>}
            </p>
            <time className="text-xs text-muted-foreground">
              {new Date(a.created_at).toLocaleString()}
            </time>
          </div>
        </div>
      ))}
      {activities.length === 0 && <p className="text-sm text-muted-foreground">Aucune activité</p>}
    </div>
  );
}
```

- [ ] **Step 2: Create EntityLinks component**

Create `client/src/components/crosslinks/EntityLinks.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';
import { linksApi } from '@/lib/api/crosslinks';
import type { EntityReference } from '@/types/crosslinks';

const TYPE_LABELS: Record<string, string> = {
  calendar_event: 'Événement',
  mail_message: 'Email',
  drive_node: 'Fichier',
  document: 'Document',
  contact: 'Contact',
  task: 'Tâche',
  signature_envelope: 'Signature',
  form_response: 'Réponse formulaire',
  chat_message: 'Message',
};

interface Props {
  entityType: string;
  entityId: string;
}

export function EntityLinks({ entityType, entityId }: Props) {
  const [links, setLinks] = useState<EntityReference[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    linksApi.find(entityType, entityId)
      .then(({ data }) => setLinks(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [entityType, entityId]);

  if (loading) return <div className="animate-pulse h-10" />;

  const grouped = links.reduce<Record<string, EntityReference[]>>((acc, link) => {
    const otherType = link.source_type === entityType && link.source_id === entityId
      ? link.target_type : link.source_type;
    (acc[otherType] = acc[otherType] || []).push(link);
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Liens associés</h3>
      {Object.entries(grouped).map(([type, refs]) => (
        <div key={type}>
          <p className="text-xs text-muted-foreground mb-1">{TYPE_LABELS[type] || type} ({refs.length})</p>
          {refs.map((ref) => {
            const otherId = ref.source_type === entityType ? ref.target_id : ref.source_id;
            return (
              <div key={ref.id} className="text-sm pl-2 py-0.5 border-l-2 border-muted">
                {otherId.slice(0, 8)}... <span className="text-xs text-muted-foreground">({ref.relation})</span>
              </div>
            );
          })}
        </div>
      ))}
      {links.length === 0 && <p className="text-sm text-muted-foreground">Aucun lien</p>}
    </div>
  );
}
```

- [ ] **Step 3: Create AuditTrail component**

Create `client/src/components/crosslinks/AuditTrail.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';
import { auditApi } from '@/lib/api/crosslinks';
import type { AuditLogEntry } from '@/types/crosslinks';

interface Props {
  entityType: string;
  entityId: string;
  limit?: number;
}

export function AuditTrail({ entityType, entityId, limit = 100 }: Props) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    auditApi.query({ entity_type: entityType, entity_id: entityId, limit })
      .then(({ data }) => setEntries(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [entityType, entityId, limit]);

  if (loading) return <div className="animate-pulse h-20" />;

  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold">Audit Trail</h3>
      <div className="space-y-1 max-h-96 overflow-y-auto">
        {entries.map((e) => (
          <div key={e.id} className="flex items-start gap-2 text-xs p-1.5 rounded hover:bg-muted/50">
            <time className="text-muted-foreground whitespace-nowrap">
              {new Date(e.created_at).toLocaleString()}
            </time>
            <span className="font-mono">{e.action}</span>
            {e.actor_id && <span className="text-muted-foreground">par {e.actor_id.slice(0, 8)}</span>}
          </div>
        ))}
        {entries.length === 0 && <p className="text-sm text-muted-foreground">Aucune entrée</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add client/src/components/crosslinks/
git commit -m "feat(frontend): add ActivityFeed, EntityLinks, AuditTrail components"
```

---

## Verification Checklist

- [ ] `cargo check --workspace` passes
- [ ] `cargo test -p signapps-common` passes (PiiCipher tests)
- [ ] `cargo fmt --all -- --check` passes
- [ ] `cargo clippy --workspace -- -D warnings` passes
- [ ] All 9 migrations have up + down files
- [ ] All new models registered in `models/mod.rs`
- [ ] All new repositories registered in `repositories/mod.rs`
- [ ] Frontend builds: `cd client && npm run build`
