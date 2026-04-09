---
name: scheduler-debug
description: Debug skill for the Scheduler/Planificateur module (/scheduler). CRON task management with KPI cards, sortable job table, create/edit dialog with CronBuilder, run now, execution history, export. Backend via signapps-scheduler port 3007.
---

# Scheduler — Debug Skill

## Source of truth

**`docs/product-specs/56-scheduler.md`** — read spec first.

## Code map

### Backend (Rust)
- **Service**: `services/signapps-scheduler/` — port **3007**
- **Main**: `services/signapps-scheduler/src/main.rs`
- **Handlers**: `services/signapps-scheduler/src/handlers/jobs.rs` (CRUD + run + history)
- **Scheduler core**: `services/signapps-scheduler/src/scheduler/service.rs`, `executor.rs`, `ingestion.rs`
- **Crawlers**: `services/signapps-scheduler/src/crawlers/` (calendar, chat, docs, mail, projects, storage, tasks)
- **Other handlers**: backups, devops, health_stream, metrics, notifications, projects, resources, tenants, time_items, users, workspaces, openapi

### Frontend (Next.js)
- **Page**: `client/src/app/scheduler/page.tsx` (single-file with inline components)
- **Sub-page**: `client/src/app/scheduler/analytics/` (analytics dashboard)
- **Components**: `client/src/components/scheduler/cron-builder.tsx` (CronBuilder visual cron editor)
- **API client**: `client/src/lib/api/scheduler.ts` (schedulerApi — listJobs, createJob, updateJob, deleteJob, enableJob, disableJob, runJob, listRuns, getStats, getRunning)
- **Deps**: `@tanstack/react-query`, `spinners-react` (SpinnerInfinity), `sonner` (toasts)
- **Keyboard navigation**: `useTableKeyboard` hook for arrow keys, Enter to edit, Delete to delete
- **Export**: `ExportButton` component for CSV/Excel export of jobs

## Key data-testids (to add)

| data-testid | Element |
|---|---|
| `scheduler-root` | Scheduler page container |
| `scheduler-new-task-btn` | "Nouvelle Tache" button |
| `scheduler-refresh-btn` | Actualiser button |
| `scheduler-export-btn` | Export button |
| `scheduler-stats-total` | Total tasks KPI card |
| `scheduler-stats-active` | Active tasks KPI card |
| `scheduler-stats-success` | Successful runs KPI card |
| `scheduler-stats-running` | Running jobs KPI card |
| `scheduler-job-row-{id}` | Job table row |
| `scheduler-job-toggle-{id}` | Enable/disable switch |
| `scheduler-job-menu-{id}` | Actions dropdown menu |
| `scheduler-dialog` | Create/edit job dialog |
| `scheduler-dialog-name` | Job name input |
| `scheduler-dialog-cron` | CronBuilder component |
| `scheduler-dialog-command` | Command textarea |
| `scheduler-dialog-save` | Save button |
| `scheduler-runs-dialog` | Execution history dialog |
| `scheduler-delete-dialog` | Delete confirmation dialog |

## Key E2E journeys

1. **View dashboard** — load page, verify 4 KPI cards and jobs table
2. **Create task** — click "Nouvelle Tache", fill form with cron expression + command, save, verify toast + table updated
3. **Edit task** — click edit in dropdown, modify name, save, verify updated
4. **Toggle task** — click enable/disable switch, verify status change + toast
5. **Run now** — click "Executer Maintenant" in dropdown, verify toast + running count updates
6. **View history** — click "Historique" in dropdown, verify runs dialog with status badges
7. **Delete task** — click delete, confirm in alert dialog, verify removed from table
8. **Sort table** — click column headers (Nom, Planification, Derniere Execution), verify sort order toggles
9. **Export** — click Export button, verify CSV/Excel download

## Common bug patterns

1. **Fallback stats mismatch** — when backend stats endpoint fails, fallback stats are computed from `jobs` array using `last_status` field which may not reflect actual cumulative counts
2. **setTimeout for refresh after runJob** — `setTimeout(fetchJobs, 1000)` after `runJob` is a race condition; the job may not have completed or even started in 1 second
3. **CronBuilder validation** — the CronBuilder component may accept invalid cron expressions that the backend rejects
4. **Sort by dynamic fields** — `String(aVal).localeCompare(String(bVal))` converts all values to strings including booleans and dates, causing incorrect sort for `last_run` (ISO date strings) and `enabled` (boolean)
5. **Missing error feedback detail** — all catch blocks show generic "Echec de..." messages without backend error details

## Debug checklist

- [ ] Verify scheduler service (port 3007) is running: `curl http://localhost:3007/health`
- [ ] Check `schedulerApi` endpoints match backend routes
- [ ] Test CronBuilder produces valid cron expressions accepted by backend
- [ ] Verify job runs actually execute (check scheduler executor logs)
- [ ] Test table keyboard navigation (arrows, Enter, Delete)
- [ ] Check export generates correct CSV with all columns
- [ ] Verify error state displays when scheduler service is down

## Dependencies (license check)

- **Backend**: axum, tokio-cron-scheduler, sqlx — MIT/Apache-2.0
- **Frontend**: react, next, @tanstack/react-query, spinners-react, sonner — MIT
- Verify: `just deny-licenses && cd client && npm run license-check:strict`
