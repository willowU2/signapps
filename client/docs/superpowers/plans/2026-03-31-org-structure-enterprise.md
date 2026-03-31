# Enterprise Org Structure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace flat workforce model with enterprise Party Model (persons with N roles), agnostic Entity Trees (positions ≠ people), temporal assignments with history, geographic sites, permission profiles, and auto-groups propagated to all modules.

**Architecture:** New `core` schema with persons, org_trees, org_nodes (closure table), assignments (temporal + history), sites. Auto-group sync triggers keep identity.groups in sync with org structure. Permission profiles on nodes define module access. Org context middleware injects user's org groups into every request.

**Tech Stack:** Rust (Axum), PostgreSQL (closure table), sqlx, Next.js 16, React 19, Zustand

**Spec:** `docs/superpowers/specs/2026-03-31-org-structure-enterprise-design.md`

---

## P1: Core Schema + Models + Repository + Handlers

### Task 1: Database migration

**Files:**
- Create: `migrations/122_core_org_structure.sql`

- [ ] **Step 1: Write the migration**

Creates `core` schema with 10 tables: `persons`, `person_roles`, `org_trees`, `org_nodes`, `org_closure`, `assignments`, `assignment_history`, `sites`, `node_sites`, `person_sites`, `permission_profiles`. Includes enums, indexes, triggers for closure table maintenance and updated_at. Migrates data from `workforce_*` tables.

- [ ] **Step 2: Apply migration**

```bash
docker exec -i signapps-postgres psql -U signapps < migrations/122_core_org_structure.sql
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(org): core schema — persons, trees, nodes, assignments, sites, permissions"
```

---

### Task 2: Rust models

**Files:**
- Create: `crates/signapps-db/src/models/core_org.rs`
- Modify: `crates/signapps-db/src/models/mod.rs`

- [ ] **Step 1: Create models**

Structs: `Person`, `CreatePerson`, `PersonRole`, `OrgTree`, `OrgNode`, `CreateOrgNode`, `Assignment`, `CreateAssignment`, `AssignmentHistory`, `Site`, `CreateSite`, `NodeSite`, `PersonSite`, `PermissionProfile`, `EffectivePermissions`, `OrgChartNode`

- [ ] **Step 2: Register module, build check**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(org): Rust models for Party Model, Entity Trees, Assignments, Sites"
```

---

### Task 3: Repository CRUD

**Files:**
- Create: `crates/signapps-db/src/repositories/core_org_repository.rs`
- Modify: `crates/signapps-db/src/repositories/mod.rs`

- [ ] **Step 1: Implement repositories**

- `PersonRepository`: list, create, update, find_by_id, find_by_user_id, search, add_role, remove_role, link_user, unlink_user
- `OrgTreeRepository`: list_by_tenant, create, find_by_type
- `OrgNodeRepository`: create, update, delete, find, get_children, get_descendants, get_ancestors, move_node, get_full_tree
- `AssignmentRepository`: create, update, end, list_by_person, list_by_node, list_active, log_history, get_history
- `SiteRepository`: list, create, update, find, attach_node, detach_node, attach_person, detach_person, list_persons
- `PermissionProfileRepository`: get_by_node, upsert, get_effective (walk tree with inheritance)

- [ ] **Step 2: Build check**

```bash
cargo check -p signapps-db
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(org): repository CRUD for persons, trees, nodes, assignments, sites, permissions"
```

---

### Task 4: Org handlers (trees + nodes)

**Files:**
- Create: `services/signapps-identity/src/handlers/org_trees.rs`
- Create: `services/signapps-identity/src/handlers/org_nodes.rs`
- Modify: `services/signapps-identity/src/handlers/mod.rs`
- Modify: `services/signapps-identity/src/main.rs`

- [ ] **Step 1: Create tree handlers**

3 endpoints: GET /org/trees, POST /org/trees, GET /org/trees/:id/full

- [ ] **Step 2: Create node handlers**

10 endpoints: CRUD + move + children + descendants + ancestors + assignments + permissions

- [ ] **Step 3: Register routes, build, commit**

```bash
git commit -m "feat(org): tree + node handlers — 13 endpoints"
```

---

### Task 5: Person handlers

**Files:**
- Create: `services/signapps-identity/src/handlers/persons.rs`

- [ ] **Step 1: Create handlers**

8 endpoints: list, create, update, get_detail, get_assignments, get_history, link_user, unlink_user, effective_permissions

- [ ] **Step 2: Register routes, build, commit**

```bash
git commit -m "feat(org): person handlers — 9 endpoints with Party Model"
```

---

### Task 6: Assignment handlers

**Files:**
- Create: `services/signapps-identity/src/handlers/assignments.rs`

- [ ] **Step 1: Create handlers**

4 endpoints: POST /assignments (create), PUT /assignments/:id (modify), DELETE /assignments/:id (end), GET /assignments/history (global history with filters)

Each create/modify/end also inserts into assignment_history with changed_by, reason, changes JSONB.

- [ ] **Step 2: Register routes, build, commit**

```bash
git commit -m "feat(org): assignment handlers with full history tracking"
```

---

### Task 7: Site handlers

**Files:**
- Create: `services/signapps-identity/src/handlers/sites.rs`

- [ ] **Step 1: Create handlers**

7 endpoints: CRUD + list_persons + attach_node + attach_person

- [ ] **Step 2: Register routes, build, commit**

```bash
git commit -m "feat(org): site handlers — geographic dimension"
```

---

## P2: Groupes Auto + Org Context Middleware

### Task 8: Auto-group sync service

**Files:**
- Create: `services/signapps-identity/src/services/org_groups_sync.rs`
- Create: `services/signapps-identity/src/services/mod.rs`

- [ ] **Step 1: Implement sync functions**

```rust
/// Called when assignment is created — add user to node group + ancestor groups
pub async fn on_assignment_created(pool: &PgPool, assignment: &Assignment) -> Result<(), AppError>

/// Called when assignment is ended — remove user from node group + ancestor groups
pub async fn on_assignment_ended(pool: &PgPool, assignment: &Assignment) -> Result<(), AppError>

/// Called when org node is created — create corresponding identity.group
pub async fn on_node_created(pool: &PgPool, node: &OrgNode) -> Result<(), AppError>

/// Called when org node is deleted — delete corresponding identity.group
pub async fn on_node_deleted(pool: &PgPool, node_id: Uuid) -> Result<(), AppError>

/// Full resync — rebuild all groups from scratch (admin tool)
pub async fn full_resync(pool: &PgPool, tenant_id: Uuid) -> Result<(), AppError>
```

- [ ] **Step 2: Wire into assignment + node handlers**

Call `on_assignment_created` in POST /assignments handler.
Call `on_assignment_ended` in DELETE /assignments handler.
Call `on_node_created` in POST /org/nodes handler.
Call `on_node_deleted` in DELETE /org/nodes handler.

- [ ] **Step 3: Build, commit**

```bash
git commit -m "feat(org): auto-group sync — nodes create groups, assignments manage members"
```

---

### Task 9: Org context middleware

**Files:**
- Create: `services/signapps-identity/src/middleware/org_context.rs`

- [ ] **Step 1: Implement middleware**

Axum middleware that:
1. Extracts user_id from Claims
2. Queries active assignments for the user
3. Queries org groups (via closure table — node groups + all ancestor groups)
4. Queries effective permission profile (merge profiles from all assigned positions)
5. Injects `OrgContext { person_id, assignments, org_group_ids, effective_permissions }` as request extension

Other services can read the `OrgContext` to filter data.

- [ ] **Step 2: Register in main.rs, build, commit**

```bash
git commit -m "feat(org): org context middleware — injects person, groups, permissions per request"
```

---

### Task 10: Orgchart endpoint

**Files:**
- Modify: `services/signapps-identity/src/handlers/org_nodes.rs`

- [ ] **Step 1: Add orgchart endpoint**

`GET /api/v1/org/orgchart` — Returns full tree with persons assigned to each node.
Optional `?date=2025-01-15` param to show historical orgchart.

Queries: org_nodes tree + assignments (filtered by date) + persons + sites.

- [ ] **Step 2: Build, commit**

```bash
git commit -m "feat(org): orgchart endpoint with historical date support"
```

---

## P3: Frontend

### Task 11: API client + types

**Files:**
- Create: `client/src/lib/api/org.ts`
- Create: `client/src/types/org.ts`

- [ ] **Step 1: Create TypeScript types**

All types: Person, PersonRole, OrgTree, OrgNode, Assignment, AssignmentHistory, Site, PermissionProfile, EffectivePermissions, OrgChartNode + create/update request types.

- [ ] **Step 2: Create API client**

`orgApi` with methods for: trees (list, create, getFull), nodes (CRUD, move, children, descendants, ancestors, assignments, permissions), persons (list, create, update, get, assignments, history, linkUser, permissions), assignments (create, update, end, history), sites (CRUD, persons, attachNode, attachPerson), orgchart (get, getHistorical).

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(org): frontend API client + TypeScript types"
```

---

### Task 12: Org store

**Files:**
- Create: `client/src/stores/org-store.ts`

- [ ] **Step 1: Create Zustand store**

State: `trees`, `currentTree`, `nodes`, `selectedNode`, `persons`, `assignments`, `sites`. Actions: fetch, create, update, delete for each entity. Selected node tracks which node is being edited.

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(org): Zustand org store with CRUD actions"
```

---

### Task 13: Org tree editor page

**Files:**
- Create: `client/src/app/admin/org-structure/page.tsx`
- Create: `client/src/components/org/org-tree-editor.tsx`
- Create: `client/src/components/org/node-detail-sheet.tsx`

- [ ] **Step 1: Create org-tree-editor**

Visual tree editor (~600 lines):
- Left: tree visualization with expand/collapse, color-coded node types
- Right: detail panel when node selected (name, type, description, config)
- Toolbar: add node, delete, move (drag-drop), switch tree (internal/clients/suppliers)
- Each node shows: name, type badge, person count, site indicator

- [ ] **Step 2: Create admin page**

`/admin/org-structure` page with AppLayout wrapper.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(org): org tree editor page with visual tree + node detail panel"
```

---

### Task 14: Persons admin page

**Files:**
- Create: `client/src/app/admin/persons/page.tsx`
- Create: `client/src/components/org/person-card.tsx`
- Create: `client/src/components/org/assignment-panel.tsx`

- [ ] **Step 1: Create persons page**

Admin page (~500 lines):
- Table of persons with: name, email, roles badges, current positions, site, user account status
- Filters: by role (employee/client/supplier), by node, by site, active/inactive
- Create/edit dialog: personal info + role management
- Assignment panel: show/add/end assignments with history timeline

- [ ] **Step 2: Create assignment-panel**

Side panel for managing a person's assignments:
- Active assignments with node name, type, responsibility, dates, FTE
- "Affecter" button to create new assignment (node picker + type + dates)
- History timeline with changes
- Link/unlink user account button

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(org): persons admin page + assignment panel"
```

---

### Task 15: Sites admin page

**Files:**
- Create: `client/src/app/admin/sites/page.tsx`

- [ ] **Step 1: Create sites page**

Admin page (~350 lines):
- Tree of sites (campus > building > floor > room)
- CRUD with address, city, country, capacity, timezone
- Map placeholder (show geo coordinates)
- Attached nodes and persons lists

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(org): sites admin page with geographic hierarchy"
```

---

### Task 16: Enhanced orgchart page

**Files:**
- Modify: `client/src/app/team/org-chart/page.tsx`
- Modify: `client/src/components/hr/org-chart.tsx`

- [ ] **Step 1: Enhance orgchart**

Replace the existing orgchart with one that:
- Fetches from `/api/v1/org/orgchart` (new endpoint)
- Shows positions with assigned persons (photo, name, title)
- Empty positions shown as dotted boxes "Poste vacant"
- Date picker to view historical orgchart
- Filter by tree (internal/clients/suppliers)
- Node type color coding
- Click node → show detail panel with assignments

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(org): enhanced orgchart with positions, persons, historical view"
```

---

### Task 17: Navigation + sidebar links

**Files:**
- Modify: `client/src/components/layout/sidebar.tsx`

- [ ] **Step 1: Add admin links**

Add to sidebar admin section:
- `/admin/org-structure` — "Structure org" with Building icon
- `/admin/persons` — "Personnes" with Users icon
- `/admin/sites` — "Sites" with MapPin icon

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(org): add org structure, persons, sites to admin sidebar"
```
