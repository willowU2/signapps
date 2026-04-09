---
name: meet-debug
description: Use when debugging the Meet (video conferencing) module. Spec at docs/product-specs/12-meet.md. Frontend exists (2 pages, 13 components), backend via signapps-meet (port 3014). WebRTC SFU architecture (LiveKit or custom). Includes media controls, screen sharing, recording, virtual backgrounds, breakout rooms. 0 data-testids, 0 E2E tests. NOTE: E2E testing of WebRTC requires special setup (fake media devices).
---

# Meet — Debug Skill

## Source of truth
**`docs/product-specs/12-meet.md`**

## Code map
- **Backend**: `services/signapps-meet/` — port **3014**
- **Frontend**: `client/src/app/meet/` (2 pages), `client/src/components/meet/` (13 components)
- **WebRTC**: SFU via LiveKit (Apache-2.0) or custom — check service implementation
- **E2E**: 0 tests, 0 data-testids, no Page Object

## Key data-testids to add
`meet-root`, `meet-join-button`, `meet-room-{id}`, `meet-video-grid`, `meet-video-tile-{peerId}`, `meet-controls-bar`, `meet-mute-audio`, `meet-mute-video`, `meet-share-screen`, `meet-end-call`, `meet-chat-panel`, `meet-participants-panel`, `meet-recording-button`, `meet-lobby`

## Key journeys to test
1. Create meeting room → get join link
2. Join meeting → see lobby → enter → video grid visible
3. Toggle audio/video → mute indicators update
4. Share screen → screen visible to other participants
5. End call → return to dashboard

## E2E testing notes
- **WebRTC needs fake media**: use `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream` Chromium flags
- **Multi-user tests** require 2 browser contexts
- **Screen sharing** can't be tested without permissions prompt bypass

## Common bug patterns (anticipated)
1. **Camera not released on leave** — `MediaStream.getTracks().forEach(t => t.stop())` must be called
2. **SFU reconnect drops audio** — ICE restart must be triggered
3. **Recording fails silently** — MediaRecorder API has browser-specific quirks
4. **Virtual background causes CPU spike** — canvas processing needs Web Worker
5. **Multiple tabs cause echo** — detect duplicate join and warn

## Dependencies
- **LiveKit client SDK** — Apache-2.0 ✅ (if used)
- **mediasoup-client** — ISC ✅ (alternative SFU)
- **hark** (MIT) for VAD ✅

### Forbidden
- **Jitsi** — Apache-2.0 (OK) but its full stack is heavy; check if only client lib is used
- **BigBlueButton** — LGPL ⚠️

## Historique
- **2026-04-09** : Skill créé. 2 pages + 13 composants, 0 E2E, 0 testids.
