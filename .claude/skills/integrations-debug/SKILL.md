---
name: integrations-debug
description: Debug skill for the Integrations module (trigger builder, webhooks, third-party connectors). MIXED status — trigger builder runs in-memory. Covers workflow automation, API connectors, and webhook management.
---

# Integrations — Debug Skill

## Source of truth

**`docs/product-specs/36-integrations.md`** — read spec first.

**Status**: MIXED — trigger builder runs in-memory, some connectors are stubs.

## Code map

### Backend (Rust)
- **No dedicated service** — integration logic spread across services
- **Trigger builder**: in-memory execution engine (no persistence)
- **Webhooks**: per-service webhook handlers (e.g., forms, social)
- **PgEventBus**: internal event bus for cross-service triggers

### Frontend (Next.js)
- **Pages**: `client/src/app/integrations/` (trigger builder, connectors, logs)
- **Components**: `client/src/components/integrations/`
- **API client**: `client/src/lib/api/integrations.ts`

## Key data-testids (to add)

| data-testid | Element |
|---|---|
| `integrations-root` | Integrations page container |
| `trigger-builder` | Visual trigger/action builder |
| `trigger-{id}` | Trigger item |
| `connector-{name}` | Third-party connector card |
| `integration-log-{id}` | Execution log entry |
| `integration-test-btn` | Test integration button |

## Key E2E journeys

1. **Create trigger** — build "when form submitted, create task" automation
2. **Test integration** — trigger manually, verify action executed and logged
3. **Webhook config** — configure incoming/outgoing webhook, verify delivery
4. **Connector setup** — configure third-party connector (e.g., Slack), verify auth

## Common bug patterns

1. **In-memory trigger loss** — triggers lost on service restart; needs DB persistence
2. **Circular triggers** — trigger A fires B which fires A; no loop detection
3. **Connector auth expiry** — OAuth tokens expire, no auto-refresh; silent failures

## Dependencies (license check)

- **Backend**: axum, reqwest — MIT/Apache-2.0
- **Frontend**: react, reactflow (for visual builder) — MIT
- Verify: `just deny-licenses && cd client && npm run license-check:strict`
