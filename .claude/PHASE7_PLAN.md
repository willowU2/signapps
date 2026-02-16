# Phase 7: Real-time Collaboration - Planning Document

**Status:** 🚀 IN PLANNING
**Target Date:** 1 week
**Technology:** Yrs 0.17.4 + WebSocket + Tokio broadcast

---

## Overview

**Goal:** Add real-time multi-user collaboration to calendars and events, similar to signapps-docs WebSocket architecture.

**Key Features:**
- Live event editing across multiple users
- Real-time calendar updates
- Presence awareness (who's viewing/editing)
- CRDT-based conflict resolution
- Offline support with sync

**Architecture:** WebSocket-based event streaming with Yrs CRDT library

---

## Phase Objectives

### 1. Event Streaming (Week 1)
- [ ] Add WebSocket endpoint: `/api/v1/calendars/:id/ws`
- [ ] Setup Yrs document per calendar
- [ ] Broadcast channel per calendar
- [ ] Client connection management
- [ ] Test: Multi-client sync

### 2. Presence System (Week 2)
- [ ] Track connected users per calendar
- [ ] Send presence updates (join/leave)
- [ ] Display active editors in UI
- [ ] Presence heartbeat

### 3. Conflict Resolution (Week 3)
- [ ] CRDT-based event merging
- [ ] Handle simultaneous edits
- [ ] Version vector for causality
- [ ] Test: Conflict scenarios

### 4. UI Integration (Week 4)
- [ ] Real-time calendar updates
- [ ] Live event editing indicators
- [ ] Presence avatars in header
- [ ] Offline indicator

---

## Technical Stack

### Backend
- **Framework:** Axum + Tokio
- **Real-time:** Yrs 0.17.4 (CRDT)
- **Broadcast:** tokio::sync::broadcast
- **Storage:** DashMap (in-memory with disk backup)

### Frontend
- **Library:** yjs (JavaScript binding to Yrs)
- **WebSocket:** Browser native WebSocket API
- **State:** Zustand + yjs bindings

---

## Architecture Design

```
┌─────────────────────────────────────────────────┐
│          Calendar Service (Port 3011)            │
├─────────────────────────────────────────────────┤
│                                                  │
│  GET /api/v1/calendars/:id/ws ──→ WebSocket    │
│         │                                        │
│         ├─→ Yrs Document (per calendar)         │
│         │   └─ Shared state (events, tasks)     │
│         │                                        │
│         ├─→ Broadcast Channel                   │
│         │   └─ Multi-client sync                │
│         │                                        │
│         ├─→ DashMap<CalendarId, Doc>            │
│         │   └─ In-memory storage                │
│         │                                        │
│         └─→ Presence Manager                    │
│             └─ Track active users               │
│                                                  │
│  ┌──────────────┐   ┌──────────────┐            │
│  │ Client A     │   │ Client B     │            │
│  │ (WebSocket)  │   │ (WebSocket)  │            │
│  └──────────────┘   └──────────────┘            │
│       ↑                    ↑                     │
│       └────────┬───────────┘                    │
│                ↓                                │
│          Document Sync                         │
│          (Yrs Protocol)                        │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## API Specification

### WebSocket Endpoint

**URL:** `GET /api/v1/calendars/:calendar_id/ws`

**Connection:**
```javascript
const ws = new WebSocket(
  'ws://localhost:3011/api/v1/calendars/550e8400-e29b-41d4-a716-446655440000/ws',
  ['yjs', 'presence']
);
```

**Message Types:**

#### 1. Yrs Update
```json
{
  "type": "yrs_update",
  "data": "<binary yrs state vector>",
  "timestamp": "2026-02-16T20:00:00Z"
}
```

#### 2. Presence
```json
{
  "type": "presence",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_name": "alice@example.com",
  "action": "join|leave|idle|editing",
  "editing_item": "event_id_123",
  "timestamp": "2026-02-16T20:00:00Z"
}
```

#### 3. Sync Request
```json
{
  "type": "sync",
  "state_vector": "<base64 encoded>",
  "request_id": "abc123"
}
```

#### 4. Sync Response
```json
{
  "type": "sync_response",
  "update": "<base64 encoded yrs update>",
  "request_id": "abc123"
}
```

---

## Data Model

### Yrs Document Structure

```typescript
{
  calendar: {
    name: "Team Calendar",
    timezone: "UTC",
    shared_at: 1234567890
  },
  events: [
    {
      id: "evt_123",
      title: "Team Meeting",
      start: 1234567890,
      end: 1234571490,
      color: "#3b82f6",
      owner: "alice"
    }
  ],
  tasks: [
    {
      id: "task_123",
      title: "Project Review",
      status: "open",
      parent_id: null,
      due_date: 1234567890
    }
  ]
}
```

### Presence State

```typescript
{
  users: {
    "user_id_1": {
      name: "Alice",
      avatar: "https://...",
      status: "editing",
      editing_item: "event_123",
      last_seen: 1234567890
    },
    "user_id_2": {
      name: "Bob",
      avatar: "https://...",
      status: "viewing",
      editing_item: null,
      last_seen: 1234567890
    }
  }
}
```

---

## Implementation Plan

### Phase 7a: Backend WebSocket Setup (Days 1-2)

**Files to Create/Modify:**
- `services/signapps-calendar/src/handlers/websocket.rs` (NEW - 400 lines)
- `services/signapps-calendar/src/handlers/mod.rs` (ADD export)
- `services/signapps-calendar/src/main.rs` (ADD route)
- `services/signapps-calendar/src/services/realtime.rs` (NEW - 300 lines)

**Tasks:**
1. Setup WebSocket handler with Axum
2. Create Yrs document manager (DashMap)
3. Setup broadcast channel per calendar
4. Implement message parsing
5. Add connection state management

**Tests:**
- Single client connection
- Message round-trip
- Broadcast to multiple clients

### Phase 7b: Presence System (Days 3-4)

**Files to Create:**
- `services/signapps-calendar/src/services/presence.rs` (NEW - 250 lines)
- `client/src/hooks/use-presence.ts` (NEW - 200 lines)

**Tasks:**
1. Implement presence tracking
2. Handle join/leave events
3. Presence heartbeat
4. Idle detection (30s timeout)
5. UI indicator component

**Tests:**
- Join/leave tracking
- Heartbeat mechanism
- Presence synchronization

### Phase 7c: Frontend Integration (Days 5-6)

**Files to Modify/Create:**
- `client/src/hooks/use-calendar-ws.ts` (NEW - 300 lines)
- `client/src/components/calendar/RealtimeIndicator.tsx` (NEW - 150 lines)
- `client/src/app/calendar/page.tsx` (MODIFY - add WebSocket)

**Tasks:**
1. Setup yjs client library
2. Connect to WebSocket endpoint
3. Sync calendar state with Yrs
4. Handle offline/reconnect
5. Display presence in UI

**Tests:**
- Real-time event creation
- Simultaneous editing
- Connection loss recovery

### Phase 7d: Testing & Polish (Days 7)

**Tasks:**
1. End-to-end multi-client test
2. Performance profiling
3. Connection failure scenarios
4. Offline sync testing
5. Documentation

---

## Dependencies

### Cargo (Rust)
```toml
yrs = "0.17"              # CRDT library
tokio = "1.49"            # Already included
serde = "1.0"             # Serialization
uuid = "1.0"              # Identifiers
```

### NPM (Frontend)
```json
{
  "yjs": "^13.6.0",
  "lib0": "^0.2.100",
  "ws": "^8.14.0"
}
```

---

## Known Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Memory growth (many docs) | 🔴 HIGH | Implement doc TTL + eviction |
| Network congestion | 🟠 MED | Message batching, compression |
| Conflict storms | 🔴 HIGH | CRDT guarantees + test scenarios |
| Stale presence | 🟠 MED | Heartbeat + timeout |
| Lost updates | 🔴 HIGH | Persistent event log |

---

## Success Criteria

### Functional
- ✓ Multiple users can edit calendar simultaneously
- ✓ Changes sync in <500ms
- ✓ No data loss on connection failure
- ✓ Presence shows active users
- ✓ Offline changes merge on reconnect

### Performance
- ✓ <100ms latency for local edits
- ✓ Handle 50+ concurrent connections
- ✓ Memory: <100MB per 100 calendars
- ✓ CPU: <5% idle, <20% active

### Reliability
- ✓ 99.9% uptime
- ✓ Zero data corruption
- ✓ Graceful degradation

---

## Comparison: signapps-docs vs Phase 7

### Similarities (Leverage)
- ✅ Same Yrs library (0.17.4)
- ✅ Same WebSocket pattern
- ✅ Same broadcast channel approach
- ✅ Same message protocol

### Differences (New)
- 🆕 Presence tracking required
- 🆕 Multiple doc types (Events, Tasks)
- 🆕 Integration with existing REST API
- 🆕 Offline sync capability

---

## Timeline

```
Week 1:
  Mon-Tue: WebSocket + Yrs setup (15 commits)
  Wed-Thu: Presence system (8 commits)
  Fri: Integration & polish (5 commits)

Estimated: 28 commits, 1,200 lines of code
```

---

## Rollout Strategy

### Phase 7.1: Internal Testing (Feb 17)
- Deploy to staging
- Test multi-client scenarios
- Verify no data loss

### Phase 7.2: Beta Release (Feb 18)
- Enable for 25% of users
- Monitor performance
- Collect feedback

### Phase 7.3: Full Release (Feb 19)
- Enable for 100% of users
- Continuous monitoring
- Support ticket handling

---

## What Comes After

**Phase 8:** Advanced Notifications (Email, SMS, Push)
- Event reminders
- Comment notifications
- Share invitations

**Phase 9:** External Calendar Sync
- Google Calendar integration
- Outlook sync
- iCloud support

---

## Resources

### Reference
- signapps-docs WebSocket implementation
- Yrs documentation: https://docs.yjs.dev
- Tokio WebSocket patterns

### Team
- 1 Backend developer (WebSocket + Yrs)
- 1 Frontend developer (React integration)
- Code review: 2-3 hours per day

---

**Ready to begin Phase 7!** 🚀

Questions before starting:
1. Should we include offline persistence (SQLite)?
2. Maximum concurrent users per calendar?
3. Should presence show last edit time?
4. Is presence needed for read-only viewers?
