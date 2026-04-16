# A11y Axe Baseline Summary — 2026-04-16 (post wave-2/3)

Source: `@axe-core/playwright` runtime audit via `client/e2e/a11y-audit.spec.ts`
Raw data: `docs/bug-sweep/a11y-axe-baseline.json`

**Total routes audited:** 240
**Routes with errors (non-a11y):** 0
**Total violations (node-level):** 1419   *(down from 2914 — **-1495, -51%**)*

## Violations by impact

| Impact | Before | After | Delta |
|---|---:|---:|---:|
| critical | 1523 | 531 | **-992 (-65%)** |
| serious | 15 | 2 | **-13 (-87%)** |
| moderate | 1265 | 814 | -451 (-36%) |
| minor | 111 | 72 | -39 (-35%) |

## Top rules — before → after

| Rule | Before | After | Delta | Routes |
|---|---:|---:|---:|---:|
| `button-name` | 1511 | 521 | **-990** | 67 (was 108) |
| `region` | 838 | 516 | **-322** | 230 (was 240) |
| `skip-link` | 136 | 79 | **-57** | 79 (was 136) |
| `landmark-one-main` | 135 | 79 | **-56** | 79 (was 135) |
| `heading-order` | 116 | 75 | -41 | 68 (was 104) |
| `aria-allowed-role` | 107 | 69 | -38 |  |
| `landmark-unique` | 24 | 7 | -17 |  |
| `nested-interactive` | 5 | 0 | -5 |  |
| `landmark-main-is-top-level` | 5 | 1 | -4 |  |
| `landmark-no-duplicate-main` | 5 | 1 | -4 |  |
| `page-has-heading-one` | 4 | **56** | **+52** | see notes |
| `link-name` | 2 | 0 | -2 |  |

## Biggest per-route improvements

| Route | Before | After | Delta |
|---|---:|---:|---:|
| `/admin/feature-flags` | 70 | 12 | **-58** |
| `/mail/templates` | 39 | 0 | -39 |
| `/ai` | 27 | 0 | -27 |
| `/storage` | 28 | 2 | -26 |
| `/workforce/hr` | 26 | 2 | -24 |
| `/scheduling` | 23 | 2 | -21 |
| `/wiki` | 23 | 2 | -21 |
| `/containers` | 30 | 10 | -20 |
| `/notifications` | 20 | 0 | -20 |
| `/workforce` | 22 | 2 | -20 |
| `/analytics` | 19 | 0 | -19 |
| `/social/calendar` | 21 | 2 | -19 |
| `/forms`, `/forms/new`, `/login` | 18 | 0 | -18 each |

## Regressions to triage

| Route | Before | After | Delta |
|---|---:|---:|---:|
| `/accounting` | 19 | 36 | **+17** |
| `/` (root splash) | 14 | 16 | +2 |

`/accounting` is the one material regression — worth a look in the next
session. `/` gained 2 violations probably from the new `<main>` shell
exposing something axe couldn't see before.

## `page-has-heading-one` — expected side effect

Went from 4 to 56 (+52). Not a regression : when pages lacked a `<main>`
landmark, axe skipped the rule. Now that wave 2/2b/2c pages have
`<main id="main-content">`, the rule engages and flags 52 pages where
the first visible heading is `<h2>` or lower. Fix is a one-liner per
page : promote the top `<PageHeader>` heading to `<h1>`, or have
`PageHeader` itself pick its level.

## Next waves

1. **`button-name` remaining 521 / 67 routes** — the TooltipIconButton
   helper + dev-warn are in place, 125+ hand-wired sites migrated so
   far. Continue opportunistically and the dev-warn will flag new
   regressions.
2. **`region` remaining 516 / 230 routes** — most remaining violations
   are table cells, card surfaces, and inline widgets outside any
   landmark. Wrap shared shells (PageHeader, Card, Table) in `<section>`
   or `<aside>` where appropriate.
3. **`page-has-heading-one` 56 routes** — one-pass sweep on
   `PageHeader` to auto-emit `<h1>` for the first instance per page.
4. **`/accounting` regression** — narrow triage of the +17 delta.

Raw delta command :

```bash
node tools/a11y-audit-delta.mjs \
  docs/bug-sweep/a11y-axe-pre-wave2.json \
  docs/bug-sweep/a11y-axe-baseline.json
```
