---
name: remote-debug
description: Debug skill for the Remote Desktop module. Backend on signapps-remote (Guacamole-based). Covers RDP, VNC, SSH sessions, session recording, and connection management.
---

# Remote Desktop — Debug Skill

## Source of truth

**`docs/product-specs/45-remote.md`** — read spec first.

## Code map

### Backend (Rust)
- **Service**: `services/signapps-remote/` — port **3017**
- **Main**: `services/signapps-remote/src/main.rs`
- **Handlers**: `services/signapps-remote/src/handlers/`
- **Guacamole**: Apache Guacamole protocol for RDP/VNC/SSH
- **DB models**: `crates/signapps-db/src/models/remote*.rs`
- **WebSocket**: Guacamole client protocol over WS

### Frontend (Next.js)
- **Pages**: `client/src/app/remote/` (connections list, session viewer)
- **Components**: `client/src/components/remote/` (canvas display, connection form, toolbar)
- **Guacamole client**: JavaScript client rendering remote display on canvas
- **API client**: `client/src/lib/api/remote.ts`

## Key data-testids (to add)

| data-testid | Element |
|---|---|
| `remote-root` | Remote page container |
| `remote-connection-{id}` | Connection entry |
| `remote-connect-btn` | Connect button |
| `remote-canvas` | Remote display canvas |
| `remote-disconnect-btn` | Disconnect button |
| `remote-new-connection` | New connection form |
| `remote-session-record` | Session recording toggle |

## Key E2E journeys

1. **Create connection** — add RDP/VNC/SSH connection config, save
2. **Connect session** — open connection, verify remote display rendered on canvas
3. **Session management** — list active sessions, disconnect one, verify closed
4. **Session recording** — enable recording, connect, verify recording stored

## Common bug patterns

1. **Guacamole daemon unavailable** — guacd process not running; service fails silently
2. **WebSocket proxy issues** — reverse proxy strips WS upgrade headers; connection fails
3. **Keyboard mapping** — special keys (Ctrl+Alt+Del) not forwarded correctly

## Dependencies (license check)

- **Apache Guacamole** — Apache-2.0
- **guacamole-common-js** — Apache-2.0 (client library)
- **Backend**: axum, tokio-tungstenite — MIT/Apache-2.0
- Verify: `just deny-licenses && cd client && npm run license-check:strict`
