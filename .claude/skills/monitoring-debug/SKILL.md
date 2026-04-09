---
name: monitoring-debug
description: Debug skill for the Monitoring module. Backend on signapps-metrics port 3008. Covers Prometheus metrics, system health, service status, alerts, and uptime monitoring.
---

# Monitoring — Debug Skill

## Source of truth

**`docs/product-specs/30-monitoring.md`** — read spec first.

## Code map

### Backend (Rust)
- **Service**: `services/signapps-metrics/` — port **3008**
- **Main**: `services/signapps-metrics/src/main.rs`
- **Handlers**: `services/signapps-metrics/src/handlers/`
- **Prometheus**: `/metrics` endpoint for scraping
- **Health checks**: per-service `/health` endpoints aggregated here

### Frontend (Next.js)
- **Pages**: `client/src/app/monitoring/` (dashboard, alerts, services status)
- **Components**: `client/src/components/monitoring/` (charts, status cards, alert rules)
- **API client**: `client/src/lib/api/metrics.ts`

## Key data-testids (to add)

| data-testid | Element |
|---|---|
| `monitoring-root` | Monitoring page container |
| `monitoring-service-{name}` | Service status card |
| `monitoring-chart-{metric}` | Metric chart |
| `monitoring-alert-{id}` | Alert rule |
| `monitoring-health-badge` | Overall health badge |

## Key E2E journeys

1. **Service health overview** — verify all services shown with green/red status
2. **Metric chart** — select metric, verify chart renders with data points
3. **Alert configuration** — create alert rule, verify saved and listed
4. **Service down detection** — stop a service, verify status changes to red

## Common bug patterns

1. **Stale metrics** — Prometheus scrape interval too long; dashboard shows outdated data
2. **Service discovery** — new service not auto-detected; must be manually registered
3. **Chart rendering OOM** — loading 30 days of per-second metrics crashes browser

## Dependencies (license check)

- **Backend**: prometheus, axum — MIT/Apache-2.0
- **Frontend**: recharts or chart.js — MIT
- Verify: `just deny-licenses && cd client && npm run license-check:strict`
