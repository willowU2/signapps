---
name: social-debug
description: Debug skill for the Social module (internal social network). Covers posts, stories, groups, pages, reactions, comments, notifications feed, and content moderation. Backend on signapps-social port 3019, 16 pages, 55 components.
---

# Social — Debug Skill

## Source of truth

**`docs/product-specs/24-social.md`** — read spec first to distinguish bugs from unimplemented features.

## Code map

### Backend (Rust)
- **Service**: `services/signapps-social/` — port **3019**
- **Main**: `services/signapps-social/src/main.rs`
- **Handlers**: `services/signapps-social/src/handlers/`
- **DB models**: `crates/signapps-db/src/models/social*.rs`
- **Migrations**: `migrations/*social*`

### Frontend (Next.js)
- **Pages** (16): `client/src/app/social/` (feed, profile, groups, pages, stories, etc.)
- **Components** (55): `client/src/components/social/`
- **API client**: `client/src/lib/api/social.ts`
- **Store**: `client/src/stores/social-store.ts`

## Key data-testids (to add)

| data-testid | Element |
|---|---|
| `social-feed-root` | Main feed container |
| `social-post-{id}` | Individual post |
| `social-post-create` | New post composer |
| `social-post-like-{id}` | Like/react button |
| `social-comment-{id}` | Comment item |
| `social-story-{id}` | Story bubble |
| `social-group-{id}` | Group card |
| `social-profile-root` | Profile page |

## Key E2E journeys

1. **Create post** — compose text + image, publish, verify in feed
2. **React & comment** — like a post, add comment, verify counts
3. **Create group** — create group, invite member, post inside group
4. **Story lifecycle** — create story, view as another user, verify 24h expiry
5. **Profile edit** — update bio/avatar, verify changes reflected

## Common bug patterns

1. **Feed pagination** — infinite scroll may duplicate posts if cursor-based pagination off-by-one
2. **Story expiry** — stories may persist past 24h if cleanup cron not running
3. **Rich content XSS** — HTML in posts must be sanitized server-side

## Dependencies (license check)

- **Backend**: axum, sqlx, serde — MIT/Apache-2.0
- **Frontend**: react, next, zustand — MIT
- Verify no GPL: `just deny-licenses && cd client && npm run license-check:strict`
