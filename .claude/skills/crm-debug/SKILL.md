---
name: crm-debug
description: Use when debugging, verifying, or extending the CRM module of SignApps Platform. This skill references the product spec at docs/product-specs/06-crm.md as the source of truth. IMPORTANT as of 2026-04-09 the module is ~28% implemented — deals CRUD + Kanban + forecast exist, but contacts, companies, workflows, AI coach, email/call logging, sequences, and most integrations are NOT implemented. Do not waste time debugging features that don't exist yet.
---

# CRM — Debug Skill

Debug companion for the CRM module. **~28% spec coverage** — deals layer only. Contacts, companies, workflows, AI, and integrations are missing. Backend lives inside `signapps-contacts`, not a dedicated `signapps-crm` service.

## Source of truth

**`docs/product-specs/06-crm.md`** — 9 categories, 150+ features.

## Code map

### Backend (Rust)
- **Service**: `services/signapps-contacts/` (no dedicated `signapps-crm` service yet) — port as per contacts service
- **Handlers**: `services/signapps-contacts/src/handlers/crm.rs`
  - `GET/POST/PUT/:id/DELETE /api/v1/crm/deals` — deals CRUD with stage filter
  - `GET/POST/PUT/:id/DELETE /api/v1/crm/leads` — leads CRUD with status filter
  - `GET /api/v1/crm/pipeline` — pipeline stages summary (stage, count, total_amount)
- **DB**: `migrations/138_combined.sql`
  - Schema `crm.deals` (id, title, stage, amount, currency, contact_id, contact_name, contact_email, owner_id, close_date, probability, metadata, timestamps)
  - Schema `crm.leads` (id, name, email, phone, company, source, status, score, owner_id, metadata, timestamps)
  - Indexes: `idx_deals_owner`, `idx_deals_stage`, `idx_leads_owner`
  - Auto-created on first API call via `ensure_tables()`
- **NOT implemented (spec)**:
  - `crm.contacts` table (full contact records)
  - `crm.companies` / `crm.accounts` table
  - `crm.pipelines` + `crm.stages` (custom stages per pipeline)
  - `crm.activities` (currently localStorage-only)
  - `crm.tasks` (currently localStorage-only)
  - `crm.quotas` (currently localStorage-only)
  - `crm.workflows` / automation
  - `crm.templates` (email templates)
  - `crm.sequences` (email sequences)

### Frontend
- **Routes**:
  - `client/src/app/crm/page.tsx` — hub with 8 tabs (Kanban, List, Forecast, Billing, Quotas, Calendar, Import)
  - `client/src/app/crm/deals/[id]/page.tsx` — deal detail
- **Components** (`client/src/components/crm/` — 18 files):
  - Kanban/List: `deal-kanban.tsx` (dnd-kit, 6 columns), `deal-table.tsx`, `deal-card.tsx`
  - Detail/activity: `activity-log.tsx`, `activity-timeline.tsx` (localStorage), `deal-tasks.tsx` (localStorage)
  - Forecast: `sales-forecast.tsx`, `revenue-forecast.tsx`
  - Quotas: `quota-tracker.tsx` (localStorage)
  - Import: `prospect-csv-import.tsx` (column mapping + duplicate detection)
  - Sequences: `email-sequence-builder.tsx`, `followup-manager.tsx` (no backend)
  - Calendar integration: `calendar-activities.tsx`
  - Company stubs: `company-card.tsx`, `interaction-timeline.tsx`
- **API**: `client/src/lib/api/crm.ts` (440 lines)
  - `dealsApi.list/get/create/update/delete/importMany`
  - `leadsApi.list/get/create/update/delete`
  - `pipelineApi.getStages`
  - **localStorage-backed**: `activitiesApi`, `crmTasksApi`, `quotasApi`
  - `computeLeadScore()` — heuristic: value + stage + close date + activity count
- **Types**: `Deal`, `DealStage` (prospect|qualified|proposal|negotiation|won|lost), `Lead`, `Activity`, `CrmTask`, `Quota`, `PipelineStage`

### E2E tests
- **Zero** — no `crm-*.spec.ts` files exist
- **No `CrmPage.ts`** Page Object
- **Zero** `data-testid` attributes in CRM components

## Feature categories (from spec) with status

| # | Category | Status | % |
|---|---|---|---|
| 1 | Contacts | Not implemented | 0% |
| 2 | Companies | Not implemented | 0% |
| 3 | Deals & pipeline | Basic CRUD ✅, custom stages ❌, timeline ❌, products ❌, lost reasons ❌ | 60% |
| 4 | Activities & comms | Stubs only (localStorage), no email/call integration | 20% |
| 5 | Workflows & automations | Not implemented | 10% |
| 6 | Reporting & analytics | Forecast chart ✅, custom reports ❌, leaderboard ❌ | 50% |
| 7 | AI integration | Not implemented | 0% |
| 8 | Integrations | Mail partial, Calendar ✅, Tasks ✅, Billing ✅, rest ❌ | 40% |
| 9 | Mobility & collaboration | Basic shared views only | 10% |

**Overall**: ~28% implementation.

## Key data-testids (TO BE ADDED — currently zero)

| data-testid | Target |
|---|---|
| `crm-root` | `/crm` page container |
| `crm-tab-{kanban\|list\|forecast\|billing\|quotas\|calendar\|import}` | Tab switcher |
| `crm-kpi-active-deals`, `crm-kpi-won-value`, `crm-kpi-avg-time-to-close`, `crm-kpi-win-rate` | KPI cards |
| `crm-new-deal-button` | Create deal button |
| `crm-new-deal-dialog` | Create dialog |
| `crm-new-deal-title`, `crm-new-deal-company`, `crm-new-deal-value`, `crm-new-deal-probability`, `crm-new-deal-stage`, `crm-new-deal-close-date`, `crm-new-deal-submit` | Dialog fields |
| `crm-kanban-root` | Kanban board |
| `crm-kanban-column-{stage}` | Column per stage (prospect, qualified, proposal, negotiation, won, lost) |
| `crm-kanban-column-total-{stage}` | Weighted total display |
| `crm-kanban-card-{dealId}` | Deal card (also `data-deal-stage`, `data-deal-value`) |
| `crm-table-root`, `crm-table-row-{dealId}`, `crm-table-search`, `crm-table-sort-{field}` | List view |
| `crm-deal-detail-root`, `crm-deal-detail-edit`, `crm-deal-detail-delete`, `crm-deal-detail-activity-add`, `crm-deal-detail-task-add` | Detail page |
| `crm-forecast-chart` | Forecast chart |
| `crm-forecast-period-{month}` | Forecast bar |
| `crm-quota-row-{ownerId}`, `crm-quota-add`, `crm-quota-period-select` | Quotas |
| `crm-import-file-input`, `crm-import-preview`, `crm-import-confirm`, `crm-import-column-map-{field}` | Import wizard |

## Key E2E tests (to be written)

- `client/e2e/crm-deals.spec.ts` — create, edit, delete, stage transition
- `client/e2e/crm-kanban.spec.ts` — drag-drop between columns
- `client/e2e/crm-forecast.spec.ts` — forecast chart data correctness
- `client/e2e/crm-import.spec.ts` — CSV import + duplicate detection
- `client/e2e/crm-quotas.spec.ts` — quota creation + progress

### 5 key journeys

1. **Create & convert prospect → won deal** — create deal in prospect → drag to won → verify wonDeals+1, wonValue updated
2. **CSV import with duplicate detection** — upload CSV, verify 2 of 3 are dupes, confirm "create new" for all, verify 3 deals created
3. **Edit deal + activity log** — change value/probability, save, verify activity log entry
4. **Pipeline forecast by month** — create 5 deals with varying close dates, verify forecast chart sum matches `value * probability / 100`
5. **Quotas & leaderboard** — add quota, create won deals, verify progress bar updates

## Debug workflow

### Step 1: Before debugging, check if the feature exists!
Reference the gap analysis table above. If the user reports "the contact tags aren't saving" — **there are no contacts yet**. That's a feature request, not a bug.

### Step 2: Classify
1. **Deal CRUD bug** → `services/signapps-contacts/src/handlers/crm.rs`
2. **Kanban drag-drop bug** → `deal-kanban.tsx` + dnd-kit sensors + optimistic update
3. **Forecast wrong math** → `sales-forecast.tsx` + API `GET /crm/pipeline`
4. **Import bug** → `prospect-csv-import.tsx` + `dealsApi.importMany`
5. **localStorage lost** → reminder: activities/tasks/quotas are NOT persisted backend-side yet

### Step 3: Write a failing E2E
### Step 4: Trace code path
### Step 5: Fix + regression + update spec

## Common bug patterns (pre-populated)

1. **Activities disappear after logout** — they're in localStorage only. This is expected until backend is built.
2. **Forecast chart shows 0** — check `GET /crm/pipeline` response; weighted sum only includes deals with probability > 0 and close_date in the visible period.
3. **Kanban drag-drop reverts** — optimistic update must be followed by a PUT `/crm/deals/:id` with new stage; if PUT fails, rollback.
4. **CSV import creates duplicates** — dedup key should be `lower(trim(company)) + lower(trim(email))`, not just title.
5. **Deal card total mismatch** — weighted total is `sum(value * probability / 100)`, not `sum(value)`.
6. **Stage change doesn't persist** — ensure the mutation is sent to backend, not just local state.

## Dependencies check (license compliance)

- **@dnd-kit/core** — MIT ✅
- **recharts** — MIT ✅
- **date-fns** — MIT ✅
- **papaparse** (CSV) — MIT ✅

### Forbidden
- **SuiteCRM** — AGPL ❌
- **Odoo CRM** — LGPL-3 (only API-level OK, no fork)
- **EspoCRM** — GPL-3 ❌
- **vTiger CE** — MPL-2.0 (OK as consumer) but complicated

## Cross-module interactions

- **Contacts module** — currently planned to hold the `crm.contacts` table, **not yet built**
- **Calendar** — read meetings, schedule from deal detail
- **Mail** — will log incoming/outgoing email as activity (not implemented)
- **Tasks** — create follow-up tasks (localStorage)
- **Billing** — generate invoice from won deal (via bridge component)
- **Workflows** — deal stage change can trigger automation (not implemented)
- **AI** — deal coach, next best action (not implemented)

## Spec coverage checklist

- [ ] Contact records (spec category 1) — **0% done**
- [ ] Companies (category 2) — **0% done**
- [ ] Deals CRUD (3.1–3.6) — ✅
- [ ] Custom stages per pipeline (3.3–3.4) — ❌
- [ ] Deal timeline/history (3.11) — ❌
- [ ] Products/line items (3.13) — ❌
- [ ] Activities backend (4.1–4.12) — ❌
- [ ] Workflows (5.1–5.10) — ❌
- [ ] AI coach (7.1–7.11) — ❌
- [ ] Email sequences (4.4) — ❌
- [ ] data-testids — ❌

## Historique

- **2026-04-09** : Skill créé. Basé sur spec `06-crm.md` et inventaire (deals CRUD dans signapps-contacts, 18 composants frontend, 0 data-testids, 0 E2E, ~28% spec coverage).
