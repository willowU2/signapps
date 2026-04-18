# Service Worker — SignApps runtime caching

## Strategies

| Pattern | Handler | TTL | Notes |
|---|---|---|---|
| `/_next/static/*` | CacheFirst (Serwist default) | 1 year (immutable) | Hashed filenames |
| `/fonts/*` | CacheFirst | 30 d | |
| `/images/*` | CacheFirst | 30 d | |
| `/api/v1/**/list*` GET | StaleWhileRevalidate | 5 min | Added P3 |
| `/api/v1/brand-kit` | CacheFirst | 60 min | Added P3 |
| `/api/v1/tenant-config` | CacheFirst | 60 min | Added P3 |
| `/api/*` POST/PUT/PATCH/DELETE | NetworkFirst + BackgroundSync | — | Mutations replayed |
| HTML routes | NetworkFirst fallback cache | — | Offline fallback |
| `/sw.js` | Never cached | no-store | Kill-switch |

## Kill-switch

`/sw.js` is served with `Cache-Control: no-store, must-revalidate` (see `client/next.config.ts`). A new SW version can clear selective caches on activation.

## Debug

- `.claude/skills/workers-debug/` — triage SW crashes (after Wave F).
- Chrome DevTools → Application → Service Workers → Unregister — manual purge.

## Related

- Spec: `docs/superpowers/specs/2026-04-18-phase-d2-p3-polish-design.md`
- Plan: `docs/superpowers/plans/2026-04-18-phase-d2-p3-polish.md`
