# A11y Axe Baseline Summary — 2026-04-16

Source: `@axe-core/playwright` runtime audit via `client/e2e/a11y-audit.spec.ts`
Raw data: `docs/bug-sweep/a11y-axe-baseline.json`

**Total routes audited:** 240
**Routes with errors (non-a11y):** 0
**Total violations (node-level):** 3194

## Violations by impact

| Impact | Count |
|---|---|
| critical | 1806 |
| serious | 13 |
| moderate | 1266 |
| minor | 109 |

## Top rules by count

| Rule | Impact | Count | Routes | Help |
|---|---|---|---|---|
| `button-name` | critical | 1794 | 106 | Buttons must have discernible text |
| `region` | moderate | 840 | 240 | All page content should be contained by landmarks |
| `landmark-one-main` | moderate | 137 | 137 | Document should have one main landmark |
| `skip-link` | moderate | 137 | 137 | The skip-link target should exist and be focusable |
| `heading-order` | moderate | 114 | 103 | Heading levels should only increase by one |
| `aria-allowed-role` | minor | 105 | 104 | ARIA role should be appropriate for the element |
| `landmark-unique` | moderate | 23 | 18 | Landmarks should have a unique role or role/label/title (i.e. accessible name) combination |
| `label` | critical | 9 | 3 | Form elements must have labels |
| `landmark-main-is-top-level` | moderate | 5 | 5 | Main landmark should not be contained in another landmark |
| `landmark-no-duplicate-main` | moderate | 5 | 5 | Document should not have more than one main landmark |
| `nested-interactive` | serious | 5 | 1 | Interactive controls must not be nested |
| `empty-table-header` | minor | 4 | 4 | Table header text should not be empty |
| `page-has-heading-one` | moderate | 3 | 3 | Page should contain a level-one heading |
| `aria-progressbar-name` | serious | 3 | 3 | ARIA progressbar nodes must have an accessible name |
| `scrollable-region-focusable` | serious | 3 | 3 | Scrollable region must have keyboard access |
| `aria-valid-attr-value` | critical | 2 | 2 | ARIA attributes must conform to valid values |
| `link-name` | serious | 2 | 2 | Links must have discernible text |
| `select-name` | critical | 1 | 1 | Select element must have an accessible name |
| `landmark-banner-is-top-level` | moderate | 1 | 1 | Banner landmark should not be contained in another landmark |
| `landmark-no-duplicate-banner` | moderate | 1 | 1 | Document should not have more than one banner landmark |

## Prioritization guidance for E1c

1. **Critical + serious impact affecting > 5 routes**: pattern-level fix in shared components.
2. **Moderate impact on <= 3 routes**: individual fixes (Phase E2).
3. **Minor impact**: defer to Phase E3.

Cross-reference with `a11y-lint-catalog.md` — when both flag the same component,
a single fix closes both.
