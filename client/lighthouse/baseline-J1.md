# Bundle audit — J1 2026-04-18

Baseline recorded before Wave V vendor trim. All 283 routes fail the
per-route gzipped budget — the bundle is dominated by a 172.9 kB
gzipped shared chunk that is eagerly loaded on every page.

## Build environment

- Next.js 16.1.7 with Turbopack (production)
- `ANALYZE=true npm run build` — `@next/bundle-analyzer` does **not** emit
  an HTML report under Turbopack, so this audit relies on
  `.next/diagnostics/route-bundle-stats.json` and per-chunk gzip sizing
  (`scripts/top-chunks.js`) instead of the Webpack client.html viewer.

## Top budget violations

| Route                     | Gzipped   | Budget | Utilization |
| ------------------------- | --------- | ------ | ----------- |
| `/dashboard`              | 892.7 kB  | 400 kB | 223%        |
| `/slides/editor`          | 1026.5 kB | 500 kB | 205%        |
| `/chat`                   | 957.0 kB  | 500 kB | 191%        |
| `/tasks`                  | 953.2 kB  | 500 kB | 191%        |
| `/admin/roles`            | 936.9 kB  | 500 kB | 187%        |
| `/docs`                   | 907.1 kB  | 500 kB | 181%        |
| `/settings/notifications` | 878.8 kB  | 500 kB | 176%        |
| `/settings/calendar`      | 878.1 kB  | 500 kB | 176%        |
| `/keep`                   | 869.2 kB  | 500 kB | 174%        |
| `/design`                 | 867.4 kB  | 500 kB | 173%        |
| `/`                       | 393.7 kB  | 250 kB | 157%        |

100% of the 283 routes in `route-bundle-stats.json` currently fail.

## Top shared chunks (>10 routes)

Total shared gzipped payload: **883.1 kB**.

| Route count | Gzipped  | Raw    | Chunk                               |
| ----------- | -------- | ------ | ----------------------------------- |
| 265         | 172.9 kB | 719 kB | `0-gjxec4kjcmv.js` (framework-wide) |
| 11          | 78.9 kB  | 267 kB | `0n9vaqjcsc_88.js`                  |
| 283         | 62.4 kB  | 199 kB | `03lypjg3v-ug_.js` (global)         |
| 283         | 56.7 kB  | 250 kB | `0g.ayd00-0e2u.js` (global)         |
| 12          | 43.0 kB  | 131 kB | `10i079nk1~y.e.js`                  |
| 283         | 36.3 kB  | 134 kB | `14j.~72d2~9g1.js` (global)         |
| 16          | 31.3 kB  | 105 kB | `0i33dr6x12q_2.js`                  |
| 147         | 31.2 kB  | 105 kB | `0j5d-cacv0fqc.js`                  |
| 11          | 30.9 kB  | 105 kB | `0u-nkqa.qf2_..js`                  |
| 283         | 24.7 kB  | 85 kB  | `0gilw3vvyvtbk.js` (global)         |

The top chunk contains ~4723 "path", 415 "circle", 326 "rect", 135 "line"
string literals — strong fingerprint for icon packs + chart libraries
bundled globally.

## Heavy root-level dependencies (`package.json`)

Loaded globally via `providers.tsx`, `command-bar.tsx` or similar shared
components:

- `framer-motion` + `motion` (two copies of the same lib — duplicate)
- `recharts`, `@xyflow/react`, `tldraw`, `fabric`
- `lucide-react` (icon-heavy)
- `@tauri-apps/api` + `@tauri-apps/plugin-shell` (only useful inside a
  Tauri shell, currently zero `src/**` imports — never actually
  consumed, but the package is still in the graph)
- `livekit-client`, `@livekit/components-react`
- `@mediapipe/selfie_segmentation`, `@ricky0123/vad-web`
- `pptxgenjs`, `exceljs`, `docx`, `mammoth`, `html-to-docx`, `react-pdf`
- `emoji-picker-react`, `react-email-editor`, `react-grid-layout`
- `xterm` + `@xterm/addon-*`, `fuse.js`

## Prune candidates (ranked)

1. `@tauri-apps/*` — zero `src/**` imports today. Gate future usage via
   `isTauri()` helper so the packages stay out of the graph unless we
   run in a Tauri shell (Task 2).
2. `framer-motion` vs `motion` — same vendor, both included. Dedup to
   one (Task 3).
3. `lodash` is NOT in `package.json` — already pruned.
4. `date-fns` is the sole date library (no `moment`/`luxon`/`dayjs`).
5. `recharts` / `@xyflow/react` / `tldraw` / `fabric` / `pptxgenjs` /
   `exceljs` / `mammoth` / `react-pdf` / `livekit-client` — verify they
   are lazy-loaded on their destination routes and not eagerly pulled
   into the global chunk via a top-level import.
