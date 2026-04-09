---
name: tasks-projects-debug
description: Use when debugging, verifying, or extending the Tasks & Projects module of SignApps Platform. Spec at docs/product-specs/07-tasks-projects.md. Backend is served by signapps-calendar (port 3011) with nested tasks (parent_task_id), projects via signapps-scheduler. Frontend has 22 components across /tasks and /projects routes. IMPORTANT: many views are stubs (Gantt, Sprint boards use sample data), 0 data-testids, 1 minimal E2E spec with zero functional assertions.
---

# Tasks & Projects — Debug Skill

Debug companion for the Tasks & Projects module. **Backend minimal but functional** (tasks via calendar service, projects via scheduler). **Frontend rich but mostly stubs**. **Zero data-testids**. 1 basic E2E spec.

## Source of truth

**`docs/product-specs/07-tasks-projects.md`** — 10+ categories (quick add, views, sub-tasks, comments, dependencies, sprints, workflows, AI, integrations, mobility).

## Code map

### Backend (Rust)
- **Tasks service**: `services/signapps-calendar/` — port **3011**, `src/handlers/tasks.rs`
  - `create_task` (POST) — with optional `parent_task_id`
  - `get_task` (GET), `list_root_tasks` (GET), `list_children` (GET)
  - Status update, delete, bulk ops (partial)
- **Projects service**: `services/signapps-scheduler/` — `src/handlers/projects.rs` (CRUD) + `src/crawlers/projects.rs` (sync)
- **DB models** (`crates/signapps-db-shared/src/models/tenant.rs`):
  - `Task { id, title, description, priority, status, due_date, parent_task_id, assigned_to, estimated_hours, template_id, position }`
  - `Project { id, name, description, owner, color, icon, timestamps }`
  - `ProjectMember`, `ProjectWithStats`
- **Migrations**:
  - `011_calendar_schema.sql` — base (events, tasks, resources)
  - `025_recursive_tasks.sql` — `position` column + `parent_task_id` for drag-drop and nesting
  - `031_multi_tenant_calendar.sql` — tenant isolation
  - `045_entity_hub_search_sync.sql` — task indexing for AI RAG
- **Routes** (inferred):
  ```
  POST   /calendars/{id}/tasks          → create_task
  GET    /tasks/{id}                     → get_task
  GET    /calendars/{id}/tasks           → list_root_tasks
  GET    /tasks/{id}/children            → list_children
  PUT    /tasks/{id}                     → update_task
  DELETE /tasks/{id}                     → delete_task
  ```

### Frontend
- **Routes**:
  - `client/src/app/tasks/page.tsx` — tasks hub (list + kanban + custom)
  - `client/src/app/projects/page.tsx` — 10-tab hub (Gantt, Sprint, Sprints, Spreadsheet, Dependencies, Health, Risks, Templates)
  - `client/src/app/projects/gantt/page.tsx`
  - `client/src/app/projects/sprints/page.tsx`
- **Task components** (`client/src/components/tasks/` — 12 files):
  - `TaskTree.tsx` — hierarchical (nested, expand/collapse)
  - `TaskForm.tsx` — create/edit modal
  - `TaskBoard.tsx`, `CustomKanbanBoard.tsx`, `TaskCard.tsx`, `TaskColumn.tsx`, `TaskSheet.tsx`
  - `tasks-header.tsx`, `task-item.tsx`, `task-assignee-selector.tsx`, `task-reminder-toggle.tsx`, `tasks-widget.tsx`
- **Project components** (`client/src/components/projects/` — 12 files):
  - `gantt-chart.tsx` (sample data!), `sprint-board.tsx`, `kanban-board.tsx`, `task-spreadsheet.tsx`, `task-dependencies.tsx` (stub), `milestones.tsx`, `time-tracker.tsx`, `resource-allocation.tsx`, `health-report.tsx`, `risk-register.tsx`, `roadmap-timeline.tsx`, `project-templates.tsx`
- **State**: `useEntityStore()` Zustand store with `fetchTasks`, `fetchProjects`, `createTask`, `updateTask`, `deleteTask`
- **API**: calls via `calendarApi.put('/tasks/{id}', {...})`. No dedicated `tasks.ts` client.

### E2E tests
- `client/e2e/tasks.spec.ts` (217 lines, 9 suites): Page structure, header actions, form dialog, task tree, export/import dialog, empty state, responsive layout
- **Problem**: Uses generic selectors (`.rounded-*`, `[class*="header"]`), **no functional assertions** (only visibility)
- **No projects spec**
- Related: `drag-drop.spec.ts`, `critical-flows.spec.ts`, `sprints-38-to-45.spec.ts`
- **No `TasksPage.ts` Page Object**
- **Zero** `data-testid` in tasks/projects components

## Feature categories (from spec) with status

| Cat | Spec | Status |
|---|---|---|
| 1 | Quick add (natural language + shortcut `c`) | ⚠️ Title-only dialog |
| 2.1 | List view (grouped, expandable) | ✅ TaskTree |
| 2.2 | Kanban board (drag-drop columns) | ⚠️ Stub, no drag |
| 2.3 | Calendar view | ✅ via Calendar module |
| 2.4 | Timeline (Gantt) | ⚠️ Stub, sample data only |
| 3 | Sub-tasks (unlimited nesting, 5 levels) | ✅ parent_task_id |
| 4 | Comments (rich text, @mentions) | ❌ Missing |
| 5 | Dependencies (FS/SS/FF/SF) | ⚠️ Stub |
| 6 | Sprints/cycles (planning, burndown) | ⚠️ Partial |
| 7 | Workflows (rules, automations) | ❌ Missing |
| 9 | AI (breakdown, estimate, summary) | ⚠️ RAG indexing only |
| 10 | Integrations (Mail, Docs, Chat, CRM, Git) | ⚠️ Calendar ✅ |

## Key data-testids (TO BE ADDED — currently zero)

| data-testid | Target |
|---|---|
| `tasks-root` | `/tasks` page container |
| `tasks-view-selector-{list\|board\|custom}` | View switcher |
| `tasks-add-button` | Main add button |
| `tasks-header` | Header bar |
| `tasks-calendar-filter`, `tasks-calendar-select` | Calendar/list filter |
| `task-tree-root` | Tree container |
| `task-tree-item-{id}` | Each task — `data-task-id`, `data-priority`, `data-status`, `data-depth` |
| `task-tree-item-expand-{id}`, `task-tree-item-collapse-{id}` | Expand/collapse arrow |
| `task-tree-item-title-{id}`, `task-tree-item-checkbox-{id}` | Row content |
| `task-tree-item-add-child-{id}`, `task-tree-item-delete-{id}` | Hover actions |
| `task-form-dialog`, `task-form-title-input`, `task-form-description-input`, `task-form-priority-select`, `task-form-due-date`, `task-form-assignee-select`, `task-form-submit`, `task-form-cancel` | Form modal |
| `kanban-board-root` | Kanban board |
| `kanban-column-{status}` | Each column (todo, in_progress, review, done) |
| `kanban-card-{taskId}` | Card |
| `kanban-card-drag-handle-{taskId}` | Drag handle |
| `gantt-root`, `gantt-task-{id}`, `gantt-dependency-{fromId}-{toId}` | Gantt |
| `sprint-board-root`, `sprint-backlog`, `sprint-sprint-{id}`, `sprint-story-{id}` | Sprint |
| `project-tabs`, `project-tab-{name}` | Project view tabs |

## Key E2E tests (to be written)

- `client/e2e/tasks-crud.spec.ts` — create, edit, mark complete, delete
- `client/e2e/tasks-subtasks.spec.ts` — nested tasks, cascade, reorder
- `client/e2e/tasks-kanban.spec.ts` — drag-drop between columns, status update persisted
- `client/e2e/projects-gantt.spec.ts` — Gantt with dependencies + auto-reschedule
- `client/e2e/projects-sprints.spec.ts` — sprint planning + burndown

### 5 key journeys

1. **Create task & mark complete** (core)
2. **Subtasks & cascade** (hierarchical)
3. **Kanban drag-drop between columns** (board view)
4. **Project Gantt + dependencies** (planning)
5. **Sprint planning & burndown** (agile)

## Debug workflow

### Step 1: Reproduce
- Which page (`/tasks` vs `/projects`)?
- Which view (list / kanban / gantt / sprint)?
- Is the data real or sample (Gantt uses sample data by default — check before debugging!)?

### Step 2: Classify
1. **Task CRUD** → `services/signapps-calendar/src/handlers/tasks.rs` + `useEntityStore`
2. **Subtask nesting** → check `parent_task_id` chain, `list_children` endpoint
3. **Kanban drag** → dnd-kit sensors + status update
4. **Gantt** → watch out for sample data; real data binding might not be wired
5. **Sprint burndown** → not yet real; check if story points are being computed

### Step 3: Write a failing E2E
### Step 4: Trace code
### Step 5: Fix + regression + update spec

## Common bug patterns (pre-populated)

1. **Gantt shows wrong tasks** — it's using sample data! Look for `gantt-chart.tsx` hardcoded array.
2. **Sub-task count doesn't update after complete** — parent doesn't recalculate; needs a rollup in the hook.
3. **Kanban drag doesn't persist status** — optimistic update but no backend PUT.
4. **Task tree drag reorder doesn't save position** — the `position` column is there but drag may not trigger save.
5. **Due date timezone off by 1** — `tasks.rs` uses `DateTime<Utc>`, display must convert to user TZ.
6. **Project filter doesn't persist across tabs** — URL query string not used.
7. **Templates not loaded** — `template_id` column exists but no template-management UI.
8. **Store race on fast creates** — creating 2 tasks in quick succession may cause the second to overwrite the first in `useEntityStore`.

## Dependencies check (license compliance)

- **@dnd-kit/core** — MIT ✅
- **date-fns** — MIT ✅
- **react-hook-form** — MIT ✅
- **zod** — MIT ✅
- **react-gantt**-style libs — check each (many are GPL)

### Forbidden
- **Taiga** — AGPL/MPL-2 (MPL OK as consumer)
- **OpenProject** — GPL-3 ❌
- **Redmine** — GPL-2 ❌
- **Planka** — AGPL ❌
- **Zenkit**, **Asana**, **ClickUp** — SaaS, not forkable

## Cross-module interactions

- **Calendar** — tasks share the same backend (`signapps-calendar`)
- **Docs** — tasks can be created from a doc (`Insert → Task`)
- **Mail** — "Create task from email" action
- **Chat** — "Create task from message"
- **CRM** — deals can have linked tasks
- **Forms** — form response can create a task
- **Workflows** — task status change can trigger
- **AI** — task breakdown, estimate, summary via `signapps-ai`

## Spec coverage checklist

- [ ] List view with grouping
- [ ] Kanban drag-drop with DB persistence
- [ ] Gantt with real data + dependencies
- [ ] Sprint board with burndown
- [ ] Sub-tasks cascade
- [ ] Comments + @mentions
- [ ] Workflow automation
- [ ] data-testids
- [ ] No forbidden dep

## Historique

- **2026-04-09** : Skill créé. Basé sur spec `07-tasks-projects.md` et inventaire (backend via calendar+scheduler, 22 components, 1 basic E2E spec with 0 functional assertions, 0 data-testids).
