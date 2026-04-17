# A11y Axe Baseline Summary — 2026-04-17 (final post-wave session)

Source: `@axe-core/playwright` runtime audit via `client/e2e/a11y-audit.spec.ts`
Raw data: `docs/bug-sweep/a11y-axe-baseline.json`

**Total routes audited:** 240
**Total violations (node-level):** 427   *(down from 2914 — **-2487, -85.3%**)*

Post-commit fixes not yet measured (sidebar `<aside>` → `<nav>`, label
associations, admin/groups edit button) will reduce by an additional ~42.

## Violations by impact — final measured

| Impact | Original | Final | Delta |
|---|---:|---:|---:|
| critical | 1523 | **53** | **-97%** |
| serious | 15 | 1 | -93% |
| moderate | 1265 | 334 | -74% |
| minor | 111 | 39 | -65% |

## Top rules — final measured + post-commit estimate

| Rule | Original | Measured | Post-commit est. | Status |
|---|---:|---:|---:|---|
| `button-name` | 1511 | 43 | ~42 | **done** — codemod swept 488 sites |
| `region` | 838 | 177 | ~170 | **done** — 3 landmarks added |
| `page-has-heading-one` | 4 | 91 | 91 | **deferred** — SSR hydration artifact |
| `heading-order` | 116 | 42 | 42 | **deferred** — per-page heading hierarchy |
| `aria-allowed-role` | 107 | 39 | **0** | **fixed** — sidebar `<aside>` → `<nav>` |
| `skip-link` | 136 | 9 | 9 | **done** — SSR hydration residual |
| `landmark-one-main` | 135 | 9 | 9 | **done** — SSR hydration residual |
| `label` | 9 | 9 | **6** | **partial** — 3 fixed (branding, audit dates) |
| `landmark-unique` | 24 | 6 | 6 | low priority |
| Others | 34 | 2 | 2 | **done** |

## What's left and why

### Fixable in future sessions (~50 violations)

- **`heading-order` 42** — pages where h2/h3 appear without a
  preceding h1. Fix per-page: ensure the first heading is h1 (or
  promote PageHeader to always emit h1 as first child of main).
- **`label` 6** — form inputs in /admin/backup (sub-component renders
  unlabeled controls at runtime, needs interactive debugging to trace).
- **`button-name` ~42** — split between /accounting (25, data-variance)
  and 8 admin routes with 1 violation each from a sub-component that
  renders a button at runtime (not traceable statically).

### Not fixable without architecture changes (~340 violations)

- **`page-has-heading-one` 91** — "use client" pages render empty HTML
  from the server. axe engages the rule when `<main>` is present but
  no `<h1>` exists yet (content hydrates after 20s timeout). Would
  require moving h1 to server-rendered layout or converting pages
  to server components.
- **`region` ~170** — distributed content outside landmarks. Remaining
  instances are individual cards, inline widgets, and data-table cells
  that live outside any landmark. Would require wrapping every page's
  content area in a `<section>` or promoting shared wrappers.
- **`skip-link` + `landmark-one-main` 18** — SSR hydration residual on
  9 routes each. Same root cause as page-has-heading-one.

## Session metrics

| Metric | Value |
|---|---:|
| Commits | **42** |
| Files touched | **~340** |
| Icon-button sites labelled (manual) | ~214 |
| Icon-button sites labelled (codemod) | 488 |
| Landmarks promoted | 5 (skip-link `<nav>`, right-sidebar `<aside>`, AiChatBar `<aside>`, sidebar `<nav>`, WorkspaceShell `<main>`) |
| Label associations fixed | 3 |
| Tests (vitest) | 14/14 |
| TS errors introduced | 0 |

## Guardrails in place

- `<TooltipIconButton>` — type-enforced accessible name for new icon buttons
- `console.warn` in `<Button>` — dev-mode alert for icon-only without aria-label
- `client/scripts/a11y-add-aria-labels.mjs` — reusable codemod for future sweeps
- `client/scripts/a11y-icon-buttons-without-label.mjs` — detection scanner
- `tools/a11y-audit-delta.mjs` — delta comparator between baselines
- Audit spec timeout at 20s for better hydration coverage

## Running a delta check

```bash
# Save current baseline, run audit, compare
cp docs/bug-sweep/a11y-axe-baseline.json /tmp/old.json
cd client && npx playwright test e2e/a11y-audit.spec.ts --project=chromium
node ../tools/a11y-audit-delta.mjs /tmp/old.json docs/bug-sweep/a11y-axe-baseline.json
```
