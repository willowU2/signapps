---
name: workers-debug
description: Use when a Web Worker (formula, markdown, VAD) crashes or hangs, postMessage timeouts appear, an `unsafe-eval`-free CSP suddenly breaks sheets editor, or a worker file fails to compile. Covers respawn logic, timeout triage, and the main-thread ↔ worker boundary.
---

# workers-debug

## Architecture

P3 introduced worker infrastructure (`client/src/workers/*.worker.ts` + `client/src/lib/workers/*-client.ts`) for:
- Formula evaluator (formula.worker.ts + formula-client.ts) — infrastructure ready; note that the main-thread evaluator was rewritten as a pure recursive-descent parser (`MathParser` in `lib/sheets/formula.ts`), so sheets runtime does NOT currently postMessage. The worker is used for future off-main-thread recalc.
- Markdown (markdown.worker.ts + markdown-client.ts) — actively used by `docs/editor.tsx` export + live split view.
- VAD — library is worker-native, no wrapper (see `docs/architecture/vad-usage.md`).

Clients keep a `Map<id, resolver>` and talk via `postMessage`. Workers are singleton instances lazily spawned on first call.

## Common issues

- **Worker won't spawn**: check URL pattern `new URL("../../workers/X.worker.ts", import.meta.url)`. Turbopack requires this exact shape; no string literals.
- **Timeout after 5 s**: the operation looped or the worker got GC'd. Respawn logic reconnects but drops pending work.
- **CSP broke `/sheets/editor`**: the main-thread parser is pure (no dynamic eval). If `unsafe-eval` was needed in the built CSP, a regression introduced a dynamic-eval call somewhere. Grep for dynamic code constructors (`new` + `Function(`) outside `workers/` — there should be 0 matches.
- **Markdown export lag**: the worker is single-threaded and turndown is fast; >200 ms means the worker was just spawned (first call) or the HTML is huge. Batch where possible.

## Commands

```bash
grep -r "Content-Security-Policy" client/.next/routes-manifest.json | grep -o "unsafe-eval" | head  # should be empty
cd client && npx tsc --noEmit
```

## Related

- Spec: `docs/superpowers/specs/2026-04-18-phase-d2-p3-polish-design.md`
- Plan: `docs/superpowers/plans/2026-04-18-phase-d2-p3-polish.md`
