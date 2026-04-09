---
name: timesheet-debug
description: Debug skill for the Timesheet module. Currently MOCK data — backend being created. May integrate with signapps-calendar port 3011. Covers time tracking, timesheets, approval workflows, and reports.
---

# Timesheet — Debug Skill

## Source of truth

**`docs/product-specs/42-timesheet.md`** — read spec first.

**Status**: MOCK data — backend being created.

## Code map

### Backend (Rust)
- **Service**: may be part of `signapps-calendar/` — port **3011** (unified calendar includes timesheets)
- **DB models**: to be created in `crates/signapps-db/src/models/timesheet*.rs`
- **Migrations**: to be created (timesheet entries, approval workflow)

### Frontend (Next.js)
- **Pages**: `client/src/app/timesheet/` (weekly view, monthly view, reports)
- **Components**: `client/src/components/timesheet/`
- **Mock data**: hardcoded MOCK_* constants — to be replaced
- **API client**: `client/src/lib/api/timesheet.ts` (stub or missing)

## Key data-testids (to add)

| data-testid | Element |
|---|---|
| `timesheet-root` | Timesheet page container |
| `timesheet-week-{date}` | Weekly timesheet grid |
| `timesheet-entry-{id}` | Time entry cell |
| `timesheet-submit-btn` | Submit for approval |
| `timesheet-approve-{id}` | Approve button (manager) |
| `timesheet-total-hours` | Total hours display |

## Key E2E journeys

1. **Log time** — select project/task, enter hours, save entry
2. **Weekly view** — view week, verify totals per day and week total
3. **Submit for approval** — submit timesheet, verify status changes to "pending"
4. **Manager approval** — manager approves, verify status changes to "approved"

## Common bug patterns

1. **MOCK data stale** — UI works with mocks but schema drift when backend wired
2. **Hours calculation** — floating-point rounding on hours (should use minutes as integer)
3. **Timezone issues** — entries logged in user's TZ but stored in UTC; date boundary shifts

## Dependencies (license check)

- **Backend**: axum, sqlx, chrono — MIT/Apache-2.0
- **Frontend**: react, next, date-fns — MIT
- Verify: `just deny-licenses && cd client && npm run license-check:strict`
