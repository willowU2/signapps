---
name: dashboard-debug
description: Debug skill for the Dashboard module. Aggregates data from multiple services (calendar, mail, tasks, social, metrics). No dedicated backend — frontend-only aggregation via gateway.
---

# Dashboard — Debug Skill

## Source of truth

**`docs/product-specs/28-dashboard.md`** — read spec first.

## Code map

### Backend
- **No dedicated service** — aggregates via `signapps-gateway` port **3099**
- Gateway proxies to: calendar (3011), mail (3012), social (3019), metrics (3008), etc.
- Custom dashboard configs may be stored in `signapps-storage` (3004) or user preferences

### Frontend (Next.js)
- **Main page**: `client/src/app/dashboard/page.tsx` (or `client/src/app/page.tsx`)
- **Components**: `client/src/components/dashboard/` (widgets, cards, charts, layout)
- **Widget types**: calendar preview, mail inbox, tasks due, social feed, metrics charts
- **API calls**: multiple parallel fetches to different service endpoints

## Key data-testids (to add)

| data-testid | Element |
|---|---|
| `dashboard-root` | Dashboard page container |
| `dashboard-widget-{type}` | Each widget (calendar, mail, tasks, etc.) |
| `dashboard-customize-btn` | Customize/edit layout |
| `dashboard-widget-add` | Add widget button |
| `dashboard-widget-remove-{type}` | Remove widget |
| `dashboard-refresh` | Refresh all data |

## Key E2E journeys

1. **Default dashboard loads** — verify all default widgets render with data
2. **Customize layout** — add/remove/reorder widgets, verify persists on reload
3. **Widget drill-down** — click calendar widget, navigate to full calendar page
4. **Data freshness** — create a task, return to dashboard, verify task appears

## Common bug patterns

1. **Waterfall requests** — sequential API calls instead of parallel; dashboard loads slowly
2. **Widget error isolation** — one failing service crashes entire dashboard instead of showing error in widget
3. **Stale cache** — dashboard data not refreshed after user action in another module

## Dependencies (license check)

- **Frontend**: react-grid-layout or similar — check MIT license
- **Charts**: recharts or chart.js — MIT
- Verify: `just deny-licenses && cd client && npm run license-check:strict`
