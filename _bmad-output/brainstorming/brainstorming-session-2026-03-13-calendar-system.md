---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: []
session_topic: 'SignApps Calendar System Refactoring - Multi-type Calendar, Tasks, Projects & Templates'
session_goals: 'Design unified system for calendars (equipment, room, personal, group, enterprise), tasks/subtasks, projects with templates, and integrated view'
selected_approach: 'ai-recommended'
techniques_used: ['morphological-analysis', 'cross-pollination', 'scamper', 'solution-matrix']
ideas_generated: [150+]
context_file: ''
constraints:
  license: 'Apache 2.0 or MIT only'
  backend: 'Rust only'
  stack: 'Next.js 16 + React 19 + PostgreSQL'
  optimization: 'Performance, scalability, offline-first'
---

# Brainstorming Session Results - SignApps Calendar System

**Facilitator:** Etienne
**Date:** 2026-03-13
**Duration:** Automatic Mode

---

## Constraints & Requirements

| Constraint | Value |
|------------|-------|
| **License** | Apache 2.0 or MIT only |
| **Backend** | Rust only (Axum/Tokio) |
| **Frontend** | Next.js 16 + React 19 |
| **Database** | PostgreSQL with proper indexing |
| **Collaboration** | Real-time via Yjs/WebSocket |

---

## User Requirements Summary

The user wants a comprehensive calendar system that can:

1. **Different Calendar Types:**
   - Equipment reservation (matériel)
   - Room reservation (salle)
   - Personal calendar (perso)
   - Group calendar (groupe)
   - Enterprise calendar (entreprise)

2. **Task Management:**
   - Tasks with subtasks
   - Task hierarchy
   - Task scheduling in calendar

3. **Project Management:**
   - Projects containing tasks/subtasks
   - Project templates
   - Task templates
   - Subtask templates

4. **Unified View:**
   - Calendar + Projects + Tasks in single view
   - Filter by type
   - Drag & drop between views

5. **Entity Management (NEW):**
   - Create/manage Equipment
   - Create/manage Rooms
   - Create/manage People (users)
   - Create/manage Groups
   - Create/manage Enterprises/Organizations

6. **Multi-Tenant Architecture (NEW):**
   - Full tenant isolation
   - Tenant-specific data
   - Cross-tenant sharing capabilities
   - Tenant-level configuration and branding

---

## PHASE 1: MORPHOLOGICAL ANALYSIS

### Dimension Matrix - Calendar System

| Dimension | Options |
|-----------|---------|
| **Calendar Types** | Personal, Group, Enterprise, Equipment Reservation, Room Reservation, Shared, External (Google/Outlook sync) |
| **Event Types** | Simple Event, All-day Event, Recurring Event, Reservation, Task-linked Event, Meeting, Reminder, Milestone |
| **Task Types** | Simple Task, Subtask, Recurring Task, Deadline Task, Milestone, Checklist Item |
| **Project Types** | Simple Project, Template-based Project, Recurring Project, Sprint, Epic, Kanban Board |
| **View Modes** | Month, Week, Day, Agenda, Timeline (Gantt), Kanban, List, Calendar+Tasks Hybrid |
| **Reservation Features** | Availability checking, Conflict detection, Approval workflow, Waitlist, Recurring reservations |
| **Template Features** | Project templates, Task templates, Event templates, Checklist templates |
| **Collaboration** | Real-time sync, Shared access, Permissions, Comments, Notifications |

### Entity Relationships

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CALENDAR SYSTEM SCHEMA                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                 │
│  │   Workspace  │────<│   Calendar   │────<│    Event     │                 │
│  └──────────────┘     └──────────────┘     └──────────────┘                 │
│         │                    │                    │                          │
│         │                    │                    │                          │
│         ▼                    ▼                    ▼                          │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                 │
│  │   Project    │────<│    Task      │────<│   Subtask    │                 │
│  └──────────────┘     └──────────────┘     └──────────────┘                 │
│         │                    │                                               │
│         │                    │                                               │
│         ▼                    ▼                                               │
│  ┌──────────────┐     ┌──────────────┐                                      │
│  │  Template    │     │  Event Link  │ (Task can create calendar event)     │
│  │  (Project/   │     └──────────────┘                                      │
│  │   Task/Sub)  │                                                            │
│  └──────────────┘                                                            │
│                                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                 │
│  │   Resource   │────<│ Reservation  │     │  Recurrence  │                 │
│  │ (Room/Equip) │     │    Slot      │     │    Rule      │                 │
│  └──────────────┘     └──────────────┘     └──────────────┘                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## PHASE 2: CROSS-POLLINATION

### Calendar Applications Analysis

| App | Key Features to Adopt |
|-----|----------------------|
| **Google Calendar** | Multiple calendars, color coding, quick add, keyboard shortcuts, smart suggestions |
| **Outlook Calendar** | Scheduling assistant, room booking, categories, tasks integration |
| **Notion Calendar** | Database-backed events, templates, relational links to pages/databases |
| **Asana** | Timeline view, project templates, task dependencies, milestones |
| **Monday.com** | Workspaces, dashboards, automations, multiple views per project |
| **ClickUp** | Everything app concept, custom fields, task-calendar sync, goals |
| **Todoist** | Natural language input, recurring patterns, labels, priorities |
| **Calendly** | Availability slots, booking links, buffer times, integrations |
| **Microsoft Bookings** | Resource scheduling, services, staff assignment, customer booking |
| **Robin** | Office space booking, desk hoteling, room displays, analytics |

### Feature Extraction

**From Google Calendar:**
- Multiple calendar layers with visibility toggles
- Drag to create events
- Quick actions (duplicate, move, delete)
- Keyboard shortcuts throughout
- Smart event creation from text

**From Notion:**
- Everything is a database entry
- Relational properties between databases
- Templates at every level
- Views are just filters on same data
- Inline editing everywhere

**From Asana/Monday:**
- Projects as containers for tasks
- Multiple views of same data (list, board, timeline, calendar)
- Custom fields per workspace
- Dependencies and blockers
- Milestones and goals

**From Resource Booking Apps:**
- Resource availability grid
- Conflict prevention
- Approval workflows
- Buffer times between bookings
- Recurring availability patterns

---

## PHASE 3: SCAMPER ANALYSIS

### S - SUBSTITUTE

| ID | Idea | Detail |
|----|------|--------|
| S1 | **Replace separate calendar/task/project apps** | Single unified system with consistent UX |
| S2 | **Replace static templates → dynamic templates** | Templates that can include conditions and defaults |
| S3 | **Replace manual recurring setup → natural language** | "Every Monday at 9am for 3 months" |
| S4 | **Replace fixed views → user-defined views** | Custom view builder with filters/grouping |
| S5 | **Replace single timezone → multi-timezone** | Events show in viewer's timezone, resources in their timezone |

### C - COMBINE

| ID | Idea | Detail |
|----|------|--------|
| C1 | **Calendar + Task list + Project board** | Single unified interface with context switching |
| C2 | **Event + Task** | Tasks can have calendar presence (blocking time) |
| C3 | **Project template + Checklist template** | Hierarchical template system |
| C4 | **Reservation + Event** | Reservations are events with resource attachment |
| C5 | **Personal + Group calendars** | Layered view with permission-based filtering |

### A - ADAPT

| ID | Idea | Detail |
|----|------|--------|
| A1 | **Adapt Notion's relational model** | Everything connects to everything via relations |
| A2 | **Adapt Kanban for calendar** | Drag tasks between date columns |
| A3 | **Adapt Git's branching for projects** | Clone project template, modify, track changes |
| A4 | **Adapt permission model from file systems** | Owner, Editor, Viewer roles per resource |
| A5 | **Adapt iCal standard for data model** | VEVENT, VTODO, VJOURNAL as base types |

### M - MODIFY

| ID | Idea | Detail |
|----|------|--------|
| M1 | **Modify views to be composable** | Mix calendar + task list + timeline in single view |
| M2 | **Modify templates to be live** | Update template, option to propagate to instances |
| M3 | **Modify recurrence to handle exceptions** | Skip holidays, substitute dates |
| M4 | **Modify notifications to be smart** | Context-aware (location, priority, availability) |
| M5 | **Modify search to span all entities** | Search events, tasks, projects, resources together |

### P - PUT TO OTHER USES

| ID | Idea | Detail |
|----|------|--------|
| P1 | **Calendar as inventory tracker** | Equipment status over time |
| P2 | **Calendar as audit log** | Historical view of what happened when |
| P3 | **Projects as goal tracker** | Progress visualization toward objectives |
| P4 | **Templates as onboarding tool** | New employee setup project template |
| P5 | **Reservations as capacity planning** | Analyze resource utilization |

### E - ELIMINATE

| ID | Idea | Detail |
|----|------|--------|
| E1 | **Eliminate separate databases** | Single unified data model |
| E2 | **Eliminate context switching** | Stay in one app for all scheduling needs |
| E3 | **Eliminate manual sync** | Real-time collaboration built-in |
| E4 | **Eliminate duplicate entry** | Enter once, appear everywhere relevant |
| E5 | **Eliminate permission complexity** | Simple, inherited permission model |

### R - REVERSE

| ID | Idea | Detail |
|----|------|--------|
| R1 | **Resource-first scheduling** | Start from "when is room X free?" not "I need a room at 2pm" |
| R2 | **Deadline-first planning** | Work backwards from deadline to schedule tasks |
| R3 | **Template-first creation** | Always start from template, customize as needed |
| R4 | **Calendar as consequence** | Tasks create calendar blocks, not vice versa |
| R5 | **Availability-first booking** | Show available slots, user picks one |

---

## PHASE 4: SOLUTION MATRIX

### Priority Scoring (1-5, 5=highest)

| Feature | User Value | Dev Effort | Impact | Priority |
|---------|------------|------------|--------|----------|
| **Core Calendar (multi-type)** | 5 | 4 | 5 | P0 |
| **Task management** | 5 | 3 | 5 | P0 |
| **Subtasks** | 4 | 2 | 4 | P0 |
| **Projects** | 5 | 4 | 5 | P0 |
| **Project templates** | 4 | 3 | 4 | P1 |
| **Task templates** | 4 | 2 | 3 | P1 |
| **Resource reservation** | 5 | 4 | 5 | P1 |
| **Unified view** | 5 | 4 | 5 | P1 |
| **Recurring patterns** | 4 | 3 | 4 | P1 |
| **Conflict detection** | 4 | 3 | 4 | P2 |
| **Approval workflows** | 3 | 4 | 3 | P2 |
| **Calendar sync (external)** | 3 | 4 | 3 | P3 |
| **Natural language input** | 3 | 4 | 3 | P3 |
| **Analytics/reports** | 3 | 3 | 3 | P3 |

---

## GENERATED IDEAS - Complete Catalog

### Epic 1: Data Model Foundation (25 ideas)

| # | Idea | Priority | Effort |
|---|------|----------|--------|
| 1.1 | Create `calendars` table with type enum (personal, group, enterprise, resource) | P0 | S |
| 1.2 | Create `events` table with polymorphic event_type | P0 | M |
| 1.3 | Create `tasks` table with parent_task_id for hierarchy | P0 | M |
| 1.4 | Create `projects` table with workspace relationship | P0 | M |
| 1.5 | Create `resources` table for rooms/equipment | P0 | M |
| 1.6 | Create `reservations` table linking events to resources | P0 | M |
| 1.7 | Create `templates` table with template_type enum | P1 | M |
| 1.8 | Create `template_items` for template content | P1 | M |
| 1.9 | Create `recurrence_rules` table (RFC 5545 RRULE) | P1 | L |
| 1.10 | Create `calendar_memberships` for shared access | P0 | S |
| 1.11 | Create `task_events` junction for task-calendar linking | P0 | S |
| 1.12 | Create `project_tasks` ordered task list | P0 | S |
| 1.13 | Implement soft delete across all entities | P0 | S |
| 1.14 | Add `metadata` JSONB columns for extensibility | P1 | S |
| 1.15 | Create indexes for date range queries | P0 | S |
| 1.16 | Create indexes for resource availability | P1 | S |
| 1.17 | Implement row-level security | P1 | M |
| 1.18 | Add audit log triggers | P2 | M |
| 1.19 | Create `labels` table for categorization | P2 | S |
| 1.20 | Create `entity_labels` junction table | P2 | S |
| 1.21 | Add `priority` enum to tasks (none, low, medium, high, urgent) | P1 | S |
| 1.22 | Add `status` enum to tasks (todo, in_progress, done, cancelled) | P0 | S |
| 1.23 | Add `color` column to calendars/projects | P1 | S |
| 1.24 | Create `notifications` table for reminders | P2 | M |
| 1.25 | Create `availability_patterns` for resources | P2 | L |

### Epic 2: Multi-Tenant & Entity Management API (25 ideas)

| # | Idea | Priority | Effort |
|---|------|----------|--------|
| 2.1 | `POST /tenants` - Create tenant (enterprise/org) | P0 | M |
| 2.2 | `GET /tenants/:id` - Get tenant details | P0 | S |
| 2.3 | `PUT /tenants/:id` - Update tenant settings | P0 | S |
| 2.4 | `POST /tenants/:id/users` - Add user to tenant | P0 | M |
| 2.5 | `GET /tenants/:id/users` - List tenant users | P0 | S |
| 2.6 | `PUT /tenants/:id/users/:userId` - Update user role | P0 | S |
| 2.7 | `DELETE /tenants/:id/users/:userId` - Remove user | P0 | S |
| 2.8 | `POST /workspaces` - Create workspace (group) | P0 | S |
| 2.9 | `GET /workspaces` - List workspaces | P0 | S |
| 2.10 | `PUT /workspaces/:id` - Update workspace | P0 | S |
| 2.11 | `POST /workspaces/:id/members` - Add member | P0 | S |
| 2.12 | `DELETE /workspaces/:id/members/:userId` - Remove member | P0 | S |
| 2.13 | `POST /resource-types` - Create resource type | P1 | S |
| 2.14 | `GET /resource-types` - List resource types | P1 | S |
| 2.15 | `POST /resources` - Create resource (room/equipment) | P1 | M |
| 2.16 | `GET /resources` - List resources with filters | P1 | M |
| 2.17 | `PUT /resources/:id` - Update resource | P1 | S |
| 2.18 | `DELETE /resources/:id` - Archive resource | P1 | S |
| 2.19 | `GET /resources/:id/availability` - Get availability | P1 | M |
| 2.20 | `PUT /resources/:id/availability-rules` - Set rules | P2 | M |
| 2.21 | Middleware: Extract tenant_id from JWT | P0 | M |
| 2.22 | Middleware: Set tenant context for RLS | P0 | M |
| 2.23 | `GET /me` - Current user with tenant info | P0 | S |
| 2.24 | `POST /tenants/:id/invite` - Send invitation | P1 | M |
| 2.25 | `POST /invitations/:token/accept` - Accept invite | P1 | M |

### Epic 3: Calendar Core API (20 ideas)

| # | Idea | Priority | Effort |
|---|------|----------|--------|
| 2.1 | `POST /calendars` - Create calendar with type | P0 | S |
| 2.2 | `GET /calendars` - List user's calendars | P0 | S |
| 2.3 | `GET /calendars/:id/events` - Events in date range | P0 | M |
| 2.4 | `POST /events` - Create event | P0 | M |
| 2.5 | `PUT /events/:id` - Update event | P0 | M |
| 2.6 | `DELETE /events/:id` - Delete event | P0 | S |
| 2.7 | `POST /events/:id/recurrence` - Set recurrence | P1 | L |
| 2.8 | `GET /events/:id/occurrences` - Expand recurring | P1 | M |
| 2.9 | `PUT /events/:id/occurrences/:date` - Modify single occurrence | P2 | M |
| 2.10 | `POST /calendars/:id/share` - Share calendar | P1 | M |
| 2.11 | `GET /calendars/unified` - All calendars merged | P1 | M |
| 2.12 | `POST /events/quick` - Natural language create | P3 | L |
| 2.13 | `GET /calendars/:id/free-busy` - Availability query | P1 | M |
| 2.14 | `POST /events/import` - Import iCal | P3 | L |
| 2.15 | `GET /events/export` - Export iCal | P3 | M |
| 2.16 | `POST /calendars/:id/subscribe` - External calendar | P3 | L |
| 2.17 | `GET /events/search` - Full-text search | P2 | M |
| 2.18 | `POST /events/batch` - Bulk operations | P2 | M |
| 2.19 | `GET /events/upcoming` - Next N events | P1 | S |
| 2.20 | `WebSocket /calendars/live` - Real-time updates | P1 | L |

### Epic 4: Task Management API (18 ideas)

| # | Idea | Priority | Effort |
|---|------|----------|--------|
| 3.1 | `POST /tasks` - Create task | P0 | S |
| 3.2 | `GET /tasks` - List with filters | P0 | M |
| 3.3 | `PUT /tasks/:id` - Update task | P0 | S |
| 3.4 | `DELETE /tasks/:id` - Delete task and subtasks | P0 | M |
| 3.5 | `POST /tasks/:id/subtasks` - Add subtask | P0 | S |
| 3.6 | `PUT /tasks/reorder` - Reorder tasks | P1 | M |
| 3.7 | `PUT /tasks/:id/move` - Move to different parent | P1 | M |
| 3.8 | `POST /tasks/:id/schedule` - Create calendar event | P1 | M |
| 3.9 | `GET /tasks/tree` - Hierarchical tree view | P1 | M |
| 3.10 | `PUT /tasks/:id/status` - Quick status change | P0 | S |
| 3.11 | `PUT /tasks/:id/assign` - Assign to user | P1 | S |
| 3.12 | `GET /tasks/my` - My assigned tasks | P0 | S |
| 3.13 | `GET /tasks/overdue` - Overdue tasks | P1 | S |
| 3.14 | `POST /tasks/:id/duplicate` - Duplicate task tree | P2 | M |
| 3.15 | `PUT /tasks/:id/priority` - Set priority | P1 | S |
| 3.16 | `POST /tasks/:id/dependencies` - Add dependency | P2 | M |
| 3.17 | `GET /tasks/:id/dependencies` - Get dependencies | P2 | S |
| 3.18 | `POST /tasks/from-template` - Create from template | P1 | M |

### Epic 5: Project Management API (15 ideas)

| # | Idea | Priority | Effort |
|---|------|----------|--------|
| 4.1 | `POST /projects` - Create project | P0 | S |
| 4.2 | `GET /projects` - List projects | P0 | S |
| 4.3 | `GET /projects/:id` - Project details with tasks | P0 | M |
| 4.4 | `PUT /projects/:id` - Update project | P0 | S |
| 4.5 | `DELETE /projects/:id` - Archive project | P0 | S |
| 4.6 | `POST /projects/:id/tasks` - Add task to project | P0 | S |
| 4.7 | `GET /projects/:id/progress` - Completion stats | P1 | M |
| 4.8 | `POST /projects/:id/calendar` - Create project calendar | P1 | M |
| 4.9 | `GET /projects/:id/timeline` - Gantt view data | P2 | L |
| 4.10 | `POST /projects/:id/milestones` - Add milestone | P2 | M |
| 4.11 | `POST /projects/from-template` - Create from template | P1 | M |
| 4.12 | `PUT /projects/:id/members` - Manage access | P1 | M |
| 4.13 | `GET /projects/:id/activity` - Activity feed | P2 | M |
| 4.14 | `POST /projects/:id/duplicate` - Clone project | P2 | M |
| 4.15 | `PUT /projects/:id/status` - Set project status | P1 | S |

### Epic 6: Template System (12 ideas)

| # | Idea | Priority | Effort |
|---|------|----------|--------|
| 5.1 | `POST /templates` - Create template | P1 | M |
| 5.2 | `GET /templates` - List templates by type | P1 | S |
| 5.3 | `GET /templates/:id` - Template with items | P1 | M |
| 5.4 | `PUT /templates/:id` - Update template | P1 | M |
| 5.5 | `DELETE /templates/:id` - Delete template | P1 | S |
| 5.6 | `POST /templates/:id/instantiate` - Create from template | P1 | L |
| 5.7 | `POST /templates/from-project` - Save project as template | P2 | M |
| 5.8 | `POST /templates/from-task` - Save task tree as template | P2 | M |
| 5.9 | `POST /templates/:id/duplicate` - Clone template | P2 | S |
| 5.10 | `GET /templates/gallery` - Public template gallery | P3 | M |
| 5.11 | `POST /templates/:id/share` - Share template | P3 | M |
| 5.12 | Template variable substitution ({{project_name}}, {{due_date}}) | P2 | L |

### Epic 7: Resource Reservation (15 ideas)

| # | Idea | Priority | Effort |
|---|------|----------|--------|
| 6.1 | `POST /resources` - Create resource (room/equipment) | P1 | M |
| 6.2 | `GET /resources` - List resources by type | P1 | S |
| 6.3 | `GET /resources/:id/availability` - Available slots | P1 | M |
| 6.4 | `POST /resources/:id/reserve` - Create reservation | P1 | M |
| 6.5 | `PUT /reservations/:id` - Modify reservation | P1 | M |
| 6.6 | `DELETE /reservations/:id` - Cancel reservation | P1 | S |
| 6.7 | Conflict detection on reservation | P1 | M |
| 6.8 | `POST /resources/:id/availability-pattern` - Set availability hours | P2 | L |
| 6.9 | `POST /reservations/:id/approve` - Approval workflow | P2 | M |
| 6.10 | `GET /resources/:id/calendar` - Resource calendar view | P1 | M |
| 6.11 | Buffer time between reservations | P2 | M |
| 6.12 | Recurring reservations | P2 | L |
| 6.13 | Waitlist for fully booked resources | P3 | L |
| 6.14 | Check-in/check-out tracking | P3 | M |
| 6.15 | Resource utilization analytics | P3 | L |

### Epic 8: Frontend Components (30 ideas)

| # | Idea | Priority | Effort |
|---|------|----------|--------|
| 7.1 | `<CalendarGrid>` - Month/week/day views | P0 | L |
| 7.2 | `<EventCard>` - Event display in grid | P0 | M |
| 7.3 | `<TaskList>` - Hierarchical task list | P0 | M |
| 7.4 | `<TaskItem>` - Single task with subtasks | P0 | M |
| 7.5 | `<ProjectBoard>` - Project overview | P0 | L |
| 7.6 | `<UnifiedView>` - Calendar + Tasks + Projects | P1 | XL |
| 7.7 | `<TimelineView>` - Gantt-like timeline | P2 | XL |
| 7.8 | `<ResourceGrid>` - Availability grid | P1 | L |
| 7.9 | `<ReservationDialog>` - Book resource | P1 | M |
| 7.10 | `<EventDialog>` - Create/edit event | P0 | M |
| 7.11 | `<TaskDialog>` - Create/edit task | P0 | M |
| 7.12 | `<ProjectDialog>` - Create/edit project | P0 | M |
| 7.13 | `<TemplateSelector>` - Choose template | P1 | M |
| 7.14 | `<TemplateBrowser>` - Browse templates | P2 | M |
| 7.15 | `<CalendarSidebar>` - Calendar list/toggles | P0 | M |
| 7.16 | `<MiniCalendar>` - Date picker | P0 | S |
| 7.17 | `<DateRangePicker>` - Date range selection | P1 | M |
| 7.18 | `<RecurrenceEditor>` - Recurrence rule builder | P1 | L |
| 7.19 | `<DragDropProvider>` - Drag events between dates | P1 | L |
| 7.20 | `<QuickAdd>` - Keyboard-driven quick add | P2 | M |
| 7.21 | `<FilterBar>` - Filter by calendar/type/status | P1 | M |
| 7.22 | `<ViewSwitcher>` - Switch between views | P0 | S |
| 7.23 | `<TaskProgress>` - Progress indicators | P1 | S |
| 7.24 | `<ProjectProgress>` - Project completion | P1 | S |
| 7.25 | `<AgendaView>` - List of upcoming items | P1 | M |
| 7.26 | `<TenantSettings>` - Tenant configuration | P1 | M |
| 7.27 | `<UserManager>` - Manage tenant users | P1 | L |
| 7.28 | `<WorkspaceManager>` - Manage workspaces/groups | P1 | M |
| 7.29 | `<ResourceManager>` - Manage rooms/equipment | P1 | L |
| 7.30 | `<InviteUsers>` - Invite users to tenant | P1 | M |

### Epic 9: State Management (12 ideas)

| # | Idea | Priority | Effort |
|---|------|----------|--------|
| 8.1 | Zustand store: `calendar-store.ts` | P0 | M |
| 8.2 | Zustand store: `task-store.ts` | P0 | M |
| 8.3 | Zustand store: `project-store.ts` | P0 | M |
| 8.4 | Zustand store: `resource-store.ts` | P1 | M |
| 8.5 | Zustand store: `template-store.ts` | P1 | M |
| 8.6 | TanStack Query for API caching | P0 | M |
| 8.7 | Optimistic updates for drag/drop | P1 | L |
| 8.8 | Real-time sync via WebSocket | P1 | L |
| 8.9 | Offline-first with IndexedDB | P2 | XL |
| 8.10 | Undo/redo stack for operations | P2 | L |
| 8.11 | Zustand store: `tenant-store.ts` | P0 | M |
| 8.12 | Zustand store: `workspace-store.ts` | P0 | M |

### Epic 10: Real-time & Collaboration (10 ideas)

| # | Idea | Priority | Effort |
|---|------|----------|--------|
| 9.1 | WebSocket subscription for calendar updates | P1 | L |
| 9.2 | Presence indicators (who's viewing) | P2 | M |
| 9.3 | Live cursor positions on calendar | P3 | L |
| 9.4 | Conflict resolution for concurrent edits | P1 | L |
| 9.5 | Push notifications for reminders | P2 | L |
| 9.6 | Email notifications for invitations | P2 | M |
| 9.7 | Activity feed per project | P2 | M |
| 9.8 | Comments on tasks/events | P2 | M |
| 9.9 | Mentions (@user) in comments | P3 | M |
| 9.10 | Real-time typing indicators | P3 | M |

---

## ARCHITECTURE PROPOSAL

### Multi-Tenant Data Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      MULTI-TENANT ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐                                                            │
│  │   Tenant     │ (Enterprise/Organization)                                  │
│  │   ━━━━━━━━   │                                                            │
│  │  - id        │                                                            │
│  │  - name      │                                                            │
│  │  - slug      │                                                            │
│  │  - settings  │                                                            │
│  └──────┬───────┘                                                            │
│         │                                                                    │
│         ├─────────────────────────────────┐                                  │
│         │                                 │                                  │
│         ▼                                 ▼                                  │
│  ┌──────────────┐                  ┌──────────────┐                          │
│  │  Workspace   │                  │    User      │                          │
│  │  (Groups)    │                  │  (People)    │                          │
│  └──────┬───────┘                  └──────┬───────┘                          │
│         │                                 │                                  │
│         ├────────────┬────────────┬───────┘                                  │
│         │            │            │                                          │
│         ▼            ▼            ▼                                          │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                          │
│  │  Calendar    │ │   Project    │ │   Resource   │                          │
│  └──────────────┘ └──────────────┘ │ (Room/Equip) │                          │
│         │                │         └──────────────┘                          │
│         ▼                ▼                │                                  │
│  ┌──────────────┐ ┌──────────────┐        │                                  │
│  │    Event     │ │    Task      │◄───────┘                                  │
│  └──────────────┘ └──────────────┘                                           │
│                          │                                                   │
│                          ▼                                                   │
│                   ┌──────────────┐                                           │
│                   │   Subtask    │                                           │
│                   └──────────────┘                                           │
│                                                                              │
│  ALL TABLES HAVE tenant_id FOR ISOLATION                                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Database Schema (PostgreSQL)

```sql
-- =====================================================
-- MULTI-TENANT FOUNDATION
-- =====================================================

-- Tenants (Enterprises/Organizations)
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL, -- URL-friendly identifier
    domain VARCHAR(255), -- Custom domain
    logo_url TEXT,
    settings JSONB DEFAULT '{}', -- Tenant-specific config
    plan VARCHAR(50) DEFAULT 'free', -- 'free', 'pro', 'enterprise'
    max_users INTEGER DEFAULT 5,
    max_resources INTEGER DEFAULT 10,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users (People)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    role VARCHAR(50) DEFAULT 'member', -- 'owner', 'admin', 'member', 'guest'
    department VARCHAR(100),
    job_title VARCHAR(100),
    phone VARCHAR(50),
    timezone VARCHAR(50) DEFAULT 'UTC',
    locale VARCHAR(10) DEFAULT 'fr',
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, email)
);

-- Workspaces (Groups within tenant)
CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#6366F1',
    icon VARCHAR(50),
    is_default BOOLEAN DEFAULT FALSE,
    settings JSONB DEFAULT '{}',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workspace Members
CREATE TABLE workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member', -- 'owner', 'admin', 'member', 'viewer'
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, user_id)
);

-- =====================================================
-- RESOURCE MANAGEMENT (Rooms, Equipment)
-- =====================================================

-- Resource Types for the tenant
CREATE TABLE resource_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- 'room', 'equipment', 'vehicle', 'desk'
    icon VARCHAR(50),
    color VARCHAR(7),
    requires_approval BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Resources (Rooms, Equipment, etc.)
CREATE TABLE resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    resource_type_id UUID REFERENCES resource_types(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    capacity INTEGER,
    location VARCHAR(255),
    floor VARCHAR(50),
    building VARCHAR(100),
    amenities TEXT[], -- ['projector', 'whiteboard', 'video_conference']
    photo_urls TEXT[],
    calendar_id UUID, -- Will be set after calendar creation
    availability_rules JSONB DEFAULT '{}',
    booking_rules JSONB DEFAULT '{}', -- min/max duration, advance notice
    requires_approval BOOLEAN DEFAULT FALSE,
    approver_ids UUID[],
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Calendar Types
CREATE TYPE calendar_type AS ENUM (
    'personal', 'group', 'enterprise',
    'resource_room', 'resource_equipment'
);

-- Event Types
CREATE TYPE event_type AS ENUM (
    'event', 'all_day', 'meeting',
    'reservation', 'reminder', 'milestone'
);

-- Task Status
CREATE TYPE task_status AS ENUM (
    'todo', 'in_progress', 'done', 'cancelled'
);

-- Task Priority
CREATE TYPE task_priority AS ENUM (
    'none', 'low', 'medium', 'high', 'urgent'
);

-- Template Types
CREATE TYPE template_type AS ENUM (
    'project', 'task', 'event', 'checklist'
);

-- Calendars (ALL have tenant_id for isolation)
CREATE TABLE calendars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    calendar_type calendar_type NOT NULL,
    color VARCHAR(7) DEFAULT '#3B82F6',
    owner_id UUID REFERENCES users(id),
    resource_id UUID REFERENCES resources(id), -- For resource calendars
    is_default BOOLEAN DEFAULT FALSE,
    is_public BOOLEAN DEFAULT FALSE, -- Visible to all tenant members
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Events (tenant_id denormalized for efficient queries)
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    calendar_id UUID REFERENCES calendars(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    event_type event_type DEFAULT 'event',
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    all_day BOOLEAN DEFAULT FALSE,
    location VARCHAR(255),
    recurrence_rule TEXT, -- RRULE format
    recurrence_id UUID, -- Parent recurring event
    original_start_at TIMESTAMPTZ, -- For exceptions
    resource_id UUID REFERENCES resources(id),
    metadata JSONB DEFAULT '{}',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Projects (tenant_id for isolation)
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#10B981',
    status VARCHAR(50) DEFAULT 'active',
    start_date DATE,
    due_date DATE,
    calendar_id UUID REFERENCES calendars(id),
    template_id UUID REFERENCES templates(id),
    owner_id UUID REFERENCES users(id),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Tasks (tenant_id denormalized for efficient queries)
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status task_status DEFAULT 'todo',
    priority task_priority DEFAULT 'none',
    due_date DATE,
    due_time TIME,
    estimated_hours DECIMAL(5,2),
    position INTEGER DEFAULT 0, -- For ordering
    assignee_id UUID REFERENCES users(id),
    event_id UUID REFERENCES events(id), -- Linked calendar event
    template_id UUID REFERENCES templates(id),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

-- Note: Resources table already defined above in Multi-Tenant Foundation section

-- Templates (tenant_id for isolation)
CREATE TABLE templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    template_type template_type NOT NULL,
    content JSONB NOT NULL, -- Template structure
    is_public BOOLEAN DEFAULT FALSE,
    usage_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Calendar Memberships (sharing)
CREATE TABLE calendar_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calendar_id UUID REFERENCES calendars(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'viewer', -- 'owner', 'editor', 'viewer'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(calendar_id, user_id)
);

-- Event Attendees
CREATE TABLE event_attendees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'accepted', 'declined', 'tentative'
    response_at TIMESTAMPTZ,
    UNIQUE(event_id, user_id)
);

-- Labels (tenant_id for isolation)
CREATE TABLE labels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(id),
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Entity Labels (polymorphic)
CREATE TABLE entity_labels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label_id UUID REFERENCES labels(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL, -- 'event', 'task', 'project'
    entity_id UUID NOT NULL
);

-- =====================================================
-- ROW LEVEL SECURITY (Multi-tenant isolation)
-- =====================================================

-- Enable RLS on all tenant-scoped tables
ALTER TABLE calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

-- RLS Policies (example for calendars)
CREATE POLICY tenant_isolation_calendars ON calendars
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_events ON events
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_projects ON projects
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_tasks ON tasks
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- =====================================================
-- INDEXES (optimized for multi-tenant queries)
-- =====================================================

-- Tenant-first indexes for all queries
CREATE INDEX idx_calendars_tenant ON calendars(tenant_id, id);
CREATE INDEX idx_events_tenant_calendar ON events(tenant_id, calendar_id, start_at, end_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_events_tenant_resource ON events(tenant_id, resource_id, start_at, end_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_tenant_project ON tasks(tenant_id, project_id, position) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_tenant_parent ON tasks(tenant_id, parent_task_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_tenant_assignee ON tasks(tenant_id, assignee_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_tenant ON projects(tenant_id, workspace_id);
CREATE INDEX idx_resources_tenant ON resources(tenant_id, resource_type_id);
CREATE INDEX idx_workspaces_tenant ON workspaces(tenant_id);
CREATE INDEX idx_users_tenant ON users(tenant_id, email);
CREATE INDEX idx_calendar_memberships ON calendar_memberships(user_id, calendar_id);

-- =====================================================
-- RESERVATIONS (Booking system)
-- =====================================================

CREATE TABLE reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    resource_id UUID REFERENCES resources(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    requested_by UUID REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'cancelled'
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reservations_tenant ON reservations(tenant_id, resource_id, status);
```

### Frontend Architecture

```
src/
├── components/
│   └── admin/
│       ├── TenantSettings.tsx     # Tenant configuration
│       ├── UserManager.tsx        # Manage users
│       ├── WorkspaceManager.tsx   # Manage groups
│       ├── ResourceManager.tsx    # Manage rooms/equipment
│       ├── ResourceEditor.tsx     # Create/edit resource
│       ├── InviteUsers.tsx        # Send invitations
│       └── RoleSelector.tsx       # Role assignment
│   └── calendar/
│       ├── CalendarView.tsx       # Main calendar container
│       ├── MonthCalendar.tsx      # Month grid view
│       ├── WeekCalendar.tsx       # Week view
│       ├── DayCalendar.tsx        # Day view
│       ├── AgendaView.tsx         # List view
│       ├── TimelineView.tsx       # Gantt-like view
│       ├── UnifiedView.tsx        # Calendar + Tasks + Projects
│       ├── EventCard.tsx          # Event display
│       ├── EventDialog.tsx        # Create/edit event
│       ├── MiniCalendar.tsx       # Date picker
│       ├── CalendarSidebar.tsx    # Calendar list
│       └── RecurrenceEditor.tsx   # RRULE builder
│   └── tasks/
│       ├── TaskList.tsx           # Task list container
│       ├── TaskItem.tsx           # Single task + subtasks
│       ├── TaskDialog.tsx         # Create/edit task
│       ├── TaskTree.tsx           # Hierarchical view
│       └── TaskProgress.tsx       # Progress indicator
│   └── projects/
│       ├── ProjectBoard.tsx       # Project overview
│       ├── ProjectList.tsx        # Project list
│       ├── ProjectDialog.tsx      # Create/edit project
│       ├── ProjectTimeline.tsx    # Gantt view
│       └── ProjectProgress.tsx    # Completion stats
│   └── resources/
│       ├── ResourceGrid.tsx       # Availability grid
│       ├── ResourceCard.tsx       # Resource display
│       ├── ReservationDialog.tsx  # Book resource
│       └── AvailabilityEditor.tsx # Set availability
│   └── templates/
│       ├── TemplateSelector.tsx   # Choose template
│       ├── TemplateBrowser.tsx    # Browse templates
│       └── TemplateEditor.tsx     # Create/edit template
├── stores/
│   ├── tenant-store.ts            # Tenant/org state
│   ├── workspace-store.ts         # Workspace/group state
│   ├── calendar-store.ts          # Calendar state
│   ├── task-store.ts              # Task state
│   ├── project-store.ts           # Project state
│   ├── resource-store.ts          # Resource state
│   └── template-store.ts          # Template state
├── lib/
│   ├── api-tenants.ts             # Tenants API client
│   ├── api-workspaces.ts          # Workspaces API client
│   ├── api-users.ts               # Users API client
│   ├── api-calendar.ts            # Calendar API client
│   ├── api-tasks.ts               # Tasks API client
│   ├── api-projects.ts            # Projects API client
│   ├── api-resources.ts           # Resources API client
│   └── recurrence.ts              # RRULE utilities
└── app/
    ├── calendar/
    │   └── page.tsx               # Calendar page
    ├── tasks/
    │   └── page.tsx               # Tasks page
    ├── projects/
    │   └── page.tsx               # Projects page
    ├── resources/
    │   └── page.tsx               # Resources page
    └── admin/
        ├── page.tsx               # Admin dashboard
        ├── users/
        │   └── page.tsx           # User management
        ├── workspaces/
        │   └── page.tsx           # Workspace management
        └── resources/
            └── page.tsx           # Resource management
```

### Backend Service: signapps-scheduler (Port 3007)

The existing `signapps-scheduler` service will be extended to handle calendar/task/project functionality:

```rust
// services/signapps-scheduler/src/
├── main.rs                        // Axum router setup
├── middleware/
│   ├── tenant.rs                  // Extract tenant from JWT, set RLS context
│   └── mod.rs
├── handlers/
│   ├── tenants.rs                 // Tenant management (admin only)
│   ├── workspaces.rs              // Workspace/group CRUD
│   ├── users.rs                   // User management within tenant
│   ├── calendars.rs               // Calendar CRUD
│   ├── events.rs                  // Event CRUD + recurrence
│   ├── tasks.rs                   // Task CRUD + hierarchy
│   ├── projects.rs                // Project CRUD
│   ├── resources.rs               // Resource management
│   ├── reservations.rs            // Booking logic
│   └── templates.rs               // Template management
├── services/
│   ├── tenant_context.rs          // Multi-tenant context management
│   ├── recurrence.rs              // RRULE expansion
│   ├── availability.rs            // Conflict detection
│   ├── template_engine.rs         // Template instantiation
│   └── notifications.rs           // Reminder scheduling
└── models/                        // DB models via signapps-db
```

### Multi-Tenant Middleware Pattern

```rust
// middleware/tenant.rs
use axum::{
    extract::{Request, State},
    middleware::Next,
    response::Response,
};
use sqlx::PgPool;

pub async fn tenant_context_middleware(
    State(pool): State<PgPool>,
    claims: Claims,  // From JWT
    request: Request,
    next: Next,
) -> Result<Response, AppError> {
    // Set PostgreSQL session variable for RLS
    sqlx::query("SELECT set_config('app.current_tenant_id', $1, true)")
        .bind(claims.tenant_id.to_string())
        .execute(&pool)
        .await?;

    Ok(next.run(request).await)
}
```

---

## IMPLEMENTATION PLAN

### Phase 0: Multi-Tenant Foundation (Sprint 1)
1. Database migrations for tenants, users, workspaces tables
2. Tenant context middleware (RLS setup)
3. Update JWT claims to include tenant_id
4. User management API within tenant
5. Workspace management API

### Phase 1: Data Model & Core APIs (Sprint 2-3)
1. Database migrations for calendar/event/task/project tables
2. Resource types and resources tables
3. Calendar CRUD API
4. Event CRUD API with basic recurrence
5. Task CRUD API with hierarchy
6. Project CRUD API

### Phase 2: Entity Management Frontend (Sprint 4)
1. Tenant settings page
2. User manager component
3. Workspace manager component
4. Resource manager (rooms, equipment)
5. Invitation system

### Phase 3: Calendar Frontend (Sprint 5-6)
1. Calendar views (Month, Week, Day)
2. Task list with subtasks
3. Project board
4. Zustand stores
5. API integration

### Phase 4: Templates & Resources (Sprint 7-8)
1. Template system backend
2. Template frontend (browser, selector)
3. Resource availability system
4. Reservation/booking system
5. Conflict detection

### Phase 5: Unified View & Real-time (Sprint 9-10)
1. Unified view component (calendar + tasks + projects)
2. WebSocket real-time updates per tenant
3. Drag & drop interactions
4. Optimistic updates
5. Offline support (IndexedDB)

### Phase 6: Advanced Features (Sprint 11-12)
1. Recurrence exceptions
2. Approval workflows for reservations
3. Analytics/reports per tenant
4. External calendar sync (Google, Outlook)
5. Natural language input

---

## KEY DECISIONS

| Decision | Choice | Justification |
|----------|--------|---------------|
| **Multi-tenancy** | Row-Level Security (RLS) | PostgreSQL native, transparent to app code |
| **Tenant isolation** | tenant_id on all tables | Simple, queryable, efficient |
| **RLS enforcement** | Session variable | Set once per request via middleware |
| Storage | PostgreSQL | Already in use, excellent for date range queries |
| Recurrence | RFC 5545 RRULE | Industry standard, well-documented |
| Real-time | WebSocket per tenant | Already have infrastructure, scoped by tenant |
| Frontend state | Zustand + TanStack Query | Consistent with codebase, performant |
| Template format | JSONB | Flexible, queryable, easy to version |
| Calendar type | Enum in DB | Type safety, efficient queries |
| **User roles** | Hierarchical (owner > admin > member > viewer) | Clear permission model |
| **Resource booking** | Reservation table with status | Supports approval workflows |

---

## Session Summary

### Ideas Generated: 175+

- 25 Data Model ideas
- 25 Multi-Tenant & Entity Management API ideas
- 20 Calendar API ideas
- 18 Task API ideas
- 15 Project API ideas
- 12 Template ideas
- 15 Resource/Reservation ideas
- 30 Frontend Component ideas
- 12 State Management ideas
- 10 Real-time ideas

### Key Deliverables

1. **Multi-Tenant Architecture** - RLS-based tenant isolation
2. **Complete Database Schema** - Production-ready PostgreSQL schema
3. **Entity Management** - Tenants, users, workspaces, resources
4. **API Design** - Full REST API specification
5. **Frontend Architecture** - Component hierarchy and stores
6. **Implementation Plan** - 12-sprint roadmap
7. **SCAMPER Analysis** - Innovation opportunities identified

### Next Steps

**Recommended:** Start with Phase 0 - Multi-Tenant Foundation

```bash
# Create migrations
cd migrations

# 1. Tenants table
sqlx migrate add create_tenants

# 2. Update users table with tenant_id
sqlx migrate add add_tenant_to_users

# 3. Workspaces table
sqlx migrate add create_workspaces

# 4. Resource types and resources
sqlx migrate add create_resources

# 5. Calendar system
sqlx migrate add create_calendar_system
```

### JWT Claims Update Required

```rust
// Update signapps-common/src/auth/claims.rs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: Uuid,           // user_id
    pub tenant_id: Uuid,     // NEW: tenant context
    pub username: String,
    pub role: i16,
    pub workspace_ids: Vec<Uuid>,  // NEW: accessible workspaces
    pub exp: i64,
    pub iat: i64,
}
```

---

*Session generated automatically with BMAD Method v6.0.4*
