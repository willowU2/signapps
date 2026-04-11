# AD Org-Aware — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-provision AD accounts on employee affiliation, delegate AD management to managers via org tree, implement 3-level GPO resolution.

**Architecture:** 4-layer implementation — (1) DB migration, (2) Backend provisioning + delegation + GPO handlers on workforce service, (3) Frontend API client + /my-team Infrastructure tab, (4) Admin UI enhancements + E2E tests.

**Tech Stack:** PostgreSQL, Rust (Axum, sqlx), Next.js 16, React 19, react-query, shadcn/ui

---

## File Structure

### Backend (Rust)

| File | Responsibility | Action |
|------|---------------|--------|
| `migrations/285_ad_org_aware.sql` | Alter workforce_org_nodes + ad_user_accounts | Create |
| `services/signapps-workforce/src/handlers/ad_provisioning.rs` | Auto-provision + preview + bulk (3 endpoints) | Create |
| `services/signapps-workforce/src/handlers/ad_delegation.rs` | Manager self-service: accounts, computers, GPO (7 endpoints) | Create |
| `services/signapps-workforce/src/handlers/ad_gpo.rs` | GPO effective resolution + hierarchy + no_inherit (3 endpoints) | Create |
| `services/signapps-workforce/src/handlers/mod.rs` | Register new modules | Modify |
| `services/signapps-workforce/src/main.rs` | Register new routes | Modify |

### Frontend (TypeScript/React)

| File | Responsibility | Action |
|------|---------------|--------|
| `client/src/lib/api/active-directory.ts` | Add provisioning + delegation + GPO endpoints | Modify |
| `client/src/components/team/team-infrastructure.tsx` | /my-team Infrastructure tab | Create |
| `client/src/app/my-team/page.tsx` | Add 4th tab "Infrastructure" | Modify |
| `client/e2e/ad-org-smoke.spec.ts` | E2E smoke tests | Create |

---

## Task 1: Database Migration

**Files:**
- Create: `migrations/285_ad_org_aware.sql`

- [ ] **Step 1: Write migration**

```sql
-- 285_ad_org_aware.sql
-- AD org-aware: GPO no_inherit + provisioning tracking

ALTER TABLE workforce_org_nodes ADD COLUMN IF NOT EXISTS gpo_no_inherit BOOLEAN DEFAULT false;

ALTER TABLE ad_user_accounts ADD COLUMN IF NOT EXISTS is_auto_provisioned BOOLEAN DEFAULT false;
ALTER TABLE ad_user_accounts ADD COLUMN IF NOT EXISTS provisioned_at TIMESTAMPTZ;
ALTER TABLE ad_user_accounts ADD COLUMN IF NOT EXISTS provisioned_by UUID;
```

- [ ] **Step 2: Commit**

```bash
git add migrations/285_ad_org_aware.sql
git commit -m "feat(db): add GPO no_inherit + AD provisioning tracking columns"
```

---

## Task 2: Backend — AD Provisioning + Delegation + GPO Handlers

**Files:**
- Create: `services/signapps-workforce/src/handlers/ad_provisioning.rs`
- Create: `services/signapps-workforce/src/handlers/ad_delegation.rs`
- Create: `services/signapps-workforce/src/handlers/ad_gpo.rs`
- Modify: `services/signapps-workforce/src/handlers/mod.rs`
- Modify: `services/signapps-workforce/src/main.rs`

- [ ] **Step 1: Create ad_provisioning.rs**

Read `services/signapps-workforce/src/handlers/ad_sync.rs` first for the exact pattern (State, TenantContext, Claims, StatusCode).

3 handlers:

1. **`provision_person`** — POST /api/v1/workforce/ad/provision/:person_id
   - Get person from core.persons
   - Get primary assignment node from core.assignments
   - Find AD domain: walk up org_closure to find infrastructure.domains WHERE ad_enabled = true
   - Find or create OU for the node in ad_ous
   - Generate SAM: first_name.last_name (lowercase, no accents, truncate at 20 chars)
   - Generate UPN: sam@domain_name
   - Generate DN: CN=FirstName LastName,OU=NodeName,...,DC=parts
   - INSERT into ad_user_accounts with is_auto_provisioned=true, provisioned_at=NOW()
   - Return the created account

2. **`preview_provision`** — GET /api/v1/workforce/ad/provision/:person_id/preview
   - Same resolution logic but no INSERT
   - Return JSON: {sam, upn, dn, domain, ou, would_create: true/false}

3. **`bulk_provision`** — POST /api/v1/workforce/ad/provision/bulk
   - Find all persons with employee affiliation NOT IN ad_user_accounts
   - Provision each, collect results
   - Return {provisioned: N, skipped: N, errors: [{person_id, reason}]}

- [ ] **Step 2: Create ad_delegation.rs**

7 handlers for manager self-service:

1. **`my_team_ad_accounts`** — GET /api/v1/workforce/ad/my-team/accounts
   - Resolve person_id from claims.sub via core.persons
   - Get primary node from assignments
   - Query ad_user_accounts via org_closure (depth > 0)
   - Return accounts with person name, SAM, status, last_login

2. **`my_team_computers`** — GET /api/v1/workforce/ad/my-team/computers
   - Query ad_computer_accounts via org_closure

3. **`my_team_gpo`** — GET /api/v1/workforce/ad/my-team/gpo
   - Query effective GPO for manager's node (delegate to GPO resolution)

4. **`disable_account`** — POST /api/v1/workforce/ad/my-team/accounts/:id/disable
   - Verify account is in manager's subtree (org_closure check)
   - UPDATE ad_user_accounts SET sync_status = 'disabled'

5. **`enable_account`** — POST /api/v1/workforce/ad/my-team/accounts/:id/enable
   - Same subtree check
   - UPDATE SET sync_status = 'synced'

6. **`reset_password`** — POST /api/v1/workforce/ad/my-team/accounts/:id/reset-password
   - Generate temp password, update password_hash
   - Return {temporary_password: "..."}

7. **`move_account`** — PUT /api/v1/workforce/ad/my-team/accounts/:id/move
   - Body: {target_ou_id}
   - Verify target OU is within manager's subtree
   - UPDATE ad_user_accounts SET ou_id, distinguished_name

- [ ] **Step 3: Create ad_gpo.rs**

3 handlers:

1. **`effective_gpo`** — GET /api/v1/workforce/ad/gpo/effective/:node_id
   - Collect policies at 3 levels (tenant WHERE node_id IS NULL, domain, node chain via org_closure)
   - Merge by priority, enforced wins
   - Skip parents if node has gpo_no_inherit (but enforced still applies)
   - Return merged settings JSONB

2. **`gpo_hierarchy`** — GET /api/v1/workforce/ad/gpo/hierarchy/:node_id
   - Return the full chain: [{level: "tenant", policies: [...]}, {level: "domain", ...}, {level: "node", node_name, ...}]

3. **`toggle_no_inherit`** — PUT /api/v1/workforce/ad/gpo/no-inherit/:node_id
   - Body: {no_inherit: bool}
   - UPDATE workforce_org_nodes SET gpo_no_inherit

- [ ] **Step 4: Register modules + routes**

Add to mod.rs:
```rust
pub mod ad_provisioning;
pub mod ad_delegation;
pub mod ad_gpo;
```

Add routes to main.rs:
```rust
let ad_provision_routes = Router::new()
    .route("/api/v1/workforce/ad/provision/bulk", post(handlers::ad_provisioning::bulk_provision))
    .route("/api/v1/workforce/ad/provision/:person_id", post(handlers::ad_provisioning::provision_person))
    .route("/api/v1/workforce/ad/provision/:person_id/preview", get(handlers::ad_provisioning::preview_provision))
    .route("/api/v1/workforce/ad/my-team/accounts", get(handlers::ad_delegation::my_team_ad_accounts))
    .route("/api/v1/workforce/ad/my-team/computers", get(handlers::ad_delegation::my_team_computers))
    .route("/api/v1/workforce/ad/my-team/gpo", get(handlers::ad_delegation::my_team_gpo))
    .route("/api/v1/workforce/ad/my-team/accounts/:id/disable", post(handlers::ad_delegation::disable_account))
    .route("/api/v1/workforce/ad/my-team/accounts/:id/enable", post(handlers::ad_delegation::enable_account))
    .route("/api/v1/workforce/ad/my-team/accounts/:id/reset-password", post(handlers::ad_delegation::reset_password))
    .route("/api/v1/workforce/ad/my-team/accounts/:id/move", put(handlers::ad_delegation::move_account))
    .route("/api/v1/workforce/ad/gpo/effective/:node_id", get(handlers::ad_gpo::effective_gpo))
    .route("/api/v1/workforce/ad/gpo/hierarchy/:node_id", get(handlers::ad_gpo::gpo_hierarchy))
    .route("/api/v1/workforce/ad/gpo/no-inherit/:node_id", put(handlers::ad_gpo::toggle_no_inherit))
    .route_layer(middleware::from_fn(tenant_context_middleware))
    .route_layer(middleware::from_fn_with_state(state.clone(), auth_middleware));
```

- [ ] **Step 5: Verify + commit**

Run: `cargo check -p signapps-workforce`

```bash
git add services/signapps-workforce/src/handlers/ad_provisioning.rs \
       services/signapps-workforce/src/handlers/ad_delegation.rs \
       services/signapps-workforce/src/handlers/ad_gpo.rs \
       services/signapps-workforce/src/handlers/mod.rs \
       services/signapps-workforce/src/main.rs
git commit -m "feat(ad): add auto-provisioning, manager delegation, GPO resolution (13 endpoints)"
```

---

## Task 3: Frontend API + /my-team Infrastructure Tab

**Files:**
- Modify: `client/src/lib/api/active-directory.ts`
- Create: `client/src/components/team/team-infrastructure.tsx`
- Modify: `client/src/app/my-team/page.tsx`

- [ ] **Step 1: Extend AD API client**

Add to `client/src/lib/api/active-directory.ts`:

```typescript
// Provisioning
provisioning: {
  provision: (personId: string) => client.post(`/ad/provision/${personId}`),
  preview: (personId: string) => client.get(`/ad/provision/${personId}/preview`),
  bulk: () => client.post("/ad/provision/bulk"),
},

// Manager delegation
myTeam: {
  accounts: () => client.get("/ad/my-team/accounts"),
  computers: () => client.get("/ad/my-team/computers"),
  gpo: () => client.get("/ad/my-team/gpo"),
  disableAccount: (id: string) => client.post(`/ad/my-team/accounts/${id}/disable`),
  enableAccount: (id: string) => client.post(`/ad/my-team/accounts/${id}/enable`),
  resetPassword: (id: string) => client.post(`/ad/my-team/accounts/${id}/reset-password`),
  moveAccount: (id: string, data: { target_ou_id: string }) => client.put(`/ad/my-team/accounts/${id}/move`, data),
},

// GPO
gpo: {
  effective: (nodeId: string) => client.get(`/ad/gpo/effective/${nodeId}`),
  hierarchy: (nodeId: string) => client.get(`/ad/gpo/hierarchy/${nodeId}`),
  toggleNoInherit: (nodeId: string, noInherit: boolean) => client.put(`/ad/gpo/no-inherit/${nodeId}`, { no_inherit: noInherit }),
},
```

- [ ] **Step 2: Create team-infrastructure.tsx**

`client/src/components/team/team-infrastructure.tsx`:

A component for /my-team tab "Infrastructure" showing:
- **AD Accounts table**: columns (Nom, SAM, Statut badge, Dernier login, Expiration MDP)
  - Status badges: synced=green, disabled=red, pending=yellow
  - Actions per row: disable/enable toggle, reset password button
  - Uses react-query with `adApi.myTeam.accounts()`
- **Computers section**: simple table (Hostname, OS, Dernier vu)
  - Uses `adApi.myTeam.computers()`
- **GPO section**: collapsible list of effective policies for manager's node
  - Uses `adApi.myTeam.gpo()`
- Loading skeletons, error states, empty states for each section
- Toast notifications on actions (disable, enable, reset password)

- [ ] **Step 3: Add Infrastructure tab to /my-team**

In `client/src/app/my-team/page.tsx`, add a 4th tab:
- Label: "Infrastructure"
- Icon: Server (from lucide-react)
- Content: `<TeamInfrastructure />`
- Only visible if team has AD accounts (check if accounts list is non-empty)

- [ ] **Step 4: Commit**

```bash
git add client/src/lib/api/active-directory.ts \
       client/src/components/team/team-infrastructure.tsx \
       client/src/app/my-team/page.tsx
git commit -m "feat(ad-ui): add AD delegation API, Infrastructure tab in /my-team"
```

---

## Task 4: E2E Tests

**Files:**
- Create: `client/e2e/ad-org-smoke.spec.ts`

- [ ] **Step 1: Create E2E spec**

```typescript
import { test, expect } from "./fixtures";

test.describe("AD Org-Aware — smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login?auto=admin", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
  });

  test("AD admin page loads", async ({ page }) => {
    await page.goto("/admin/active-directory", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const heading = page.getByText(/active directory|domaines/i);
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
  });

  test("AD domains tab visible", async ({ page }) => {
    await page.goto("/admin/active-directory/domains", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const content = page.getByText(/domaines|domains/i);
    await expect(content.first()).toBeVisible({ timeout: 10000 });
  });

  test("AD GPO tab visible", async ({ page }) => {
    await page.goto("/admin/active-directory/gpo", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const content = page.getByText(/gpo|politiques|policies/i);
    await expect(content.first()).toBeVisible({ timeout: 10000 });
  });

  test("AD sync tab visible", async ({ page }) => {
    await page.goto("/admin/active-directory/sync", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const content = page.getByText(/sync|synchronisation/i);
    await expect(content.first()).toBeVisible({ timeout: 10000 });
  });

  test("/my-team page loads with tabs", async ({ page }) => {
    await page.goto("/my-team", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const heading = page.getByText(/mon equipe|aucun rapport/i);
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
  });

  test("AD DNS tab loads", async ({ page }) => {
    await page.goto("/admin/active-directory/dns", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const content = page.getByText(/dns|zones/i);
    await expect(content.first()).toBeVisible({ timeout: 10000 });
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add client/e2e/ad-org-smoke.spec.ts
git commit -m "test(e2e): add AD org-aware smoke tests (6 tests)"
```

---

## Summary

| Task | Description | Files | Est. |
|------|-------------|-------|------|
| 1 | DB migration (3 column alters) | 1 SQL | 2 min |
| 2 | Backend provisioning + delegation + GPO (13 endpoints) | 5 files | 20 min |
| 3 | Frontend API + /my-team Infrastructure tab | 3 files | 12 min |
| 4 | E2E tests (6 tests) | 1 file | 3 min |
