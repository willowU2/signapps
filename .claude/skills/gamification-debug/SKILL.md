---
name: gamification-debug
description: Debug skill for the Gamification module (points, badges, leaderboards). Currently MOCK data — backend implementation needed.
---

# Gamification — Debug Skill

## Source of truth

**`docs/product-specs/33-gamification.md`** — read spec first.

**Status**: MOCK data — backend not yet implemented.

## Code map

### Backend (Rust)
- **Service**: TBD — no dedicated service yet; may be added to `signapps-social` (3019) or standalone
- **DB models**: to be created in `crates/signapps-db/src/models/gamification*.rs`
- **Event triggers**: PgEventBus listeners to award points on actions across all modules
- **Migrations**: to be created

### Frontend (Next.js)
- **Pages**: `client/src/app/gamification/` (leaderboard, badges, achievements)
- **Components**: `client/src/components/gamification/`
- **Mock data**: hardcoded MOCK_* constants — to be replaced
- **API client**: `client/src/lib/api/gamification.ts` (stub or missing)

## Key data-testids (to add)

| data-testid | Element |
|---|---|
| `gamification-root` | Gamification page container |
| `leaderboard-table` | Leaderboard ranking |
| `leaderboard-row-{rank}` | Individual rank row |
| `badge-{id}` | Badge card |
| `points-display` | User points counter |
| `achievement-{id}` | Achievement notification |

## Key E2E journeys

1. **View leaderboard** — navigate to gamification, verify ranking displayed
2. **Earn points** — perform an action (e.g., create post), verify points incremented
3. **Unlock badge** — reach threshold, verify badge awarded and shown in profile
4. **Points history** — view history of points earned with timestamps

## Common bug patterns

1. **MOCK data stale** — UI works with mocks but breaks when backend wired (schema mismatch)
2. **Points double-count** — PgEventBus replays award points twice on service restart
3. **Leaderboard performance** — ranking query slow on large user base without proper indexing

## Dependencies (license check)

- **Backend**: axum, sqlx — MIT/Apache-2.0
- **Frontend**: react, next — MIT
- Verify: `just deny-licenses && cd client && npm run license-check:strict`
