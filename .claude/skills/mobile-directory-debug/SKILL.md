---
name: mobile-directory-debug
description: Use when debugging, verifying, or extending the Mobile Directory (`/directory`) feature of SignApps Platform. References `docs/product-specs/70-so5-mobile-directory.md` as the source of truth. Covers the directory Zustand store, fuse.js search, responsive layout, tap-to-contact drawer, vCard generation, PWA shortcut, and Serwist offline caching.
---

# Mobile Directory — Debug Skill

This skill is the debugging companion for SO5's `/directory` feature: a responsive, offline-capable person finder with tap-to-contact actions (tel / mail / chat / meet adhoc).

## Source of truth

**`docs/product-specs/70-so5-mobile-directory.md`**.

If observed behavior contradicts the spec, either fix the code or bump the spec — do not let code drift silently.

## Code map

### Frontend only (SO5 is zero-backend)

- **Page + layout**
  - `client/src/app/directory/page.tsx` — main entry, mount + selection state
  - `client/src/app/directory/layout.tsx` — minimal frame (no admin sidebar)
- **Store**
  - `client/src/stores/directory-store.ts` — Zustand + persist (`directory-cache` key), 5 min TTL via `isFresh()`, exports `filterPersons()` and `selectFilteredPersons()`
  - `client/src/stores/directory-store.test.ts` — unit tests on the selector
- **Components** (`client/src/components/directory/`)
  - `person-card.tsx` — list row, uses `SmartAvatar` + `avatar-helpers` from org-structure
  - `person-detail-drawer.tsx` — shared mobile/desktop detail (embedded prop)
  - `search-bar.tsx` — 150 ms debounced input with clear button
  - `filter-chips.tsx` — "Tous" / OU / "Photo" / "Reset"
  - `vcard-qr.tsx` — exports `VcardQR` + pure `buildVcard(person, org)`
- **API route**
  - `client/src/app/api/directory/vcard/[id]/route.ts` — `text/vcard` default, `?format=qr` → `image/svg+xml`. Proxies `signapps-org` GET /org/persons/:id, forwards the `Authorization` header.
- **PWA**
  - `client/public/manifest.json` — shortcuts array → `/directory`
  - `client/public/icons/directory-{192,512}.png` — regenerate with `node client/scripts/generate-directory-icons.js`
  - `client/src/app/sw.ts` — Serwist rule `directory-cache` on `/org/persons|nodes|skills*` (StaleWhileRevalidate, TTL 5 min)

### Dependencies (existing, no new install needed)

- `fuse.js` — fuzzy search (already in `next.config.ts::optimizePackageImports`)
- `qrcode.react` — `QRCodeSVG` component (server + client safe, used in route handler via `renderToString`)
- `zustand/middleware/persist`, `@serwist/next`, `lucide-react`

## Data flow

```
┌────────────┐    loadAll()    ┌────────────────┐
│ page mount ├────────────────▶│ directoryStore │
└────────────┘                 └──────┬─────────┘
                                      │
            ┌─────────────────────────┼─────────────────────────┐
            ▼                         ▼                         ▼
   orgApi.persons.list      orgApi.trees.list          orgApi.skills.list
   (/org/persons via         (/org/nodes via            (/org/skills via
    signapps-org:3026)        signapps-org:3026)         signapps-org:3026)

Result persisted (localStorage "directory-cache") → on reload offline, cache rehydrates instantly.

Filter path:
   page.tsx → useMemo(filterPersons(persons, query, filters))
            → Fuse({ keys: full_name(.5), email(.2), title(.2), phone(.1) })
```

## Debug checklist

### Empty directory / loading forever

1. Confirm `/org/persons?tenant_id=…&active=true` returns a non-empty array in DevTools Network tab.
2. If backend down but you previously loaded the list, the Zustand `persist` cache should rehydrate — check `localStorage.getItem("directory-cache")`.
3. Make sure `useTenantStore().tenant.id` is populated. The API mapper in `client/src/lib/api/org.ts::getCurrentTenantId()` will fall back to the JWT payload if the store isn't ready.
4. Check the service worker isn't serving a stale error response — unregister at `chrome://serviceworker-internals/` and reload.

### Search doesn't find someone you expect

- fuse.js threshold is `0.35`. Increase to `0.5` in `directory-store.ts::filterPersons` temporarily to widen matches.
- Verify the corpus row is populated — `toSearchRow(person)` reads `first_name`, `last_name`, `email`, `phone`, `title`. A missing title silently shrinks the corpus.
- For diacritics (é, è, ç) fuse normalises via ngram comparison; if a user reports "can't find Étienne with Etienne", keep `ignoreLocation: true` and raise `threshold` slightly.

### Desktop detail pane doesn't update

Make sure the selection state isn't cleared when the filter changes. The page derives `selected` from `filteredPersons.find(p => p.id === selectedId)` — after a filter, if the selected id drops out of the filtered list, `selected` becomes `null` and the pane reverts to the placeholder. Expected.

### Tap-to-call doesn't trigger the dialer

The action is rendered as a native `<a href="tel:…">`. If the phone number is missing on the person record, the button is disabled and rendered as `<button disabled>` (no href). Verify `person.phone` is present in the API response.

### Meet adhoc button errors

- Check `POST /api/v1/meet/rooms/adhoc` in Network. Payload is `{ invitees: [email?], person_ids: [id], title }`.
- The client code uses `ServiceName.MEET` (port 3014). If the meet service is down you'll see a toast "Erreur meet: …".

### QR scan fails to import contact

- Validate the vCard by downloading the .vcf file and opening it locally — iOS/macOS will show a validation dialog if fields are malformed.
- The vCard uses CRLF line endings (`\r\n`) as required by RFC 6350. If you saw a regression with `\n`-only, the Android scanner will still work but iOS will reject it.

### Offline reload shows stale or blank data

1. Check `isFresh(lastFetchedAt)` in devtools by inspecting the store: values older than 5 minutes force a refetch on next `loadAll()`.
2. The SW cache `directory-cache` is separate from the Zustand persist layer — both should be populated after a fresh online load.

## Key data-testids

| Testid | Element |
|--------|---------|
| `directory-list` | Scrollable list container |
| `directory-search` | Search input |
| `directory-filters` | Filter chips toolbar |
| `person-card` | Individual list row |
| `person-detail` | Detail drawer body |
| `action-call` | Tel action (anchor or disabled button) |
| `action-mail` | Mailto action |
| `action-chat` | Chat action (navigates to `/chat?person_id=…`) |
| `action-meet` | Meet adhoc action |
| `vcard-qr` | QR SVG container |

## Performance budgets

- Initial payload (persons + nodes + skills) < 20 KB for a 100-person tenant → acceptable over 3G.
- Search keystroke → debounce 150 ms + fuse ≤ 10 ms.
- Lighthouse mobile target: Performance, Accessibility, Best Practices > 85.

## Common pitfalls

- **Hydration mismatch** when Zustand persist hydrates before the first paint. The store uses `persist` with a partial `partialize` so only data slices persist — query + filters always start fresh. If you add a new persisted field, extend the `partialize` callback.
- **Scroll overflow on iOS Safari** — the mobile column uses `overflow-y-auto` inside a fixed-height parent. If you add `min-h-0` anywhere upstream, check the Safari rubberband isn't broken (test on a real device).
- **CSP for QR SVG** — the inline SVG uses bare attributes, no `onerror`/`onload`. No CSP update needed. If a future upgrade of `qrcode.react` switches to canvas/data URI, revisit.
- **`/directory` not under `/admin`** — do not move it. The route is explicitly open to every authenticated user. The generic `AuthProvider` (in `components/auth/auth-provider.tsx`) is the only guard.

## Related skills

- `org-foundations-debug` — for issues on the underlying `signapps-org` data (persons, nodes, skills)
- `app-shell-debug` — for PWA installation / service worker issues outside the directory-specific cache rule
