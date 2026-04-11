# Seed Database v2 — Complete & Functional — Design Spec

## Summary

Refactor `signapps-seed` to produce complete, functional data across all 3 tenants (Acme Corp, Startup SAS, Chaos Industries). Fix all broken modules (calendar, projects, chaos), add 6 missing modules (drive, chat, billing, gamification, notifications, sharing), make admin a platform-level user who can switch tenants at login, and unify all calendar/task data on `scheduling.time_items`.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Calendar model | **`scheduling.time_items` only** | Unified model (migration 034), replaces fragmented `calendar.events`/`calendar.tasks`. Single source of truth for events, tasks, shifts, bookings, leave. |
| Admin user | **Platform-level, `tenant_id = NULL`** | Admin is created once, receives all tenants as login contexts via backend synthesis. `select-context` switches `tenant_id` dynamically. |
| Tenant completeness | **Mirror complet** | All 3 tenants get all data types (org, calendars, projects, mail, docs, drive, chat, billing, gamification, notifications, sharing) with volume proportional to user count. |
| Data realism | **Realistic data** | Credible names, dates, amounts, messages. Chaos tenant adds stress/edge cases on top. |

## Bug Fixes (Pre-requisites)

These bugs must be fixed before adding new modules:

### 1. `calendar.rs` — missing `tenant_id` binding

**File:** `tools/signapps-seed/src/calendar.rs`
**Problem:** INSERT into `scheduling.time_items` doesn't bind `tenant_id` → NOT NULL violation.
**Fix:** Add `.bind(tenant_id)` to all INSERT queries. Ensure SQL has `$N` placeholder for `tenant_id`.

### 2. `projects.rs` — fake `calendar_id` FK

**File:** `tools/signapps-seed/src/projects.rs`
**Problem:** Inserts into `calendar.tasks` with random UUIDs as `calendar_id` that don't exist in `calendar.calendars`.
**Fix:** Replace `calendar.tasks` inserts with `scheduling.time_items` inserts (`item_type = 'task'`). Create project calendars via `ensure_calendar()` first. Link tasks to projects via `project_id` column on `scheduling.time_items`.

### 3. `chaos.rs` — same FK violations + wrong table

**File:** `tools/signapps-seed/src/chaos.rs`
**Problem:** Same `calendar.tasks` FK issue. Also inserts events into `calendar.events` instead of `scheduling.time_items`.
**Fix:** Route all inserts through `scheduling.time_items`. Use `ensure_calendar()` for calendar pre-creation.

### 4. Admin user not platform-level

**Current:** Admin created in Acme tenant with `tenant_id = acme_id`.
**Fix:** After all 3 tenants are seeded in `seed_full()`, UPDATE admin's `tenant_id` to NULL. The backend already synthesizes tenant contexts for role >= 3 users with no login_contexts.

## Architecture

### Module Pattern

Every seed module exports a function per scenario:

```rust
// For Acme (full enterprise)
pub async fn seed_acme(pool: &PgPool, tenant_id: Uuid, user_ids: &[(Uuid, Uuid, String)]) -> Result<()>

// For Startup (small team)
pub async fn seed_startup(pool: &PgPool, tenant_id: Uuid, user_ids: &[(Uuid, Uuid, String)]) -> Result<()>

// For Chaos (stress test) — in chaos.rs
pub async fn seed_chaos_<module>(pool: &PgPool, tenant_id: Uuid, user_ids: &[Uuid]) -> Result<()>
```

Where `user_ids` is a vec of `(user_id, person_id, role_name)` triples (existing pattern from `users.rs`).

### Execution Order (per tenant)

```
1. tenants::seed_tenant()            → tenant_id
2. users::seed_*()                   → user_ids: Vec<(Uuid, Uuid, String)>
3. companies::seed_*()               → company context
4. org::seed_*()                     → org tree
5. calendars::seed_*()               → calendars + projects + time_items (events + tasks)
6. mail::seed_*()                    → accounts + emails
7. documents::seed_*()               → document files
8. drive::seed_*()                   → folder tree + files + ACLs
9. chat::seed_*()                    → channels + messages
10. billing::seed_*()                → plans + invoices + payments
11. gamification::seed_*()           → badges + XP + events
12. notifications::seed_*()          → notification items + preferences
13. sharing::seed_*()                → grants linking docs/drive/projects
```

### Full Mode Orchestration

```rust
async fn seed_full(pool: &PgPool) -> Result<()> {
    seed_acme(pool).await?;
    seed_startup(pool).await?;
    seed_chaos(pool).await?;

    // Make admin platform-level (no fixed tenant)
    sqlx::query("UPDATE identity.users SET tenant_id = NULL WHERE username = 'admin'")
        .execute(pool).await?;

    Ok(())
}
```

## Shared Helpers

### `ensure_calendar(pool, owner_id, tenant_id, name) -> Uuid`

Already exists in `chaos.rs`. Move to a shared `helpers.rs` module. Creates a `calendar.calendars` row if not exists, returns the `calendar_id`.

### `insert_time_item(pool, params) -> Uuid`

Shared helper for inserting into `scheduling.time_items` with all required fields:

```rust
struct TimeItemParams {
    tenant_id: Uuid,
    owner_id: Uuid,
    created_by: Uuid,
    item_type: &str,      // "event", "task", "leave", "shift", "booking"
    title: &str,
    start_time: Option<DateTime<Utc>>,
    end_time: Option<DateTime<Utc>>,
    all_day: bool,
    status: &str,          // "scheduled", "completed", "cancelled", "pending"
    priority: i16,         // 0=none, 1=low, 2=medium, 3=high, 4=urgent
    project_id: Option<Uuid>,
    calendar_id: Option<Uuid>,
}
```

## Module Specifications

### Module: `calendars.rs` (replaces broken `calendar.rs`)

Renamed to avoid confusion. Handles calendars, projects, and all time_items (events + tasks).

#### Acme Corp (80 users)

**Calendars:** 1 personal calendar per user (80 total).

**Projects (20):**
- Backend Refonte, Site Web v3, App Mobile, Migration Cloud, Refonte UX, API Gateway, Microservices, Data Pipeline, DevOps CI/CD, Sécurité Audit, Formation Interne, Recrutement Q2, Budget 2027, Partenariat TechSupply, Intégration ClientCo, Marketing Digital, Support Automatisation, Documentation Technique, Tests de Charge, Conformité RGPD

**Project members:** 2-8 members per project drawn from relevant org teams.

**Events (200 time_items, item_type='event'):**
- 50 recurring standups (daily 9h-9h15, Mon-Fri)
- 30 team meetings (weekly, per department)
- 20 1-on-1 manager meetings
- 30 project milestones (all_day events)
- 20 external meetings (with client/supplier contacts)
- 20 company events (all-hands, afterwork, formations)
- 15 leave requests (item_type='leave', status='approved'/'pending')
- 15 miscellaneous (interviews, demos, retrospectives)

**Tasks (500 time_items, item_type='task'):**
- Distributed across 20 projects (25 per project average)
- Status mix: 40% completed, 30% in_progress, 20% scheduled, 10% cancelled
- Priority mix: 10% urgent, 20% high, 40% medium, 30% low
- 70% have assignees (via `scheduling.time_item_users`)
- 30% have due dates

#### Startup SAS (15 users)

**Calendars:** 1 per user (15).
**Projects:** 3 (MVP Launch, Marketing Site, Seed Round).
**Events:** 30 (standups, weekly all-hands, demos).
**Tasks:** 50 across 3 projects.

#### Chaos Industries (20 users)

**Calendars:** 1 per user (20).
**Projects:** 1 mega-project with 2000 tasks.
**Events:** 500 with date chaos (epoch, far-future, inverted ranges).
**Tasks:** 2000 in single project (pagination stress).

### Module: `drive.rs` (NEW)

#### Tables: `drive.nodes`, `drive.acl`

#### Acme Corp

**Folder structure (5 root folders):**
```
/Documents Partagés
  /Projets
    /Backend Refonte (10 files)
    /Site Web v3 (8 files)
  /RH
    /Contrats (5 files)
    /Formations (3 files)
  /Finance
    /Factures 2026 (10 files)
  /Templates (5 files)
/Personnel/{username} (1 per user, 2-3 files each)
```

**Total:** ~100 files, 15 folders.
**ACLs:** Owner on personal folders, team-based ACL on shared folders.

#### Startup SAS

3 folders (Docs, Design, Admin), 15 files total.

#### Chaos Industries

50 files with chaos names (emoji, XSS, SQL injection, max-length).

### Module: `chat.rs` (NEW)

#### Tables: `chat.channels`, `chat.messages`

#### Acme Corp

**Channels (5):**
- #général (all users, 80 messages)
- #dev (backend+frontend+devops, 50 messages)
- #commercial (sales+marketing, 30 messages)
- #rh (HR team, 20 messages)
- #random (all users, 20 messages)

**Messages:** 200 total, realistic French conversations. Timestamps spread across last 30 days.

#### Startup SAS

2 channels (#général, #produit), 30 messages.

#### Chaos Industries

3 channels, messages with chaos content (emoji, injection attempts, max-length).

### Module: `billing.rs` (NEW)

#### Tables: `billing.plans`, `billing.invoices`, `billing.line_items`, `billing.payments`

#### Acme Corp

**Plans:** 3 (Starter, Business, Enterprise).
**Invoices (20):**
- 10 from TechSupply → Acme (supplier invoices, various statuses)
- 10 from Acme → ClientCo (client invoices)
- Status mix: 8 paid, 5 pending, 4 overdue, 3 draft
- Each invoice has 2-5 line items
- Paid invoices have matching payment records

#### Startup SAS

5 invoices (3 paid, 2 pending). 1 plan (Starter).

#### Chaos Industries

10 invoices with extreme amounts (0.01€, 999999.99€, negative, many decimals).

### Module: `gamification.rs` (NEW)

#### Tables: `gamification.badges`, `gamification.user_xp`, `gamification.xp_events`

#### Acme Corp

**Badges (15 types):**
- Premier Pas, Contributeur Actif, Maître du Code, Reviewer Expert, Marathonien, Mentor, Innovateur, Bug Hunter, Documentation Hero, Team Player, Early Bird, Night Owl, Streak Master, Top Reviewer, Légende

**User XP:** 80 users with XP ranging from 0 to 5000.
**XP Events:** 200 events (task_completed, review_done, badge_earned, streak_maintained).

#### Startup SAS

5 badges, modest XP per user.

#### Chaos Industries

Extreme XP values (0, MAX_INT), duplicate badge assignments.

### Module: `notifications.rs` (NEW)

#### Tables: `notifications.notifications`, `notifications.preferences`

#### Acme Corp

**Notifications (50):**
- Types: task_assigned, mention, calendar_invite, document_shared, chat_message, approval_required, system_alert
- 60% read, 40% unread
- Timestamps spread across last 7 days

**Preferences:** 1 per user with default notification settings.

#### Startup SAS

10 notifications, preferences for 15 users.

#### Chaos Industries

100 notifications (stress rendering), edge case types.

### Module: `sharing.rs` (NEW)

#### Tables: `sharing.grants`, `sharing.policies`

#### Acme Corp

**Grants (30):**
- 10 document shares (user → user, with view/edit permissions)
- 10 drive folder shares (user → group/team)
- 5 project shares (cross-team access)
- 5 calendar shares (manager visibility on team calendars)

**Policies:** 3 (default deny, team-open, public-read).

#### Startup SAS

5 grants (everything shared with everyone — flat org).

#### Chaos Industries

Edge cases: cross-tenant grant attempt (should be blocked by FK), circular grants, expired grants.

## Reset v2

Truncate list (dependency order, leaf → root):

```
-- New modules
sharing.grants, sharing.policies
notifications.notifications, notifications.preferences
gamification.xp_events, gamification.user_xp, gamification.badges
billing.payments, billing.line_items, billing.invoices, billing.plans
chat.messages, chat.channels
drive.acl, drive.nodes
-- Existing (fixed order)
scheduling.time_items, scheduling.time_item_users, scheduling.time_item_groups
calendar.project_members, calendar.projects, calendar.calendars
mail.emails, mail.attachments, mail.accounts, mail.folders, mail.labels
documents.files
core.org_closure, core.assignments, core.org_nodes, core.org_trees
core.person_companies, identity.login_contexts
core.persons, core.companies
identity.users, identity.tenants
```

## Verify v2

### All modes (baseline)

```
identity.tenants >= 1
identity.users >= 5
core.persons >= 5
```

### Full mode

```
identity.tenants >= 3
identity.users >= 115          (80 + 15 + 20 + 1 admin)
core.persons >= 115
core.org_nodes >= 30           (28 Acme + 1 Startup root + 1 Chaos root)
scheduling.time_items >= 2800  (700 Acme + 80 Startup + 2500 Chaos)
calendar.projects >= 24        (20 + 3 + 1)
mail.accounts >= 95            (80 + 15)
drive.nodes >= 130             (115 Acme + 18 Startup)
chat.channels >= 10            (5 + 2 + 3)
chat.messages >= 260           (200 + 30 + 30)
billing.invoices >= 35         (20 + 5 + 10)
gamification.badges >= 15
notifications.notifications >= 160  (50 + 10 + 100)
sharing.grants >= 35           (30 + 5)
```

### Integrity checks

```
-- No orphaned time_items (owner must exist)
SELECT COUNT(*) FROM scheduling.time_items t
  LEFT JOIN identity.users u ON u.id = t.owner_id
  WHERE u.id IS NULL
  → must be 0 (except chaos ghost_user fixture)

-- No cross-tenant leaks
SELECT COUNT(*) FROM scheduling.time_items t
  JOIN calendar.projects p ON p.id = t.project_id
  WHERE t.tenant_id != p.tenant_id
  → must be 0

-- Admin user has NULL tenant_id (platform-level)
SELECT tenant_id FROM identity.users WHERE username = 'admin'
  → must be NULL
```

## Data Volumes Summary

| Domain | Acme (80) | Startup (15) | Chaos (20) | Total |
|--------|-----------|-------------|------------|-------|
| Users | 80 | 15 | 20 | 116 (+ admin) |
| Persons | 83 (+ supplier/client contacts) | 15 | 20 | 118+ |
| Companies | 4 | 1 | 2 | 7 |
| Org nodes | 28 | 1 | 126 (25 deep + 100 wide + root) | 155 |
| Calendars | 80 | 15 | 20 | 115 |
| Projects | 20 | 3 | 1 | 24 |
| Time items (events) | 200 | 30 | 500 | 730 |
| Time items (tasks) | 500 | 50 | 2000 | 2550 |
| Mail accounts | 80 | 15 | 0 | 95 |
| Emails | 100 | 20 | 50 | 170 |
| Documents | 50 | 10 | 20 | 80 |
| Drive nodes | 115 | 18 | 50 | 183 |
| Chat channels | 5 | 2 | 3 | 10 |
| Chat messages | 200 | 30 | 30 | 260 |
| Invoices | 20 | 5 | 10 | 35 |
| Badges | 15 | 5 | 15 | 15 (shared) |
| XP events | 200 | 30 | 50 | 280 |
| Notifications | 50 | 10 | 100 | 160 |
| Sharing grants | 30 | 5 | 10 | 45 |

**Grand total:** ~5000+ rows across all tables.

## Files to Create/Modify

### New files
- `tools/signapps-seed/src/helpers.rs` — shared `ensure_calendar()`, `insert_time_item()`, tenant helpers
- `tools/signapps-seed/src/drive.rs` — drive folder/file seeder
- `tools/signapps-seed/src/chat.rs` — chat channel/message seeder
- `tools/signapps-seed/src/billing.rs` — invoice/payment seeder
- `tools/signapps-seed/src/gamification.rs` — badges/XP seeder
- `tools/signapps-seed/src/notifications.rs` — notification seeder
- `tools/signapps-seed/src/sharing.rs` — sharing grant seeder

### Modified files
- `tools/signapps-seed/src/main.rs` — add new modules, fix orchestration, admin platform-level
- `tools/signapps-seed/src/calendar.rs` → rename to `calendars.rs`, rewrite to use `scheduling.time_items`
- `tools/signapps-seed/src/projects.rs` — merge into `calendars.rs` (projects + tasks are calendar domain)
- `tools/signapps-seed/src/org.rs` — add `seed_startup()` and chaos org already exists
- `tools/signapps-seed/src/chaos.rs` — refactor to use helpers, fix all FK violations
- `tools/signapps-seed/src/verify.rs` — add all new assertions
- `tools/signapps-seed/src/users.rs` — ensure admin password consistent
