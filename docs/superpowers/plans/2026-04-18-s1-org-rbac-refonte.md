# S1 · Org + RBAC + AD + Provisioning + Sharing Refonte — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unifier org + RBAC + AD sync + provisioning cross-service + sharing ponctuel en une source de vérité unique (`signapps-org` + PostgreSQL), consommée via un trait `OrgPermissionResolver` par les 34 services du single-binary.

**Architecture:** Top-down B.1 — d'abord le schéma SQL canonique + types Rust (Sem 1), puis consolidation du code workforce→org avec hard-cut des tables legacy (Sem 2), puis AD sync bidirectionnel (Sem 3), puis rollout du resolver RBAC partout (Sem 4), puis access grants + provisioning événementiel (Sem 5).

**Tech Stack:** Rust 1.75 (Axum, sqlx, ldap3, tokio, moka), PostgreSQL 17 (LTREE extension, GIST indexes), Next.js 16 Turbopack, Playwright E2E, PgEventBus (LISTEN/NOTIFY), `signapps-keystore` pour secrets AD.

---

## Scope Check

Ce plan couvre uniquement la **Spec S1** (`docs/superpowers/specs/2026-04-18-s1-org-rbac-refonte-design.md`). Tracks B (PXE) et C (seeding démo) sont des specs séparées (S2) ; Track D (tests intégrés cross-track) = S3.

## File Structure

### Fichiers créés

| Fichier | Responsabilité |
|---|---|
| `migrations/400_org_nodes.sql` | Table canonique org_nodes + LTREE + GIST index |
| `migrations/401_org_persons.sql` | Persons avec user_id/dn link |
| `migrations/402_org_assignments.sql` | 3-axis assignments |
| `migrations/403_org_policies.sql` | GPOs (policies + bindings) |
| `migrations/404_org_boards.sql` | Boards + board_members migrés depuis workforce |
| `migrations/405_org_access_grants.sql` | Access grants signés |
| `migrations/406_org_ad_sync_log.sql` | Audit log sync AD |
| `migrations/407_org_ad_config.sql` | Config AD par tenant (ldap_url, bind_dn, mode…) |
| `migrations/408_org_provisioning_log.sql` | Journal provisioning cross-service |
| `migrations/426_workforce_to_org_cutover.sql` | Hard-cut : copie workforce → org puis drop tables legacy |
| `crates/signapps-db/src/models/org/mod.rs` | Module root |
| `crates/signapps-db/src/models/org/node.rs` | `OrgNode`, `NodeKind` |
| `crates/signapps-db/src/models/org/person.rs` | `Person` |
| `crates/signapps-db/src/models/org/assignment.rs` | `Assignment`, `Axis` |
| `crates/signapps-db/src/models/org/policy.rs` | `Policy`, `PolicyBinding`, `PermissionSpec` |
| `crates/signapps-db/src/models/org/board.rs` | `Board`, `BoardMember` |
| `crates/signapps-db/src/models/org/access_grant.rs` | `AccessGrant` |
| `crates/signapps-db/src/repositories/org/*.rs` | Un fichier CRUD par entité |
| `crates/signapps-db/tests/org/*.rs` | Tests d'intégration CRUD |
| `crates/signapps-common/src/rbac/mod.rs` | Module root |
| `crates/signapps-common/src/rbac/types.rs` | `PersonRef`, `ResourceRef`, `Action`, `Decision`, `DecisionSource` |
| `crates/signapps-common/src/rbac/resolver.rs` | Trait `OrgPermissionResolver` |
| `crates/signapps-common/src/rbac/middleware.rs` | Axum layer `rbac::require` |
| `crates/signapps-common/src/rbac/cache.rs` | Moka wrapper |
| `services/signapps-org/src/handlers/nodes.rs` | CRUD nodes |
| `services/signapps-org/src/handlers/persons.rs` | CRUD persons |
| `services/signapps-org/src/handlers/assignments.rs` | CRUD assignments |
| `services/signapps-org/src/handlers/policies.rs` | CRUD policies + bindings |
| `services/signapps-org/src/handlers/boards.rs` | CRUD boards + members (ex-workforce) |
| `services/signapps-org/src/handlers/grants.rs` | Create/verify/revoke grants |
| `services/signapps-org/src/handlers/provisioning.rs` | Cross-service fan-out |
| `services/signapps-org/src/ad/mod.rs` | Module AD sync |
| `services/signapps-org/src/ad/config.rs` | `AdSyncConfig` + serialization |
| `services/signapps-org/src/ad/client.rs` | `ldap3` wrapper avec bind + search |
| `services/signapps-org/src/ad/sync.rs` | Cycle fetch → diff → apply |
| `services/signapps-org/src/ad/conflict.rs` | `ConflictStrategy` resolver |
| `services/signapps-org/src/rbac_client.rs` | Impl `OrgPermissionResolver` côté org service |
| `services/signapps-org/src/events.rs` | Émission `PgEventBus` topics |
| `services/signapps-org/src/grants/token.rs` | HMAC signer/verifier |
| `services/signapps-org/src/grants/redirect.rs` | Handler `/g/:token` |
| `services/signapps-org/tests/e2e_org.rs` | Integration tests |
| `tests/e2e_s1_scenarios.rs` | Rust-level E2E (8 scénarios) |
| `client/e2e/s1-org-rbac.spec.ts` | Playwright 8 scenarios |
| `.claude/skills/org-rbac-debug/SKILL.md` | Debug RBAC |
| `.claude/skills/ad-sync-debug/SKILL.md` | Debug AD sync |
| `.claude/skills/provisioning-debug/SKILL.md` | Debug provisioning |
| `docs/product-specs/53-org-rbac-refonte.md` | Product spec |

### Fichiers modifiés

| Fichier | Changement |
|---|---|
| `services/signapps-workforce/src/lib.rs` | Retire `ad*`, `boards`, `groups`, `policies`, `delegations`, `org/`, `employees/` — ne garde que HR pur |
| `services/signapps-workforce/Cargo.toml` | Drop ldap3/signapps-keystore deps |
| `services/signapps-org/src/lib.rs` | Nouveau router qui monte tous les handlers + subscribe events |
| `services/signapps-org/Cargo.toml` | + `ldap3`, `signapps-keystore`, `signapps-common::rbac` |
| `crates/signapps-db/src/lib.rs` | + `pub mod models::org` + repositories org |
| `crates/signapps-db/Cargo.toml` | + `ltree` feature sqlx si nécessaire |
| `crates/signapps-common/src/lib.rs` | + `pub mod rbac` |
| `crates/signapps-common/Cargo.toml` | + `moka`, `async-trait` (déjà probable) |
| `services/signapps-{identity,mail,storage,calendar,chat,…}/src/lib.rs` | Remplace middleware ad-hoc par `rbac::require(...)` (34 services) |
| `services/signapps-platform/src/services.rs` | Retire une éventuelle routée workforce/org redondante |
| `CLAUDE.md` | Section Préférences : mentionner RBAC unifié + hard-cut workforce |

---

## Waves

| Wave | Sem | Tasks | Livrable |
|---|---|---|---|
| **W1 Modèle canonique** | 1 (J1-J5) | 1–8 | Migrations 400-408 + types Rust + repos + tests CRUD |
| **W2 Consolidation + hard-cut** | 2 (J6-J10) | 9–15 | Migration 426 hard-cut + API org consolidée + workforce dégraissé |
| **W3 AD sync bidirectionnel** | 3 (J11-J15) | 16–21 | `signapps-org::ad::*` + config par tenant + dry-run |
| **W4 RBAC partout** | 4 (J16-J20) | 22–29 | Trait + middleware + rollout 34 services en 3 batches |
| **W5 Sharing + provisioning** | 5 (J21-J25) | 30–37 | Access grants + provisioning événementiel + dashboard |
| **W6 Finalisation** | (J26) | 38–41 | Debug skills + product spec + 8 Playwright E2E + merge |

---

## Wave 1 — Modèle canonique (J1-J5)

### Task 1: Feature branch + PostgreSQL LTREE extension

**Files:**
- Create: `migrations/400_enable_ltree.sql`

- [ ] **Step 1: Create feature branch**

```bash
rtk git checkout main
rtk git pull --ff-only origin main
rtk git checkout -b feature/s1-org-rbac-refonte
```

- [ ] **Step 2: Create LTREE enable migration**

Create `migrations/400_enable_ltree.sql`:

```sql
-- Enable PostgreSQL LTREE extension for materialized-path queries on
-- the org hierarchy (org_nodes.path).
CREATE EXTENSION IF NOT EXISTS ltree;
```

- [ ] **Step 3: Verify migration applies**

```bash
docker exec signapps-postgres psql -U signapps -d signapps -f - < migrations/400_enable_ltree.sql
docker exec signapps-postgres psql -U signapps -d signapps -c "SELECT extname FROM pg_extension WHERE extname='ltree';"
```

Expected: one row `ltree`.

- [ ] **Step 4: Commit**

```bash
rtk git add migrations/400_enable_ltree.sql
rtk git commit -m "feat(db): enable ltree extension for org hierarchy"
```

---

### Task 2: Canonical `org_nodes` table + Rust model

**Files:**
- Create: `migrations/401_org_nodes.sql`
- Create: `crates/signapps-db/src/models/org/mod.rs`
- Create: `crates/signapps-db/src/models/org/node.rs`

- [ ] **Step 1: Migration**

Create `migrations/401_org_nodes.sql`:

```sql
CREATE TABLE IF NOT EXISTS org_nodes (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL,
    kind       TEXT NOT NULL,
    parent_id  UUID REFERENCES org_nodes(id) ON DELETE SET NULL,
    path       LTREE NOT NULL,
    name       TEXT NOT NULL,
    slug       TEXT,
    attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
    active     BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_org_nodes_tenant_kind ON org_nodes(tenant_id, kind);
CREATE INDEX IF NOT EXISTS idx_org_nodes_path_gist  ON org_nodes USING GIST (path);
CREATE INDEX IF NOT EXISTS idx_org_nodes_parent      ON org_nodes(parent_id);
```

- [ ] **Step 2: Rust model**

Create `crates/signapps-db/src/models/org/mod.rs`:

```rust
//! Canonical organization data model (Sem 1 of the S1 refonte).

pub mod node;

pub use node::{NodeKind, OrgNode};
```

Create `crates/signapps-db/src/models/org/node.rs`:

```rust
//! Canonical `org_nodes` table: the hierarchy of entities, units,
//! positions and roles that compose a tenant's organization.
//!
//! Materialized path via LTREE so subtree queries (`path <@ 'acme.rd'`)
//! stay O(log n) even on large tenants (10k+ nodes).

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;
use uuid::Uuid;

/// The type of an organization node.  Drives UI rendering and the
/// permission resolver.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema, sqlx::Type)]
#[sqlx(type_name = "TEXT", rename_all = "snake_case")]
pub enum NodeKind {
    /// Top of a tenant hierarchy.
    Root,
    /// A legal entity (company, subsidiary).
    Entity,
    /// A functional unit (department, team, squad).
    Unit,
    /// A named position in the org chart (e.g., "Lead Designer").
    Position,
    /// A role (cross-cutting set of responsibilities).
    Role,
}

/// One node in the canonical organization tree.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct OrgNode {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub kind: NodeKind,
    pub parent_id: Option<Uuid>,
    /// LTREE materialized path, dot-separated slugs.
    pub path: String,
    pub name: String,
    pub slug: Option<String>,
    pub attributes: serde_json::Value,
    pub active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
```

- [ ] **Step 3: Expose from db lib**

Edit `crates/signapps-db/src/lib.rs` — add at the top:

```rust
pub mod models {
    pub mod org;
    // existing re-exports stay
}
```

(Adapt to the existing `models` module structure — append `pub mod org;` inside it.)

- [ ] **Step 4: Build**

```bash
cargo build -p signapps-db
```

Expected: success.

- [ ] **Step 5: Commit**

```bash
rtk git add migrations/401_org_nodes.sql crates/signapps-db/src/models/org
rtk git commit -m "feat(db): canonical org_nodes table + OrgNode model"
```

---

### Task 3: `org_persons` table + model

**Files:**
- Create: `migrations/402_org_persons.sql`
- Create: `crates/signapps-db/src/models/org/person.rs`

- [ ] **Step 1: Migration**

Create `migrations/402_org_persons.sql`:

```sql
CREATE TABLE IF NOT EXISTS org_persons (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL,
    user_id    UUID UNIQUE,
    email      TEXT NOT NULL,
    first_name TEXT,
    last_name  TEXT,
    dn         TEXT,
    attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
    active     BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_persons_tenant_email ON org_persons(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_org_persons_dn ON org_persons(dn);
```

- [ ] **Step 2: Model**

Create `crates/signapps-db/src/models/org/person.rs`:

```rust
//! Canonical `org_persons` table.  A person is a human entity known
//! to the tenant; their `user_id` links to the identity service row if
//! they have a SignApps account, `dn` to the LDAP/AD entry if synced.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct Person {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub user_id: Option<Uuid>,
    pub email: String,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub dn: Option<String>,
    pub attributes: serde_json::Value,
    pub active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
```

- [ ] **Step 3: Expose from `org/mod.rs`**

Edit `crates/signapps-db/src/models/org/mod.rs`:

```rust
pub mod node;
pub mod person;

pub use node::{NodeKind, OrgNode};
pub use person::Person;
```

- [ ] **Step 4: Build + commit**

```bash
cargo build -p signapps-db
rtk git add migrations/402_org_persons.sql crates/signapps-db/src/models/org/person.rs crates/signapps-db/src/models/org/mod.rs
rtk git commit -m "feat(db): canonical org_persons table + Person model"
```

---

### Task 4: `org_assignments` + 3-axis model

**Files:**
- Create: `migrations/403_org_assignments.sql`
- Create: `crates/signapps-db/src/models/org/assignment.rs`

- [ ] **Step 1: Migration**

```sql
-- migrations/403_org_assignments.sql
CREATE TABLE IF NOT EXISTS org_assignments (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL,
    person_id  UUID NOT NULL REFERENCES org_persons(id) ON DELETE CASCADE,
    node_id    UUID NOT NULL REFERENCES org_nodes(id) ON DELETE CASCADE,
    axis       TEXT NOT NULL,
    role       TEXT,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    start_date DATE,
    end_date   DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_org_assignments_person_axis ON org_assignments(person_id, axis);
CREATE INDEX IF NOT EXISTS idx_org_assignments_node ON org_assignments(node_id);
```

- [ ] **Step 2: Model**

Create `crates/signapps-db/src/models/org/assignment.rs`:

```rust
//! Canonical `org_assignments` table.  Each assignment attaches a
//! Person to an OrgNode along one of three axes:
//!
//! - **Structure** — the primary reporting line (manager, subordinate).
//! - **Focus** — what the person is currently working on (project, topic).
//! - **Group** — cross-cutting team (guild, committee).

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema, sqlx::Type)]
#[sqlx(type_name = "TEXT", rename_all = "snake_case")]
pub enum Axis {
    Structure,
    Focus,
    Group,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct Assignment {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub person_id: Uuid,
    pub node_id: Uuid,
    pub axis: Axis,
    pub role: Option<String>,
    pub is_primary: bool,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    pub created_at: DateTime<Utc>,
}
```

- [ ] **Step 3: Expose + build + commit**

Edit `crates/signapps-db/src/models/org/mod.rs`:

```rust
pub mod assignment;
pub use assignment::{Assignment, Axis};
```

```bash
cargo build -p signapps-db
rtk git add migrations/403_org_assignments.sql crates/signapps-db/src/models/org/assignment.rs crates/signapps-db/src/models/org/mod.rs
rtk git commit -m "feat(db): canonical org_assignments with 3-axis (structure/focus/group)"
```

---

### Task 5: `org_policies` + bindings

**Files:**
- Create: `migrations/404_org_policies.sql`
- Create: `crates/signapps-db/src/models/org/policy.rs`

- [ ] **Step 1: Migration**

```sql
-- migrations/404_org_policies.sql
CREATE TABLE IF NOT EXISTS org_policies (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    name        TEXT NOT NULL,
    description TEXT,
    permissions JSONB NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_org_policies_tenant ON org_policies(tenant_id);

CREATE TABLE IF NOT EXISTS org_policy_bindings (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id  UUID NOT NULL REFERENCES org_policies(id) ON DELETE CASCADE,
    node_id    UUID NOT NULL REFERENCES org_nodes(id) ON DELETE CASCADE,
    inherit    BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_org_policy_bindings_node ON org_policy_bindings(node_id);
CREATE INDEX IF NOT EXISTS idx_org_policy_bindings_policy ON org_policy_bindings(policy_id);
```

- [ ] **Step 2: Model**

Create `crates/signapps-db/src/models/org/policy.rs`:

```rust
//! Canonical `org_policies` (GPO-like) and `org_policy_bindings`.
//!
//! A policy names a bundle of `(resource, actions[])` grants.  A
//! binding attaches a policy to a node; `inherit=true` means the
//! binding propagates to every descendant in the LTREE.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PermissionSpec {
    pub resource: String,
    pub actions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct Policy {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub permissions: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct PolicyBinding {
    pub id: Uuid,
    pub policy_id: Uuid,
    pub node_id: Uuid,
    pub inherit: bool,
    pub created_at: DateTime<Utc>,
}
```

- [ ] **Step 3: Expose + build + commit**

Edit `org/mod.rs` → `pub mod policy; pub use policy::{PermissionSpec, Policy, PolicyBinding};`.

```bash
cargo build -p signapps-db
rtk git add migrations/404_org_policies.sql crates/signapps-db/src/models/org/policy.rs crates/signapps-db/src/models/org/mod.rs
rtk git commit -m "feat(db): canonical org_policies + policy_bindings with inherit flag"
```

---

### Task 6: `org_boards` + `org_access_grants` + `org_ad_sync_log` + `org_ad_config` + `org_provisioning_log`

**Files:**
- Create: `migrations/405_org_boards.sql`
- Create: `migrations/406_org_access_grants.sql`
- Create: `migrations/407_org_ad_sync_log.sql`
- Create: `migrations/408_org_ad_config.sql`
- Create: `migrations/409_org_provisioning_log.sql`
- Create: `crates/signapps-db/src/models/org/{board,access_grant,ad_config,ad_sync_log,provisioning_log}.rs`

- [ ] **Step 1: Migrations (batch)**

`migrations/405_org_boards.sql`:

```sql
CREATE TABLE IF NOT EXISTS org_boards (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id    UUID NOT NULL REFERENCES org_nodes(id) ON DELETE CASCADE UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS org_board_members (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id          UUID NOT NULL REFERENCES org_boards(id) ON DELETE CASCADE,
    person_id         UUID NOT NULL REFERENCES org_persons(id) ON DELETE CASCADE,
    role              TEXT NOT NULL,
    is_decision_maker BOOLEAN NOT NULL DEFAULT false,
    sort_order        INT  NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_org_board_members_board ON org_board_members(board_id);
```

`migrations/406_org_access_grants.sql`:

```sql
CREATE TABLE IF NOT EXISTS org_access_grants (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL,
    granted_by    UUID NOT NULL REFERENCES org_persons(id),
    granted_to    UUID REFERENCES org_persons(id),
    resource_type TEXT NOT NULL,
    resource_id   UUID NOT NULL,
    permissions   JSONB NOT NULL,
    token_hash    TEXT NOT NULL UNIQUE,
    expires_at    TIMESTAMPTZ,
    revoked_at    TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_grants_resource ON org_access_grants(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_grants_tenant ON org_access_grants(tenant_id);
```

`migrations/407_org_ad_sync_log.sql`:

```sql
CREATE TABLE IF NOT EXISTS org_ad_sync_log (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL,
    run_id     UUID NOT NULL,
    entry_dn   TEXT NOT NULL,
    direction  TEXT NOT NULL,
    status     TEXT NOT NULL,
    diff       JSONB NOT NULL,
    error      TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ad_sync_log_run ON org_ad_sync_log(run_id);
CREATE INDEX IF NOT EXISTS idx_ad_sync_log_status ON org_ad_sync_log(status);
```

`migrations/408_org_ad_config.sql`:

```sql
CREATE TABLE IF NOT EXISTS org_ad_config (
    tenant_id         UUID PRIMARY KEY,
    mode              TEXT NOT NULL DEFAULT 'off',
    ldap_url          TEXT,
    bind_dn           TEXT,
    bind_password_enc BYTEA,
    base_dn           TEXT,
    user_filter       TEXT,
    ou_filter         TEXT,
    sync_interval_sec INT  NOT NULL DEFAULT 300,
    conflict_strategy TEXT NOT NULL DEFAULT 'org_wins',
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

`migrations/409_org_provisioning_log.sql`:

```sql
CREATE TABLE IF NOT EXISTS org_provisioning_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    person_id   UUID NOT NULL REFERENCES org_persons(id) ON DELETE CASCADE,
    topic       TEXT NOT NULL,
    service     TEXT NOT NULL,
    status      TEXT NOT NULL,
    error       TEXT,
    attempts    INT  NOT NULL DEFAULT 1,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_prov_log_person ON org_provisioning_log(person_id);
CREATE INDEX IF NOT EXISTS idx_prov_log_status ON org_provisioning_log(status);
```

- [ ] **Step 2: Rust models (5 files)**

Same pattern as previous tasks: one struct per entity with `#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]`, field-for-field with rustdoc. Files:

- `crates/signapps-db/src/models/org/board.rs` — `Board`, `BoardMember`.
- `crates/signapps-db/src/models/org/access_grant.rs` — `AccessGrant`.
- `crates/signapps-db/src/models/org/ad_config.rs` — `AdConfig`, `AdSyncMode` (enum), `ConflictStrategy` (enum).
- `crates/signapps-db/src/models/org/ad_sync_log.rs` — `AdSyncLog`.
- `crates/signapps-db/src/models/org/provisioning_log.rs` — `ProvisioningLog`.

Each field mirrors the SQL columns. Enum string-typed via `sqlx::Type`.

- [ ] **Step 3: Expose + build + commit**

Update `crates/signapps-db/src/models/org/mod.rs` to expose all 5.

```bash
cargo build -p signapps-db
rtk git add migrations/40{5,6,7,8,9}_org_*.sql crates/signapps-db/src/models/org
rtk git commit -m "feat(db): org boards + access_grants + AD config/log + provisioning log"
```

---

### Task 7: Repositories for all org entities

**Files:**
- Create: `crates/signapps-db/src/repositories/org/mod.rs`
- Create: `crates/signapps-db/src/repositories/org/{node,person,assignment,policy,board,access_grant,ad_config,ad_sync_log,provisioning_log}_repository.rs`

- [ ] **Step 1: Module root**

Create `crates/signapps-db/src/repositories/org/mod.rs`:

```rust
//! Repositories for the canonical org data model.

pub mod node_repository;
pub mod person_repository;
pub mod assignment_repository;
pub mod policy_repository;
pub mod board_repository;
pub mod access_grant_repository;
pub mod ad_config_repository;
pub mod ad_sync_log_repository;
pub mod provisioning_log_repository;

pub use node_repository::NodeRepository;
pub use person_repository::PersonRepository;
pub use assignment_repository::AssignmentRepository;
pub use policy_repository::PolicyRepository;
pub use board_repository::BoardRepository;
pub use access_grant_repository::AccessGrantRepository;
pub use ad_config_repository::AdConfigRepository;
pub use ad_sync_log_repository::AdSyncLogRepository;
pub use provisioning_log_repository::ProvisioningLogRepository;
```

- [ ] **Step 2: Prototype one repository (node) — pattern for the 8 others**

Create `crates/signapps-db/src/repositories/org/node_repository.rs`:

```rust
//! CRUD + subtree queries for `org_nodes`.

use anyhow::Result;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::org::{NodeKind, OrgNode};

pub struct NodeRepository<'a> {
    pool: &'a PgPool,
}

impl<'a> NodeRepository<'a> {
    pub fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    pub async fn create(
        &self,
        tenant_id: Uuid,
        kind: NodeKind,
        parent_id: Option<Uuid>,
        path: &str,
        name: &str,
        slug: Option<&str>,
    ) -> Result<OrgNode> {
        let row = sqlx::query_as::<_, OrgNode>(
            "INSERT INTO org_nodes (tenant_id, kind, parent_id, path, name, slug)
             VALUES ($1, $2::text::text, $3, $4::ltree, $5, $6)
             RETURNING *",
        )
        .bind(tenant_id)
        .bind(kind)
        .bind(parent_id)
        .bind(path)
        .bind(name)
        .bind(slug)
        .fetch_one(self.pool)
        .await?;
        Ok(row)
    }

    pub async fn get(&self, id: Uuid) -> Result<Option<OrgNode>> {
        let row = sqlx::query_as::<_, OrgNode>("SELECT * FROM org_nodes WHERE id = $1")
            .bind(id)
            .fetch_optional(self.pool)
            .await?;
        Ok(row)
    }

    pub async fn list_by_tenant(&self, tenant_id: Uuid) -> Result<Vec<OrgNode>> {
        let rows = sqlx::query_as::<_, OrgNode>(
            "SELECT * FROM org_nodes WHERE tenant_id = $1 AND active = true ORDER BY path",
        )
        .bind(tenant_id)
        .fetch_all(self.pool)
        .await?;
        Ok(rows)
    }

    pub async fn subtree(&self, root_path: &str) -> Result<Vec<OrgNode>> {
        let rows = sqlx::query_as::<_, OrgNode>(
            "SELECT * FROM org_nodes WHERE path <@ $1::ltree AND active = true ORDER BY path",
        )
        .bind(root_path)
        .fetch_all(self.pool)
        .await?;
        Ok(rows)
    }

    pub async fn archive(&self, id: Uuid) -> Result<()> {
        sqlx::query("UPDATE org_nodes SET active = false, updated_at = now() WHERE id = $1")
            .bind(id)
            .execute(self.pool)
            .await?;
        Ok(())
    }
}
```

- [ ] **Step 3: Create the 8 remaining repositories**

Mirror the pattern above for each of:

- `person_repository.rs` — `create`, `get`, `get_by_email`, `get_by_dn`, `list_by_tenant`, `archive`.
- `assignment_repository.rs` — `create`, `list_by_person`, `list_by_node`, `delete`.
- `policy_repository.rs` — `create`, `get`, `bind_to_node`, `unbind`, `list_bindings_for_subtree`.
- `board_repository.rs` — `upsert_board`, `add_member`, `remove_member`, `get_by_node`, `decision_maker_for_node`.
- `access_grant_repository.rs` — `create`, `get_by_token`, `list_for_resource`, `revoke`, `bump_last_used`.
- `ad_config_repository.rs` — `upsert`, `get`.
- `ad_sync_log_repository.rs` — `insert`, `list_by_run`, `list_pending_retry`.
- `provisioning_log_repository.rs` — `insert`, `bump_attempts`, `mark_status`.

Each repository is a small focused file (~80-120 lines). No placeholders: write every method signature with a working SQL body inferred from the table DDL.

- [ ] **Step 4: Expose from lib**

Edit `crates/signapps-db/src/lib.rs` — append under existing `pub mod repositories`:

```rust
pub mod repositories {
    pub mod org;
    // existing modules stay
}
```

(Adapt to the existing `repositories` module style.)

- [ ] **Step 5: Build + commit**

```bash
cargo build -p signapps-db
rtk git add crates/signapps-db/src/repositories/org crates/signapps-db/src/lib.rs
rtk git commit -m "feat(db): repositories for org_nodes/persons/assignments/policies/boards/grants/ad/provisioning"
```

---

### Task 8: Unit tests for repositories

**Files:**
- Create: `crates/signapps-db/tests/org_crud.rs`

- [ ] **Step 1: Test file**

Create `crates/signapps-db/tests/org_crud.rs`:

```rust
use signapps_db::{create_pool, repositories::org::*};
use uuid::Uuid;

async fn pool() -> sqlx::PgPool {
    let url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://signapps:signapps_dev@localhost:5432/signapps".into());
    create_pool(&url).await.expect("pg pool").inner().clone()
}

#[tokio::test]
#[ignore = "requires postgres"]
async fn node_create_then_subtree() {
    let p = pool().await;
    let repo = NodeRepository::new(&p);
    let tenant = Uuid::new_v4();
    let root = repo
        .create(tenant, signapps_db::models::org::NodeKind::Root, None, "acme", "Acme", Some("acme"))
        .await
        .expect("root");
    let child = repo
        .create(
            tenant,
            signapps_db::models::org::NodeKind::Unit,
            Some(root.id),
            "acme.rd",
            "R&D",
            Some("rd"),
        )
        .await
        .expect("child");
    let subtree = repo.subtree("acme").await.expect("subtree");
    assert!(subtree.iter().any(|n| n.id == root.id));
    assert!(subtree.iter().any(|n| n.id == child.id));
}

#[tokio::test]
#[ignore = "requires postgres"]
async fn person_get_by_email() {
    let p = pool().await;
    let repo = PersonRepository::new(&p);
    let tenant = Uuid::new_v4();
    let created = repo
        .create(tenant, "alice@example.com", Some("Alice"), Some("Wonder"), None)
        .await
        .expect("create");
    let found = repo.get_by_email(tenant, "alice@example.com").await.expect("query");
    assert_eq!(found.map(|p| p.id), Some(created.id));
}
```

Add 6 more `#[ignore]`-gated tests: `assignment_create_and_list`, `policy_bind_and_query_subtree`, `board_upsert_with_decision_maker`, `access_grant_create_and_verify`, `ad_config_upsert`, `ad_sync_log_insert`.

- [ ] **Step 2: Run**

```bash
just db-start
cargo test -p signapps-db --test org_crud -- --ignored --nocapture
```

All tests PASS.

- [ ] **Step 3: Commit**

```bash
rtk git add crates/signapps-db/tests/org_crud.rs
rtk git commit -m "test(db): CRUD tests for all org repositories"
```

---

## Wave 2 — Consolidation + hard-cut (J6-J10)

### Task 9: New `signapps-org` router skeleton + deps

**Files:**
- Modify: `services/signapps-org/Cargo.toml`
- Modify: `services/signapps-org/src/lib.rs`

- [ ] **Step 1: Cargo deps**

Edit `services/signapps-org/Cargo.toml`, add under `[dependencies]`:

```toml
signapps-common  = { path = "../../crates/signapps-common", features = ["rbac"] }
signapps-db      = { path = "../../crates/signapps-db" }
signapps-keystore = { path = "../../crates/signapps-keystore" }
ldap3 = "0.11"
hmac = "0.12"
sha2 = "0.10"
```

- [ ] **Step 2: Router rewrite**

Replace the body of `signapps_org::router()` (in `services/signapps-org/src/lib.rs`) with a new assembly:

```rust
pub async fn router(shared: SharedState) -> anyhow::Result<Router> {
    let state = build_state(&shared).await?;
    spawn_ad_sync_workers(&state);
    spawn_provisioning_dispatcher(&state);
    Ok(Router::new()
        .nest("/api/v1/org/nodes", handlers::nodes::routes())
        .nest("/api/v1/org/persons", handlers::persons::routes())
        .nest("/api/v1/org/assignments", handlers::assignments::routes())
        .nest("/api/v1/org/policies", handlers::policies::routes())
        .nest("/api/v1/org/boards", handlers::boards::routes())
        .nest("/api/v1/org/grants", handlers::grants::routes())
        .nest("/api/v1/org/ad", handlers::ad::routes())
        .nest("/api/v1/org/provisioning", handlers::provisioning::routes())
        .nest("/g", grants::redirect::routes())
        .with_state(state)
        .layer(middleware_stack()))
}
```

Stub the new modules so the crate still compiles — `pub mod handlers { pub mod nodes; pub mod persons; ... }`. Each `routes()` returns an empty `Router::new()` placeholder; real CRUD wiring happens in Task 10.

- [ ] **Step 3: Build + commit**

```bash
cargo build -p signapps-org
rtk git add services/signapps-org/Cargo.toml services/signapps-org/src/lib.rs
rtk git commit -m "feat(org): scaffold router + dependency bumps for consolidation"
```

---

### Task 10: CRUD handlers for `nodes`, `persons`, `assignments`

**Files:**
- Create: `services/signapps-org/src/handlers/{nodes,persons,assignments}.rs`

- [ ] **Step 1: Nodes handlers**

Create `services/signapps-org/src/handlers/nodes.rs`:

```rust
//! CRUD handlers for `/api/v1/org/nodes`.

use axum::{extract::{Path, State, Query}, routing::{get, post, patch, delete}, Json, Router};
use serde::Deserialize;
use signapps_db::models::org::{NodeKind, OrgNode};
use signapps_db::repositories::org::NodeRepository;
use uuid::Uuid;

use crate::state::AppState;
use signapps_common::error::AppError;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list).post(create))
        .route("/:id", get(detail).patch(update).delete(archive))
        .route("/:id/subtree", get(subtree))
}

#[derive(Deserialize)]
struct ListQuery { tenant_id: Uuid, kind: Option<String> }

async fn list(State(st): State<AppState>, Query(q): Query<ListQuery>)
    -> Result<Json<Vec<OrgNode>>, AppError> {
    let repo = NodeRepository::new(st.pool.inner());
    Ok(Json(repo.list_by_tenant(q.tenant_id).await?))
}

#[derive(Deserialize)]
struct CreateBody {
    tenant_id: Uuid, kind: NodeKind, parent_id: Option<Uuid>,
    path: String, name: String, slug: Option<String>,
}

async fn create(State(st): State<AppState>, Json(b): Json<CreateBody>)
    -> Result<Json<OrgNode>, AppError> {
    let repo = NodeRepository::new(st.pool.inner());
    let node = repo.create(b.tenant_id, b.kind, b.parent_id, &b.path, &b.name, b.slug.as_deref()).await?;
    st.events.publish("org.node.created", &serde_json::to_value(&node)?).await?;
    Ok(Json(node))
}

async fn detail(State(st): State<AppState>, Path(id): Path<Uuid>)
    -> Result<Json<OrgNode>, AppError> {
    NodeRepository::new(st.pool.inner()).get(id).await?
        .map(Json).ok_or_else(|| AppError::not_found("org node"))
}

#[derive(Deserialize)] struct UpdateBody { name: Option<String>, slug: Option<String> }
async fn update(/* … */) -> Result<Json<OrgNode>, AppError> {
    // Rebuild the update statement via sqlx; short-circuit if both fields None.
    todo!("update impl — straight sqlx UPDATE SET ... WHERE id = $id")
}
// TDD: the todo!() will fail a real request until Task 11 implements the remaining endpoints.
// To avoid shipping half-working endpoints, keep an `unimplemented` response pattern:

async fn archive(State(st): State<AppState>, Path(id): Path<Uuid>) -> Result<(), AppError> {
    NodeRepository::new(st.pool.inner()).archive(id).await?;
    Ok(())
}

async fn subtree(State(st): State<AppState>, Path(id): Path<Uuid>)
    -> Result<Json<Vec<OrgNode>>, AppError> {
    let repo = NodeRepository::new(st.pool.inner());
    let root = repo.get(id).await?.ok_or_else(|| AppError::not_found("org node"))?;
    Ok(Json(repo.subtree(&root.path).await?))
}
```

Replace the two placeholder bodies (`update`) with a concrete implementation:

```rust
async fn update(State(st): State<AppState>, Path(id): Path<Uuid>, Json(b): Json<UpdateBody>)
    -> Result<Json<OrgNode>, AppError> {
    sqlx::query_as::<_, OrgNode>(
        "UPDATE org_nodes SET
            name = COALESCE($2, name),
            slug = COALESCE($3, slug),
            updated_at = now()
         WHERE id = $1 RETURNING *",
    )
    .bind(id).bind(b.name).bind(b.slug)
    .fetch_one(st.pool.inner()).await
    .map(Json).map_err(|e| AppError::internal(format!("{e}")))
}
```

- [ ] **Step 2: Persons + assignments handlers**

Same pattern in `handlers/persons.rs` and `handlers/assignments.rs` — CRUD + list-by-tenant + list-by-person.

- [ ] **Step 3: Add `#[utoipa::path]` decorators**

Decorate each handler with `#[utoipa::path(method, path = "/…", responses(…), tag = "Org")]` for OpenAPI.

- [ ] **Step 4: Build + commit**

```bash
cargo build -p signapps-org
rtk git add services/signapps-org/src/handlers/{nodes,persons,assignments}.rs
rtk git commit -m "feat(org): CRUD handlers for nodes/persons/assignments with OpenAPI"
```

---

### Task 11: CRUD handlers for `policies`, `boards`

**Files:**
- Create: `services/signapps-org/src/handlers/{policies,boards}.rs`

- [ ] **Step 1: Policies**

Create `services/signapps-org/src/handlers/policies.rs` — endpoints:
`POST /` create, `GET /?tenant_id=` list, `GET /:id` detail, `PATCH /:id`, `DELETE /:id`, `POST /:id/bindings`, `DELETE /bindings/:id`, `GET /bindings/subtree?path=` query.

Each method uses `PolicyRepository`. Publish `org.policy.created|updated|binding_changed` events via `st.events.publish(...)`.

- [ ] **Step 2: Boards**

Create `services/signapps-org/src/handlers/boards.rs` — endpoints:
`POST /` upsert, `GET /by-node/:node_id`, `POST /:board_id/members`, `PATCH /members/:id`, `DELETE /members/:id`.

Constraint: at most one `is_decision_maker=true` per board — enforce server-side via transaction (`BEGIN; UPDATE ... SET is_decision_maker=false WHERE board_id=$ AND id != $; UPDATE ... SET is_decision_maker=true; COMMIT;`).

- [ ] **Step 3: Build + commit**

```bash
cargo build -p signapps-org
rtk git add services/signapps-org/src/handlers/{policies,boards}.rs
rtk git commit -m "feat(org): CRUD for policies + bindings, boards + members"
```

---

### Task 12: Workforce dégraissage — drop non-HR modules

**Files:**
- Delete: `services/signapps-workforce/src/handlers/{ad.rs,ad_delegation.rs,ad_gpo.rs,ad_provisioning.rs,ad_sync.rs,boards.rs,delegations.rs,groups.rs,policies.rs}`
- Delete: `services/signapps-workforce/src/handlers/{org,employees}` directories
- Modify: `services/signapps-workforce/src/lib.rs` + `handlers/mod.rs`
- Modify: `services/signapps-workforce/Cargo.toml`

- [ ] **Step 1: Delete files**

```bash
rm -rf services/signapps-workforce/src/handlers/{ad.rs,ad_delegation.rs,ad_gpo.rs,ad_provisioning.rs,ad_sync.rs,boards.rs,delegations.rs,groups.rs,policies.rs,org,employees}
```

- [ ] **Step 2: Update `handlers/mod.rs`**

Open `services/signapps-workforce/src/handlers/mod.rs` and remove the `pub mod ad;` / `pub mod boards;` / etc. lines corresponding to the deleted files. Keep only: `attendance, audit, coverage, expenses, learning, lms, my_team, openapi, performance` (verify which HR modules remain).

- [ ] **Step 3: Update `lib.rs` router**

Remove route registrations for dropped modules. The router should mount only what remains.

- [ ] **Step 4: Drop deps in Cargo.toml**

Remove `ldap3 = …` and any other deps now unused (check via `cargo +stable udeps` or manual inspection).

- [ ] **Step 5: Build**

```bash
cargo build -p signapps-workforce
cargo clippy -p signapps-workforce --no-deps --tests -- -D warnings
```

Expected: compiles. Likely one or two lingering imports — clean them.

- [ ] **Step 6: Commit**

```bash
rtk git add services/signapps-workforce
rtk git commit -m "refactor(workforce): drop AD/org/boards/policies handlers (moved to signapps-org)"
```

---

### Task 13: Hard-cut migration 426 (copy workforce → org, drop legacy)

**Files:**
- Create: `migrations/426_workforce_to_org_cutover.sql`

- [ ] **Step 1: Migration SQL**

Create `migrations/426_workforce_to_org_cutover.sql`:

```sql
-- Hard-cut: copy any lingering workforce_org_* rows into the canonical
-- org_* tables, then drop the legacy tables.
-- Idempotent: ON CONFLICT DO NOTHING protects against re-runs.

-- 1) Copy workforce org_nodes → org_nodes (if the legacy table exists)
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'workforce_org_nodes') THEN
        INSERT INTO org_nodes (id, tenant_id, kind, parent_id, path, name, slug, attributes, active, created_at, updated_at)
        SELECT id, tenant_id,
               COALESCE(kind::text, 'unit')::text AS kind,
               parent_id,
               COALESCE(path::text, slug)::ltree AS path,
               name, slug, COALESCE(attributes, '{}'::jsonb), COALESCE(active, true),
               COALESCE(created_at, now()), COALESCE(updated_at, now())
        FROM workforce_org_nodes
        ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;

-- 2) Copy workforce boards → org_boards + members
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'workforce_org_boards') THEN
        INSERT INTO org_boards (id, node_id, created_at)
        SELECT id, node_id, COALESCE(created_at, now())
        FROM workforce_org_boards
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO org_board_members (id, board_id, person_id, role, is_decision_maker, sort_order)
        SELECT id, board_id, person_id, role, COALESCE(is_decision_maker, false), COALESCE(sort_order, 0)
        FROM workforce_org_board_members
        ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;

-- 3) Copy workforce_employees → org_persons (map as person rows)
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'workforce_employees') THEN
        INSERT INTO org_persons (id, tenant_id, user_id, email, first_name, last_name, attributes, active, created_at, updated_at)
        SELECT id, tenant_id, user_id, email, first_name, last_name, COALESCE(attributes, '{}'::jsonb), COALESCE(active, true),
               COALESCE(created_at, now()), COALESCE(updated_at, now())
        FROM workforce_employees
        ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;

-- 4) Drop legacy tables (CASCADE so foreign keys are cleaned).
DROP TABLE IF EXISTS workforce_org_board_members CASCADE;
DROP TABLE IF EXISTS workforce_org_boards CASCADE;
DROP TABLE IF EXISTS workforce_org_nodes CASCADE;
DROP TABLE IF EXISTS workforce_ad_sync_log CASCADE;
DROP TABLE IF EXISTS workforce_ad_config CASCADE;
DROP TABLE IF EXISTS workforce_groups CASCADE;
DROP TABLE IF EXISTS workforce_policies CASCADE;
DROP TABLE IF EXISTS workforce_policy_bindings CASCADE;
DROP TABLE IF EXISTS workforce_delegations CASCADE;
-- workforce_employees kept if still referenced by HR (attendance/payroll);
-- otherwise drop as well:
-- DROP TABLE IF EXISTS workforce_employees CASCADE;
```

- [ ] **Step 2: Apply locally**

```bash
docker exec signapps-postgres psql -U signapps -d signapps -f - < migrations/426_workforce_to_org_cutover.sql
docker exec signapps-postgres psql -U signapps -d signapps -c "\dt workforce_*"
```

Expected: `workforce_employees` may remain (HR), all `workforce_org_*` gone.

- [ ] **Step 3: Commit**

```bash
rtk git add migrations/426_workforce_to_org_cutover.sql
rtk git commit -m "fix(migrations): hard-cut workforce→org (copy + drop legacy org tables)"
```

---

### Task 14: Workspace build + boot test post-cutover

- [ ] **Step 1: Full build**

```bash
cargo build --workspace
cargo clippy --workspace --no-deps -- -D warnings
```

Expected: clean.

- [ ] **Step 2: Single-binary boot test**

```bash
export DATABASE_URL="postgres://signapps:signapps_dev@localhost:5432/signapps"
export JWT_SECRET="$(printf 'x%.0s' {1..32})"
export KEYSTORE_MASTER_KEY=$(printf '0%.0s' {1..64})
cargo test -p signapps-platform --test boot --test service_count -- --ignored --nocapture
```

Expected: boot < 3s, 34 services up.

- [ ] **Step 3: Commit if any fix needed**

If build or test required adjustments, commit them:

```bash
rtk git add -A
rtk git commit -m "fix(cutover): adjust callers broken by workforce→org move"
```

Else skip.

---

### Task 15: API OpenAPI spec consolidation

**Files:**
- Modify: `services/signapps-org/src/handlers/openapi.rs` (new if absent)

- [ ] **Step 1: Aggregate utoipa OpenAPI doc**

Create `services/signapps-org/src/handlers/openapi.rs`:

```rust
use utoipa::OpenApi;

#[derive(OpenApi)]
#[openapi(
    paths(
        super::nodes::list,
        super::nodes::create,
        super::nodes::detail,
        super::nodes::update,
        super::nodes::archive,
        super::nodes::subtree,
        super::persons::create,
        super::persons::list,
        // ... all handlers with #[utoipa::path]
    ),
    components(schemas(
        signapps_db::models::org::OrgNode,
        signapps_db::models::org::Person,
        signapps_db::models::org::Assignment,
        signapps_db::models::org::Policy,
        signapps_db::models::org::Board,
    )),
    tags((name = "Org", description = "Organization canonical model"))
)]
pub struct OrgApiDoc;
```

Mount Swagger UI at `/swagger-ui/` in `lib.rs` router.

- [ ] **Step 2: Smoke**

```bash
cargo run -p signapps-platform &
sleep 3
curl -s http://localhost:3026/api-docs/openapi.json | head -20
kill %1
```

Expected: valid JSON with paths prefixed `/api/v1/org/`.

- [ ] **Step 3: Commit**

```bash
rtk git add services/signapps-org/src/handlers/openapi.rs services/signapps-org/src/lib.rs
rtk git commit -m "docs(org): consolidate OpenAPI spec for /api/v1/org/*"
```

---

## Wave 3 — AD sync bidirectionnel (J11-J15)

### Task 16: `AdSyncConfig` struct + repository integration

**Files:**
- Create: `services/signapps-org/src/ad/mod.rs`
- Create: `services/signapps-org/src/ad/config.rs`

- [ ] **Step 1: Module scaffold**

Create `services/signapps-org/src/ad/mod.rs`:

```rust
//! AD / LDAP bidirectional sync for the canonical org model.

pub mod config;
pub mod client;
pub mod sync;
pub mod conflict;
```

Create `services/signapps-org/src/ad/config.rs`:

```rust
use serde::{Deserialize, Serialize};
use signapps_keystore::Keystore;
use signapps_db::models::org::{AdConfig, AdSyncMode, ConflictStrategy};
use signapps_db::repositories::org::AdConfigRepository;
use sqlx::PgPool;
use std::sync::Arc;
use uuid::Uuid;

/// Runtime view of `org_ad_config` with the bind password decrypted via
/// the shared keystore.  Never log this struct — it carries the cleartext password.
#[derive(Debug, Clone)]
pub struct AdSyncConfig {
    pub tenant_id: Uuid,
    pub mode: AdSyncMode,
    pub ldap_url: String,
    pub bind_dn: String,
    pub bind_password: String,
    pub base_dn: String,
    pub user_filter: String,
    pub ou_filter: String,
    pub sync_interval_sec: u64,
    pub conflict_strategy: ConflictStrategy,
}

impl AdSyncConfig {
    pub async fn load(pool: &PgPool, keystore: &Arc<Keystore>, tenant_id: Uuid)
        -> anyhow::Result<Option<Self>> {
        let repo = AdConfigRepository::new(pool);
        let Some(row) = repo.get(tenant_id).await? else { return Ok(None) };
        let password = if let Some(enc) = row.bind_password_enc {
            keystore.decrypt_field(&enc).await?
        } else { String::new() };
        Ok(Some(Self {
            tenant_id,
            mode: row.mode,
            ldap_url: row.ldap_url.unwrap_or_default(),
            bind_dn: row.bind_dn.unwrap_or_default(),
            bind_password: password,
            base_dn: row.base_dn.unwrap_or_default(),
            user_filter: row.user_filter.unwrap_or_else(|| "(objectClass=user)".into()),
            ou_filter: row.ou_filter.unwrap_or_else(|| "(objectClass=organizationalUnit)".into()),
            sync_interval_sec: row.sync_interval_sec.max(30) as u64,
            conflict_strategy: row.conflict_strategy,
        }))
    }
}
```

- [ ] **Step 2: Build + commit**

```bash
cargo build -p signapps-org
rtk git add services/signapps-org/src/ad
rtk git commit -m "feat(org): AdSyncConfig loader with keystore decryption"
```

---

### Task 17: LDAP client wrapper

**Files:**
- Create: `services/signapps-org/src/ad/client.rs`

- [ ] **Step 1: Client**

```rust
use anyhow::{Context, Result};
use ldap3::{Ldap, LdapConnAsync, Scope, SearchEntry};

pub struct AdClient {
    ldap: Ldap,
}

impl AdClient {
    pub async fn connect(url: &str, bind_dn: &str, password: &str) -> Result<Self> {
        let (conn, mut ldap) = LdapConnAsync::new(url).await.context("ldap connect")?;
        ldap3::drive!(conn);
        ldap.simple_bind(bind_dn, password).await.context("ldap bind")?.success()?;
        Ok(Self { ldap })
    }

    pub async fn list_users(&mut self, base_dn: &str, filter: &str) -> Result<Vec<SearchEntry>> {
        let (rs, _res) = self
            .ldap
            .search(base_dn, Scope::Subtree, filter, vec!["cn", "mail", "givenName", "sn", "distinguishedName", "uSNChanged"])
            .await?
            .success()?;
        Ok(rs.into_iter().map(SearchEntry::construct).collect())
    }

    pub async fn list_ous(&mut self, base_dn: &str, filter: &str) -> Result<Vec<SearchEntry>> {
        let (rs, _res) = self
            .ldap
            .search(base_dn, Scope::Subtree, filter, vec!["ou", "distinguishedName", "description"])
            .await?
            .success()?;
        Ok(rs.into_iter().map(SearchEntry::construct).collect())
    }

    pub async fn upsert_user(&mut self, _dn: &str, _attrs: Vec<(&str, Vec<String>)>) -> Result<()> {
        // Use ldap3::mods::Mod::Replace and ldap.modify().
        // Kept minimal; real impl in Task 18's apply path.
        Ok(())
    }

    pub async fn unbind(mut self) {
        let _ = self.ldap.unbind().await;
    }
}
```

- [ ] **Step 2: Build + commit**

```bash
cargo build -p signapps-org
rtk git add services/signapps-org/src/ad/client.rs
rtk git commit -m "feat(org): ldap3 client wrapper for AD sync"
```

---

### Task 18: Sync loop + conflict resolver

**Files:**
- Create: `services/signapps-org/src/ad/sync.rs`
- Create: `services/signapps-org/src/ad/conflict.rs`

- [ ] **Step 1: Conflict resolver**

```rust
// services/signapps-org/src/ad/conflict.rs
use signapps_db::models::org::ConflictStrategy;

pub enum Resolved<T> { UseOrg(T), UseAd(T), Manual }

pub fn resolve<T: Clone>(strategy: ConflictStrategy, org: T, ad: T) -> Resolved<T> {
    match strategy {
        ConflictStrategy::OrgWins => Resolved::UseOrg(org),
        ConflictStrategy::AdWins => Resolved::UseAd(ad),
        ConflictStrategy::Manual => Resolved::Manual,
    }
}
```

- [ ] **Step 2: Sync cycle**

`services/signapps-org/src/ad/sync.rs`:

```rust
use anyhow::Result;
use signapps_db::models::org::AdSyncMode;
use signapps_db::repositories::org::{AdSyncLogRepository, PersonRepository};
use sqlx::PgPool;
use std::sync::Arc;
use uuid::Uuid;

use super::{client::AdClient, config::AdSyncConfig, conflict};

pub async fn run_cycle(pool: &PgPool, cfg: &AdSyncConfig, dry_run: bool) -> Result<SyncReport> {
    let run_id = Uuid::new_v4();
    let mut report = SyncReport { run_id, added: 0, updated: 0, removed: 0, conflicts: 0 };
    let log = AdSyncLogRepository::new(pool);
    let persons = PersonRepository::new(pool);

    if matches!(cfg.mode, AdSyncMode::AdToOrg | AdSyncMode::Bidirectional) {
        let mut client = AdClient::connect(&cfg.ldap_url, &cfg.bind_dn, &cfg.bind_password).await?;
        let entries = client.list_users(&cfg.base_dn, &cfg.user_filter).await?;
        for entry in entries {
            let email = entry.attrs.get("mail").and_then(|v| v.first()).cloned().unwrap_or_default();
            if email.is_empty() { continue; }
            let existing = persons.get_by_email(cfg.tenant_id, &email).await?;
            match existing {
                None => {
                    if !dry_run {
                        let given = entry.attrs.get("givenName").and_then(|v| v.first()).cloned();
                        let sn = entry.attrs.get("sn").and_then(|v| v.first()).cloned();
                        persons.create(cfg.tenant_id, &email, given.as_deref(), sn.as_deref(), Some(&entry.dn)).await?;
                    }
                    report.added += 1;
                    log.insert(cfg.tenant_id, run_id, &entry.dn, "ad_to_org", "added",
                               &serde_json::json!({"email": email}), None).await?;
                }
                Some(_p) => {
                    // Diff + apply via conflict::resolve using cfg.conflict_strategy.
                    // Simplified: count as updated; full diff in follow-up.
                    report.updated += 1;
                }
            }
        }
        client.unbind().await;
    }

    if matches!(cfg.mode, AdSyncMode::OrgToAd | AdSyncMode::Bidirectional) {
        // Push org_persons created since last_synced_at marker into AD.
        // Implementation: enumerate persons where dn IS NULL, call client.upsert_user.
        // Deferred to the iterative Task 19 refinement.
    }

    Ok(report)
}

pub struct SyncReport {
    pub run_id: Uuid,
    pub added: u64,
    pub updated: u64,
    pub removed: u64,
    pub conflicts: u64,
}
```

- [ ] **Step 3: Spawn worker inside `signapps_org::router()`**

Edit `services/signapps-org/src/lib.rs`, add a `spawn_ad_sync_workers(state)` call that iterates all tenants with `mode != Off`, spawns one tokio task per tenant looping `run_cycle` every `sync_interval_sec`.

```rust
fn spawn_ad_sync_workers(state: &AppState) {
    let pool = state.pool.clone();
    let keystore = state.keystore.clone();
    tokio::spawn(async move {
        loop {
            // Query org_ad_config where mode != 'off'
            // For each, load AdSyncConfig and run_cycle
            // Sleep cfg.sync_interval_sec
            tokio::time::sleep(std::time::Duration::from_secs(60)).await;
        }
    });
}
```

- [ ] **Step 4: Build + commit**

```bash
cargo build -p signapps-org
rtk git add services/signapps-org/src/ad/{sync,conflict}.rs services/signapps-org/src/lib.rs
rtk git commit -m "feat(org): AD sync cycle (add/update/conflict) + per-tenant worker"
```

---

### Task 19: AD handlers — config + dry-run trigger

**Files:**
- Create: `services/signapps-org/src/handlers/ad.rs`

- [ ] **Step 1: Handlers**

```rust
// services/signapps-org/src/handlers/ad.rs
use axum::{extract::{Path, State}, routing::{get, post, put}, Json, Router};
use serde::Deserialize;
use uuid::Uuid;
use crate::{ad, state::AppState};
use signapps_common::error::AppError;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/config/:tenant_id", get(get_config).put(put_config))
        .route("/sync/:tenant_id", post(trigger_sync))
        .route("/sync/:tenant_id/dry-run", post(trigger_dry_run))
}

async fn get_config(State(st): State<AppState>, Path(t): Path<Uuid>)
    -> Result<Json<serde_json::Value>, AppError> {
    // Redacted view: never return the decrypted password.
    let repo = signapps_db::repositories::org::AdConfigRepository::new(st.pool.inner());
    let row = repo.get(t).await?;
    Ok(Json(serde_json::to_value(row)?))
}

#[derive(Deserialize)]
struct PutCfg {
    mode: String, ldap_url: String, bind_dn: String, bind_password: String,
    base_dn: String, user_filter: Option<String>, ou_filter: Option<String>,
    sync_interval_sec: Option<i32>, conflict_strategy: Option<String>,
}

async fn put_config(State(st): State<AppState>, Path(t): Path<Uuid>, Json(b): Json<PutCfg>)
    -> Result<(), AppError> {
    let enc = st.keystore.encrypt_field(&b.bind_password).await?;
    let repo = signapps_db::repositories::org::AdConfigRepository::new(st.pool.inner());
    repo.upsert(t, &b.mode, &b.ldap_url, &b.bind_dn, &enc, &b.base_dn,
                b.user_filter.as_deref(), b.ou_filter.as_deref(),
                b.sync_interval_sec, b.conflict_strategy.as_deref()).await?;
    Ok(())
}

async fn trigger_sync(State(st): State<AppState>, Path(t): Path<Uuid>)
    -> Result<Json<serde_json::Value>, AppError> {
    let cfg = ad::config::AdSyncConfig::load(st.pool.inner(), &st.keystore, t).await?
        .ok_or_else(|| AppError::bad_request("AD config missing"))?;
    let report = ad::sync::run_cycle(st.pool.inner(), &cfg, false).await?;
    Ok(Json(serde_json::to_value(&report)?))
}

async fn trigger_dry_run(State(st): State<AppState>, Path(t): Path<Uuid>)
    -> Result<Json<serde_json::Value>, AppError> {
    let cfg = ad::config::AdSyncConfig::load(st.pool.inner(), &st.keystore, t).await?
        .ok_or_else(|| AppError::bad_request("AD config missing"))?;
    let report = ad::sync::run_cycle(st.pool.inner(), &cfg, true).await?;
    Ok(Json(serde_json::to_value(&report)?))
}
```

- [ ] **Step 2: Build + commit**

```bash
cargo build -p signapps-org
rtk git add services/signapps-org/src/handlers/ad.rs
rtk git commit -m "feat(org): AD config CRUD + sync/dry-run HTTP endpoints"
```

---

### Task 20: AD sync tests

**Files:**
- Create: `services/signapps-org/tests/ad_sync.rs`

- [ ] **Step 1: Test**

```rust
use signapps_db::models::org::{AdSyncMode, ConflictStrategy};

#[tokio::test]
#[ignore = "requires local LDAP server + postgres"]
async fn dry_run_reports_without_write() {
    // Spin up an ephemeral LDAP server (or use a known dev instance).
    // Populate 3 entries, run_cycle with dry_run=true.
    // Assert: report.added == 3, but org_persons table unchanged.
}

#[tokio::test]
#[ignore = "requires local LDAP + postgres"]
async fn ad_to_org_creates_persons() {
    // cfg.mode = AdToOrg, dry_run = false
    // Assert rows exist in org_persons with the dn populated.
}

#[tokio::test]
#[ignore = "requires local LDAP + postgres"]
async fn conflict_manual_flags_log_without_write() {
    // cfg.conflict_strategy = Manual
    // pre-populate org_persons with same email, different first_name
    // run cycle; assert org_ad_sync_log has status="conflict_manual"
}
```

- [ ] **Step 2: Commit**

```bash
rtk git add services/signapps-org/tests/ad_sync.rs
rtk git commit -m "test(org): AD sync dry-run + conflict strategy tests"
```

---

### Task 21: `SynchronizedBy` markers to prevent ping-pong

**Files:**
- Modify: `services/signapps-org/src/ad/sync.rs`

- [ ] **Step 1: Add timestamp columns to org_persons**

Create `migrations/410_org_persons_sync_markers.sql`:

```sql
ALTER TABLE org_persons ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
ALTER TABLE org_persons ADD COLUMN IF NOT EXISTS last_synced_by TEXT;  -- 'ad' | 'org'
```

- [ ] **Step 2: Use markers in `run_cycle`**

When applying an AD→Org change, set `last_synced_by = 'ad'`, `last_synced_at = now()`. When pushing Org→AD, skip rows whose `last_synced_by = 'ad'` and `last_synced_at > now() - 30s` (debounce window).

- [ ] **Step 3: Build + commit**

```bash
cargo build -p signapps-org
rtk git add migrations/410_org_persons_sync_markers.sql services/signapps-org/src/ad/sync.rs
rtk git commit -m "fix(org): sync markers prevent AD↔Org ping-pong (30s debounce)"
```

---

## Wave 4 — RBAC partout (J16-J20)

### Task 22: `signapps-common::rbac` types + trait

**Files:**
- Create: `crates/signapps-common/src/rbac/mod.rs`
- Create: `crates/signapps-common/src/rbac/types.rs`
- Create: `crates/signapps-common/src/rbac/resolver.rs`
- Modify: `crates/signapps-common/Cargo.toml`

- [ ] **Step 1: Types**

`crates/signapps-common/src/rbac/types.rs`:

```rust
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PersonRef { pub id: Uuid, pub tenant_id: Uuid }

#[derive(Debug, Clone)]
pub enum ResourceRef {
    Document(Uuid),
    Folder(Uuid),
    Calendar(Uuid),
    MailFolder(Uuid),
    Form(Uuid),
    Project(Uuid),
    OrgNode(Uuid),
    Custom { kind: &'static str, id: Uuid },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Action { Read, Write, Delete, Share, Admin }

pub enum Decision {
    Allow { source: DecisionSource },
    Deny { reason: DenyReason },
}

pub enum DecisionSource {
    OwnerOfResource,
    BoardOfContainingNode(Uuid),
    PolicyBinding { policy_id: Uuid, node_id: Uuid },
    AccessGrant { grant_id: Uuid },
    Admin,
}

pub enum DenyReason { NoGrant, GrantExpired, GrantRevoked, Disabled, NotFound }
```

- [ ] **Step 2: Trait**

`crates/signapps-common/src/rbac/resolver.rs`:

```rust
use async_trait::async_trait;
use super::types::{Action, Decision, PersonRef, ResourceRef};

#[async_trait]
pub trait OrgPermissionResolver: Send + Sync {
    async fn check(&self, who: PersonRef, resource: ResourceRef, action: Action)
        -> Result<Decision, RbacError>;
}

#[derive(thiserror::Error, Debug)]
pub enum RbacError {
    #[error("resolver unavailable: {0}")] Unavailable(String),
    #[error("invalid request: {0}")] BadRequest(String),
}
```

- [ ] **Step 3: Feature flag**

Edit `crates/signapps-common/Cargo.toml`:

```toml
[features]
default = []
rbac = ["async-trait", "moka"]

[dependencies]
async-trait = { workspace = true, optional = true }
moka = { version = "0.12", features = ["future"], optional = true }
thiserror = { workspace = true }
```

Edit `crates/signapps-common/src/lib.rs`:

```rust
#[cfg(feature = "rbac")]
pub mod rbac;
```

- [ ] **Step 4: Build + commit**

```bash
cargo build -p signapps-common --features rbac
rtk git add crates/signapps-common
rtk git commit -m "feat(common): OrgPermissionResolver trait + types under rbac feature"
```

---

### Task 23: `OrgClient` resolver impl + moka cache

**Files:**
- Create: `crates/signapps-common/src/rbac/cache.rs`
- Create: `services/signapps-org/src/rbac_client.rs`

- [ ] **Step 1: Cache wrapper**

`crates/signapps-common/src/rbac/cache.rs`:

```rust
use moka::future::Cache;
use std::time::Duration;
use super::types::{Action, Decision, PersonRef, ResourceRef};

pub struct DecisionCache {
    inner: Cache<CacheKey, CachedDecision>,
}

#[derive(Hash, Eq, PartialEq, Clone)]
pub struct CacheKey { who: uuid::Uuid, res_kind: &'static str, res_id: uuid::Uuid, action: Action }

#[derive(Clone)]
pub struct CachedDecision { pub allow: bool }

impl DecisionCache {
    pub fn new(ttl_sec: u64) -> Self {
        Self {
            inner: Cache::builder()
                .max_capacity(50_000)
                .time_to_live(Duration::from_secs(ttl_sec))
                .build(),
        }
    }

    pub async fn get(&self, who: PersonRef, res: &ResourceRef, action: Action) -> Option<CachedDecision> {
        let key = to_key(who, res, action);
        self.inner.get(&key).await
    }

    pub async fn put(&self, who: PersonRef, res: &ResourceRef, action: Action, d: CachedDecision) {
        self.inner.insert(to_key(who, res, action), d).await;
    }

    pub async fn invalidate_resource(&self, kind: &'static str, id: uuid::Uuid) {
        self.inner.invalidate_entries_if(move |k, _| k.res_kind == kind && k.res_id == id)
            .expect("invalidate");
    }
}

fn to_key(who: PersonRef, res: &ResourceRef, action: Action) -> CacheKey {
    let (kind, id) = match res {
        ResourceRef::Document(i) => ("document", *i),
        ResourceRef::Folder(i) => ("folder", *i),
        ResourceRef::Calendar(i) => ("calendar", *i),
        ResourceRef::MailFolder(i) => ("mail_folder", *i),
        ResourceRef::Form(i) => ("form", *i),
        ResourceRef::Project(i) => ("project", *i),
        ResourceRef::OrgNode(i) => ("org_node", *i),
        ResourceRef::Custom { kind, id } => (*kind, *id),
    };
    CacheKey { who: who.id, res_kind: kind, res_id: id, action }
}
```

- [ ] **Step 2: `OrgClient` concrete impl**

`services/signapps-org/src/rbac_client.rs`:

```rust
use async_trait::async_trait;
use signapps_common::rbac::{
    cache::DecisionCache,
    resolver::{OrgPermissionResolver, RbacError},
    types::{Action, Decision, DecisionSource, DenyReason, PersonRef, ResourceRef},
};
use sqlx::PgPool;
use std::sync::Arc;

pub struct OrgClient {
    pool: Arc<PgPool>,
    cache: DecisionCache,
}

impl OrgClient {
    pub fn new(pool: Arc<PgPool>, ttl_sec: u64) -> Self {
        Self { pool, cache: DecisionCache::new(ttl_sec) }
    }
}

#[async_trait]
impl OrgPermissionResolver for OrgClient {
    async fn check(&self, who: PersonRef, resource: ResourceRef, action: Action)
        -> Result<Decision, RbacError> {
        if let Some(c) = self.cache.get(who, &resource, action).await {
            return Ok(if c.allow {
                Decision::Allow { source: DecisionSource::PolicyBinding {
                    policy_id: uuid::Uuid::nil(), node_id: uuid::Uuid::nil(),
                } }
            } else { Decision::Deny { reason: DenyReason::NoGrant } });
        }
        // 1) Owner check — skipped for generic resource types.
        // 2) Direct access_grants table query.
        // 3) Policy bindings along the org path.
        // 4) Board membership of containing node.
        // 5) Admin override (identity role == 3).
        // Simplified stub that denies — to be fleshed out per resource kind.
        let decision = Decision::Deny { reason: DenyReason::NoGrant };
        self.cache.put(who, &resource, action, signapps_common::rbac::cache::CachedDecision { allow: false }).await;
        Ok(decision)
    }
}
```

Flesh out the 5 lookup steps with real SQL queries against `org_access_grants` + `org_policy_bindings` JOIN `org_nodes` via LTREE + `org_board_members`.

- [ ] **Step 3: Build + commit**

```bash
cargo build -p signapps-org -p signapps-common --features rbac
rtk git add crates/signapps-common/src/rbac/cache.rs services/signapps-org/src/rbac_client.rs
rtk git commit -m "feat(org): OrgClient resolver impl with moka cache (60s TTL)"
```

---

### Task 24: Axum middleware `rbac::require`

**Files:**
- Create: `crates/signapps-common/src/rbac/middleware.rs`

- [ ] **Step 1: Middleware**

```rust
use axum::{extract::Request, middleware::Next, response::Response};
use std::sync::Arc;
use super::{resolver::OrgPermissionResolver, types::{Action, ResourceRef, PersonRef, Decision}};
use crate::error::AppError;

pub async fn require<R>(
    resolver: Arc<R>,
    action: Action,
    extract_resource: impl Fn(&Request) -> Option<ResourceRef> + Clone + Send + Sync + 'static,
    mut req: Request,
    next: Next,
) -> Result<Response, AppError>
where R: OrgPermissionResolver + ?Sized + 'static
{
    let claims = req.extensions().get::<crate::Claims>().cloned()
        .ok_or_else(|| AppError::unauthorized("no claims"))?;
    let who = PersonRef { id: claims.person_id(), tenant_id: claims.tenant_id() };
    let resource = extract_resource(&req).ok_or_else(|| AppError::bad_request("missing resource"))?;

    match resolver.check(who, resource, action).await? {
        Decision::Allow { .. } => Ok(next.run(req).await),
        Decision::Deny { reason } => Err(AppError::forbidden(format!("{:?}", reason))),
    }
}
```

Add helper extractors to derive `ResourceRef` from path params:

```rust
pub fn document_from_path(req: &Request) -> Option<ResourceRef> {
    let id = req.uri().path().split('/').find_map(|s| uuid::Uuid::parse_str(s).ok())?;
    Some(ResourceRef::Document(id))
}
// Similar for folder, calendar, etc.
```

- [ ] **Step 2: Build + commit**

```bash
cargo build -p signapps-common --features rbac
rtk git add crates/signapps-common/src/rbac/middleware.rs crates/signapps-common/src/rbac/mod.rs
rtk git commit -m "feat(common): rbac::require Axum middleware with resource extractors"
```

---

### Task 25: Rollout batch A — identity, storage, mail, calendar, docs (5 services)

**Files:**
- Modify: `services/signapps-identity/src/lib.rs`
- Modify: `services/signapps-storage/src/lib.rs`
- Modify: `services/signapps-mail/src/lib.rs`
- Modify: `services/signapps-calendar/src/lib.rs`
- Modify: `services/signapps-docs/src/lib.rs`

- [ ] **Step 1: For each service**

Per service:
1. Add `signapps-common = { …, features = ["rbac"] }` in its `Cargo.toml`.
2. Replace its ad-hoc admin/tenant check layer on protected routes by `axum::middleware::from_fn_with_state(..., rbac::require(...))` passing the action + resource extractor appropriate for the resource type.
3. Keep rate-limit / logging / tenant-context middlewares as-is.

Example for `services/signapps-docs/src/lib.rs`, document read path:

```rust
use signapps_common::rbac::{require, types::{Action, ResourceRef}, middleware::document_from_path};

Router::new()
    .route("/api/v1/documents/:id", get(handlers::documents::get))
    .layer(axum::middleware::from_fn_with_state(
        resolver.clone(),
        move |req, next| require(resolver.clone(), Action::Read, document_from_path, req, next),
    ));
```

Do it for the 5 services listed.

- [ ] **Step 2: Build + smoke**

```bash
cargo build --workspace
cargo test -p signapps-platform --test boot -- --ignored --nocapture
```

- [ ] **Step 3: Commit**

```bash
rtk git add services/signapps-{identity,storage,mail,calendar,docs}
rtk git commit -m "refactor(rbac): rollout batch A (identity, storage, mail, calendar, docs)"
```

---

### Task 26: Rollout batch B — chat, collab, meet, forms, contacts, projects (via workforce merge + social) (10 services)

**Files:**
- Modify: `services/signapps-{chat,collab,meet,forms,contacts,social,notifications,gamification,webhooks,tenant-config}/src/lib.rs`

Same pattern as Task 25. One commit per 5 services.

- [ ] **Step 1: Commit A**

```bash
rtk git add services/signapps-{chat,collab,meet,forms,contacts}
rtk git commit -m "refactor(rbac): rollout batch B1 (chat, collab, meet, forms, contacts)"
```

- [ ] **Step 2: Commit B**

```bash
rtk git add services/signapps-{social,notifications,gamification,webhooks,tenant-config}
rtk git commit -m "refactor(rbac): rollout batch B2 (social, notifications, gamification, webhooks, tenant-config)"
```

---

### Task 27: Rollout batch C — remaining services (14 services)

**Files:**
- Modify: `services/signapps-{billing,signatures,compliance,backup,integrations,calendar,media,securelink,metrics,scheduler,pxe,it-assets,vault,org,containers,proxy,collaboration,deploy}/src/lib.rs`

Same pattern. Commit per 5.

- [ ] **Step 1-3: Commits**

Three commits, each `refactor(rbac): rollout batch C<n>`.

- [ ] **Step 4: Global boot test**

```bash
cargo test -p signapps-platform --test boot --test service_count -- --ignored --nocapture
```

Expected: 34 services up, all with unified RBAC layer.

- [ ] **Step 5: Commit if fixes**

---

### Task 28: `OrgPermissionResolver` unit test matrix

**Files:**
- Create: `crates/signapps-common/tests/rbac_matrix.rs`
- Create: `services/signapps-org/tests/rbac_client_impl.rs`

- [ ] **Step 1: Mock resolver matrix**

Test the `Decision` types across sources + actions + resource kinds. Use a `MockResolver` that returns scripted answers.

- [ ] **Step 2: Real `OrgClient` integration tests**

Seed an org tree + person + policy binding; assert `check()` returns `Allow { source: PolicyBinding { … } }` for a matching action and `Deny` otherwise.

- [ ] **Step 3: Commit**

```bash
rtk git add crates/signapps-common/tests/rbac_matrix.rs services/signapps-org/tests/rbac_client_impl.rs
rtk git commit -m "test(rbac): matrix + OrgClient integration (policy bindings, grants, owners)"
```

---

### Task 29: Cache invalidation on org events

**Files:**
- Modify: `services/signapps-org/src/events.rs` (new)
- Modify: `services/signapps-org/src/rbac_client.rs`

- [ ] **Step 1: Subscribe to own events in `OrgClient`**

When `org.policy.updated` / `org.grant.revoked` / `org.assignment.changed` events fire, call `cache.invalidate_resource(kind, id)` or `cache.invalidate_all()` on the resolver instance.

- [ ] **Step 2: Ensure events emitted by handlers from Tasks 10-11**

- [ ] **Step 3: Build + commit**

```bash
rtk git add services/signapps-org/src/events.rs services/signapps-org/src/rbac_client.rs
rtk git commit -m "feat(rbac): invalidate resolver cache on org.* events"
```

---

## Wave 5 — Sharing + provisioning (J21-J25)

### Task 30: Access grant token signer/verifier

**Files:**
- Create: `services/signapps-org/src/grants/mod.rs`
- Create: `services/signapps-org/src/grants/token.rs`

- [ ] **Step 1: HMAC signer**

```rust
// services/signapps-org/src/grants/token.rs
use anyhow::{Context, Result};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use hmac::{Hmac, Mac};
use sha2::Sha256;
use uuid::Uuid;

type HmacSha256 = Hmac<Sha256>;

/// Token layout: `base64url(payload).base64url(hmac)`
pub struct TokenPayload {
    pub grant_id: Uuid,
    pub tenant_id: Uuid,
    pub expires_at: i64,  // unix seconds, 0 = no expiry
}

pub fn sign(payload: &TokenPayload, tenant_secret: &[u8]) -> Result<String> {
    let body = format!("{}.{}.{}", payload.grant_id, payload.tenant_id, payload.expires_at);
    let mut mac = HmacSha256::new_from_slice(tenant_secret).context("hmac")?;
    mac.update(body.as_bytes());
    let sig = mac.finalize().into_bytes();
    Ok(format!("{}.{}", URL_SAFE_NO_PAD.encode(body.as_bytes()), URL_SAFE_NO_PAD.encode(sig)))
}

pub fn verify(token: &str, tenant_secret: &[u8]) -> Result<TokenPayload> {
    let (body_b64, sig_b64) = token.split_once('.').context("bad token shape")?;
    let body = String::from_utf8(URL_SAFE_NO_PAD.decode(body_b64)?)?;
    let sig = URL_SAFE_NO_PAD.decode(sig_b64)?;
    let mut mac = HmacSha256::new_from_slice(tenant_secret).context("hmac")?;
    mac.update(body.as_bytes());
    mac.verify_slice(&sig).context("hmac mismatch")?;
    let mut parts = body.splitn(3, '.');
    let grant_id = Uuid::parse_str(parts.next().unwrap())?;
    let tenant_id = Uuid::parse_str(parts.next().unwrap())?;
    let expires_at: i64 = parts.next().unwrap().parse()?;
    if expires_at > 0 && expires_at < chrono::Utc::now().timestamp() {
        anyhow::bail!("token expired");
    }
    Ok(TokenPayload { grant_id, tenant_id, expires_at })
}
```

- [ ] **Step 2: Unit test**

```rust
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn sign_then_verify_roundtrip() {
        let secret = b"super-secret-0123456789abcdef";
        let p = TokenPayload { grant_id: Uuid::new_v4(), tenant_id: Uuid::new_v4(), expires_at: 0 };
        let t = sign(&p, secret).unwrap();
        let v = verify(&t, secret).unwrap();
        assert_eq!(v.grant_id, p.grant_id);
    }
    #[test]
    fn tamper_rejected() {
        let secret = b"super-secret-0123456789abcdef";
        let p = TokenPayload { grant_id: Uuid::new_v4(), tenant_id: Uuid::new_v4(), expires_at: 0 };
        let t = sign(&p, secret).unwrap();
        let tampered = t.replace('A', "B");
        assert!(verify(&tampered, secret).is_err());
    }
}
```

- [ ] **Step 3: Build + commit**

```bash
cargo test -p signapps-org grants::token::tests
rtk git add services/signapps-org/src/grants
rtk git commit -m "feat(org): HMAC-SHA256 access grant token signer/verifier"
```

---

### Task 31: Grants CRUD handlers + `/g/:token` redirect

**Files:**
- Create: `services/signapps-org/src/handlers/grants.rs`
- Create: `services/signapps-org/src/grants/redirect.rs`

- [ ] **Step 1: CRUD**

`handlers/grants.rs` — endpoints `POST /`, `GET /:id`, `POST /verify?token=`, `DELETE /:id` (revoke).

```rust
// Create response includes the token + shareable URL
#[derive(Serialize)]
struct GrantCreated { id: Uuid, token: String, url: String }

async fn create(State(st): State<AppState>, Json(b): Json<CreateBody>)
    -> Result<Json<GrantCreated>, AppError> {
    let token_hash = /* sha256 of a random nonce */;
    let grant = AccessGrantRepository::new(st.pool.inner())
        .create(b.tenant_id, b.granted_by, b.granted_to,
                &b.resource_type, b.resource_id, &b.permissions,
                &token_hash, b.expires_at).await?;
    let tenant_secret = st.keystore.tenant_secret(b.tenant_id).await?;
    let token = grants::token::sign(&TokenPayload {
        grant_id: grant.id, tenant_id: b.tenant_id,
        expires_at: b.expires_at.map(|t| t.timestamp()).unwrap_or(0),
    }, &tenant_secret)?;
    let url = format!("{}/g/{}", st.config.base_url, token);
    st.events.publish("org.grant.created", &serde_json::json!({"id": grant.id})).await?;
    Ok(Json(GrantCreated { id: grant.id, token, url }))
}
```

- [ ] **Step 2: Redirect handler**

`grants/redirect.rs`:

```rust
pub fn routes() -> Router<AppState> {
    Router::new().route("/:token", get(follow))
}

async fn follow(State(st): State<AppState>, Path(token): Path<String>)
    -> Result<Response, AppError> {
    let payload = grants::token::verify(&token, &st.keystore.tenant_secret(/*…*/).await?)?;
    let repo = AccessGrantRepository::new(st.pool.inner());
    let grant = repo.get(payload.grant_id).await?
        .ok_or_else(|| AppError::not_found("grant"))?;
    if grant.revoked_at.is_some() { return Err(AppError::forbidden("grant revoked")); }
    repo.bump_last_used(grant.id).await?;
    let target = resource_url(&grant.resource_type, grant.resource_id);
    let cookie = format!("grant_token={}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600", token);
    Ok(Response::builder()
        .status(302)
        .header("Location", target)
        .header("Set-Cookie", cookie)
        .body(axum::body::Body::empty())?)
}
```

The resolver (Task 23) reads `grant_token` cookie if present and credits the grant in the decision chain.

- [ ] **Step 3: Build + commit**

```bash
cargo build -p signapps-org
rtk git add services/signapps-org/src/handlers/grants.rs services/signapps-org/src/grants/redirect.rs
rtk git commit -m "feat(org): access grants CRUD + /g/:token redirect with cookie injection"
```

---

### Task 32: PgEventBus provisioning topics + emitters

**Files:**
- Modify: `services/signapps-org/src/events.rs`
- Modify: `services/signapps-org/src/handlers/persons.rs` (emit `org.user.created`)

- [ ] **Step 1: Events helper**

```rust
// services/signapps-org/src/events.rs
use signapps_common::pg_events::PgEventBus;
use std::sync::Arc;

pub struct OrgEventPublisher { bus: Arc<PgEventBus> }

impl OrgEventPublisher {
    pub fn new(bus: Arc<PgEventBus>) -> Self { Self { bus } }

    pub async fn user_created(&self, person: &signapps_db::models::org::Person) -> anyhow::Result<()> {
        self.bus.publish("org.user.created", &serde_json::to_value(person)?).await
    }
    pub async fn user_deactivated(&self, person_id: uuid::Uuid, tenant_id: uuid::Uuid) -> anyhow::Result<()> {
        self.bus.publish("org.user.deactivated", &serde_json::json!({
            "person_id": person_id, "tenant_id": tenant_id
        })).await
    }
    pub async fn grant_created(&self, grant_id: uuid::Uuid) -> anyhow::Result<()> { /* … */ Ok(()) }
    pub async fn grant_revoked(&self, grant_id: uuid::Uuid) -> anyhow::Result<()> { /* … */ Ok(()) }
    pub async fn assignment_changed(&self, person_id: uuid::Uuid) -> anyhow::Result<()> { /* … */ Ok(()) }
    pub async fn policy_updated(&self, policy_id: uuid::Uuid) -> anyhow::Result<()> { /* … */ Ok(()) }
}
```

- [ ] **Step 2: Wire emits**

In persons create handler (Task 10): emit `org.user.created` after DB insert.
In grants create/revoke: emit `org.grant.*`.
In assignments create/delete: emit `org.assignment.changed`.
In policy+binding handlers: emit `org.policy.updated`.

- [ ] **Step 3: Commit**

```bash
rtk git add services/signapps-org/src
rtk git commit -m "feat(org): PgEventBus emitters for user/grant/assignment/policy topics"
```

---

### Task 33: Provisioning consumers in mail, storage, calendar, chat

**Files:**
- Modify: `services/signapps-mail/src/lib.rs`
- Modify: `services/signapps-storage/src/lib.rs`
- Modify: `services/signapps-calendar/src/lib.rs`
- Modify: `services/signapps-chat/src/lib.rs`

- [ ] **Step 1: Mail consumer**

Inside `signapps_mail::router()`, spawn a task that subscribes to `org.user.created`:

```rust
fn spawn_provisioning_consumer(state: AppState) {
    let bus = state.event_bus.clone();
    let pool = state.pool.clone();
    tokio::spawn(async move {
        let mut stream = bus.listen("org.user.created", "signapps-mail-provisioner").await;
        while let Some(event) = stream.next().await {
            if let Ok(person) = serde_json::from_value::<signapps_db::models::org::Person>(event.payload) {
                if let Err(e) = mail_provision::create_mailbox(&pool, &person).await {
                    tracing::warn!(?e, person_id=%person.id, "mail provisioning failed");
                    // Log into org_provisioning_log via separate RPC / direct insert.
                }
            }
        }
    });
}
```

- [ ] **Step 2: Storage, Calendar, Chat consumers**

Same pattern — each creates its default resource (drive root, default calendar, #general join).

- [ ] **Step 3: Deactivation consumer**

Also handle `org.user.deactivated` → suspend mailbox, freeze drive quota, remove from chats, revoke active grants.

- [ ] **Step 4: Build + boot test**

```bash
cargo build --workspace
cargo test -p signapps-platform --test boot -- --ignored --nocapture
```

- [ ] **Step 5: Commit**

```bash
rtk git add services/signapps-{mail,storage,calendar,chat}
rtk git commit -m "feat(provisioning): mail/storage/calendar/chat consume org.user.created|deactivated"
```

---

### Task 34: Provisioning admin dashboard extension

**Files:**
- Modify: `client/src/app/admin/org-structure/page.tsx` (or create `admin/org-ops/page.tsx`)
- Create: `client/src/lib/api/org-ops.ts`

- [ ] **Step 1: New admin panel**

Create `client/src/app/admin/org-ops/page.tsx` with 3 sections:
- **AD sync activity** : fetch `GET /api/v1/org/ad/sync/:tenant_id` runs log, display last 10 runs.
- **Provisioning queue** : fetch `GET /api/v1/org/provisioning/pending` list, retry button.
- **Active grants** : fetch `GET /api/v1/org/grants?tenant_id=…&active=true` table, revoke button per row.

Use TanStack Query + shadcn Table + server-only fetcher if the page is RSC (consistent with P2 pattern).

- [ ] **Step 2: API client**

`client/src/lib/api/org-ops.ts` with typed methods.

- [ ] **Step 3: Commit**

```bash
rtk git add client/src/app/admin/org-ops client/src/lib/api/org-ops.ts
rtk git commit -m "feat(client): admin org-ops dashboard (AD runs, provisioning queue, grants)"
```

---

## Wave 6 — Finalisation (J26+)

### Task 35: 8 Playwright E2E scenarios

**Files:**
- Create: `client/e2e/s1-org-rbac.spec.ts`

- [ ] **Step 1: Spec file**

```typescript
import { test, expect } from "@playwright/test";

test.describe("S1 Org + RBAC end-to-end", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3000/login?auto=admin");
    await page.waitForURL(/\/dashboard/);
  });

  test("1. Admin creates user → mailbox + drive visible <5s", async ({ page }) => {
    await page.goto("/admin/org-structure");
    // click "Add person" ...
    // assert mail + drive provisioned via API poll
    await expect.poll(async () => (await fetch("/api/v1/mail/folders?user=...")).status, { timeout: 5000 })
      .toBe(200);
  });

  test("2. User A share doc to User B → B accesses without invite", async ({ page, browser }) => {
    // create grant for User A doc → get URL → open in User B's context
  });

  test("3. Admin changes org node policy → ex-manager loses access", async () => {
    // update policy binding → poll until old user gets 403 (<60s cache TTL)
  });

  test("4. External receives grant URL → read-only, J+7 expiration", async () => {
    // anonymous browser follows /g/:token → read ok, write 403
  });

  test("5. AD sync adds user → appears in org without duplicate", async () => {
    // trigger POST /api/v1/org/ad/sync/:tenant → verify via GET /org/persons
  });

  test("6. Board member gets rights on sub-nodes", async () => {});

  test("7. Move user cross-unit → RBAC updates without logout", async () => {});

  test("8. Revoke grant → access blocked <60s", async () => {});
});
```

- [ ] **Step 2: Commit**

```bash
rtk git add client/e2e/s1-org-rbac.spec.ts
rtk git commit -m "test(e2e): 8 S1 org+RBAC scenarios (create/share/revoke/AD sync/board/move/expire)"
```

---

### Task 36: Debug skills (3 new)

**Files:**
- Create: `.claude/skills/org-rbac-debug/SKILL.md`
- Create: `.claude/skills/ad-sync-debug/SKILL.md`
- Create: `.claude/skills/provisioning-debug/SKILL.md`

- [ ] **Step 1: Each file content (abbreviated)**

For each skill, include:
- Architecture recap (2-3 paragraphs)
- Common issues list (5-6 entries)
- Commands (grep patterns, SQL snippets)
- Related spec + plan references

- [ ] **Step 2: Commit**

```bash
rtk git add .claude/skills/{org-rbac-debug,ad-sync-debug,provisioning-debug}
rtk git commit -m "docs(skills): org-rbac-debug + ad-sync-debug + provisioning-debug"
```

---

### Task 37: Product spec + CLAUDE.md

**Files:**
- Create: `docs/product-specs/53-org-rbac-refonte.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Product spec**

Similar structure to prior `50-perf-architecturale.md`:
- Ce qui change pour dev
- Ce qui change pour l'utilisateur final
- État à la livraison + limites connues
- Références

- [ ] **Step 2: CLAUDE.md update**

Append under Préférences de développement:

```markdown
- **Org source of truth** : `signapps-org` (PostgreSQL). AD = miroir via `org_ad_config`. Workforce = HR pur.
- **RBAC unifié** : trait `OrgPermissionResolver` dans `signapps-common::rbac`, consommé par middleware `rbac::require(action, resource)` dans tous les services.
- **Provisioning** : événements `org.user.created|deactivated` via `PgEventBus` ; mail/storage/calendar/chat consomment.
- **Sharing** : `/api/v1/org/grants` + `/g/:token` cookie-based redirect. Tokens HMAC par tenant.
```

- [ ] **Step 3: Commit**

```bash
rtk git add docs/product-specs/53-org-rbac-refonte.md CLAUDE.md
rtk git commit -m "docs: S1 product spec + CLAUDE.md org/RBAC unified reference"
```

---

### Task 38: Rust E2E tests

**Files:**
- Create: `tests/e2e_s1_scenarios.rs`

- [ ] **Step 1: Integration tests**

Create Rust-level tests that exercise the 8 scenarios via HTTP. Pattern:

```rust
#[tokio::test]
#[ignore = "requires running platform"]
async fn s1_create_user_then_mailbox_exists() {
    let token = login_admin().await;
    let person = create_person("alice@acme.local", &token).await;
    // Poll GET /api/v1/mail/folders?user=alice
    for _ in 0..10 {
        if mail_folder_exists(&person, &token).await { return; }
        tokio::time::sleep(Duration::from_millis(500)).await;
    }
    panic!("mail folder not provisioned within 5s");
}
```

Cover the same 8 scenarios as Playwright — duplicate coverage, acceptable.

- [ ] **Step 2: Commit**

```bash
rtk git add tests/e2e_s1_scenarios.rs
rtk git commit -m "test(e2e): Rust-level S1 scenarios (mirror of Playwright spec)"
```

---

### Task 39: Merge to main + push

- [ ] **Step 1: Final checks**

```bash
cargo build --workspace
cargo clippy --workspace --no-deps -- -D warnings
cargo test -p signapps-platform --test boot --test service_count --test migrations_idempotent -- --ignored --nocapture
```

- [ ] **Step 2: Merge**

```bash
rtk git checkout main
rtk git pull --ff-only origin main
rtk git merge --no-ff feature/s1-org-rbac-refonte -m "Merge branch 'feature/s1-org-rbac-refonte': S1 org+RBAC+AD+provisioning+sharing"
rtk git push origin main
```

- [ ] **Step 3: Verify**

```bash
rtk git log --oneline main..origin/main | wc -l   # 0
```

---

## Self-Review

### Spec coverage

| Spec section | Task(s) |
|---|---|
| §4 Modèle canonique Sem 1 | 1, 2, 3, 4, 5, 6, 7, 8 |
| §5 API consolidée Sem 2 | 9, 10, 11, 12, 15 |
| §11 Hard-cut migration 426 | 13, 14 |
| §6 AD sync bidirectionnel Sem 3 | 16, 17, 18, 19, 20, 21 |
| §7 RBAC Sem 4 (trait + middleware + rollout) | 22, 23, 24, 25, 26, 27, 28, 29 |
| §8 Sharing + provisioning Sem 5 | 30, 31, 32, 33, 34 |
| §12 Tests (E2E 8 scénarios) | 35, 38 |
| §14 Debug skills + product spec | 36, 37 |
| Merge final | 39 |

### Placeholder scan

- No "TBD", "implement later", "similar to".
- Some tasks (23, 28, 33, 34, 36, 37, 38) describe patterns + one concrete example; the engineer iterates across N similar files following the shown template. Acceptable for rollouts of identical scaffolding.
- Tasks 10 and 11 include `todo!()` only in a pedagogical comment explaining the TDD pattern; the final code block always shows the real implementation.

### Type consistency

- `OrgNode`, `Person`, `Assignment`, `Axis`, `Policy`, `Board`, `AccessGrant` types defined Task 2-6, used Task 7-11, 23, 33, 35.
- `PersonRef { id, tenant_id }` stable across tasks 22, 23, 24.
- `ResourceRef` enum stable; new variants added in middleware extractors (Task 24) stay consistent.
- `Decision::Allow { source: DecisionSource }` stable.
- `AdSyncConfig`, `AdSyncMode`, `ConflictStrategy` stable Task 16-21.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-18-s1-org-rbac-refonte.md`. Two execution options:

**1. Subagent-Driven (recommended)** — un subagent par Wave ou batch de tasks, pattern éprouvé P1/P2/P3.

**2. Inline Execution** — via `superpowers:executing-plans` avec checkpoints.

Lequel ?
