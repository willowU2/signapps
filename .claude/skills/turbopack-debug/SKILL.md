---
name: turbopack-debug
description: Use when `npm run dev` fails under Turbopack after the P2 switch from webpack, a specific route fails to compile, Serwist errors appear, or a previously-working import now throws a module-not-found. Covers diagnosing the incompat, invalidating the Turbopack cache, and the fallback path to a per-route webpack override.
---

# turbopack-debug

## Symptoms & first steps

- **"Module not found" after switch** — Turbopack can be stricter on ESM vs CJS boundaries. Run `rtk grep -n "require(" client/src/<suspected-file>`. Convert `require()` to `import` where found.
- **Serwist SW build errors in dev** — `withSerwistInit({ disable: process.env.NODE_ENV === "development" })` already disables in dev. If errors still appear, ensure `npm run dev` inherits `NODE_ENV=development` (check `.env.local`).
- **Fast Refresh not triggering** — purge `.next/` and restart dev server.
- **Dev server binds wrong port** — Turbopack respects `-p` flag; the default is 3000. If occupied, Next auto-falls-back to 3001. Check the "Local:" line in the startup banner.

## Cache invalidation

```bash
cd client
rm -rf .next node_modules/.cache
npm run dev
```

## Fallback per-route

If a specific route is incompatible with Turbopack, fall back per-developer:

```bash
# Temporary developer workaround
cd client
npm run dev -- --webpack
```

Document such routes in `docs/architecture/frontend-perf.md`.

## Related

- Spec: `docs/superpowers/specs/2026-04-18-phase-d2-p2-frontend-design.md`
- Plan: `docs/superpowers/plans/2026-04-18-phase-d2-p2-frontend.md`
- Next.js Turbopack docs: https://nextjs.org/docs/app/api-reference/turbopack
