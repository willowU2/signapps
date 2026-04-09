---
name: forms-debug
description: Use when debugging, verifying, or extending the Forms (form builder) module of SignApps Platform. This skill references the product spec at docs/product-specs/08-forms.md as the source of truth for expected behavior. It provides a complete debug checklist (code paths, data-testids, E2E tests, dependencies, common pitfalls) for the form builder, including form creation, field types, conditional logic, distribution, responses collection, and webhooks. IMPORTANT: as of 2026-04-09, the module has a 35% alignment with the spec — backend is CRUD-only, many spec features are NOT implemented.
---

# Forms (Form Builder) — Debug Skill

This skill is the **dedicated debugging companion** for the Forms module of SignApps Platform. Status as of 2026-04-09: **backend complete but minimal** (CRUD + webhooks), **frontend rich but sparsely instrumented**, **zero E2E coverage**.

## Source of truth

**`docs/product-specs/08-forms.md`** defines expected behavior (9 categories, 130+ features).

Always read the spec first. Note: the current implementation covers ~35% of the spec. When debugging, distinguish between "bug in an implemented feature" and "feature not implemented yet".

## Code map

### Backend (Rust)
- **Service**: `services/signapps-forms/` — port **3015**
- **Main**: `services/signapps-forms/src/main.rs` — route list, middleware
- **Handlers** (11):
  - `list_forms`, `create_form`, `get_form`, `update_form`, `delete_form`
  - `publish_form`, `unpublish_form`
  - `submit_response`, `list_responses`
  - `set_webhook`, `get_webhook` (FM3 in-memory feature flag)
- **DB models**: `crates/signapps-db/src/models/form.rs`
  - `Form { id, title, description, owner_id, fields: JSON, is_published, created_at, updated_at }`
  - `FormField { id, field_type, label, required, options, layout, placeholder }`
  - `FormResponse { id, form_id, respondent, answers: JSON, submitted_at }`
  - `Answer { field_id, value: serde_json::Value }`
  - `FieldType` enum — **only 8 types**: `Text, TextArea, SingleChoice, MultipleChoice, Rating, Date, Email, Number`
- **Migrations**:
  - `051_create_forms.sql` — tables `forms.forms` and `forms.form_responses` with JSONB fields
  - `082_forms_indexes.sql` — indexes on form_id, owner_id, created_at
- **Routes**:
  - Public: `POST /api/v1/forms/:id/respond` (no auth, allows anonymous submissions)
  - Protected: standard CRUD under `/api/v1/forms/*`
  - Sharing: via `signapps_sharing` standard routes
  - Webhooks: `GET/POST /api/v1/forms/:id/webhook` (FM3 store)

### Frontend (Next.js + React)
- **Listing page**: `client/src/app/forms/page.tsx` (~24KB) — list view with tabs (all, published, drafts), create dialog, edit/delete, analytics entry point, export
- **Editor page**: `client/src/app/forms/[id]/page.tsx` (~30KB) — builder + preview + responses dashboard tabs
- **Components** (`client/src/components/forms/`):
  - `conditional-logic-editor.tsx` — category 3 (show/hide, jumps, calcs) — **not wired to backend**
  - `export-responses.tsx` — 6.6 (CSV/Excel/PDF/JSON export)
  - `file-upload-field.tsx` — 2.17 (file upload via Drive)
  - `form-branding-panel.tsx` — 4.1–4.12 (themes, fonts, CSS)
  - `multi-page-wizard.tsx` — 1.7 (sections/pages)
  - `payment-field.tsx` — 2.21 (Stripe/PayPal) — **placeholder**
  - `response-analytics.tsx` — 6.4 (dashboards/charts)
  - `scoring-editor.tsx` — 2.24 (quiz scoring)
  - `signature-field.tsx` — 2.18 (signature canvas)
- **API client**: `client/src/lib/api/forms.ts` — `formsApi` CRUD client
- **Types**: `client/src/lib/forms/types.ts` — dynamic form config (separate from `FormField` in backend)

### E2E tests
- **Status**: NONE dedicated. Possibly light smoke in `platform-smoke.spec.ts` and `misc-modules-smoke.spec.ts`.
- **Page Object**: NONE. `FormsPage.ts` to be created.
- **Helpers**: none.

## Feature categories (from the spec)

1. **Builder** — create, template, import, duplicate, drag-drop, sections, preview, undo/redo, auto-save, version, collab
2. **Question types** — 30 types (only 8 implemented)
3. **Conditional logic** — show/hide, jumps, calculations, variables, formulas, validation, timer, randomization (NONE on backend)
4. **Design** — themes, logo, fonts, CSS, dark mode, accessibility, responsive, animations, multi-language
5. **Distribution** — links, embeds, popups, email, QR, custom domain, short URL, expiry, limits, password, auth (NONE)
6. **Responses** — dashboard, tabular view, individual responses, analytics, filters, export, CRM sync, notifications, workflow
7. **Integrations** — webhooks (partial), Zapier, Slack, Google Sheets, CRM, tasks, calendar, payment, e-signature, API
8. **Security** — CAPTCHA, rate limiting, blacklist, encryption, RGPD, HIPAA, audit logs, cookies, IP anonymization (NONE)
9. **IA intégrée** — form generation, suggestions, text analysis, summaries, spam detection, translation, sentiment (NONE)

## Key data-testids (TO BE ADDED — currently zero)

The Forms module has **zero** `data-testid` attributes. Before any E2E test, instrument these critical elements:

| data-testid | Target element |
|---|---|
| `forms-root` | `/forms` page container |
| `forms-new-button` | "New form" button on listing |
| `form-create-dialog` | Create form dialog |
| `form-create-dialog-title`, `form-create-dialog-submit` | Dialog fields |
| `forms-list-item-{id}` | Each form row in the listing |
| `form-editor-root` | `/forms/[id]` page container |
| `form-editor-tab-{builder\|preview\|responses}` | Tab switcher |
| `form-title-input`, `form-description-textarea` | Editable meta fields |
| `form-publish-button`, `form-unpublish-button`, `form-delete-button` | Actions |
| `form-field-list` | Fields list container (drag-drop zone) |
| `form-field-item-{index}` | Each field in the builder |
| `form-field-label-input-{index}` | Field label input |
| `form-field-type-{type}` | Field type selector |
| `form-field-required-toggle-{index}` | Required toggle |
| `form-field-delete-{index}` | Delete a field |
| `form-field-palette` | Palette of available types |
| `form-field-palette-{type}` | Each palette button (text, email, number, singlechoice, multiplechoice, rating, date, textarea) |
| `form-preview-root` | Preview iframe/container |
| `form-preview-submit` | Preview submit button |
| `form-response-list` | Responses tab table |
| `form-response-row-{id}` | Each response row |
| `form-response-export-csv`, `form-response-export-json` | Export actions |
| `form-respond-root` | Public respond page (outside auth) |
| `form-respond-field-{id}` | Each respondent field |
| `form-respond-submit` | Submit button on respondent form |
| `form-webhook-url-input`, `form-webhook-secret-input`, `form-webhook-save` | Webhook config |

**If you add a data-testid, also add a stable `data-field-type` / `data-field-id` attribute** so the PO helpers can look up fields without knowing display order.

## Key E2E tests (to be written)

The first spec file should be `client/e2e/forms-crud.spec.ts` covering the 5 core journeys below. Subsequent files: `forms-field-types.spec.ts`, `forms-conditional.spec.ts`, `forms-responses.spec.ts`, `forms-webhooks.spec.ts`.

```bash
cd client
npx playwright test forms --project=chromium --reporter=list
```

### 5 key journeys to E2E-test first

1. **Create & publish basic form**
   - Navigate to `/forms`, click new button
   - Enter title "Feedback Survey" + description
   - Add 3 fields: Text (name), Email (email), Rating (satisfaction)
   - Click "Publish"
   - Assert: `is_published=true`, public URL generated, form appears in "published" tab

2. **Public respond + dashboard**
   - Open public form URL (no auth)
   - Fill 3 fields (assert validation: required, email format)
   - Submit
   - Login as owner, navigate to responses tab
   - Assert: 1 response listed with correct answers

3. **Conditional logic hide/show** (requires backend wiring — currently frontend-only)
   - Add Q1 SingleChoice Yes/No, Q2 hidden
   - Rule: "Show Q2 if Q1 = Yes"
   - Preview: Q1 visible, Q2 hidden → select "Yes" → Q2 appears
   - Assert: visibility toggled

4. **Export responses**
   - Form with 10 responses
   - Click "Export" → choose CSV
   - Assert: file downloaded with headers `timestamp, respondent, field1, field2, field3`
   - Click "Duplicate form" → new form with same schema, `is_published=false`

5. **Webhook notification (FM3)**
   - Configure webhook URL + secret
   - Submit a response
   - Assert: POST sent to hook with `form_id`, `response_id`, `X-Webhook-Secret` header

## Debug workflow

### Step 1: Reproduce
- Which page is involved: listing (`/forms`), editor (`/forms/[id]`), or public respond (`/forms/[id]/respond`)?
- Which tab: builder, preview, responses?
- Network 4xx/5xx on `/api/v1/forms/*`?
- Feature: spec category and subcategory (N.M)

### Step 2: Classify

1. **Is this a bug in an implemented feature?**
   - CRUD operation → `services/signapps-forms/src/handlers/` + `crates/signapps-db/src/models/form.rs`
   - Listing → `client/src/app/forms/page.tsx`
   - Editor builder → `client/src/app/forms/[id]/page.tsx` + `client/src/components/forms/*`
   - Response submission → public POST handler + `client/src/app/forms/[id]/respond` (if exists)

2. **Is this a missing feature?**
   Cross-check with the "Gap analysis" table below. If the feature is listed as "Not implemented", don't waste time debugging — the ticket is actually a feature request.

### Step 3: Write a failing E2E first
```ts
import { test, expect } from "./fixtures";
import { FormsPage } from "./pages/FormsPage";

test("reproduce bug", async ({ page }) => {
  const forms = new FormsPage(page);
  await forms.gotoListing();
  await forms.createForm("Bug Repro");
  // ...
});
```

### Step 4: Trace the code path
- **Create**: button click → POST `/api/v1/forms` → `create_form` handler → `FormRepository::insert` → Yjs for collab?
- **Add field**: UI action → state update (store?) → autosave (debounced PUT) → handler → migration
- **Submit response**: public POST → no-auth middleware → `submit_response` handler → validate fields JSON → insert → webhook dispatch

### Step 5: Fix + regression + update spec

## Current gap analysis (as of 2026-04-09)

| Category | Implemented | Status |
|---|---|---|
| 1. Builder | Core CRUD, editor UI, preview | 50% |
| 2. Field types (30 in spec) | 8 backend types (Text, TextArea, SingleChoice, MultipleChoice, Rating, Date, Email, Number) | **27%** |
| 3. Conditional logic | Frontend components only, no backend evaluation | 10% |
| 4. Design | Component sketch, no actual theming | 20% |
| 5. Distribution | Not implemented (no embed, QR, custom domain) | **0%** |
| 6. Responses | Dashboard + tabular view, missing filters/routing/workflow | 40% |
| 7. Integrations | Webhooks (FM3 in-memory) only | 10% |
| 8. Security | Not implemented | **0%** |
| 9. AI | Not implemented | **0%** |

**Overall**: ~35% alignment with spec.

## Common bug patterns (to be populated)

*(No bugs have been resolved yet — this section will grow as issues are found.)*

### Anticipated bugs (pre-populated watch list)

1. **Form responses lost on publish→unpublish→publish** — watch for responses being cleared by publish state transitions
2. **Public respond endpoint DoS** — no rate limiting in the spec (security cat 8 is 0%). Easy spam vector.
3. **FM3 webhook store lost on restart** — in-memory HashMap, not persisted. Document as a limitation.
4. **JSONB fields schema drift** — adding a new FieldType enum value breaks existing responses (they deserialize as Unknown). Always use `#[serde(other)]` or explicit migration.
5. **Conditional logic editor disconnected** — frontend component exists but `formsApi` doesn't send the logic tree to backend. Rules are lost on save.
6. **Multi-page wizard state lost on navigation** — React state not persisted between pages of a long form.
7. **File upload field bypasses quota** — no Drive quota check when uploading attachments.
8. **CSV export encoding issues** — special chars (é, à, 日本語) may break without BOM.

## Dependencies check (license compliance)

Key dependencies used / planned for Forms. Verify none introduce forbidden licenses (see `memory/feedback_license_policy.md`):

### Backend (Rust)
- **axum**, **tower**, **serde_json** — Apache-2.0/MIT ✅
- **sqlx** — Apache-2.0 ✅
- **signapps-common**, **signapps-db** — proprietary (internal)

### Frontend
- **react**, **next** — MIT ✅
- **@dnd-kit/core** — MIT ✅ (drag-drop of fields)
- **react-hook-form**, **zod** — MIT ✅
- **recharts** / **chart.js** — MIT ✅ (response analytics charts)
- **signature_pad** — MIT ✅ (signature-field.tsx)
- **papaparse** — MIT ✅ (CSV export)

### Forbidden (do NOT introduce)
- **Typeform**, **JotForm**, **Google Forms** — proprietary SaaS, not for forking
- **KoBoToolbox** — AGPL ❌
- **LimeSurvey** — GPL v2 ❌
- **SurveyJS** — **Commercial** (dual-licensed, but Pro features are proprietary) ❌ for forking, but the `survey-library` Core is MIT ✅ if used as-is
- **Formio** — OSL 3.0 (copyleft) ⚠️ — verify before use
- **Tally** — proprietary SaaS ❌

Run before committing any dependency change:
```bash
just deny-licenses
cd client && npm run license-check:strict
```

## Cross-module interactions

- **Drive** — file uploads go to the user's Drive (`file-upload-field.tsx`)
- **Contacts / CRM** — response can create/update a contact (spec 7.6 — not implemented)
- **Tasks** — a form submission can trigger a task creation (spec 7.7 — not implemented)
- **Calendar** — a form can be used to book a meeting slot (spec 7.8 — not implemented)
- **Mail** — confirmation emails to respondents (spec 7.3 — not implemented)
- **Workflows** — form submission as a trigger (spec 7.2 — via webhooks only, indirect)
- **Signatures** — the signature-field stores a PNG/SVG in the response (spec 2.18 — partial)
- **Billing** — payment-field ties to Stripe (spec 2.21 — placeholder)

## Spec coverage checklist

- [ ] All 30 question types implemented (currently 8/30)
- [ ] Conditional logic evaluated on backend (currently frontend-only)
- [ ] Distribution: custom domain, QR, short URL, embed (currently 0)
- [ ] Security: CAPTCHA, rate limiting on public endpoint (currently 0)
- [ ] AI: form generation, text analysis, summaries (currently 0)
- [ ] Data-testids on all builder and respond elements (currently 0)
- [ ] E2E tests for the 5 core journeys (currently 0)
- [ ] Webhooks persisted in DB (currently in-memory FM3)
- [ ] Response export: CSV, Excel, PDF, JSON (currently partial)
- [ ] Conditional logic wired from frontend to backend
- [ ] Multi-page wizard state persisted on page change
- [ ] File upload respects Drive quota

## How to update this skill

When a new feature is implemented in Forms:
1. Update `docs/product-specs/08-forms.md` via `product-spec-manager` workflow B
2. Update the "Feature categories" and "Gap analysis" tables in this skill
3. Add new data-testids as the code is instrumented
4. Add the corresponding E2E test to the key tests list
5. Populate "Common bug patterns" with any bugs found during implementation

## Historique

- **2026-04-09** : Skill créé. Basé sur le spec `08-forms.md` et l'inventaire de l'état actuel du code : backend CRUD complet (`services/signapps-forms/`, 11 handlers, port 3015), frontend avec 9 composants (éditeur + builder + responses), zéro data-testid, zéro E2E test, ~35% d'alignement avec le spec.
