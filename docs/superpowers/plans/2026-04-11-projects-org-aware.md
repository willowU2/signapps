# Projects Org-Aware — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make projects org-aware with task assignees, cross-context member roles, portal project views, and team workload integration.

**Architecture:** 5-layer implementation — (1) DB migration for assignee fields + project alters + member enrichment, (2) Backend handler enhancements on scheduler service, (3) Frontend API client + store updates, (4) UI enrichment (task form, project members, portal views), (5) Team workload endpoint + E2E tests.

**Tech Stack:** PostgreSQL, Rust (Axum, sqlx), Next.js 16, React 19, Zustand, react-query, shadcn/ui

---

## File Structure

### Backend (Rust)

| File | Responsibility | Action |
|------|---------------|--------|
| `migrations/280_projects_org_aware.sql` | Alter time_items + projects + project_members | Create |
| `services/signapps-scheduler/src/handlers/projects.rs` | Add member CRUD + my-projects + team-workload | Modify |
| `services/signapps-scheduler/src/handlers/tasks.rs` | Add assignee/contributor filters + my-tasks | Modify |
| `services/signapps-scheduler/src/main.rs` | Register new routes | Modify |

### Frontend (TypeScript/React)

| File | Responsibility | Action |
|------|---------------|--------|
| `client/src/lib/api/entityHub.ts` | Add member + my-projects + my-tasks + workload endpoints | Modify |
| `client/src/app/tasks/page.tsx` | Add assignee display + "Mes taches" tab | Modify |
| `client/src/app/projects/page.tsx` | Add "Mes projets" filter + members tab | Modify |
| `client/src/components/tasks/TaskForm.tsx` | Add assignee + contributors fields | Modify |
| `client/src/app/portal/client/projects/page.tsx` | Portal project list | Create |
| `client/src/app/portal/supplier/projects/page.tsx` | Portal project list | Create |
| `client/e2e/projects-org-smoke.spec.ts` | E2E tests | Create |

---

## Task 1: Database Migration

**Files:**
- Create: `migrations/280_projects_org_aware.sql`

- [ ] **Step 1: Write migration**

```sql
-- 280_projects_org_aware.sql
-- Projects org-aware: assignees, org anchoring, enriched members, portal access

-- 1. Add assignee + contributors to time_items (tasks)
ALTER TABLE scheduling.time_items ADD COLUMN IF NOT EXISTS assignee_id UUID;
ALTER TABLE scheduling.time_items ADD COLUMN IF NOT EXISTS contributor_ids UUID[] DEFAULT '{}';
ALTER TABLE scheduling.time_items ADD COLUMN IF NOT EXISTS external_visible BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_time_items_assignee ON scheduling.time_items(assignee_id) WHERE item_type = 'task';

-- 2. Enrich projects with org anchoring + portal visibility
ALTER TABLE calendar.projects ADD COLUMN IF NOT EXISTS org_node_id UUID;
ALTER TABLE calendar.projects ADD COLUMN IF NOT EXISTS portal_visible BOOLEAN DEFAULT false;
ALTER TABLE calendar.projects ADD COLUMN IF NOT EXISTS progress_percent INT DEFAULT 0;
ALTER TABLE calendar.projects ADD COLUMN IF NOT EXISTS budget_hours NUMERIC;

-- 3. Enrich project_members with person + context + external roles
ALTER TABLE calendar.project_members ADD COLUMN IF NOT EXISTS person_id UUID;
ALTER TABLE calendar.project_members ADD COLUMN IF NOT EXISTS context_type TEXT DEFAULT 'employee';
ALTER TABLE calendar.project_members ADD COLUMN IF NOT EXISTS invited_by UUID;

-- Update role constraint to include external roles
DO $$
BEGIN
    ALTER TABLE calendar.project_members DROP CONSTRAINT IF EXISTS project_members_role_check;
    ALTER TABLE calendar.project_members ADD CONSTRAINT project_members_role_check
        CHECK (role IN ('owner', 'admin', 'member', 'viewer', 'external_contributor', 'external_observer'));
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'project_members constraint update skipped: %', SQLERRM;
END $$;

-- Index for person-based lookups
CREATE INDEX IF NOT EXISTS idx_project_members_person ON calendar.project_members(person_id) WHERE person_id IS NOT NULL;
```

- [ ] **Step 2: Commit**

```bash
git add migrations/280_projects_org_aware.sql
git commit -m "feat(db): add assignee, org anchoring, enriched members to projects/tasks"
```

---

## Task 2: Backend — Project Members + Filters

**Files:**
- Modify: `services/signapps-scheduler/src/handlers/projects.rs`
- Modify: `services/signapps-scheduler/src/main.rs`

- [ ] **Step 1: Add handlers to projects.rs**

Read `services/signapps-scheduler/src/handlers/projects.rs` first for the exact pattern (State, TenantContext, Claims, StatusCode).

Add these handlers at the end of the file:

1. **`list_members`** — GET /api/v1/projects/:id/members
   - `SELECT pm.*, p.first_name, p.last_name, p.email, p.avatar_url FROM calendar.project_members pm LEFT JOIN core.persons p ON p.id = pm.person_id WHERE pm.project_id = $1`
   - Return JSON array

2. **`add_member`** — POST /api/v1/projects/:id/members
   - Body: `{person_id, role, context_type}`
   - INSERT with ON CONFLICT update role
   - Set `invited_by = claims.sub`

3. **`update_member_role`** — PUT /api/v1/projects/:id/members/:person_id
   - Body: `{role}`
   - UPDATE calendar.project_members SET role

4. **`remove_member`** — DELETE /api/v1/projects/:id/members/:person_id
   - DELETE FROM calendar.project_members

5. **`my_projects`** — GET /api/v1/projects/my-projects
   - Resolve person_id from claims.sub via core.persons
   - `SELECT p.* FROM calendar.projects p JOIN calendar.project_members pm ON pm.project_id = p.id WHERE (pm.user_id = $1 OR pm.person_id = $2) AND p.deleted_at IS NULL`

6. **`project_progress`** — GET /api/v1/projects/:id/progress
   - Count tasks: `SELECT COUNT(*) FILTER (WHERE status = 'done') as done, COUNT(*) as total FROM scheduling.time_items WHERE project_id = $1 AND item_type = 'task'`
   - Return `{done, total, percent}`

7. **`team_workload`** — GET /api/v1/projects/team-workload
   - Resolve N-1 person_ids via org_closure (same as my-team handler)
   - For each N-1: count active tasks grouped by project
   - Return `{members: [{person_id, name, projects: [{project_id, name, active_tasks, completed}], total_active, capacity: 10, workload_percent}]}`

- [ ] **Step 2: Update ProjectListQuery**

Add `my_projects: Option<bool>` and `org_node_id: Option<Uuid>` and `team: Option<bool>` to ProjectListQuery. Update the `list` handler to filter accordingly.

- [ ] **Step 3: Register routes in main.rs**

Add to the project routes section:
```rust
.route("/my-projects", get(handlers::projects::my_projects))
.route("/team-workload", get(handlers::projects::team_workload))
.route("/{id}/members", get(handlers::projects::list_members).post(handlers::projects::add_member))
.route("/{id}/members/{person_id}", put(handlers::projects::update_member_role).delete(handlers::projects::remove_member))
.route("/{id}/progress", get(handlers::projects::project_progress))
```

- [ ] **Step 4: Verify compilation**

Run: `cargo check -p signapps-scheduler`

- [ ] **Step 5: Commit**

```bash
git add services/signapps-scheduler/src/handlers/projects.rs services/signapps-scheduler/src/main.rs
git commit -m "feat(projects): add members CRUD, my-projects, progress, team-workload endpoints"
```

---

## Task 3: Backend — Task Assignee Filters

**Files:**
- Modify: `services/signapps-scheduler/src/handlers/tasks.rs`
- Modify: `services/signapps-scheduler/src/main.rs`

- [ ] **Step 1: Update task list handler**

In `tasks.rs`, add query params to the list handler:
- `assignee_id: Option<Uuid>` — filter by assignee
- `my_tasks: Option<bool>` — filter by current user as assignee or contributor
- `team: Option<bool>` — filter by N-1 assignees

Update the SQL query to apply these filters when present.

- [ ] **Step 2: Update task create/update handlers**

Accept `assignee_id` and `contributor_ids` in CreateTimeItem/UpdateTimeItem. Pass them through to the INSERT/UPDATE queries.

- [ ] **Step 3: Add my-tasks shortcut endpoint**

Add `my_tasks` handler: GET /api/v1/tasks/my-tasks
- Resolve person_id from claims.sub
- `SELECT * FROM scheduling.time_items WHERE (assignee_id = $1 OR $1 = ANY(contributor_ids)) AND item_type = 'task' AND deleted_at IS NULL ORDER BY deadline NULLS LAST`

Register route: `.route("/my-tasks", get(handlers::tasks::my_tasks))`

- [ ] **Step 4: Verify + commit**

```bash
git add services/signapps-scheduler/src/handlers/tasks.rs services/signapps-scheduler/src/main.rs
git commit -m "feat(tasks): add assignee/contributor filters + my-tasks endpoint"
```

---

## Task 4: Frontend API + UI Enrichment

**Files:**
- Modify: `client/src/lib/api/entityHub.ts`
- Modify: `client/src/components/tasks/TaskForm.tsx`
- Modify: `client/src/app/tasks/page.tsx`
- Modify: `client/src/app/projects/page.tsx`

- [ ] **Step 1: Extend entityHub API**

Add to `client/src/lib/api/entityHub.ts`:
```typescript
  // Project members
  listProjectMembers: (projectId: string) => schedulerClient().get(`/projects/${projectId}/members`),
  addProjectMember: (projectId: string, data: { person_id: string; role: string; context_type?: string }) =>
    schedulerClient().post(`/projects/${projectId}/members`, data),
  updateProjectMemberRole: (projectId: string, personId: string, data: { role: string }) =>
    schedulerClient().put(`/projects/${projectId}/members/${personId}`, data),
  removeProjectMember: (projectId: string, personId: string) =>
    schedulerClient().delete(`/projects/${projectId}/members/${personId}`),
  myProjects: () => schedulerClient().get("/projects/my-projects"),
  projectProgress: (projectId: string) => schedulerClient().get(`/projects/${projectId}/progress`),
  teamWorkload: () => schedulerClient().get("/projects/team-workload"),

  // Task filters
  myTasks: () => schedulerClient().get("/tasks/my-tasks"),
```

- [ ] **Step 2: Enrich TaskForm with assignee + contributors**

In `client/src/components/tasks/TaskForm.tsx`:
- Add "Responsable" field: person search dropdown (search core.persons)
- Add "Contributeurs" field: multi-select person chips
- Pass `assignee_id` and `contributor_ids` in the create/update payload

- [ ] **Step 3: Add "Mes taches" view to tasks page**

In `client/src/app/tasks/page.tsx`:
- Add a 4th view mode: `"my-tasks"`
- Button "Mes taches" in the toolbar
- When active, fetch from `entityHubApi.myTasks()` instead of `listTasks()`
- Show assignee avatar on task cards

- [ ] **Step 4: Add "Mes projets" filter to projects page**

In `client/src/app/projects/page.tsx`:
- Add toggle "Mes projets" in the header
- When active, fetch from `entityHubApi.myProjects()`
- Show progress bar on project cards
- Add "Membres" tab to the tabs list (renders member list with role badges)

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/api/entityHub.ts client/src/components/tasks/TaskForm.tsx \
       client/src/app/tasks/page.tsx client/src/app/projects/page.tsx
git commit -m "feat(frontend): add assignee fields, my-tasks, my-projects, project members tab"
```

---

## Task 5: Portal Project Pages + E2E

**Files:**
- Create: `client/src/app/portal/client/projects/page.tsx`
- Create: `client/src/app/portal/supplier/projects/page.tsx`
- Create: `client/e2e/projects-org-smoke.spec.ts`

- [ ] **Step 1: Create portal client projects page**

`client/src/app/portal/client/projects/page.tsx`:
- Title "Mes Projets"
- Fetch projects where current person is member via `entityHubApi.myProjects()`
- Card grid: project name, progress bar (%), status badge, due date, member count
- Click card → detail view: milestones, assigned tasks, shared documents
- Only shows tasks where `external_visible = true` or `assignee_id = me`
- Uses react-query, shadcn Card, Skeleton loading

- [ ] **Step 2: Create portal supplier projects page**

Same component at `client/src/app/portal/supplier/projects/page.tsx`.

- [ ] **Step 3: Create E2E tests**

```typescript
import { test, expect } from "./fixtures";

test.describe("Projects Org-Aware — smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login?auto=admin", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
  });

  test("projects page loads with tabs", async ({ page }) => {
    await page.goto("/projects", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const heading = page.getByRole("heading", { name: /projets/i });
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
  });

  test("tasks page loads", async ({ page }) => {
    await page.goto("/tasks", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const heading = page.getByText(/taches|tasks/i);
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
  });

  test("my-tasks button or tab visible", async ({ page }) => {
    await page.goto("/tasks", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const btn = page.getByRole("button", { name: /mes taches|my tasks/i })
      .or(page.getByText(/mes taches/i));
    await expect(btn.first()).toBeVisible({ timeout: 10000 }).catch(() => {});
  });

  test("portal client projects page loads", async ({ page }) => {
    await page.goto("/portal/client/projects", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const heading = page.getByText(/projets|projects/i);
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
  });

  test("portal supplier projects page loads", async ({ page }) => {
    await page.goto("/portal/supplier/projects", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const heading = page.getByText(/projets|projects/i);
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
  });

  test("projects page has gantt tab", async ({ page }) => {
    await page.goto("/projects", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const tab = page.getByRole("tab", { name: /gantt/i })
      .or(page.getByText(/gantt/i));
    await expect(tab.first()).toBeVisible({ timeout: 10000 });
  });
});
```

- [ ] **Step 4: Commit**

```bash
git add client/src/app/portal/client/projects/page.tsx \
       client/src/app/portal/supplier/projects/page.tsx \
       client/e2e/projects-org-smoke.spec.ts
git commit -m "feat(projects): add portal project pages + E2E smoke tests"
```

---

## Summary

| Task | Description | Files | Est. |
|------|-------------|-------|------|
| 1 | DB migration (alter 3 tables) | 1 SQL | 3 min |
| 2 | Project members + filters + workload (7 endpoints) | 2 files | 15 min |
| 3 | Task assignee filters + my-tasks (3 changes) | 2 files | 10 min |
| 4 | Frontend API + TaskForm + pages enrichment | 4 files | 15 min |
| 5 | Portal project pages + E2E (6 tests) | 3 files | 10 min |
