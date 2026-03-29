# Unified Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the dual calendar/scheduler systems into a single unified calendar service with layers, 11 views, HR presence/leave management, and auto-generated timesheets.

**Architecture:** Extend `signapps-calendar` (port 3011) backend with new event types, presence rules, leave balances, timesheets, and categories. Absorb signapps-scheduler's CRON jobs. On frontend, unify under a single Zustand store and API client, merge best-of-both view components, add 2 new views (Availability, Presence Table with step-chart). Layer system provides superposable context filtering.

**Tech Stack:** Rust (Axum/Tokio), PostgreSQL, Next.js 16, React 19, Zustand, Tailwind CSS 4, shadcn/ui, Recharts (step-chart)

**Spec:** `docs/superpowers/specs/2026-03-30-unified-calendar-design.md`

---

## Sub-Project Overview

| # | Sub-Project | Depends On | Tasks |
|---|-------------|------------|-------|
| P1 | DB Migration — extend events + new tables | — | 1-2 |
| P2 | Backend — leave, presence, categories, timesheets, approval handlers | P1 | 3-8 |
| P3 | Backend — absorb CRON from scheduler, deprecate scheduling schema | P2 | 9-10 |
| P4 | Frontend — unified store + API client | P2 | 11-12 |
| P5 | Frontend — layers system | P4 | 13-14 |
| P6 | Frontend — migrate views from scheduling/ to calendar/ | P4 | 15-16 |
| P7 | Frontend — new views (Availability, Presence Table + step-chart) | P5, P6 | 17-18 |
| P8 | Frontend — leave + presence RH flows | P2, P5 | 19-21 |
| P9 | Frontend — timesheets | P2, P5 | 22-23 |
| P10 | Cleanup — delete duplicates, redirect pages | P6-P9 | 24-25 |

---

## P1: Database Migration

### Task 1: Extend calendar.events with unified fields

**Files:**
- Create: `migrations/093_calendar_unified_event_types.sql`
- Modify: `crates/signapps-db/src/models/calendar.rs`

- [ ] **Step 1: Write the migration SQL**

```sql
-- migrations/093_calendar_unified_event_types.sql
-- Extend calendar.events to support unified event types

-- Add event_type enum
DO $$ BEGIN
    CREATE TYPE calendar.event_type AS ENUM ('event', 'task', 'leave', 'shift', 'booking', 'milestone', 'blocker', 'cron');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE calendar.event_scope AS ENUM ('personal', 'team', 'org');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE calendar.event_status AS ENUM ('draft', 'pending', 'approved', 'rejected', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE calendar.event_priority AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE calendar.leave_type AS ENUM ('cp', 'rtt', 'sick', 'unpaid', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE calendar.presence_mode AS ENUM ('office', 'remote', 'absent');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE calendar.energy_level AS ENUM ('low', 'medium', 'high');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Extend events table
ALTER TABLE calendar.events
    ADD COLUMN IF NOT EXISTS event_type calendar.event_type DEFAULT 'event',
    ADD COLUMN IF NOT EXISTS scope calendar.event_scope DEFAULT 'personal',
    ADD COLUMN IF NOT EXISTS status calendar.event_status DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS priority calendar.event_priority DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS parent_event_id UUID REFERENCES calendar.events(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS resource_id UUID REFERENCES calendar.resources(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS category_id UUID,
    ADD COLUMN IF NOT EXISTS leave_type calendar.leave_type DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS presence_mode calendar.presence_mode DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS approval_by UUID REFERENCES identity.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS approval_comment TEXT,
    ADD COLUMN IF NOT EXISTS energy_level calendar.energy_level DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS cron_expression TEXT,
    ADD COLUMN IF NOT EXISTS cron_target TEXT,
    ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES identity.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS project_id UUID,
    ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Indexes for new fields
CREATE INDEX IF NOT EXISTS idx_events_event_type ON calendar.events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_scope ON calendar.events(scope);
CREATE INDEX IF NOT EXISTS idx_events_status ON calendar.events(status);
CREATE INDEX IF NOT EXISTS idx_events_leave_type ON calendar.events(leave_type) WHERE event_type = 'leave';
CREATE INDEX IF NOT EXISTS idx_events_assigned_to ON calendar.events(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_resource_id ON calendar.events(resource_id) WHERE resource_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_category_id ON calendar.events(category_id) WHERE category_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_parent ON calendar.events(parent_event_id) WHERE parent_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_project ON calendar.events(project_id) WHERE project_id IS NOT NULL;
```

- [ ] **Step 2: Update the Rust Event model**

Add new fields to the `Event` struct in `crates/signapps-db/src/models/calendar.rs`:

```rust
// Add to Event struct (after existing fields):
pub event_type: Option<String>,     // 'event','task','leave','shift','booking','milestone','blocker','cron'
pub scope: Option<String>,          // 'personal','team','org'
pub status: Option<String>,         // 'draft','pending','approved','rejected','completed'
pub priority: Option<String>,       // 'low','medium','high','urgent'
pub parent_event_id: Option<Uuid>,
pub resource_id: Option<Uuid>,
pub category_id: Option<Uuid>,
pub leave_type: Option<String>,     // 'cp','rtt','sick','unpaid','other'
pub presence_mode: Option<String>,  // 'office','remote','absent'
pub approval_by: Option<Uuid>,
pub approval_comment: Option<String>,
pub energy_level: Option<String>,   // 'low','medium','high'
pub cron_expression: Option<String>,
pub cron_target: Option<String>,
pub assigned_to: Option<Uuid>,
pub project_id: Option<Uuid>,
pub tags: Option<Vec<String>>,
```

- [ ] **Step 3: Update repository queries**

Modify `crates/signapps-db/src/repositories/calendar_repository.rs` — update `create_event`, `update_event`, `get_event`, and `list_events` to include new columns. Follow the existing pattern (sqlx::query_as with named parameters).

- [ ] **Step 4: Test migration**

```bash
cd /c/Prog/signapps-platform
# Run migration against local DB
psql $DATABASE_URL -f migrations/093_calendar_unified_event_types.sql
```

Expected: No errors, new columns visible in `\d calendar.events`.

- [ ] **Step 5: Commit**

```bash
git add migrations/093_calendar_unified_event_types.sql crates/signapps-db/src/models/calendar.rs crates/signapps-db/src/repositories/calendar_repository.rs
git commit -m "feat: extend calendar.events with unified event types (leave, shift, booking, cron, etc.)"
```

---

### Task 2: Create new tables (categories, presence_rules, leave_balances, timesheets, approval_workflows)

**Files:**
- Create: `migrations/094_calendar_hr_tables.sql`
- Modify: `crates/signapps-db/src/models/calendar.rs`

- [ ] **Step 1: Write the migration SQL**

```sql
-- migrations/094_calendar_hr_tables.sql
-- HR tables: categories, presence rules, leave balances, timesheets, approval workflows

-- Categories (custom labels with rules)
CREATE TABLE IF NOT EXISTS calendar.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    color VARCHAR(7) NOT NULL DEFAULT '#6b7280',
    icon VARCHAR(64),
    owner_id UUID REFERENCES identity.users(id) ON DELETE CASCADE,
    org_id UUID,
    rules JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_owner ON calendar.categories(owner_id);
CREATE INDEX IF NOT EXISTS idx_categories_org ON calendar.categories(org_id) WHERE org_id IS NOT NULL;

-- Add FK from events to categories (deferred since table didn't exist at migration 093 time)
ALTER TABLE calendar.events
    ADD CONSTRAINT fk_events_category FOREIGN KEY (category_id) REFERENCES calendar.categories(id) ON DELETE SET NULL;

-- Presence rules
DO $$ BEGIN
    CREATE TYPE calendar.rule_type AS ENUM ('min_onsite', 'mandatory_days', 'max_remote_same_day', 'min_coverage');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE calendar.enforcement_level AS ENUM ('soft', 'hard');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS calendar.presence_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    team_id UUID,
    rule_type calendar.rule_type NOT NULL,
    rule_config JSONB NOT NULL DEFAULT '{}',
    enforcement calendar.enforcement_level DEFAULT 'soft',
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_presence_rules_org ON calendar.presence_rules(org_id);
CREATE INDEX IF NOT EXISTS idx_presence_rules_team ON calendar.presence_rules(team_id) WHERE team_id IS NOT NULL;

-- Leave balances
CREATE TABLE IF NOT EXISTS calendar.leave_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    leave_type calendar.leave_type NOT NULL,
    year INT NOT NULL,
    total_days DECIMAL(5,2) NOT NULL DEFAULT 0,
    used_days DECIMAL(5,2) NOT NULL DEFAULT 0,
    pending_days DECIMAL(5,2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, leave_type, year)
);

CREATE INDEX IF NOT EXISTS idx_leave_balances_user_year ON calendar.leave_balances(user_id, year);

-- Timesheet entries
CREATE TABLE IF NOT EXISTS calendar.timesheet_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    event_id UUID REFERENCES calendar.events(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    hours DECIMAL(5,2) NOT NULL DEFAULT 0,
    category_id UUID REFERENCES calendar.categories(id) ON DELETE SET NULL,
    auto_generated BOOLEAN DEFAULT TRUE,
    validated BOOLEAN DEFAULT FALSE,
    validated_at TIMESTAMPTZ,
    exported_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_timesheet_user_date ON calendar.timesheet_entries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_timesheet_event ON calendar.timesheet_entries(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_timesheet_validated ON calendar.timesheet_entries(validated) WHERE validated = FALSE;

-- Approval workflows
CREATE TABLE IF NOT EXISTS calendar.approval_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    trigger_type VARCHAR(64) NOT NULL,
    trigger_config JSONB NOT NULL DEFAULT '{}',
    approvers JSONB NOT NULL DEFAULT '[]',
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_workflows_org ON calendar.approval_workflows(org_id);

-- Updated_at triggers
CREATE OR REPLACE FUNCTION calendar.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
    FOR t IN SELECT unnest(ARRAY['categories', 'presence_rules', 'leave_balances', 'timesheet_entries', 'approval_workflows'])
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON calendar.%s', t, t);
        EXECUTE format('CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON calendar.%s FOR EACH ROW EXECUTE FUNCTION calendar.update_updated_at()', t, t);
    END LOOP;
END $$;
```

- [ ] **Step 2: Add Rust models for new tables**

Add to `crates/signapps-db/src/models/calendar.rs`:

```rust
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Category {
    pub id: Uuid,
    pub name: String,
    pub color: String,
    pub icon: Option<String>,
    pub owner_id: Option<Uuid>,
    pub org_id: Option<Uuid>,
    pub rules: Option<serde_json::Value>,
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
    pub updated_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PresenceRule {
    pub id: Uuid,
    pub org_id: Uuid,
    pub team_id: Option<Uuid>,
    pub rule_type: String,
    pub rule_config: serde_json::Value,
    pub enforcement: Option<String>,
    pub active: Option<bool>,
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
    pub updated_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LeaveBalance {
    pub id: Uuid,
    pub user_id: Uuid,
    pub leave_type: String,
    pub year: i32,
    pub total_days: rust_decimal::Decimal,
    pub used_days: rust_decimal::Decimal,
    pub pending_days: rust_decimal::Decimal,
    pub updated_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct TimesheetEntry {
    pub id: Uuid,
    pub user_id: Uuid,
    pub event_id: Option<Uuid>,
    pub date: chrono::NaiveDate,
    pub hours: rust_decimal::Decimal,
    pub category_id: Option<Uuid>,
    pub auto_generated: Option<bool>,
    pub validated: Option<bool>,
    pub validated_at: Option<chrono::DateTime<chrono::Utc>>,
    pub exported_at: Option<chrono::DateTime<chrono::Utc>>,
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
    pub updated_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ApprovalWorkflow {
    pub id: Uuid,
    pub org_id: Uuid,
    pub trigger_type: String,
    pub trigger_config: serde_json::Value,
    pub approvers: serde_json::Value,
    pub active: Option<bool>,
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
    pub updated_at: Option<chrono::DateTime<chrono::Utc>>,
}
```

- [ ] **Step 3: Add repository methods for new tables**

Create `crates/signapps-db/src/repositories/calendar_hr_repository.rs` with CRUD methods for categories, presence_rules, leave_balances, timesheet_entries, approval_workflows. Follow the pattern from `calendar_repository.rs`.

- [ ] **Step 4: Register module in lib.rs**

Add `pub mod calendar_hr_repository;` to `crates/signapps-db/src/repositories/mod.rs`.

- [ ] **Step 5: Test migration**

```bash
psql $DATABASE_URL -f migrations/094_calendar_hr_tables.sql
```

- [ ] **Step 6: Build check**

```bash
cargo check -p signapps-db
```

- [ ] **Step 7: Commit**

```bash
git add migrations/094_calendar_hr_tables.sql crates/signapps-db/src/models/calendar.rs crates/signapps-db/src/repositories/calendar_hr_repository.rs crates/signapps-db/src/repositories/mod.rs
git commit -m "feat: add calendar HR tables (categories, presence rules, leave balances, timesheets, approval workflows)"
```

---

## P2: Backend Handlers

### Task 3: Leave management handlers

**Files:**
- Create: `services/signapps-calendar/src/handlers/leave.rs`
- Modify: `services/signapps-calendar/src/main.rs` (add routes)

- [ ] **Step 1: Create leave handler**

Endpoints:
- `PUT /api/v1/events/:id/approve` — approve leave (sets status=approved, updates leave_balances)
- `PUT /api/v1/events/:id/reject` — reject leave (sets status=rejected, adds approval_comment)
- `GET /api/v1/leave/balances` — list leave balances for current user
- `GET /api/v1/leave/balances/predict` — predict balance at future date
- `GET /api/v1/leave/team-conflicts` — check team conflicts for a date range
- `POST /api/v1/leave/delegate` — reassign tasks during leave period

Follow the pattern from existing `handlers/events.rs`. Each handler extracts `Claims` from auth middleware, uses `PgPool` from state, calls repository methods.

- [ ] **Step 2: Register routes in main.rs**

```rust
// In main.rs router setup, add:
.route("/api/v1/events/:id/approve", put(leave::approve_leave))
.route("/api/v1/events/:id/reject", put(leave::reject_leave))
.route("/api/v1/leave/balances", get(leave::get_balances))
.route("/api/v1/leave/balances/predict", get(leave::predict_balance))
.route("/api/v1/leave/team-conflicts", get(leave::team_conflicts))
.route("/api/v1/leave/delegate", post(leave::delegate_tasks))
```

- [ ] **Step 3: Build and test**

```bash
cargo check -p signapps-calendar
```

- [ ] **Step 4: Commit**

```bash
git add services/signapps-calendar/src/handlers/leave.rs services/signapps-calendar/src/main.rs
git commit -m "feat: add leave management handlers (approve, reject, balances, predict, conflicts, delegate)"
```

---

### Task 4: Presence management handlers

**Files:**
- Create: `services/signapps-calendar/src/handlers/presence.rs`
- Modify: `services/signapps-calendar/src/main.rs`

- [ ] **Step 1: Create presence handler**

Endpoints:
- `GET /api/v1/presence/rules` — list presence rules for user's team/org
- `POST /api/v1/presence/rules` — create rule (admin only)
- `PUT /api/v1/presence/rules/:id` — update rule
- `DELETE /api/v1/presence/rules/:id` — delete rule
- `POST /api/v1/presence/validate` — check if an action violates rules (accepts event_type, date range, presence_mode; returns violations list)
- `GET /api/v1/presence/team-status` — team presence status for a date (who is office/remote/absent)
- `GET /api/v1/presence/headcount` — headcount data for step-chart (accepts date, team_id; returns array of `{time, role, count}`)

- [ ] **Step 2: Register routes**

- [ ] **Step 3: Build check**

```bash
cargo check -p signapps-calendar
```

- [ ] **Step 4: Commit**

```bash
git add services/signapps-calendar/src/handlers/presence.rs services/signapps-calendar/src/main.rs
git commit -m "feat: add presence management handlers (rules, validate, team-status, headcount)"
```

---

### Task 5: Categories handlers

**Files:**
- Create: `services/signapps-calendar/src/handlers/categories.rs`
- Modify: `services/signapps-calendar/src/main.rs`

- [ ] **Step 1: Create categories handler**

Endpoints:
- `GET /api/v1/categories` — list categories (own + org)
- `POST /api/v1/categories` — create category
- `PUT /api/v1/categories/:id` — update category
- `DELETE /api/v1/categories/:id` — delete category

- [ ] **Step 2: Register routes, build, commit**

```bash
git commit -m "feat: add category CRUD handlers"
```

---

### Task 6: Timesheet handlers

**Files:**
- Create: `services/signapps-calendar/src/handlers/timesheets.rs`
- Modify: `services/signapps-calendar/src/main.rs`

- [ ] **Step 1: Create timesheets handler**

Endpoints:
- `GET /api/v1/timesheets` — list entries (filter by user_id, week, month)
- `PUT /api/v1/timesheets/:id` — update entry (manual correction)
- `POST /api/v1/timesheets/validate` — validate week (sets validated=true for all entries of the week)
- `POST /api/v1/timesheets/export` — export validated entries (marks exported_at, returns CSV)
- `POST /api/v1/timesheets/generate` — trigger auto-generation from events for a date range

The generate endpoint queries all events (shifts, bookings, tasks with duration) for the user in the date range and creates/updates timesheet_entries with `auto_generated=true`.

- [ ] **Step 2: Register routes, build, commit**

```bash
git commit -m "feat: add timesheet handlers (list, update, validate, export, generate)"
```

---

### Task 7: Approval workflow handlers

**Files:**
- Create: `services/signapps-calendar/src/handlers/approval.rs`
- Modify: `services/signapps-calendar/src/main.rs`

- [ ] **Step 1: Create approval handler**

Endpoints:
- `GET /api/v1/approval-workflows` — list workflows for org
- `POST /api/v1/approval-workflows` — create workflow
- `PUT /api/v1/approval-workflows/:id` — update workflow
- `DELETE /api/v1/approval-workflows/:id` — delete workflow

The actual approval cascade logic lives in the `leave::approve_leave` handler (Task 3) — it checks applicable workflows and routes to next approver if needed.

- [ ] **Step 2: Register routes, build, commit**

```bash
git commit -m "feat: add approval workflow CRUD handlers"
```

---

### Task 8: Layers config handler

**Files:**
- Modify: `services/signapps-calendar/src/handlers/calendars.rs` (or create `layers.rs`)

- [ ] **Step 1: Add layer config endpoints**

Endpoints:
- `GET /api/v1/layers/config` — get user's layer configuration
- `PUT /api/v1/layers/config` — save user's layer configuration

Stored in `calendar.event_metadata` with key `layer_config` or as a simple JSON column on a user preferences table. The payload is a JSON array of `{layer_id, enabled, opacity, color_override}`.

- [ ] **Step 2: Build, commit**

```bash
git commit -m "feat: add layers config persistence endpoint"
```

---

## P3: Scheduler Absorption

### Task 9: Migrate CRON job execution to calendar service

**Files:**
- Create: `services/signapps-calendar/src/handlers/cron_jobs.rs`
- Copy logic from: `services/signapps-scheduler/src/handlers/jobs.rs`
- Modify: `services/signapps-calendar/src/main.rs`

- [ ] **Step 1: Create cron_jobs handler**

Copy the CRON job execution logic from `services/signapps-scheduler/src/handlers/jobs.rs` into a new handler in signapps-calendar. CRON jobs are now `calendar.events` with `event_type='cron'`.

Endpoints:
- `GET /api/v1/cron-jobs` — list cron events
- `POST /api/v1/cron-jobs` — create cron event
- `PUT /api/v1/cron-jobs/:id` — update cron event
- `DELETE /api/v1/cron-jobs/:id` — delete cron event
- `POST /api/v1/cron-jobs/:id/run` — execute immediately

- [ ] **Step 2: Add background CRON executor**

Add a tokio::spawn task in main.rs that ticks every minute, queries events with `event_type='cron'` and matching cron_expression, and executes them.

- [ ] **Step 3: Build, commit**

```bash
git commit -m "feat: absorb CRON job execution into calendar service"
```

---

### Task 10: Write data migration + deprecate scheduling schema

**Files:**
- Create: `migrations/095_migrate_scheduling_to_calendar.sql`

- [ ] **Step 1: Write migration script**

```sql
-- migrations/095_migrate_scheduling_to_calendar.sql
-- Migrate data from scheduling.time_items → calendar.events
-- Then mark scheduling schema as deprecated

-- Create a default calendar for orphan items
INSERT INTO calendar.calendars (id, owner_id, name, description)
SELECT DISTINCT owner_id, owner_id, 'Imported from Scheduler', 'Auto-migrated time items'
FROM scheduling.time_items
WHERE owner_id NOT IN (SELECT owner_id FROM calendar.calendars)
ON CONFLICT DO NOTHING;

-- Migrate time_items → events
INSERT INTO calendar.events (
    id, calendar_id, title, description, location,
    start_time, end_time, rrule, timezone, created_by,
    is_all_day, event_type, scope, status, priority,
    parent_event_id, resource_id, assigned_to, project_id, tags,
    created_at, updated_at
)
SELECT
    ti.id,
    (SELECT c.id FROM calendar.calendars c WHERE c.owner_id = ti.owner_id LIMIT 1),
    ti.title,
    ti.description,
    ti.location_name,
    COALESCE(ti.start_time, NOW()),
    COALESCE(ti.end_time, COALESCE(ti.start_time, NOW()) + INTERVAL '1 hour'),
    NULL, -- rrule migrated separately from scheduling.recurrence_rules
    ti.timezone,
    ti.created_by,
    ti.all_day,
    ti.item_type::text::calendar.event_type,
    CASE ti.scope WHEN 'moi' THEN 'personal' WHEN 'eux' THEN 'team' WHEN 'nous' THEN 'org' ELSE 'personal' END::calendar.event_scope,
    CASE ti.status WHEN 'todo' THEN 'draft' WHEN 'in_progress' THEN 'draft' WHEN 'done' THEN 'completed' WHEN 'cancelled' THEN 'rejected' WHEN 'pending' THEN 'pending' WHEN 'confirmed' THEN 'approved' ELSE NULL END::calendar.event_status,
    ti.priority::text::calendar.event_priority,
    ti.parent_id,
    ti.resource_id,
    NULL, -- assigned_to not in time_items
    ti.project_id,
    ti.tags,
    ti.created_at,
    ti.updated_at
FROM scheduling.time_items ti
WHERE ti.deleted_at IS NULL
ON CONFLICT (id) DO NOTHING;

-- Migrate scheduling.resources → calendar.resources (deduplicate by name)
INSERT INTO calendar.resources (id, name, resource_type, description, capacity, location, is_available, created_at, updated_at)
SELECT id, name, resource_type, description, capacity, location, is_active, created_at, updated_at
FROM scheduling.resources
WHERE name NOT IN (SELECT name FROM calendar.resources)
ON CONFLICT DO NOTHING;

-- Migrate time_item_users → event_attendees
INSERT INTO calendar.event_attendees (id, event_id, user_id, rsvp_status, response_date, created_at)
SELECT id, time_item_id, user_id, rsvp_status, rsvp_at, created_at
FROM scheduling.time_item_users
ON CONFLICT DO NOTHING;

-- Add deprecation comment
COMMENT ON SCHEMA scheduling IS 'DEPRECATED: migrated to calendar schema in migration 095. Do not use.';
```

- [ ] **Step 2: Remove signapps-scheduler from workspace**

Remove `signapps-scheduler` from `Cargo.toml` workspace members. Remove from `scripts/start-all.ps1` and `scripts/start-all.sh`.

- [ ] **Step 3: Test migration, commit**

```bash
git commit -m "feat: migrate scheduling data to calendar, deprecate scheduler service"
```

---

## P4: Frontend — Unified Store + API

### Task 11: Create unified calendar API client

**Files:**
- Modify: `client/src/lib/api/calendar.ts`

- [ ] **Step 1: Add new API methods**

Add to the existing `calendarApi` object in `client/src/lib/api/calendar.ts`:

```typescript
// Leave management
leave: {
  approve: (eventId: string, comment?: string) =>
    api.put(`${CALENDAR_URL}/events/${eventId}/approve`, { comment }),
  reject: (eventId: string, comment: string) =>
    api.put(`${CALENDAR_URL}/events/${eventId}/reject`, { comment }),
  balances: () =>
    api.get(`${CALENDAR_URL}/leave/balances`),
  predict: (days: number, date: string) =>
    api.get(`${CALENDAR_URL}/leave/balances/predict`, { params: { days, date } }),
  teamConflicts: (start: string, end: string) =>
    api.get(`${CALENDAR_URL}/leave/team-conflicts`, { params: { start, end } }),
  delegate: (eventId: string, assignments: Array<{ taskId: string; assignTo: string }>) =>
    api.post(`${CALENDAR_URL}/leave/delegate`, { event_id: eventId, assignments }),
},

// Presence
presence: {
  rules: () => api.get(`${CALENDAR_URL}/presence/rules`),
  createRule: (rule: CreatePresenceRule) => api.post(`${CALENDAR_URL}/presence/rules`, rule),
  updateRule: (id: string, rule: Partial<CreatePresenceRule>) => api.put(`${CALENDAR_URL}/presence/rules/${id}`, rule),
  deleteRule: (id: string) => api.delete(`${CALENDAR_URL}/presence/rules/${id}`),
  validate: (action: PresenceValidation) => api.post(`${CALENDAR_URL}/presence/validate`, action),
  teamStatus: (date: string) => api.get(`${CALENDAR_URL}/presence/team-status`, { params: { date } }),
  headcount: (date: string, teamId?: string) => api.get(`${CALENDAR_URL}/presence/headcount`, { params: { date, team_id: teamId } }),
},

// Categories
categories: {
  list: () => api.get(`${CALENDAR_URL}/categories`),
  create: (cat: CreateCategory) => api.post(`${CALENDAR_URL}/categories`, cat),
  update: (id: string, cat: Partial<CreateCategory>) => api.put(`${CALENDAR_URL}/categories/${id}`, cat),
  delete: (id: string) => api.delete(`${CALENDAR_URL}/categories/${id}`),
},

// Timesheets
timesheets: {
  list: (params: { user_id?: string; week?: string; month?: string }) =>
    api.get(`${CALENDAR_URL}/timesheets`, { params }),
  update: (id: string, data: Partial<TimesheetEntry>) =>
    api.put(`${CALENDAR_URL}/timesheets/${id}`, data),
  validate: (week: string) =>
    api.post(`${CALENDAR_URL}/timesheets/validate`, { week }),
  export: (params: { start: string; end: string }) =>
    api.post(`${CALENDAR_URL}/timesheets/export`, params),
  generate: (params: { start: string; end: string }) =>
    api.post(`${CALENDAR_URL}/timesheets/generate`, params),
},

// Approval workflows
approvalWorkflows: {
  list: () => api.get(`${CALENDAR_URL}/approval-workflows`),
  create: (wf: CreateApprovalWorkflow) => api.post(`${CALENDAR_URL}/approval-workflows`, wf),
  update: (id: string, wf: Partial<CreateApprovalWorkflow>) => api.put(`${CALENDAR_URL}/approval-workflows/${id}`, wf),
  delete: (id: string) => api.delete(`${CALENDAR_URL}/approval-workflows/${id}`),
},

// Layers config
layers: {
  getConfig: () => api.get(`${CALENDAR_URL}/layers/config`),
  saveConfig: (config: LayerConfig[]) => api.put(`${CALENDAR_URL}/layers/config`, { layers: config }),
},

// CRON jobs
cronJobs: {
  list: () => api.get(`${CALENDAR_URL}/cron-jobs`),
  create: (job: CreateCronJob) => api.post(`${CALENDAR_URL}/cron-jobs`, job),
  update: (id: string, job: Partial<CreateCronJob>) => api.put(`${CALENDAR_URL}/cron-jobs/${id}`, job),
  delete: (id: string) => api.delete(`${CALENDAR_URL}/cron-jobs/${id}`),
  run: (id: string) => api.post(`${CALENDAR_URL}/cron-jobs/${id}/run`),
},
```

- [ ] **Step 2: Add TypeScript types**

Add to `client/src/types/calendar.ts`:

```typescript
export type EventType = 'event' | 'task' | 'leave' | 'shift' | 'booking' | 'milestone' | 'blocker' | 'cron';
export type EventScope = 'personal' | 'team' | 'org';
export type EventStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'completed';
export type EventPriority = 'low' | 'medium' | 'high' | 'urgent';
export type LeaveType = 'cp' | 'rtt' | 'sick' | 'unpaid' | 'other';
export type PresenceMode = 'office' | 'remote' | 'absent';
export type EnergyLevel = 'low' | 'medium' | 'high';
export type RuleType = 'min_onsite' | 'mandatory_days' | 'max_remote_same_day' | 'min_coverage';
export type EnforcementLevel = 'soft' | 'hard';

export interface CalendarEvent {
  id: string;
  calendar_id: string;
  title: string;
  description?: string;
  location?: string;
  start_time: string;
  end_time: string;
  rrule?: string;
  timezone: string;
  created_by: string;
  is_all_day: boolean;
  event_type: EventType;
  scope: EventScope;
  status?: EventStatus;
  priority?: EventPriority;
  parent_event_id?: string;
  resource_id?: string;
  category_id?: string;
  leave_type?: LeaveType;
  presence_mode?: PresenceMode;
  approval_by?: string;
  approval_comment?: string;
  energy_level?: EnergyLevel;
  cron_expression?: string;
  cron_target?: string;
  assigned_to?: string;
  project_id?: string;
  tags: string[];
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon?: string;
  owner_id?: string;
  org_id?: string;
  rules: Record<string, unknown>;
}

export interface PresenceRule {
  id: string;
  org_id: string;
  team_id?: string;
  rule_type: RuleType;
  rule_config: Record<string, unknown>;
  enforcement: EnforcementLevel;
  active: boolean;
}

export interface LeaveBalance {
  id: string;
  user_id: string;
  leave_type: LeaveType;
  year: number;
  total_days: number;
  used_days: number;
  pending_days: number;
}

export interface TimesheetEntry {
  id: string;
  user_id: string;
  event_id?: string;
  date: string;
  hours: number;
  category_id?: string;
  auto_generated: boolean;
  validated: boolean;
  validated_at?: string;
  exported_at?: string;
}

export interface LayerConfig {
  layer_id: string;
  enabled: boolean;
  opacity: number;
  color_override?: string;
}

export interface HeadcountPoint {
  time: string;
  role: string;
  count: number;
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/lib/api/calendar.ts client/src/types/calendar.ts
git commit -m "feat: unified calendar API client with leave, presence, categories, timesheets, layers"
```

---

### Task 12: Create unified calendar Zustand store

**Files:**
- Modify: `client/src/stores/calendar-store.ts`

- [ ] **Step 1: Rewrite calendar-store.ts**

Replace the existing store with a unified version that absorbs scheduling-store functionality:

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CalendarEvent, LayerConfig, EventType } from '@/types/calendar';

export type ViewType = 'day' | 'week' | 'month' | 'agenda' | 'timeline' | 'kanban' | 'heatmap' | 'roster' | 'tasks' | 'availability' | 'presence';

interface CalendarState {
  // Current view
  view: ViewType;
  setView: (view: ViewType) => void;

  // Current date
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  navigateForward: () => void;
  navigateBack: () => void;
  goToToday: () => void;

  // Selected event
  selectedEvent: CalendarEvent | null;
  setSelectedEvent: (event: CalendarEvent | null) => void;

  // Layers
  layers: LayerConfig[];
  setLayers: (layers: LayerConfig[]) => void;
  toggleLayer: (layerId: string) => void;
  setLayerOpacity: (layerId: string, opacity: number) => void;

  // Filters
  eventTypeFilter: EventType[];
  setEventTypeFilter: (types: EventType[]) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // UI state
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  layerPanelOpen: boolean;
  setLayerPanelOpen: (open: boolean) => void;

  // Selected colleagues for overlay
  selectedColleagues: string[];
  setSelectedColleagues: (ids: string[]) => void;
  toggleColleague: (id: string) => void;

  // Selected resources for overlay
  selectedResources: string[];
  setSelectedResources: (ids: string[]) => void;
  toggleResource: (id: string) => void;
}

export const useCalendarStore = create<CalendarState>()(
  persist(
    (set, get) => ({
      view: 'week',
      setView: (view) => set({ view }),

      currentDate: new Date(),
      setCurrentDate: (date) => set({ currentDate: date }),
      navigateForward: () => {
        const { view, currentDate } = get();
        const d = new Date(currentDate);
        if (view === 'day') d.setDate(d.getDate() + 1);
        else if (view === 'week') d.setDate(d.getDate() + 7);
        else d.setMonth(d.getMonth() + 1);
        set({ currentDate: d });
      },
      navigateBack: () => {
        const { view, currentDate } = get();
        const d = new Date(currentDate);
        if (view === 'day') d.setDate(d.getDate() - 1);
        else if (view === 'week') d.setDate(d.getDate() - 7);
        else d.setMonth(d.getMonth() - 1);
        set({ currentDate: d });
      },
      goToToday: () => set({ currentDate: new Date() }),

      selectedEvent: null,
      setSelectedEvent: (event) => set({ selectedEvent: event }),

      layers: [
        { layer_id: 'my-events', enabled: true, opacity: 100 },
        { layer_id: 'my-tasks', enabled: true, opacity: 100 },
        { layer_id: 'team-leaves', enabled: false, opacity: 100 },
        { layer_id: 'rooms', enabled: false, opacity: 100 },
        { layer_id: 'equipment', enabled: false, opacity: 100 },
        { layer_id: 'vehicles', enabled: false, opacity: 100 },
        { layer_id: 'projects', enabled: false, opacity: 100 },
        { layer_id: 'team-shifts', enabled: false, opacity: 100 },
        { layer_id: 'external', enabled: false, opacity: 100 },
      ],
      setLayers: (layers) => set({ layers }),
      toggleLayer: (layerId) => set((s) => ({
        layers: s.layers.map((l) =>
          l.layer_id === layerId ? { ...l, enabled: !l.enabled } : l
        ),
      })),
      setLayerOpacity: (layerId, opacity) => set((s) => ({
        layers: s.layers.map((l) =>
          l.layer_id === layerId ? { ...l, opacity } : l
        ),
      })),

      eventTypeFilter: [],
      setEventTypeFilter: (types) => set({ eventTypeFilter: types }),
      searchQuery: '',
      setSearchQuery: (query) => set({ searchQuery: query }),

      sidebarOpen: true,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      layerPanelOpen: true,
      setLayerPanelOpen: (open) => set({ layerPanelOpen: open }),

      selectedColleagues: [],
      setSelectedColleagues: (ids) => set({ selectedColleagues: ids }),
      toggleColleague: (id) => set((s) => ({
        selectedColleagues: s.selectedColleagues.includes(id)
          ? s.selectedColleagues.filter((c) => c !== id)
          : [...s.selectedColleagues, id],
      })),

      selectedResources: [],
      setSelectedResources: (ids) => set({ selectedResources: ids }),
      toggleResource: (id) => set((s) => ({
        selectedResources: s.selectedResources.includes(id)
          ? s.selectedResources.filter((r) => r !== id)
          : [...s.selectedResources, id],
      })),
    }),
    {
      name: 'signapps-calendar',
      partialize: (state) => ({
        view: state.view,
        layers: state.layers,
        sidebarOpen: state.sidebarOpen,
        layerPanelOpen: state.layerPanelOpen,
        selectedColleagues: state.selectedColleagues,
        selectedResources: state.selectedResources,
      }),
    }
  )
);
```

- [ ] **Step 2: Commit**

```bash
git add client/src/stores/calendar-store.ts
git commit -m "feat: unified calendar Zustand store with layers, views, colleagues, resources"
```

---

## P5: Frontend — Layers System

### Task 13: Create LayerPanel component

**Files:**
- Create: `client/src/components/calendar/LayerPanel.tsx`

- [ ] **Step 1: Create component**

A sidebar panel listing all layers with:
- Checkbox on/off per layer
- Color dot
- Opacity slider (100/50/25)
- Collapsible sections (Native layers, Colleagues, Resources, Categories)
- `[+] Ajouter un layer...` button at bottom
- Colleague picker (search users, toggle)
- Resource picker (search rooms/equipment/vehicles, toggle)

Uses `useCalendarStore` for state. Calls `calendarApi.layers.saveConfig()` on change (debounced).

- [ ] **Step 2: Commit**

```bash
git commit -m "feat: add LayerPanel component for superposable calendar layers"
```

---

### Task 14: Create layer filtering hook

**Files:**
- Create: `client/src/hooks/use-calendar-layers.ts`

- [ ] **Step 1: Create hook**

```typescript
// Hook that takes all events and returns filtered events based on active layers
export function useCalendarLayers(events: CalendarEvent[]): CalendarEvent[] {
  const { layers, selectedColleagues, selectedResources } = useCalendarStore();

  return useMemo(() => {
    return events.filter((event) => {
      // Check each active layer
      for (const layer of layers) {
        if (!layer.enabled) continue;
        if (matchesLayer(event, layer.layer_id, selectedColleagues, selectedResources)) {
          return true;
        }
      }
      return false;
    });
  }, [events, layers, selectedColleagues, selectedResources]);
}
```

The `matchesLayer` function maps layer_id to event filters (as defined in the spec section 2).

- [ ] **Step 2: Commit**

```bash
git commit -m "feat: add useCalendarLayers hook for event filtering by active layers"
```

---

## P6: Frontend — Migrate Views

### Task 15: Move unique views from scheduling/ to calendar/

**Files:**
- Move: `scheduling/views/TimelineView.tsx` → `calendar/TimelineView.tsx`
- Move: `scheduling/views/KanbanView.tsx` → `calendar/KanbanView.tsx`
- Move: `scheduling/views/HeatmapView.tsx` → `calendar/HeatmapView.tsx`
- Move: `scheduling/views/RosterView.tsx` → `calendar/RosterView.tsx`
- Move: `scheduling/views/TasksView.tsx` → `calendar/TasksView.tsx`
- Move: `scheduling/resources/FloorPlan.tsx` → `calendar/FloorPlan.tsx`
- Move: `scheduling/resources/ResourcesView.tsx` → `calendar/ResourcesView.tsx`
- Move: `scheduling/team/WorkloadDashboard.tsx` → `calendar/WorkloadDashboard.tsx`
- Move: `scheduling/meeting-scheduler/` → `calendar/meeting-scheduler/`
- Move: `scheduling/command-palette/` → `calendar/command-palette/`
- Move: `scheduling/analytics/` → `calendar/analytics/`
- Move: `scheduling/productivity/` → `calendar/productivity/`

- [ ] **Step 1: Move files**

```bash
cd client/src/components
# Move views
for f in TimelineView KanbanView HeatmapView RosterView TasksView; do
  cp scheduling/views/${f}.tsx calendar/${f}.tsx
done
# Move resources
cp scheduling/resources/FloorPlan.tsx calendar/FloorPlan.tsx
cp scheduling/resources/ResourcesView.tsx calendar/ResourcesView.tsx
# Move team
cp scheduling/team/WorkloadDashboard.tsx calendar/WorkloadDashboard.tsx
# Move folders
cp -r scheduling/meeting-scheduler calendar/meeting-scheduler
cp -r scheduling/command-palette calendar/command-palette
cp -r scheduling/analytics calendar/analytics
cp -r scheduling/productivity calendar/productivity
```

- [ ] **Step 2: Update imports in moved files**

Replace all `@/stores/scheduling-store` → `@/stores/calendar-store` and `@/lib/scheduling/api/*` → `@/lib/api/calendar` in moved files.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: migrate scheduling views to calendar/ (Timeline, Kanban, Heatmap, Roster, Tasks, FloorPlan)"
```

---

### Task 16: Create unified CalendarHub (view router)

**Files:**
- Create: `client/src/components/calendar/CalendarHub.tsx`
- Modify: `client/src/app/(app)/cal/page.tsx`

- [ ] **Step 1: Create CalendarHub**

Main layout component:
- Left sidebar: calendar list + LayerPanel
- Top bar: view switcher (11 views) + date navigator + search
- Main area: renders the active view based on `useCalendarStore().view`

```typescript
const VIEW_MAP: Record<ViewType, React.LazyExoticComponent<any>> = {
  day: lazy(() => import('./DayCalendar')),
  week: lazy(() => import('./WeekCalendar')),
  month: lazy(() => import('./MonthCalendar')),
  agenda: lazy(() => import('./AgendaView')),
  timeline: lazy(() => import('./TimelineView')),
  kanban: lazy(() => import('./KanbanView')),
  heatmap: lazy(() => import('./HeatmapView')),
  roster: lazy(() => import('./RosterView')),
  tasks: lazy(() => import('./TasksView')),
  availability: lazy(() => import('./AvailabilityView')),
  presence: lazy(() => import('./PresenceTableView')),
};
```

- [ ] **Step 2: Update /cal page to use CalendarHub**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: unified CalendarHub with 11-view switcher and layer panel"
```

---

## P7: New Views

### Task 17: Create AvailabilityView (find-a-time multi-resource)

**Files:**
- Create: `client/src/components/calendar/AvailabilityView.tsx`

- [ ] **Step 1: Create component**

Columns = selected colleagues + selected resources (from layers). Each column is a day time grid (8h-20h). Events shown as occupied blocks. Free zones highlighted in green. Conflicts (multiple layers same slot) in red.

Uses `useCalendarLayers` to filter events per column.

- [ ] **Step 2: Commit**

```bash
git commit -m "feat: add AvailabilityView — multi-resource find-a-time"
```

---

### Task 18: Create PresenceTableView + step-chart

**Files:**
- Create: `client/src/components/calendar/PresenceTableView.tsx`
- Create: `client/src/components/calendar/HeadcountChart.tsx`

- [ ] **Step 1: Create HeadcountChart**

Recharts `AreaChart` with `type="step"` (step-after interpolation). Data from `calendarApi.presence.headcount()`. One series per role/poste. Configurable min/max thresholds shown as reference lines.

```typescript
<ResponsiveContainer width="100%" height={250}>
  <AreaChart data={headcountData}>
    <XAxis dataKey="time" />
    <YAxis />
    {roles.map((role) => (
      <Area
        key={role}
        type="stepAfter"
        dataKey={role}
        stroke={roleColors[role]}
        fill={roleColors[role]}
        fillOpacity={0.3}
      />
    ))}
    {thresholds.map((t) => (
      <ReferenceLine key={t.role} y={t.min} stroke="red" strokeDasharray="5 5" label={`Min ${t.role}`} />
    ))}
  </AreaChart>
</ResponsiveContainer>
```

- [ ] **Step 2: Create PresenceTableView**

Top panel: HeadcountChart. Bottom panel: grid of employees × days. Each cell shows presence_mode with color (office=green, remote=blue, absent=red). Cells bordered red if violating a presence rule. Click cell to edit presence.

Filterable by team/department. Data from `calendarApi.presence.teamStatus()`.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: add PresenceTableView with step-chart headcount diagram"
```

---

## P8: Leave + Presence RH Flows

### Task 19: Extend EventForm for leave creation

**Files:**
- Modify: `client/src/components/calendar/EventForm.tsx`

- [ ] **Step 1: Add leave-specific fields**

When `event_type=leave` is selected in EventForm:
- Show leave_type picker (CP, RTT, Maladie, etc.)
- Show current balance + predicted balance after this leave
- Show team conflicts inline (who else is off during this period)
- Show presence rule violations (soft=yellow warning, hard=red block)
- If hard violation, disable submit button

Uses `calendarApi.leave.predict()`, `calendarApi.leave.teamConflicts()`, `calendarApi.presence.validate()`.

- [ ] **Step 2: Commit**

```bash
git commit -m "feat: extend EventForm with leave type, balance prediction, conflict check"
```

---

### Task 20: Create LeaveApprovalPanel

**Files:**
- Create: `client/src/components/calendar/LeaveApprovalPanel.tsx`

- [ ] **Step 1: Create component**

Panel shown when clicking a pending leave event. Shows:
- Employee name, dates, leave type, remaining balance
- Team calendar mini-view for the period (who else is off)
- Coverage check (min_coverage rule)
- Approve / Reject buttons with comment field
- If cascade approval: shows approval chain status

Calls `calendarApi.leave.approve()` or `calendarApi.leave.reject()`.

- [ ] **Step 2: Commit**

```bash
git commit -m "feat: add LeaveApprovalPanel with cascade workflow"
```

---

### Task 21: Create LeaveDelegationDialog

**Files:**
- Create: `client/src/components/calendar/LeaveDelegationDialog.tsx`

- [ ] **Step 1: Create component**

Dialog shown after leave approval. Lists the employee's tasks/events during the leave period. For each, suggests a colleague (based on workload heatmap data). User can accept suggestions or manually reassign.

Calls `calendarApi.leave.delegate()` to reassign.

- [ ] **Step 2: Commit**

```bash
git commit -m "feat: add LeaveDelegationDialog for automatic task reassignment"
```

---

## P9: Timesheets

### Task 22: Create TimesheetView

**Files:**
- Create: `client/src/components/calendar/TimesheetView.tsx`

- [ ] **Step 1: Create component**

Weekly view of timesheet entries for current user. Table: rows = days, columns = categories. Each cell shows hours. Auto-generated entries shown with a robot icon. Editable cells for manual correction. "Validate week" button at bottom.

Data from `calendarApi.timesheets.list()`. Validation via `calendarApi.timesheets.validate()`.

- [ ] **Step 2: Commit**

```bash
git commit -m "feat: add TimesheetView with weekly validation"
```

---

### Task 23: Create TimesheetExportDialog

**Files:**
- Create: `client/src/components/calendar/TimesheetExportDialog.tsx`

- [ ] **Step 1: Create component**

Dialog for exporting validated timesheets. Date range picker, preview table, export button (CSV download). Calls `calendarApi.timesheets.export()`.

- [ ] **Step 2: Commit**

```bash
git commit -m "feat: add TimesheetExportDialog for HR/payroll export"
```

---

## P10: Cleanup

### Task 24: Delete scheduling duplicates

**Files:**
- Delete: `client/src/components/scheduling/views/DayView.tsx`
- Delete: `client/src/components/scheduling/views/WeekView.tsx`
- Delete: `client/src/components/scheduling/views/MonthView.tsx`
- Delete: `client/src/components/scheduling/views/AgendaView.tsx`
- Delete: `client/src/components/scheduling/calendar/RecurrenceEditor.tsx`
- Delete: `client/src/components/scheduling/calendar/AttendeeManager.tsx`
- Delete: `client/src/components/scheduling/core/SchedulingHub.tsx`
- Delete: `client/src/stores/scheduling-store.ts`
- Delete: `client/src/stores/scheduling/` (entire directory)
- Delete: `client/src/lib/scheduling/` (entire directory)
- Delete: `client/src/components/hr/leave-management.tsx`
- Delete: `client/src/components/hr/leave-calendar-blocker.tsx`
- Delete: `client/src/components/workforce/leave-calendar.tsx`
- Delete: `client/src/components/workforce/leave-request.tsx`

- [ ] **Step 1: Delete duplicate files**

```bash
cd client/src
# Scheduling duplicates
rm components/scheduling/views/DayView.tsx
rm components/scheduling/views/WeekView.tsx
rm components/scheduling/views/MonthView.tsx
rm components/scheduling/views/AgendaView.tsx
rm components/scheduling/calendar/RecurrenceEditor.tsx
rm components/scheduling/calendar/AttendeeManager.tsx
rm components/scheduling/core/SchedulingHub.tsx

# Stores
rm stores/scheduling-store.ts
rm -rf stores/scheduling/

# API
rm -rf lib/scheduling/

# Leave duplicates
rm components/hr/leave-management.tsx
rm components/hr/leave-calendar-blocker.tsx
rm components/workforce/leave-calendar.tsx
rm components/workforce/leave-request.tsx
```

- [ ] **Step 2: Fix all broken imports**

Search for imports referencing deleted files and update to use calendar equivalents.

```bash
grep -rn "scheduling-store\|scheduling/api\|lib/scheduling\|leave-management\|leave-calendar-blocker\|leave-calendar\|leave-request" src/ --include="*.tsx" --include="*.ts"
```

Fix each broken import.

- [ ] **Step 3: Commit**

```bash
git commit -m "chore: remove scheduling duplicates (views, stores, APIs, leave components)"
```

---

### Task 25: Redirect pages + final wiring

**Files:**
- Modify: `client/src/app/scheduling/page.tsx`
- Modify: `client/src/app/resources/page.tsx`
- Modify: `client/src/app/resources/my-reservations/page.tsx`

- [ ] **Step 1: Add redirects**

```typescript
// scheduling/page.tsx
import { redirect } from 'next/navigation';
export default function SchedulingRedirect() { redirect('/cal'); }

// resources/page.tsx
import { redirect } from 'next/navigation';
export default function ResourcesRedirect() { redirect('/cal?view=availability'); }

// resources/my-reservations/page.tsx
import { redirect } from 'next/navigation';
export default function MyReservationsRedirect() { redirect('/cal?view=agenda&filter=booking'); }
```

- [ ] **Step 2: Final build check**

```bash
cd client && npx next build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git commit -m "chore: redirect scheduling/resources pages to unified calendar, final cleanup"
```
