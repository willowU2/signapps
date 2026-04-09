---
name: status-page-debug
description: Debug skill for the Status Page module (/status). Client-side health checks against all platform services with 10s auto-refresh, uptime badges, sparkline latency charts, and down-detection toast alerts.
---

# Status Page — Debug Skill

## Source of truth

**`docs/product-specs/54-status-page.md`** — read spec first.

## Code map

### Backend (Rust)
- **No dedicated backend** — the status page calls each service's `/health` endpoint directly from the browser via `fetch(..., { mode: "no-cors" })`
- **Health endpoints**: every service exposes `GET /health` (Identity :3001, Containers :3002, Proxy :3003, Storage :3004, AI :3005, SecureLink :3006, Scheduler :3007, Metrics :3008, Media :3009, Docs :3010, Calendar :3011, Chat :3013)

### Frontend (Next.js)
- **Page**: `client/src/app/status/page.tsx` (single-file, no sub-components)
- **No store** — all state is local `useState`/`useRef`
- **No API client** — raw `fetch` to `http://localhost:<port>/health`
- **Constants**: `SERVICES` array (name, port, path), `REFRESH_INTERVAL_MS = 10_000`, `MAX_HISTORY = 20`
- **Sub-components (inline)**: `Sparkline`, `UptimeBadge`, `checkServiceHealth`
- **Deps**: `date-fns` (format), `lucide-react` icons, `sonner` (toast on service down)

## Key data-testids (to add)

| data-testid | Element |
|---|---|
| `status-root` | Status page container |
| `status-overall-badge` | Overall status badge (online/offline/checking) |
| `status-online-count` | Online services count card |
| `status-offline-count` | Offline services count card |
| `status-total-count` | Total services count card |
| `status-uptime-global` | Global uptime percentage card |
| `status-service-{name}` | Individual service row |
| `status-refresh-btn` | Manual refresh button |
| `status-sparkline-{name}` | Sparkline chart per service |

## Key E2E journeys

1. **Initial load** — page loads, all services show "checking", then resolve to online/offline
2. **Auto-refresh** — wait 10s, verify lastRefresh timestamp updates
3. **Manual refresh** — click Rafraichir button, verify spinner + status updates
4. **Service down detection** — stop a service, wait for refresh cycle, verify toast notification and red badge
5. **Sparkline rendering** — after 3+ refresh cycles, verify sparkline SVG renders with data points

## Common bug patterns

1. **CORS / no-cors opacity** — `mode: "no-cors"` means response is opaque; a 200 still appears as `type: "opaque"` so the code treats any non-error fetch as "online". If a service returns an error status, it may still show as online.
2. **AbortController timeout race** — the 5s timeout via `AbortController` can fire after component unmount if the interval is cleared late, causing state updates on unmounted component.
3. **History accumulation** — `MAX_HISTORY = 20` entries per service; if the page stays open for hours the history is bounded but the sparkline may show stale data if services flicker.
4. **Port mismatch** — the `SERVICES` array is hardcoded in the frontend. If a backend service port changes (e.g., Chat moved from 3020 to 3013), the status page will report false offline.
5. **SSR hydration** — `new Date()` in initial state causes hydration mismatch; `"use client"` mitigates but edge cases remain.

## Debug checklist

- [ ] Verify the `SERVICES` array ports match the actual running services
- [ ] Check browser DevTools Network tab for failed `/health` requests
- [ ] Confirm `mode: "no-cors"` behavior — opaque responses always count as online
- [ ] Test with 1+ services stopped to verify toast alerts fire
- [ ] Verify `setInterval` cleanup on unmount (no memory leak)
- [ ] Check sparkline SVG renders after >= 2 data points collected

## Dependencies (license check)

- **Frontend**: react, next, date-fns, lucide-react, sonner — MIT
- Verify: `cd client && npm run license-check:strict`
