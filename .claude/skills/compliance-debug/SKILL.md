---
name: compliance-debug
description: Debug skill for the Compliance module. Backend on signapps-compliance port 3032. Covers GDPR, audit logs, data retention policies, consent management, and compliance reports.
---

# Compliance — Debug Skill

## Source of truth

**`docs/product-specs/31-compliance.md`** — read spec first.

## Code map

### Backend (Rust)
- **Service**: `services/signapps-compliance/` — port **3032**
- **Main**: `services/signapps-compliance/src/main.rs`
- **Handlers**: `services/signapps-compliance/src/handlers/`
- **DB models**: `crates/signapps-db/src/models/compliance*.rs` / `audit*.rs`
- **Migrations**: `migrations/*compliance*` or `*audit*`

### Frontend (Next.js)
- **Pages**: `client/src/app/compliance/` (audit log, retention, consent, reports)
- **Components**: `client/src/components/compliance/`
- **API client**: `client/src/lib/api/compliance.ts`

## Key data-testids (to add)

| data-testid | Element |
|---|---|
| `compliance-root` | Compliance page container |
| `audit-log-table` | Audit log list |
| `audit-log-entry-{id}` | Individual log entry |
| `retention-policy-{id}` | Data retention policy |
| `consent-banner` | Cookie/consent banner |
| `compliance-report-export` | Export compliance report |

## Key E2E journeys

1. **Audit log search** — filter by date/user/action, verify results
2. **Data retention** — configure policy, verify old data flagged for deletion
3. **Consent management** — user updates consent preferences, verify stored
4. **GDPR export** — request personal data export, verify ZIP generated

## Common bug patterns

1. **Audit log volume** — high-traffic actions flood the log; needs pagination and archival
2. **Retention cascade** — deleting data in one module leaves orphans in related modules
3. **Consent state race** — user changes consent while a processing job is mid-flight

## Dependencies (license check)

- **Backend**: axum, sqlx, chrono — MIT/Apache-2.0
- **Frontend**: react, next — MIT
- Verify: `just deny-licenses && cd client && npm run license-check:strict`
