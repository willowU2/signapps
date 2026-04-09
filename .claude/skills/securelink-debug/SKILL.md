---
name: securelink-debug
description: Debug skill for the SecureLink module (/securelink). Backend on signapps-securelink port 3006. Covers 4 tabs — Dashboard (KPI cards, traffic chart), Tunnels (CRUD, quick connect, reconnect), Relays (CRUD, connect/disconnect, stats), DNS (config, blocklists, records, cache flush).
---

# SecureLink — Debug Skill

## Source of truth

**`docs/product-specs/61-securelink.md`** — read spec first.

## Code map

### Backend (Rust)

- **Service**: `services/signapps-securelink/` — port **3006**
- **Main**: `services/signapps-securelink/src/main.rs` — Axum router, standalone mode (no database)
- **Handlers**:
  - `services/signapps-securelink/src/handlers/tunnels.rs` — CRUD + quick connect + bulk + reconnect
  - `services/signapps-securelink/src/handlers/relays.rs` — CRUD + connect/disconnect/test/stats
  - `services/signapps-securelink/src/handlers/dns.rs` — config, blocklists, records, stats, query, cache flush
  - `services/signapps-securelink/src/handlers/devices.rs` — device management
  - `services/signapps-securelink/src/handlers/vpn.rs` — mesh VPN (feature-gated)
  - `services/signapps-securelink/src/handlers/openapi.rs` — OpenAPI doc
- **Core modules**:
  - `services/signapps-securelink/src/tunnel/` — TunnelClient, proxy, types
  - `services/signapps-securelink/src/dns/` — resolver, blocker, server
  - `services/signapps-securelink/src/vpn/` — mesh VPN (optional `mesh-vpn` feature)
  - `services/signapps-securelink/src/dhcp/` — DHCP server (optional `dhcp-server` feature)
- **State**: `AppState` — in-memory only (tunnel_client, dns_config, blocklists, dns_stats, traffic_history)
- **Auth**: JWT middleware on tunnels/relays/DNS routes; dashboard and health are public
- **Routes**:
  - Public: `/health`, `/api/v1/dashboard/*`
  - Protected: `/api/v1/tunnels/*`, `/api/v1/relays/*`, `/api/v1/dns/*`
  - Swagger: `/swagger-ui`

### Frontend (Next.js)

- **Page**: `client/src/app/securelink/page.tsx` (single file, ~700 lines, 4 tab components inline)
- **API client**: `client/src/lib/api/securelink.ts` — typed client for all 4 endpoint groups
- **Types**: exported from `client/src/lib/api/securelink.ts` (DashboardStats, DashboardTraffic, Tunnel, Relay, DnsConfig, DnsBlocklist, DnsRecord, DnsStats, etc.)
- **Store**: none — each tab uses local `useState` + `useCallback`

## Key data-testids (to add)

| data-testid | Element |
|---|---|
| `securelink-root` | Page container |
| `securelink-tab-dashboard` | Dashboard tab trigger |
| `securelink-tab-tunnels` | Tunnels tab trigger |
| `securelink-tab-relays` | Relays tab trigger |
| `securelink-tab-dns` | DNS tab trigger |
| `securelink-refresh-btn` | Dashboard refresh button |
| `securelink-kpi-{label}` | KPI stat card (active_tunnels, active_relays, dns_queries_today, blocked_queries_today) |
| `securelink-traffic-chart` | Traffic overview card |
| `tunnel-create-btn` | New Tunnel button |
| `tunnel-quick-connect-btn` | Quick Connect button |
| `tunnel-row-{id}` | Tunnel table row |
| `tunnel-reconnect-{id}` | Reconnect dropdown item |
| `tunnel-delete-{id}` | Delete dropdown item |
| `relay-create-btn` | New Relay button |
| `relay-row-{id}` | Relay table row |
| `relay-connect-{id}` | Connect dropdown item |
| `relay-disconnect-{id}` | Disconnect dropdown item |
| `dns-config-card` | DNS configuration card |
| `dns-blocklist-{id}` | Blocklist row |
| `dns-add-blocklist-btn` | Add blocklist button |
| `dns-flush-cache-btn` | Flush DNS cache button |

## Key E2E journeys

1. **Dashboard load** — navigate to /securelink, verify 4 KPI cards render with values, traffic section visible
2. **Create tunnel** — switch to Tunnels tab, click New Tunnel, fill form, submit, verify tunnel appears in table
3. **Quick connect** — click Quick Connect, enter host+port, verify tunnel created with auto-generated name
4. **Reconnect tunnel** — open dropdown on an existing tunnel, click Reconnect, verify toast confirmation
5. **Delete tunnel** — open dropdown, click Delete, confirm AlertDialog, verify tunnel removed from table
6. **Create relay** — switch to Relays tab, click New Relay, fill form, verify relay appears in table
7. **Connect/disconnect relay** — connect a relay, verify status badge changes, disconnect, verify reverts
8. **DNS config** — switch to DNS tab, toggle blocking, update upstream servers, verify saved
9. **Refresh dashboard** — click Refresh button, verify spinner animation, data reloads

## Common bug patterns

1. **Traffic chart always empty** — background task writes `bytes_in: 0, bytes_out: 0` because no real traffic counters are wired. Dashboard shows "No traffic data available" until the service runs for 1+ minutes.
2. **State not persisted** — `AppState` is entirely in-memory (no database). Restarting the service loses all tunnels, relays, DNS records, and blocklists.
3. **Dashboard routes are public** — `/api/v1/dashboard/*` has no auth middleware. This is intentional for health monitoring but may leak stats to unauthenticated users.
4. **Tunnel status always stale** — `TunnelClient` status depends on WebSocket connection state, but the frontend only fetches on load/refresh (no WebSocket subscription).
5. **DNS blocklist refresh is a no-op** — `refresh_blocklist` handler exists but the actual HTTP fetch + parse of external blocklist URLs may not be implemented.
6. **Page is one giant file** — all 4 tabs (Dashboard, Tunnels, Relays, DNS) are inline in `page.tsx` (~700 lines). Refactoring into separate components would improve maintainability.
7. **Port conflict** — service runs on 3006; ensure no other process uses this port.

## Debug checklist

- [ ] Verify service starts: `just run securelink` or `cargo run -p signapps-securelink`
- [ ] Health check: `curl http://localhost:3006/health`
- [ ] Swagger UI: `http://localhost:3006/swagger-ui/`
- [ ] Dashboard stats: `curl http://localhost:3006/api/v1/dashboard/stats`
- [ ] Frontend: navigate to `/securelink`, verify all 4 tabs render
- [ ] Create a tunnel via the UI, verify it appears in the table
- [ ] Check browser Network tab for 401/403 errors on protected endpoints
- [ ] Check for CORS errors if frontend is on port 3000 (allowed origins: localhost:3000, 127.0.0.1:3000)
- [ ] Verify DNS tab loads config and default blocklists (Steven Black, AdAway)
- [ ] Check console for React warnings (missing keys, effect deps)

## Dependencies (license check)

- **Backend**: axum, tokio, tower-http, utoipa, uuid, chrono, serde — MIT/Apache-2.0
- **Frontend**: react, next, sonner, lucide-react — MIT
- Verify: `just deny-licenses && cd client && npm run license-check:strict`
