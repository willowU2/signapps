# Design: Architecture Relationnelle Cross-Service + Signature Workflows

**Date**: 2026-03-24
**Status**: Approved
**Scope**: signapps-db, signapps-common, all services, frontend

---

## Summary

Transformer SignApps d'une collection de microservices silotés en une plateforme relationnelle unifiée :
1. **UUID v7** partout (tri temporel + perf index)
2. **Entity References** — liens cross-service polymorphes
3. **Activity Feed** — table unifiée d'activités
4. **Signature Envelopes** — workflow state machine avec étapes ordonnées
5. **Audit Log** — append-only immuable (valeur légale)
6. **Soft Deletes** — `deleted_at` sur toutes les tables métier
7. **FK + CHECK constraints** — intégrité au niveau DB
8. **LISTEN/NOTIFY** — events temps réel natifs PostgreSQL
9. **Chiffrement PII** — `aes-gcm` côté Rust
10. **Indexation** — B-Tree FK + GIN JSONB + pgvector (existant)

**Pas de RLS** pour cette itération.

---

## 1. UUID v7 — Migration Progressive

### Décision
Remplacer `gen_random_uuid()` (v4) par UUID v7 dans toutes les nouvelles tables. Les enregistrements v4 existants restent valides (même format 128-bit).

### Implementation
- Rust: `uuid::Uuid::now_v7()` (crate `uuid` v1.x avec feature `v7`)
- SQL: fonction helper pour les DEFAULT

```sql
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

---

## 2. Entity References — Liens Cross-Service

### Table

```sql
CREATE TABLE entity_references (
    id UUID PRIMARY KEY DEFAULT gen_uuid_v7(),
    source_type VARCHAR(32) NOT NULL,
    source_id UUID NOT NULL,
    target_type VARCHAR(32) NOT NULL,
    target_id UUID NOT NULL,
    relation VARCHAR(32) NOT NULL DEFAULT 'related',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(source_type, source_id, target_type, target_id, relation)
);
CREATE INDEX idx_entity_ref_source ON entity_references(source_type, source_id);
CREATE INDEX idx_entity_ref_target ON entity_references(target_type, target_id);
```

### Entity Types
`calendar_event`, `mail_message`, `drive_node`, `document`, `form_response`, `chat_message`, `contact`, `task`, `signature_envelope`, `envelope_step`

### Relation Types
`related`, `attachment`, `mention`, `created_from`, `reply_to`, `signed_via`, `linked`

---

## 3. Activity Feed — Timeline Unifiée

```sql
CREATE TABLE activities (
    id UUID PRIMARY KEY DEFAULT gen_uuid_v7(),
    actor_id UUID NOT NULL REFERENCES users(id),
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

### Actions
`created`, `updated`, `deleted`, `shared`, `commented`, `uploaded`, `sent`, `signed`, `approved`, `declined`

---

## 4. Signature Envelopes — Workflow State Machine

### Tables

```sql
CREATE TABLE signature_envelopes (
    id UUID PRIMARY KEY DEFAULT gen_uuid_v7(),
    title TEXT NOT NULL,
    document_id UUID NOT NULL REFERENCES drive_nodes(id),
    created_by UUID NOT NULL REFERENCES users(id),
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
    signer_email BYTEA NOT NULL,          -- chiffré AES-GCM
    signer_user_id UUID REFERENCES users(id),
    signer_name BYTEA,                    -- chiffré AES-GCM
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
    triggered_by UUID REFERENCES users(id),
    reason TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_transitions_envelope ON envelope_transitions(envelope_id, created_at);
```

### State Machine Transitions (Envelope)

```
draft → sent → in_progress → completed
         ↓         ↓
       voided    declined
         ↓         ↓
       expired   expired
```

Valid transitions enforced in Rust, logged in `envelope_transitions`.

### State Machine Transitions (Step)

```
pending → notified → viewed → signed
                       ↓
                    declined
                       ↓
                    delegated → (new step created)
                       ↓
                    expired
```

---

## 5. Audit Log — Append-Only Immuable

```sql
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_uuid_v7(),
    actor_id UUID REFERENCES users(id),
    actor_ip INET,
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

---

## 6. Soft Deletes — Pattern Global

### Colonnes à ajouter
`deleted_at TIMESTAMPTZ` sur: `users`, `drive_nodes`, `calendars`, `events`, `tasks`, `contacts`, `signature_envelopes`, `entity_references`, `forms`, `form_responses`, `messages` (mail), `channels` (chat).

**Pas sur**: `audit_log` (immuable), `activities` (log), `envelope_transitions` (historique).

### Vues active_*

```sql
CREATE VIEW active_users AS SELECT * FROM users WHERE deleted_at IS NULL;
CREATE VIEW active_drive_nodes AS SELECT * FROM drive_nodes WHERE deleted_at IS NULL;
CREATE VIEW active_envelopes AS SELECT * FROM signature_envelopes WHERE deleted_at IS NULL;
-- etc. pour chaque table avec soft delete
```

---

## 7. FK Directes — Relations Haute Fréquence

```sql
-- Documents: métadonnées enrichies
ALTER TABLE drive_nodes ADD COLUMN sha256_hash CHAR(64);
ALTER TABLE drive_nodes ADD COLUMN mime_type VARCHAR(128);
ALTER TABLE drive_nodes ADD COLUMN size_bytes BIGINT;
ALTER TABLE drive_nodes ADD COLUMN storage_path TEXT;
ALTER TABLE drive_nodes ADD COLUMN encryption_key_id UUID;
ALTER TABLE drive_nodes ADD COLUMN deleted_at TIMESTAMPTZ;

-- Calendar ↔ Contacts
ALTER TABLE events ADD COLUMN organizer_contact_id UUID REFERENCES contacts(id);

-- Mail ↔ Contacts
ALTER TABLE messages ADD COLUMN sender_contact_id UUID REFERENCES contacts(id);

-- Drive ↔ Docs
ALTER TABLE drive_nodes ADD COLUMN doc_id UUID;

-- Forms ↔ Tasks
ALTER TABLE form_responses ADD COLUMN generated_task_id UUID REFERENCES tasks(id);
```

---

## 8. LISTEN/NOTIFY — Events Temps Réel

```sql
CREATE OR REPLACE FUNCTION notify_signature_event() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('signature_events', json_build_object(
        'action', TG_OP,
        'table', TG_TABLE_NAME,
        'envelope_id', COALESCE(NEW.envelope_id, NEW.id),
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

-- Channel générique pour les cross-service events
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
```

### Rust Listener

```rust
// Dans signapps-common
pub async fn spawn_pg_listener(pool: &PgPool, channels: &[&str], tx: broadcast::Sender<PgEvent>) {
    let mut listener = PgListener::connect_with(pool).await.unwrap();
    for ch in channels {
        listener.listen(ch).await.unwrap();
    }
    tokio::spawn(async move {
        while let Ok(notification) = listener.recv().await {
            let event: PgEvent = serde_json::from_str(notification.payload()).unwrap_or_default();
            let _ = tx.send(event);
        }
    });
}
```

---

## 9. Chiffrement PII — aes-gcm côté Rust

### Champs chiffrés
- `envelope_steps.signer_email` → BYTEA
- `envelope_steps.signer_name` → BYTEA
- Contacts: `email`, `phone` (futur)

### Module Rust (signapps-common)

```rust
pub struct PiiCipher {
    key: aes_gcm::Key<Aes256Gcm>,
}

impl PiiCipher {
    pub fn from_env() -> Self; // lit ENCRYPTION_KEY depuis .env
    pub fn encrypt(&self, plaintext: &str) -> Vec<u8>; // nonce || ciphertext || tag
    pub fn decrypt(&self, ciphertext: &[u8]) -> Result<String>;
}
```

Clé stockée dans `.env`, rotation via re-chiffrement batch.

---

## 10. Rust Models (signapps-db)

### Nouveaux models

```rust
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

pub struct SignatureEnvelope {
    pub id: Uuid,
    pub title: String,
    pub document_id: Uuid,
    pub created_by: Uuid,
    pub status: EnvelopeStatus,
    pub expires_at: Option<DateTime<Utc>>,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

pub struct EnvelopeStep {
    pub id: Uuid,
    pub envelope_id: Uuid,
    pub step_order: i16,
    pub signer_email: Vec<u8>,  // encrypted
    pub signer_user_id: Option<Uuid>,
    pub signer_name: Option<Vec<u8>>,  // encrypted
    pub action: StepAction,
    pub status: StepStatus,
    pub signed_at: Option<DateTime<Utc>>,
    pub signature_hash: Option<String>,
    pub ip_address: Option<IpAddr>,
    pub user_agent: Option<String>,
    pub decline_reason: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

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

pub struct AuditLogEntry {
    pub id: Uuid,
    pub actor_id: Option<Uuid>,
    pub actor_ip: Option<IpAddr>,
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

### Enums

```rust
pub enum EnvelopeStatus { Draft, Sent, InProgress, Completed, Declined, Expired, Voided }
pub enum StepStatus { Pending, Notified, Viewed, Signed, Declined, Delegated, Expired }
pub enum StepAction { Sign, Approve, Witness, Acknowledge, Delegate }
```

---

## 11. Repositories (signapps-db)

```rust
pub struct EntityReferenceRepository;
// link(), unlink(), find_links(entity_type, entity_id), find_reverse_links()

pub struct ActivityRepository;
// log(), get_feed(user_id, limit, offset), get_entity_history(type, id)

pub struct SignatureEnvelopeRepository;
// create(), get(), list_by_user(), transition_status()

pub struct EnvelopeStepRepository;
// create(), get_steps(envelope_id), transition_step()

pub struct AuditLogRepository;
// append(), query(filters)
```

---

## 12. Trait Linkable (signapps-common)

```rust
pub trait Linkable {
    fn entity_type(&self) -> &'static str;
    fn entity_id(&self) -> Uuid;
    fn entity_title(&self) -> String;
}

pub async fn log_activity(
    pool: &PgPool,
    actor: Uuid,
    action: &str,
    entity: &dyn Linkable,
    workspace_id: Option<Uuid>,
    metadata: serde_json::Value,
) -> Result<()>;

pub async fn audit(
    pool: &PgPool,
    actor: Uuid,
    actor_ip: Option<IpAddr>,
    action: &str,
    entity: &dyn Linkable,
    old_data: Option<Value>,
    new_data: Option<Value>,
) -> Result<()>;
```

---

## 13. Frontend Components

| Component | Purpose | API |
|-----------|---------|-----|
| `<ActivityFeed />` | Timeline globale/workspace | `GET /api/v1/activities` |
| `<EntityLinks />` | Panneau latéral liens cross-service | `GET /api/v1/links?entity_type=X&entity_id=Y` |
| `<LinkPicker />` | Modal recherche + liaison | `POST /api/v1/links` |
| `<RecentItems />` | Derniers éléments touchés | `GET /api/v1/activities?actor_id=me&limit=20` |
| `<SignatureWorkflow />` | Visualisation state machine | `GET /api/v1/signatures/:id` |
| `<AuditTrail />` | Historique immuable d'un objet | `GET /api/v1/audit?entity_type=X&entity_id=Y` |

### API Routes (nouveau router dans signapps-common ou service dédié)

```
GET    /api/v1/links?source_type=&source_id=
POST   /api/v1/links
DELETE  /api/v1/links/:id  (soft delete)

GET    /api/v1/activities?workspace_id=&limit=&offset=
GET    /api/v1/activities?entity_type=&entity_id=

POST   /api/v1/signatures
GET    /api/v1/signatures/:id
POST   /api/v1/signatures/:id/send
POST   /api/v1/signatures/:id/steps/:step_id/sign
POST   /api/v1/signatures/:id/steps/:step_id/decline
POST   /api/v1/signatures/:id/void

GET    /api/v1/audit?entity_type=&entity_id=&limit=
```

---

## 14. Migration Order

1. `gen_uuid_v7()` function
2. `audit_log` + immutability trigger
3. `entity_references`
4. `activities`
5. `signature_envelopes` + `envelope_steps` + `envelope_transitions`
6. `notify_signature_event()` + `notify_entity_change()` triggers
7. ALTER existing tables: soft deletes (`deleted_at`)
8. ALTER existing tables: FK directes (drive_nodes enrichment, events↔contacts, mail↔contacts, forms↔tasks)
9. CREATE views `active_*`
