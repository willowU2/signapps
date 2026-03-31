# Drive SP1: ACL hérité + Groupes hybrides + Audit forensique — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace flat drive permissions with inherited ACL (5 roles), hybrid groups (local + LDAP/AD), and forensic audit trail with signature chains and behavioral alerts.

**Architecture:** New `drive.acl` table with role-based grants (viewer→manager) and inheritance resolution via tree walk. Forensic `drive.audit_log` with SHA256 chaining. ACL middleware intercepts all Drive/Files requests. Hybrid groups extend `identity.groups` with LDAP/AD sync.

**Tech Stack:** Rust (Axum), PostgreSQL, sqlx, SHA256 (sha2 crate), Next.js 16, React 19, Zustand

**Spec:** `docs/superpowers/specs/2026-03-31-drive-sp1-acl-audit-design.md`

---

## File Structure

### Backend — New files
| File | Responsibility |
|------|---------------|
| `migrations/118_drive_acl.sql` | ACL table, audit_log table, alert_config, group extensions, data migration |
| `crates/signapps-db/src/models/drive_acl.rs` | Rust structs: Acl, AuditLog, AuditAlertConfig |
| `crates/signapps-db/src/repositories/drive_acl_repository.rs` | CRUD for ACL + audit + alerts |
| `services/signapps-storage/src/handlers/acl.rs` | ACL endpoints (list, grant, revoke, break/restore inheritance) |
| `services/signapps-storage/src/handlers/audit.rs` | Audit endpoints (list, verify, export, alerts) |
| `services/signapps-storage/src/services/acl_resolver.rs` | Effective role resolution (tree walk algorithm) |
| `services/signapps-storage/src/services/audit_chain.rs` | Audit logging with SHA256 chain |
| `services/signapps-storage/src/services/alert_worker.rs` | Background alert detection worker |
| `services/signapps-storage/src/middleware/acl_check.rs` | Axum middleware for ACL enforcement |

### Backend — Modified files
| File | Changes |
|------|---------|
| `services/signapps-storage/src/main.rs` | Add routes, middleware, workers |
| `services/signapps-storage/src/handlers/mod.rs` | Register acl + audit modules |
| `crates/signapps-db/src/models/mod.rs` | Register drive_acl module |
| `crates/signapps-db/src/repositories/mod.rs` | Register drive_acl_repository |

### Frontend — New files
| File | Responsibility |
|------|---------------|
| `client/src/components/storage/acl-panel.tsx` | Permission management panel (grants, roles, inheritance) |
| `client/src/components/storage/audit-timeline.tsx` | Audit trail viewer with timeline |
| `client/src/app/admin/drive-audit/page.tsx` | Admin audit dashboard |

### Frontend — Modified files
| File | Changes |
|------|---------|
| `client/src/lib/api/storage.ts` | Add ACL + audit API methods |
| `client/src/types/drive.ts` or `client/src/lib/api/drive.ts` | Add ACL types |

---

## Task 1: Database migration

**Files:**
- Create: `migrations/118_drive_acl.sql`

- [ ] **Step 1: Write the migration**

```sql
-- migrations/118_drive_acl.sql
-- Drive SP1: ACL, Audit, Alert Config, Group extensions

-- ═══ ACL ═══

DO $$ BEGIN
    CREATE TYPE drive.acl_role AS ENUM ('viewer', 'downloader', 'editor', 'contributor', 'manager');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE drive.grantee_type AS ENUM ('user', 'group', 'everyone');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Inheritance flag on nodes
ALTER TABLE drive.nodes
    ADD COLUMN IF NOT EXISTS inherit_permissions BOOLEAN DEFAULT TRUE;

-- ACL grants
CREATE TABLE IF NOT EXISTS drive.acl (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id UUID NOT NULL REFERENCES drive.nodes(id) ON DELETE CASCADE,
    grantee_type drive.grantee_type NOT NULL,
    grantee_id UUID,
    role drive.acl_role NOT NULL,
    inherit BOOLEAN DEFAULT TRUE,
    granted_by UUID NOT NULL REFERENCES identity.users(id),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(node_id, grantee_type, grantee_id)
);

CREATE INDEX IF NOT EXISTS idx_acl_node ON drive.acl(node_id);
CREATE INDEX IF NOT EXISTS idx_acl_grantee ON drive.acl(grantee_type, grantee_id);
CREATE INDEX IF NOT EXISTS idx_acl_expires ON drive.acl(expires_at) WHERE expires_at IS NOT NULL;

-- ═══ AUDIT ═══

DO $$ BEGIN
    CREATE TYPE drive.audit_action AS ENUM (
        'view', 'download', 'create', 'update', 'delete', 'restore',
        'share', 'unshare', 'permission_change', 'access_denied',
        'move', 'rename', 'copy', 'trash', 'untrash', 'version_restore'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS drive.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id UUID,
    node_path TEXT NOT NULL,
    action drive.audit_action NOT NULL,
    actor_id UUID NOT NULL REFERENCES identity.users(id),
    actor_ip INET,
    actor_geo TEXT,
    file_hash TEXT,
    details JSONB DEFAULT '{}',
    prev_log_hash TEXT,
    log_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_node ON drive.audit_log(node_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON drive.audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON drive.audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON drive.audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_hash ON drive.audit_log(log_hash);

-- ═══ ALERT CONFIG ═══

CREATE TABLE IF NOT EXISTS drive.audit_alert_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    alert_type TEXT NOT NULL,
    threshold JSONB NOT NULL DEFAULT '{}',
    enabled BOOLEAN DEFAULT TRUE,
    notify_emails TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══ GROUP EXTENSIONS ═══

ALTER TABLE identity.groups
    ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'local',
    ADD COLUMN IF NOT EXISTS external_id TEXT,
    ADD COLUMN IF NOT EXISTS sync_enabled BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_groups_source ON identity.groups(source);
CREATE INDEX IF NOT EXISTS idx_groups_external ON identity.groups(external_id) WHERE external_id IS NOT NULL;

-- ═══ MIGRATE OLD PERMISSIONS ═══

INSERT INTO drive.acl (node_id, grantee_type, grantee_id, role, granted_by, created_at)
SELECT
    node_id,
    CASE WHEN group_id IS NOT NULL THEN 'group'::drive.grantee_type ELSE 'user'::drive.grantee_type END,
    COALESCE(user_id, group_id),
    role::text::drive.acl_role,
    granted_by,
    created_at
FROM drive.permissions
WHERE EXISTS (SELECT 1 FROM drive.permissions LIMIT 1)
ON CONFLICT DO NOTHING;

-- Default alert configs
INSERT INTO drive.audit_alert_config (org_id, alert_type, threshold) VALUES
    ('00000000-0000-0000-0000-000000000000', 'mass_download', '{"count": 50, "window_minutes": 10}'),
    ('00000000-0000-0000-0000-000000000000', 'off_hours', '{"start_hour": 22, "end_hour": 6}'),
    ('00000000-0000-0000-0000-000000000000', 'access_denied_burst', '{"count": 5, "window_minutes": 5}'),
    ('00000000-0000-0000-0000-000000000000', 'mass_delete', '{"count": 20, "window_minutes": 5}')
ON CONFLICT DO NOTHING;

-- Updated_at triggers
DO $$
DECLARE t TEXT;
BEGIN
    FOR t IN SELECT unnest(ARRAY['acl', 'audit_alert_config'])
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_drive_%s_updated ON drive.%s', t, t);
        EXECUTE format('CREATE TRIGGER trg_drive_%s_updated BEFORE UPDATE ON drive.%s FOR EACH ROW EXECUTE FUNCTION calendar.update_updated_at()', t, t);
    END LOOP;
END $$;
```

- [ ] **Step 2: Apply migration**

```bash
docker exec -i signapps-postgres psql -U signapps < migrations/118_drive_acl.sql
```

- [ ] **Step 3: Commit**

```bash
git add migrations/118_drive_acl.sql
git commit -m "feat(drive): add ACL, audit_log, alert_config tables + migrate permissions"
```

---

## Task 2: Rust models + repository

**Files:**
- Create: `crates/signapps-db/src/models/drive_acl.rs`
- Create: `crates/signapps-db/src/repositories/drive_acl_repository.rs`
- Modify: `crates/signapps-db/src/models/mod.rs`
- Modify: `crates/signapps-db/src/repositories/mod.rs`

- [ ] **Step 1: Create models**

`crates/signapps-db/src/models/drive_acl.rs`:

```rust
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// ACL grant on a drive node.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DriveAcl {
    pub id: Uuid,
    pub node_id: Uuid,
    pub grantee_type: String,
    pub grantee_id: Option<Uuid>,
    pub role: String,
    pub inherit: Option<bool>,
    pub granted_by: Uuid,
    pub expires_at: Option<DateTime<Utc>>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

/// Request to create an ACL grant.
#[derive(Debug, Deserialize)]
pub struct CreateAcl {
    pub grantee_type: String,
    pub grantee_id: Option<Uuid>,
    pub role: String,
    pub inherit: Option<bool>,
    pub expires_at: Option<DateTime<Utc>>,
}

/// Forensic audit log entry.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DriveAuditLog {
    pub id: Uuid,
    pub node_id: Option<Uuid>,
    pub node_path: String,
    pub action: String,
    pub actor_id: Uuid,
    pub actor_ip: Option<String>,
    pub actor_geo: Option<String>,
    pub file_hash: Option<String>,
    pub details: Option<serde_json::Value>,
    pub prev_log_hash: Option<String>,
    pub log_hash: String,
    pub created_at: Option<DateTime<Utc>>,
}

/// Audit alert configuration.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct AuditAlertConfig {
    pub id: Uuid,
    pub org_id: Uuid,
    pub alert_type: String,
    pub threshold: serde_json::Value,
    pub enabled: Option<bool>,
    pub notify_emails: Option<Vec<String>>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

/// Effective ACL result for a user on a node.
#[derive(Debug, Serialize)]
pub struct EffectiveAcl {
    pub node_id: Uuid,
    pub user_id: Uuid,
    pub role: Option<String>,
    pub is_owner: bool,
    pub inherited_from: Option<Uuid>,
    pub grants: Vec<DriveAcl>,
}
```

- [ ] **Step 2: Create repository**

`crates/signapps-db/src/repositories/drive_acl_repository.rs` with CRUD for:
- `AclRepository`: list_by_node, create, update, delete, list_by_grantee
- `AuditLogRepository`: insert, list (with filters), get_last_hash, verify_chain, export
- `AuditAlertConfigRepository`: list, update

- [ ] **Step 3: Register modules**

Add `pub mod drive_acl;` to both `models/mod.rs` and `repositories/mod.rs`.

- [ ] **Step 4: Build check**

```bash
cargo check -p signapps-db
```

- [ ] **Step 5: Commit**

```bash
git add crates/signapps-db/
git commit -m "feat(drive): ACL + audit models and repository CRUD"
```

---

## Task 3: ACL resolver service

**Files:**
- Create: `services/signapps-storage/src/services/acl_resolver.rs`
- Create: `services/signapps-storage/src/services/mod.rs`

- [ ] **Step 1: Implement the tree-walk ACL resolver**

```rust
/// Resolve the effective role for a user on a drive node.
/// Walks up the tree collecting ACL grants until inheritance breaks or root is reached.
/// Returns the highest role found, or None if no access.
pub async fn resolve_effective_role(
    pool: &PgPool,
    user_id: Uuid,
    node_id: Uuid,
) -> Result<EffectiveAcl, AppError>
```

Implementation:
1. Check if user is owner → return manager
2. Get user's group IDs from `identity.group_members`
3. Walk up parent chain: for each node, collect matching ACLs (user direct, group, everyone)
4. Stop at node with `inherit_permissions = false` or root
5. Return highest role from collected grants

Role ordering: `viewer=0, downloader=1, editor=2, contributor=3, manager=4`

- [ ] **Step 2: Build check**

```bash
cargo check -p signapps-storage
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(drive): ACL resolver with tree-walk inheritance algorithm"
```

---

## Task 4: Audit chain service

**Files:**
- Create: `services/signapps-storage/src/services/audit_chain.rs`

- [ ] **Step 1: Implement audit logging with SHA256 chain**

```rust
/// Log an audit event with SHA256 chain integrity.
pub async fn log_audit(
    pool: &PgPool,
    node_id: Option<Uuid>,
    node_path: &str,
    action: &str,
    actor_id: Uuid,
    actor_ip: Option<&str>,
    file_hash: Option<&str>,
    details: Option<serde_json::Value>,
) -> Result<DriveAuditLog, AppError>
```

Implementation:
1. Get `prev_log_hash` from last audit entry (or "GENESIS" if first)
2. Compute `log_hash = SHA256(prev_log_hash + action + actor_id + node_id + timestamp)`
3. Optionally resolve `actor_geo` from IP (MaxMind GeoLite2 or fallback to None)
4. Insert into `drive.audit_log`

```rust
/// Verify the integrity of the audit chain.
pub async fn verify_chain(pool: &PgPool) -> Result<ChainVerification, AppError>
```

Returns: `{ valid: bool, total_entries: i64, first_corrupt_index: Option<i64> }`

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(drive): forensic audit chain with SHA256 signatures"
```

---

## Task 5: ACL check middleware

**Files:**
- Create: `services/signapps-storage/src/middleware/acl_check.rs`

- [ ] **Step 1: Implement middleware**

Axum middleware that:
1. Extracts `node_id` from URL path (`:id` param or body for POST)
2. Maps HTTP method + path to required role
3. Calls `acl_resolver::resolve_effective_role()`
4. If denied → log `access_denied` in audit + return 403
5. If allowed → log action in audit + continue

```rust
pub async fn drive_acl_check(
    State(state): State<AppState>,
    claims: Claims,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    request: Request,
    next: Next,
) -> Result<Response, AppError>
```

Role mapping:
- GET download → Downloader
- GET view/preview/list → Viewer
- POST/PUT create/update → Editor
- POST share → Contributor
- DELETE, POST acl/* → Manager

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(drive): ACL enforcement middleware with audit logging"
```

---

## Task 6: ACL + Audit handlers + routes

**Files:**
- Create: `services/signapps-storage/src/handlers/acl.rs`
- Create: `services/signapps-storage/src/handlers/audit.rs`
- Modify: `services/signapps-storage/src/handlers/mod.rs`
- Modify: `services/signapps-storage/src/main.rs`

- [ ] **Step 1: ACL handlers**

7 endpoints:
- `list_acl(node_id)` — GET, returns direct + inherited grants
- `create_acl(node_id, body)` — POST, requires Manager role
- `update_acl(node_id, acl_id, body)` — PUT
- `delete_acl(node_id, acl_id)` — DELETE
- `break_inheritance(node_id)` — POST, copies inherited ACLs as explicit
- `restore_inheritance(node_id)` — POST, deletes explicit ACLs, sets inherit=true
- `effective_acl(node_id)` — GET, returns computed role for current user

- [ ] **Step 2: Audit handlers**

6 endpoints:
- `list_audit(filters)` — GET with query params (node_id, actor_id, action, date_from, date_to)
- `verify_chain()` — GET, returns chain integrity result
- `export_audit(body)` — POST, returns CSV/JSON
- `list_alerts()` — GET, recent triggered alerts
- `get_alert_config()` — GET
- `update_alert_config(body)` — PUT

- [ ] **Step 3: Register routes in main.rs**

```rust
// ACL routes (require auth)
.route("/api/v1/drive/nodes/:id/acl", get(acl::list_acl).post(acl::create_acl))
.route("/api/v1/drive/nodes/:id/acl/:acl_id", put(acl::update_acl).delete(acl::delete_acl))
.route("/api/v1/drive/nodes/:id/acl/break", post(acl::break_inheritance))
.route("/api/v1/drive/nodes/:id/acl/restore", post(acl::restore_inheritance))
.route("/api/v1/drive/nodes/:id/effective-acl", get(acl::effective_acl))

// Audit routes (require admin)
.route("/api/v1/drive/audit", get(audit::list_audit))
.route("/api/v1/drive/audit/verify", get(audit::verify_chain))
.route("/api/v1/drive/audit/export", post(audit::export_audit))
.route("/api/v1/drive/audit/alerts", get(audit::list_alerts))
.route("/api/v1/drive/audit/alerts/config", get(audit::get_alert_config).put(audit::update_alert_config))
```

Apply `drive_acl_check` middleware to all `/api/v1/drive/**` and `/api/v1/files/**` routes.

- [ ] **Step 4: Build check**

```bash
cargo check -p signapps-storage
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(drive): ACL + audit handlers with 13 endpoints, ACL middleware on all drive routes"
```

---

## Task 7: Alert worker (background)

**Files:**
- Create: `services/signapps-storage/src/services/alert_worker.rs`
- Modify: `services/signapps-storage/src/main.rs` (spawn worker)

- [ ] **Step 1: Implement background alert detector**

Runs every 60 seconds via `tokio::spawn` + `tokio::time::interval`:
1. Load active alert configs from DB
2. For each config, query recent audit logs within the threshold window
3. If count exceeds threshold → insert alert record + send notification email
4. Alert types: mass_download, off_hours, access_denied_burst, mass_delete

- [ ] **Step 2: Spawn in main.rs**

```rust
// After server setup
tokio::spawn(alert_worker::run(pool.clone()));
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(drive): background alert worker for suspicious behavior detection"
```

---

## Task 8: Frontend — API client + types

**Files:**
- Modify: `client/src/lib/api/storage.ts`
- Modify: `client/src/lib/api/drive.ts` or `client/src/types/drive.ts`

- [ ] **Step 1: Add TypeScript types**

```typescript
export type AclRole = 'viewer' | 'downloader' | 'editor' | 'contributor' | 'manager';
export type GranteeType = 'user' | 'group' | 'everyone';

export interface DriveAcl {
  id: string;
  node_id: string;
  grantee_type: GranteeType;
  grantee_id?: string;
  role: AclRole;
  inherit: boolean;
  granted_by: string;
  expires_at?: string;
  // Enriched by frontend
  grantee_name?: string;
}

export interface EffectiveAcl {
  node_id: string;
  user_id: string;
  role: AclRole | null;
  is_owner: boolean;
  inherited_from?: string;
  grants: DriveAcl[];
}

export interface AuditLogEntry {
  id: string;
  node_id?: string;
  node_path: string;
  action: string;
  actor_id: string;
  actor_ip?: string;
  actor_geo?: string;
  file_hash?: string;
  details: Record<string, unknown>;
  log_hash: string;
  created_at: string;
  // Enriched
  actor_name?: string;
}

export interface ChainVerification {
  valid: boolean;
  total_entries: number;
  first_corrupt_index?: number;
}
```

- [ ] **Step 2: Add API methods to storage.ts**

```typescript
export const driveAclApi = {
  list: (nodeId: string) => storageClient.get<DriveAcl[]>(`/drive/nodes/${nodeId}/acl`),
  create: (nodeId: string, data: { grantee_type: GranteeType; grantee_id?: string; role: AclRole; inherit?: boolean; expires_at?: string }) =>
    storageClient.post<DriveAcl>(`/drive/nodes/${nodeId}/acl`, data),
  update: (nodeId: string, aclId: string, data: Partial<{ role: AclRole; expires_at: string }>) =>
    storageClient.put<DriveAcl>(`/drive/nodes/${nodeId}/acl/${aclId}`, data),
  delete: (nodeId: string, aclId: string) =>
    storageClient.delete(`/drive/nodes/${nodeId}/acl/${aclId}`),
  breakInheritance: (nodeId: string) =>
    storageClient.post(`/drive/nodes/${nodeId}/acl/break`),
  restoreInheritance: (nodeId: string) =>
    storageClient.post(`/drive/nodes/${nodeId}/acl/restore`),
  effective: (nodeId: string) =>
    storageClient.get<EffectiveAcl>(`/drive/nodes/${nodeId}/effective-acl`),
};

export const driveAuditApi = {
  list: (params: { node_id?: string; actor_id?: string; action?: string; date_from?: string; date_to?: string; limit?: number; offset?: number }) =>
    storageClient.get<AuditLogEntry[]>('/drive/audit', { params }),
  verify: () => storageClient.get<ChainVerification>('/drive/audit/verify'),
  export: (params: { format: 'csv' | 'json'; date_from?: string; date_to?: string }) =>
    storageClient.post('/drive/audit/export', params, { responseType: 'blob' }),
  alerts: () => storageClient.get('/drive/audit/alerts'),
  alertConfig: () => storageClient.get('/drive/audit/alerts/config'),
  updateAlertConfig: (data: unknown) => storageClient.put('/drive/audit/alerts/config', data),
};
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(drive): ACL + audit API client with TypeScript types"
```

---

## Task 9: Frontend — ACL panel component

**Files:**
- Create: `client/src/components/storage/acl-panel.tsx`

- [ ] **Step 1: Create ACL management panel**

A Sheet (side panel) with:
- Header showing node name + inheritance status badge
- "Casser l'héritage" / "Restaurer l'héritage" toggle button
- List of grants: each row = avatar + name + role selector (5 options) + expiry + delete button
- Inherited grants shown in lighter color with "Hérité" badge
- Add grant: user/group picker + role selector + optional expiry
- 5 role badges with distinct colors (viewer=gray, downloader=blue, editor=green, contributor=amber, manager=red)

~400 lines. Use shadcn Sheet, Select, Badge, Button, DatePicker. French labels.

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(drive): ACL management panel component"
```

---

## Task 10: Frontend — Audit timeline + Admin page

**Files:**
- Create: `client/src/components/storage/audit-timeline.tsx`
- Create: `client/src/app/admin/drive-audit/page.tsx`

- [ ] **Step 1: Create audit timeline component**

Timeline view showing recent actions on a file/folder:
- Each entry: icon (by action type) + actor name + action description + timestamp + IP + geo
- Color coding: green=create, blue=view/download, amber=update, red=delete/denied
- Chain integrity indicator (green checkmark / red X)
- Export button (CSV/JSON)
- Filters: action type, date range, actor

~350 lines.

- [ ] **Step 2: Create admin audit dashboard page**

`/admin/drive-audit` page with:
- Alert summary cards (active alerts count by type)
- Activity chart (actions/day over last 30 days)
- Alert config editor (seuils + emails)
- Chain verification button with result display
- Full audit log table with pagination + filters

~500 lines.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(drive): audit timeline component + admin audit dashboard page"
```

---

## Task 11: Integration — Wire ACL into Drive UI

**Files:**
- Modify: `client/src/app/drive/page.tsx`
- Modify: `client/src/components/storage/permissions-sheet.tsx` (replace with acl-panel)

- [ ] **Step 1: Add "Permissions" and "Historique d'accès" to context menu**

In `drive/page.tsx`, find the context menu and add:
- "Permissions" → opens `<AclPanel nodeId={...} />`
- "Historique d'accès" → opens `<AuditTimeline nodeId={...} />`

- [ ] **Step 2: Replace old permissions-sheet references**

Update imports from `permissions-sheet` to `acl-panel`.

- [ ] **Step 3: Add sidebar link for admin audit**

Add `/admin/drive-audit` to the admin navigation.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(drive): wire ACL panel + audit timeline into Drive UI"
```
