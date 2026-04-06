# Org→AD Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically synchronize the org-structure hierarchy into Active Directory objects (OUs, Users, Computers, Groups) with event-driven queue, multi-site DC management, snapshots, and integrated mail provisioning.

**Architecture:** Event-sourced sync engine — org changes emit events into `ad_sync_queue`, an async worker in signapps-dc consumes them and applies AD operations. A 15-minute reconciliation cron catches drift. Mail accounts are auto-provisioned with shared IMAP folder mailboxes per OU.

**Tech Stack:** Rust (Axum/Tokio/sqlx), PostgreSQL LISTEN/NOTIFY, rcgen (X.509), signapps-mail (IMAP), Next.js 16 (React 19)

---

## Phase 1: Schema Foundation (Migrations 224-231)

### Task 1: Migration 224 — AD object tables (OUs, Users, Computers)

**Files:**
- Create: `migrations/224_ad_objects.sql`

- [ ] **Step 1: Write migration SQL**

```sql
-- migrations/224_ad_objects.sql
-- AD object tables: OUs, User Accounts, Computer Accounts

CREATE TABLE ad_ous (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES infrastructure.domains(id) ON DELETE CASCADE,
    node_id UUID NOT NULL REFERENCES core.org_nodes(id) ON DELETE CASCADE,
    distinguished_name TEXT NOT NULL,
    parent_ou_id UUID REFERENCES ad_ous(id),
    guid TEXT,
    mail_distribution_enabled BOOLEAN DEFAULT true,
    sync_status TEXT DEFAULT 'pending'
        CHECK (sync_status IN ('pending', 'synced', 'error', 'orphan')),
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(domain_id, node_id)
);

CREATE INDEX idx_ad_ous_domain ON ad_ous(domain_id);
CREATE INDEX idx_ad_ous_node ON ad_ous(node_id);

CREATE TABLE ad_user_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES infrastructure.domains(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES core.persons(id) ON DELETE CASCADE,
    ou_id UUID REFERENCES ad_ous(id),
    sam_account_name TEXT NOT NULL,
    user_principal_name TEXT NOT NULL,
    distinguished_name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    title TEXT,
    department TEXT,
    mail TEXT,
    mail_domain_id UUID REFERENCES infrastructure.domains(id),
    account_flags INT DEFAULT 512,
    object_sid TEXT,
    password_must_change BOOLEAN DEFAULT true,
    is_enabled BOOLEAN DEFAULT true,
    sync_status TEXT DEFAULT 'pending'
        CHECK (sync_status IN ('pending', 'synced', 'error', 'disabled')),
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(domain_id, sam_account_name),
    UNIQUE(domain_id, person_id)
);

CREATE INDEX idx_ad_users_domain ON ad_user_accounts(domain_id);
CREATE INDEX idx_ad_users_person ON ad_user_accounts(person_id);
CREATE INDEX idx_ad_users_ou ON ad_user_accounts(ou_id);

CREATE TABLE ad_computer_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES infrastructure.domains(id) ON DELETE CASCADE,
    hardware_id UUID,
    sam_account_name TEXT NOT NULL,
    distinguished_name TEXT NOT NULL,
    dns_hostname TEXT,
    os_name TEXT,
    os_version TEXT,
    object_sid TEXT,
    is_enabled BOOLEAN DEFAULT true,
    sync_status TEXT DEFAULT 'pending'
        CHECK (sync_status IN ('pending', 'synced', 'error', 'disabled')),
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(domain_id, sam_account_name)
);

CREATE INDEX idx_ad_computers_domain ON ad_computer_accounts(domain_id);
```

- [ ] **Step 2: Execute migration**

Run: `cat migrations/224_ad_objects.sql | docker exec -i signapps-postgres psql -U signapps -d signapps`
Expected: `CREATE TABLE` x3, `CREATE INDEX` x5

- [ ] **Step 3: Commit**

```bash
git add migrations/224_ad_objects.sql
git commit -m "feat(ad-sync): migration 224 — ad_ous, ad_user_accounts, ad_computer_accounts"
```

---

### Task 2: Migration 225 — Security Groups + Members

**Files:**
- Create: `migrations/225_ad_groups.sql`

- [ ] **Step 1: Write migration SQL**

```sql
-- migrations/225_ad_groups.sql
-- AD Security Groups and group membership

CREATE TABLE ad_security_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES infrastructure.domains(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL
        CHECK (source_type IN ('org_group', 'team', 'position')),
    source_id UUID NOT NULL,
    sam_account_name TEXT NOT NULL,
    distinguished_name TEXT NOT NULL,
    display_name TEXT,
    group_scope TEXT DEFAULT 'global'
        CHECK (group_scope IN ('domain_local', 'global', 'universal')),
    group_type TEXT DEFAULT 'security'
        CHECK (group_type IN ('security', 'distribution')),
    object_sid TEXT,
    sync_status TEXT DEFAULT 'pending'
        CHECK (sync_status IN ('pending', 'synced', 'error', 'orphan')),
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(domain_id, sam_account_name)
);

CREATE INDEX idx_ad_groups_domain ON ad_security_groups(domain_id);
CREATE INDEX idx_ad_groups_source ON ad_security_groups(source_type, source_id);

CREATE TABLE ad_group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES ad_security_groups(id) ON DELETE CASCADE,
    member_type TEXT NOT NULL
        CHECK (member_type IN ('user', 'computer', 'group')),
    member_id UUID NOT NULL,
    sync_status TEXT DEFAULT 'pending',
    UNIQUE(group_id, member_type, member_id)
);

CREATE INDEX idx_ad_gm_group ON ad_group_members(group_id);
```

- [ ] **Step 2: Execute migration**

Run: `cat migrations/225_ad_groups.sql | docker exec -i signapps-postgres psql -U signapps -d signapps`
Expected: `CREATE TABLE` x2, `CREATE INDEX` x3

- [ ] **Step 3: Commit**

```bash
git add migrations/225_ad_groups.sql
git commit -m "feat(ad-sync): migration 225 — ad_security_groups, ad_group_members"
```

---

### Task 3: Migration 226 — Sync Queue

**Files:**
- Create: `migrations/226_ad_sync_queue.sql`

- [ ] **Step 1: Write migration SQL**

```sql
-- migrations/226_ad_sync_queue.sql
-- Event queue for org→AD synchronization

CREATE TABLE ad_sync_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES infrastructure.domains(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    target_site_id UUID,
    target_dc_id UUID,
    priority INT DEFAULT 5,
    status TEXT DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'retry', 'dead')),
    attempts INT DEFAULT 0,
    max_attempts INT DEFAULT 5,
    next_retry_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX idx_sync_queue_pending ON ad_sync_queue(status, priority, next_retry_at)
    WHERE status IN ('pending', 'retry');
CREATE INDEX idx_sync_queue_domain ON ad_sync_queue(domain_id);
CREATE INDEX idx_sync_queue_created ON ad_sync_queue(created_at DESC);

-- Notification function for real-time wakeup
CREATE OR REPLACE FUNCTION ad_sync_notify() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('ad_sync_events', NEW.id::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ad_sync_notify
    AFTER INSERT ON ad_sync_queue
    FOR EACH ROW
    EXECUTE FUNCTION ad_sync_notify();
```

- [ ] **Step 2: Execute migration**

Run: `cat migrations/226_ad_sync_queue.sql | docker exec -i signapps-postgres psql -U signapps -d signapps`
Expected: `CREATE TABLE`, `CREATE INDEX` x3, `CREATE FUNCTION`, `CREATE TRIGGER`

- [ ] **Step 3: Commit**

```bash
git add migrations/226_ad_sync_queue.sql
git commit -m "feat(ad-sync): migration 226 — ad_sync_queue with NOTIFY trigger"
```

---

### Task 4: Migration 227 — Mail domain mapping

**Files:**
- Create: `migrations/227_ad_node_mail_domains.sql`

- [ ] **Step 1: Write migration SQL**

```sql
-- migrations/227_ad_node_mail_domains.sql
-- Maps org nodes to mail domains (inheritance via closure table)

CREATE TABLE ad_node_mail_domains (
    node_id UUID PRIMARY KEY REFERENCES core.org_nodes(id) ON DELETE CASCADE,
    domain_id UUID NOT NULL REFERENCES infrastructure.domains(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_node_mail_domain ON ad_node_mail_domains(domain_id);
```

- [ ] **Step 2: Execute migration**

Run: `cat migrations/227_ad_node_mail_domains.sql | docker exec -i signapps-postgres psql -U signapps -d signapps`
Expected: `CREATE TABLE`, `CREATE INDEX`

- [ ] **Step 3: Commit**

```bash
git add migrations/227_ad_node_mail_domains.sql
git commit -m "feat(ad-sync): migration 227 — ad_node_mail_domains"
```

---

### Task 5: Migration 228 — DC sites + FSMO roles

**Files:**
- Create: `migrations/228_ad_dc_management.sql`

- [ ] **Step 1: Write migration SQL**

```sql
-- migrations/228_ad_dc_management.sql
-- DC site topology and FSMO role tracking

CREATE TABLE ad_dc_sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES infrastructure.domains(id) ON DELETE CASCADE,
    site_id UUID,
    dc_hostname TEXT NOT NULL,
    dc_ip TEXT NOT NULL,
    dc_role TEXT DEFAULT 'rwdc'
        CHECK (dc_role IN ('primary_rwdc', 'rwdc', 'rodc')),
    dc_status TEXT DEFAULT 'provisioning'
        CHECK (dc_status IN ('provisioning', 'online', 'degraded', 'offline', 'decommissioning')),
    is_writable BOOLEAN DEFAULT true,
    is_primary BOOLEAN DEFAULT false,
    replication_partner_id UUID REFERENCES ad_dc_sites(id),
    promoted_at TIMESTAMPTZ,
    demoted_at TIMESTAMPTZ,
    last_heartbeat_at TIMESTAMPTZ,
    last_replication_at TIMESTAMPTZ,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(domain_id, dc_hostname)
);

CREATE INDEX idx_dc_sites_domain ON ad_dc_sites(domain_id);
CREATE INDEX idx_dc_sites_site ON ad_dc_sites(site_id);
CREATE INDEX idx_dc_sites_status ON ad_dc_sites(dc_status) WHERE dc_status = 'online';

CREATE TABLE ad_fsmo_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES infrastructure.domains(id) ON DELETE CASCADE,
    role TEXT NOT NULL
        CHECK (role IN ('schema_master', 'domain_naming', 'rid_master', 'pdc_emulator', 'infrastructure_master')),
    dc_id UUID NOT NULL REFERENCES ad_dc_sites(id),
    transferred_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(domain_id, role)
);
```

- [ ] **Step 2: Execute migration**

Run: `cat migrations/228_ad_dc_management.sql | docker exec -i signapps-postgres psql -U signapps -d signapps`
Expected: `CREATE TABLE` x2, `CREATE INDEX` x3

- [ ] **Step 3: Commit**

```bash
git add migrations/228_ad_dc_management.sql
git commit -m "feat(ad-sync): migration 228 — ad_dc_sites, ad_fsmo_roles"
```

---

### Task 6: Migration 229 — Snapshots

**Files:**
- Create: `migrations/229_ad_snapshots.sql`

- [ ] **Step 1: Write migration SQL**

```sql
-- migrations/229_ad_snapshots.sql
-- AD backup snapshots with manifest for granular restore

CREATE TABLE ad_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES infrastructure.domains(id) ON DELETE CASCADE,
    dc_id UUID REFERENCES ad_dc_sites(id),
    snapshot_type TEXT NOT NULL
        CHECK (snapshot_type IN ('full', 'incremental', 'pre_migration', 'pre_restore')),
    storage_path TEXT NOT NULL,
    manifest JSONB DEFAULT '{}',
    tables_included TEXT[] DEFAULT '{}',
    size_bytes BIGINT DEFAULT 0,
    checksum_sha256 TEXT,
    status TEXT DEFAULT 'creating'
        CHECK (status IN ('creating', 'completed', 'restoring', 'expired', 'failed')),
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ
);

CREATE INDEX idx_snapshots_domain ON ad_snapshots(domain_id);
CREATE INDEX idx_snapshots_type ON ad_snapshots(snapshot_type, created_at DESC);
CREATE INDEX idx_snapshots_status ON ad_snapshots(status) WHERE status IN ('creating', 'restoring');
```

- [ ] **Step 2: Execute migration**

Run: `cat migrations/229_ad_snapshots.sql | docker exec -i signapps-postgres psql -U signapps -d signapps`
Expected: `CREATE TABLE`, `CREATE INDEX` x3

- [ ] **Step 3: Commit**

```bash
git add migrations/229_ad_snapshots.sql
git commit -m "feat(ad-sync): migration 229 — ad_snapshots"
```

---

### Task 7: Migration 230 — Mail aliases + shared mailboxes

**Files:**
- Create: `migrations/230_ad_mail.sql`

- [ ] **Step 1: Write migration SQL**

```sql
-- migrations/230_ad_mail.sql
-- User mail aliases and shared OU/Group mailboxes (IMAP folders)

CREATE TABLE ad_mail_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_account_id UUID NOT NULL REFERENCES ad_user_accounts(id) ON DELETE CASCADE,
    mail_address TEXT NOT NULL,
    domain_id UUID NOT NULL REFERENCES infrastructure.domains(id),
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(mail_address)
);

CREATE INDEX idx_mail_aliases_user ON ad_mail_aliases(user_account_id);

CREATE TABLE ad_shared_mailboxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ou_id UUID REFERENCES ad_ous(id) ON DELETE CASCADE,
    group_id UUID REFERENCES ad_security_groups(id) ON DELETE CASCADE,
    mail_address TEXT NOT NULL,
    domain_id UUID NOT NULL REFERENCES infrastructure.domains(id),
    display_name TEXT NOT NULL,
    config JSONB DEFAULT '{"shared_mailbox_enabled":true,"shared_mailbox_visible_to_children":true,"shared_mailbox_send_as":"members","shared_mailbox_auto_subscribe":true}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(mail_address),
    CHECK (ou_id IS NOT NULL OR group_id IS NOT NULL)
);

CREATE INDEX idx_shared_mbox_ou ON ad_shared_mailboxes(ou_id);
CREATE INDEX idx_shared_mbox_group ON ad_shared_mailboxes(group_id);

CREATE TABLE ad_shared_mailbox_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mailbox_id UUID NOT NULL REFERENCES ad_shared_mailboxes(id) ON DELETE CASCADE,
    user_account_id UUID NOT NULL REFERENCES ad_user_accounts(id) ON DELETE CASCADE,
    imap_folder_path TEXT NOT NULL,
    can_send_as BOOLEAN DEFAULT false,
    is_subscribed BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(mailbox_id, user_account_id)
);

CREATE INDEX idx_mbox_sub_user ON ad_shared_mailbox_subscriptions(user_account_id);
CREATE INDEX idx_mbox_sub_mailbox ON ad_shared_mailbox_subscriptions(mailbox_id);
```

- [ ] **Step 2: Execute migration**

Run: `cat migrations/230_ad_mail.sql | docker exec -i signapps-postgres psql -U signapps -d signapps`
Expected: `CREATE TABLE` x3, `CREATE INDEX` x4

- [ ] **Step 3: Commit**

```bash
git add migrations/230_ad_mail.sql
git commit -m "feat(ad-sync): migration 230 — ad_mail_aliases, ad_shared_mailboxes, ad_shared_mailbox_subscriptions"
```

---

### Task 8: Migration 231 — NOTIFY triggers on org tables

**Files:**
- Create: `migrations/231_ad_sync_triggers.sql`

- [ ] **Step 1: Write migration SQL**

```sql
-- migrations/231_ad_sync_triggers.sql
-- Emit events into ad_sync_queue when org objects change

-- Helper: enqueue a sync event
CREATE OR REPLACE FUNCTION ad_sync_enqueue(
    p_domain_id UUID,
    p_event_type TEXT,
    p_payload JSONB,
    p_priority INT DEFAULT 5
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO ad_sync_queue (domain_id, event_type, payload, priority)
    VALUES (p_domain_id, p_event_type, p_payload, p_priority)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Resolve domain_id for an org node (via its tree's tenant → first active AD domain)
CREATE OR REPLACE FUNCTION ad_sync_resolve_domain(p_node_id UUID) RETURNS UUID AS $$
DECLARE
    v_domain_id UUID;
BEGIN
    SELECT d.id INTO v_domain_id
    FROM infrastructure.domains d
    JOIN core.org_trees t ON t.tenant_id = d.tenant_id
    JOIN core.org_nodes n ON n.tree_id = t.id
    WHERE n.id = p_node_id AND d.ad_enabled = true AND d.is_active = true
    LIMIT 1;
    RETURN v_domain_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger: org_node changes → enqueue OU sync events
CREATE OR REPLACE FUNCTION ad_sync_on_org_node() RETURNS TRIGGER AS $$
DECLARE
    v_domain_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_domain_id := ad_sync_resolve_domain(OLD.id);
        IF v_domain_id IS NOT NULL THEN
            PERFORM ad_sync_enqueue(v_domain_id, 'ou_delete',
                jsonb_build_object('node_id', OLD.id, 'name', OLD.name, 'node_type', OLD.node_type), 5);
        END IF;
        RETURN OLD;
    END IF;

    v_domain_id := ad_sync_resolve_domain(NEW.id);
    IF v_domain_id IS NULL THEN RETURN NEW; END IF;

    IF TG_OP = 'INSERT' THEN
        PERFORM ad_sync_enqueue(v_domain_id, 'ou_create',
            jsonb_build_object('node_id', NEW.id, 'name', NEW.name, 'node_type', NEW.node_type, 'parent_id', NEW.parent_id), 3);
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.name != NEW.name THEN
            PERFORM ad_sync_enqueue(v_domain_id, 'ou_rename',
                jsonb_build_object('node_id', NEW.id, 'old_name', OLD.name, 'new_name', NEW.name), 5);
        END IF;
        IF OLD.parent_id IS DISTINCT FROM NEW.parent_id THEN
            PERFORM ad_sync_enqueue(v_domain_id, 'ou_move',
                jsonb_build_object('node_id', NEW.id, 'old_parent', OLD.parent_id, 'new_parent', NEW.parent_id), 3);
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ad_sync_org_node
    AFTER INSERT OR UPDATE OR DELETE ON core.org_nodes
    FOR EACH ROW
    EXECUTE FUNCTION ad_sync_on_org_node();

-- Trigger: assignment changes → enqueue user provision/disable events
CREATE OR REPLACE FUNCTION ad_sync_on_assignment() RETURNS TRIGGER AS $$
DECLARE
    v_domain_id UUID;
    v_node_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_node_id := OLD.node_id;
    ELSE
        v_node_id := NEW.node_id;
    END IF;

    v_domain_id := ad_sync_resolve_domain(v_node_id);
    IF v_domain_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

    IF TG_OP = 'INSERT' THEN
        PERFORM ad_sync_enqueue(v_domain_id, 'user_provision',
            jsonb_build_object('person_id', NEW.person_id, 'node_id', NEW.node_id, 'assignment_type', NEW.assignment_type), 1);
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM ad_sync_enqueue(v_domain_id, 'user_disable',
            jsonb_build_object('person_id', OLD.person_id, 'node_id', OLD.node_id), 2);
    ELSIF TG_OP = 'UPDATE' AND OLD.node_id != NEW.node_id THEN
        PERFORM ad_sync_enqueue(v_domain_id, 'user_move',
            jsonb_build_object('person_id', NEW.person_id, 'old_node', OLD.node_id, 'new_node', NEW.node_id), 3);
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ad_sync_assignment
    AFTER INSERT OR UPDATE OR DELETE ON core.assignments
    FOR EACH ROW
    EXECUTE FUNCTION ad_sync_on_assignment();
```

- [ ] **Step 2: Execute migration**

Run: `cat migrations/231_ad_sync_triggers.sql | docker exec -i signapps-postgres psql -U signapps -d signapps`
Expected: `CREATE FUNCTION` x4, `CREATE TRIGGER` x2

- [ ] **Step 3: Verify triggers fire**

Run: `docker exec signapps-postgres psql -U signapps -d signapps -c "SELECT tgname FROM pg_trigger WHERE tgname LIKE 'trg_ad_sync%';"`
Expected: `trg_ad_sync_org_node`, `trg_ad_sync_assignment`

- [ ] **Step 4: Commit**

```bash
git add migrations/231_ad_sync_triggers.sql
git commit -m "feat(ad-sync): migration 231 — NOTIFY triggers on org_nodes and assignments"
```

---

## Phase 2: Rust Models + Repositories

### Task 9: AD Sync models in signapps-db

**Files:**
- Create: `crates/signapps-db/src/models/ad_sync.rs`
- Modify: `crates/signapps-db/src/models/mod.rs`

- [ ] **Step 1: Create the models file**

```rust
// crates/signapps-db/src/models/ad_sync.rs
//! Models for org→AD synchronization objects.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// An AD Organizational Unit synced from an org node.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct AdOu {
    pub id: Uuid,
    pub domain_id: Uuid,
    pub node_id: Uuid,
    pub distinguished_name: String,
    pub parent_ou_id: Option<Uuid>,
    pub guid: Option<String>,
    pub mail_distribution_enabled: bool,
    pub sync_status: String,
    pub last_synced_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

/// An AD User Account synced from a person assignment.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct AdUserAccount {
    pub id: Uuid,
    pub domain_id: Uuid,
    pub person_id: Uuid,
    pub ou_id: Option<Uuid>,
    pub sam_account_name: String,
    pub user_principal_name: String,
    pub distinguished_name: String,
    pub display_name: String,
    pub title: Option<String>,
    pub department: Option<String>,
    pub mail: Option<String>,
    pub mail_domain_id: Option<Uuid>,
    pub account_flags: i32,
    pub object_sid: Option<String>,
    pub password_must_change: bool,
    pub is_enabled: bool,
    pub sync_status: String,
    pub last_synced_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// An AD Computer Account.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct AdComputerAccount {
    pub id: Uuid,
    pub domain_id: Uuid,
    pub hardware_id: Option<Uuid>,
    pub sam_account_name: String,
    pub distinguished_name: String,
    pub dns_hostname: Option<String>,
    pub os_name: Option<String>,
    pub os_version: Option<String>,
    pub object_sid: Option<String>,
    pub is_enabled: bool,
    pub sync_status: String,
    pub last_synced_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

/// An AD Security Group.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct AdSecurityGroup {
    pub id: Uuid,
    pub domain_id: Uuid,
    pub source_type: String,
    pub source_id: Uuid,
    pub sam_account_name: String,
    pub distinguished_name: String,
    pub display_name: Option<String>,
    pub group_scope: String,
    pub group_type: String,
    pub object_sid: Option<String>,
    pub sync_status: String,
    pub last_synced_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

/// A member of an AD Security Group.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct AdGroupMember {
    pub id: Uuid,
    pub group_id: Uuid,
    pub member_type: String,
    pub member_id: Uuid,
    pub sync_status: String,
}

/// An event in the AD sync queue.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct AdSyncEvent {
    pub id: Uuid,
    pub domain_id: Uuid,
    pub event_type: String,
    pub payload: serde_json::Value,
    pub target_site_id: Option<Uuid>,
    pub target_dc_id: Option<Uuid>,
    pub priority: i32,
    pub status: String,
    pub attempts: i32,
    pub max_attempts: i32,
    pub next_retry_at: Option<DateTime<Utc>>,
    pub error_message: Option<String>,
    pub created_at: DateTime<Utc>,
    pub processed_at: Option<DateTime<Utc>>,
}

/// A DC site entry.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct AdDcSite {
    pub id: Uuid,
    pub domain_id: Uuid,
    pub site_id: Option<Uuid>,
    pub dc_hostname: String,
    pub dc_ip: String,
    pub dc_role: String,
    pub dc_status: String,
    pub is_writable: bool,
    pub is_primary: bool,
    pub replication_partner_id: Option<Uuid>,
    pub promoted_at: Option<DateTime<Utc>>,
    pub demoted_at: Option<DateTime<Utc>>,
    pub last_heartbeat_at: Option<DateTime<Utc>>,
    pub last_replication_at: Option<DateTime<Utc>>,
    pub config: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

/// An AD snapshot for backup/restore.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct AdSnapshot {
    pub id: Uuid,
    pub domain_id: Uuid,
    pub dc_id: Option<Uuid>,
    pub snapshot_type: String,
    pub storage_path: String,
    pub manifest: serde_json::Value,
    pub tables_included: Vec<String>,
    pub size_bytes: i64,
    pub checksum_sha256: Option<String>,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
}

/// A user mail alias.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct AdMailAlias {
    pub id: Uuid,
    pub user_account_id: Uuid,
    pub mail_address: String,
    pub domain_id: Uuid,
    pub is_default: bool,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

/// A shared mailbox for an OU or group (appears as IMAP folder).
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct AdSharedMailbox {
    pub id: Uuid,
    pub ou_id: Option<Uuid>,
    pub group_id: Option<Uuid>,
    pub mail_address: String,
    pub domain_id: Uuid,
    pub display_name: String,
    pub config: serde_json::Value,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

/// A user's subscription to a shared mailbox.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct AdSharedMailboxSubscription {
    pub id: Uuid,
    pub mailbox_id: Uuid,
    pub user_account_id: Uuid,
    pub imap_folder_path: String,
    pub can_send_as: bool,
    pub is_subscribed: bool,
    pub created_at: DateTime<Utc>,
}

/// Mail domain mapping for an org node.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct AdNodeMailDomain {
    pub node_id: Uuid,
    pub domain_id: Uuid,
    pub created_at: DateTime<Utc>,
}

/// FSMO role assignment.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct AdFsmoRole {
    pub id: Uuid,
    pub domain_id: Uuid,
    pub role: String,
    pub dc_id: Uuid,
    pub transferred_at: DateTime<Utc>,
}
```

- [ ] **Step 2: Register the module**

Add to `crates/signapps-db/src/models/mod.rs`:

```rust
pub mod ad_sync;
```

- [ ] **Step 3: Verify compilation**

Run: `cargo check -p signapps-db`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add crates/signapps-db/src/models/ad_sync.rs crates/signapps-db/src/models/mod.rs
git commit -m "feat(ad-sync): add Rust models for all AD sync tables"
```

---

### Task 10: SAM account name generator

**Files:**
- Create: `crates/signapps-ad-core/src/naming.rs`
- Modify: `crates/signapps-ad-core/src/lib.rs`

- [ ] **Step 1: Write the naming module with tests**

```rust
// crates/signapps-ad-core/src/naming.rs
//! SAM account name and DN generation for AD objects.
//!
//! Implements the naming algorithm:
//! - `p.nom` (first letter of first_name + "." + last_name)
//! - Doublon with middle name: `pp.nom`
//! - Doublon without middle name: `pr.nom` (2 first letters)
//! - Last resort: `p.nom2`, `p.nom3`...

use sqlx::PgPool;
use uuid::Uuid;

/// Normalize a string to ASCII lowercase (remove accents).
///
/// # Examples
///
/// ```
/// use signapps_ad_core::naming::normalize_ascii;
/// assert_eq!(normalize_ascii("Étienne"), "etienne");
/// assert_eq!(normalize_ascii("François"), "francois");
/// ```
pub fn normalize_ascii(input: &str) -> String {
    input
        .chars()
        .map(|c| match c {
            'à' | 'â' | 'ä' | 'á' | 'À' | 'Â' | 'Ä' | 'Á' => 'a',
            'é' | 'è' | 'ê' | 'ë' | 'É' | 'È' | 'Ê' | 'Ë' => 'e',
            'ï' | 'î' | 'ì' | 'í' | 'Ï' | 'Î' | 'Ì' | 'Í' => 'i',
            'ö' | 'ô' | 'ò' | 'ó' | 'Ö' | 'Ô' | 'Ò' | 'Ó' => 'o',
            'ü' | 'û' | 'ù' | 'ú' | 'Ü' | 'Û' | 'Ù' | 'Ú' => 'u',
            'ÿ' | 'Ÿ' => 'y',
            'ç' | 'Ç' => 'c',
            'ñ' | 'Ñ' => 'n',
            'ß' => 's',
            _ => c,
        })
        .filter(|c| c.is_ascii_alphanumeric() || *c == '.' || *c == '-' || *c == ' ')
        .collect::<String>()
        .to_lowercase()
}

/// Generate a candidate sAMAccountName from person data.
///
/// Returns a list of candidates in priority order.
///
/// # Examples
///
/// ```
/// use signapps_ad_core::naming::generate_sam_candidates;
/// let candidates = generate_sam_candidates("Jean", "Dupont", None);
/// assert_eq!(candidates[0], "j.dupont");
///
/// let candidates = generate_sam_candidates("Jean-Paul", "Dupont", Some("Marie"));
/// assert_eq!(candidates[0], "j.dupont");
/// assert_eq!(candidates[1], "jm.dupont"); // middle name
/// assert_eq!(candidates[2], "je.dupont"); // 2 first letters
/// ```
pub fn generate_sam_candidates(
    first_name: &str,
    last_name: &str,
    middle_name: Option<&str>,
) -> Vec<String> {
    let first = normalize_ascii(first_name);
    let last = normalize_ascii(last_name).replace(' ', "-");

    let first_char = first.chars().next().unwrap_or('x');
    let base = format!("{}.{}", first_char, last);
    let base = if base.len() > 20 { base[..20].to_string() } else { base };

    let mut candidates = vec![base.clone()];

    // With middle name
    if let Some(mn) = middle_name {
        let mn_norm = normalize_ascii(mn);
        if let Some(mn_char) = mn_norm.chars().next() {
            let alt = format!("{}{}.{}", first_char, mn_char, last);
            let alt = if alt.len() > 20 { alt[..20].to_string() } else { alt };
            candidates.push(alt);
        }
    }

    // Two first letters of first name
    let first_two: String = first.chars().take(2).collect();
    if first_two.len() == 2 {
        let alt2 = format!("{}.{}", first_two, last);
        let alt2 = if alt2.len() > 20 { alt2[..20].to_string() } else { alt2 };
        candidates.push(alt2);
    }

    // Numeric suffixes
    for i in 2..=99 {
        candidates.push(format!("{}{}", base, i));
    }

    candidates
}

/// Pick the first available sAMAccountName from candidates.
///
/// Checks against existing accounts in the database.
///
/// # Errors
///
/// Returns `Error::Database` if the query fails.
/// Returns `Error::Internal` if all candidates are taken (extremely unlikely).
#[tracing::instrument(skip(pool))]
pub async fn pick_available_sam(
    pool: &PgPool,
    domain_id: Uuid,
    first_name: &str,
    last_name: &str,
    middle_name: Option<&str>,
) -> signapps_common::Result<String> {
    let candidates = generate_sam_candidates(first_name, last_name, middle_name);

    let existing: Vec<(String,)> = sqlx::query_as(
        "SELECT sam_account_name FROM ad_user_accounts WHERE domain_id = $1",
    )
    .bind(domain_id)
    .fetch_all(pool)
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    let taken: std::collections::HashSet<String> =
        existing.into_iter().map(|(s,)| s).collect();

    for candidate in &candidates {
        if !taken.contains(candidate) {
            return Ok(candidate.clone());
        }
    }

    Err(signapps_common::Error::Internal(
        "All SAM account name candidates are taken".into(),
    ))
}

/// Build a Distinguished Name for an OU from the org-node hierarchy.
///
/// Walks the parent chain to construct `OU=child,OU=parent,...,DC=domain`.
pub fn build_ou_dn(node_name: &str, parent_dn: Option<&str>, domain_dn: &str) -> String {
    let ou_part = format!("OU={}", node_name.replace(',', "\\,"));
    match parent_dn {
        Some(parent) => format!("{},{}", ou_part, parent),
        None => format!("{},{}", ou_part, domain_dn),
    }
}

/// Build DC portion of a DN from a domain name.
///
/// # Examples
///
/// ```
/// use signapps_ad_core::naming::domain_to_dn;
/// assert_eq!(domain_to_dn("corp.local"), "DC=corp,DC=local");
/// assert_eq!(domain_to_dn("ad.example.com"), "DC=ad,DC=example,DC=com");
/// ```
pub fn domain_to_dn(dns_name: &str) -> String {
    dns_name
        .split('.')
        .map(|part| format!("DC={}", part))
        .collect::<Vec<_>>()
        .join(",")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_accents() {
        assert_eq!(normalize_ascii("Étienne"), "etienne");
        assert_eq!(normalize_ascii("François"), "francois");
        assert_eq!(normalize_ascii("José María"), "jose maria");
        assert_eq!(normalize_ascii("Müller"), "muller");
    }

    #[test]
    fn sam_basic() {
        let c = generate_sam_candidates("Jean", "Dupont", None);
        assert_eq!(c[0], "j.dupont");
        assert_eq!(c[1], "je.dupont"); // no middle name → skip to 2-letter
    }

    #[test]
    fn sam_with_middle_name() {
        let c = generate_sam_candidates("Jean", "Dupont", Some("Paul"));
        assert_eq!(c[0], "j.dupont");
        assert_eq!(c[1], "jp.dupont");
        assert_eq!(c[2], "je.dupont");
    }

    #[test]
    fn sam_accented() {
        let c = generate_sam_candidates("Étienne", "Müller", None);
        assert_eq!(c[0], "e.muller");
    }

    #[test]
    fn sam_truncation() {
        let c = generate_sam_candidates("A", "Verylonglastnamethatexceedstwenty", None);
        assert!(c[0].len() <= 20);
    }

    #[test]
    fn domain_dn() {
        assert_eq!(domain_to_dn("corp.local"), "DC=corp,DC=local");
        assert_eq!(domain_to_dn("ad.example.com"), "DC=ad,DC=example,DC=com");
    }

    #[test]
    fn ou_dn_root() {
        let dn = build_ou_dn("DRH", None, "DC=corp,DC=local");
        assert_eq!(dn, "OU=DRH,DC=corp,DC=local");
    }

    #[test]
    fn ou_dn_nested() {
        let parent = "OU=SI,DC=corp,DC=local";
        let dn = build_ou_dn("Dev Frontend", Some(parent), "DC=corp,DC=local");
        assert_eq!(dn, "OU=Dev Frontend,OU=SI,DC=corp,DC=local");
    }
}
```

- [ ] **Step 2: Register the module in lib.rs**

Add to `crates/signapps-ad-core/src/lib.rs`:

```rust
pub mod naming;
```

- [ ] **Step 3: Run tests**

Run: `cargo test -p signapps-ad-core -- naming`
Expected: 7 tests pass

- [ ] **Step 4: Commit**

```bash
git add crates/signapps-ad-core/src/naming.rs crates/signapps-ad-core/src/lib.rs
git commit -m "feat(ad-sync): SAM account name generator with accent normalization and DN builder"
```

---

### Task 11: AD Sync repository (queue + OU + user CRUD)

**Files:**
- Create: `crates/signapps-db/src/repositories/ad_sync_repository.rs`
- Modify: `crates/signapps-db/src/repositories/mod.rs`

- [ ] **Step 1: Create the repository**

```rust
// crates/signapps-db/src/repositories/ad_sync_repository.rs
//! Repository for AD sync queue and AD object CRUD.

use chrono::Utc;
use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::ad_sync::*;

// ── Sync Queue ───────────────────────────────────────────────────────────────

/// Repository for the AD sync event queue.
pub struct AdSyncQueueRepository;

impl AdSyncQueueRepository {
    /// Dequeue pending events (oldest first, by priority).
    pub async fn dequeue(pool: &PgPool, batch_size: i64) -> Result<Vec<AdSyncEvent>> {
        let events = sqlx::query_as::<_, AdSyncEvent>(
            r#"UPDATE ad_sync_queue
               SET status = 'processing'
               WHERE id IN (
                   SELECT id FROM ad_sync_queue
                   WHERE status IN ('pending', 'retry')
                     AND (next_retry_at IS NULL OR next_retry_at <= now())
                   ORDER BY priority ASC, created_at ASC
                   LIMIT $1
                   FOR UPDATE SKIP LOCKED
               )
               RETURNING *"#,
        )
        .bind(batch_size)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(events)
    }

    /// Mark an event as completed.
    pub async fn mark_completed(pool: &PgPool, event_id: Uuid) -> Result<()> {
        sqlx::query(
            "UPDATE ad_sync_queue SET status = 'completed', processed_at = now() WHERE id = $1",
        )
        .bind(event_id)
        .execute(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }

    /// Mark an event for retry with exponential backoff.
    pub async fn mark_retry(pool: &PgPool, event_id: Uuid, error: &str) -> Result<()> {
        sqlx::query(
            r#"UPDATE ad_sync_queue SET
                status = CASE WHEN attempts + 1 >= max_attempts THEN 'dead' ELSE 'retry' END,
                attempts = attempts + 1,
                error_message = $2,
                next_retry_at = now() + make_interval(secs => power(2, LEAST(attempts + 1, 10)) * 5)
            WHERE id = $1"#,
        )
        .bind(event_id)
        .bind(error)
        .execute(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }

    /// Enqueue a new sync event.
    pub async fn enqueue(
        pool: &PgPool,
        domain_id: Uuid,
        event_type: &str,
        payload: serde_json::Value,
        priority: i32,
    ) -> Result<Uuid> {
        let (id,): (Uuid,) = sqlx::query_as(
            r#"INSERT INTO ad_sync_queue (domain_id, event_type, payload, priority)
               VALUES ($1, $2, $3, $4) RETURNING id"#,
        )
        .bind(domain_id)
        .bind(event_type)
        .bind(&payload)
        .bind(priority)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(id)
    }

    /// Get queue statistics.
    pub async fn stats(pool: &PgPool, domain_id: Uuid) -> Result<serde_json::Value> {
        let row: (i64, i64, i64, i64, i64) = sqlx::query_as(
            r#"SELECT
                COUNT(*) FILTER (WHERE status = 'pending'),
                COUNT(*) FILTER (WHERE status = 'processing'),
                COUNT(*) FILTER (WHERE status = 'completed'),
                COUNT(*) FILTER (WHERE status = 'failed' OR status = 'dead'),
                COUNT(*) FILTER (WHERE status = 'retry')
            FROM ad_sync_queue WHERE domain_id = $1"#,
        )
        .bind(domain_id)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(serde_json::json!({
            "pending": row.0,
            "processing": row.1,
            "completed": row.2,
            "failed": row.3,
            "retry": row.4,
        }))
    }
}

// ── AD OUs ───────────────────────────────────────────────────────────────────

/// Repository for AD Organizational Units.
pub struct AdOuRepository;

impl AdOuRepository {
    /// Create an AD OU mapping.
    pub async fn create(
        pool: &PgPool,
        domain_id: Uuid,
        node_id: Uuid,
        distinguished_name: &str,
        parent_ou_id: Option<Uuid>,
    ) -> Result<AdOu> {
        let ou = sqlx::query_as::<_, AdOu>(
            r#"INSERT INTO ad_ous (domain_id, node_id, distinguished_name, parent_ou_id, sync_status)
               VALUES ($1, $2, $3, $4, 'synced')
               RETURNING *"#,
        )
        .bind(domain_id)
        .bind(node_id)
        .bind(distinguished_name)
        .bind(parent_ou_id)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(ou)
    }

    /// Find OU by org node.
    pub async fn find_by_node(pool: &PgPool, domain_id: Uuid, node_id: Uuid) -> Result<Option<AdOu>> {
        let ou = sqlx::query_as::<_, AdOu>(
            "SELECT * FROM ad_ous WHERE domain_id = $1 AND node_id = $2",
        )
        .bind(domain_id)
        .bind(node_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(ou)
    }

    /// List all OUs for a domain.
    pub async fn list_by_domain(pool: &PgPool, domain_id: Uuid) -> Result<Vec<AdOu>> {
        let ous = sqlx::query_as::<_, AdOu>(
            "SELECT * FROM ad_ous WHERE domain_id = $1 ORDER BY distinguished_name",
        )
        .bind(domain_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(ous)
    }

    /// Delete an OU mapping.
    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM ad_ous WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }
}

// ── AD User Accounts ─────────────────────────────────────────────────────────

/// Repository for AD User Accounts.
pub struct AdUserAccountRepository;

impl AdUserAccountRepository {
    /// Create an AD user account.
    #[allow(clippy::too_many_arguments)]
    pub async fn create(
        pool: &PgPool,
        domain_id: Uuid,
        person_id: Uuid,
        ou_id: Option<Uuid>,
        sam_account_name: &str,
        user_principal_name: &str,
        distinguished_name: &str,
        display_name: &str,
        title: Option<&str>,
        department: Option<&str>,
        mail: Option<&str>,
        mail_domain_id: Option<Uuid>,
    ) -> Result<AdUserAccount> {
        let user = sqlx::query_as::<_, AdUserAccount>(
            r#"INSERT INTO ad_user_accounts (
                domain_id, person_id, ou_id, sam_account_name, user_principal_name,
                distinguished_name, display_name, title, department, mail, mail_domain_id,
                sync_status
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'synced')
            RETURNING *"#,
        )
        .bind(domain_id)
        .bind(person_id)
        .bind(ou_id)
        .bind(sam_account_name)
        .bind(user_principal_name)
        .bind(distinguished_name)
        .bind(display_name)
        .bind(title)
        .bind(department)
        .bind(mail)
        .bind(mail_domain_id)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(user)
    }

    /// Find by person.
    pub async fn find_by_person(pool: &PgPool, domain_id: Uuid, person_id: Uuid) -> Result<Option<AdUserAccount>> {
        let user = sqlx::query_as::<_, AdUserAccount>(
            "SELECT * FROM ad_user_accounts WHERE domain_id = $1 AND person_id = $2",
        )
        .bind(domain_id)
        .bind(person_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(user)
    }

    /// List all enabled users for a domain.
    pub async fn list_enabled(pool: &PgPool, domain_id: Uuid) -> Result<Vec<AdUserAccount>> {
        let users = sqlx::query_as::<_, AdUserAccount>(
            "SELECT * FROM ad_user_accounts WHERE domain_id = $1 AND is_enabled = true ORDER BY display_name",
        )
        .bind(domain_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(users)
    }

    /// Disable a user account.
    pub async fn disable(pool: &PgPool, id: Uuid) -> Result<()> {
        sqlx::query(
            "UPDATE ad_user_accounts SET is_enabled = false, sync_status = 'disabled', updated_at = now() WHERE id = $1",
        )
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }
}
```

- [ ] **Step 2: Register in mod.rs**

Add to `crates/signapps-db/src/repositories/mod.rs`:

```rust
pub mod ad_sync_repository;
pub use ad_sync_repository::{AdSyncQueueRepository, AdOuRepository, AdUserAccountRepository};
```

- [ ] **Step 3: Verify compilation**

Run: `cargo check -p signapps-db`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add crates/signapps-db/src/repositories/ad_sync_repository.rs crates/signapps-db/src/repositories/mod.rs
git commit -m "feat(ad-sync): repositories for sync queue, OUs, and user accounts"
```

---

## Phase 3: Sync Worker Engine

### Task 12: Mail domain resolver

**Files:**
- Create: `crates/signapps-ad-core/src/mail_resolver.rs`
- Modify: `crates/signapps-ad-core/src/lib.rs`

- [ ] **Step 1: Create the mail resolver**

```rust
// crates/signapps-ad-core/src/mail_resolver.rs
//! Resolves mail domains for org nodes using inheritance via closure table.

use sqlx::PgPool;
use uuid::Uuid;

/// Resolve the mail domain for a node by walking up ancestors.
///
/// Returns the domain_id of the closest ancestor that has a mail domain mapping.
///
/// # Errors
///
/// Returns `Error::Database` if the query fails.
#[tracing::instrument(skip(pool))]
pub async fn resolve_closest_mail_domain(
    pool: &PgPool,
    node_id: Uuid,
) -> signapps_common::Result<Option<(Uuid, String)>> {
    // Walk closure table from node up to root, find first ancestor with mail domain
    let row: Option<(Uuid, String)> = sqlx::query_as(
        r#"SELECT d.id, d.dns_name
           FROM ad_node_mail_domains nmd
           JOIN core.org_closure c ON c.ancestor_id = nmd.node_id
           JOIN infrastructure.domains d ON d.id = nmd.domain_id AND d.mail_enabled = true
           WHERE c.descendant_id = $1
           ORDER BY c.depth ASC
           LIMIT 1"#,
    )
    .bind(node_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    Ok(row)
}

/// Resolve all mail alias domains for a node (own domain + sub-branch domains).
///
/// Returns a list of (domain_id, dns_name) tuples.
#[tracing::instrument(skip(pool))]
pub async fn resolve_mail_aliases(
    pool: &PgPool,
    node_id: Uuid,
) -> signapps_common::Result<Vec<(Uuid, String)>> {
    let rows: Vec<(Uuid, String)> = sqlx::query_as(
        r#"SELECT d.id, d.dns_name
           FROM ad_node_mail_domains nmd
           JOIN core.org_closure c ON c.descendant_id = nmd.node_id
           JOIN infrastructure.domains d ON d.id = nmd.domain_id AND d.mail_enabled = true
           WHERE c.ancestor_id = $1 AND c.depth > 0"#,
    )
    .bind(node_id)
    .fetch_all(pool)
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    Ok(rows)
}

#[cfg(test)]
mod tests {
    use super::*;

    // Integration tests require database — tested via the sync worker integration tests
    #[test]
    fn module_compiles() {
        // Placeholder to verify the module compiles
        assert!(true);
    }
}
```

- [ ] **Step 2: Register in lib.rs**

Add to `crates/signapps-ad-core/src/lib.rs`:

```rust
pub mod mail_resolver;
```

- [ ] **Step 3: Verify compilation**

Run: `cargo check -p signapps-ad-core`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add crates/signapps-ad-core/src/mail_resolver.rs crates/signapps-ad-core/src/lib.rs
git commit -m "feat(ad-sync): mail domain resolver with closure table inheritance"
```

---

### Task 13: Sync worker — event processor

**Files:**
- Create: `crates/signapps-ad-core/src/sync_worker.rs`
- Modify: `crates/signapps-ad-core/src/lib.rs`

- [ ] **Step 1: Create the sync worker**

```rust
// crates/signapps-ad-core/src/sync_worker.rs
//! AD Sync Worker — processes events from the sync queue.

use signapps_common::Result;
use signapps_db::models::ad_sync::AdSyncEvent;
use signapps_db::repositories::{AdOuRepository, AdSyncQueueRepository, AdUserAccountRepository};
use sqlx::PgPool;
use uuid::Uuid;

use crate::mail_resolver;
use crate::naming;

/// Process a single sync event.
///
/// Dispatches to the appropriate handler based on event_type.
///
/// # Errors
///
/// Returns an error if the operation fails (will be retried).
#[tracing::instrument(skip(pool, event), fields(event_id = %event.id, event_type = %event.event_type))]
pub async fn process_event(pool: &PgPool, event: &AdSyncEvent) -> Result<()> {
    match event.event_type.as_str() {
        "ou_create" => handle_ou_create(pool, event).await,
        "ou_rename" => handle_ou_rename(pool, event).await,
        "ou_move" => handle_ou_move(pool, event).await,
        "ou_delete" => handle_ou_delete(pool, event).await,
        "user_provision" => handle_user_provision(pool, event).await,
        "user_disable" => handle_user_disable(pool, event).await,
        "user_move" => handle_user_move(pool, event).await,
        "user_update" => handle_user_update(pool, event).await,
        "group_create" | "group_sync" | "group_delete" => {
            tracing::info!("Group event — not yet implemented");
            Ok(())
        }
        "computer_create" | "computer_disable" => {
            tracing::info!("Computer event — not yet implemented");
            Ok(())
        }
        "mail_domain_bind" => {
            tracing::info!("Mail domain bind — not yet implemented");
            Ok(())
        }
        _ => {
            tracing::warn!(event_type = %event.event_type, "Unknown event type");
            Ok(())
        }
    }
}

/// Handle OU creation from an org node.
async fn handle_ou_create(pool: &PgPool, event: &AdSyncEvent) -> Result<()> {
    let node_id: Uuid = serde_json::from_value(event.payload["node_id"].clone())
        .map_err(|e| signapps_common::Error::Internal(format!("Bad payload: {e}")))?;
    let name = event.payload["name"].as_str().unwrap_or("Unknown");
    let parent_id: Option<Uuid> = event.payload["parent_id"].as_str()
        .and_then(|s| s.parse().ok());

    // Check if already exists
    if let Some(_existing) = AdOuRepository::find_by_node(pool, event.domain_id, node_id).await? {
        tracing::debug!("OU already exists for node {}", node_id);
        return Ok(());
    }

    // Resolve parent OU DN
    let domain_dn = resolve_domain_dn(pool, event.domain_id).await?;
    let parent_ou = if let Some(pid) = parent_id {
        AdOuRepository::find_by_node(pool, event.domain_id, pid).await?
    } else {
        None
    };

    let dn = naming::build_ou_dn(
        name,
        parent_ou.as_ref().map(|p| p.distinguished_name.as_str()),
        &domain_dn,
    );

    AdOuRepository::create(pool, event.domain_id, node_id, &dn, parent_ou.map(|p| p.id)).await?;

    tracing::info!(dn = %dn, "OU created");
    Ok(())
}

/// Handle OU rename.
async fn handle_ou_rename(pool: &PgPool, event: &AdSyncEvent) -> Result<()> {
    let node_id: Uuid = serde_json::from_value(event.payload["node_id"].clone())
        .map_err(|e| signapps_common::Error::Internal(format!("Bad payload: {e}")))?;
    let new_name = event.payload["new_name"].as_str().unwrap_or("Unknown");

    if let Some(ou) = AdOuRepository::find_by_node(pool, event.domain_id, node_id).await? {
        // Replace the first OU= component
        let new_dn = if let Some(comma_pos) = ou.distinguished_name.find(',') {
            format!("OU={}{}", new_name, &ou.distinguished_name[comma_pos..])
        } else {
            format!("OU={}", new_name)
        };

        sqlx::query("UPDATE ad_ous SET distinguished_name = $1, last_synced_at = now() WHERE id = $2")
            .bind(&new_dn)
            .bind(ou.id)
            .execute(pool)
            .await
            .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

        tracing::info!(old_dn = %ou.distinguished_name, new_dn = %new_dn, "OU renamed");
    }
    Ok(())
}

/// Handle OU move (reparent).
async fn handle_ou_move(pool: &PgPool, event: &AdSyncEvent) -> Result<()> {
    let node_id: Uuid = serde_json::from_value(event.payload["node_id"].clone())
        .map_err(|e| signapps_common::Error::Internal(format!("Bad payload: {e}")))?;
    let new_parent: Option<Uuid> = event.payload["new_parent"].as_str()
        .and_then(|s| s.parse().ok());

    let domain_dn = resolve_domain_dn(pool, event.domain_id).await?;

    if let Some(ou) = AdOuRepository::find_by_node(pool, event.domain_id, node_id).await? {
        let ou_name = ou.distinguished_name.split(',').next().unwrap_or("OU=Unknown");
        let name = ou_name.strip_prefix("OU=").unwrap_or(ou_name);

        let new_parent_ou = if let Some(np) = new_parent {
            AdOuRepository::find_by_node(pool, event.domain_id, np).await?
        } else {
            None
        };

        let new_dn = naming::build_ou_dn(
            name,
            new_parent_ou.as_ref().map(|p| p.distinguished_name.as_str()),
            &domain_dn,
        );

        sqlx::query("UPDATE ad_ous SET distinguished_name = $1, parent_ou_id = $2, last_synced_at = now() WHERE id = $3")
            .bind(&new_dn)
            .bind(new_parent_ou.map(|p| p.id))
            .bind(ou.id)
            .execute(pool)
            .await
            .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

        tracing::info!(new_dn = %new_dn, "OU moved");
    }
    Ok(())
}

/// Handle OU deletion.
async fn handle_ou_delete(pool: &PgPool, event: &AdSyncEvent) -> Result<()> {
    let node_id: Uuid = serde_json::from_value(event.payload["node_id"].clone())
        .map_err(|e| signapps_common::Error::Internal(format!("Bad payload: {e}")))?;

    if let Some(ou) = AdOuRepository::find_by_node(pool, event.domain_id, node_id).await? {
        AdOuRepository::delete(pool, ou.id).await?;
        tracing::info!(dn = %ou.distinguished_name, "OU deleted");
    }
    Ok(())
}

/// Handle user provisioning (create AD account + mail).
async fn handle_user_provision(pool: &PgPool, event: &AdSyncEvent) -> Result<()> {
    let person_id: Uuid = serde_json::from_value(event.payload["person_id"].clone())
        .map_err(|e| signapps_common::Error::Internal(format!("Bad payload: {e}")))?;
    let node_id: Uuid = serde_json::from_value(event.payload["node_id"].clone())
        .map_err(|e| signapps_common::Error::Internal(format!("Bad payload: {e}")))?;

    // Check if already provisioned
    if let Some(_existing) = AdUserAccountRepository::find_by_person(pool, event.domain_id, person_id).await? {
        tracing::debug!("User already provisioned for person {}", person_id);
        return Ok(());
    }

    // Load person data
    let person: Option<(String, String, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT first_name, last_name, email, phone FROM core.persons WHERE id = $1",
    )
    .bind(person_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    let (first_name, last_name, _email, _phone) = person
        .ok_or_else(|| signapps_common::Error::NotFound(format!("Person {person_id} not found")))?;

    // Generate SAM account name
    let sam = naming::pick_available_sam(pool, event.domain_id, &first_name, &last_name, None).await?;

    // Resolve domain info
    let domain_dn = resolve_domain_dn(pool, event.domain_id).await?;
    let realm = resolve_realm(pool, event.domain_id).await?;
    let upn = format!("{}@{}", sam, realm);
    let display_name = format!("{} {}", first_name, last_name);

    // Resolve OU
    let ou = AdOuRepository::find_by_node(pool, event.domain_id, node_id).await?;
    let dn = format!(
        "CN={},{}",
        display_name,
        ou.as_ref().map(|o| o.distinguished_name.as_str()).unwrap_or(&domain_dn)
    );

    // Resolve mail domain
    let mail_info = mail_resolver::resolve_closest_mail_domain(pool, node_id).await?;
    let (mail, mail_domain_id) = if let Some((md_id, md_name)) = mail_info {
        (Some(format!("{}@{}", sam, md_name)), Some(md_id))
    } else {
        (None, None)
    };

    // Resolve title (position) and department
    let title: Option<String> = sqlx::query_scalar(
        r#"SELECT n.name FROM core.org_nodes n
           JOIN core.assignments a ON a.node_id = n.id
           WHERE a.person_id = $1 AND n.node_type = 'position'
           AND (a.end_date IS NULL OR a.end_date > now())
           LIMIT 1"#,
    )
    .bind(person_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    let department: Option<String> = sqlx::query_scalar(
        r#"SELECT n.name FROM core.org_nodes n
           JOIN core.org_closure c ON c.ancestor_id = n.id
           WHERE c.descendant_id = $1 AND n.node_type IN ('department', 'service')
           ORDER BY c.depth ASC LIMIT 1"#,
    )
    .bind(node_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    // Create the AD user account
    AdUserAccountRepository::create(
        pool, event.domain_id, person_id, ou.map(|o| o.id),
        &sam, &upn, &dn, &display_name,
        title.as_deref(), department.as_deref(),
        mail.as_deref(), mail_domain_id,
    )
    .await?;

    tracing::info!(sam = %sam, dn = %dn, mail = ?mail, "User provisioned");
    Ok(())
}

/// Handle user disable.
async fn handle_user_disable(pool: &PgPool, event: &AdSyncEvent) -> Result<()> {
    let person_id: Uuid = serde_json::from_value(event.payload["person_id"].clone())
        .map_err(|e| signapps_common::Error::Internal(format!("Bad payload: {e}")))?;

    if let Some(user) = AdUserAccountRepository::find_by_person(pool, event.domain_id, person_id).await? {
        AdUserAccountRepository::disable(pool, user.id).await?;
        tracing::info!(sam = %user.sam_account_name, "User disabled");
    }
    Ok(())
}

/// Handle user move (change OU).
async fn handle_user_move(pool: &PgPool, event: &AdSyncEvent) -> Result<()> {
    let person_id: Uuid = serde_json::from_value(event.payload["person_id"].clone())
        .map_err(|e| signapps_common::Error::Internal(format!("Bad payload: {e}")))?;
    let new_node: Uuid = serde_json::from_value(event.payload["new_node"].clone())
        .map_err(|e| signapps_common::Error::Internal(format!("Bad payload: {e}")))?;

    if let Some(user) = AdUserAccountRepository::find_by_person(pool, event.domain_id, person_id).await? {
        let new_ou = AdOuRepository::find_by_node(pool, event.domain_id, new_node).await?;
        let domain_dn = resolve_domain_dn(pool, event.domain_id).await?;

        let new_dn = format!(
            "CN={},{}",
            user.display_name,
            new_ou.as_ref().map(|o| o.distinguished_name.as_str()).unwrap_or(&domain_dn)
        );

        sqlx::query(
            "UPDATE ad_user_accounts SET ou_id = $1, distinguished_name = $2, updated_at = now() WHERE id = $3",
        )
        .bind(new_ou.map(|o| o.id))
        .bind(&new_dn)
        .bind(user.id)
        .execute(pool)
        .await
        .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

        tracing::info!(sam = %user.sam_account_name, new_dn = %new_dn, "User moved");
    }
    Ok(())
}

/// Handle user attribute update (title, department change).
async fn handle_user_update(pool: &PgPool, event: &AdSyncEvent) -> Result<()> {
    let person_id: Uuid = serde_json::from_value(event.payload["person_id"].clone())
        .map_err(|e| signapps_common::Error::Internal(format!("Bad payload: {e}")))?;

    if let Some(user) = AdUserAccountRepository::find_by_person(pool, event.domain_id, person_id).await? {
        let title = event.payload["title"].as_str();
        let department = event.payload["department"].as_str();

        sqlx::query(
            "UPDATE ad_user_accounts SET title = COALESCE($1, title), department = COALESCE($2, department), updated_at = now() WHERE id = $3",
        )
        .bind(title)
        .bind(department)
        .bind(user.id)
        .execute(pool)
        .await
        .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

        tracing::info!(sam = %user.sam_account_name, "User attributes updated");
    }
    Ok(())
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/// Resolve the DC-style DN for a domain.
async fn resolve_domain_dn(pool: &PgPool, domain_id: Uuid) -> Result<String> {
    let dns_name: Option<String> = sqlx::query_scalar(
        "SELECT dns_name FROM infrastructure.domains WHERE id = $1",
    )
    .bind(domain_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    let dns = dns_name.ok_or_else(|| signapps_common::Error::NotFound("Domain not found".into()))?;
    Ok(naming::domain_to_dn(&dns))
}

/// Resolve the Kerberos realm for a domain.
async fn resolve_realm(pool: &PgPool, domain_id: Uuid) -> Result<String> {
    let realm: Option<String> = sqlx::query_scalar(
        "SELECT COALESCE(realm, UPPER(dns_name)) FROM infrastructure.domains WHERE id = $1",
    )
    .bind(domain_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    realm.ok_or_else(|| signapps_common::Error::NotFound("Domain not found".into()))
}

/// Run the sync worker loop.
///
/// Listens for NOTIFY events and processes the queue.
#[tracing::instrument(skip(pool))]
pub async fn run_sync_worker(pool: PgPool) {
    tracing::info!("AD sync worker started");

    loop {
        // Process pending events in batches
        match AdSyncQueueRepository::dequeue(&pool, 10).await {
            Ok(events) if events.is_empty() => {
                // No events — wait for NOTIFY or timeout
                tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
            }
            Ok(events) => {
                for event in &events {
                    match process_event(&pool, event).await {
                        Ok(()) => {
                            if let Err(e) = AdSyncQueueRepository::mark_completed(&pool, event.id).await {
                                tracing::error!(event_id = %event.id, "Failed to mark completed: {}", e);
                            }
                        }
                        Err(e) => {
                            tracing::warn!(
                                event_id = %event.id,
                                event_type = %event.event_type,
                                error = %e,
                                "Event processing failed"
                            );
                            if let Err(e2) = AdSyncQueueRepository::mark_retry(&pool, event.id, &e.to_string()).await {
                                tracing::error!(event_id = %event.id, "Failed to mark retry: {}", e2);
                            }
                        }
                    }
                }
            }
            Err(e) => {
                tracing::error!("Failed to dequeue events: {}", e);
                tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
            }
        }
    }
}
```

- [ ] **Step 2: Register in lib.rs**

Add to `crates/signapps-ad-core/src/lib.rs`:

```rust
pub mod sync_worker;
```

- [ ] **Step 3: Verify compilation**

Run: `cargo check -p signapps-ad-core`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add crates/signapps-ad-core/src/sync_worker.rs crates/signapps-ad-core/src/lib.rs
git commit -m "feat(ad-sync): sync worker engine — processes OU/user events from queue"
```

---

### Task 14: Wire sync worker into signapps-dc

**Files:**
- Modify: `services/signapps-dc/src/main.rs`

- [ ] **Step 1: Add sync worker spawn after NTP listener**

Add after the NTP listener spawn, before "All DC listeners started":

```rust
    // AD Sync worker
    let sync_pool = pool.clone();
    let sync_handle = tokio::spawn(async move {
        signapps_ad_core::sync_worker::run_sync_worker(sync_pool).await;
    });

    tracing::info!("AD sync worker spawned");
```

Update the `tokio::join!` to include `sync_handle`:

```rust
    let _ = tokio::join!(health_handle, ldap_handle, kdc_handle, ntp_handle, sync_handle);
```

- [ ] **Step 2: Verify compilation**

Run: `cargo check -p signapps-dc`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add services/signapps-dc/src/main.rs
git commit -m "feat(ad-sync): wire sync worker into signapps-dc main loop"
```

---

## Phase 4: Workforce API Handlers

### Task 15: AD Sync workforce handlers

**Files:**
- Create: `services/signapps-workforce/src/handlers/ad_sync.rs`
- Modify: `services/signapps-workforce/src/handlers/mod.rs`
- Modify: `services/signapps-workforce/src/main.rs`

- [ ] **Step 1: Create handlers**

```rust
// services/signapps-workforce/src/handlers/ad_sync.rs
//! Handlers for AD sync queue management and monitoring.

use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde_json::json;
use uuid::Uuid;

use crate::AppState;
use signapps_common::{middleware::TenantContext, Claims};
use signapps_db::models::ad_sync::*;
use signapps_db::repositories::AdSyncQueueRepository;

/// Get sync queue statistics for a domain.
#[tracing::instrument(skip_all)]
pub async fn sync_queue_stats(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(domain_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let stats = AdSyncQueueRepository::stats(&state.pool, domain_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get queue stats: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    Ok(Json(stats))
}

/// List recent sync events for a domain.
#[tracing::instrument(skip_all)]
pub async fn list_sync_events(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(domain_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let events: Vec<AdSyncEvent> = sqlx::query_as(
        "SELECT * FROM ad_sync_queue WHERE domain_id = $1 ORDER BY created_at DESC LIMIT 100",
    )
    .bind(domain_id)
    .fetch_all(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to list sync events: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    Ok(Json(json!(events)))
}

/// List AD OUs for a domain.
#[tracing::instrument(skip_all)]
pub async fn list_ad_ous(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(domain_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let ous: Vec<AdOu> = sqlx::query_as(
        "SELECT * FROM ad_ous WHERE domain_id = $1 ORDER BY distinguished_name",
    )
    .bind(domain_id)
    .fetch_all(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to list OUs: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    Ok(Json(json!(ous)))
}

/// List AD user accounts for a domain.
#[tracing::instrument(skip_all)]
pub async fn list_ad_users(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(domain_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let users: Vec<AdUserAccount> = sqlx::query_as(
        "SELECT * FROM ad_user_accounts WHERE domain_id = $1 ORDER BY display_name",
    )
    .bind(domain_id)
    .fetch_all(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to list AD users: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    Ok(Json(json!(users)))
}

/// Manage mail domain assignment on org nodes.
#[tracing::instrument(skip_all)]
pub async fn set_node_mail_domain(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(node_id): Path<Uuid>,
    Json(body): Json<serde_json::Value>,
) -> Result<impl IntoResponse, StatusCode> {
    let domain_id: Uuid = serde_json::from_value(body["domain_id"].clone())
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    sqlx::query(
        "INSERT INTO ad_node_mail_domains (node_id, domain_id) VALUES ($1, $2) ON CONFLICT (node_id) DO UPDATE SET domain_id = $2",
    )
    .bind(node_id)
    .bind(domain_id)
    .execute(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to set node mail domain: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(StatusCode::NO_CONTENT)
}

/// Remove mail domain assignment from an org node.
#[tracing::instrument(skip_all)]
pub async fn remove_node_mail_domain(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(node_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    sqlx::query("DELETE FROM ad_node_mail_domains WHERE node_id = $1")
        .bind(node_id)
        .execute(&*state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to remove node mail domain: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(StatusCode::NO_CONTENT)
}

/// List DC sites for a domain.
#[tracing::instrument(skip_all)]
pub async fn list_dc_sites(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(domain_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let dcs: Vec<AdDcSite> = sqlx::query_as(
        "SELECT * FROM ad_dc_sites WHERE domain_id = $1 ORDER BY dc_hostname",
    )
    .bind(domain_id)
    .fetch_all(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to list DC sites: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    Ok(Json(json!(dcs)))
}
```

- [ ] **Step 2: Register handlers module**

Add to `services/signapps-workforce/src/handlers/mod.rs`:

```rust
pub mod ad_sync;
```

- [ ] **Step 3: Wire routes in main.rs**

Add AD sync routes to the workforce router:

```rust
        // ── AD Sync ──
        .route("/domains/:id/sync/stats", get(handlers::ad_sync::sync_queue_stats))
        .route("/domains/:id/sync/events", get(handlers::ad_sync::list_sync_events))
        .route("/domains/:id/ad-ous", get(handlers::ad_sync::list_ad_ous))
        .route("/domains/:id/ad-users", get(handlers::ad_sync::list_ad_users))
        .route("/domains/:id/dc-sites", get(handlers::ad_sync::list_dc_sites))
        .route("/org-nodes/:id/mail-domain", put(handlers::ad_sync::set_node_mail_domain))
        .route("/org-nodes/:id/mail-domain", delete(handlers::ad_sync::remove_node_mail_domain))
```

- [ ] **Step 4: Verify compilation**

Run: `cargo check -p signapps-workforce`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add services/signapps-workforce/src/handlers/ad_sync.rs services/signapps-workforce/src/handlers/mod.rs services/signapps-workforce/src/main.rs
git commit -m "feat(ad-sync): workforce API handlers for sync queue, OUs, users, DC sites, mail domains"
```

---

## Phase 5: Frontend

### Task 16: AD Sync frontend API + types

**Files:**
- Modify: `client/src/types/active-directory.ts`
- Modify: `client/src/lib/api/active-directory.ts`

- [ ] **Step 1: Add types**

Add to `client/src/types/active-directory.ts`:

```typescript
// ── AD Sync ──

export interface AdOu {
  id: string;
  domain_id: string;
  node_id: string;
  distinguished_name: string;
  parent_ou_id?: string;
  mail_distribution_enabled: boolean;
  sync_status: string;
  last_synced_at?: string;
  created_at: string;
}

export interface AdUserAccountInfo {
  id: string;
  domain_id: string;
  person_id: string;
  sam_account_name: string;
  user_principal_name: string;
  distinguished_name: string;
  display_name: string;
  title?: string;
  department?: string;
  mail?: string;
  is_enabled: boolean;
  sync_status: string;
  created_at: string;
}

export interface AdSyncEvent {
  id: string;
  domain_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  priority: number;
  status: string;
  attempts: number;
  error_message?: string;
  created_at: string;
  processed_at?: string;
}

export interface AdSyncQueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  retry: number;
}

export interface AdDcSiteInfo {
  id: string;
  domain_id: string;
  dc_hostname: string;
  dc_ip: string;
  dc_role: string;
  dc_status: string;
  is_writable: boolean;
  is_primary: boolean;
  last_heartbeat_at?: string;
  created_at: string;
}
```

- [ ] **Step 2: Add API methods**

Add to `client/src/lib/api/active-directory.ts` in the `adApi` object:

```typescript
  // ── AD Sync ──
  sync: {
    queueStats: (domainId: string) =>
      client.get<AdSyncQueueStats>(`/workforce/ad/domains/${domainId}/sync/stats`),
    events: (domainId: string) =>
      client.get<AdSyncEvent[]>(`/workforce/ad/domains/${domainId}/sync/events`),
    ous: (domainId: string) =>
      client.get<AdOu[]>(`/workforce/ad/domains/${domainId}/ad-ous`),
    users: (domainId: string) =>
      client.get<AdUserAccountInfo[]>(`/workforce/ad/domains/${domainId}/ad-users`),
    dcSites: (domainId: string) =>
      client.get<AdDcSiteInfo[]>(`/workforce/ad/domains/${domainId}/dc-sites`),
    setMailDomain: (nodeId: string, domainId: string) =>
      client.put(`/workforce/ad/org-nodes/${nodeId}/mail-domain`, { domain_id: domainId }),
    removeMailDomain: (nodeId: string) =>
      client.delete(`/workforce/ad/org-nodes/${nodeId}/mail-domain`),
  },
```

- [ ] **Step 3: Verify TypeScript**

Run: `cd client && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add client/src/types/active-directory.ts client/src/lib/api/active-directory.ts
git commit -m "feat(ad-sync): frontend types and API client for AD sync"
```

---

### Task 17: AD Sync status page

**Files:**
- Create: `client/src/app/admin/active-directory/sync/page.tsx`

This page should show:
- Sync queue statistics (pending/processing/completed/failed/retry)
- Recent events table (last 100)
- AD OUs list with sync status badges
- AD User accounts list with status
- DC Sites status cards

Use the same patterns as existing AD admin pages (AppLayout, PageHeader, PageBreadcrumb, domain selector, loading/error states, shadcn/ui components).

- [ ] **Step 1: Create the page** (dispatch to subagent)

The page follows the exact pattern of `certificates/page.tsx` — domain selector, data tables, status badges. Include a "Rafraichir" button and auto-refresh every 10 seconds for the queue stats.

- [ ] **Step 2: Verify TypeScript**

Run: `cd client && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Add link to AD dashboard**

Add a "Synchronisation" card to the quick links in `client/src/app/admin/active-directory/page.tsx`:

```typescript
{
  href: "/admin/active-directory/sync",
  icon: RefreshCw,
  label: "Synchronisation",
  desc: "Queue, OUs, comptes AD",
},
```

- [ ] **Step 4: Commit**

```bash
git add client/src/app/admin/active-directory/sync/page.tsx client/src/app/admin/active-directory/page.tsx
git commit -m "feat(ad-sync): AD sync status page with queue stats, OUs, users, DC sites"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Section 3 Mapping → Task 10 (naming), Task 13 (OU/user handlers)
- [x] Section 4 Tables → Tasks 1-8 (migrations)
- [x] Section 5 Naming → Task 10 (naming.rs with tests)
- [x] Section 6 Sync flow → Task 13 (sync worker), Task 8 (triggers)
- [x] Section 7 Multi-site → Task 5 (dc_sites table), Task 15 (dc_sites handler)
- [x] Section 8 Snapshots → Task 6 (snapshots table) — snapshot creation/restore logic deferred to phase 2
- [x] Section 9 Mail → Task 4 (mail domains), Task 7 (shared mailboxes), Task 12 (resolver)
- [x] Section 10 Services → Task 14 (DC worker), Task 15 (workforce handlers)
- [x] Section 11 Migrations → Tasks 1-8

**Deferred to subsequent plans:**
- Snapshot creation/restore implementation (Phase 2 plan)
- DC promote/demote/migrate operations (Phase 2 plan)
- Reconciliation cron job (Phase 2 plan)
- Group sync worker handlers (Phase 2 plan — currently stubbed)
- Computer sync worker handlers (Phase 2 plan — currently stubbed)
- Shared mailbox IMAP folder integration with signapps-mail (Phase 2 plan)
