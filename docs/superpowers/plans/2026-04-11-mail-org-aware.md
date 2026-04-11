# Mail Org-Aware Auto-Provisioning — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-provision internal mailboxes from org structure with inherited naming rules, distribution lists, shared mailboxes, and portal message channels.

**Architecture:** 4-layer implementation — (1) DB migration for new tables, (2) Backend handlers on mail service for naming rules, distlists, shared mailboxes, portal messages, provisioning, (3) Frontend API client + admin UI enrichment, (4) Compose alias dropdown + portal messages UI + E2E tests.

**Tech Stack:** PostgreSQL, Rust (Axum, sqlx), Next.js 16, React 19, Zustand, react-query, shadcn/ui

---

## File Structure

### Backend (Rust)

| File | Responsibility | Action |
|------|---------------|--------|
| `migrations/275_mail_org_aware.sql` | Schema: naming_rules, distribution_lists, shared_mailboxes, portal_messages, alter accounts/aliases | Create |
| `services/signapps-mail/src/handlers/naming_rules.rs` | Naming rules CRUD + resolve | Create |
| `services/signapps-mail/src/handlers/distribution_lists.rs` | Distribution list CRUD + member resolution | Create |
| `services/signapps-mail/src/handlers/shared_mailboxes.rs` | Shared mailbox CRUD + member management | Create |
| `services/signapps-mail/src/handlers/portal_messages.rs` | Portal message CRUD + thread + unread | Create |
| `services/signapps-mail/src/handlers/provisioning.rs` | Auto-provision + preview + bulk | Create |
| `services/signapps-mail/src/handlers/mod.rs` | Register new modules | Modify |
| `services/signapps-mail/src/api.rs` | Register new routes | Modify |

### Frontend (TypeScript/React)

| File | Responsibility | Action |
|------|---------------|--------|
| `client/src/lib/api/mailserver.ts` | API client for naming rules, distlists, shared mailboxes, portal msgs, provisioning | Create |
| `client/src/app/admin/mail-server/page.tsx` | Add tabs: Naming Rules, Distribution Lists, Shared Mailboxes | Modify |
| `client/src/app/portal/client/messages/page.tsx` | Portal message inbox for clients | Create |
| `client/src/app/portal/supplier/messages/page.tsx` | Portal message inbox for suppliers | Create |
| `client/e2e/mail-org-smoke.spec.ts` | E2E smoke tests | Create |

---

## Task 1: Database Migration

**Files:**
- Create: `migrations/275_mail_org_aware.sql`

- [ ] **Step 1: Write migration**

```sql
-- 275_mail_org_aware.sql
-- Mail org-aware: naming rules, distribution lists, shared mailboxes, portal messages

-- 1. Naming rules (inherited in org tree)
CREATE TABLE IF NOT EXISTS mailserver.naming_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id UUID NOT NULL,
    pattern TEXT NOT NULL DEFAULT '{first_name}.{last_name}',
    domain_id UUID REFERENCES mailserver.domains(id),
    collision_strategy TEXT DEFAULT 'append_number'
        CHECK (collision_strategy IN ('append_number', 'append_initial', 'manual')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(node_id)
);
CREATE INDEX IF NOT EXISTS idx_naming_rules_node ON mailserver.naming_rules(node_id);

-- 2. Distribution lists (auto from org nodes)
CREATE TABLE IF NOT EXISTS mailserver.distribution_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id UUID NOT NULL,
    address TEXT NOT NULL,
    domain_id UUID NOT NULL REFERENCES mailserver.domains(id),
    description TEXT,
    allow_external_senders BOOLEAN DEFAULT false,
    is_auto BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(address)
);
CREATE INDEX IF NOT EXISTS idx_distlist_node ON mailserver.distribution_lists(node_id);

-- 3. Shared mailboxes
CREATE TABLE IF NOT EXISTS mailserver.shared_mailboxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    address TEXT NOT NULL,
    display_name TEXT NOT NULL,
    domain_id UUID NOT NULL REFERENCES mailserver.domains(id),
    description TEXT,
    auto_reply_enabled BOOLEAN DEFAULT false,
    auto_reply_subject TEXT,
    auto_reply_body TEXT,
    quota_bytes BIGINT DEFAULT 5368709120,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(address)
);

CREATE TABLE IF NOT EXISTS mailserver.shared_mailbox_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shared_mailbox_id UUID NOT NULL REFERENCES mailserver.shared_mailboxes(id) ON DELETE CASCADE,
    person_id UUID NOT NULL,
    role TEXT NOT NULL DEFAULT 'reader' CHECK (role IN ('reader', 'sender', 'manager')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(shared_mailbox_id, person_id)
);

-- 4. Portal messages
CREATE TABLE IF NOT EXISTS mail.portal_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID,
    from_person_id UUID NOT NULL,
    from_context_type TEXT NOT NULL,
    to_person_id UUID NOT NULL,
    to_context_type TEXT NOT NULL,
    company_id UUID,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    body_text TEXT,
    is_read BOOLEAN DEFAULT false,
    is_starred BOOLEAN DEFAULT false,
    attachments JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_portal_msg_to ON mail.portal_messages(to_person_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_msg_from ON mail.portal_messages(from_person_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_msg_thread ON mail.portal_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_portal_msg_company ON mail.portal_messages(company_id);

-- 5. Enrich mailserver.accounts with org link
ALTER TABLE mailserver.accounts ADD COLUMN IF NOT EXISTS person_id UUID;
ALTER TABLE mailserver.accounts ADD COLUMN IF NOT EXISTS node_id UUID;
ALTER TABLE mailserver.accounts ADD COLUMN IF NOT EXISTS is_auto_provisioned BOOLEAN DEFAULT false;
ALTER TABLE mailserver.accounts ADD COLUMN IF NOT EXISTS naming_rule_id UUID REFERENCES mailserver.naming_rules(id);

-- 6. Enrich mailserver.aliases with auto flag
ALTER TABLE mailserver.aliases ADD COLUMN IF NOT EXISTS is_auto BOOLEAN DEFAULT false;
ALTER TABLE mailserver.aliases ADD COLUMN IF NOT EXISTS source_node_id UUID;
```

- [ ] **Step 2: Commit**

```bash
git add migrations/275_mail_org_aware.sql
git commit -m "feat(db): add naming_rules, distribution_lists, shared_mailboxes, portal_messages"
```

---

## Task 2: Backend Handlers — Naming Rules + Provisioning

**Files:**
- Create: `services/signapps-mail/src/handlers/naming_rules.rs`
- Create: `services/signapps-mail/src/handlers/provisioning.rs`
- Modify: `services/signapps-mail/src/handlers/mod.rs`
- Modify: `services/signapps-mail/src/api.rs`

- [ ] **Step 1: Create naming_rules.rs**

Read `services/signapps-mail/src/handlers/accounts.rs` first for the exact handler pattern (State, Claims, impl IntoResponse).

5 handlers:
- `list_naming_rules` — GET /api/v1/mailserver/naming-rules
- `create_naming_rule` — POST /api/v1/mailserver/naming-rules (body: node_id, pattern, domain_id, collision_strategy)
- `update_naming_rule` — PUT /api/v1/mailserver/naming-rules/:id
- `delete_naming_rule` — DELETE /api/v1/mailserver/naming-rules/:id
- `resolve_address` — GET /api/v1/mailserver/naming-rules/resolve/:person_id — walks up org_closure to find rule + domain, applies pattern, returns preview address

All use `#[tracing::instrument(skip_all)]`, `State(state): State<AppState>`, `Extension(claims): Extension<Claims>`, return `impl IntoResponse`.

- [ ] **Step 2: Create provisioning.rs**

3 handlers:
- `provision_person` — POST /api/v1/mailserver/provision/:person_id — resolves address, creates mailserver.accounts + default mailboxes + auto-aliases
- `preview_provision` — GET /api/v1/mailserver/provision/:person_id/preview — returns what address would be created without creating
- `bulk_provision` — POST /api/v1/mailserver/provision/bulk — provisions all employees without mailserver accounts

The provision logic:
1. Get person (first_name, last_name) from core.persons
2. Get primary assignment node_id from core.assignments
3. Walk up org_closure to find naming_rule (first node with rule wins)
4. Walk up to find domain_id (from the naming_rule or parent)
5. Generate local part from pattern: replace {first_name}, {last_name}, normalize (lowercase, remove accents)
6. Check collision in mailserver.accounts, apply strategy
7. INSERT into mailserver.accounts
8. Generate auto-aliases for descendant domains

- [ ] **Step 3: Register modules + routes**

Add `pub mod naming_rules;` and `pub mod provisioning;` to mod.rs.
Add routes to api.rs in the appropriate router section.

- [ ] **Step 4: Verify compilation**

Run: `cargo check -p signapps-mail`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add services/signapps-mail/src/handlers/naming_rules.rs \
       services/signapps-mail/src/handlers/provisioning.rs \
       services/signapps-mail/src/handlers/mod.rs \
       services/signapps-mail/src/api.rs
git commit -m "feat(mail): add naming rules + auto-provisioning handlers"
```

---

## Task 3: Backend Handlers — Distribution Lists + Shared Mailboxes + Portal Messages

**Files:**
- Create: `services/signapps-mail/src/handlers/distribution_lists.rs`
- Create: `services/signapps-mail/src/handlers/shared_mailboxes.rs`
- Create: `services/signapps-mail/src/handlers/portal_messages.rs`
- Modify: `services/signapps-mail/src/handlers/mod.rs`
- Modify: `services/signapps-mail/src/api.rs`

- [ ] **Step 1: Create distribution_lists.rs**

5 handlers:
- `list_distribution_lists` — GET /api/v1/mailserver/distribution-lists
- `create_distribution_list` — POST /api/v1/mailserver/distribution-lists (body: node_id, address, domain_id, description, allow_external)
- `get_distribution_list_members` — GET /api/v1/mailserver/distribution-lists/:id/members — resolves members dynamically via org_closure query
- `update_distribution_list` — PUT /api/v1/mailserver/distribution-lists/:id
- `delete_distribution_list` — DELETE /api/v1/mailserver/distribution-lists/:id

Member resolution query:
```sql
SELECT DISTINCT a.address, p.first_name, p.last_name
FROM mailserver.accounts a
JOIN core.persons p ON p.id = a.person_id
JOIN core.assignments ca ON ca.person_id = p.id
JOIN core.org_closure oc ON oc.descendant_id = ca.node_id
WHERE oc.ancestor_id = $node_id AND ca.end_date IS NULL AND a.is_active = true
```

- [ ] **Step 2: Create shared_mailboxes.rs**

7 handlers:
- `list_shared_mailboxes` — GET /api/v1/mailserver/shared-mailboxes
- `create_shared_mailbox` — POST /api/v1/mailserver/shared-mailboxes
- `get_shared_mailbox` — GET /api/v1/mailserver/shared-mailboxes/:id (includes members)
- `update_shared_mailbox` — PUT /api/v1/mailserver/shared-mailboxes/:id
- `delete_shared_mailbox` — DELETE /api/v1/mailserver/shared-mailboxes/:id
- `add_shared_mailbox_member` — POST /api/v1/mailserver/shared-mailboxes/:id/members
- `remove_shared_mailbox_member` — DELETE /api/v1/mailserver/shared-mailboxes/:id/members/:person_id

- [ ] **Step 3: Create portal_messages.rs**

6 handlers:
- `list_portal_messages` — GET /api/v1/mail/portal-messages (filtered by person_id from Claims + context)
- `send_portal_message` — POST /api/v1/mail/portal-messages (body: to_person_id, subject, body, attachments)
- `get_portal_message` — GET /api/v1/mail/portal-messages/:id
- `mark_read` — PUT /api/v1/mail/portal-messages/:id/read
- `get_thread` — GET /api/v1/mail/portal-messages/threads/:thread_id
- `unread_count` — GET /api/v1/mail/portal-messages/unread-count

Thread logic: first message in a conversation gets thread_id = its own id. Replies use the same thread_id.

- [ ] **Step 4: Register all modules + routes**

- [ ] **Step 5: Verify compilation + commit**

```bash
git add services/signapps-mail/src/handlers/distribution_lists.rs \
       services/signapps-mail/src/handlers/shared_mailboxes.rs \
       services/signapps-mail/src/handlers/portal_messages.rs \
       services/signapps-mail/src/handlers/mod.rs \
       services/signapps-mail/src/api.rs
git commit -m "feat(mail): add distribution lists, shared mailboxes, portal messages handlers"
```

---

## Task 4: Frontend API Client

**Files:**
- Create: `client/src/lib/api/mailserver.ts`

- [ ] **Step 1: Create API client**

```typescript
import { getClient, ServiceName } from "./factory";

const client = getClient(ServiceName.MAIL);

// Types
export interface NamingRule {
  id: string; node_id: string; pattern: string; domain_id?: string;
  collision_strategy: string; is_active: boolean; created_at: string;
}
export interface DistributionList {
  id: string; node_id: string; address: string; domain_id: string;
  description?: string; allow_external_senders: boolean; is_auto: boolean;
  is_active: boolean; created_at: string;
}
export interface DistListMember { address: string; first_name: string; last_name: string; }
export interface SharedMailbox {
  id: string; address: string; display_name: string; domain_id: string;
  description?: string; auto_reply_enabled: boolean; quota_bytes: number;
  is_active: boolean; created_at: string;
}
export interface SharedMailboxMember {
  id: string; shared_mailbox_id: string; person_id: string;
  role: "reader" | "sender" | "manager"; created_at: string;
}
export interface PortalMessage {
  id: string; thread_id?: string; from_person_id: string; from_context_type: string;
  to_person_id: string; to_context_type: string; company_id?: string;
  subject: string; body: string; is_read: boolean; is_starred: boolean;
  attachments: unknown[]; created_at: string; read_at?: string;
}
export interface AddressPreview { address: string; domain: string; pattern: string; rule_node: string; }

// API
export const namingRulesApi = {
  list: () => client.get<NamingRule[]>("/mailserver/naming-rules"),
  create: (data: Partial<NamingRule>) => client.post<NamingRule>("/mailserver/naming-rules", data),
  update: (id: string, data: Partial<NamingRule>) => client.put<NamingRule>(`/mailserver/naming-rules/${id}`, data),
  delete: (id: string) => client.delete(`/mailserver/naming-rules/${id}`),
  resolve: (personId: string) => client.get<AddressPreview>(`/mailserver/naming-rules/resolve/${personId}`),
};

export const distListsApi = {
  list: () => client.get<DistributionList[]>("/mailserver/distribution-lists"),
  create: (data: Partial<DistributionList>) => client.post<DistributionList>("/mailserver/distribution-lists", data),
  getMembers: (id: string) => client.get<DistListMember[]>(`/mailserver/distribution-lists/${id}/members`),
  update: (id: string, data: Partial<DistributionList>) => client.put(`/mailserver/distribution-lists/${id}`, data),
  delete: (id: string) => client.delete(`/mailserver/distribution-lists/${id}`),
};

export const sharedMailboxesApi = {
  list: () => client.get<SharedMailbox[]>("/mailserver/shared-mailboxes"),
  create: (data: Partial<SharedMailbox> & { members?: { person_id: string; role: string }[] }) => client.post<SharedMailbox>("/mailserver/shared-mailboxes", data),
  get: (id: string) => client.get<SharedMailbox & { members: SharedMailboxMember[] }>(`/mailserver/shared-mailboxes/${id}`),
  update: (id: string, data: Partial<SharedMailbox>) => client.put(`/mailserver/shared-mailboxes/${id}`, data),
  delete: (id: string) => client.delete(`/mailserver/shared-mailboxes/${id}`),
  addMember: (id: string, data: { person_id: string; role: string }) => client.post(`/mailserver/shared-mailboxes/${id}/members`, data),
  removeMember: (id: string, personId: string) => client.delete(`/mailserver/shared-mailboxes/${id}/members/${personId}`),
};

export const portalMessagesApi = {
  list: (params?: { unread_only?: boolean }) => client.get<PortalMessage[]>("/mail/portal-messages", { params }),
  send: (data: { to_person_id: string; subject: string; body: string; attachments?: unknown[] }) => client.post<PortalMessage>("/mail/portal-messages", data),
  get: (id: string) => client.get<PortalMessage>(`/mail/portal-messages/${id}`),
  markRead: (id: string) => client.put(`/mail/portal-messages/${id}/read`),
  getThread: (threadId: string) => client.get<PortalMessage[]>(`/mail/portal-messages/threads/${threadId}`),
  unreadCount: () => client.get<{ count: number }>("/mail/portal-messages/unread-count"),
};

export const provisioningApi = {
  provision: (personId: string) => client.post(`/mailserver/provision/${personId}`),
  preview: (personId: string) => client.get<AddressPreview>(`/mailserver/provision/${personId}/preview`),
  bulk: () => client.post("/mailserver/provision/bulk"),
};
```

- [ ] **Step 2: Commit**

```bash
git add client/src/lib/api/mailserver.ts
git commit -m "feat(frontend): add mailserver API client (naming rules, distlists, shared, portal, provisioning)"
```

---

## Task 5: Admin UI Enrichment + Portal Messages Page

**Files:**
- Modify: `client/src/app/admin/mail-server/page.tsx`
- Create: `client/src/app/portal/client/messages/page.tsx`
- Create: `client/src/app/portal/supplier/messages/page.tsx`

- [ ] **Step 1: Enrich admin mail-server page with 3 new tabs**

Add to the existing Tabs component in `/admin/mail-server`:

**Tab "Regles de nommage"**: Table of naming rules (node name, pattern, domain, collision strategy). Create/edit dialog. Preview button showing example address.

**Tab "Listes de distribution"**: Table of distribution lists (address, node, member count, auto/manual). Click → resolve members. Create dialog.

**Tab "Boites partagees"**: Table of shared mailboxes (address, display name, member count, quota). Click → member management (add/remove, role select). Create dialog.

Uses react-query with `namingRulesApi`, `distListsApi`, `sharedMailboxesApi`. Follow the existing tab pattern in the page.

- [ ] **Step 2: Create portal client messages page**

`client/src/app/portal/client/messages/page.tsx`: Simple message inbox for client portal users. Uses `portalMessagesApi`. Features: list messages, compose (to: account manager), thread view, mark as read, unread badge.

- [ ] **Step 3: Create portal supplier messages page**

Same as client but at `client/src/app/portal/supplier/messages/page.tsx`.

- [ ] **Step 4: Commit**

```bash
git add client/src/app/admin/mail-server/page.tsx \
       client/src/app/portal/client/messages/page.tsx \
       client/src/app/portal/supplier/messages/page.tsx
git commit -m "feat(mail-ui): add naming rules, distlists, shared mailbox admin tabs + portal messages"
```

---

## Task 6: E2E Tests

**Files:**
- Create: `client/e2e/mail-org-smoke.spec.ts`

- [ ] **Step 1: Create E2E spec**

```typescript
import { test, expect } from "./fixtures";

test.describe("Mail Org-Aware — smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login?auto=admin", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
  });

  test("admin mail-server page loads", async ({ page }) => {
    await page.goto("/admin/mail-server", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const heading = page.getByText(/serveur mail|mail server/i);
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
  });

  test("naming rules tab visible", async ({ page }) => {
    await page.goto("/admin/mail-server", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const tab = page.getByRole("tab", { name: /nommage|naming/i })
      .or(page.getByText(/regles de nommage/i));
    await expect(tab.first()).toBeVisible({ timeout: 10000 });
  });

  test("distribution lists tab visible", async ({ page }) => {
    await page.goto("/admin/mail-server", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const tab = page.getByRole("tab", { name: /distribution|listes/i })
      .or(page.getByText(/listes de distribution/i));
    await expect(tab.first()).toBeVisible({ timeout: 10000 });
  });

  test("shared mailboxes tab visible", async ({ page }) => {
    await page.goto("/admin/mail-server", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const tab = page.getByRole("tab", { name: /partagees|shared/i })
      .or(page.getByText(/boites partagees/i));
    await expect(tab.first()).toBeVisible({ timeout: 10000 });
  });

  test("portal client messages page loads", async ({ page }) => {
    await page.goto("/portal/client/messages", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const heading = page.getByText(/messages|messagerie/i);
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
  });

  test("portal supplier messages page loads", async ({ page }) => {
    await page.goto("/portal/supplier/messages", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const heading = page.getByText(/messages|messagerie/i);
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add client/e2e/mail-org-smoke.spec.ts
git commit -m "test(e2e): add mail org-aware smoke tests (7 tests)"
```

---

## Summary

| Task | Description | Files | Est. |
|------|-------------|-------|------|
| 1 | DB migration (6 tables + alters) | 1 SQL | 3 min |
| 2 | Naming rules + provisioning handlers (8 endpoints) | 4 files | 15 min |
| 3 | Distlists + shared mailboxes + portal msgs (18 endpoints) | 5 files | 15 min |
| 4 | Frontend API client | 1 file | 5 min |
| 5 | Admin UI tabs + portal message pages | 3 files | 15 min |
| 6 | E2E tests | 1 file | 3 min |
