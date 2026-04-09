---
name: expenses-debug
description: Debug skill for the Expenses module. Currently MOCK data — backend being created. Covers expense reports, receipt scanning, approval workflows, and reimbursement tracking.
---

# Expenses — Debug Skill

## Source of truth

**`docs/product-specs/43-expenses.md`** — read spec first.

**Status**: MOCK data — backend being created.

## Code map

### Backend (Rust)
- **Service**: TBD — may use `signapps-billing` (8096) or new dedicated service
- **DB models**: to be created in `crates/signapps-db/src/models/expense*.rs`
- **OCR**: receipt scanning via `signapps-media` (3009) for text extraction
- **Migrations**: to be created (expenses, receipts, approval rules)

### Frontend (Next.js)
- **Pages**: `client/src/app/expenses/` (list, create, reports, approvals)
- **Components**: `client/src/components/expenses/`
- **Mock data**: hardcoded MOCK_* constants — to be replaced
- **API client**: `client/src/lib/api/expenses.ts` (stub or missing)

## Key data-testids (to add)

| data-testid | Element |
|---|---|
| `expenses-root` | Expenses page container |
| `expense-{id}` | Expense entry row |
| `expense-create-btn` | Create expense button |
| `expense-receipt-upload` | Receipt upload input |
| `expense-submit-btn` | Submit for approval |
| `expense-approve-{id}` | Approve button (manager) |
| `expense-total` | Total amount display |

## Key E2E journeys

1. **Create expense** — enter amount, category, attach receipt, save
2. **Receipt OCR** — upload receipt image, verify amount auto-extracted
3. **Submit report** — group expenses into report, submit for approval
4. **Manager approval** — approve/reject expense report, verify status update

## Common bug patterns

1. **MOCK data stale** — schema drift when backend wired
2. **Currency rounding** — must use integer cents, not float amounts
3. **Receipt OCR accuracy** — poor quality images produce wrong amounts; needs manual override

## Dependencies (license check)

- **Backend**: axum, sqlx, rust_decimal — MIT/Apache-2.0
- **OCR**: tesseract — Apache-2.0
- Verify: `just deny-licenses && cd client && npm run license-check:strict`
