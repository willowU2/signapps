---
name: resources-debug
description: Debug skill for the Resources module (/resources). Room, equipment, vehicle and desk catalog with search, type filter, booking dialog with calendar integration, and my-reservations sub-page. Backend via signapps-identity port 3001.
---

# Resources — Debug Skill

## Source of truth

**`docs/product-specs/55-resources.md`** — read spec first.

## Code map

### Backend (Rust)
- **Service**: `signapps-identity/` — port **3001** (resources are managed by the identity service)
- **Endpoints**: `GET /resources`, `GET /resources/:id`, `POST /resources`, `PUT /resources/:id`, `DELETE /resources/:id`
- **Reservations**: `GET /reservations`, `GET /reservations/mine`, `GET /reservations/pending`, `POST /reservations`, `PUT /reservations/:id/status`
- **Resource types**: `GET /resource-types`, `POST /resource-types`, `DELETE /resource-types/:id`
- **DB models**: look for `resource*` in `crates/signapps-db/src/models/`

### Frontend (Next.js)
- **Pages**: `client/src/app/resources/page.tsx` (catalog + booking), `client/src/app/resources/my-reservations/page.tsx`
- **Store**: `client/src/stores/resources-store.ts` (Zustand — resources, resourceTypes, reservations, CRUD actions)
- **API client**: `client/src/lib/api/resources.ts` (resourcesApi, reservationsApi, resourceTypesApi via identity service client)
- **Cross-links**: `client/src/components/crosslinks/EntityLinks.tsx` (entity type "resource")
- **Calendar integration**: booking creates a calendar event via `calendarApi.createEvent()`
- **Deps**: `@tanstack/react-query` (resource list), Zustand (booking actions), `sonner` (toasts)

## Key data-testids (to add)

| data-testid | Element |
|---|---|
| `resources-root` | Resources page container |
| `resources-search` | Search input |
| `resources-type-filter` | Type filter select |
| `resources-card-{id}` | Resource card |
| `resources-book-btn-{id}` | Book button on resource card |
| `resources-booking-dialog` | Booking dialog |
| `resources-booking-date` | Date input in booking dialog |
| `resources-booking-start` | Start time input |
| `resources-booking-end` | End time input |
| `resources-booking-notes` | Notes textarea |
| `resources-booking-confirm` | Confirm booking button |
| `resources-empty-state` | No resources found state |

## Key E2E journeys

1. **Browse catalog** — load page, verify resource cards grouped by type (room, equipment, vehicle, desk)
2. **Search & filter** — type in search, select type filter, verify filtered results
3. **Book a resource** — click "Reserver" on a card, fill date/time/notes, confirm, verify toast + calendar event
4. **Approval flow** — book a resource with `requires_approval`, verify "Demander" button text and info toast
5. **My reservations** — navigate to `/resources/my-reservations`, verify user's bookings listed

## Common bug patterns

1. **Calendar event creation failure silent** — `calendarApi.createEvent()` is wrapped in try/catch with no user feedback on failure; booking succeeds but no calendar event is created
2. **Booking time validation** — `bookingStartTime >= bookingEndTime` is a string comparison which works for `HH:mm` format but breaks if formats differ
3. **Type filter "all" handling** — the `filteredResources` filter checks `resource.is_available` so unavailable resources are always hidden even for admins
4. **Stale react-query cache** — after creating a reservation via Zustand store, the react-query `['resources']` cache is not invalidated, so availability status may be stale
5. **console.error in production** — `handleConfirmBooking` uses `console.error("Impossible de creer reservation:", error)` which violates the zero-print policy

## Debug checklist

- [ ] Verify identity service (port 3001) is running and `/resources` returns data
- [ ] Check that resource seeding has run (resources may be empty without seed data)
- [ ] Confirm calendar service (port 3011) is running for calendar integration
- [ ] Test booking with `requires_approval: true` vs `false` resources
- [ ] Verify react-query cache invalidation after booking
- [ ] Check `console.error` calls — should use proper error handling

## Dependencies (license check)

- **Backend**: axum, sqlx — MIT/Apache-2.0
- **Frontend**: react, next, zustand, @tanstack/react-query, sonner — MIT
- Verify: `just deny-licenses && cd client && npm run license-check:strict`
