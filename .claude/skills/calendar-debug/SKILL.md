---
name: calendar-debug
description: Use when debugging, verifying, or extending the Calendar (Calendrier unifié) module of SignApps Platform. This skill references the product spec at docs/product-specs/03-calendar.md as the source of truth for expected behavior. It provides a complete debug checklist (code paths, data-testids, E2E tests, OSS dependencies, common pitfalls) for the unified calendar which combines events, tasks, leaves, shifts, bookings, milestones, blockers and CRON jobs.
---

# Calendar (Calendrier unifié) — Debug Skill

This skill is the **dedicated debugging companion** for the Calendar module of SignApps Platform. Unlike competitors who split events / tasks / HR schedules into separate products, SignApps has **one unified timeline** with 8 entry types (event, task, leave, shift, booking, milestone, blocker, cron).

## Source of truth

**`docs/product-specs/03-calendar.md`** defines expected behavior.

Always read the spec first. If an observed behavior contradicts the spec: either fix the code, or update the spec via `product-spec-manager` workflow B.

## Code map

### Backend (Rust)
- **Service**: `services/signapps-calendar/` — port **3011**
- **Handlers**: `services/signapps-calendar/src/handlers/`
- **DB models**: `crates/signapps-db/src/models/calendar/` — Event, Task, Leave, Shift, Booking, Milestone, Blocker, CronJob (8 entry types with common base)
- **Repository**: `crates/signapps-db/src/repositories/calendar_repository.rs`
- **Migrations**: `migrations/` (search for `calendar`, `event`, `leave`, `shift`, `timesheet`)
- **Event bus**: emits `calendar.event.created`, `calendar.event.updated`, `calendar.event.deleted`, `calendar.leave.approved`, etc.

### Frontend (Next.js + React)
- **App route**: `client/src/app/cal/` (entry point: `page.tsx`)
- **Views**: `client/src/app/cal/{day,week,month,year,agenda,timeline,resource}/page.tsx` (if present)
- **Components**: `client/src/components/calendar/`
  - `calendar-view.tsx` — main view container with view switcher
  - `day-view.tsx`, `week-view.tsx`, `month-view.tsx`, `year-view.tsx`, `agenda-view.tsx`
  - `event-form-dialog.tsx` — create/edit entry dialog (all 8 types)
  - `event-details-popover.tsx` — on-hover/click details
  - `calendar-sidebar.tsx` — calendar list, filters, mini calendar
  - `time-grid.tsx` — time-based rendering (drag to create, drag to move)
  - `drag-overlay.tsx` — visual feedback during drag
  - `recurrence-editor.tsx` — RRULE builder
  - `availability-picker.tsx` — for meeting scheduling
  - `leave-approval-card.tsx` — HR flow
- **Store**: `client/src/stores/calendar-store.ts` (Zustand) — selectedDate, currentView, filters, visible calendars
- **API client**: `client/src/lib/api/calendar.ts`
- **Types**: `client/src/types/calendar.ts` — `CalendarEntry`, `EntryType`, `RecurrenceRule`, `Attendee`, etc.

### E2E tests
- `client/e2e/calendar-manipulation.spec.ts` — navigation, view switching, create/edit/delete events, drag & drop
- `client/e2e/calendar-entry-types.spec.ts` — 8 entry types (event, task, leave, shift, booking, milestone, blocker, cron)
- `client/e2e/calendar-recurrence.spec.ts` — RRULE, modify one/all occurrences
- `client/e2e/calendar-sharing.spec.ts` — share calendar, permissions
- `client/e2e/calendar-collaboration.spec.ts` — attendees, responses, availability
- `client/e2e/calendar-realtime.spec.ts` — multi-user live updates via websocket/CRDT
- `client/e2e/calendar-ecosystem.spec.ts` — cross-module (tasks→events, leave→HR, booking→meeting room)
- **Page Object**: `client/e2e/pages/CalendarPage.ts`
- **Form dialog PO**: `client/e2e/pages/EventFormDialog.ts`
- **Helpers**: `client/e2e/helpers/drag.ts` (drag-and-drop), `smoke.ts`

## Feature categories (from the spec)

The spec defines these categories:

1. **Vues et navigation** — jour/semaine/mois/année/agenda/timeline/ressources, keyboard nav, mini-calendrier, jump-to-date
2. **Création et édition d'entrées** — 8 types d'entrées avec UX adaptée par type, quick-add, natural language parsing
3. **Récurrence et exceptions** — RRULE (RFC 5545), instance overrides, break series
4. **Collaboration et participants** — invitations, RSVP, availability finder, proposed times
5. **Partage et permissions** — calendriers partagés, sous-calendriers, droits fins (read/edit/admin)
6. **Ressources et réservations** — salles, équipements, quotas, double-booking prevention
7. **RH et absences** — types de congés, soldes, workflow d'approbation, calendrier d'équipe
8. **Tâches et projets** — intégration tasks module, milestones, dependencies, gantt overlay
9. **IA intégrée** — smart scheduling, meeting suggestions, travel time, focus time blocks
10. **Notifications et rappels** — push, email, in-app, snooze, escalation
11. **Intégrations externes** — iCal import/export, Google/Outlook sync, webhooks
12. **Mobile et accessibilité** — PWA, offline, WCAG AA, keyboard-only nav
13. **Sécurité et gouvernance** — classification, audit logs, DLP, legal hold

## Key data-testids

Core (must be present for E2E to work reliably):

| data-testid | Purpose |
|---|---|
| `calendar-root` | Root container |
| `calendar-view-{day\|week\|month\|year\|agenda}` | Current view render |
| `calendar-view-switcher-{mode}` | View switcher buttons |
| `calendar-prev`, `calendar-next`, `calendar-today` | Navigation |
| `calendar-date-picker` | Jump-to-date |
| `calendar-create-button` | New entry button |
| `calendar-cell-{yyyy-mm-dd}` | Month cell |
| `calendar-time-slot-{yyyy-mm-dd}-{hour}` | Time grid slot |
| `calendar-entry-{id}` | Rendered entry |
| `calendar-entry-type-{event\|task\|leave\|shift\|booking\|milestone\|blocker\|cron}` | Visual type class |
| `event-form-dialog` | Create/edit dialog |
| `event-form-title`, `event-form-start`, `event-form-end`, `event-form-type`, `event-form-calendar`, `event-form-recurrence`, `event-form-attendees`, `event-form-location`, `event-form-description` | Form fields |
| `event-form-save`, `event-form-cancel`, `event-form-delete` | Dialog actions |
| `calendar-sidebar-calendar-{id}` | Sidebar calendar toggle |
| `calendar-filter-type-{type}` | Entry type filter |
| `leave-approval-approve-{id}`, `leave-approval-reject-{id}` | HR workflow actions |

If a new bug involves an element without a data-testid, **add one** — instrument the code before testing.

## Key E2E tests

Run all calendar tests:
```bash
cd client
npx playwright test calendar --project=chromium --reporter=list
```

Specific spec:
```bash
npx playwright test calendar-recurrence --project=chromium
npx playwright test calendar-entry-types -g "leave request" --project=chromium --headed
```

Serial mode (fixes drag/drop races):
```bash
npx playwright test calendar-manipulation --project=chromium --workers=1
```

## Debug workflow

### Step 1: Reproduce
- View active when bug occurred (day/week/month/year/agenda)
- Date range visible
- Entry type involved
- User role (personal calendar vs shared vs team)
- Console errors, network 4xx/5xx, websocket messages

### Step 2: Classify

1. **Which entry type?** Each of the 8 types has its own render path and validation rules.
2. **Where is the breakage?**
   - **Rendering**: `calendar-view.tsx` switch, then `{day,week,month,year,agenda}-view.tsx`
   - **Drag-to-create**: `time-grid.tsx` mousedown/mousemove/mouseup
   - **Drag-to-move**: `@dnd-kit` sensors + `onDragEnd` handler in view files
   - **Recurrence**: `recurrence-editor.tsx` → RRULE string → backend expansion
   - **Form validation**: `event-form-dialog.tsx` + zod schema in `types/calendar.ts`
   - **Backend validation**: `services/signapps-calendar/src/handlers/events.rs`
   - **Database**: `crates/signapps-db/src/repositories/calendar_repository.rs`
   - **Realtime sync**: event bus → websocket → store update

### Step 3: Write a failing E2E test first

```ts
import { test, expect } from "./fixtures";
import { CalendarPage } from "./pages/CalendarPage";

test("reproduce bug", async ({ page }) => {
  const cal = new CalendarPage(page);
  await cal.goto();
  await cal.switchToView("week");
  // ...
});
```

### Step 4: Trace the code path
- **Rendering**: from the URL to `CalendarPage` to the view switcher to the actual day/week grid
- **Create entry**: button click → `event-form-dialog` mounted → submit → API call → store update → re-render
- **Move entry**: DndContext → `onDragEnd` → optimistic update → API call → confirm/rollback
- **Recurrence**: RRULE stored server-side → expansion per view range → render

### Step 5: Fix + regression test + update spec

## Common bug patterns

### 1. Calendar store has pre-existing TSC errors
**Symptom**: `tsc --noEmit` reports errors in `calendar-store.ts` even before any change.
**Root cause**: Union types for `CalendarEntry` (8 variants) + Zustand typings — TypeScript narrowing doesn't always work across the discriminated union.
**Diagnostic**: Look at `create<CalendarStoreState>()((set, get) => ({ ... }))` signature.
**Workaround**: Cast with `as CalendarEntry & { type: T }` where needed, or narrow with `if (entry.type === 'event')` before access.
**Proper fix (TODO)**: Split store into per-type slices or use Zod discriminated union helpers.

### 2. Drag-to-create creates entry at wrong time
**Symptom**: Dragging on a 9-10h slot creates an entry at 10-11h.
**Root cause**: Off-by-one in pixel-to-time conversion, or timezone mismatch between display and payload.
**Diagnostic**: Log `{ pixel, slot, displayTime, payloadTime, userTZ, serverTZ }`.
**Fix**: Always use `date-fns-tz` `zonedTimeToUtc` before sending, `utcToZonedTime` before rendering. Never use `new Date(string)` — use `parseISO`.

### 3. RRULE "every weekday" misses Monday after DST
**Symptom**: Recurring event skipping a day twice a year.
**Root cause**: DST transition handled incorrectly by RRULE expansion (rrule.js gotcha with UTC vs floating).
**Fix**: Store DTSTART as local date with `TZID=Europe/Paris`, not UTC. Test with `--date=2026-03-29` (spring forward).

### 4. Leave approval workflow bypassed
**Symptom**: Employee can mark their own leave as "approved".
**Root cause**: Missing role check in `services/signapps-calendar/src/handlers/leaves.rs` (happens when refactoring adds a new endpoint).
**Fix**: All leave status transitions must go through `approve_leave` with manager role + audit log.

### 5. EventForm shows stale date when reopening for a different slot (FIXED 2026-04-14)
**Symptom**: Click slot 14h, close form, click slot 10h → form opens with 14h.
**Root cause**: `useState(initializer)` runs once at mount, doesn't react to prop changes.
**Fix**: `useEffect([open, initialEvent?.id, defaultStartDate?.getTime(), defaultEndDate?.getTime()])` resets formData via `buildInitialFormData()` on every open or default change.

### 6. Drag-drop strips date timezone, events shift to wrong day (FIXED 2026-04-14)
**Symptom**: Drag event onto Tuesday in Month view, lands on Monday (in Americas TZ).
**Root cause**: `new Date(overData.date)` parses ISO string as UTC, then `setHours()` uses local components.
**Fix**: Droppable data emits `yyyy-MM-dd` (no TZ); `handleDragEnd` parses with `new Date(y, m-1, d, h, min)` (local components).

### 7. Resize handle invisible / not working (FIXED 2026-04-14)
**Symptom**: Hover bottom of event, no visible handle, drag doesn't resize.
**Root cause**: 3px handle (`h-3`) too small + @dnd-kit PointerSensor (distance:8) intercepts pointerdown.
**Fix**: 8px hit zone with `data-no-dnd="true"` attribute; custom PointerSensor activator walks up DOM and refuses activation when ancestor has `data-no-dnd`.

### 8. Click on event triggers slot create handler (FIXED 2026-04-14)
**Symptom**: Click event in Month view, opens NEW event form on top of edit form.
**Root cause**: Event click bubbles to parent slot's onClick.
**Fix**: PointerSensor with `activationConstraint: { distance: 8 }` ensures clicks (no movement) never start drag and bubble correctly. Use `e.stopPropagation()` in event handlers.

### 9. Delete key silently deletes event with no confirmation (FIXED 2026-04-14)
**Symptom**: Press Backspace after closing form → event vanishes.
**Root cause**: handleFormOpenChange didn't clear `selectedEventId`; Delete shortcut had no confirm.
**Fix**: Clear `selectEvent(null)` on form close. Wrap delete shortcut in `window.confirm("Supprimer cet événement ?")`.

### 10. Month view starts on Sunday but rest of app starts on Monday (FIXED 2026-04-14)
**Symptom**: Week view starts Mon, Month view starts Sun → off-by-one week boundaries.
**Root cause**: MonthCalendar used `monthStart.getDay()` (Sun=0).
**Fix**: Use `startOfWeek(monthStart, { weekStartsOn: 1 })` and reorder header to `["Lun","Mar",...,"Dim"]`.

### 11. Multi-day events only show on first day in Month view (FIXED 2026-04-14)
**Symptom**: Friday-Sunday event visible only on Friday cell.
**Root cause**: `eventsByDay` map keyed only by `start_time.toDateString()`.
**Fix**: Iterate from start_time to end_time, push event into each day cell's bucket.

### 5. Drag on @dnd-kit intercepted by omni-AI overlay
**Symptom**: Drag-to-move events in month view fails with "intercepts pointer events".
**Root cause**: Same issue as spreadsheet sheet tabs — floating omni-AI `.glass-panel` covers the bottom of the calendar.
**Fix**: In tests, scroll target into view or use `dispatchEvent('dragstart')` / helper `dragRangeSelection`.

### 6. Double-booking of meeting rooms
**Symptom**: Two bookings created on the same room at the same time.
**Root cause**: Missing database constraint + TOCTOU race in the handler.
**Fix**: Add `EXCLUDE` constraint in migration (`btree_gist`, `tstzrange`) + enforce at handler level with `BEGIN ISOLATION LEVEL SERIALIZABLE`.

### 7. Timezone bug — "Week of X" shows previous day
**Symptom**: Entry created on Monday shows up on Sunday for a user in America/Los_Angeles.
**Root cause**: Backend returns UTC, frontend formats without user timezone. Happens with `toLocaleDateString` in SSR.
**Fix**: Always format dates in the user's TZ (from profile or browser). Never format dates in server components.

*(This section grows over time as bugs are found and fixed.)*

## Dependencies check (license compliance)

Key dependencies used by the Calendar. Verify none introduce forbidden licenses (see `memory/feedback_license_policy.md`):

### Runtime
- **@dnd-kit/core** — MIT ✅ (drag-and-drop)
- **rrule** / **rrule.js** — BSD-3-Clause ✅ (recurrence expansion)
- **date-fns**, **date-fns-tz** — MIT ✅ (date math, timezones)
- **ical.js** — MPL-2.0 ✅ (consumer only — do not fork source)
- **@fullcalendar/core** — **MIT** ✅ (if used for any view)

### Backend (Rust)
- **rrule** (Rust crate) — MIT ✅
- **chrono**, **chrono-tz** — Apache-2.0/MIT ✅
- **icalendar** — Apache-2.0/MIT ✅

### Forbidden (do NOT introduce)
- **tui-rs/ratatui calendar widgets** — OK but not relevant here
- **Any AGPL/GPL calendar lib** — specifically check `cal-heatmap` variants, some are GPL
- **Business-source PDF/export engines** — use `wkhtmltopdf` (LGPL — dynamic link OK) or `headless-chrome`

Run before committing any dependency change:
```bash
just deny-licenses
cd client && npm run license-check:strict
```

## Cross-module interactions

The Calendar module interacts with:

- **Tasks/Projects** — tasks can appear as calendar entries, milestones span dates
- **HR/Workforce** — leaves, shifts, timesheets
- **Meet** — meeting rooms as bookable resources, video links auto-attached
- **Mail** — email → "add to calendar" chip, attendees from contacts
- **Contacts** — attendee picker, availability lookup
- **Drive** — files attached to events
- **AI** — smart scheduling, travel time, focus blocks
- **Workflows** — calendar events as triggers/actions
- **Notifications** — reminders push/email/in-app

When debugging, always ask "is the bug in the Calendar itself or in one of its integrations?"

## Spec coverage checklist

- [ ] All 8 entry types (event, task, leave, shift, booking, milestone, blocker, cron) render correctly in all views
- [ ] RRULE full RFC 5545 support including BYDAY, BYSETPOS, COUNT, UNTIL, EXDATE
- [ ] DST transitions handled correctly in spring/fall
- [ ] Multi-timezone attendees see their local time, event shows source TZ
- [ ] Leave approval requires manager role (RBAC enforced)
- [ ] Room double-booking prevented by DB constraint
- [ ] iCal export/import round-trip preserves all fields
- [ ] Google/Outlook sync 2-way with conflict resolution
- [ ] Offline PWA with optimistic updates + conflict resolution
- [ ] No forbidden (GPL/AGPL/BSL) dependency introduced

## How to update this skill

When a new feature is added to the Calendar module:
1. Update `docs/product-specs/03-calendar.md` via `product-spec-manager` workflow B
2. Update the data-testids and E2E tests sections here
3. If the feature introduces a new bug-prone area, pre-populate "Common bug patterns"

When a bug is fixed:
1. Add the pattern to "Common bug patterns"
2. Include: symptoms, root cause, diagnostic, fix

## Historique

- **2026-04-09** : Skill créé. Basé sur le spec `03-calendar.md` et l'état actuel du code (7 spec files E2E, `CalendarPage`, `EventFormDialog` Page Objects, store `calendar-store.ts`).
