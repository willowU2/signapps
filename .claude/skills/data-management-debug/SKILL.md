---
name: data-management-debug
description: Debug skill for the Data Management module (/data-management). Covers 4 tabs — Data Masking, GDPR Deletion, PII Detector, Anonymization. All client-side only (no backend service), uses local state and regex-based detection.
---

# Data Management — Debug Skill

## Source of truth

**`docs/product-specs/60-data-management.md`** — read spec first.

## Code map

### Backend (Rust)

- **No dedicated backend service** — all 4 tabs are currently client-side only
- **GDPR deletion** simulates processing with `setTimeout` — no real API call yet
- **Masking rules** are stored in React `useState` — not persisted to any backend

### Frontend (Next.js)

- **Page**: `client/src/app/data-management/page.tsx`
- **Components**:
  - `client/src/components/data/data-masking.tsx` — masking rules table, add/toggle/remove rules
  - `client/src/components/data/gdpr-deletion-workflow.tsx` — GDPR Art.17 deletion requests with progress
  - `client/src/components/data/pii-detector.tsx` — regex-based PII scanner (email, phone, SSN, IBAN, CC, etc.)
  - `client/src/components/data/data-anonymization.tsx` — replace PII with fake values (faker-style)
- **Other data components** (not wired to this page):
  - `client/src/components/data/data-catalog.tsx`
  - `client/src/components/data/data-lineage.tsx`
  - `client/src/components/data/master-data.tsx`
  - `client/src/components/data/quality-scores.tsx`
- **Store**: none — each component uses local `useState`
- **API client**: none — no backend calls

## Key data-testids (to add)

| data-testid | Element |
|---|---|
| `data-management-root` | Page container |
| `data-tab-masking` | Masking tab trigger |
| `data-tab-gdpr` | GDPR Deletion tab trigger |
| `data-tab-pii` | PII Detector tab trigger |
| `data-tab-anon` | Anonymization tab trigger |
| `masking-add-rule-btn` | Add Rule button |
| `masking-rule-{id}` | Individual masking rule row |
| `masking-toggle-{id}` | Rule enable/disable switch |
| `masking-delete-{id}` | Rule delete button |
| `gdpr-email-input` | Email input for deletion request |
| `gdpr-submit-btn` | Submit deletion request button |
| `gdpr-request-{id}` | Individual deletion request card |
| `pii-textarea` | PII Detector text input |
| `pii-scan-btn` | Scan for PII button |
| `pii-results` | PII results container |
| `anon-input` | Anonymization input textarea |
| `anon-output` | Anonymization output textarea |
| `anon-run-btn` | Anonymize button |

## Key E2E journeys

1. **Add masking rule** — click Add Rule, fill table+column+strategy, confirm — verify rule appears in list
2. **Toggle masking rule** — toggle a rule off, verify opacity changes, toggle back on
3. **GDPR deletion** — enter email, submit, watch progress bar complete across 7 services
4. **PII detection** — paste text with emails/phones/IBANs, click Scan, verify matches highlighted
5. **Anonymization** — paste PII text, toggle options, click Anonymize, verify output has fake values

## Common bug patterns

1. **Masking rules not persisted** — all rules are in React state only; page refresh loses custom rules. Need backend API.
2. **GDPR deletion is simulated** — uses `setTimeout` to fake service-by-service deletion. Not connected to any real backend purge endpoint.
3. **PII regex false positives** — French postal code regex (`/\b(?:0[1-9]|[1-8]\d|9[0-5])\d{3}\b/`) matches any 5-digit number that looks like a postcode (e.g. amounts, IDs).
4. **Anonymization name replacement not implemented** — `names: false` default, and even when enabled the regex for names is missing from the `anonymize()` function.
5. **GDPR services list hardcoded** — `SERVICES_TO_PURGE` array is a static constant, not fetched from the platform's actual service registry.
6. **No backend validation** — masking strategy "hash" and "fake" are labels only; no actual hashing or faker library is invoked.

## Debug checklist

- [ ] Verify all 4 tabs render without errors: masking, gdpr, pii, anon
- [ ] Check that the 3 default masking rules display (users.email, users.password_hash, contacts.phone)
- [ ] Add a new masking rule and verify it appears in the list
- [ ] Submit a GDPR deletion request and verify progress completes to 100%
- [ ] Paste text with known PII (email, phone) into PII Detector and verify matches
- [ ] Run anonymization on text with emails and verify output contains `@example.test`
- [ ] Check console for React warnings (key prop, missing deps in useEffect, etc.)

## Dependencies (license check)

- **Frontend**: react, next, sonner, lucide-react — MIT
- Verify: `cd client && npm run license-check:strict`
