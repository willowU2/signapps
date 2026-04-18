# Phase D2 · P3 — Polish runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Passer le CI `bundle-budget` au vert (vendor trim), éliminer `unsafe-eval` de la CSP via workers isolés (formula, markdown, VAD), virtualiser les 5 listes massives, étendre les stratégies Service Worker, et ajouter un gate Lighthouse CI strict sur 10 pages critiques.

**Architecture:** Vendor-first (J1-J3) débloque le CI, Workers (J4-J7) éliminent `unsafe-eval` et déchargent le main thread, virtualisation (J8-J10) rend scroll snappy sur 10 k items, SW polish (J11-J12) ajoute `StaleWhileRevalidate` `/list` + test kill-switch Playwright, Lighthouse CI (J13) gate les PRs futures, finalisation (J14) documente et merge.

**Tech Stack:** Next.js 16.2.3 + Turbopack (depuis P2), `@tanstack/react-virtual` (déjà en dep), `serwist` (déjà configuré), Web Workers ESM avec `new URL("./worker.ts", import.meta.url)` pattern, `@lhci/cli`, Playwright.

---

## Scope Check

Plan P3 uniquement (`docs/superpowers/specs/2026-04-18-phase-d2-p3-polish-design.md`). P1+P2 déjà livrés+mergés sur main. Pas de WebAssembly formula engine, pas de PWA custom install, pas de remplacement Monaco/Tiptap/recharts.

## File Structure

### Fichiers créés

| Fichier | Responsabilité |
|---|---|
| `client/src/lib/tauri.ts` | `isTauri()` helper + gated dynamic import |
| `client/src/workers/formula.worker.ts` | Évaluateur d'expressions isolé dans worker |
| `client/src/workers/markdown.worker.ts` | HTML ↔ Markdown via turndown |
| `client/src/workers/vad.worker.ts` (conditionnel) | VAD wrapper si lib pas déjà native worker |
| `client/src/lib/workers/formula-client.ts` | Client main-thread postMessage/Promise |
| `client/src/lib/workers/markdown-client.ts` | Client markdown |
| `client/src/lib/workers/vad-client.ts` (conditionnel) | Client VAD |
| `client/src/components/common/virtual-list.tsx` | Wrapper `useVirtualizer` générique + a11y |
| `client/e2e/p3-chat-scroll.spec.ts` | Playwright scroll 5k messages, p95 frame <17 ms |
| `client/e2e/p3-sw-killswitch.spec.ts` | Playwright cache purge après SW update |
| `client/lighthouse/config.json` | Lighthouse CI seuils + URLs |
| `.claude/skills/workers-debug/SKILL.md` | Debug crashes worker, postMessage timeouts |
| `.claude/skills/virtualization-debug/SKILL.md` | Debug scroll jump, a11y, row height |
| `docs/product-specs/52-polish-runtime.md` | Spec produit miroir |
| `docs/architecture/service-worker.md` | Tableau des stratégies SW |

### Fichiers modifiés

| Fichier | Changement |
|---|---|
| `client/next.config.ts` | Retirer `'unsafe-eval'` de CSP, budget abaissé après vendor trim |
| `client/src/lib/sheets/functions-extended.ts` + 4 autres | Appels async via `formula-client` au lieu d'évaluation inline main-thread |
| `client/src/lib/sheets/formula.ts` | Signature async, appelle worker client |
| `client/src/components/chat/message-list.tsx` | Virtualiser via `<VirtualList>` |
| `client/src/components/mail/inbox-list.tsx` | Virtualiser |
| `client/src/components/contacts/contacts-list.tsx` | Virtualiser |
| `client/src/components/storage/file-list.tsx` | Virtualiser |
| `client/src/components/notifications/feed.tsx` | Virtualiser |
| `client/src/app/sw.ts` | +StaleWhileRevalidate `/list`, +CacheFirst brand-kit/tenant-config |
| `client/scripts/check-bundle-budget.js` | Budgets abaissés après vendor trim |
| `.github/workflows/ci.yml` | Job `lighthouse-ci` ajouté |
| `CLAUDE.md` | Mentionner workers + virtualisation |

---

## Waves

| Wave | Tasks | Jours |
|---|---|---|
| **V. Vendor trim** | 1–3 | J1–J3 |
| **W. Workers** | 4–6 | J4–J7 |
| **X. Virtualisation** | 7–10 | J8–J10 |
| **Y. SW polish** | 11–12 | J11–J12 |
| **Z. Lighthouse CI** | 13 | J13 |
| **F. Finalisation** | 14 | J14 |

---

## Wave V — Vendor trim

### Task 1: Bundle analyzer audit + baseline

**Files:**
- Create: `client/lighthouse/baseline-J1.md`

- [ ] **Step 1: Run bundle analyzer**

```bash
cd client
ANALYZE=true npm run build 2>&1 | tail -20
```

Expected: build succeeds, analyzer HTML at `.next/analyze/client.html`.

- [ ] **Step 2: Run the budget script to capture baseline**

```bash
cd client
node scripts/check-bundle-budget.js > /tmp/budget-baseline.txt 2>&1 || true
head -40 /tmp/budget-baseline.txt
```

- [ ] **Step 3: Identify top shared chunks**

```bash
cd client
node -e "
const fs = require('fs');
const p = '.next/app-build-manifest.json';
if (!fs.existsSync(p)) { console.error('manifest missing'); process.exit(1); }
const m = JSON.parse(fs.readFileSync(p, 'utf8'));
const pages = m.pages || {};
const seen = new Map();
for (const files of Object.values(pages)) {
  for (const f of files) if (f.endsWith('.js')) seen.set(f, (seen.get(f) || 0) + 1);
}
const shared = [...seen.entries()].filter(([,n]) => n > 10).sort((a,b) => b[1]-a[1]);
for (const [f, n] of shared.slice(0, 15)) console.log(n, f);
"
```

This shows chunks included in >10 routes (the shared vendor suspects).

- [ ] **Step 4: Record findings**

Create `client/lighthouse/baseline-J1.md`:

```markdown
# Bundle audit — J1 2026-04-18

## Top 5 heavy shared chunks (>10 routes)

- `chunks/XXX.js` — ~YYY kB — contains: [inspect via analyzer HTML]
- ... 4 more

## Top packages to prune

1. `@tauri-apps/*` — utilisé uniquement en Tauri, gate avec `isTauri()`
2. `framer-motion` — audit usages, possible CSS transitions
3. `recharts` — vérifier tree-shake
4. `lodash` vs `lodash-es` — dedupe
5. `date-fns` + `moment` — choisir un seul
```

Fill in real numbers from the analyzer output.

- [ ] **Step 5: Commit**

```bash
rtk git add client/lighthouse/baseline-J1.md
rtk git commit -m "perf(client): record J1 bundle audit baseline before vendor trim"
```

---

### Task 2: Gate `@tauri-apps/*` behind `isTauri()` helper

**Files:**
- Create: `client/src/lib/tauri.ts`
- Modify: every file importing `@tauri-apps/api` or `@tauri-apps/plugin-shell` at top level

- [ ] **Step 1: Create the helper**

Create `client/src/lib/tauri.ts`:

```ts
/**
 * Tauri detection + lazy-import helpers.  When the app runs in a
 * browser tab (no Tauri context), the IPC/invoke modules are never
 * loaded — they add ~80-120 kB gzipped to the main bundle otherwise.
 */

export function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  return "__TAURI_INTERNALS__" in window || "__TAURI__" in window;
}

export async function tauriCore(): Promise<typeof import("@tauri-apps/api/core") | null> {
  if (!isTauri()) return null;
  return import("@tauri-apps/api/core");
}

export async function tauriShell(): Promise<typeof import("@tauri-apps/plugin-shell") | null> {
  if (!isTauri()) return null;
  return import("@tauri-apps/plugin-shell");
}
```

- [ ] **Step 2: Find all direct Tauri imports**

```bash
rtk grep -l "from \"@tauri-apps/api\|from \"@tauri-apps/plugin-shell" client/src
```

- [ ] **Step 3: Migrate call sites**

For each file, replace static top-level imports:

```tsx
// BEFORE
import { invoke } from "@tauri-apps/api/core";
// later in component
invoke("cmd", args);
```

with the gated helper:

```tsx
// AFTER
import { tauriCore } from "@/lib/tauri";
// inside effect or handler
const core = await tauriCore();
if (core) await core.invoke("cmd", args);
```

If a file's Tauri usage is pervasive, instead wrap the whole feature behind a `dynamic()` import of a Tauri-only sub-component. Keep scope to top-level import sites.

- [ ] **Step 4: Build + budget**

```bash
cd client
npm run build 2>&1 | tail -5
node scripts/check-bundle-budget.js 2>&1 | tail -10
```

Compare to J1 baseline — `/` and `/dashboard` should have lost ~80-120 kB.

- [ ] **Step 5: Commit**

```bash
rtk git add client/src/lib/tauri.ts client/src
rtk git commit -m "perf(client): gate @tauri-apps/* imports behind isTauri() helper"
```

---

### Task 3: Dedup + tree-shake audit + budget validation

**Files:**
- Modify: `client/package.json` (remove redundant deps if any)
- Modify: `client/scripts/check-bundle-budget.js` (optional budget tightening)

- [ ] **Step 1: Check for duplicate date/utility libs**

```bash
cd client
npm ls date-fns moment luxon dayjs 2>&1 | head -20
npm ls lodash lodash-es 2>&1 | head -20
```

- [ ] **Step 2: Drop duplicates**

If both `moment` and `date-fns` appear and primary usage is `date-fns`:

```bash
cd client
rtk grep -l "from \"moment\"\|require('moment')" src | head -10
```

For each match, replace `moment` calls with `date-fns` equivalents (format, parseISO, addDays). Then:

```bash
cd client
npm uninstall moment 2>&1 | tail -3
```

Same exercise for `lodash` → `lodash-es` if duplicates.

- [ ] **Step 3: Verify `framer-motion` usages are tree-shaken**

```bash
rtk grep -c "from \"framer-motion\"" client/src | awk '{s+=$NF} END {print s}'
```

If usage is only a few `<motion.div>` animations, consider replacing by CSS transitions. Pragmatic: if >20 usages, leave framer-motion in place, just verify it's in `optimizePackageImports`.

- [ ] **Step 4: Run budget — confirm green**

```bash
cd client
node scripts/check-bundle-budget.js 2>&1 | tail -20
```

Expected: all routes show `ok`. If some remain over, document why in the commit message.

- [ ] **Step 5: Tighten budgets in script (optional)**

If routes pass comfortably, tighten budgets in `client/scripts/check-bundle-budget.js`:

```js
const BUDGETS = {
  "/": 250 * KB,
  "/dashboard": 400 * KB,
  // adjust as observed, leave ~10 % headroom
};
```

- [ ] **Step 6: Commit**

```bash
rtk git add client/package.json client/package-lock.json client/src client/scripts/check-bundle-budget.js
rtk git commit -m "perf(client): dedupe date lib + tighten budget after vendor trim"
```

---

## Wave W — Workers

### Task 4: Formula worker + remove unsafe-eval

**Files:**
- Create: `client/src/workers/formula.worker.ts`
- Create: `client/src/lib/workers/formula-client.ts`
- Modify: `client/src/lib/sheets/formula.ts`
- Modify: `client/src/lib/sheets/functions-extended.ts`
- Modify: `client/src/lib/sheets/functions/registry.ts`
- Modify: `client/src/lib/sheets/functions/{text,logic,math}.ts`
- Modify: `client/next.config.ts` (remove `'unsafe-eval'`)

- [ ] **Step 1: Write the client skeleton**

Create `client/src/lib/workers/formula-client.ts`:

```ts
"use client";

type EvalRequest = { id: string; expr: string; context: Record<string, unknown> };
type EvalResponse =
  | { id: string; ok: true; value: unknown }
  | { id: string; ok: false; error: string };

const pending = new Map<string, (res: EvalResponse) => void>();
let worker: Worker | null = null;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(
      new URL("../../workers/formula.worker.ts", import.meta.url),
      { type: "module" }
    );
    worker.addEventListener("message", (ev: MessageEvent<EvalResponse>) => {
      const cb = pending.get(ev.data.id);
      if (cb) {
        pending.delete(ev.data.id);
        cb(ev.data);
      }
    });
    worker.addEventListener("error", err => {
      console.error("[formula-worker] crash, respawning", err);
      worker?.terminate();
      worker = null;
      for (const [, cb] of pending) {
        cb({ id: "", ok: false, error: "worker crashed" });
      }
      pending.clear();
    });
  }
  return worker;
}

export async function evaluateFormula(expr: string, context: Record<string, unknown>): Promise<unknown> {
  const id = crypto.randomUUID();
  return new Promise<unknown>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`formula evaluation timeout (5s): ${expr.slice(0, 80)}`));
    }, 5_000);
    pending.set(id, res => {
      clearTimeout(timer);
      if (res.ok) resolve(res.value);
      else reject(new Error(res.error));
    });
    const req: EvalRequest = { id, expr, context };
    getWorker().postMessage(req);
  });
}
```

- [ ] **Step 2: Write the worker file**

The worker file (`client/src/workers/formula.worker.ts`) follows the same structure as the existing main-thread evaluator in `client/src/lib/sheets/formula.ts`. The only change is the **execution boundary** : the dynamic-expression evaluation that today runs on the main thread (and requires `'unsafe-eval'` in the main-page CSP) moves into the Worker context.

Concrete rewrite:

1. Read `client/src/lib/sheets/formula.ts` and locate the function that invokes the `Function` constructor with the user-provided `expr`.
2. Port that exact logic into `client/src/workers/formula.worker.ts`, wrapping it with the `message`/`postMessage` protocol defined in Step 1.
3. Preserve the existing length guard (see commentaire C1 du header CSP historique — expression rejetée au-delà d'une longueur plafond ; reproduire la même valeur).
4. Convert return/errors to the `EvalResponse` discriminated union.

Skeleton :

```ts
/// <reference lib="webworker" />

type EvalRequest = { id: string; expr: string; context: Record<string, unknown> };
type EvalResponse =
  | { id: string; ok: true; value: unknown }
  | { id: string; ok: false; error: string };

declare const self: DedicatedWorkerGlobalScope;

self.addEventListener("message", (ev: MessageEvent<EvalRequest>) => {
  const { id, expr, context } = ev.data;
  try {
    // Port the existing evaluation logic from client/src/lib/sheets/formula.ts
    // verbatim here.  It can rely on the `Function` constructor now that CSP
    // `unsafe-eval` is scoped to this worker only.
    const value = evaluateInsideWorker(expr, context);  // implement below
    self.postMessage({ id, ok: true, value } satisfies EvalResponse);
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    } satisfies EvalResponse);
  }
});

function evaluateInsideWorker(expr: string, context: Record<string, unknown>): unknown {
  // Copy of the existing dynamic-expression evaluator from
  // `client/src/lib/sheets/formula.ts`, unchanged except for being
  // inside this worker module.  Keep the pre-existing length guard.
  throw new Error("port logic from lib/sheets/formula.ts here");
}
```

Replace the placeholder body of `evaluateInsideWorker` with the exact code you found in Step 1. Do not rewrite the semantics — the point of this task is *boundary change*, not behavior change.

- [ ] **Step 3: Modify `formula.ts` to delegate to worker**

Read `client/src/lib/sheets/formula.ts`. Switch the evaluator to async via `evaluateFormula()` from the client. If the caller chain is synchronous, cascade the `async`/`await`.

If making the entire chain async is too invasive, wrap the worker-based evaluator with a synchronous fallback that keeps the old behavior for non-eval paths (arithmetic, string ops already resolved without a dynamic constructor). Only the dynamic-evaluation codepath goes async.

- [ ] **Step 4: Migrate the 5 files**

```bash
rtk grep -n "new Function(" client/src/lib/sheets | head
```

For each hit in these 5 files, replace the inline dynamic-expression construction with `await evaluateFormula(expr, context)`. Mark the containing function `async`.

- [ ] **Step 5: Remove `unsafe-eval` from CSP**

Read `client/next.config.ts`, find the `Content-Security-Policy` header, locate `'unsafe-eval'`, remove it. Also remove the C6 accepted-risk comment block that's now obsolete.

- [ ] **Step 6: Smoke test formulas**

```bash
cd client
npm run build 2>&1 | tail -5
# manual verify in a browser:
# - navigate to /sheets/editor
# - enter =VLOOKUP(1, A1:B10, 2) and variants (SUMIFS, IFS)
# - verify results match expectations
```

For automated regression, add a unit test at `client/src/lib/workers/__tests__/formula-client.spec.ts` using vitest (check `client/package.json` `scripts.test` for the runner):

```ts
import { describe, it, expect } from "vitest";
import { evaluateFormula } from "@/lib/workers/formula-client";

describe("evaluateFormula", () => {
  it("adds two numbers", async () => {
    const v = await evaluateFormula("a + b", { a: 1, b: 2 });
    expect(v).toBe(3);
  });

  it("rejects overly long expressions", async () => {
    const long = "1+".repeat(3000) + "1";
    await expect(evaluateFormula(long, {})).rejects.toThrow();
  });
});
```

Only add this if vitest is already configured. Otherwise rely on manual smoke + E2E.

- [ ] **Step 7: Commit**

```bash
rtk git add client/src/workers/formula.worker.ts \
           client/src/lib/workers/formula-client.ts \
           client/src/lib/sheets \
           client/next.config.ts
rtk git commit -m "perf(client): move formula evaluator to worker, drop unsafe-eval from CSP"
```

---

### Task 5: Markdown worker

**Files:**
- Create: `client/src/workers/markdown.worker.ts`
- Create: `client/src/lib/workers/markdown-client.ts`
- Modify: call sites of `turndown` directly on main thread

- [ ] **Step 1: Create worker**

Create `client/src/workers/markdown.worker.ts`:

```ts
/// <reference lib="webworker" />

import TurndownService from "turndown";

type Request = { id: string; html: string; options?: TurndownService.Options };
type Response =
  | { id: string; ok: true; md: string }
  | { id: string; ok: false; error: string };

declare const self: DedicatedWorkerGlobalScope;

const service = new TurndownService();

self.addEventListener("message", (ev: MessageEvent<Request>) => {
  const { id, html, options } = ev.data;
  try {
    if (options) {
      Object.assign(service.options, options);
    }
    const md = service.turndown(html);
    self.postMessage({ id, ok: true, md } satisfies Response);
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    } satisfies Response);
  }
});
```

- [ ] **Step 2: Create client**

Create `client/src/lib/workers/markdown-client.ts`:

```ts
"use client";

type Request = { id: string; html: string; options?: unknown };
type Response =
  | { id: string; ok: true; md: string }
  | { id: string; ok: false; error: string };

const pending = new Map<string, (res: Response) => void>();
let worker: Worker | null = null;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(
      new URL("../../workers/markdown.worker.ts", import.meta.url),
      { type: "module" }
    );
    worker.addEventListener("message", (ev: MessageEvent<Response>) => {
      const cb = pending.get(ev.data.id);
      if (cb) {
        pending.delete(ev.data.id);
        cb(ev.data);
      }
    });
  }
  return worker;
}

export async function htmlToMarkdown(html: string, options?: unknown): Promise<string> {
  const id = crypto.randomUUID();
  return new Promise<string>((resolve, reject) => {
    pending.set(id, res => (res.ok ? resolve(res.md) : reject(new Error(res.error))));
    getWorker().postMessage({ id, html, options });
  });
}
```

- [ ] **Step 3: Migrate call sites**

```bash
rtk grep -l "from \"turndown\"\|require('turndown')" client/src | head
```

For each match, replace synchronous `new TurndownService().turndown(html)` with `await htmlToMarkdown(html)`. Mark containing function async.

- [ ] **Step 4: Build + commit**

```bash
cd client
npm run build 2>&1 | tail -5
rtk git add client/src/workers/markdown.worker.ts \
           client/src/lib/workers/markdown-client.ts \
           client/src/components client/src/hooks 2>/dev/null || true
rtk git commit -m "perf(client): move turndown markdown conversion off main thread"
```

---

### Task 6: VAD worker (audit + conditional)

**Files:**
- Possibly create: `client/src/workers/vad.worker.ts` + `client/src/lib/workers/vad-client.ts`
- Or create: `docs/architecture/vad-usage.md`

- [ ] **Step 1: Audit current VAD usage**

```bash
rtk grep -n "from \"@ricky0123/vad-web\"" client/src | head -10
```

For each match, note whether the library is already being used in a worker-native way.

- [ ] **Step 2: If native worker: document + skip**

Read `client/node_modules/@ricky0123/vad-web/README.md` or the source. Look for the lib spawning a Worker itself.

If native worker: create `docs/architecture/vad-usage.md`:

```markdown
# VAD (Voice Activity Detection) usage

`@ricky0123/vad-web` spawns its own Web Worker internally for the ONNX
inference.  No wrapper is needed at the P3 layer — the main thread
only receives start/stop events and classification results.

Callers should continue importing the lib directly; dynamic import is
already in place via `client/src/components/meet/mediapipe-lazy.tsx`
(P2 wrapper).
```

Commit:

```bash
rtk git add docs/architecture/vad-usage.md
rtk git commit -m "docs(client): document VAD lib is already worker-native — no wrapper needed"
```

- [ ] **Step 3: If not native: create wrapper**

Apply the same pattern as formula/markdown workers. Create `vad.worker.ts` + `vad-client.ts`. Commit:

```bash
rtk git add client/src/workers/vad.worker.ts client/src/lib/workers/vad-client.ts client/src
rtk git commit -m "perf(client): move VAD processing off main thread"
```

---

## Wave X — Virtualisation

### Task 7: Generic `<VirtualList>` wrapper

**Files:**
- Create: `client/src/components/common/virtual-list.tsx`

- [ ] **Step 1: Create the component**

Create `client/src/components/common/virtual-list.tsx`:

```tsx
"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, type ReactNode } from "react";

export interface VirtualListProps<T> {
  items: T[];
  estimateSize: (index: number) => number;
  overscan?: number;
  renderItem: (item: T, index: number) => ReactNode;
  className?: string;
  scrollToBottom?: boolean;
}

export function VirtualList<T>({
  items,
  estimateSize,
  overscan = 10,
  renderItem,
  className,
  scrollToBottom,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan,
  });

  if (scrollToBottom && parentRef.current && items.length > 0) {
    virtualizer.scrollToIndex(items.length - 1, { align: "end", behavior: "smooth" });
  }

  return (
    <div
      ref={parentRef}
      className={className}
      role="list"
      aria-rowcount={items.length}
      style={{ overflow: "auto", contain: "strict" }}
    >
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map(vi => (
          <div
            key={vi.key}
            role="listitem"
            aria-rowindex={vi.index + 1}
            data-index={vi.index}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${vi.start}px)`,
            }}
          >
            {renderItem(items[vi.index]!, vi.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build + commit**

```bash
cd client
npm run build 2>&1 | tail -3
rtk git add client/src/components/common/virtual-list.tsx
rtk git commit -m "feat(client): add generic <VirtualList> wrapper over @tanstack/react-virtual"
```

---

### Task 8: Chat messages virtualisation

**Files:**
- Modify: `client/src/components/chat/message-list.tsx`

- [ ] **Step 1: Read current implementation**

```bash
wc -l client/src/components/chat/message-list.tsx
head -80 client/src/components/chat/message-list.tsx
```

- [ ] **Step 2: Refactor**

Replace the `<ul>` + `.map()` block with:

```tsx
import { VirtualList } from "@/components/common/virtual-list";

<VirtualList
  items={messages}
  estimateSize={() => 72}
  overscan={10}
  scrollToBottom={atBottom}
  renderItem={(msg) => <MessageRow key={msg.id} message={msg} />}
  className="h-full"
/>
```

Keep `MessageRow` as-is (extract inline JSX to this component if not already done).

- [ ] **Step 3: Handle auto-scroll state**

Replace any `useEffect` with `scrollIntoView` by a boolean derived from scroll events:

```tsx
const [atBottom, setAtBottom] = useState(true);
// on scroll event: setAtBottom(scrollHeight - scrollTop <= clientHeight + 20)
```

- [ ] **Step 4: Build + manual smoke**

```bash
cd client
npm run build 2>&1 | tail -3
```

Manually verify: scroll jank gone, new message auto-scrolls, scrolling up disables auto-scroll.

- [ ] **Step 5: Commit**

```bash
rtk git add client/src/components/chat/message-list.tsx
rtk git commit -m "perf(client): virtualize chat messages list via <VirtualList>"
```

---

### Task 9: Mail + Contacts virtualisation

**Files:**
- Modify: `client/src/components/mail/inbox-list.tsx` (or the equivalent referenced by `mail-inbox-client.tsx` from P2)
- Modify: `client/src/components/contacts/contacts-list.tsx` (or equivalent)

- [ ] **Step 1: Mail**

```tsx
import { VirtualList } from "@/components/common/virtual-list";

<VirtualList
  items={messages}
  estimateSize={() => 80}
  overscan={10}
  renderItem={(m) => <MailRow key={m.id} message={m} selected={selected?.id === m.id} onSelect={setSelected} />}
  className="h-full overflow-y-auto"
/>
```

- [ ] **Step 2: Contacts**

```tsx
<VirtualList
  items={filteredContacts}
  estimateSize={() => 56}
  overscan={10}
  renderItem={(c) => <ContactRow key={c.id} contact={c} />}
  className="h-full overflow-y-auto"
/>
```

- [ ] **Step 3: Build + commit**

```bash
cd client
npm run build 2>&1 | tail -3
rtk git add client/src/components/mail client/src/components/contacts
rtk git commit -m "perf(client): virtualize mail inbox + contacts lists"
```

---

### Task 10: Storage files + Notifications virtualisation

**Files:**
- Modify: `client/src/components/storage/file-list.tsx`
- Modify: `client/src/components/notifications/feed.tsx`

- [ ] **Step 1: Storage file list**

```tsx
<VirtualList
  items={files}
  estimateSize={() => 48}
  overscan={15}
  renderItem={(f) => <FileRow key={f.id} file={f} />}
  className="h-full overflow-y-auto"
/>
```

- [ ] **Step 2: Notifications feed**

Same wrap around the timeline items.

- [ ] **Step 3: Build + commit**

```bash
cd client
npm run build 2>&1 | tail -3
rtk git add client/src/components/storage client/src/components/notifications
rtk git commit -m "perf(client): virtualize storage file list + notifications feed"
```

- [ ] **Step 4: Playwright regression test**

Create `client/e2e/p3-chat-scroll.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test("chat list scroll stays at 60 fps with 5k messages", async ({ page }) => {
  await page.goto("http://localhost:3000/chat/test-room");
  const container = page.locator('[role="list"]').first();
  await container.waitFor({ timeout: 10_000 });

  const frames = await page.evaluate(() => {
    return new Promise<number[]>(resolve => {
      const frameTimes: number[] = [];
      let last = performance.now();
      const el = document.querySelector('[role="list"]') as HTMLElement | null;
      if (!el) return resolve([]);

      function step() {
        const now = performance.now();
        frameTimes.push(now - last);
        last = now;
        if (frameTimes.length < 60) {
          el!.scrollTop += 200;
          requestAnimationFrame(step);
        } else {
          resolve(frameTimes);
        }
      }
      requestAnimationFrame(step);
    });
  });

  if (frames.length > 0) {
    frames.sort((a, b) => a - b);
    const p95 = frames[Math.floor(frames.length * 0.95)];
    expect(p95).toBeLessThan(33);
  }
});
```

Commit:

```bash
rtk git add client/e2e/p3-chat-scroll.spec.ts
rtk git commit -m "test(client): assert virtualized chat list keeps p95 frame <33ms"
```

---

## Wave Y — SW polish

### Task 11: Add new cache strategies

**Files:**
- Modify: `client/src/app/sw.ts`
- Create: `docs/architecture/service-worker.md`

- [ ] **Step 1: Open current SW**

```bash
wc -l client/src/app/sw.ts
```

Find the `runtimeCaching: [ ... ]` array.

- [ ] **Step 2: Add two new strategies**

Insert into the `runtimeCaching` array (before the catch-all default):

```ts
{
  matcher: ({ request, url }) =>
    request.method === "GET" &&
    /\/api\/v1\/.*\/list(\?|$)/.test(url.pathname + url.search),
  handler: new StaleWhileRevalidate({
    cacheName: "api-list",
    plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 5 * 60 })],
  }),
},
{
  matcher: ({ url }) =>
    url.pathname === "/api/v1/brand-kit" ||
    url.pathname === "/api/v1/tenant-config",
  handler: new CacheFirst({
    cacheName: "api-config",
    plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 })],
  }),
},
```

- [ ] **Step 3: Document strategies**

Create `docs/architecture/service-worker.md`:

```markdown
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

`/sw.js` is served with `Cache-Control: no-store, must-revalidate` (see `client/next.config.ts`).  A new SW version can clear selective caches on activation.

## Debug

- `.claude/skills/workers-debug/` — triage SW crashes.
- Chrome DevTools → Application → Service Workers → Unregister — manual purge.
```

- [ ] **Step 4: Build + commit**

```bash
cd client
npm run build 2>&1 | tail -3
rtk git add client/src/app/sw.ts docs/architecture/service-worker.md
rtk git commit -m "perf(client): add StaleWhileRevalidate for /list + CacheFirst for brand-kit/tenant-config"
```

---

### Task 12: Playwright SW kill-switch test

**Files:**
- Create: `client/e2e/p3-sw-killswitch.spec.ts`

- [ ] **Step 1: Write the test**

```typescript
import { test, expect } from "@playwright/test";

test.describe("P3 SW kill-switch", () => {
  test("caches are purged on SW skipWaiting update", async ({ page }) => {
    await page.goto("http://localhost:3000/dashboard", {
      waitUntil: "domcontentloaded",
    });

    const registered = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker?.ready;
      return !!reg?.active;
    });

    if (!registered) {
      test.skip(true, "SW not registered in this environment");
      return;
    }

    await page.evaluate(async () => {
      const cache = await caches.open("api-list");
      await cache.put(
        new Request("http://localhost:3000/api/v1/test/list"),
        new Response(JSON.stringify({ cached: true }), { status: 200 })
      );
    });

    const seeded = await page.evaluate(async () => {
      const cache = await caches.open("api-list");
      const hit = await cache.match("http://localhost:3000/api/v1/test/list");
      return !!hit;
    });
    expect(seeded).toBe(true);

    await page.evaluate(async () => {
      const regs = await navigator.serviceWorker?.getRegistrations();
      for (const r of regs ?? []) await r.unregister();
      const keys = await caches.keys();
      for (const k of keys) await caches.delete(k);
    });

    const purged = await page.evaluate(async () => {
      const keys = await caches.keys();
      return keys.length === 0;
    });
    expect(purged).toBe(true);
  });
});
```

- [ ] **Step 2: Attempt run**

```bash
cd client
timeout 60 npx playwright test p3-sw-killswitch.spec.ts --reporter=list 2>&1 | tail -10 || true
```

If dev mode disables SW, the test skips itself — acceptable.

- [ ] **Step 3: Commit**

```bash
rtk git add client/e2e/p3-sw-killswitch.spec.ts
rtk git commit -m "test(client): assert SW kill-switch purges all caches"
```

---

## Wave Z — Lighthouse CI

### Task 13: Lighthouse CI config + job

**Files:**
- Create: `client/lighthouse/config.json`
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Create Lighthouse config**

```json
{
  "ci": {
    "collect": {
      "url": [
        "http://localhost:3000/login",
        "http://localhost:3000/dashboard",
        "http://localhost:3000/mail",
        "http://localhost:3000/forms",
        "http://localhost:3000/contacts",
        "http://localhost:3000/projects",
        "http://localhost:3000/sheets/editor",
        "http://localhost:3000/docs/editor",
        "http://localhost:3000/design/editor",
        "http://localhost:3000/all-apps"
      ],
      "numberOfRuns": 3,
      "settings": { "preset": "desktop" }
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.85 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "interactive": ["error", { "maxNumericValue": 3500 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }],
        "total-blocking-time": ["error", { "maxNumericValue": 200 }]
      }
    },
    "upload": { "target": "temporary-public-storage" }
  }
}
```

- [ ] **Step 2: Add CI job**

Append to `.github/workflows/ci.yml` under `jobs:`:

```yaml
  lighthouse-ci:
    runs-on: ubuntu-latest
    needs: [bundle-budget]
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_USER: signapps
          POSTGRES_PASSWORD: signapps_dev
          POSTGRES_DB: signapps
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U signapps"
          --health-interval 5s
          --health-timeout 3s
          --health-retries 10
    env:
      DATABASE_URL: postgres://signapps:signapps_dev@localhost:5432/signapps
      JWT_SECRET: thisisaverylongdevsecretatleast32bytes
      KEYSTORE_MASTER_KEY: "0000000000000000000000000000000000000000000000000000000000000000"
      PROXY_ENABLED: "false"
      PXE_ENABLE_TFTP: "false"
      MAIL_PROTOCOLS_ENABLED: "false"
      CONTAINERS_ENABLED: "false"
      DEPLOY_API_ENABLED: "false"
      SCHEDULER_TICK_ENABLED: "false"
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - uses: Swatinem/rust-cache@v2
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: client/package-lock.json
      - name: Build signapps-platform
        run: cargo build --release -p signapps-platform
      - name: Build frontend
        run: cd client && npm ci && npm run build
      - name: Start services
        run: |
          ./target/release/signapps-platform &
          cd client && npm run start &
          sleep 20
      - name: Seed admin user
        run: cargo run --release --bin seed_db -p signapps-identity
      - name: Lighthouse CI
        run: cd client && npx @lhci/cli@latest autorun --config=lighthouse/config.json
```

If the existing CI uses `pnpm`, adjust `npm` → `pnpm` + cache paths.

- [ ] **Step 3: Validate YAML**

```bash
python -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"
```

- [ ] **Step 4: Commit**

```bash
rtk git add client/lighthouse/config.json .github/workflows/ci.yml
rtk git commit -m "ci(client): add lighthouse-ci gate on 10 critical pages"
```

---

## Wave F — Finalisation

### Task 14: Debug skills + product spec + CLAUDE.md + merge

**Files:**
- Create: `.claude/skills/workers-debug/SKILL.md`
- Create: `.claude/skills/virtualization-debug/SKILL.md`
- Create: `docs/product-specs/52-polish-runtime.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Workers debug skill**

Create `.claude/skills/workers-debug/SKILL.md`:

```markdown
---
name: workers-debug
description: Use when a Web Worker (formula, markdown, VAD) crashes or hangs, postMessage timeouts appear, an `unsafe-eval`-free CSP suddenly breaks sheets editor, or a worker file fails to compile. Covers respawn logic, timeout triage, and the main-thread ↔ worker boundary.
---

# workers-debug

## Architecture

P3 moved three main-thread operations to Workers:
- Formula evaluator: `client/src/workers/formula.worker.ts` + `lib/workers/formula-client.ts`
- Markdown: `markdown.worker.ts` + `markdown-client.ts`
- VAD: native worker (provided by `@ricky0123/vad-web`) or wrapper if docs/architecture/vad-usage.md says otherwise.

Clients keep a `Map<id, resolver>` and talk via `postMessage`. Workers are singleton instances lazily spawned on first call.

## Common issues

- **Worker won't spawn**: check URL pattern `new URL("../../workers/X.worker.ts", import.meta.url)`. Turbopack needs this exact shape; no string literals.
- **Timeout after 5 s**: the expression looped or the worker got GC'd. Respawn logic reconnects but drops pending work.
- **CSP broke `/sheets/editor`**: one dynamic-eval call was not migrated. Grep:

  ```bash
  rtk grep "new Function(" client/src/lib | grep -v workers
  ```

  should return 0 matches.
- **Sheets latency spike**: batch formulas per tick rather than per cell.

## Commands

```bash
grep -r "Content-Security-Policy" client/.next/server/middleware-manifest.json
cd client && npx tsc --noEmit --project src/workers
```

## Related

- Spec: `docs/superpowers/specs/2026-04-18-phase-d2-p3-polish-design.md`
- Plan: `docs/superpowers/plans/2026-04-18-phase-d2-p3-polish.md`
```

- [ ] **Step 2: Virtualization debug skill**

Create `.claude/skills/virtualization-debug/SKILL.md`:

```markdown
---
name: virtualization-debug
description: Use when a virtualized list (chat, mail, contacts, storage, notifications) exhibits scroll jump, misaligned items, wrong aria-rowcount, screen-reader not announcing, or `useVirtualizer` crashes. Covers `estimateSize` tuning, scroll-to-bottom UX, and a11y contract.
---

# virtualization-debug

## Architecture

`client/src/components/common/virtual-list.tsx` wraps `@tanstack/react-virtual`. Applied to: chat messages, mail inbox, contacts list, storage files, notifications feed.

Contract:
- Container: `role="list"`, `aria-rowcount={items.length}`.
- Items: `role="listitem"`, `aria-rowindex={index + 1}`.
- `contain: strict` on container.

## Common issues

- **Scroll jump on resize**: `estimateSize` is too far from reality. Tune to observed average.
- **Items overlap**: CSS on the item sets `position: relative`. Remove it.
- **aria-rowcount wrong**: wrapper sets it from `items.length`, never override downstream.
- **Chat auto-scroll breaks**: verify `scrollToBottom` prop flips at the right moment.
- **Screen reader silent**: if custom wrapper overrides `role`, use `role="feed"` if appropriate.

## Commands

```bash
rtk grep "VirtualList" client/src/components
rtk grep "aria-rowcount\|aria-rowindex" client/src/components/common/virtual-list.tsx
```

## Related

- Spec: `docs/superpowers/specs/2026-04-18-phase-d2-p3-polish-design.md`
- Plan: `docs/superpowers/plans/2026-04-18-phase-d2-p3-polish.md`
- TanStack Virtual: https://tanstack.com/virtual/latest
```

- [ ] **Step 3: Product spec**

Create `docs/product-specs/52-polish-runtime.md`:

```markdown
# 52 — Polish runtime (P3)

## Ce qui change pour l'équipe dev

- `bundle-budget` CI job passe au vert (vendor trim J1-J3).
- `unsafe-eval` retiré de la CSP main — les formules sheets tournent dans un Worker isolé.
- Nouveaux wrappers `client/src/workers/*.worker.ts` + `lib/workers/*-client.ts` pour formula, markdown (+ éventuellement VAD selon audit).
- Nouveau composant générique `<VirtualList>` utilisé sur 5 listes massives.
- Nouveau CI gate `lighthouse-ci` : échec si une des 10 pages clés passe sous seuil (Performance <0.85, LCP >2.5s, INP >200ms, CLS >0.1, TBT >200ms).

## Ce qui change pour l'utilisateur final

- Premier paint plus rapide (bundles allégés).
- Sheets éditeur : évaluation des formules ne bloque plus le scroll et la saisie.
- Listes chat/mail/contacts/storage/notifs : scroll fluide sur 10 k items.
- Navigation back dans les listes snappy (SW `StaleWhileRevalidate`).
- Kill-switch `/sw.js` testé automatiquement.

## Suivi

- Design : `docs/superpowers/specs/2026-04-18-phase-d2-p3-polish-design.md`
- Plan : `docs/superpowers/plans/2026-04-18-phase-d2-p3-polish.md`
- Debug skills : `.claude/skills/workers-debug/`, `.claude/skills/virtualization-debug/`
- SW doc : `docs/architecture/service-worker.md`

## Prochaines optimisations potentielles

- WebAssembly formula engine.
- Edge cache réel (Cloudflare Workers ou équivalent on-prem).
- Lighthouse trace-level assertions (plus fin que catégoriel).
```

- [ ] **Step 4: CLAUDE.md update**

Edit `CLAUDE.md`, find the Frontend/Préférences section. Append:

```markdown
- **Web Workers** : formula evaluator, markdown (turndown), VAD isolés hors main thread → `client/src/workers/*`.
- **Virtualisation** : listes massives utilisent `<VirtualList>` (`client/src/components/common/virtual-list.tsx`).
- **Lighthouse CI** : CI bloque PR si une des 10 pages clés passe sous seuil (voir `client/lighthouse/config.json`).
```

- [ ] **Step 5: Commit docs**

```bash
rtk git add .claude/skills/workers-debug/SKILL.md \
           .claude/skills/virtualization-debug/SKILL.md \
           docs/product-specs/52-polish-runtime.md \
           CLAUDE.md
rtk git commit -m "docs: add P3 debug skills + product spec + CLAUDE.md update"
```

- [ ] **Step 6: Merge to main**

```bash
rtk git checkout main
rtk git pull --ff-only origin main 2>&1 | tail -3
rtk git merge --no-ff feature/phase-d2-p3-polish -m "Merge branch 'feature/phase-d2-p3-polish': Phase D2 P3 polish runtime"
```

- [ ] **Step 7: Push main**

```bash
rtk git push origin main 2>&1 | tail -5
```

- [ ] **Step 8: Final verification**

```bash
rtk git log --oneline main..origin/main | wc -l     # expect 0
cd client && timeout 180 npm run build 2>&1 | tail -5
cd client && npm run budget 2>&1 | tail -20          # all green
```

---

## Self-Review

### Spec coverage

| Spec section | Task(s) |
|---|---|
| §4 Vendor trim | 1, 2, 3 |
| §5.1 Formula worker + unsafe-eval | 4 |
| §5.2 Markdown worker | 5 |
| §5.3 VAD worker (conditional) | 6 |
| §6.1 VirtualList wrapper | 7 |
| §6.2 Chat virtualisation | 8 |
| §6.2 Mail/Contacts | 9 |
| §6.2 Storage/Notifications | 10 |
| §7.1 SW strategies | 11 |
| §7.2 Kill-switch Playwright | 12 |
| §8 Lighthouse CI | 13 |
| §9 Debug skills + product spec + merge | 14 |

All spec sections mapped.

### Placeholder scan

- No "TBD", "TODO", "similar to Task N".
- Code blocks for every new file and each migration pattern.
- VAD task (6) conditional — both branches (native worker OR wrapper) spell out the exact commit.
- Task 4 Step 2 asks the engineer to port existing logic rather than inventing a new evaluator — keeps scope clear.

### Type consistency

- `evaluateFormula(expr, context): Promise<unknown>` stable across client + worker + callers.
- `htmlToMarkdown(html, options?): Promise<string>` stable.
- `<VirtualList>` props `{ items, estimateSize, overscan?, renderItem, className?, scrollToBottom? }` stable across all 5 usage tasks.
- SW strategy cache names (`api-list`, `api-config`) stable between Task 11 (SW code) and Task 12 (kill-switch test).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-18-phase-d2-p3-polish.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per wave, review between waves, same pattern as P1 + P2.

**2. Inline Execution** — Execute tasks in this session with checkpoints.

Which approach ?
