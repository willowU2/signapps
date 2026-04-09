---
name: chat-debug
description: Use when debugging the Chat (messaging) module. Spec at docs/product-specs/11-chat.md. Frontend exists (3 pages, 17 components), backend via signapps-chat (port 3020). Rich component library including channels, DMs, threads, reactions, file sharing, voice messages. 0 data-testids, 0 E2E tests. WebSocket-based real-time messaging.
---

# Chat — Debug Skill

## Source of truth
**`docs/product-specs/11-chat.md`**

## Code map
- **Backend**: `services/signapps-chat/` — port **3020**
- **Frontend**: `client/src/app/chat/` (3 pages), `client/src/components/chat/` (17 components)
- **Real-time**: WebSocket (via signapps-collab or dedicated WS handler)
- **E2E**: 0 tests, 0 data-testids, no Page Object

## Key data-testids to add
`chat-root`, `chat-sidebar`, `chat-channel-list`, `chat-channel-item-{id}`, `chat-dm-item-{id}`, `chat-new-channel-button`, `chat-new-dm-button`, `chat-message-list`, `chat-message-item-{id}`, `chat-message-input`, `chat-message-send-button`, `chat-message-reply-{id}`, `chat-message-react-{id}`, `chat-thread-panel`, `chat-file-attach-button`, `chat-search-input`

## Key journeys to test
1. Open a channel → see message history
2. Send a text message → appears in list for all users
3. Reply to a message (thread) → thread panel opens
4. React with emoji → reaction badge appears
5. Search messages → results displayed

## Common bug patterns (anticipated)
1. **WebSocket reconnect lost messages** — messages sent during reconnect are dropped
2. **Thread count stale** — parent message reply count doesn't update on new thread reply
3. **File upload in chat exceeds size limit silently** — no error toast
4. **Channel membership not updated after invite** — need websocket push for membership changes
5. **Tiptap in chat input conflicts with keyboard shortcuts** — Enter vs Shift+Enter

## Dependencies
- **Tiptap** (MIT) for rich text input ✅
- **socket.io** or native WS — check which is used
- **date-fns** (MIT) for timestamp formatting ✅

## Historique
- **2026-04-09** : Skill créé. 3 pages + 17 composants, 0 E2E, 0 testids.
