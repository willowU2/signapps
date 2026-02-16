# Phase 7: Real-time Collaboration - INITIATED 🚀

**Date:** February 16, 2026
**Status:** ✅ OFFICIALLY STARTED
**Target:** Multi-user real-time calendar editing with Yrs CRDT

---

## Summary

Phase 7 adds **real-time multi-user collaboration** to the calendar system using WebSocket and Yrs CRDT library, similar to the proven signapps-docs implementation.

**Key Innovation:** Leverage existing signapps-docs WebSocket patterns for calendars and events

---

## What is Phase 7?

### Before (Phase 6)
- ✅ Users can import/export calendars
- ✅ Users can share calendars
- ❌ Changes are not real-time
- ❌ No presence awareness
- ❌ No offline support

### After (Phase 7)
- ✅ Real-time event updates across users
- ✅ Live presence (who's viewing/editing)
- ✅ CRDT-based conflict resolution
- ✅ Offline changes merge seamlessly
- ✅ Sub-500ms latency

---

## Architecture at a Glance

```
Calendar Service (Port 3011)
├─ WebSocket Endpoint: /api/v1/calendars/:id/ws
├─ Yrs Document per calendar
├─ Broadcast Channel (multi-client sync)
├─ Presence Manager (active users)
└─ DashMap Storage (in-memory)

Frontend
├─ yjs client library
├─ WebSocket connection per calendar
├─ Real-time state binding
└─ Presence indicators
```

---

## Implementation Roadmap

### Day 1-2: Backend Foundation
- WebSocket handler in Axum
- Yrs document setup
- Message routing

### Day 3-4: Presence System
- Track connected users
- Presence state machine
- Join/leave events

### Day 5-6: Frontend Integration
- yjs client setup
- Calendar state binding
- UI indicators

### Day 7: Testing & Polish
- Multi-client E2E tests
- Performance validation
- Documentation

---

## Key Files to Create

| File | Lines | Purpose |
|------|-------|---------|
| `handlers/websocket.rs` | 400 | WebSocket connection handler |
| `services/realtime.rs` | 300 | Document & broadcast management |
| `services/presence.rs` | 250 | Presence tracking |
| `hooks/use-calendar-ws.ts` | 300 | React hook for WebSocket |
| `components/RealtimeIndicator.tsx` | 150 | UI for active users |

**Total:** ~1,400 lines of new code

---

## Technical Leverage

**From signapps-docs (✅ Already Proven)**
- ✅ Yrs 0.17.4 CRDT library
- ✅ Axum WebSocket patterns
- ✅ Tokio broadcast channels
- ✅ Message serialization (serde)

**New for Phase 7**
- 🆕 Presence state machine
- 🆕 Multiple document types (Events, Tasks)
- 🆕 Integration with REST API
- 🆕 Offline sync capability

---

## Success Metrics

### Latency
- Local edit → Network send: <50ms
- Network send → Remote display: <200ms
- Total round-trip: <300ms (target <500ms)

### Capacity
- Concurrent users per calendar: 50+
- Memory per calendar: <1MB
- CPU usage: <5% idle

### Reliability
- Connection recovery: <2 seconds
- Data loss: 0%
- Presence accuracy: 99%

---

## Integration Points

### With Phase 6 (Import/Export)
- ✅ Export now includes real-time status
- ✅ Import creates initial shared state
- ✅ Shared calendars auto-sync in real-time

### With Phase 5 (Sharing)
- ✅ Shared calendar members auto-connect
- ✅ Presence shows all connected members
- ✅ Only members can join WebSocket

### With Existing REST API
- ✅ Keep REST API for initial load
- ✅ WebSocket for incremental updates
- ✅ Offline changes sync to REST API

---

## Risk Mitigation

| Risk | Severity | Plan |
|------|----------|------|
| Memory explosion | 🔴 | Document TTL, eviction policy |
| Conflict storms | 🔴 | CRDT guarantees, test scenarios |
| Stale state | 🟠 | Periodic sync + heartbeat |
| Network loops | 🟠 | Message deduplication |

---

## Next Steps

### Immediate (Today)
- ✅ Create PHASE7_PLAN.md (DONE)
- ✅ Create PHASE7_INIT.md (DONE)
- ⏭ Review signapps-docs WebSocket code
- ⏭ Design message protocol

### Short Term (Next 2 days)
- ⏭ Implement WebSocket handler
- ⏭ Setup Yrs document manager
- ⏭ Test single client connection
- ⏭ Test multi-client broadcast

### Medium Term (Days 3-7)
- ⏭ Presence tracking
- ⏭ Frontend integration
- ⏭ UI components
- ⏭ E2E testing

---

## References

- [signapps-docs WebSocket](../../services/signapps-docs/src/handlers.rs) - Reference implementation
- [Yrs Documentation](https://docs.yjs.dev)
- [PHASE7_PLAN.md](./PHASE7_PLAN.md) - Detailed plan
- [RFC 6455: WebSocket Protocol](https://tools.ietf.org/html/rfc6455)

---

## Team Notes

- **Estimated Duration:** 7 days (1 week)
- **Complexity:** Medium (builds on signapps-docs)
- **Risk Level:** Low (proven patterns)
- **Commits Expected:** ~30 commits
- **Code Review Points:**
  - WebSocket safety
  - Yrs integration correctness
  - Memory management
  - Presence state consistency

---

**Phase 7 is GO!** 🚀

Begin with WebSocket handler implementation.
