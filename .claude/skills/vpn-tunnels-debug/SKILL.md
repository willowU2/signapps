---
name: vpn-tunnels-debug
description: Debug skill for the VPN & Tunnels module. Backend on signapps-securelink port 3006. Covers web tunnels, DNS management, VPN configuration, and secure link sharing.
---

# VPN & Tunnels — Debug Skill

## Source of truth

**`docs/product-specs/44-vpn-tunnels.md`** — read spec first.

## Code map

### Backend (Rust)
- **Service**: `services/signapps-securelink/` — port **3006**
- **Main**: `services/signapps-securelink/src/main.rs`
- **Handlers**: `services/signapps-securelink/src/handlers/`
- **Tunnel engine**: TCP/HTTP tunnel management, DNS record management
- **DB models**: `crates/signapps-db/src/models/securelink*.rs` or `tunnel*.rs`

### Frontend (Next.js)
- **Pages**: `client/src/app/vpn/` or `client/src/app/tunnels/` (tunnel list, DNS, config)
- **Components**: `client/src/components/vpn/` or `tunnels/`
- **API client**: `client/src/lib/api/securelink.ts`

## Key data-testids (to add)

| data-testid | Element |
|---|---|
| `tunnels-root` | Tunnels page container |
| `tunnel-{id}` | Tunnel entry row |
| `tunnel-create-btn` | Create tunnel button |
| `tunnel-status-{id}` | Tunnel status badge |
| `dns-record-{id}` | DNS record row |
| `vpn-config-download` | Download VPN config |

## Key E2E journeys

1. **Create tunnel** — configure target host:port, create tunnel, verify active
2. **Tunnel status** — verify tunnel shows connected/disconnected status
3. **DNS management** — add DNS record, verify propagation status displayed
4. **Share secure link** — generate shareable link, verify access with token

## Common bug patterns

1. **Port conflicts** — tunnel binds to already-used port; needs port availability check
2. **DNS propagation delay** — UI shows "pending" indefinitely; needs polling with timeout
3. **Tunnel process orphan** — tunnel process not cleaned up on service restart

## Dependencies (license check)

- **Backend**: axum, tokio (networking) — MIT/Apache-2.0
- **DNS**: trust-dns or hickory-dns — Apache-2.0/MIT
- Verify: `just deny-licenses && cd client && npm run license-check:strict`
