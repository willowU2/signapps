---
name: accounting-debug
description: Debug skill for the Accounting module (invoices, ledger, reports). Currently MOCK data — backend being created. Covers invoicing, journal entries, financial reports, and tax compliance.
---

# Accounting — Debug Skill

## Source of truth

**`docs/product-specs/34-accounting.md`** — read spec first.

**Status**: MOCK data — backend being created.

## Code map

### Backend (Rust)
- **Service**: TBD — may be `signapps-billing` port **8096** or new dedicated service
- **DB models**: to be created in `crates/signapps-db/src/models/accounting*.rs`
- **Migrations**: to be created (chart of accounts, journal entries, invoices)

### Frontend (Next.js)
- **Pages**: `client/src/app/accounting/` (ledger, invoices, reports, settings)
- **Components**: `client/src/components/accounting/`
- **Mock data**: hardcoded MOCK_* constants — to be replaced
- **API client**: `client/src/lib/api/accounting.ts` (stub or missing)

## Key data-testids (to add)

| data-testid | Element |
|---|---|
| `accounting-root` | Accounting page container |
| `ledger-table` | General ledger table |
| `invoice-{id}` | Invoice row |
| `invoice-create-btn` | Create invoice button |
| `report-{type}` | Financial report (P&L, balance sheet) |
| `journal-entry-{id}` | Journal entry |

## Key E2E journeys

1. **Create invoice** — create, add line items, save, verify total calculated
2. **Journal entry** — create debit/credit entry, verify balanced
3. **Financial report** — generate P&L, verify totals match journal entries
4. **Invoice PDF export** — export invoice as PDF, verify download

## Common bug patterns

1. **MOCK data stale** — UI works with mocks but schema drift when backend wired
2. **Floating-point rounding** — currency calculations must use integer cents, not floats
3. **Double-entry integrity** — debit/credit imbalance not caught by frontend validation

## Dependencies (license check)

- **Backend**: axum, sqlx, rust_decimal — MIT/Apache-2.0
- **Frontend**: react, next — MIT
- **PDF**: avoid wkhtmltopdf (LGPL) — use headless Chromium or printpdf (MIT)
- Verify: `just deny-licenses && cd client && npm run license-check:strict`
