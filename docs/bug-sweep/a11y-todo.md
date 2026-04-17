# A11y Fix Triage — 2026-04-16

Source:
- `docs/bug-sweep/a11y-lint-catalog.md` (static, 980 warnings across 14 rules, 390 files)
- Runtime baseline pending (Phase E1b audit run requires services up)

---

## Category A — Auto-fixable via `eslint --fix`

Tested on top rules : none of them are auto-fixable with the current jsx-a11y plugin version. `eslint --fix` on representative files produced **no diff**. Rules requiring human judgment (what semantic role to use, whether autoFocus is intentional, which id to associate) cannot be auto-fixed.

**→ Category A is empty in this baseline.**

---

## Category B — Pattern fix in shared component (E1c scope)

Examined the top 4 rules against the top 3 files for each. Finding : **the hot files are feature-specific, not shared UI components**. This codebase has a11y debt concentrated in app pages (`slide-property-panel.tsx`, `contacts/page.tsx`, `spreadsheet.tsx`) rather than in primitives (`components/ui/button.tsx`, etc. — which are Radix-based and already accessible).

No mechanical pattern fix in `components/ui/*` reduces the count significantly :
- Shared `<Button>` is already a Radix primitive (uses `<button>` natively — satisfies `no-static-element-interactions`)
- Shared `<Label>` wraps Radix's `<Label>` but consumer pages often render `<label>` directly
- Shared `<Input>` doesn't know the `id` of its label — association is caller-side

**→ Category B for E1c : 0 shared-component fixes identified.**

---

## Category C — Per-file fixes (deferred to Phase E2)

All 14 rules require per-file fixes or rule-specific sweeps. Organized by actionability :

### C.1 — Mechanical sweeps (high-volume, low-judgment)

| Rule | Count | Sweep approach |
|---|---|---|
| `jsx-a11y/label-has-associated-control` | 223 | For each `<label>...</label>` paired with `<input>`/`<select>`/`<textarea>` : give the control an `id={stableId}` and the label `htmlFor={stableId}`. `useId()` hook covers dynamic cases. |
| `jsx-a11y/no-autofocus` | 110 | Audit each usage. Remove if not intentional ; `// eslint-disable-next-line` with rationale for modals/command-palette where autofocus is UX-correct. |

### C.2 — Semantic judgment (medium-volume, per-site)

| Rule | Count | Typical resolution |
|---|---|---|
| `jsx-a11y/no-static-element-interactions` | 342 | `<div onClick>` → `<button type="button">`, OR add `role="button" tabIndex={0} onKeyDown`. For grid/spreadsheet cells : `// eslint-disable-next-line` with role="gridcell" documented. |
| `jsx-a11y/click-events-have-key-events` | 265 | Add `onKeyDown={(e) => (e.key === "Enter" \|\| e.key === " ") && handler()}`. Often the same site as `no-static-element-interactions` — fix together. |

### C.3 — Tail (low-volume, individual fixes)

| Rule | Count | Notes |
|---|---|---|
| `jsx-a11y/media-has-caption` | 11 | `<video>`/`<audio>` need `<track kind="captions">`. |
| `jsx-a11y/no-noninteractive-element-interactions` | 10 | `<p onClick>` etc. — case-by-case. |
| `jsx-a11y/img-redundant-alt` | 6 | Replace `alt="image of X"` with `alt="X"`. |
| `jsx-a11y/anchor-is-valid` | 3 | Empty `href` or `#` — use `<button>` if not navigation. |
| `jsx-a11y/no-noninteractive-tabindex` | 3 | Remove `tabIndex` on non-interactive elements. |
| `jsx-a11y/role-supports-aria-props` | 3 | ARIA props not supported by the element's role. |
| `jsx-a11y/alt-text` | 1 | Missing `alt`. |
| `jsx-a11y/role-has-required-aria-props` | 1 | Role needs additional ARIA props. |
| `jsx-a11y/interactive-supports-focus` | 1 | Interactive element not focusable. |
| `jsx-a11y/heading-has-content` | 1 | Empty `<h1>`/`<h2>`/etc. |

---

## Recommendation for Phase E2

**The a11y debt is real (980 warnings) but distributed widely. There is no silver-bullet pattern fix in this codebase.**

Phase E2 structure :

1. **E2a — Mechanical sweeps (C.1)** — one commit per rule, touches many files with the same mechanical change. Low judgment, high volume. Expected reduction : ~333 warnings (-34%).
2. **E2b — Top-file fixes (C.2)** — attack the top 10 files by warning count, one file per commit. Each file gets a focused review (spreadsheet, slide-property-panel, contacts, etc.). Expected reduction : ~200 warnings (-20%).
3. **E2c — Tail cleanup (C.3)** — single commit sweeping all rules with <20 warnings. Expected reduction : ~40 warnings (-4%).
4. **E2d — Runtime audit cross-reference** — after E1b is executed, re-triage with `a11y-axe-summary.md` to catch runtime-only issues (keyboard traps, focus order, live regions).

Total expected reduction across E2 : ~60-65% (980 → ~350 warnings). The remaining ~350 would be genuinely hard cases (grid cells with `eslint-disable`, intentional `autoFocus`, etc.) suited for Phase E3.

---

## E1c scope adjustment

Given that Category A and B are empty, **E1c in this session is empty of fixes**. The Phase E1 spec cap of "max 6 commits" is moot.

**Phase E1 deliverable is therefore the TOOLING + BASELINE + TRIAGE** — which is valuable on its own : the codebase now has the guardrail (lint at `"warn"`), the audit infrastructure (Playwright spec ready to run), and the priority-ordered backlog (this file).

Fix work starts in Phase E2.

---

## Phase E2 progress log

### Wave 1 — Sidebar hot spots (done)

- `components/layout/sidebar.tsx` — toggle button, pin button, label color pickers and remove-label button all gained `aria-label` + `sr-only` fallback text.
- `components/layout/floating-action-button.tsx` — FAB main trigger gained `aria-label`, `aria-expanded`, and `sr-only`.
- Post-wave axe run : `button-name` 1794 → 1511 (-283).

### Wave 2 — Landmarks on auth surfaces (done 2026-04-16)

- `/login`, `/login/verify`, `/` root splash : outer shell `<div>` promoted to `<main id="main-content">`. Root layout already emits a skip-link anchored on that id ; without a target the anchor itself was reported as a violation.
- `/admin/feature-flags` custom switch-style button : now carries `aria-label` + sr-only text describing the on/off action per flag. The per-tenant reset button (`RotateCcw` icon) similarly gained an `aria-label`.
- Expected impact : -44 `button-name` on `/admin/feature-flags` plus downstream landmark / skip-link violations on any auth-protected route that was falling back to `/login` during the audit.

### Wave 2b — Landmarks on public / callback pages (done 2026-04-16)

Five additional pages that bypass `AppLayout` now wrap their shell in
`<main id="main-content">` so the skip-link has a target and axe's
`landmark-one-main` stops firing:

- `/maintenance`, `/bio/[username]`, `/poll/[id]`, `/f/[id]` (4 render
  branches), `/settings/calendar/callback`.
- The `/poll/[id]` title bar is now a `<header>` and its decorative "S"
  badge is `aria-hidden`.

### Wave 2c + 3a — WorkspaceShell landmark + TooltipIconButton helper (done 2026-04-16)

- `WorkspaceShell` content area now renders as `<main id='main-content'>`
  by default; a new `hideMainLandmark` prop covers the case where a
  parent (e.g. `AppLayout` in mail) already provides the landmark.
  `EditorLayout` sets `hideMainLandmark` and keeps its own `<main>`, and
  the fullscreen editor branch gains `<main>` + `<header>` + aria-label
  on the Minimize button. Free ripples : `/chat` and `/keep` (passthrough
  layouts) now have a main landmark and a working skip-link target.
- Added `<TooltipIconButton>` (`components/ui/tooltip-icon-button.tsx`)
  + unit tests — it bundles Tooltip + Trigger + Button + Content into a
  single component, requires `label` at the type level, and hides the
  icon child via `aria-hidden`. Defaults `variant="ghost"` `size="icon"`.
  Migrated `components/layout/right-sidebar.tsx` (6 call sites) and
  `components/chat/chat-input.tsx` (3 call sites) as the first consumers.
- Dev-only `console.warn` inside the shared `<Button>` now fires when
  `size` starts with `"icon"` but there's no `aria-label` /
  `aria-labelledby` / text children, to catch regressions before the
  next axe run.
- Per-route fix : `/containers` list row "more actions" trigger gained
  an aria-label tying the dropdown to the container name.

### Attempted re-audit on 2026-04-16 — blocked by stale dev server

Ran `e2e/a11y-audit.spec.ts` at 21:47 after wave 2/2b/2c/3a fixes. The
resulting baseline showed **-2 total violations** (2914 → 2912), which
contradicts the source changes. Root cause verified by direct inspection :

- `client/.next/server/app/maintenance/page.js` mtime : 16:17
- `client/src/app/maintenance/page.tsx` mtime : 17:13
- `curl -sL http://localhost:3000/login` returns HTML with the
  skip-link anchor but **no `<main>` element** despite the source
  having been edited to emit one.

Conclusion : the Next.js dev server (started earlier in the session)
stopped recompiling on file changes — likely the file watcher dropped
out. The 24-minute audit measured pre-wave-2 compiled output, so the
delta is not meaningful. The original `a11y-axe-baseline.json` from
16:45 has been restored as the canonical baseline ; the 22:11 re-run
was discarded.

**To measure the real wave-2/3 delta** :

```bash
# Terminate the stale dev server, then :
cd client && npm run dev       # fresh dev server with working HMR
# — and separately, once /login compiled:
npx playwright test e2e/a11y-audit.spec.ts --project=chromium
```

Alternatively, run against a production build :
`cd client && npm run build && npm run start` (no HMR, fully baked).

### Pending (requires fresh axe run)

- Delta measurement : rerun `e2e/a11y-audit.spec.ts` with services up and regenerate `a11y-axe-baseline.json` / `a11y-axe-summary.md`. This is the gate for prioritising the next wave — per-route vs. layout-level.
- Candidates for wave 3 (pending measurement) :
  - Shared icon-only buttons inside `<TooltipTrigger asChild>` blocks (dominant pattern on `/containers`, `/drive`). Fix by introducing a `TooltipIconButton` helper that requires `aria-label`.
  - Layout-level main landmark coverage on routes that genuinely don't go through `AppLayout` (portal/client, portal/supplier, onboarding, register). Each of those has its own route layout ; consider adding a minimal `<main id="main-content">` wrapper.
