# Organization Role-Aware Views — Design Spec

## Summary

Add role-aware views to the Organization module so that every person sees a view tailored to their position in the org chart. Managers see their direct reports (N-1) with actionable dashboards, employees see their team and manager. A hub page `/my-team` provides the overview, and a transversal "Mon equipe" filter enriches every existing module.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Role detection | **Position-based** — auto-resolve N-1 via assignments + org_closure | No fixed levels; adapts to any org structure |
| Manager dashboard | **Hybrid with tabs** — Aujourd'hui (ops), Equipe (people), Indicateurs (KPIs) | Covers daily ops + team view + analytics |
| Module integration | **Hub + transversal filter** — /my-team hub + "Mon equipe" toggle in each module | Overview from hub, action from modules |
| Manager rights | **B by default, C global** — read + management actions; admin can customize via OrgPolicies | Balance autonomy and management needs |

## Team Resolution Engine

### How it works

The system resolves team relationships from existing data:

```
1. Get person_id from JWT claims
2. Find active assignments: SELECT node_id FROM core.assignments WHERE person_id = $1 AND is_primary = true AND end_date IS NULL
3. Find direct reports: SELECT DISTINCT a.person_id FROM core.assignments a
   JOIN core.org_closure oc ON oc.descendant_id = a.node_id
   WHERE oc.ancestor_id = $my_node_id AND oc.depth = 1 AND a.end_date IS NULL
4. Find extended team: same query but depth > 0
5. Find manager: SELECT a.person_id FROM core.assignments a
   JOIN core.org_closure oc ON oc.descendant_id = $my_node_id
   WHERE oc.depth = 1 AND a.assignment_type = 'holder' AND a.end_date IS NULL
6. Find peers: SELECT a.person_id FROM core.assignments a WHERE a.node_id = $my_node_id AND a.person_id != $me
```

### New API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/workforce/my-team | My direct reports (N-1) with presence, workload |
| GET | /api/v1/workforce/my-team/extended | Full subtree (N-1, N-2, ...) |
| GET | /api/v1/workforce/my-team/manager | My manager info |
| GET | /api/v1/workforce/my-team/peers | People at same node |
| GET | /api/v1/workforce/my-team/summary | Aggregated KPIs for my team |
| GET | /api/v1/workforce/my-team/pending-actions | Leaves, timesheets, requests to approve |
| POST | /api/v1/workforce/my-team/leave/:id/approve | Approve leave request |
| POST | /api/v1/workforce/my-team/leave/:id/reject | Reject leave request |
| POST | /api/v1/workforce/my-team/timesheet/:id/approve | Approve timesheet |

### Response shape: GET /api/v1/workforce/my-team

```json
{
  "manager": {
    "person_id": "uuid",
    "first_name": "Marie",
    "last_name": "Dupont",
    "job_title": "VP Engineering",
    "avatar_url": "...",
    "presence_status": "bureau"
  },
  "direct_reports": [
    {
      "person_id": "uuid",
      "first_name": "Jean",
      "last_name": "Martin",
      "job_title": "Senior Developer",
      "department": "Engineering",
      "avatar_url": "...",
      "presence_status": "remote",
      "workload": "medium",
      "active_tasks_count": 5,
      "pending_leave_days": 2,
      "last_activity": "2026-04-11T10:30:00Z"
    }
  ],
  "team_size": 8,
  "has_reports": true
}
```

## Hub Page: /my-team

### Tab 1: Aujourd'hui (landing)

**Presence section:**
- Grid of N-1 avatars with colored status dot (green=bureau, blue=remote, orange=conge, red=absent, grey=offline)
- Count summary: "6 presents, 1 remote, 1 en conge"
- Click avatar → person quick-view popover

**Pending actions section:**
- Cards for each actionable item:
  - Leave requests awaiting approval (name, dates, type, approve/reject buttons)
  - Timesheets awaiting validation (name, week, hours, validate button)
  - Task escalations (overdue tasks assigned to N-1)
- Badge count in sidebar "Mon equipe (3)" showing pending actions

**Team tasks section:**
- Top 5 overdue or blocked tasks across the team
- Grouped by person with status badge
- Click → opens task in Tasks module

**Upcoming section:**
- Next 3 team events (meetings, deadlines, birthdays)
- Team absences for the next 7 days

### Tab 2: Equipe

**Team directory:**
- Card grid or list view (toggle)
- Each person card: avatar, name, title, department, presence status, workload indicator (low/medium/high via colored bar)
- Click person → slide-out panel with:
  - Contact info (email, phone, chat link)
  - Current tasks (top 5)
  - Leave balance
  - Recent activity
  - Org sub-tree (if they manage people too)

**Mini org chart:**
- Compact tree showing: my manager → me → my N-1 (with their N-1 count badges)
- Expandable to show deeper levels
- Click node → navigate to that person's team view

**Quick actions per person:**
- Assign task
- Schedule meeting
- Send message (chat)
- View calendar

### Tab 3: Indicateurs

**KPI cards (top row):**
- Team size (headcount + FTE)
- Average hours logged this week
- Task completion rate (% done vs assigned)
- Presence rate (% days present this month)
- Open leave requests count
- Average workload score

**Charts:**
- Hours logged per person (bar chart, this week)
- Task completion trend (line chart, last 4 weeks)
- Presence heatmap (person x day, last 2 weeks)
- Workload distribution (pie chart: low/medium/high/overloaded)

**Export:**
- Download team report as PDF
- Export data as CSV
- Print-friendly view

## Transversal "Mon equipe" Filter

### Implementation

Each module that supports team filtering gets a toggle button in its toolbar:

```
[👥 Mon equipe]  ← toggle button, highlighted blue when active
```

When active, the module filters its data to only show items related to the user's N-1 list. The N-1 person_ids are cached in the Zustand store after the first `/my-team` call.

### Module-specific behavior

| Module | Filter behavior | Manager actions |
|--------|----------------|-----------------|
| **Taches** | Show tasks assigned to N-1 persons | Reassign task, change priority |
| **Calendrier** | Overlay N-1 calendars (busy/free) | Schedule team meeting |
| **Drive** | Show team-shared folders only | No extra actions |
| **Timesheets** | Show N-1 timesheets for current period | Approve/reject timesheet |
| **Conges/Leave** | Show N-1 leave requests | Approve/reject leave |
| **Presence** | Filter presence table to N-1 only | No extra actions |
| **Projects** | Show projects with N-1 as members | No extra actions |
| **Expenses** | Show N-1 expense reports | Approve/reject expense |

### Toggle persistence

- Stored in localStorage per module: `team-filter:{module}=true|false`
- Persists across page reloads
- Default: off (user must explicitly activate)

## Permissions Model

### Default rights (B) for any person with has_reports=true

| Resource | View | Action |
|----------|------|--------|
| N-1 presence | Yes | No |
| N-1 tasks | Yes (title, status, assignee) | Reassign, comment |
| N-1 calendar | Busy/free only | Schedule meeting |
| N-1 leave requests | Yes | Approve/reject |
| N-1 timesheets | Yes | Approve/reject |
| N-1 expenses | Yes (amounts, categories) | Approve/reject |
| N-1 email | **No** | **No** |
| N-1 private drive | **No** | **No** |
| N-1 notes/keep | **No** | **No** |
| N-1 vault | **No** | **No** |
| N-1 salary/pay | **No** | **No** |

### OrgPolicy overrides (C)

Admin can create policies with domain `team_visibility`:

```json
{
  "name": "Engineering Manager Visibility",
  "domain": "team_visibility",
  "settings": {
    "modules": {
      "tasks": "full",
      "timesheet": "read_only",
      "leave": "approve",
      "expenses": "approve",
      "calendar": "busy_free",
      "drive": "team_shared_only",
      "presence": "full"
    },
    "can_see_salary": false,
    "can_reassign_tasks": true,
    "can_view_performance": true,
    "max_depth": 2
  },
  "priority": 10,
  "is_enforced": true
}
```

Policies are linked to org nodes via `policy_links`. Resolution uses `GET /api/v1/workforce/policies/resolve/{personId}` which walks up the tree and merges policies by priority.

### max_depth control

- `max_depth: 1` → see only direct N-1 (default)
- `max_depth: 2` → see N-1 and N-2 (for directors)
- `max_depth: -1` → see entire subtree (for C-level)

## UI Integration

### Sidebar

New item "Mon equipe" in the "Espace de travail" section:
- Icon: Users
- Badge: pending action count (leave + timesheet approvals)
- Only visible if `has_reports === true` (resolved from /my-team endpoint)
- Position: after "Taches", before "Tableau blanc"

### Header

- Pending actions badge on the existing notification bell includes team approvals
- Context switcher (from unified person model) already shows the active company/role

### Dashboard widget

New widget "Mon equipe" in the dashboard widget catalog:
- Compact view: team presence summary (N present / N total) + pending actions count
- Click → navigates to /my-team
- Auto-refresh every 60s

### Person profile enrichment

When viewing a person's profile (admin or team view), new tab "Equipe":
- Shows their direct reports if they manage people
- Shows their manager
- Shows their peers (same node)
- Links to their /my-team view (if accessible)

## Data Flow

### Frontend state

```typescript
// stores/team-store.ts (Zustand)
interface TeamState {
  myTeam: TeamMember[] | null;
  manager: TeamManager | null;
  pendingActions: PendingAction[];
  teamFilterActive: Record<string, boolean>; // per module
  hasReports: boolean;
  isLoading: boolean;
  fetchMyTeam: () => Promise<void>;
  toggleTeamFilter: (module: string) => void;
}
```

### API client

```typescript
// lib/api/my-team.ts
export const myTeamApi = {
  getTeam: () => client.get("/workforce/my-team"),
  getExtended: () => client.get("/workforce/my-team/extended"),
  getManager: () => client.get("/workforce/my-team/manager"),
  getPeers: () => client.get("/workforce/my-team/peers"),
  getSummary: () => client.get("/workforce/my-team/summary"),
  getPendingActions: () => client.get("/workforce/my-team/pending-actions"),
  approveLeave: (id: string) => client.post(`/workforce/my-team/leave/${id}/approve`),
  rejectLeave: (id: string, reason?: string) => client.post(`/workforce/my-team/leave/${id}/reject`, { reason }),
  approveTimesheet: (id: string) => client.post(`/workforce/my-team/timesheet/${id}/approve`),
};
```

## PgEventBus Events

| Event | Payload | Consumers |
|-------|---------|-----------|
| `team.leave_requested` | `{person_id, manager_id, dates, type}` | Notifications (notify manager) |
| `team.leave_approved` | `{person_id, approved_by, dates}` | Calendar (block dates), Notifications |
| `team.leave_rejected` | `{person_id, rejected_by, reason}` | Notifications |
| `team.timesheet_submitted` | `{person_id, manager_id, week}` | Notifications |
| `team.task_overdue` | `{task_id, assignee_id, manager_id}` | Notifications, Dashboard |
| `assignment.changed` | `{person_id, old_node, new_node}` | Team cache invalidation |

## E2E Assertions

- /my-team page loads for a user with direct reports
- /my-team shows "Aucun rapport direct" for users without reports
- Aujourd'hui tab shows presence grid and pending actions
- Equipe tab shows team member cards with presence status
- Indicateurs tab shows KPI cards and charts
- "Mon equipe" toggle appears in Tasks module toolbar for managers
- "Mon equipe" toggle does NOT appear for non-managers
- Approving a leave request from /my-team works
- Team filter in Tasks shows only N-1 tasks
- Sidebar shows "Mon equipe" item with badge count
- Dashboard widget shows team summary
- OrgPolicy with max_depth=2 shows N-2 in extended view
