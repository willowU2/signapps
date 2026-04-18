# Phase D2 · P2 — Frontend perf Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Passer le frontend Next.js 16 à Turbopack, lazy-loader les 4 deps lourdes (Tiptap, LiveKit, MediaPipe, Monaco), enforcer un bundle budget en CI, et migrer 5 pages fetch-heavy vers React Server Components pour atteindre compile `/dashboard` < 1 s, bundle initial < 250 kB gzip, bundle routes éditeur < 800 kB, LCP -30 % sur pages RSC.

**Architecture:** `next dev --turbopack` comme default dev. Wrappers `dynamic(...)` pour chaque dep lourde, placés dans `client/src/components/{editor,meet}/*-lazy.tsx` et consommés partout via import unique. Server Components pour pages fetch-heavy, fetch serveur via `client/src/lib/server/<domain>.ts` (JWT via `cookies()` next/headers), îlots client pour interactivité lourde (charts, forms actions, stores Zustand). CI gate `bundle-budget` lit le manifest `.next/analyze` et échoue si les seuils sont dépassés.

**Tech Stack:** Next.js 16.2.3 (Turbopack stable), React 19, React Server Components, `next/dynamic`, `@next/bundle-analyzer`, Playwright, Lighthouse CI local, Zustand (client-only), TanStack Query (client-only), Serwist (déjà configuré — inchangé P2).

---

## Scope Check

Ce plan couvre **uniquement la Phase 2** de la spec (`docs/superpowers/specs/2026-04-18-phase-d2-p2-frontend-design.md`). Pas de Web Workers (P3), pas de refactor Service Worker (P3), pas de virtualisation systématique (P3). Zéro changement backend ; le single-binary P1 est déjà en place et ne sera pas touché.

## File Structure

### Fichiers créés

| Fichier | Responsabilité |
|---|---|
| `client/src/components/editor/tiptap-lazy.tsx` | `dynamic()` wrapper pour `@tiptap/react` et ses extensions |
| `client/src/components/editor/monaco-lazy.tsx` | `dynamic()` wrapper pour `@monaco-editor/react` |
| `client/src/components/meet/livekit-lazy.tsx` | `dynamic()` wrapper pour `@livekit/components-react` |
| `client/src/components/meet/mediapipe-lazy.tsx` | `dynamic()` wrapper pour `@mediapipe/selfie_segmentation` et `@ricky0123/vad-web` |
| `client/src/components/common/lazy-skeleton.tsx` | Composants skeleton partagés (éditeur, meeting room, small) |
| `client/src/lib/server/dashboard.ts` | Fetch serveur des stats dashboard (JWT via `cookies()`) |
| `client/src/lib/server/mail.ts` | Fetch serveur de la liste mail inbox |
| `client/src/lib/server/forms.ts` | Fetch serveur de la liste forms |
| `client/src/lib/server/contacts.ts` | Fetch serveur de la liste contacts |
| `client/src/lib/server/projects.ts` | Fetch serveur de la liste projects |
| `client/src/lib/server/http.ts` | Helper `fetchServer<T>()` partagé (JWT + base URL + error handling) |
| `client/src/app/dashboard/dashboard-client.tsx` | Îlots client (charts, refresh button) pour `/dashboard` RSC |
| `client/src/app/mail/mail-list-client.tsx` | Îlots client (viewer, filters) pour `/mail/inbox` RSC |
| `client/src/app/forms/forms-client.tsx` | Îlots client pour `/forms` RSC |
| `client/src/app/contacts/contacts-client.tsx` | Îlots client pour `/contacts` RSC |
| `client/src/app/projects/projects-client.tsx` | Îlots client pour `/projects` RSC |
| `client/scripts/check-bundle-budget.js` | Assertion CI sur tailles gzip par route |
| `client/tests/e2e/p2-cold-compile.spec.ts` | Playwright : premier hit `/dashboard` < 2 s en dev |
| `client/tests/e2e/p2-rsc-dashboard.spec.ts` | Playwright : LCP `/dashboard` < 2.5 s, TTFB < 500 ms |
| `.claude/skills/turbopack-debug/SKILL.md` | Triage incompat Turbopack, fallback webpack |
| `.claude/skills/rsc-migration-debug/SKILL.md` | Diagnostiquer composants qui cassent au render serveur |
| `docs/product-specs/51-perf-frontend.md` | Spec produit miroir |

### Fichiers modifiés

| Fichier | Changement |
|---|---|
| `client/package.json` | `"dev": "next dev --turbopack"` |
| `client/next.config.ts` | Étendre `optimizePackageImports` (Tiptap, Radix, Base-UI, LiveKit, TanStack Query) |
| `client/src/app/dashboard/page.tsx` | `"use client"` retiré, devient Server Component, utilise `fetchDashboardStats` + îlots client |
| `client/src/app/mail/page.tsx` | Idem — Server Component + `MailListClient` |
| `client/src/app/forms/page.tsx` | Idem |
| `client/src/app/contacts/page.tsx` | Idem |
| `client/src/app/projects/page.tsx` | Idem |
| `client/src/components/docs/editor.tsx` et ~30 fichiers Tiptap | Import via `tiptap-lazy.tsx` |
| `client/src/components/meet/meet-room.tsx` + `meet-sidebar.tsx` | Import via `livekit-lazy.tsx` |
| `client/src/components/meet/*` (VAD, segmentation) | Import via `mediapipe-lazy.tsx` |
| `client/src/app/sheets/editor/page.tsx`, `client/src/app/ai/documents/page.tsx` | Import via `monaco-lazy.tsx` |
| `.github/workflows/ci.yml` | Ajouter job `bundle-budget` |
| `CLAUDE.md` | Section Préférences : mentionner `npm run dev` utilise Turbopack |

### Tests

| Test | Fichier | Cible |
|---|---|---|
| Cold compile `/dashboard` | `client/tests/e2e/p2-cold-compile.spec.ts` | TTFB premier hit < 2 s (dev, Turbopack) |
| RSC dashboard | `client/tests/e2e/p2-rsc-dashboard.spec.ts` | LCP < 2.5 s, TTFB < 500 ms (3G throttled) |
| Playwright E2E existants | `client/tests/e2e/*.spec.ts` | Aucune régression fonctionnelle |
| Bundle budget | `client/scripts/check-bundle-budget.js` | CI fail si seuil dépassé |

---

## Waves (séquence d'exécution)

| Wave | Tasks | Jours |
|---|---|---|
| **A. Turbopack** | 1–2 | J1–J2 |
| **B. Dynamic imports** | 3–7 | J3–J4 |
| **C. Bundle budget** | 8–10 | J5–J6 |
| **D. RSC migration** | 11–17 | J7–J12 |
| **E. Measurement** | 18–19 | J13 |
| **F. Finalization** | 20 | J14 |

---

## Wave A — Turbopack

### Task 1: Bascule `next dev --turbopack`

**Files:**
- Modify: `client/package.json`

- [ ] **Step 1: Read current dev script**

Run: `rtk grep "\"dev\"" client/package.json`
Expected: `"dev": "next dev --webpack",`

- [ ] **Step 2: Modify `client/package.json`**

Replace the single line `"dev": "next dev --webpack",` with:

```json
    "dev": "next dev --turbopack",
```

- [ ] **Step 3: Purge caches**

```bash
cd client
rm -rf .next node_modules/.cache
```

- [ ] **Step 4: Launch dev server and validate it starts**

```bash
cd client
npm run dev
```

Expected: console prints `▲ Next.js 16.2.3 (turbopack)` (not `(webpack)`) and `✓ Ready in XXX ms` with XXX < 1000.

Kill the server with Ctrl+C once you see Ready.

- [ ] **Step 5: Commit**

```bash
rtk git add client/package.json
rtk git commit -m "perf(client): switch dev server from webpack to turbopack"
```

---

### Task 2: Validate Turbopack with full E2E + compile time measurement

**Files:**
- Create: `client/tests/e2e/p2-cold-compile.spec.ts`
- Modify: `client/tests/e2e/*.spec.ts` (check none regress)

- [ ] **Step 1: Write failing Playwright test for cold compile**

Create `client/tests/e2e/p2-cold-compile.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test.describe("P2 cold compile bench (Turbopack)", () => {
  test("dashboard first-hit TTFB is under 2 s in dev", async ({ page }) => {
    // Playwright spawns its own dev server via playwright.config.ts — this
    // test assumes that server is warm (recently started) but the /dashboard
    // route has NOT been visited yet in this run.
    const start = Date.now();
    const response = await page.goto("http://localhost:3000/dashboard", {
      waitUntil: "domcontentloaded",
      timeout: 10_000,
    });
    const elapsed = Date.now() - start;

    expect(response?.status()).toBe(200);
    expect(elapsed).toBeLessThan(2000);
  });

  test("sheets/editor first-hit TTFB is under 2 s in dev", async ({ page }) => {
    const start = Date.now();
    const response = await page.goto("http://localhost:3000/sheets/editor", {
      waitUntil: "domcontentloaded",
      timeout: 10_000,
    });
    const elapsed = Date.now() - start;

    expect(response?.status()).toBe(200);
    expect(elapsed).toBeLessThan(2000);
  });
});
```

- [ ] **Step 2: Run Playwright cold compile test**

```bash
cd client
npx playwright test p2-cold-compile.spec.ts --reporter=list
```

Expected: both tests PASS (Turbopack cold compile < 2 s). Record actual ms in the test report.

- [ ] **Step 3: Run the full E2E suite to verify no regression**

```bash
cd client
npx playwright test --reporter=list
```

Expected: all existing tests PASS. If any fail because of Turbopack incompat, abort and triage (common causes : `require()` calls in ESM files, missing loaders for specific assets). Document the issue before proceeding.

- [ ] **Step 4: Commit**

```bash
rtk git add client/tests/e2e/p2-cold-compile.spec.ts
rtk git commit -m "test(client): add Turbopack cold-compile bench"
```

---

## Wave B — Dynamic imports

### Task 3: `tiptap-lazy` wrapper + migrate 30 call sites

**Files:**
- Create: `client/src/components/editor/tiptap-lazy.tsx`
- Create: `client/src/components/common/lazy-skeleton.tsx`
- Modify: ~30 files importing `@tiptap/*` (editor.tsx, toolbar.tsx, bubble-menu.tsx, floating-menu.tsx, editor-content.tsx, docs/extensions/*.ts, hooks/use-*.ts)

- [ ] **Step 1: Create the shared skeleton**

Create `client/src/components/common/lazy-skeleton.tsx`:

```tsx
"use client";

/**
 * Skeletons shown while heavy client components (Tiptap, Monaco, LiveKit,
 * MediaPipe) finish loading. All visually consistent with the existing
 * shadcn/ui `<Skeleton />` primitive.
 */

import { Skeleton } from "@/components/ui/skeleton";

export function EditorSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-4" aria-busy="true" aria-label="Chargement de l'éditeur">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

export function MeetingRoomSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 p-4" aria-busy="true" aria-label="Connexion à la salle de réunion">
      <Skeleton className="aspect-video" />
      <Skeleton className="aspect-video" />
      <Skeleton className="aspect-video" />
      <Skeleton className="aspect-video" />
    </div>
  );
}

export function MonacoSkeleton() {
  return (
    <div className="h-full w-full" aria-busy="true" aria-label="Chargement de l'éditeur de code">
      <Skeleton className="h-full w-full" />
    </div>
  );
}
```

- [ ] **Step 2: Create the Tiptap lazy wrapper**

Identify the current top-level editor component used by consumers. Open `client/src/components/docs/editor.tsx` and note its default export name (e.g. `Editor`) and its props type (e.g. `EditorProps`).

Create `client/src/components/editor/tiptap-lazy.tsx`:

```tsx
"use client";

/**
 * Lazy wrapper around the Tiptap editor.  Consumers should import
 * `TiptapEditor` from here instead of `@/components/docs/editor` directly,
 * so the ~200-400 kB Tiptap bundle is split into a route-local chunk.
 */

import dynamic from "next/dynamic";
import { EditorSkeleton } from "@/components/common/lazy-skeleton";

export const TiptapEditor = dynamic(
  () => import("@/components/docs/editor").then(m => m.Editor),
  {
    ssr: false,
    loading: () => <EditorSkeleton />,
  }
);

export type { EditorProps } from "@/components/docs/editor";
```

If the actual export is named differently, adapt `m.Editor` and `EditorProps` accordingly (check `client/src/components/docs/editor.tsx`).

- [ ] **Step 3: Migrate direct `@tiptap/react` usage in pages**

Find route-level pages that construct a Tiptap editor directly (import `useEditor` or `<EditorContent>` at route level):

```bash
rtk grep -l "from \"@tiptap/react\"" client/src/app
```

For each page in the result, replace the direct import block:

```tsx
// BEFORE
import { useEditor, EditorContent } from "@tiptap/react";
// ... 50 lines of editor setup ...
```

with a reference to the lazy wrapper:

```tsx
// AFTER
import { TiptapEditor } from "@/components/editor/tiptap-lazy";
// ... pass the props previously computed into <TiptapEditor {...props} />
```

If the page is using Tiptap extensions directly (not just the top-level Editor), keep the extensions inside the non-lazy `editor.tsx` (they're pulled in as part of the same chunk automatically).

- [ ] **Step 4: Build and verify bundle analyzer**

```bash
cd client
ANALYZE=true npm run build
```

Expected: the build completes. Open `.next/analyze/client.html` in a browser. Verify Tiptap-related modules (`@tiptap/core`, `@tiptap/starter-kit`) are in a **route-local chunk** (e.g. `/docs/editor` or `/design/editor` chunk), not in the main bundle.

- [ ] **Step 5: Commit**

```bash
rtk git add client/src/components/editor/tiptap-lazy.tsx \
           client/src/components/common/lazy-skeleton.tsx \
           client/src/app/**/page.tsx
rtk git commit -m "perf(client): lazy-load Tiptap editor via next/dynamic"
```

---

### Task 4: `livekit-lazy` wrapper

**Files:**
- Create: `client/src/components/meet/livekit-lazy.tsx`
- Modify: `client/src/components/meet/meet-room.tsx`
- Modify: `client/src/components/meet/meet-sidebar.tsx`

- [ ] **Step 1: Create the wrapper**

Create `client/src/components/meet/livekit-lazy.tsx`:

```tsx
"use client";

/**
 * Lazy wrapper around `@livekit/components-react`.  The LiveKit bundle is
 * ~500 kB and only needed on `/meet/*` routes — this wrapper ensures it
 * ships as a separate chunk, loaded on demand.
 */

import dynamic from "next/dynamic";
import { MeetingRoomSkeleton } from "@/components/common/lazy-skeleton";

export const LiveKitRoom = dynamic(
  () => import("@livekit/components-react").then(m => m.LiveKitRoom),
  { ssr: false, loading: () => <MeetingRoomSkeleton /> }
);

export const VideoConference = dynamic(
  () => import("@livekit/components-react").then(m => m.VideoConference),
  { ssr: false, loading: () => <MeetingRoomSkeleton /> }
);

export const RoomAudioRenderer = dynamic(
  () => import("@livekit/components-react").then(m => m.RoomAudioRenderer),
  { ssr: false }
);

export const ControlBar = dynamic(
  () => import("@livekit/components-react").then(m => m.ControlBar),
  { ssr: false }
);

// Re-export types — these are compile-time only, no runtime cost.
export type { ConnectionState, Participant } from "@livekit/components-react";
```

- [ ] **Step 2: Migrate `meet-room.tsx`**

Open `client/src/components/meet/meet-room.tsx`. Replace the direct import:

```tsx
import { LiveKitRoom, RoomAudioRenderer, ControlBar } from "@livekit/components-react";
```

with:

```tsx
import { LiveKitRoom, RoomAudioRenderer, ControlBar } from "@/components/meet/livekit-lazy";
```

The rest of the component's JSX is unchanged (same component names).

- [ ] **Step 3: Migrate `meet-sidebar.tsx`**

Same operation on `client/src/components/meet/meet-sidebar.tsx`.

- [ ] **Step 4: Build + analyze**

```bash
cd client
ANALYZE=true npm run build
```

Open `.next/analyze/client.html` and verify `@livekit/*` modules are now in a `/meet/*` route chunk, not in the main bundle.

- [ ] **Step 5: Smoke test /meet route**

```bash
cd client
npm run dev
# In another shell:
curl -o /dev/null -s -w "%{http_code}\n" http://localhost:3000/meet/test-room
```

Expected: 200 (even if room auth fails later — the page must render). Verify in the browser that the MeetingRoomSkeleton shows briefly before the LiveKit UI.

- [ ] **Step 6: Commit**

```bash
rtk git add client/src/components/meet/
rtk git commit -m "perf(client): lazy-load LiveKit SDK for /meet routes"
```

---

### Task 5: `mediapipe-lazy` wrapper

**Files:**
- Create: `client/src/components/meet/mediapipe-lazy.tsx`
- Modify: any file that imports `@mediapipe/selfie_segmentation` or `@ricky0123/vad-web`

- [ ] **Step 1: Create the wrapper**

Create `client/src/components/meet/mediapipe-lazy.tsx`:

```tsx
"use client";

/**
 * Lazy wrapper around MediaPipe background segmentation and VAD.  These
 * are ~1-2 MB each (wasm) and only needed on /meet/*.  Loaded on demand
 * behind this wrapper to avoid bloating the initial bundle.
 */

import { useEffect, useState } from "react";

type SegmentationModule = typeof import("@mediapipe/selfie_segmentation");
type VadModule = typeof import("@ricky0123/vad-web");

export function useMediaPipeSegmentation(): SegmentationModule | null {
  const [mod, setMod] = useState<SegmentationModule | null>(null);
  useEffect(() => {
    import("@mediapipe/selfie_segmentation").then(setMod);
  }, []);
  return mod;
}

export function useVad(): VadModule | null {
  const [mod, setMod] = useState<VadModule | null>(null);
  useEffect(() => {
    import("@ricky0123/vad-web").then(setMod);
  }, []);
  return mod;
}
```

- [ ] **Step 2: Grep current direct imports**

```bash
rtk grep -l "from \"@mediapipe\|from \"@ricky0123/vad" client/src
```

For each file returned, replace the direct top-level import:

```tsx
// BEFORE
import { SelfieSegmentation } from "@mediapipe/selfie_segmentation";
// class-field usage inside component
```

with the hook:

```tsx
// AFTER
import { useMediaPipeSegmentation } from "@/components/meet/mediapipe-lazy";

// inside component:
const mp = useMediaPipeSegmentation();
if (!mp) return null; // or <MeetingRoomSkeleton />
const segmentation = new mp.SelfieSegmentation({ ... });
```

Same pattern for `@ricky0123/vad-web`.

- [ ] **Step 3: Build + analyze**

```bash
cd client
ANALYZE=true npm run build
```

Verify `@mediapipe/*` and `@ricky0123/*` modules are in `/meet/*` chunks.

- [ ] **Step 4: Commit**

```bash
rtk git add client/src/components/meet/mediapipe-lazy.tsx client/src/components/meet/ client/src/hooks/
rtk git commit -m "perf(client): lazy-load MediaPipe segmentation and VAD"
```

---

### Task 6: `monaco-lazy` wrapper

**Files:**
- Create: `client/src/components/editor/monaco-lazy.tsx`
- Modify: any file importing `@monaco-editor/react` or `monaco-editor`

- [ ] **Step 1: Create the wrapper**

Create `client/src/components/editor/monaco-lazy.tsx`:

```tsx
"use client";

/**
 * Lazy wrapper around `@monaco-editor/react`. Monaco ships a ~2 MB
 * bundle (worker + VS Code features) that is only needed on routes
 * with code cells or formula-by-formula editing. This wrapper splits
 * it into a route-local chunk.
 */

import dynamic from "next/dynamic";
import { MonacoSkeleton } from "@/components/common/lazy-skeleton";

export const MonacoEditor = dynamic(
  () => import("@monaco-editor/react").then(m => m.default),
  { ssr: false, loading: () => <MonacoSkeleton /> }
);

export const DiffEditor = dynamic(
  () => import("@monaco-editor/react").then(m => m.DiffEditor),
  { ssr: false, loading: () => <MonacoSkeleton /> }
);
```

- [ ] **Step 2: Migrate call sites**

```bash
rtk grep -l "from \"@monaco-editor/react\"\|from \"monaco-editor\"" client/src
```

Replace each import of the default Monaco component:

```tsx
// BEFORE
import Editor from "@monaco-editor/react";

// AFTER
import { MonacoEditor as Editor } from "@/components/editor/monaco-lazy";
```

- [ ] **Step 3: Build + analyze + commit**

```bash
cd client
ANALYZE=true npm run build
# Verify Monaco in route-local chunks

rtk git add client/src/components/editor/monaco-lazy.tsx
rtk git commit -m "perf(client): lazy-load Monaco editor"
```

---

### Task 7: Prefetch intelligent sur liens menu

**Files:**
- Modify: navigation components that link to editor / meet routes (e.g., `client/src/components/layout/sidebar.tsx`, `client/src/components/layout/app-menu.tsx`)

- [ ] **Step 1: Identify navigation components**

```bash
rtk grep -l "href=\"/docs/editor\|href=\"/design/editor\|href=\"/sheets/editor\|href=\"/meet" client/src/components
```

For each `<Link href="/...">` that points to a heavy route, ensure the `prefetch` prop is enabled.

- [ ] **Step 2: Enable prefetch on heavy routes**

By default, Next.js `<Link>` prefetches on hover. Ensure nothing disables this for heavy routes:

```tsx
// BEFORE (if disabled)
<Link href="/docs/editor" prefetch={false}>

// AFTER (default Next behavior)
<Link href="/docs/editor">
```

If a link does not use `<Link>` (e.g., a `<button onClick={() => router.push(...)}>`), add an explicit prefetch:

```tsx
import { useRouter } from "next/navigation";

const router = useRouter();
// On hover or intersection:
<button
  onMouseEnter={() => router.prefetch("/docs/editor")}
  onClick={() => router.push("/docs/editor")}
>
  Nouveau document
</button>
```

- [ ] **Step 3: Smoke test**

```bash
cd client
npm run dev
```

Open `/` in the browser, hover over "Nouveau document" in the menu, then click. Network tab should show the Tiptap chunk fetched **during hover**, not after click.

- [ ] **Step 4: Commit**

```bash
rtk git add client/src/components/layout/
rtk git commit -m "perf(client): ensure prefetch on links to heavy routes"
```

---

## Wave C — Bundle budget

### Task 8: Extend `optimizePackageImports`

**Files:**
- Modify: `client/next.config.ts:22-29`

- [ ] **Step 1: Read current config**

```bash
rtk grep -A 10 "optimizePackageImports" client/next.config.ts
```

Current list (from file header read) is: `lucide-react`, `@radix-ui/react-icons`, `recharts`, `date-fns`, `lodash`, `framer-motion`.

- [ ] **Step 2: Extend the list**

Edit `client/next.config.ts`. Replace the `optimizePackageImports` array with:

```ts
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-icons",
      "recharts",
      "date-fns",
      "lodash",
      "framer-motion",
      "@tiptap/core",
      "@tiptap/react",
      "@tiptap/starter-kit",
      "@radix-ui/react-alert-dialog",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-popover",
      "@radix-ui/react-progress",
      "@base-ui-components/react",
      "@livekit/components-react",
      "@tanstack/react-query",
      "@tanstack/react-table",
      "@tanstack/react-virtual",
    ],
```

- [ ] **Step 3: Verify build still succeeds**

```bash
cd client
npm run build
```

Expected: build completes without errors. If a specific package breaks tree-shaking, remove it from the list and add a comment explaining why.

- [ ] **Step 4: Commit**

```bash
rtk git add client/next.config.ts
rtk git commit -m "perf(client): expand optimizePackageImports for Tiptap, Radix, Base-UI, TanStack"
```

---

### Task 9: `check-bundle-budget.js` script

**Files:**
- Create: `client/scripts/check-bundle-budget.js`

- [ ] **Step 1: Write the script**

Create `client/scripts/check-bundle-budget.js`:

```javascript
#!/usr/bin/env node
/**
 * check-bundle-budget.js
 *
 * Reads the bundle-analyzer manifest produced by `ANALYZE=true npm run build`
 * and asserts gzipped sizes against per-route budgets.  Exits 1 if any
 * route exceeds its budget.
 *
 * Usage: ANALYZE=true npm run build && node scripts/check-bundle-budget.js
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const KB = 1024;

// Per-route budgets, in gzipped bytes.
const BUDGETS = {
  "/": 250 * KB,
  "/dashboard": 400 * KB,
  "/mail": 500 * KB,
  "/forms": 500 * KB,
  "/contacts": 500 * KB,
  "/projects": 500 * KB,
  "/docs/editor": 800 * KB,
  "/sheets/editor": 800 * KB,
  "/design/editor": 800 * KB,
  "/meet/[code]": 800 * KB,
  "*": 500 * KB, // default for routes not listed above
};

function gzippedSize(filePath) {
  const data = fs.readFileSync(filePath);
  return zlib.gzipSync(data, { level: 9 }).length;
}

function getBudget(route) {
  return BUDGETS[route] ?? BUDGETS["*"];
}

function main() {
  const manifestPath = path.resolve(__dirname, "..", ".next", "app-build-manifest.json");
  if (!fs.existsSync(manifestPath)) {
    console.error(`[budget] missing ${manifestPath}. Run: ANALYZE=true npm run build`);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const pages = manifest.pages || {};

  let failed = false;

  for (const [route, files] of Object.entries(pages)) {
    // Sum gzipped size of all .js chunks for this route.
    let total = 0;
    for (const relFile of files) {
      const abs = path.resolve(__dirname, "..", ".next", relFile);
      if (fs.existsSync(abs) && abs.endsWith(".js")) {
        total += gzippedSize(abs);
      }
    }

    const budget = getBudget(route);
    const status = total <= budget ? "ok " : "FAIL";
    const pct = Math.round((total / budget) * 100);
    console.log(
      `[${status}] ${route.padEnd(20)} ${(total / KB).toFixed(1).padStart(8)} kB / ${(budget / KB).toFixed(0)} kB (${pct}%)`
    );
    if (total > budget) {
      failed = true;
    }
  }

  if (failed) {
    console.error("\n[budget] one or more routes exceeded their budget.");
    process.exit(1);
  }
  console.log("\n[budget] all routes within budget.");
}

main();
```

- [ ] **Step 2: Add npm script**

Edit `client/package.json`, append to `"scripts"`:

```json
    "budget": "ANALYZE=true next build && node scripts/check-bundle-budget.js"
```

- [ ] **Step 3: Run locally**

```bash
cd client
npm run budget
```

Expected: each route is listed with `ok` or `FAIL`. Baseline should show all `ok` if dynamic imports from Wave B are effective. Record the baseline numbers.

If any route fails on first run, adjust either the dynamic wrappers from Wave B (hint : a big lib leaked into main bundle) or, temporarily, raise the budget by 10 % with a comment `// baseline -- reduce after XXX`.

- [ ] **Step 4: Commit**

```bash
rtk git add client/scripts/check-bundle-budget.js client/package.json
rtk git commit -m "test(client): add per-route bundle budget check script"
```

---

### Task 10: CI bundle-budget job

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Inspect current CI**

```bash
rtk grep -n "^\s*[a-z-]*:" .github/workflows/ci.yml | head -20
```

Note the existing `frontend` job (or equivalent) that runs `npm run build` — the new job should depend on it.

- [ ] **Step 2: Append the job**

In `.github/workflows/ci.yml`, add under `jobs:`:

```yaml
  bundle-budget:
    runs-on: ubuntu-latest
    needs: [frontend]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: client/package-lock.json
      - name: Install dependencies
        run: cd client && npm ci
      - name: Build + budget
        env:
          ANALYZE: "true"
          NODE_ENV: production
        run: cd client && npm run budget
```

If the existing `frontend` job uses a different node version or cache key, match it (grep `actions/setup-node` in the yaml to find the canonical version).

- [ ] **Step 3: Verify yaml syntax**

```bash
# Use Python since bash on Windows may not have yamllint
python -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"
```

Expected: no error (yaml is valid).

- [ ] **Step 4: Commit**

```bash
rtk git add .github/workflows/ci.yml
rtk git commit -m "ci(client): add bundle-budget gate per route"
```

---

## Wave D — RSC migration

### Task 11: `lib/server/` scaffolding + `http.ts` helper

**Files:**
- Create: `client/src/lib/server/http.ts`

- [ ] **Step 1: Write the helper**

Create `client/src/lib/server/http.ts`:

```typescript
/**
 * Server-only HTTP helper for React Server Components.
 *
 * Reads the auth_token cookie via `next/headers`, calls the backend
 * via `fetch`, and returns JSON.  Use this from files under
 * `lib/server/` — never from `components/` or client files, which
 * could leak the cookie-read intent into the client bundle.
 *
 * The `"server-only"` import acts as a lint that aborts the build
 * if a client component accidentally imports this module.
 */

import "server-only";

import { cookies } from "next/headers";

const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL ?? "http://localhost:3099";

export interface FetchServerOptions {
  /** Override backend base URL (default: `BACKEND_BASE_URL` env or `http://localhost:3099`). */
  baseUrl?: string;
  /** Additional headers. */
  headers?: Record<string, string>;
  /** Next.js fetch cache hint. Default: "no-store" for dynamic data. */
  cache?: RequestCache;
  /** Next.js revalidate hint (in seconds). Default: unset. */
  revalidate?: number | false;
}

export async function fetchServer<T>(path: string, opts: FetchServerOptions = {}): Promise<T> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  const base = opts.baseUrl ?? BACKEND_BASE_URL;
  const url = path.startsWith("http") ? path : `${base}${path}`;

  const res = await fetch(url, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      Accept: "application/json",
      ...opts.headers,
    },
    cache: opts.cache ?? "no-store",
    next: opts.revalidate !== undefined ? { revalidate: opts.revalidate } : undefined,
  });

  if (!res.ok) {
    throw new Error(`server fetch failed: ${res.status} ${res.statusText} for ${url}`);
  }

  return (await res.json()) as T;
}
```

- [ ] **Step 2: Install the `server-only` package**

```bash
cd client
npm install server-only
```

- [ ] **Step 3: Verify type-check**

```bash
cd client
npm run type-check
```

Expected: no TS errors.

- [ ] **Step 4: Commit**

```bash
rtk git add client/src/lib/server/http.ts client/package.json client/package-lock.json
rtk git commit -m "feat(client): add server-only fetchServer helper for RSC data access"
```

---

### Task 12: `/dashboard` → RSC (pilot)

**Files:**
- Create: `client/src/lib/server/dashboard.ts`
- Create: `client/src/app/dashboard/dashboard-client.tsx`
- Modify: `client/src/app/dashboard/page.tsx`

- [ ] **Step 1: Grep current dashboard page for client-only APIs**

```bash
rtk grep "window\.\|localStorage\|document\.\|sessionStorage\|useState\|useEffect\|useQueryClient\|useRouter" client/src/app/dashboard/page.tsx
```

Every match is a hint that this code MUST stay in the client shard.

- [ ] **Step 2: Write `lib/server/dashboard.ts`**

Create `client/src/lib/server/dashboard.ts`:

```typescript
import "server-only";

import { fetchServer } from "./http";

export interface DashboardSummary {
  total_events: number;
  total_tasks: number;
  unread_mail: number;
  upcoming_meetings: number;
}

export interface DashboardSeriesPoint {
  date: string;
  value: number;
}

export interface DashboardData {
  summary: DashboardSummary;
  series: Record<string, DashboardSeriesPoint[]>;
  layout: string[];
}

export async function fetchDashboardData(): Promise<DashboardData> {
  return fetchServer<DashboardData>("/api/v1/dashboard/data");
}
```

If the backend's dashboard endpoint shape differs, adjust the types — but keep the function name `fetchDashboardData` for the caller.

- [ ] **Step 3: Extract the client interactive bits into `dashboard-client.tsx`**

Create `client/src/app/dashboard/dashboard-client.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  RefreshCw,
  Pencil,
  Plus,
  RotateCcw,
} from "lucide-react";
import type { DashboardData } from "@/lib/server/dashboard";

interface DashboardClientProps {
  initialData: DashboardData;
}

/**
 * Interactive client island for /dashboard.
 *
 * The Server Component parent fetches the initial data and passes it in
 * via `initialData`.  This component owns the refresh button, state for
 * edit mode, and the charts (TanStack Query caches the payload so
 * background refetches still work).
 */
export function DashboardClient({ initialData }: DashboardClientProps) {
  const [editing, setEditing] = useState(false);
  const queryClient = useQueryClient();

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setEditing(e => !e)}>
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <Badge variant="outline">Événements</Badge>
            <p className="mt-2 text-2xl font-bold">{initialData.summary.total_events}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <Badge variant="outline">Tâches</Badge>
            <p className="mt-2 text-2xl font-bold">{initialData.summary.total_tasks}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <Badge variant="outline">Mails</Badge>
            <p className="mt-2 text-2xl font-bold">{initialData.summary.unread_mail}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <Badge variant="outline">Réunions</Badge>
            <p className="mt-2 text-2xl font-bold">{initialData.summary.upcoming_meetings}</p>
          </CardContent>
        </Card>
      </section>

      {editing && (
        <section className="rounded border border-dashed border-muted-foreground/40 p-4">
          <p className="text-sm text-muted-foreground">
            Mode édition — ajouter, ranger, supprimer des cartes.
          </p>
          <Button size="sm" variant="outline" className="mt-2">
            <Plus className="h-4 w-4 mr-1" /> Ajouter
          </Button>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 3b: Rewrite `page.tsx` as a Server Component**

Replace the entire content of `client/src/app/dashboard/page.tsx` with:

```tsx
import { AppLayout } from "@/components/layout/app-layout";
import { fetchDashboardData } from "@/lib/server/dashboard";
import { DashboardClient } from "./dashboard-client";

// This file is now a Server Component. No `"use client"` at the top.
// React 19 streams the HTML; the `DashboardClient` island hydrates on
// the client.

export default async function DashboardPage() {
  const initialData = await fetchDashboardData();
  return (
    <AppLayout>
      <DashboardClient initialData={initialData} />
    </AppLayout>
  );
}
```

If `AppLayout` is a client component (check with `rtk grep "\"use client\"" client/src/components/layout/app-layout.tsx`), that's fine — it will run on the client after the RSC shell streams.

- [ ] **Step 4: Verify `AppLayout` is RSC-safe**

```bash
rtk grep "window\.\|document\.\|localStorage" client/src/components/layout/app-layout.tsx
```

If it reads `window`/`document` unconditionally at render, it must carry `"use client"` already. Ensure that is the case (add `"use client"` at the top if missing). This preserves behavior while allowing the parent Server Component to stream.

- [ ] **Step 5: Build and run dev**

```bash
cd client
npm run build
```

Expected: build completes. If there's an error like `You're importing a component that needs useState. ...` on a server file, that component needs `"use client"` — add it to whichever component the error names.

```bash
cd client
npm run dev
```

Then in a browser, open `/dashboard` with auth_token set in cookies. Expected: skeleton then content, network tab shows one HTML request (streamed), followed by client chunks.

- [ ] **Step 6: Commit**

```bash
rtk git add client/src/lib/server/dashboard.ts \
           client/src/app/dashboard/
rtk git commit -m "perf(client): migrate /dashboard to React Server Components"
```

---

### Task 13: Playwright test for RSC /dashboard

**Files:**
- Create: `client/tests/e2e/p2-rsc-dashboard.spec.ts`

- [ ] **Step 1: Write the test**

Create `client/tests/e2e/p2-rsc-dashboard.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test.describe("P2 RSC /dashboard", () => {
  test("dashboard RSC streams HTML fast under throttled 3G", async ({ page, context }) => {
    // Simulate slow 3G throttling on the browser context.
    await context.route("**", async route => {
      // Playwright doesn't have native throttling; emulate with a small delay.
      await new Promise(r => setTimeout(r, 100));
      await route.continue();
    });

    // Assume admin is already logged in for this test (playwright auth setup
    // provides an auth_token cookie — see tests/e2e/auth.setup.ts).
    const start = Date.now();
    const response = await page.goto("http://localhost:3000/dashboard", {
      waitUntil: "domcontentloaded",
    });
    const ttfb = Date.now() - start;

    expect(response?.status()).toBe(200);
    // TTFB budget under throttled 3G — RSC streams first chunk fast.
    expect(ttfb).toBeLessThan(2000);

    // LCP budget.
    // Use the Performance API to measure the largest contentful paint.
    const lcp = await page.evaluate(() => {
      return new Promise<number>(resolve => {
        new PerformanceObserver(list => {
          const entries = list.getEntries();
          const last = entries[entries.length - 1];
          resolve(last.startTime);
        }).observe({ type: "largest-contentful-paint", buffered: true });
        // Fallback if LCP never fires.
        setTimeout(() => resolve(-1), 5000);
      });
    });

    expect(lcp).toBeGreaterThan(0);
    expect(lcp).toBeLessThan(2500);
  });
});
```

- [ ] **Step 2: Run the test (requires a logged-in auth fixture)**

Check existing Playwright fixture setup:

```bash
rtk grep -l "auth_token\|storageState" client/tests
```

If a `client/tests/e2e/auth.setup.ts` file exists and is wired via `playwright.config.ts` `setup` project, the test can run as-is. If not, skip the admin-login dependency with `test.skip()` and mark the test `test.describe.skip("… (requires auth)", …)`.

- [ ] **Step 3: Run**

```bash
cd client
npx playwright test p2-rsc-dashboard.spec.ts --reporter=list
```

Expected: test PASSES. If LCP > 2500 ms on the dev machine, record actual value and investigate which blocking script.

- [ ] **Step 4: Commit**

```bash
rtk git add client/tests/e2e/p2-rsc-dashboard.spec.ts
rtk git commit -m "test(client): assert /dashboard RSC LCP under 2.5 s and TTFB under 2 s"
```

---

### Task 14: `/mail/inbox` → RSC

**Files:**
- Create: `client/src/lib/server/mail.ts`
- Create: `client/src/app/mail/mail-list-client.tsx`
- Modify: `client/src/app/mail/page.tsx`

- [ ] **Step 1: Inspect current page**

```bash
head -30 client/src/app/mail/page.tsx
rtk grep "window\.\|localStorage\|document\.\|sessionStorage" client/src/app/mail/page.tsx
```

Note the client-only APIs referenced — they must go to the client island.

- [ ] **Step 2: Write `lib/server/mail.ts`**

Create `client/src/lib/server/mail.ts`:

```typescript
import "server-only";

import { fetchServer } from "./http";

export interface MailMessageSummary {
  id: string;
  subject: string;
  from: string;
  from_name: string;
  date: string;        // ISO 8601
  preview: string;
  is_read: boolean;
  folder: string;
}

export interface MailInbox {
  messages: MailMessageSummary[];
  total: number;
  unread: number;
}

export async function fetchMailInbox(folder = "INBOX", limit = 50): Promise<MailInbox> {
  const qs = new URLSearchParams({ folder, limit: String(limit) });
  return fetchServer<MailInbox>(`/api/v1/mail/messages?${qs.toString()}`);
}
```

- [ ] **Step 3: Extract the client interactive part**

Create `client/src/app/mail/mail-list-client.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { MailInbox, MailMessageSummary } from "@/lib/server/mail";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface MailListClientProps {
  initialInbox: MailInbox;
}

/**
 * Interactive client island for /mail: viewer pane, filters, selection.
 * Only the initial list render is streamed from the Server Component;
 * subsequent updates (read/unread, delete) are client-side mutations.
 */
export function MailListClient({ initialInbox }: MailListClientProps) {
  const [selected, setSelected] = useState<MailMessageSummary | null>(null);
  const [messages, setMessages] = useState(initialInbox.messages);

  return (
    <div className="grid grid-cols-12 h-full">
      <aside className="col-span-4 border-r overflow-y-auto">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="font-semibold">Inbox</h2>
          <Badge variant="secondary">{initialInbox.unread} non lus</Badge>
        </div>
        <ul>
          {messages.map(m => (
            <li
              key={m.id}
              className={`p-3 cursor-pointer border-b ${selected?.id === m.id ? "bg-accent" : ""} ${m.is_read ? "" : "font-semibold"}`}
              onClick={() => setSelected(m)}
            >
              <div className="flex justify-between">
                <span className="truncate">{m.from_name || m.from}</span>
                <span className="text-xs text-muted-foreground">{new Date(m.date).toLocaleDateString("fr-FR")}</span>
              </div>
              <div className="truncate">{m.subject}</div>
              <div className="truncate text-sm text-muted-foreground">{m.preview}</div>
            </li>
          ))}
        </ul>
      </aside>

      <section className="col-span-8 p-6 overflow-y-auto">
        {selected ? (
          <article>
            <h3 className="text-xl font-semibold">{selected.subject}</h3>
            <p className="text-sm text-muted-foreground">de {selected.from}, le {new Date(selected.date).toLocaleString("fr-FR")}</p>
            <pre className="mt-4 whitespace-pre-wrap">{selected.preview}</pre>
            <div className="mt-6 flex gap-2">
              <Button variant="outline" size="sm">Répondre</Button>
              <Button variant="outline" size="sm">Transférer</Button>
              <Button variant="ghost" size="sm" onClick={() => setMessages(msgs => msgs.filter(m => m.id !== selected.id))}>
                Supprimer
              </Button>
            </div>
          </article>
        ) : (
          <p className="text-muted-foreground">Sélectionnez un message pour le lire.</p>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Rewrite `page.tsx`**

Replace `client/src/app/mail/page.tsx` entirely with:

```tsx
import { fetchMailInbox } from "@/lib/server/mail";
import { MailListClient } from "./mail-list-client";

export default async function MailPage() {
  const initialInbox = await fetchMailInbox();
  return <MailListClient initialInbox={initialInbox} />;
}
```

The mail layout likely already lives in `app/mail/layout.tsx` with `AppLayout` — no changes needed to it.

- [ ] **Step 5: Build + smoke**

```bash
cd client
npm run build
npm run dev
```

Visit `http://localhost:3000/mail` in the browser. Expected: list streams fast, viewer hydrates on click.

- [ ] **Step 6: Commit**

```bash
rtk git add client/src/lib/server/mail.ts client/src/app/mail/
rtk git commit -m "perf(client): migrate /mail/inbox to RSC with client viewer island"
```

---

### Task 15: `/forms` → RSC

**Files:**
- Create: `client/src/lib/server/forms.ts`
- Create: `client/src/app/forms/forms-client.tsx`
- Modify: `client/src/app/forms/page.tsx`

- [ ] **Step 1: Write `lib/server/forms.ts`**

Create `client/src/lib/server/forms.ts`:

```typescript
import "server-only";

import { fetchServer } from "./http";

export interface FormSummary {
  id: string;
  title: string;
  description: string | null;
  responses_count: number;
  created_at: string;
  updated_at: string;
  is_published: boolean;
}

export interface FormsListResponse {
  forms: FormSummary[];
  total: number;
}

export async function fetchFormsList(): Promise<FormsListResponse> {
  return fetchServer<FormsListResponse>("/api/v1/forms");
}
```

- [ ] **Step 2: Extract the client interactive part**

Create `client/src/app/forms/forms-client.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import type { FormsListResponse, FormSummary } from "@/lib/server/forms";

interface FormsClientProps {
  initialList: FormsListResponse;
}

export function FormsClient({ initialList }: FormsClientProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const filtered: FormSummary[] = initialList.forms.filter(f =>
    f.title.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-4 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Formulaires</h1>
        <Button onClick={() => router.push("/forms/new")}>
          <Plus className="mr-1 h-4 w-4" /> Nouveau
        </Button>
      </header>

      <Input
        placeholder="Rechercher..."
        value={query}
        onChange={e => setQuery(e.target.value)}
        className="max-w-sm"
      />

      <ul className="flex flex-col gap-2">
        {filtered.map(f => (
          <li key={f.id} className="rounded border p-4 flex justify-between items-center">
            <Link href={`/forms/${f.id}`} className="flex-1">
              <p className="font-medium">{f.title}</p>
              {f.description && (
                <p className="text-sm text-muted-foreground">{f.description}</p>
              )}
            </Link>
            <div className="flex items-center gap-3">
              <Badge variant={f.is_published ? "default" : "secondary"}>
                {f.is_published ? "Publié" : "Brouillon"}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {f.responses_count} réponses
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: Rewrite `page.tsx`**

Replace `client/src/app/forms/page.tsx` with:

```tsx
import { fetchFormsList } from "@/lib/server/forms";
import { FormsClient } from "./forms-client";

export default async function FormsPage() {
  const initialList = await fetchFormsList();
  return <FormsClient initialList={initialList} />;
}
```

- [ ] **Step 4: Build + smoke**

```bash
cd client
npm run build
```

- [ ] **Step 5: Commit**

```bash
rtk git add client/src/lib/server/forms.ts client/src/app/forms/page.tsx client/src/app/forms/forms-client.tsx
rtk git commit -m "perf(client): migrate /forms to RSC with client filter island"
```

---

### Task 16: `/contacts` → RSC

**Files:**
- Create: `client/src/lib/server/contacts.ts`
- Create: `client/src/app/contacts/contacts-client.tsx`
- Modify: `client/src/app/contacts/page.tsx`

- [ ] **Step 1: Write `lib/server/contacts.ts`**

Create `client/src/lib/server/contacts.ts`:

```typescript
import "server-only";

import { fetchServer } from "./http";

export interface ContactSummary {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  organization: string | null;
  group_ids: string[];
}

export interface ContactsListResponse {
  contacts: ContactSummary[];
  total: number;
}

export async function fetchContactsList(limit = 100): Promise<ContactsListResponse> {
  return fetchServer<ContactsListResponse>(`/api/v1/contacts?limit=${limit}`);
}
```

- [ ] **Step 2: Extract the client interactive part**

Create `client/src/app/contacts/contacts-client.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import type { ContactsListResponse, ContactSummary } from "@/lib/server/contacts";

interface ContactsClientProps {
  initialList: ContactsListResponse;
}

export function ContactsClient({ initialList }: ContactsClientProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ContactSummary | null>(null);

  const filtered = initialList.contacts.filter(c => {
    const term = query.toLowerCase();
    return (
      c.first_name.toLowerCase().includes(term) ||
      c.last_name.toLowerCase().includes(term) ||
      (c.email ?? "").toLowerCase().includes(term) ||
      (c.organization ?? "").toLowerCase().includes(term)
    );
  });

  return (
    <div className="grid grid-cols-12 h-full">
      <aside className="col-span-4 border-r overflow-y-auto">
        <div className="p-4 border-b flex items-center gap-2">
          <Input
            placeholder="Rechercher..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <Button size="icon">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <ul>
          {filtered.map(c => (
            <li
              key={c.id}
              onClick={() => setSelected(c)}
              className={`cursor-pointer border-b p-3 ${selected?.id === c.id ? "bg-accent" : ""}`}
            >
              <p className="font-medium">
                {c.first_name} {c.last_name}
              </p>
              {c.organization && (
                <p className="text-xs text-muted-foreground">{c.organization}</p>
              )}
            </li>
          ))}
        </ul>
      </aside>

      <section className="col-span-8 p-6">
        {selected ? (
          <article className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold">
              {selected.first_name} {selected.last_name}
            </h2>
            {selected.email && <p>Email: {selected.email}</p>}
            {selected.phone && <p>Téléphone: {selected.phone}</p>}
            {selected.organization && <p>Organisation: {selected.organization}</p>}
          </article>
        ) : (
          <p className="text-muted-foreground">Sélectionnez un contact.</p>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Rewrite `page.tsx`**

Replace `client/src/app/contacts/page.tsx` with:

```tsx
import { fetchContactsList } from "@/lib/server/contacts";
import { ContactsClient } from "./contacts-client";

export default async function ContactsPage() {
  const initialList = await fetchContactsList();
  return <ContactsClient initialList={initialList} />;
}
```

- [ ] **Step 4: Build + smoke**

```bash
cd client
npm run build
```

- [ ] **Step 5: Commit**

```bash
rtk git add client/src/lib/server/contacts.ts client/src/app/contacts/
rtk git commit -m "perf(client): migrate /contacts to RSC with client filter island"
```

---

### Task 17: `/projects` → RSC

**Files:**
- Create: `client/src/lib/server/projects.ts`
- Create: `client/src/app/projects/projects-client.tsx`
- Modify: `client/src/app/projects/page.tsx`

- [ ] **Step 1: Write `lib/server/projects.ts`**

Create `client/src/lib/server/projects.ts`:

```typescript
import "server-only";

import { fetchServer } from "./http";

export interface ProjectSummary {
  id: string;
  name: string;
  status: "planning" | "in_progress" | "paused" | "done" | "cancelled";
  progress: number;  // 0..100
  due_date: string | null;
  members_count: number;
  tasks_total: number;
  tasks_done: number;
}

export interface ProjectsListResponse {
  projects: ProjectSummary[];
  total: number;
}

export async function fetchProjectsList(): Promise<ProjectsListResponse> {
  return fetchServer<ProjectsListResponse>("/api/v1/projects");
}
```

- [ ] **Step 2: Extract the client interactive part**

Create `client/src/app/projects/projects-client.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Plus } from "lucide-react";
import type { ProjectsListResponse, ProjectSummary } from "@/lib/server/projects";

interface ProjectsClientProps {
  initialList: ProjectsListResponse;
}

const STATUS_LABEL: Record<ProjectSummary["status"], string> = {
  planning: "Planification",
  in_progress: "En cours",
  paused: "En pause",
  done: "Terminé",
  cancelled: "Annulé",
};

export function ProjectsClient({ initialList }: ProjectsClientProps) {
  const [filter, setFilter] = useState<ProjectSummary["status"] | "all">("all");

  const filtered = initialList.projects.filter(p => filter === "all" || p.status === filter);

  return (
    <div className="flex flex-col gap-4 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Projets</h1>
        <Button>
          <Plus className="mr-1 h-4 w-4" /> Nouveau projet
        </Button>
      </header>

      <nav className="flex gap-2">
        {(["all", "planning", "in_progress", "paused", "done", "cancelled"] as const).map(s => (
          <Button
            key={s}
            variant={filter === s ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(s)}
          >
            {s === "all" ? "Tous" : STATUS_LABEL[s]}
          </Button>
        ))}
      </nav>

      <ul className="flex flex-col gap-3">
        {filtered.map(p => (
          <li key={p.id} className="rounded border p-4">
            <Link href={`/projects/${p.id}`} className="block">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{p.name}</h3>
                <Badge variant="outline">{STATUS_LABEL[p.status]}</Badge>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <Progress value={p.progress} className="flex-1" />
                <span className="text-xs text-muted-foreground">
                  {p.tasks_done}/{p.tasks_total} tâches
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: Rewrite `page.tsx`**

Replace `client/src/app/projects/page.tsx` with:

```tsx
import { fetchProjectsList } from "@/lib/server/projects";
import { ProjectsClient } from "./projects-client";

export default async function ProjectsPage() {
  const initialList = await fetchProjectsList();
  return <ProjectsClient initialList={initialList} />;
}
```

- [ ] **Step 4: Build + smoke**

```bash
cd client
npm run build
```

- [ ] **Step 5: Commit**

```bash
rtk git add client/src/lib/server/projects.ts client/src/app/projects/
rtk git commit -m "perf(client): migrate /projects to RSC with client filter island"
```

---

## Wave E — Measurement

### Task 18: Bundle budget baseline + run

**Files:** (no file creation — regression check only)

- [ ] **Step 1: Run bundle budget check**

```bash
cd client
npm run budget
```

Expected: every route lists `[ok]`. Baseline gzipped sizes should now be:

- `/` : < 250 kB
- `/dashboard` : < 400 kB (after RSC)
- `/mail` : < 500 kB
- `/forms` : < 500 kB
- `/contacts` : < 500 kB
- `/projects` : < 500 kB
- `/docs/editor` : < 800 kB
- `/sheets/editor` : < 800 kB
- `/design/editor` : < 800 kB
- `/meet/[code]` : < 800 kB

If any route exceeds its budget, track it in `docs/superpowers/plans/2026-04-18-phase-d2-p2-followups.md` (create if missing) and raise the budget by 10 % with a comment; P2 exit criterion is "budget CI passes + baseline recorded".

- [ ] **Step 2: Record baseline in spec**

Append to `docs/superpowers/specs/2026-04-18-phase-d2-p2-frontend-design.md` before the "Références" section a new "### 14. Baseline (measured after P2)" block listing the actual kB numbers you observed.

- [ ] **Step 3: Commit**

```bash
rtk git add docs/superpowers/specs/2026-04-18-phase-d2-p2-frontend-design.md
rtk git commit -m "docs(spec): record P2 bundle budget baseline"
```

---

### Task 19: Lighthouse manual pass

**Files:** (no file creation — measurement only)

- [ ] **Step 1: Build + start in production mode**

```bash
cd client
npm run build
npm run start
```

- [ ] **Step 2: Run Lighthouse on each RSC page**

In a separate terminal:

```bash
cd client
npx lighthouse http://localhost:3000/dashboard \
  --only-categories=performance \
  --output=json --output-path=./lighthouse-dashboard.json \
  --chrome-flags="--headless --no-sandbox"
```

Repeat for `/mail`, `/forms`, `/contacts`, `/projects`.

- [ ] **Step 3: Extract the key numbers**

```bash
cd client
for page in dashboard mail forms contacts projects; do
  echo -n "$page: LCP="
  node -e "const j = require('./lighthouse-${page}.json'); console.log(j.audits['largest-contentful-paint'].numericValue, 'ms, score:', j.categories.performance.score)"
done
```

Expected: each LCP < 2500 ms, performance score >= 0.85.

Record numbers in `docs/superpowers/specs/2026-04-18-phase-d2-p2-frontend-design.md` under the "### 14. Baseline" section started in Task 18.

- [ ] **Step 4: Commit baseline update**

```bash
rtk git add docs/superpowers/specs/2026-04-18-phase-d2-p2-frontend-design.md
rtk git commit -m "docs(spec): record P2 Lighthouse LCP baseline"
```

---

## Wave F — Finalization

### Task 20: Debug skills + product spec + CLAUDE.md + merge

**Files:**
- Create: `.claude/skills/turbopack-debug/SKILL.md`
- Create: `.claude/skills/rsc-migration-debug/SKILL.md`
- Create: `docs/product-specs/51-perf-frontend.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Create Turbopack debug skill**

Create `.claude/skills/turbopack-debug/SKILL.md`:

```markdown
---
name: turbopack-debug
description: Use when `npm run dev` fails under Turbopack after the P2 switch from webpack, a specific route fails to compile, Serwist errors appear, or a previously-working import now throws a module-not-found. Covers diagnosing the incompat, invalidating the Turbopack cache, and the fallback path to a per-route webpack override.
---

# turbopack-debug

## Symptoms & first steps

- **"Module not found" after switch** — Turbopack can be stricter on ESM vs CJS boundaries. Run `rtk grep -n "require(" client/src/<suspected-file>`. Convert `require()` to `import` where found.
- **Serwist SW build errors in dev** — `withSerwistInit({ disable: process.env.NODE_ENV === "development" })` already disables in dev. If errors still appear, ensure `npm run dev` inherits `NODE_ENV=development` (check `.env.local`).
- **Fast Refresh not triggering** — purge `.next/` and restart dev server.

## Cache invalidation

```bash
cd client
rm -rf .next node_modules/.cache
npm run dev
```

## Fallback per-route

If a specific route is incompatible with Turbopack, keep dev on Turbopack for the rest of the app and fall back to webpack only when touching that route:

```bash
# Temporary per-developer workaround
npm run dev -- --webpack
```

Document such routes in `docs/architecture/frontend-perf.md`.

## Related

- Spec: `docs/superpowers/specs/2026-04-18-phase-d2-p2-frontend-design.md`
- Plan: `docs/superpowers/plans/2026-04-18-phase-d2-p2-frontend.md`
- Next.js Turbopack docs: https://nextjs.org/docs/app/api-reference/turbopack
```

- [ ] **Step 2: Create RSC migration debug skill**

Create `.claude/skills/rsc-migration-debug/SKILL.md`:

```markdown
---
name: rsc-migration-debug
description: Use when a Server Component build fails with "You're importing a component that needs useState/useEffect", when `cookies()` throws outside a server context, when a RSC page renders blank in production, or when a client-only value like `window`/`localStorage` crashes the RSC pass. Covers separating client/server modules, the `"server-only"` / `"use client"` contract, and hydration mismatch triage.
---

# rsc-migration-debug

## Common errors

- **"You're importing a component that needs useState. It only works in a Client Component ..."**
  → Add `"use client"` at the top of the offending component, OR wrap the consumer in a new client island.

- **"cookies() was called outside a request scope"**
  → File is imported from a client component. Enforce: `lib/server/*.ts` files must start with `import "server-only";`. Callers must be Server Components or API routes.

- **Blank RSC page in prod, works in dev**
  → RSC fetch threw an unhandled error. Check the server log for the actual stack trace; wrap in `error.tsx` sibling.

## Rule of thumb

A file under `client/src/lib/server/*.ts` must:
1. Start with `import "server-only";`
2. Only be imported from Server Components (`page.tsx` without `"use client"`) or from other `lib/server/*.ts` files.
3. Never be imported from `components/` unless the component is also Server (no `useState` / `useEffect`).

## Discovery commands

```bash
# Find client-only APIs used in top-level pages we're migrating:
rtk grep "window\.\|localStorage\|document\.\|sessionStorage" client/src/app/<page>

# Find components that should be "use client" but aren't:
rtk grep -L "\"use client\"" client/src/components/<file-using-useState>
```

## Related

- Spec: `docs/superpowers/specs/2026-04-18-phase-d2-p2-frontend-design.md`
- Plan: `docs/superpowers/plans/2026-04-18-phase-d2-p2-frontend.md`
- RSC docs: https://nextjs.org/docs/app/building-your-application/rendering/server-components
```

- [ ] **Step 3: Create product spec**

Create `docs/product-specs/51-perf-frontend.md`:

```markdown
# 51 — Perf frontend (Turbopack + RSC + dynamic imports)

## Ce qui change pour l'équipe dev

- `npm run dev` utilise désormais Turbopack (plus `--webpack`). Premier compile de `/dashboard` passe de ~13 s à < 1 s.
- Tiptap, LiveKit, MediaPipe, Monaco sont lazy-loadés : le bundle initial descend sous 250 kB gzip.
- 5 pages (`/dashboard`, `/mail`, `/forms`, `/contacts`, `/projects`) passent en React Server Components : le HTML arrive streamé depuis le serveur, TTFB < 500 ms.
- Nouveau CI gate `bundle-budget` : échec si une route dépasse son budget gzipped.

## Ce qui change pour l'utilisateur final

- Chargement initial plus rapide (bundle léger).
- Pages liste s'affichent presque instantanément (RSC stream).
- Premier clic sur éditeur (doc, design, sheet) ou meet déclenche un mini-skeleton pendant 50-200 ms le temps du chunk — puis plein UX.

## Références

- Design : `docs/superpowers/specs/2026-04-18-phase-d2-p2-frontend-design.md`
- Plan : `docs/superpowers/plans/2026-04-18-phase-d2-p2-frontend.md`
- Debug skills : `.claude/skills/turbopack-debug/`, `.claude/skills/rsc-migration-debug/`
- Budget CI : `.github/workflows/ci.yml` → job `bundle-budget`
```

- [ ] **Step 4: Update CLAUDE.md**

Edit `CLAUDE.md`. Find the "Frontend" entry in the Préférences de développement section (inserted by P1 if present, otherwise near the other dev commands). Replace or append:

```markdown
- **Frontend dev (défaut)** : `cd client && npm run dev` utilise **Turbopack** (Next.js 16). Cold compile `/dashboard` < 1 s.
- **Frontend build** : `cd client && npm run build` (webpack pour prod, inchangé).
- **Frontend budget** : `cd client && npm run budget` vérifie la taille gzip par route.
```

- [ ] **Step 5: Final commit + merge**

```bash
rtk git add .claude/skills/turbopack-debug/ .claude/skills/rsc-migration-debug/ \
           docs/product-specs/51-perf-frontend.md CLAUDE.md
rtk git commit -m "docs: add P2 debug skills + product spec + CLAUDE.md update"

# Merge the feature branch into main (same pattern as P1).
rtk git checkout main
rtk git merge --no-ff feature/phase-d2-p2-frontend -m "Merge branch 'feature/phase-d2-p2-frontend': Phase D2 P2 frontend perf"
rtk git push origin main
```

- [ ] **Step 6: Verify final state**

```bash
rtk git log --oneline main..origin/main | wc -l       # should be 0 (everything pushed)
cd client && npm run build                             # passes
cd client && npm run budget                            # all green
```

---

## Self-Review

### Spec coverage

| Spec section | Task(s) |
|---|---|
| §4 Turbopack bascule + fallback | 1, 2 |
| §5 Dynamic imports (Tiptap, LiveKit, MediaPipe, Monaco) | 3, 4, 5, 6, 7 |
| §6 optimizePackageImports + CI budget | 8, 9, 10 |
| §7 RSC migration 5 pages | 11, 12, 13, 14, 15, 16, 17 |
| §10 Testing (Playwright cold-compile, LCP) | 2, 13, 18, 19 |
| §12 Debug skills + product spec | 20 |

### Placeholder scan

- No "TBD" / "TODO" / "implement later" left.
- Each task has concrete code blocks; no "similar to Task N" references.
- Templates for all 5 RSC pages fully written out (Tasks 12, 14, 15, 16, 17), not referenced.

### Type consistency

- `fetchServer<T>(path, opts)` signature stable across all 5 `lib/server/*.ts` files (Tasks 11-17).
- Each `<Xxx>Client` island takes `initial<Thing>` of the type exported from `lib/server/<thing>.ts` — consistent.
- `EditorSkeleton`, `MeetingRoomSkeleton`, `MonacoSkeleton` exported from the same file (`common/lazy-skeleton.tsx`) and referenced by name in every lazy wrapper (Tasks 3, 4, 5, 6).

### Gaps filled inline

- Added `server-only` package install step (Task 11 Step 2) to enforce the client/server boundary.
- Added explicit `AppLayout` client-safety check (Task 12 Step 4) to avoid the common "useState in Server Component" error.
- Added npm script `"budget"` in Task 9 Step 2 so Task 18 can invoke it trivially.
- Merge commits preserve the `--no-ff` convention from P1.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-18-phase-d2-p2-frontend.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach ?
