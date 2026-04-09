---
name: notifications-debug
description: Debug skill for the Notifications module. Backend on signapps-notifications port 8095. Covers push notifications, in-app notifications, email digest, WebSocket real-time delivery, and notification preferences.
---

# Notifications — Debug Skill

## Source of truth

**`docs/product-specs/27-notifications.md`** — read spec first.

## Code map

### Backend (Rust)
- **Service**: `services/signapps-notifications/` — port **8095**
- **Main**: `services/signapps-notifications/src/main.rs`
- **Handlers**: `services/signapps-notifications/src/handlers/`
- **DB models**: `crates/signapps-db/src/models/notification*.rs`
- **Delivery**: WebSocket, email digest, push (Web Push API)
- **Event bus**: PgEventBus listener for cross-service notifications

### Frontend (Next.js)
- **Bell/dropdown**: `client/src/components/notifications/` (bell icon, dropdown, toast)
- **Settings page**: `client/src/app/settings/notifications/`
- **API client**: `client/src/lib/api/notifications.ts`
- **WebSocket**: real-time connection for instant delivery

## Key data-testids (to add)

| data-testid | Element |
|---|---|
| `notification-bell` | Bell icon in header |
| `notification-dropdown` | Notification dropdown panel |
| `notification-item-{id}` | Individual notification |
| `notification-mark-read` | Mark all as read |
| `notification-settings` | Preferences page |
| `notification-toast` | Toast popup |

## Key E2E journeys

1. **Receive in-app notification** — trigger event, verify bell badge increments, click to see
2. **Mark as read** — open notification, verify read state persists on reload
3. **Notification preferences** — disable a channel, verify no delivery on that channel
4. **Real-time delivery** — WebSocket connected, receive notification without page refresh

## Common bug patterns

1. **WebSocket reconnection** — connection drops silently; must auto-reconnect with backoff
2. **Badge count desync** — count in bell differs from actual unread count in DB
3. **Duplicate notifications** — PgEventBus replay after service restart sends duplicates

## Dependencies (license check)

- **Backend**: axum, tokio-tungstenite, web-push — MIT/Apache-2.0
- **Frontend**: react, next — MIT
- Verify: `just deny-licenses && cd client && npm run license-check:strict`
