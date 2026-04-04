# Org Structure Enterprise — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement GPO-style policies, cross-functional groups, 3-axis policy resolution (org+site+country), delegations, audit trail, and Commander+Focus UX for international-scale org management.

**Architecture:** Extend signapps-workforce (port 3024) with new handlers for groups, policies, delegations, audit. Add 10 SQL migrations to the existing PostgreSQL+pgvector database. Enrich existing models in signapps-db. Rewrite the frontend org-structure page with Commander+Focus layout.

**Tech Stack:** Rust/Axum, sqlx, PostgreSQL+pgvector, JSONB, Next.js 16, React 19, TypeScript, Zustand, shadcn/ui, Tailwind CSS 4

**Spec:** `docs/superpowers/specs/2026-04-04-org-structure-enterprise-design.md`

---

## Phase 1: Database Migrations (10 migrations)

### Task 1: org_node_types table + seed

**Files:**
- Create: `migrations/202_org_node_types.sql`

- [ ] **Step 1: Write migration**

```sql
-- 202_org_node_types.sql
-- Extensible node type definitions (schema-as-data pattern)

CREATE TABLE IF NOT EXISTS workforce_org_node_types (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    tree_type   TEXT NOT NULL CHECK (tree_type IN ('internal', 'clients', 'suppliers')),
    name        TEXT NOT NULL,
    label       TEXT NOT NULL,
    color       TEXT,
    icon        TEXT,
    sort_order  INT DEFAULT 0,
    allowed_children TEXT[] DEFAULT '{}',
    schema      JSONB DEFAULT '{}',
    is_active   BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE (tenant_id, tree_type, name)
);

CREATE INDEX idx_node_types_tenant_tree ON workforce_org_node_types (tenant_id, tree_type);

-- Seed default types for the system tenant (NULL tenant = global defaults)
INSERT INTO workforce_org_node_types (id, tenant_id, tree_type, name, label, color, icon, sort_order)
VALUES
  -- internal
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'internal', 'group',      'Groupe',      'red',    'building-2', 0),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'internal', 'subsidiary',  'Filiale',     'orange', 'building',   1),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'internal', 'bu',          'BU',          'yellow', 'briefcase',  2),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'internal', 'department',  'Departement', 'blue',   'users',      3),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'internal', 'service',     'Service',     'green',  'cog',        4),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'internal', 'team',        'Equipe',      'purple', 'users',      5),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'internal', 'position',    'Poste',       'pink',   'user',       6),
  -- clients
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'clients', 'client_group', 'Groupe client',  'slate',  'building-2', 0),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'clients', 'client',       'Client',         'cyan',   'building',   1),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'clients', 'project',      'Projet',         'indigo', 'folder',     2),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'clients', 'workstream',   'Workstream',     'violet', 'git-branch', 3),
  -- suppliers
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'suppliers', 'supplier_group', 'Groupe fourn.', 'amber',  'building-2', 0),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'suppliers', 'supplier',       'Fournisseur',   'lime',   'building',   1),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'suppliers', 'contract',       'Contrat',       'emerald','file-text',  2)
ON CONFLICT DO NOTHING;
```

- [ ] **Step 2: Apply migration**

Run: `cd C:/Prog/signapps-platform && sqlx migrate run`
Expected: Migration applied successfully

- [ ] **Step 3: Commit**

```bash
git add migrations/202_org_node_types.sql
git commit -m "feat(db): add org_node_types table with seed data"
```

### Task 2: Extend org_nodes and persons with lifecycle_state + attributes

**Files:**
- Create: `migrations/203_org_lifecycle_attributes.sql`

- [ ] **Step 1: Write migration**

```sql
-- 203_org_lifecycle_attributes.sql
-- Add lifecycle_state and JSONB attributes to org_nodes and persons

-- org_nodes: lifecycle + attributes
ALTER TABLE workforce_org_nodes
    ADD COLUMN IF NOT EXISTS lifecycle_state TEXT DEFAULT 'live'
        CHECK (lifecycle_state IN ('live', 'recycled', 'tombstone')),
    ADD COLUMN IF NOT EXISTS attributes JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_org_nodes_lifecycle
    ON workforce_org_nodes (tenant_id, lifecycle_state)
    WHERE lifecycle_state = 'live';

-- persons (workforce_employees): lifecycle + attributes
ALTER TABLE workforce_employees
    ADD COLUMN IF NOT EXISTS lifecycle_state TEXT DEFAULT 'live'
        CHECK (lifecycle_state IN ('live', 'recycled', 'tombstone')),
    ADD COLUMN IF NOT EXISTS attributes JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_employees_lifecycle
    ON workforce_employees (tenant_id, lifecycle_state)
    WHERE lifecycle_state = 'live';

-- org_trees: description + attributes
ALTER TABLE workforce_org_nodes
    ADD COLUMN IF NOT EXISTS description TEXT;

-- Ensure default values for existing rows
UPDATE workforce_org_nodes SET lifecycle_state = 'live' WHERE lifecycle_state IS NULL;
UPDATE workforce_employees SET lifecycle_state = 'live' WHERE lifecycle_state IS NULL;
```

- [ ] **Step 2: Apply and commit**

```bash
sqlx migrate run
git add migrations/203_org_lifecycle_attributes.sql
git commit -m "feat(db): add lifecycle_state and JSONB attributes to org_nodes and persons"
```

### Task 3: org_groups + org_group_members tables

**Files:**
- Create: `migrations/204_org_groups.sql`

- [ ] **Step 1: Write migration**

```sql
-- 204_org_groups.sql
-- Cross-functional groups: static, dynamic, derived, hybrid

CREATE TABLE IF NOT EXISTS workforce_org_groups (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    name        TEXT NOT NULL,
    description TEXT,
    group_type  TEXT NOT NULL CHECK (group_type IN ('static', 'dynamic', 'derived', 'hybrid')),
    filter      JSONB,
    managed_by  UUID REFERENCES workforce_org_groups(id) ON DELETE SET NULL,
    valid_from  TIMESTAMPTZ,
    valid_until TIMESTAMPTZ,
    is_active   BOOLEAN DEFAULT true,
    attributes  JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_org_groups_tenant ON workforce_org_groups (tenant_id);
CREATE INDEX idx_org_groups_type ON workforce_org_groups (tenant_id, group_type);
CREATE INDEX idx_org_groups_managed_by ON workforce_org_groups (managed_by) WHERE managed_by IS NOT NULL;

CREATE TABLE IF NOT EXISTS workforce_org_group_members (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id            UUID NOT NULL REFERENCES workforce_org_groups(id) ON DELETE CASCADE,
    member_type         TEXT NOT NULL CHECK (member_type IN ('person', 'group', 'node')),
    member_id           UUID NOT NULL,
    is_manual_override  BOOLEAN DEFAULT false,
    created_at          TIMESTAMPTZ DEFAULT now(),
    UNIQUE (group_id, member_type, member_id)
);

CREATE INDEX idx_group_members_group ON workforce_org_group_members (group_id);
CREATE INDEX idx_group_members_member ON workforce_org_group_members (member_type, member_id);
```

- [ ] **Step 2: Apply and commit**

```bash
sqlx migrate run
git add migrations/204_org_groups.sql
git commit -m "feat(db): add org_groups and org_group_members tables"
```

### Task 4: org_memberof materialized index

**Files:**
- Create: `migrations/205_org_memberof.sql`

- [ ] **Step 1: Write migration**

```sql
-- 205_org_memberof.sql
-- Auto-computed reverse index of group membership (Kanidm memberOf pattern)

CREATE TABLE IF NOT EXISTS workforce_org_memberof (
    person_id   UUID NOT NULL,
    group_id    UUID NOT NULL REFERENCES workforce_org_groups(id) ON DELETE CASCADE,
    source      TEXT NOT NULL CHECK (source IN ('direct', 'nested', 'dynamic', 'node')),
    computed_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (person_id, group_id, source)
);

CREATE INDEX idx_memberof_person ON workforce_org_memberof (person_id);
CREATE INDEX idx_memberof_group ON workforce_org_memberof (group_id);

-- Function to recompute memberof for a specific group
CREATE OR REPLACE FUNCTION recompute_group_memberof(p_group_id UUID)
RETURNS void AS $$
BEGIN
    -- Delete existing computed memberships for this group
    DELETE FROM workforce_org_memberof WHERE group_id = p_group_id;

    -- Insert direct person members
    INSERT INTO workforce_org_memberof (person_id, group_id, source)
    SELECT member_id, p_group_id, 'direct'
    FROM workforce_org_group_members
    WHERE group_id = p_group_id AND member_type = 'person'
    ON CONFLICT DO NOTHING;

    -- Insert from nested groups (recursive)
    INSERT INTO workforce_org_memberof (person_id, group_id, source)
    SELECT DISTINCT mo.person_id, p_group_id, 'nested'
    FROM workforce_org_group_members gm
    JOIN workforce_org_memberof mo ON mo.group_id = gm.member_id
    WHERE gm.group_id = p_group_id AND gm.member_type = 'group'
    ON CONFLICT DO NOTHING;

    -- Insert from node members (all persons assigned to that node and descendants)
    INSERT INTO workforce_org_memberof (person_id, group_id, source)
    SELECT DISTINCT a.employee_id, p_group_id, 'node'
    FROM workforce_org_group_members gm
    JOIN workforce_org_closure c ON c.ancestor_id = gm.member_id
    JOIN workforce_assignments a ON a.node_id = c.descendant_id
        AND (a.end_date IS NULL OR a.end_date > now())
    WHERE gm.group_id = p_group_id AND gm.member_type = 'node'
    ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Trigger on group_members changes
CREATE OR REPLACE FUNCTION trigger_recompute_memberof()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM recompute_group_memberof(OLD.group_id);
        RETURN OLD;
    ELSE
        PERFORM recompute_group_memberof(NEW.group_id);
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_group_members_memberof
    AFTER INSERT OR UPDATE OR DELETE ON workforce_org_group_members
    FOR EACH ROW EXECUTE FUNCTION trigger_recompute_memberof();
```

- [ ] **Step 2: Apply and commit**

```bash
sqlx migrate run
git add migrations/205_org_memberof.sql
git commit -m "feat(db): add org_memberof table with auto-recompute trigger"
```

### Task 5: org_policies + org_policy_links + country_policies

**Files:**
- Create: `migrations/206_org_policies.sql`

- [ ] **Step 1: Write migration**

```sql
-- 206_org_policies.sql
-- GPO-style policy engine

CREATE TABLE IF NOT EXISTS workforce_org_policies (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    name        TEXT NOT NULL,
    description TEXT,
    domain      TEXT NOT NULL CHECK (domain IN ('security', 'modules', 'naming', 'delegation', 'compliance', 'custom')),
    priority    INT NOT NULL DEFAULT 100,
    is_enforced BOOLEAN DEFAULT false,
    is_disabled BOOLEAN DEFAULT false,
    settings    JSONB NOT NULL DEFAULT '{}',
    version     INT DEFAULT 1,
    attributes  JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE (tenant_id, name)
);

CREATE INDEX idx_policies_tenant ON workforce_org_policies (tenant_id);
CREATE INDEX idx_policies_domain ON workforce_org_policies (tenant_id, domain);

CREATE TABLE IF NOT EXISTS workforce_org_policy_links (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id   UUID NOT NULL REFERENCES workforce_org_policies(id) ON DELETE CASCADE,
    link_type   TEXT NOT NULL CHECK (link_type IN ('node', 'group', 'site', 'country', 'global')),
    link_id     TEXT NOT NULL,
    is_blocked  BOOLEAN DEFAULT false,
    created_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE (policy_id, link_type, link_id)
);

CREATE INDEX idx_policy_links_target ON workforce_org_policy_links (link_type, link_id);

CREATE TABLE IF NOT EXISTS workforce_country_policies (
    country_code TEXT NOT NULL,
    policy_id    UUID NOT NULL REFERENCES workforce_org_policies(id) ON DELETE CASCADE,
    PRIMARY KEY (country_code, policy_id)
);
```

- [ ] **Step 2: Apply and commit**

```bash
sqlx migrate run
git add migrations/206_org_policies.sql
git commit -m "feat(db): add org_policies, policy_links, and country_policies tables"
```

### Task 6: Enrich sites table + site_assignments

**Files:**
- Create: `migrations/207_sites_enrich.sql`

- [ ] **Step 1: Write migration**

```sql
-- 207_sites_enrich.sql
-- Enrich sites for international support + site_assignments N:M

ALTER TABLE workforce_sites
    ADD COLUMN IF NOT EXISTS code TEXT,
    ADD COLUMN IF NOT EXISTS country_code TEXT,
    ADD COLUMN IF NOT EXISTS legal_entity TEXT,
    ADD COLUMN IF NOT EXISTS attributes JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_sites_country ON workforce_sites (tenant_id, country_code)
    WHERE country_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS workforce_site_assignments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id         UUID NOT NULL REFERENCES workforce_sites(id) ON DELETE CASCADE,
    assignee_type   TEXT NOT NULL CHECK (assignee_type IN ('person', 'node')),
    assignee_id     UUID NOT NULL,
    is_primary      BOOLEAN DEFAULT false,
    schedule        JSONB,
    created_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE (site_id, assignee_type, assignee_id)
);

CREATE INDEX idx_site_assign_site ON workforce_site_assignments (site_id);
CREATE INDEX idx_site_assign_target ON workforce_site_assignments (assignee_type, assignee_id);
```

- [ ] **Step 2: Apply and commit**

```bash
sqlx migrate run
git add migrations/207_sites_enrich.sql
git commit -m "feat(db): enrich sites with country_code, legal_entity + site_assignments table"
```

### Task 7: org_delegations table

**Files:**
- Create: `migrations/208_org_delegations.sql`

- [ ] **Step 1: Write migration**

```sql
-- 208_org_delegations.sql
-- Scoped delegation chains

CREATE TABLE IF NOT EXISTS workforce_org_delegations (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    delegator_id            UUID NOT NULL,
    delegate_type           TEXT NOT NULL CHECK (delegate_type IN ('person', 'group')),
    delegate_id             UUID NOT NULL,
    scope_node_id           UUID NOT NULL REFERENCES workforce_org_nodes(id) ON DELETE CASCADE,
    permissions             JSONB NOT NULL DEFAULT '{}',
    delegated_by            UUID,
    depth                   INT DEFAULT 0,
    parent_delegation_id    UUID REFERENCES workforce_org_delegations(id) ON DELETE SET NULL,
    expires_at              TIMESTAMPTZ,
    is_active               BOOLEAN DEFAULT true,
    created_at              TIMESTAMPTZ DEFAULT now(),
    updated_at              TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_delegations_tenant ON workforce_org_delegations (tenant_id);
CREATE INDEX idx_delegations_delegate ON workforce_org_delegations (delegate_type, delegate_id);
CREATE INDEX idx_delegations_scope ON workforce_org_delegations (scope_node_id);
CREATE INDEX idx_delegations_active ON workforce_org_delegations (tenant_id, is_active)
    WHERE is_active = true;
```

- [ ] **Step 2: Apply and commit**

```bash
sqlx migrate run
git add migrations/208_org_delegations.sql
git commit -m "feat(db): add org_delegations table for scoped delegation chains"
```

### Task 8: org_audit_log partitioned table

**Files:**
- Create: `migrations/209_org_audit_log.sql`

- [ ] **Step 1: Write migration**

```sql
-- 209_org_audit_log.sql
-- Immutable audit log, partitioned by month

CREATE TABLE IF NOT EXISTS workforce_org_audit_log (
    id          UUID DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    actor_id    UUID NOT NULL,
    actor_type  TEXT NOT NULL DEFAULT 'user' CHECK (actor_type IN ('user', 'system', 'trigger')),
    action      TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id   UUID NOT NULL,
    changes     JSONB NOT NULL DEFAULT '{}',
    metadata    JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT now() NOT NULL,
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create partitions for next 12 months
DO $$
DECLARE
    start_date DATE := date_trunc('month', CURRENT_DATE);
    end_date DATE;
    partition_name TEXT;
BEGIN
    FOR i IN 0..11 LOOP
        end_date := start_date + interval '1 month';
        partition_name := 'workforce_org_audit_log_' || to_char(start_date, 'YYYY_MM');
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I PARTITION OF workforce_org_audit_log
             FOR VALUES FROM (%L) TO (%L)',
            partition_name, start_date, end_date
        );
        start_date := end_date;
    END LOOP;
END $$;

-- Default partition for overflow
CREATE TABLE IF NOT EXISTS workforce_org_audit_log_default
    PARTITION OF workforce_org_audit_log DEFAULT;

CREATE INDEX idx_audit_entity ON workforce_org_audit_log (tenant_id, entity_type, entity_id);
CREATE INDEX idx_audit_actor ON workforce_org_audit_log (tenant_id, actor_id);
CREATE INDEX idx_audit_time ON workforce_org_audit_log (tenant_id, created_at DESC);
```

- [ ] **Step 2: Apply and commit**

```bash
sqlx migrate run
git add migrations/209_org_audit_log.sql
git commit -m "feat(db): add partitioned org_audit_log table"
```

---

## Phase 2: Backend Models (signapps-db)

### Task 9: Group, Policy, Delegation, Audit models

**Files:**
- Create: `crates/signapps-db/src/models/org_groups.rs`
- Create: `crates/signapps-db/src/models/org_policies.rs`
- Create: `crates/signapps-db/src/models/org_delegations.rs`
- Create: `crates/signapps-db/src/models/org_audit.rs`
- Modify: `crates/signapps-db/src/models/mod.rs` — add `pub mod org_groups; pub mod org_policies; pub mod org_delegations; pub mod org_audit;`
- Modify: `crates/signapps-db/src/models/core_org.rs` — add `lifecycle_state` and `attributes` fields to existing structs

- [ ] **Step 1: Add lifecycle_state + attributes to existing models in core_org.rs**

Add to `OrgNode` struct:
```rust
pub lifecycle_state: String,
pub attributes: serde_json::Value,
pub description: Option<String>,
```

Add to `Person` struct (already has metadata, add lifecycle_state):
```rust
pub lifecycle_state: String,
pub attributes: serde_json::Value,
```

- [ ] **Step 2: Create org_groups.rs with OrgGroup, OrgGroupMember, OrgMemberOf**

```rust
//! Cross-functional group models: static, dynamic, derived, hybrid.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;
use uuid::Uuid;

/// A cross-functional group that spans the org tree.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct OrgGroup {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub group_type: String,
    pub filter: Option<serde_json::Value>,
    pub managed_by: Option<Uuid>,
    pub valid_from: Option<DateTime<Utc>>,
    pub valid_until: Option<DateTime<Utc>>,
    pub is_active: bool,
    pub attributes: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CreateOrgGroup {
    pub name: String,
    pub description: Option<String>,
    pub group_type: String,
    pub filter: Option<serde_json::Value>,
    pub managed_by: Option<Uuid>,
    pub valid_from: Option<DateTime<Utc>>,
    pub valid_until: Option<DateTime<Utc>>,
    pub attributes: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct UpdateOrgGroup {
    pub name: Option<String>,
    pub description: Option<String>,
    pub filter: Option<serde_json::Value>,
    pub managed_by: Option<Uuid>,
    pub valid_from: Option<DateTime<Utc>>,
    pub valid_until: Option<DateTime<Utc>>,
    pub is_active: Option<bool>,
    pub attributes: Option<serde_json::Value>,
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct OrgGroupMember {
    pub id: Uuid,
    pub group_id: Uuid,
    pub member_type: String,
    pub member_id: Uuid,
    pub is_manual_override: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AddGroupMember {
    pub member_type: String,
    pub member_id: Uuid,
    pub is_manual_override: Option<bool>,
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct OrgMemberOf {
    pub person_id: Uuid,
    pub group_id: Uuid,
    pub source: String,
    pub computed_at: DateTime<Utc>,
}
```

- [ ] **Step 3: Create org_policies.rs**

Follow same pattern with `OrgPolicy`, `CreateOrgPolicy`, `UpdateOrgPolicy`, `OrgPolicyLink`, `CreatePolicyLink`, `CountryPolicy`, `EffectivePolicy` (resolved result with sources).

- [ ] **Step 4: Create org_delegations.rs**

`OrgDelegation`, `CreateDelegation`, `UpdateDelegation` structs.

- [ ] **Step 5: Create org_audit.rs**

`OrgAuditEntry`, `CreateAuditEntry`, `AuditQuery` (filter params) structs.

- [ ] **Step 6: Update mod.rs exports and verify compilation**

Run: `cargo check -p signapps-db`
Expected: compiles cleanly

- [ ] **Step 7: Commit**

```bash
git add crates/signapps-db/src/models/
git commit -m "feat(db): add models for org groups, policies, delegations, audit"
```

---

## Phase 3: Backend Repositories (signapps-db)

### Task 10: Groups repository

**Files:**
- Create: `crates/signapps-db/src/repositories/core_org_repository/groups.rs`
- Modify: `crates/signapps-db/src/repositories/core_org_repository/mod.rs` — add `pub mod groups;`

- [ ] **Step 1: Implement CRUD + member management + memberof queries**

Key functions:
```rust
pub async fn list_groups(pool: &PgPool, tenant_id: Uuid) -> Result<Vec<OrgGroup>>
pub async fn create_group(pool: &PgPool, tenant_id: Uuid, input: CreateOrgGroup) -> Result<OrgGroup>
pub async fn get_group(pool: &PgPool, id: Uuid) -> Result<Option<OrgGroup>>
pub async fn update_group(pool: &PgPool, id: Uuid, input: UpdateOrgGroup) -> Result<OrgGroup>
pub async fn delete_group(pool: &PgPool, id: Uuid) -> Result<()>
pub async fn add_member(pool: &PgPool, group_id: Uuid, input: AddGroupMember) -> Result<OrgGroupMember>
pub async fn remove_member(pool: &PgPool, group_id: Uuid, member_id: Uuid) -> Result<()>
pub async fn list_members(pool: &PgPool, group_id: Uuid) -> Result<Vec<OrgGroupMember>>
pub async fn list_effective_members(pool: &PgPool, group_id: Uuid) -> Result<Vec<Uuid>>
pub async fn get_person_memberof(pool: &PgPool, person_id: Uuid) -> Result<Vec<OrgMemberOf>>
```

- [ ] **Step 2: Verify compilation**

Run: `cargo check -p signapps-db`

- [ ] **Step 3: Commit**

```bash
git add crates/signapps-db/src/repositories/core_org_repository/groups.rs
git add crates/signapps-db/src/repositories/core_org_repository/mod.rs
git commit -m "feat(db): add groups repository with memberof queries"
```

### Task 11: Policies repository

**Files:**
- Create: `crates/signapps-db/src/repositories/core_org_repository/policies.rs`

- [ ] **Step 1: Implement CRUD + links + resolution**

Key functions:
```rust
pub async fn list_policies(pool: &PgPool, tenant_id: Uuid, domain: Option<&str>) -> Result<Vec<OrgPolicy>>
pub async fn create_policy(pool: &PgPool, tenant_id: Uuid, input: CreateOrgPolicy) -> Result<OrgPolicy>
pub async fn get_policy(pool: &PgPool, id: Uuid) -> Result<Option<OrgPolicy>>
pub async fn update_policy(pool: &PgPool, id: Uuid, input: UpdateOrgPolicy) -> Result<OrgPolicy>
pub async fn delete_policy(pool: &PgPool, id: Uuid) -> Result<()>
pub async fn add_policy_link(pool: &PgPool, input: CreatePolicyLink) -> Result<OrgPolicyLink>
pub async fn remove_policy_link(pool: &PgPool, link_id: Uuid) -> Result<()>
pub async fn list_policy_links(pool: &PgPool, policy_id: Uuid) -> Result<Vec<OrgPolicyLink>>
pub async fn get_policies_for_node(pool: &PgPool, node_id: Uuid) -> Result<Vec<OrgPolicy>>
pub async fn get_policies_for_site(pool: &PgPool, site_id: Uuid) -> Result<Vec<OrgPolicy>>
pub async fn get_country_policies(pool: &PgPool, country_code: &str) -> Result<Vec<OrgPolicy>>
```

- [ ] **Step 2: Commit**

```bash
git add crates/signapps-db/src/repositories/core_org_repository/policies.rs
git commit -m "feat(db): add policies repository with link management"
```

### Task 12: Policy resolution engine

**Files:**
- Create: `crates/signapps-db/src/repositories/core_org_repository/policy_resolver.rs`

- [ ] **Step 1: Implement the 5-step resolution algorithm**

This is the core GPO engine. The function collects policies from all 5 sources (org ancestors, site ancestors, country, groups, global), filters, separates enforced/normal, merges by domain (strict for security, priority for rest), and returns `EffectivePolicy` with full source traceability.

```rust
pub async fn resolve_person_policy(pool: &PgPool, person_id: Uuid) -> Result<EffectivePolicy>
pub async fn resolve_node_policy(pool: &PgPool, node_id: Uuid) -> Result<EffectivePolicy>

// Internal helpers
fn merge_security_settings(policies: &[OrgPolicy]) -> serde_json::Value  // strict wins
fn merge_priority_settings(policies: &[OrgPolicy]) -> serde_json::Value  // priority ASC
fn deep_merge_custom(policies: &[OrgPolicy]) -> serde_json::Value        // deep merge
```

- [ ] **Step 2: Commit**

```bash
git add crates/signapps-db/src/repositories/core_org_repository/policy_resolver.rs
git commit -m "feat(db): implement GPO policy resolution engine — 3-axis merge"
```

### Task 13: Delegations + Audit repositories

**Files:**
- Create: `crates/signapps-db/src/repositories/core_org_repository/delegations.rs`
- Create: `crates/signapps-db/src/repositories/core_org_repository/audit.rs`

- [ ] **Step 1: Delegations CRUD**

```rust
pub async fn list_delegations(pool: &PgPool, tenant_id: Uuid) -> Result<Vec<OrgDelegation>>
pub async fn create_delegation(pool: &PgPool, tenant_id: Uuid, input: CreateDelegation) -> Result<OrgDelegation>
pub async fn revoke_delegation(pool: &PgPool, id: Uuid) -> Result<()>
pub async fn get_delegations_for_person(pool: &PgPool, person_id: Uuid) -> Result<Vec<OrgDelegation>>
pub async fn get_delegations_granted_by(pool: &PgPool, person_id: Uuid) -> Result<Vec<OrgDelegation>>
pub async fn check_delegation_depth(pool: &PgPool, delegation_id: Uuid, max_depth: Option<i32>) -> Result<bool>
```

- [ ] **Step 2: Audit log insert + query**

```rust
pub async fn log_audit(pool: &PgPool, entry: CreateAuditEntry) -> Result<()>
pub async fn query_audit(pool: &PgPool, query: AuditQuery) -> Result<Vec<OrgAuditEntry>>
pub async fn get_entity_history(pool: &PgPool, entity_type: &str, entity_id: Uuid) -> Result<Vec<OrgAuditEntry>>
```

- [ ] **Step 3: Commit**

```bash
git add crates/signapps-db/src/repositories/core_org_repository/delegations.rs
git add crates/signapps-db/src/repositories/core_org_repository/audit.rs
git commit -m "feat(db): add delegations and audit repositories"
```

---

## Phase 4: Backend Handlers (signapps-workforce)

### Task 14: Groups handler

**Files:**
- Create: `services/signapps-workforce/src/handlers/groups.rs`
- Modify: `services/signapps-workforce/src/handlers/mod.rs` — add `pub mod groups;`
- Modify: `services/signapps-workforce/src/main.rs` — add group_routes nest

- [ ] **Step 1: Implement group endpoints**

8 handlers: `list_groups`, `create_group`, `get_group`, `update_group`, `delete_group`, `add_member`, `remove_member`, `get_effective_members`, `get_person_memberof`

Each handler follows the service pattern:
- `#[instrument(skip(state, claims))]`
- `#[utoipa::path(...)]`
- Returns `Result<Json<_>, AppError>`
- Calls audit log on mutations

- [ ] **Step 2: Register routes in main.rs**

```rust
let group_routes = Router::new()
    .route("/", get(handlers::groups::list_groups))
    .route("/", post(handlers::groups::create_group))
    .route("/{id}", get(handlers::groups::get_group))
    .route("/{id}", put(handlers::groups::update_group))
    .route("/{id}", delete(handlers::groups::delete_group))
    .route("/{id}/members", post(handlers::groups::add_member))
    .route("/{id}/members/{member_id}", delete(handlers::groups::remove_member))
    .route("/{id}/effective-members", get(handlers::groups::get_effective_members))
    // ... auth middleware ...
```

Add: `.nest("/api/v1/workforce/groups", group_routes)`

- [ ] **Step 3: Verify compilation and commit**

```bash
cargo check -p signapps-workforce
git add services/signapps-workforce/src/handlers/groups.rs
git add services/signapps-workforce/src/handlers/mod.rs
git add services/signapps-workforce/src/main.rs
git commit -m "feat(workforce): add groups handler with CRUD + member management"
```

### Task 15: Policies handler

**Files:**
- Create: `services/signapps-workforce/src/handlers/policies.rs`
- Modify: `services/signapps-workforce/src/main.rs` — add policy_routes

- [ ] **Step 1: Implement policy endpoints**

10 handlers: `list_policies`, `create_policy`, `get_policy`, `update_policy`, `delete_policy`, `add_link`, `remove_link`, `resolve_person`, `resolve_node`, `simulate`

- [ ] **Step 2: Register routes and commit**

```bash
cargo check -p signapps-workforce
git add services/signapps-workforce/src/handlers/policies.rs
git add services/signapps-workforce/src/main.rs
git commit -m "feat(workforce): add policies handler with GPO resolution endpoints"
```

### Task 16: Delegations + Audit handlers

**Files:**
- Create: `services/signapps-workforce/src/handlers/delegations.rs`
- Create: `services/signapps-workforce/src/handlers/audit.rs`
- Modify: `services/signapps-workforce/src/main.rs` — add delegation_routes + audit_routes

- [ ] **Step 1: Delegations handler** — `list`, `create`, `revoke`, `my_delegations`, `granted_by`

- [ ] **Step 2: Audit handler** — `query_audit`, `entity_history`, `actor_history`

- [ ] **Step 3: Register routes and commit**

```bash
cargo check -p signapps-workforce
git add services/signapps-workforce/src/handlers/delegations.rs
git add services/signapps-workforce/src/handlers/audit.rs
git add services/signapps-workforce/src/main.rs
git commit -m "feat(workforce): add delegations and audit handlers"
```

### Task 17: Enrich existing handlers (sites, assignments)

**Files:**
- Modify: `services/signapps-workforce/src/handlers/org.rs` — add `get_node_effective_policy` endpoint
- Modify: `services/signapps-workforce/src/handlers/employees.rs` — add `get_person_memberof` endpoint

- [ ] **Step 1: Add policy resolution to org handler**

Add endpoint: `GET /org/nodes/{id}/effective-policy` → calls `resolve_node_policy`

- [ ] **Step 2: Add memberof to employees handler**

Add endpoint: `GET /employees/{id}/memberof` → calls `get_person_memberof`

- [ ] **Step 3: Add site_assignments to sites**

If sites handler exists, add `POST /sites/{id}/assign` and `DELETE /sites/{id}/assign/{id}`.

- [ ] **Step 4: Commit**

```bash
git add services/signapps-workforce/src/handlers/
git commit -m "feat(workforce): enrich org, employees, sites handlers with policy + memberof"
```

---

## Phase 5: Frontend Types + API + Store

### Task 18: Extend TypeScript types

**Files:**
- Modify: `client/src/types/org.ts` — add OrgGroup, OrgPolicy, OrgPolicyLink, OrgDelegation, OrgAuditEntry, EffectivePolicy, SiteAssignment types

- [ ] **Step 1: Add all new types**

```typescript
// Group types
export type GroupType = 'static' | 'dynamic' | 'derived' | 'hybrid';

export interface OrgGroup {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  group_type: GroupType;
  filter?: Record<string, unknown>;
  managed_by?: string;
  valid_from?: string;
  valid_until?: string;
  is_active: boolean;
  attributes: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// Policy types
export type PolicyDomain = 'security' | 'modules' | 'naming' | 'delegation' | 'compliance' | 'custom';

export interface OrgPolicy {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  domain: PolicyDomain;
  priority: number;
  is_enforced: boolean;
  is_disabled: boolean;
  settings: Record<string, unknown>;
  version: number;
  attributes: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface OrgPolicyLink {
  id: string;
  policy_id: string;
  link_type: 'node' | 'group' | 'site' | 'country' | 'global';
  link_id: string;
  is_blocked: boolean;
}

export interface PolicySource {
  key: string;
  value: unknown;
  policy_id: string;
  policy_name: string;
  link_type: string;
  via: string;
}

export interface EffectivePolicy {
  settings: Record<string, unknown>;
  sources: PolicySource[];
}

// Delegation types
export interface OrgDelegation {
  id: string;
  tenant_id: string;
  delegator_id: string;
  delegate_type: 'person' | 'group';
  delegate_id: string;
  scope_node_id: string;
  permissions: Record<string, boolean>;
  depth: number;
  expires_at?: string;
  is_active: boolean;
  created_at: string;
}

// Audit types
export interface OrgAuditEntry {
  id: string;
  actor_id: string;
  actor_type: string;
  action: string;
  entity_type: string;
  entity_id: string;
  changes: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
}

// Site assignment
export interface SiteAssignment {
  id: string;
  site_id: string;
  assignee_type: 'person' | 'node';
  assignee_id: string;
  is_primary: boolean;
  schedule?: Record<string, unknown>;
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/types/org.ts
git commit -m "feat(types): add OrgGroup, OrgPolicy, OrgDelegation, OrgAuditEntry types"
```

### Task 19: Extend API client

**Files:**
- Modify: `client/src/lib/api/org.ts` — add groups, policies, delegations, audit sections

- [ ] **Step 1: Add new API sections**

```typescript
// Add after existing sections:

// ── Groups ────────────────────────────────────────────────
groups: {
  list: () => client.get<OrgGroup[]>('/workforce/groups'),
  create: (data: Partial<OrgGroup>) => client.post<OrgGroup>('/workforce/groups', data),
  get: (id: string) => client.get<OrgGroup>('/workforce/groups/' + id),
  update: (id: string, data: Partial<OrgGroup>) => client.put<OrgGroup>('/workforce/groups/' + id, data),
  delete: (id: string) => client.delete('/workforce/groups/' + id),
  addMember: (id: string, data: { member_type: string; member_id: string }) =>
    client.post('/workforce/groups/' + id + '/members', data),
  removeMember: (id: string, memberId: string) =>
    client.delete('/workforce/groups/' + id + '/members/' + memberId),
  effectiveMembers: (id: string) =>
    client.get<string[]>('/workforce/groups/' + id + '/effective-members'),
},

// ── Policies ──────────────────────────────────────────────
policies: {
  list: (domain?: string) => client.get<OrgPolicy[]>('/workforce/policies', { params: { domain } }),
  create: (data: Partial<OrgPolicy>) => client.post<OrgPolicy>('/workforce/policies', data),
  get: (id: string) => client.get<OrgPolicy>('/workforce/policies/' + id),
  update: (id: string, data: Partial<OrgPolicy>) => client.put<OrgPolicy>('/workforce/policies/' + id, data),
  delete: (id: string) => client.delete('/workforce/policies/' + id),
  addLink: (id: string, data: Partial<OrgPolicyLink>) =>
    client.post<OrgPolicyLink>('/workforce/policies/' + id + '/links', data),
  removeLink: (id: string, linkId: string) =>
    client.delete('/workforce/policies/' + id + '/links/' + linkId),
  resolvePerson: (personId: string) =>
    client.get<EffectivePolicy>('/workforce/policies/resolve/' + personId),
  resolveNode: (nodeId: string) =>
    client.get<EffectivePolicy>('/workforce/policies/resolve/node/' + nodeId),
},

// ── Delegations ───────────────────────────────────────────
delegations: {
  list: () => client.get<OrgDelegation[]>('/workforce/delegations'),
  create: (data: Partial<OrgDelegation>) => client.post<OrgDelegation>('/workforce/delegations', data),
  revoke: (id: string) => client.delete('/workforce/delegations/' + id),
  my: () => client.get<OrgDelegation[]>('/workforce/delegations/my'),
  granted: () => client.get<OrgDelegation[]>('/workforce/delegations/granted'),
},

// ── Audit ─────────────────────────────────────────────────
audit: {
  query: (params?: Record<string, unknown>) =>
    client.get<OrgAuditEntry[]>('/workforce/audit', { params }),
  entityHistory: (type: string, id: string) =>
    client.get<OrgAuditEntry[]>('/workforce/audit/entity/' + type + '/' + id),
},
```

- [ ] **Step 2: Commit**

```bash
git add client/src/lib/api/org.ts
git commit -m "feat(api): extend org API client with groups, policies, delegations, audit"
```

### Task 20: Extend Zustand store

**Files:**
- Modify: `client/src/stores/org-store.ts` — add groups, policies, activeDelegations, auditEntries state + fetch actions

- [ ] **Step 1: Add new state slices and actions**

Add `groups`, `policies`, `delegations` arrays + loading/error states + fetch actions. Keep the store focused — heavy logic stays in the page component.

- [ ] **Step 2: Commit**

```bash
git add client/src/stores/org-store.ts
git commit -m "feat(store): extend org store with groups, policies, delegations state"
```

---

## Phase 6: Frontend Page — Commander + Focus Mode

### Task 21: Refactor page structure — extract sub-components

The current page.tsx is ~1900 lines. Before adding features, extract reusable components to keep files focused.

**Files:**
- Create: `client/src/components/org/tree-view.tsx` — TreeNodeItem + tree rendering
- Create: `client/src/components/org/orgchart-view.tsx` — OrgChartCard + chart rendering
- Create: `client/src/components/org/list-view.tsx` — ListView table
- Create: `client/src/components/org/detail-panel.tsx` — DetailPanel with tabs
- Create: `client/src/components/org/nav-panel.tsx` — Left navigation (trees/groups/sites tabs)
- Modify: `client/src/app/admin/org-structure/page.tsx` — import extracted components

- [ ] **Step 1: Extract TreeNodeItem + TreeView into tree-view.tsx**

Move lines ~300-487 (TreeNodeItem, matchesSearch, TreeNode interface) into standalone component.

- [ ] **Step 2: Extract OrgChartCard into orgchart-view.tsx**

Move lines ~490-599 into standalone component.

- [ ] **Step 3: Extract ListView into list-view.tsx**

Move lines ~930-1073 into standalone component.

- [ ] **Step 4: Extract DetailPanel into detail-panel.tsx**

Move lines ~600-927 into standalone component.

- [ ] **Step 5: Create NavPanel with 3 tabs (Arbre, Groupes, Sites)**

New component wrapping the left navigation. The "Groupes" and "Sites" tabs will be wired in Task 22-23.

- [ ] **Step 6: Update page.tsx to import all extracted components**

Verify the page still works identically after extraction.

- [ ] **Step 7: Commit**

```bash
git add client/src/components/org/ client/src/app/admin/org-structure/page.tsx
git commit -m "refactor(ui): extract org-structure sub-components for Commander layout"
```

### Task 22: Wire assignments CRUD in DetailPanel

**Files:**
- Modify: `client/src/components/org/detail-panel.tsx`

- [ ] **Step 1: Wire the "Affecter" button to a dialog**

Create assignment dialog: select person (from search), assignment_type, responsibility_type, fte_ratio, start_date. Call `orgApi.assignments.create()`.

- [ ] **Step 2: Add edit/remove actions on each assignment card**

Each assignment card gets a dropdown menu with "Modifier" and "Terminer l'affectation". Calls `orgApi.assignments.update()` and `orgApi.assignments.end()`.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/org/detail-panel.tsx
git commit -m "feat(ui): wire assignments CRUD in detail panel — create, edit, end"
```

### Task 23: Add Policies tab in DetailPanel

**Files:**
- Modify: `client/src/components/org/detail-panel.tsx`

- [ ] **Step 1: Add "Policies" tab**

Show effective policies for the selected node via `orgApi.policies.resolveNode(node.id)`. Display each setting with its source (policy name, link type). Color-code enforced vs normal.

- [ ] **Step 2: Add "Attach policy" action**

Dropdown to pick an existing policy and attach it to this node via `orgApi.policies.addLink()`.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/org/detail-panel.tsx
git commit -m "feat(ui): add policies tab in detail panel — effective view + attach"
```

### Task 24: Add Sites tab in DetailPanel

**Files:**
- Modify: `client/src/components/org/detail-panel.tsx`

- [ ] **Step 1: Add "Sites" tab**

Show sites linked to this node via `orgApi.sites.list()` filtered. Show site name, city, country flag, capacity. Allow attaching/detaching sites.

- [ ] **Step 2: Commit**

```bash
git add client/src/components/org/detail-panel.tsx
git commit -m "feat(ui): add sites tab in detail panel"
```

### Task 25: Add Audit tab in DetailPanel

**Files:**
- Modify: `client/src/components/org/detail-panel.tsx`

- [ ] **Step 1: Add "Audit" tab**

Timeline view of changes to this node via `orgApi.audit.entityHistory('node', node.id)`. Show actor, action, timestamp, changes diff.

- [ ] **Step 2: Commit**

```bash
git add client/src/components/org/detail-panel.tsx
git commit -m "feat(ui): add audit trail tab in detail panel"
```

### Task 26: Groups panel in NavPanel

**Files:**
- Modify: `client/src/components/org/nav-panel.tsx`

- [ ] **Step 1: Implement "Groupes" tab**

List groups with type badges (static/dynamic/derived/hybrid). Search. Click to view group details in the detail panel (reuse DetailPanel with group context).

- [ ] **Step 2: Add group CRUD dialogs**

Create group dialog (name, type, managed_by). Add member dialog (pick person/group/node).

- [ ] **Step 3: Commit**

```bash
git add client/src/components/org/nav-panel.tsx
git commit -m "feat(ui): add groups tab in navigation panel with CRUD"
```

### Task 27: Sites panel in NavPanel

**Files:**
- Modify: `client/src/components/org/nav-panel.tsx`

- [ ] **Step 1: Implement "Sites" tab**

Hierarchical site tree (campus → building → floor). Country flags. Click to view site details.

- [ ] **Step 2: Commit**

```bash
git add client/src/components/org/nav-panel.tsx
git commit -m "feat(ui): add sites tab in navigation panel"
```

### Task 28: Focus mode — full-page detail

**Files:**
- Modify: `client/src/app/admin/org-structure/page.tsx`

- [ ] **Step 1: Implement focus mode toggle**

Double-click on a node or press Enter → the detail panel expands to full page. Navigation panel collapses to a thin strip. Breadcrumb navigation at top. All 6 tabs (Details, Personnes, Policies, Sites, Delegations, Audit) with full-width forms.

- [ ] **Step 2: Add Delegations tab (focus mode only)**

Show delegations for this node scope. Create/revoke delegation dialog.

- [ ] **Step 3: Add back button → return to Commander mode**

Press Escape or click back arrow → collapse detail, restore triple panel.

- [ ] **Step 4: Commit**

```bash
git add client/src/app/admin/org-structure/page.tsx
git commit -m "feat(ui): implement Commander + Focus mode with delegations tab"
```

---

## Phase 7: Integration + Polish

### Task 29: TypeScript check + lint

- [ ] **Step 1: Run type check**

```bash
cd client && npx tsc --noEmit
```

Fix any errors in the org-structure files.

- [ ] **Step 2: Run lint**

```bash
cd client && npx eslint src/app/admin/org-structure/ src/components/org/ --fix
```

- [ ] **Step 3: Commit fixes**

```bash
git add client/
git commit -m "fix(ui): resolve TypeScript and lint errors in org-structure"
```

### Task 30: Backend compilation + sqlx prepare

- [ ] **Step 1: Full workspace check**

```bash
cargo check --workspace
```

Fix any compilation errors.

- [ ] **Step 2: Prepare sqlx offline data**

```bash
cargo sqlx prepare --workspace
```

- [ ] **Step 3: Commit**

```bash
git add .sqlx/ crates/ services/
git commit -m "chore: fix compilation and update sqlx offline data"
```

### Task 31: Final integration commit

- [ ] **Step 1: Verify full pipeline**

```bash
just ci-quick  # check + lint
cd client && npm run build  # frontend build
```

- [ ] **Step 2: Final commit if any remaining fixes**

```bash
git commit -m "feat(org): org structure enterprise — complete implementation"
```

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | 1-8 | Database migrations (8 SQL files) |
| 2 | 9 | Backend models (4 new model files) |
| 3 | 10-13 | Backend repositories (5 new repo files) |
| 4 | 14-17 | Backend handlers (4 new handler files + enrichments) |
| 5 | 18-20 | Frontend types + API + store |
| 6 | 21-28 | Frontend Commander + Focus mode (6 new components) |
| 7 | 29-31 | Integration + polish |

**Total: 31 tasks, ~50 files created/modified**
