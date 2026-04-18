---
name: rsc-migration-debug
description: Use when a Server Component build fails with "You're importing a component that needs useState/useEffect", when `cookies()` throws outside a server context, when a RSC page renders blank in production, or when a client-only value like `window`/`localStorage` crashes the RSC pass. Covers separating client/server modules, the `"server-only"` / `"use client"` contract, and hydration mismatch triage.
---

# rsc-migration-debug

## Pattern used in P2 (successful)

The 5 migrated pages follow the same shape:
1. `client/src/lib/server/<domain>.ts` — server-only fetcher with `import "server-only";` and try/catch graceful empty-shell fallback.
2. `client/src/app/<route>/<domain>-client.tsx` — `"use client"` component with `initialData` prop, seeds TanStack query cache or Zustand store.
3. `client/src/app/<route>/page.tsx` — ~15 lines, awaits the fetcher, renders the client island.

## Common errors

- **"You're importing a component that needs useState. It only works in a Client Component ..."**
  → Add `"use client"` at the top of the offending component, OR wrap the consumer in a new client island.

- **"cookies() was called outside a request scope"**
  → File is imported from a client component. Enforce: `lib/server/*.ts` files must start with `import "server-only";`. Callers must be Server Components or API routes.

- **Blank RSC page in prod, works in dev**
  → RSC fetch threw an unhandled error. Check server log; wrap in `error.tsx` sibling.

- **"Dynamic server usage: cookies" at build time**
  → Expected. Next.js opts the route out of static generation because `fetchServer()` reads `auth_token`. The `ƒ` marker in build output confirms dynamic rendering.

## Discovery commands

```bash
# Find client-only APIs used in top-level pages we're migrating:
rtk grep "window\.\|localStorage\|document\.\|sessionStorage" client/src/app/<page>

# Find components that should be "use client" but aren't:
rtk grep -L "\"use client\"" client/src/components/<file-using-useState>
```

## Seeding pattern reference

For TanStack Query hooks, seed via `initialData`:

```tsx
const { data } = useQuery({
  queryKey: ["dashboard"],
  queryFn: fetchFromClient,
  initialData,            // seeded from server prefetch
  staleTime: 30_000,
});
```

For Zustand stores, seed via a one-shot `useEffect`:

```tsx
const [seeded, setSeeded] = useState(false);
useEffect(() => {
  if (!seeded) {
    store.setData(initialData);
    setSeeded(true);
  }
}, [initialData, seeded]);
```

## Related

- Spec: `docs/superpowers/specs/2026-04-18-phase-d2-p2-frontend-design.md`
- Plan: `docs/superpowers/plans/2026-04-18-phase-d2-p2-frontend.md`
- RSC docs: https://nextjs.org/docs/app/building-your-application/rendering/server-components
