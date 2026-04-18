# Phase D2 · P2 — Frontend perf (Turbopack + RSC + dynamic imports) — Design Spec

**Date :** 2026-04-18
**Statut :** Design validé, prêt pour writing-plans
**Auteurs :** Brainstorming Claude + Étienne
**Référence interne :** suite de `2026-04-18-phase-d2-architectural-perf-design.md` §5 et de `2026-04-18-phase-d2-p1-single-binary.md` (P1 livrée)

---

## 1. Contexte & Objectifs

### 1.1 Problème constaté (2026-04-18)

Les logs `next dev --webpack` (Next.js 16.2.3, `client/package.json`) montrent des premiers rendus catastrophiques :

| Route | Compile initial | Next.js pur | App code |
|---|---|---|---|
| `/dashboard` | 13.1 s | 11.7 s | 1.36 s |
| `/whiteboard` | 4.3 s | 3.4 s | 0.88 s |
| `/sheets/editor` | 9.5 s | 9.4 s | 0.18 s |
| `/design/editor` | 7.5 s | 7.4 s | 0.12 s |

Revisite après compile : 40-100 ms. Le coût est 100 % dans le bundling webpack première passe.

Taille codebase : 282 pages Next.js, 1455 composants, 83 clients API. Dépendances lourdes chargées dans le bundle initial : Tiptap (20+ extensions), `@livekit/components-react`, `@mediapipe/selfie_segmentation`, Monaco (via `@monaco-editor/react`), `@tanstack/react-virtual`, `@radix-ui/*`, `@base-ui-components/react`, `@tauri-apps/*`.

Aucune page actuelle n'utilise React Server Components ni Server Actions : tout est client-side pur.

### 1.2 Causes racines

| Symptôme | Cause |
|---|---|
| Premier rendu 5-13 s | `next dev --webpack` au lieu de `--turbopack` |
| Bundle initial tout-en-un | Pas de dynamic imports systématiques sur deps lourdes ; tout chargé dès `/` |
| Pages data-heavy lentes au TTI | Fetch + render 100 % client, pas de streaming HTML |

### 1.3 Objectifs mesurables

| Axe | Baseline (2026-04-18) | Cible |
|---|---|---|
| First compile `/dashboard` (dev) | 13.1 s | **< 1 s** |
| First compile `/sheets/editor` (dev) | 9.5 s | **< 1 s** |
| Bundle initial `/` (gzip) | non mesuré | **< 250 kB** |
| Bundle routes éditeur (gzip) | non mesuré | **< 800 kB** |
| LCP pages RSC migrées (Lighthouse) | non mesuré | **-30 %** vs baseline |
| Régression fonctionnelle | — | **0** (tous E2E Playwright passent) |

### 1.4 Non-goals

- Pas de Web Workers (reporté en P3).
- Pas de refactor du Service Worker Serwist (P3).
- Pas de migration Monaco / Tiptap / LiveKit vers un autre outil.
- Pas de refactor des stores Zustand.
- Pas d'edge runtime (on reste on-prem + Tauri).
- Pas de virtualisation systématique des listes (P3).

---

## 2. Paramètres validés

| Axe | Choix |
|---|---|
| Niveau | **B — Standard 2 semaines** (alignée spec parent §5) |
| Ordonnancement | **B.1 Turbopack-first** (débloque le dev cycle en J1-J2, puis itérations rapides) |
| Gouvernance | **Auto-chain** (cf. `feedback_auto_chain.md`) — une étape enchaîne la suivante après tests verts |
| Métriques | Quantitatives : `npm run analyze` budget CI, Playwright cold-compile bench, Lighthouse manual sur RSC pages |
| Compat prod | Inchangée (Turbopack = dev uniquement ; `next build` reste webpack jusqu'au feu vert Turbopack prod) |

---

## 3. Architecture cible

```
Next.js 16.2.3 + Turbopack (dev) + RSC hybride
├── app/
│   ├── dashboard/page.tsx                 (RSC, streaming)
│   ├── mail/inbox/page.tsx                (RSC shell + ClientIslands)
│   ├── forms/page.tsx                     (RSC list + ClientActions)
│   ├── contacts/page.tsx                  (RSC list)
│   ├── projects/page.tsx                  (RSC list)
│   ├── docs/editor/page.tsx               (client, dynamic(Tiptap))
│   ├── sheets/editor/page.tsx             (client, dynamic(Monaco))
│   ├── design/editor/page.tsx             (client, dynamic(Tiptap+tools))
│   ├── meet/[code]/page.tsx               (client, dynamic(LiveKit+MediaPipe))
│   └── layout.tsx                         (client boundary au-dessus de providers)
├── components/
│   ├── editor/tiptap-lazy.tsx             (dynamic wrapper)
│   ├── editor/monaco-lazy.tsx             (dynamic wrapper)
│   ├── meet/livekit-lazy.tsx              (dynamic wrapper)
│   ├── meet/mediapipe-lazy.tsx            (dynamic wrapper)
│   └── providers.tsx                      ("use client" — stores Zustand, QueryClient)
└── lib/
    ├── server/                            (nouveau — fetch server-side pour RSC)
    │   ├── dashboard.ts
    │   ├── mail.ts
    │   ├── forms.ts
    │   ├── contacts.ts
    │   └── projects.ts
    └── api/                               (existing, client-side axios)
```

---

## 4. Étape 1 — Turbopack (J1-J2)

### 4.1 Bascule

`client/package.json` :

```diff
- "dev": "next dev --webpack",
+ "dev": "next dev --turbopack",
```

Purge du cache `.next` local et du cache Serwist (désactivé en dev, donc pas de risque).

### 4.2 Validation

- `npm run dev` démarre en < 500 ms (Turbopack typique).
- Premier hit `/dashboard`, `/sheets/editor`, `/design/editor`, `/mail/inbox` compile en < 1 s.
- Tous les éditeurs (Tiptap, Monaco, LiveKit) se rendent sans erreur de build.
- Formula evaluator (`client/src/lib/sheets/formula.ts`) utilise `Function()` runtime — doit continuer à fonctionner (Turbopack ne casse pas les appels runtime).

### 4.3 Fallback

Si Turbopack casse une dep spécifique :

1. Documenter l'incompatibilité (issue upstream si nécessaire).
2. Scope fallback webpack sur la route problématique via `experimental.turbo.rules` (si Next 16 le permet).
3. Dernier recours : revert `--turbopack` en attendant un fix, documenter dans `docs/architecture/frontend-perf.md`.

### 4.4 Tests

- Playwright E2E complet (revalide comportement fonctionnel).
- Smoke manuel des 10 pages critiques.
- Pas de test unitaire spécifique à Turbopack (l'outil est configuré, pas intégré dans notre code).

---

## 5. Étape 2 — Dynamic imports (J3-J4)

### 5.1 Wrappers dédiés

Créer un wrapper par dépendance lourde, encapsulé avec skeleton de chargement :

```tsx
// client/src/components/editor/tiptap-lazy.tsx
"use client";
import dynamic from "next/dynamic";

export const TiptapEditor = dynamic(
  () => import("./tiptap-editor").then(m => m.TiptapEditor),
  {
    ssr: false,
    loading: () => <EditorSkeleton />,
  }
);
```

Cibles (ordre de priorité par poids bundle) :

| Wrapper | Dep | Routes consommatrices |
|---|---|---|
| `tiptap-lazy.tsx` | `@tiptap/*` (20+ ext) | `/docs/*`, `/mail/composer`, `/design/editor` |
| `livekit-lazy.tsx` | `@livekit/components-react`, `@livekit/components-styles` | `/meet/*` |
| `mediapipe-lazy.tsx` | `@mediapipe/selfie_segmentation`, `@ricky0123/vad-web` | `/meet/*` (fond virtuel, VAD) |
| `monaco-lazy.tsx` | `@monaco-editor/react`, `monaco-editor` | `/sheets/editor`, `/ai/documents` (code cell) |

### 5.2 Migration des call sites

Grep `from "@tiptap/` / `from "@livekit` / `from "@mediapipe` / `from "monaco` / `from "@monaco-editor` dans `client/src/**/*.{ts,tsx}`. Remplacer chaque import direct par l'import du wrapper lazy.

Exception : les hooks qui référencent uniquement les types Tiptap (`EditorOptions`, `Extension`) peuvent garder l'import direct — ces types sont tree-shaken au build.

### 5.3 Prefetch intelligent

Sur les liens de menu qui mènent à une route éditeur (`<Link href="/docs/editor">Nouveau document</Link>`), déclencher `router.prefetch("/docs/editor")` au hover ou à l'apparition en viewport. Minimise le lag perçu à l'ouverture.

### 5.4 Tests

- `npm run analyze` : vérifier que les deps lourdes apparaissent dans des **chunks distincts**, pas dans le bundle initial.
- Playwright : scénario « ouvrir `/docs/editor`, attendre `<TiptapEditor />` visible, assert latence < 2 s sur machine typique ».

---

## 6. Étape 3 — `optimizePackageImports` + CI budget (J5-J6)

### 6.1 Next config

`client/next.config.ts` :

```ts
experimental: {
  optimizePackageImports: [
    "@tiptap/core", "@tiptap/react", "@tiptap/starter-kit",
    "@radix-ui/react-alert-dialog", "@radix-ui/react-checkbox",
    "@radix-ui/react-popover", "@radix-ui/react-progress",
    "@base-ui-components/react",
    "@livekit/components-react",
    "@tanstack/react-query",
    "lucide-react",
    "date-fns",
  ],
},
```

Cette option fait que Next.js n'importe que les symboles effectivement utilisés — réduit le bundle initial sans code change.

### 6.2 CI budget

Nouveau job GitHub Actions `bundle-budget` :

```yaml
  bundle-budget:
    runs-on: ubuntu-latest
    needs: [frontend]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: cd client && npm ci
      - run: cd client && ANALYZE=true npm run build
      - name: Assert budgets
        run: |
          # Parse .next/analyze/client.json
          node scripts/check-bundle-budget.js
```

Script `client/scripts/check-bundle-budget.js` :

```js
// Fail if any route exceeds its gzipped budget.
const budgets = {
  "/": 250 * 1024,
  "/dashboard": 400 * 1024,
  "/docs/editor": 800 * 1024,
  "/sheets/editor": 800 * 1024,
  "/design/editor": 800 * 1024,
  "/meet/[code]": 800 * 1024,
  // default for all others
  "*": 500 * 1024,
};
```

### 6.3 Override

Label PR `perf-budget-exception` permet de bypass le job temporairement, documenté dans `docs/runbooks/bundle-budget.md`.

---

## 7. Étape 4 — RSC migration (J7-J12)

### 7.1 Pages candidates (ordre)

| Page | Pattern | Priorité |
|---|---|---|
| `/dashboard` | Stats + graphes | **Pilote J7-J8** |
| `/mail/inbox` | Liste top + viewer | J9 |
| `/forms` | Liste formulaires + stats | J9 |
| `/contacts` | Liste paginée | J10 |
| `/projects` | Liste + filtres | J11 |

Autres pages candidates (à faire si temps reste J12) : `/social/analytics`, `/calendar/week`.

### 7.2 Pattern

```tsx
// client/src/lib/server/dashboard.ts
import { cookies } from "next/headers";
export async function fetchDashboardStats() {
  const token = cookies().get("auth_token")?.value;
  const res = await fetch("http://localhost:3001/api/v1/dashboard/stats", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error("dashboard stats fetch failed");
  return res.json();
}

// client/src/app/dashboard/page.tsx (Server Component by default)
import { fetchDashboardStats } from "@/lib/server/dashboard";
import { ClientCharts } from "./client-charts";

export default async function DashboardPage() {
  const stats = await fetchDashboardStats();
  return (
    <main>
      <h1>Dashboard</h1>
      <DashboardShell stats={stats}>
        <ClientCharts data={stats.series} />
      </DashboardShell>
    </main>
  );
}

// client/src/app/dashboard/client-charts.tsx
"use client";
import { LineChart } from "recharts";
export function ClientCharts({ data }: { data: Series[] }) { /* ... */ }
```

### 7.3 Règles de migration

- **Tout ce qui lit `window`, `localStorage`, `document`** → composant client (`"use client"`).
- **Les stores Zustand** → client uniquement (déjà dans `components/providers.tsx`).
- **`@tanstack/react-query`** → client uniquement (hydration via `HydrationBoundary` si besoin).
- **Fetch serveur** → `lib/server/*.ts` avec `cookies()` pour JWT. Pas d'axios.
- **Types** : séparer `types/server.ts` et `types/client.ts` si besoin pour éviter imports client → server.

### 7.4 Découverte des composants non-RSC-safe

Grep avant migration :

```
rtk grep "window\.\|localStorage\|document\.\|sessionStorage" client/src/app/<page-à-migrer>
```

Pour chaque match, vérifier si le composant est top-level (à rendre client) ou s'il peut être isolé dans une sous-branche client.

### 7.5 Tests

- Playwright E2E sur chaque page migrée (aucune régression).
- Lighthouse manuel sur chaque page migrée — assert LCP -30 %.
- Test d'intégration Playwright dédié : ouvrir `/dashboard` avec throttling 3G, assert TTFB < 500 ms (RSC stream), LCP < 2.5 s.

---

## 8. Data flow

### 8.1 RSC pages

1. Requête HTTP arrive sur Next serveur.
2. Page Server Component exécute `fetchXxx()` via `lib/server/*.ts`.
3. JWT lu depuis cookies via `next/headers`.
4. Réponse HTTP streaming HTML vers le navigateur.
5. Îlots `"use client"` hydratent progressivement (React 19 streaming).

### 8.2 Client pages (éditeurs, meet)

1. Navigation client-side (Next Link) vers la route éditeur.
2. Skeleton rendu immédiatement (loading prop de `dynamic`).
3. Chunk de l'éditeur téléchargé en background (prefetch si lien visité).
4. Hydration de l'éditeur, state Zustand restauré, API calls axios standard.

### 8.3 Service Worker

Reste désactivé en dev (Serwist). Prod build inchangé par P2. Stratégies de cache SW restent en P3.

---

## 9. Error handling

- **RSC fetch fail** → `app/<route>/error.tsx` (Next.js boundary) + `tracing::error!` côté serveur.
- **Dynamic import fail** (réseau, chunk corruption) → `loading` skeleton reste affiché + error boundary React catch + button retry.
- **Turbopack incompat runtime** → err dans la console, dev fallback webpack par route (si Next 16 le permet) ou revert global temporaire.
- **Bundle budget CI fail** → PR bloquée, override via label `perf-budget-exception` documenté.

---

## 10. Testing

| Couche | Test | Cible |
|---|---|---|
| Étape 1 | Playwright E2E existants | Aucune régression |
| Étape 1 | Manual smoke 10 pages critiques | Compile < 1 s |
| Étape 2 | `npm run analyze` baseline | Chunks distincts pour Tiptap/LiveKit/MediaPipe/Monaco |
| Étape 2 | Playwright `docs-editor.spec.ts` | `<TiptapEditor />` visible < 2 s |
| Étape 3 | CI `bundle-budget` job | Tous budgets respectés |
| Étape 4 | Playwright pour chaque page RSC migrée | Aucune régression fonctionnelle |
| Étape 4 | Playwright `dashboard-rsc.spec.ts` | TTFB < 500 ms (throttled 3G), LCP < 2.5 s |
| Étape 4 | Lighthouse manuel | LCP -30 % vs baseline pre-RSC |

---

## 11. Risques & mitigations

| Risque | Proba | Impact | Mitigation |
|---|---|---|---|
| Turbopack casse Monaco workers | Moyen | Moyen | Monaco déjà dynamic, rebuild workers via `monaco-editor-webpack-plugin` si nécessaire |
| Serwist + Turbopack conflict en prod build | Faible | Faible | Prod reste `next build` webpack (inchangé P2) |
| RSC casse composants lisant `window` au render | Moyen | Moyen | Audit grep avant migration, `"use client"` strict, migration progressive par page |
| Bundle budget bloque feature PR urgente | Faible | Faible | Label `perf-budget-exception` + doc runbook |
| Tiptap dynamic loading rend éditeur laggy | Faible | Moyen | `router.prefetch` sur liens menu + skeleton < 200 ms |
| `lib/server/*` leak serveur credentials dans bundle client | Faible | Élevé | Convention stricte : `lib/server/*` NE DOIT PAS être importé depuis `components/` ou `app/*/client-*.tsx` ; lint custom |
| `optimizePackageImports` casse tree-shaking d'une lib | Faible | Moyen | Tester chaque lib ajoutée à la liste ; retirer si régression |

---

## 12. Séquencement & livraison

**Auto-chain** (cf. `feedback_auto_chain.md`) : après approbation initiale, enchaînement sans go/no-go intermédiaire ; stop uniquement sur blocker réel.

```
J1   : Bascule --turbopack + purge cache + smoke dev
J2   : Playwright E2E revalidation Turbopack
J3   : Wrapper tiptap-lazy + migration 15 fichiers consommateurs
J4   : Wrappers livekit-lazy, mediapipe-lazy, monaco-lazy + migration
J5   : optimizePackageImports + baseline npm run analyze
J6   : CI job bundle-budget + script check-bundle-budget.js
J7-8 : RSC /dashboard (pilote) + lib/server/dashboard.ts + ClientCharts
J9   : RSC /mail/inbox + /forms
J10  : RSC /contacts
J11  : RSC /projects
J12  : Buffer / extra pages (/social/analytics, /calendar/week)
J13  : Playwright dashboard-rsc.spec.ts + Lighthouse manual pass
J14  : Review + commits batch + merge feature branch
```

Commits à chaque étape (Conventional Commits) : `feat(client): turbopack bascule`, `perf(client): lazy Tiptap editor`, `perf(client): RSC /dashboard`, etc.

Update des `product-specs` et du debug skill `turbopack-debug` à chaque commit (cf. `feedback_commit_workflow.md` + `feedback_feature_spec_workflow.md`).

**Debug skills à créer** (cf. `feedback_feature_spec_workflow.md`) :
- `.claude/skills/turbopack-debug/` — triage incompat build, fallback webpack route-ciblé, invalidation cache.
- `.claude/skills/rsc-migration-debug/` — diagnostiquer composants qui cassent au render serveur, grep `window`/`localStorage`, séparer client/server modules.

**Product-spec** à créer : `docs/product-specs/51-perf-frontend.md` (miroir produit de ce design technique).

---

## 13. Références

- Spec parent : `docs/superpowers/specs/2026-04-18-phase-d2-architectural-perf-design.md` §5.
- Plan P1 (livré) : `docs/superpowers/plans/2026-04-18-phase-d2-p1-single-binary.md`.
- Follow-ups P1 : `docs/superpowers/plans/2026-04-18-phase-d2-p1-followups.md`.
- `CLAUDE.md` — conventions TypeScript/Frontend.
- `feedback_design_patterns.md` — patterns GoF applicables (Facade, Strategy pour wrappers lazy).
- Next.js Turbopack docs : https://nextjs.org/docs/app/api-reference/turbopack
- React Server Components : https://nextjs.org/docs/app/building-your-application/rendering/server-components
- Bundle analyzer : `@next/bundle-analyzer` (déjà en dep)
