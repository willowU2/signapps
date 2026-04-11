# Projects Org-Aware — Design Spec

## Summary

Enhance the Tasks/Projects module to be org-aware: projects are anchored to org nodes with cross-org invitations, tasks have a primary assignee + contributors, portal users can be invited as external members, and the /my-team hub shows team workload across projects.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Org link | **Hybrid** — project anchored to org node + cross-org invitations | Reflects real-world: project owned by dept but involves other teams |
| Task assignment | **Assignee + contributors** — one responsible person + N contributors | Clear accountability + collaborative work |
| Portal access | **Cross-context complete** — external contacts invited as project members with roles | Clients can track assigned tasks and milestones |
| Team filter | **Projects + tasks + workload** — filter both, plus charge per person view | Full manager visibility for redistribution |

## Data Model Changes

### Alter `scheduling.time_items` (tasks)

```sql
-- Add assignee (responsible person) distinct from owner (creator)
ALTER TABLE scheduling.time_items ADD COLUMN IF NOT EXISTS assignee_id UUID;
-- assignee_id: FK to core.persons — the person responsible for completing this task
-- owner_id remains the creator for audit purposes

-- Add contributors (people who participate but aren't responsible)
ALTER TABLE scheduling.time_items ADD COLUMN IF NOT EXISTS contributor_ids UUID[] DEFAULT '{}';
-- Array of person_ids who contribute to this task

-- Add external visibility flag
ALTER TABLE scheduling.time_items ADD COLUMN IF NOT EXISTS external_visible BOOLEAN DEFAULT false;
-- When true, external project members (client/supplier) can see this task

CREATE INDEX IF NOT EXISTS idx_time_items_assignee ON scheduling.time_items(assignee_id) WHERE item_type = 'task';
CREATE INDEX IF NOT EXISTS idx_time_items_project ON scheduling.time_items(project_id) WHERE item_type = 'task';
```

### Alter `calendar.projects`

```sql
-- Anchor project to org tree
ALTER TABLE calendar.projects ADD COLUMN IF NOT EXISTS org_node_id UUID;
-- org_node_id: optional FK to core.org_nodes — determines hierarchical visibility

-- Add project visibility for portals
ALTER TABLE calendar.projects ADD COLUMN IF NOT EXISTS portal_visible BOOLEAN DEFAULT false;
-- When true, external members can see project overview (milestones, progress)

-- Add progress tracking
ALTER TABLE calendar.projects ADD COLUMN IF NOT EXISTS progress_percent INT DEFAULT 0;
-- Computed from task completion ratio, cached for performance

-- Add capacity config
ALTER TABLE calendar.projects ADD COLUMN IF NOT EXISTS budget_hours NUMERIC;
-- Total budgeted hours for the project (for workload calculations)
```

### Alter `calendar.project_members`

```sql
-- Enrich member model
ALTER TABLE calendar.project_members ADD COLUMN IF NOT EXISTS person_id UUID;
-- person_id: FK to core.persons (supports portal users who aren't system users)

ALTER TABLE calendar.project_members ADD COLUMN IF NOT EXISTS context_type TEXT DEFAULT 'employee';
-- 'employee', 'client', 'supplier', 'partner'

-- Update role check to include external roles
-- Existing roles: owner, admin, member, viewer
-- New roles: external_contributor, external_observer
ALTER TABLE calendar.project_members DROP CONSTRAINT IF EXISTS project_members_role_check;
ALTER TABLE calendar.project_members ADD CONSTRAINT project_members_role_check
    CHECK (role IN ('owner', 'admin', 'member', 'viewer', 'external_contributor', 'external_observer'));

ALTER TABLE calendar.project_members ADD COLUMN IF NOT EXISTS invited_by UUID;
-- Who invited this member (for audit)

ALTER TABLE calendar.project_members ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ DEFAULT NOW();
```

## Task Assignment Model

### Roles

| Field | Purpose | Notifications | Dashboard |
|-------|---------|---------------|-----------|
| `owner_id` | Creator (audit) | None | No |
| `assignee_id` | Responsible person | Deadlines, overdue | Shows in "Mes taches", /my-team |
| `contributor_ids[]` | Participants | Task updates | Shows in "Mes contributions" |

### Assignment flow

1. User creates task → `owner_id = claims.sub`
2. User assigns task → `assignee_id = person_id` (dropdown in task form)
3. User adds contributors → `contributor_ids += [person_id, ...]`
4. Assignee change → PgEventBus `task.assigned` notification to new assignee
5. Contributor added → PgEventBus `task.contributor_added` notification

## Project Member Roles

| Role | Internal/External | See tasks | Manage tasks | See all tasks | Admin |
|------|------------------|-----------|--------------|---------------|-------|
| `owner` | Internal | All | All | Yes | Yes |
| `admin` | Internal | All | All | Yes | Yes |
| `member` | Internal | All | Assigned only | Yes | No |
| `viewer` | Internal | All | None | Yes | No |
| `external_contributor` | External | Assigned + external_visible | Assigned only | No | No |
| `external_observer` | External | external_visible only | None | No | No |

## API Endpoint Changes

### Modified endpoints

| Method | Path | Change |
|--------|------|--------|
| GET | /api/v1/projects | Add `?my_projects=true` filter (only where user is member) |
| GET | /api/v1/projects | Add `?org_node_id=uuid` filter (projects anchored to node) |
| GET | /api/v1/projects | Add `?team=true` filter (projects where any N-1 is member) |
| GET | /api/v1/tasks | Add `?assignee_id=uuid` filter |
| GET | /api/v1/tasks | Add `?my_tasks=true` (assignee_id = me OR me in contributor_ids) |
| GET | /api/v1/tasks | Add `?team=true` (assignee_id in my N-1 person_ids) |
| POST | /api/v1/tasks | Accept `assignee_id` and `contributor_ids` in body |
| PUT | /api/v1/tasks/:id | Accept `assignee_id` and `contributor_ids` updates |

### New endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/projects/:id/members | List project members with roles |
| POST | /api/v1/projects/:id/members | Add member (person_id, role, context_type) |
| PUT | /api/v1/projects/:id/members/:person_id | Update member role |
| DELETE | /api/v1/projects/:id/members/:person_id | Remove member |
| GET | /api/v1/projects/my-projects | Shortcut: projects where I am member |
| GET | /api/v1/tasks/my-tasks | Shortcut: tasks assigned to me or I contribute |
| GET | /api/v1/projects/:id/progress | Compute progress (done tasks / total tasks) |
| GET | /api/v1/projects/team-workload | Team workload: tasks per N-1 per project |

## Portal Project View

### What external members see

**External contributor** (e.g., freelancer, client project participant):
- Project dashboard: name, description, progress %, milestones
- Tasks assigned to them (assignee or contributor)
- Tasks marked `external_visible = true`
- Documents shared with the project
- Project timeline (gantt with visible tasks only)
- Can update status of assigned tasks
- Can comment on visible tasks

**External observer** (e.g., client checking progress):
- Project dashboard: name, description, progress %, milestones
- Tasks marked `external_visible = true` (read-only)
- Documents shared with the project
- Cannot modify anything

### Portal routing

- `/portal/client/projects` — list projects where client is member
- `/portal/client/projects/:id` — project detail (filtered view)
- `/portal/supplier/projects` — same for suppliers

## My Team Integration

### /my-team tab "Indicateurs" enrichment

New section "Charge projets" showing:
- Table: N-1 person × project → task count (active/completed)
- Stacked bar chart: tasks per person colored by project
- Workload score per person: active tasks / capacity (configurable, default 10 tasks)
- Alert badge when someone is overloaded (> 120% capacity)

### Data source

```
GET /api/v1/projects/team-workload
Response:
{
  "members": [
    {
      "person_id": "uuid",
      "name": "Jean Martin",
      "projects": [
        { "project_id": "uuid", "project_name": "Refonte Site", "active_tasks": 5, "completed_tasks": 12 }
      ],
      "total_active": 8,
      "capacity": 10,
      "workload_percent": 80
    }
  ]
}
```

## UI Changes

### Tasks page enrichment

- **Task form**: add "Responsable" dropdown (person search) + "Contributeurs" multi-select
- **Task card**: show assignee avatar (not just owner)
- **"Mes taches" view**: new tab showing tasks where I am assignee or contributor
- **"Mon equipe" filter**: when active, shows tasks where N-1 persons are assignee

### Projects page enrichment

- **"Mes projets" filter**: toggle showing only projects where I am member
- **Project card**: show org node badge, member count, progress bar
- **Project detail**: new "Membres" tab (list, add, remove, change role)
- **"Mon equipe" filter**: shows projects where any N-1 is member

### Portal pages

- `/portal/client/projects/page.tsx` — list projects (card grid with progress)
- `/portal/client/projects/[id]/page.tsx` — project detail (milestones + assigned tasks + docs)
- Same for supplier portal

## PgEventBus Events

| Event | Payload | Consumers |
|-------|---------|-----------|
| `task.assigned` | `{task_id, assignee_id, project_id}` | Notifications (notify assignee) |
| `task.contributor_added` | `{task_id, contributor_id}` | Notifications |
| `project.member_added` | `{project_id, person_id, role, context_type}` | Notifications, Portal |
| `project.member_removed` | `{project_id, person_id}` | Notifications |
| `project.progress_updated` | `{project_id, percent}` | Dashboard widget, Portal |

## E2E Assertions

- Projects page shows "Mes projets" filter
- Task form has assignee and contributors fields
- Task card shows assignee avatar
- "Mes taches" tab shows tasks assigned to current user
- Project members tab shows members with roles
- Adding external member with role external_contributor works
- Portal client sees project with milestones and assigned tasks
- Portal client cannot see internal-only tasks
- /my-team Indicateurs shows team workload per project
- "Mon equipe" filter on tasks shows N-1 assignee tasks
- Project anchored to org node appears in manager /my-team
