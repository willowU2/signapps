# Phase D2 · P3 — Polish runtime (vendor trim + Workers + virtualisation + SW + Lighthouse) — Design Spec

**Date :** 2026-04-18
**Statut :** Design validé, prêt pour writing-plans
**Auteurs :** Brainstorming Claude + Étienne
**Référence interne :** suite de `2026-04-18-phase-d2-architectural-perf-design.md` §6 + follow-up de `2026-04-18-phase-d2-p2-frontend-design.md` §14

---

## 1. Contexte & Objectifs

### 1.1 État après P1 + P2 livrés

- Backend single-binary opérationnel, cold start ~1.7 s.
- Frontend Turbopack + 5 pages RSC + dynamic imports des deps lourdes.
- **Follow-up P2 critique** : 9/10 routes dépassent le budget gzipped (CI `bundle-budget` red). Principal coupable : un vendor chunk commun ~650 kB partagé par presque toutes les routes.
- `unsafe-eval` reste dans la CSP à cause d'un évaluateur d'expressions dynamiques dans 5 fichiers sheets (formula evaluator côté main thread).
- Listes chat/mail/contacts/storage sans virtualisation (1 seul usage actuel de `@tanstack/react-virtual` dans tout le codebase).
- Service Worker Serwist **déjà sophistiqué** (BackgroundSync mutations, CacheFirst/NetworkFirst/StaleWhileRevalidate, ExpirationPlugin) — pas à réécrire, à étendre.
- Pas de Lighthouse CI.

### 1.2 Objectifs mesurables

| Axe | Baseline (post P2) | Cible |
|---|---|---|
| `bundle-budget` CI job | ROUGE (9/10 routes over) | **VERT** |
| Bundle `/` gzip | ~394 kB | **< 250 kB** |
| Bundle `/dashboard` gzip | ~893 kB | **< 400 kB** |
| `unsafe-eval` CSP | présent | **retiré** |
| Listes virtualisées | 1 / ~8 cibles | **8 / 8** |
| Lighthouse Performance score (10 pages) | non mesuré | **≥ 85 p50** |
| LCP pages critiques | non mesuré | **< 2.5 s** |
| INP interactions clés | non mesuré | **< 200 ms** |
| CLS | non mesuré | **< 0.1** |
| SW kill-switch test | manuel | **automatisé Playwright** |

### 1.3 Non-goals

- Pas de PWA install prompt custom.
- Pas de offline-first total (BackgroundSync suffit pour mutations).
- Pas de WebAssembly formula engine.
- Pas de remplacement de recharts / Monaco / Tiptap.
- Pas d'edge runtime externe (on-prem + Tauri).
- Pas de refactor store Zustand.

---

## 2. Paramètres validés

| Axe | Choix |
|---|---|
| Scope | **B — P3 étendu avec vendor trim en préfixe** (2.5 sem, 14 jours) |
| Ordonnancement | **B.1 Vendor-first** — CI green en J3, puis Workers + virtualisation + SW + Lighthouse |
| Gouvernance | **Auto-chain** (une étape enchaîne la suivante après tests verts) |
| Métriques | Quantitatives : `npm run budget`, Lighthouse CI, Playwright SW kill-switch |
| Compat prod | SW stratégies restent backward-compatible (kill-switch via `/sw.js` no-store) |

---

## 3. Architecture cible

```
client/
├── src/
│   ├── workers/                          (nouveau)
│   │   ├── formula.worker.ts             (évaluateur isolé dans worker)
│   │   ├── markdown.worker.ts            (turndown off main thread)
│   │   └── vad.worker.ts                 (VAD off main thread — si pas déjà natif)
│   ├── lib/
│   │   ├── workers/                      (clients main-thread, postMessage wrappers)
│   │   │   ├── formula-client.ts
│   │   │   ├── markdown-client.ts
│   │   │   └── vad-client.ts
│   │   └── sheets/formula.ts             (modifié — appel async via formula-client)
│   ├── components/
│   │   ├── common/virtual-list.tsx       (nouveau — wrapper @tanstack/react-virtual)
│   │   ├── chat/message-list.tsx         (virtualisé)
│   │   ├── mail/inbox-list.tsx           (virtualisé)
│   │   ├── contacts/contacts-list.tsx    (virtualisé)
│   │   ├── storage/file-list.tsx         (virtualisé)
│   │   └── notifications/feed.tsx        (virtualisé)
│   └── app/sw.ts                         (polish — StaleWhileRevalidate /api/v1/**/list)
├── next.config.ts                        (CSP sans unsafe-eval, budgets abaissés)
└── lighthouse/
    ├── config.json                       (seuils par page)
    └── urls.txt                          (10 URLs critiques)

.github/workflows/ci.yml                   (job lighthouse-ci ajouté)
```

---

## 4. Étape 0 — Vendor trim (J1-J3)

### 4.1 Audit (J1)

```bash
cd client && ANALYZE=true npm run build
```

Ouvrir `.next/analyze/client.html`. Lister :
- Packages > 50 kB gzip dans le chunk racine (`framework-*.js`, `main-*.js`).
- Duplicates (deux versions de la même lib, ex. date-fns + moment).
- Barrel imports qui empêchent tree-shaking.

Cibles probables basées sur `client/package.json` actuel :
- `@tauri-apps/*` (api + plugin-shell) : utilisé uniquement sous Tauri — gate sous `isTauri()`.
- `framer-motion` : utilisation fragmentée — audit usages, possiblement remplaçable par CSS transitions.
- `recharts` : déjà dans `optimizePackageImports` — vérifier tree-shake effectif.
- `@livekit/components-styles` : CSS import — vérifier chargé uniquement sur `/meet/*`.
- `date-fns` + `moment` (si présent) : choisir un seul.
- `lodash` (full) : migrer vers `lodash-es` ou imports ciblés.

### 4.2 Actions (J2)

Un commit par cible. Exemples :
- `perf(client): gate @tauri-apps/* imports behind isTauri() helper`
- `perf(client): replace framer-motion <Motion> by CSS transition in <svc>`
- `perf(client): dedupe date handling — drop moment, keep date-fns`
- `perf(client): ensure recharts tree-shakes via optimizePackageImports`

### 4.3 Validation (J3)

- `cd client && npm run budget` → tous les routes marquent `ok`. Cible minimum : toutes les routes non-éditeur < budget, routes éditeur ≤ 95 % budget.
- CI `bundle-budget` passe au vert.
- Build Next reste propre.
- Tests Playwright E2E existants repassent (aucune régression fonctionnelle liée au trim).

---

## 5. Étape 1 — Workers (J4-J7)

### 5.1 Formula worker (J4-J5)

Nouveau fichier `client/src/workers/formula.worker.ts` dont le rôle est d'isoler l'évaluation d'expressions dynamiques hors du main thread. L'évaluateur reste limité aux mêmes garde-fous qu'actuellement (length limit, identifier rejection documentés en C1 du header CSP) mais s'exécute dans un contexte Worker dédié — donc le `'unsafe-eval'` qui reste aujourd'hui dans la CSP du main ne conserve plus d'utilité côté page.

Forme de l'API (pseudo-code, détails à l'implémentation) :

```ts
// worker: reçoit { id, expr, context }, répond { id, ok, value | error }
// main-thread client: evaluateFormula(expr, context) -> Promise<unknown>
// implémentation via postMessage + Map<id, resolver>, worker unique gardé vivant.
```

Migrer les 5 fichiers sheets identifiés (`functions-extended.ts`, `functions/registry.ts`, `functions/text.ts`, `functions/logic.ts`, `functions/math.ts`) pour passer par `evaluateFormula()` au lieu d'évaluer sur le main thread.

**CSP** : après migration, retirer `'unsafe-eval'` du header CSP dans `client/next.config.ts`. Commit dédié `feat(client): drop unsafe-eval from CSP — formula moved to worker`. Tester manuellement que les formules marchent toujours (`/sheets/editor` avec une feuille contenant VLOOKUP, SUMIFS, etc.).

### 5.2 Markdown worker (J6)

Pattern similaire. `client/src/workers/markdown.worker.ts` wrap `turndown` pour export MD. Utilisé par éditeurs (Tiptap → MD) et mail composer (HTML → MD).

### 5.3 VAD worker (J7)

Vérifier si `@ricky0123/vad-web` utilise déjà un Worker natif (lib récente). Si oui, documenter et skip. Sinon, wrapper dédié.

---

## 6. Étape 2 — Virtualisation (J8-J10)

### 6.1 Wrapper partagé

Créer `client/src/components/common/virtual-list.tsx` — un wrapper générique autour de `useVirtualizer` (`@tanstack/react-virtual`, déjà en dep) qui expose `<VirtualList items estimateSize overscan renderItem />` avec :
- `role="list"` sur le conteneur scroll, `aria-rowcount` = `items.length`.
- Chaque item rendu avec `role="listitem"`, `aria-rowindex` = index+1.
- `style={{ contain: "strict" }}` pour empêcher les reflows en cascade.
- `overscan` configurable, défaut 10.

Pattern conteneur + position absolue du virtualizer standard TanStack.

### 6.2 Cibles (ordre J8-J10)

| Liste | Fichier cible | Volume typique |
|---|---|---|
| Chat messages | `client/src/components/chat/message-list.tsx` | 1k-10k messages |
| Mail inbox | `client/src/components/mail/inbox-list.tsx` (créé dans P2) | 500-5k emails |
| Contacts | `client/src/components/contacts/contacts-list.tsx` (créé dans P2) | 100-5k contacts |
| Storage files | `client/src/components/storage/file-list.tsx` | 100-10k files |
| Notifications feed | `client/src/components/notifications/feed.tsx` | 50-500 |

Défis Chat spécifiques : auto-scroll to bottom sur nouveau message, insertions avec adjustment du scroll, editable messages sans perdre position.

### 6.3 Accessibilité

`aria-rowcount` sur conteneur, `aria-rowindex` sur chaque item visible. Test screen reader manuel (NVDA sur Windows) sur la liste chat pour vérifier que navigation fonctionne.

---

## 7. Étape 3 — Service Worker polish (J11-J12)

Le SW `client/src/app/sw.ts` est déjà mature. Ajouts ciblés :

### 7.1 Nouvelles stratégies (J11)

```ts
// GET list endpoints — StaleWhileRevalidate pour UX snappy
{
  matcher: ({ request, url }) =>
    request.method === "GET" &&
    /\/api\/v1\/.*\/list(\?|$)/.test(url.pathname + url.search),
  handler: new StaleWhileRevalidate({
    cacheName: "api-list",
    plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 5 * 60 })],
  }),
},

// Rarely-changing config — CacheFirst
{
  matcher: ({ url }) =>
    url.pathname === "/api/v1/brand-kit" || url.pathname === "/api/v1/tenant-config",
  handler: new CacheFirst({
    cacheName: "api-config",
    plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 })],
  }),
},
```

### 7.2 Kill-switch test (J12)

Playwright test `client/e2e/p3-sw-killswitch.spec.ts` :
1. Visit la page, SW installé.
2. Write known value to `caches`.
3. Push nouveau `/sw.js` avec `skipWaiting` et la version bump qui vide `caches.delete('api-list')`.
4. Refresh page, assert `caches.has('api-list') === false`.

### 7.3 Documentation

Créer `docs/architecture/service-worker.md` qui décrit toutes les stratégies actuelles + ajoutées, avec tableau `URL pattern → stratégie → TTL`.

---

## 8. Étape 4 — Lighthouse CI (J13)

### 8.1 Config

`client/lighthouse/config.json` :

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
      "settings": {
        "preset": "desktop"
      }
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

### 8.2 Job CI

`.github/workflows/ci.yml` ajout :

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
    env:
      DATABASE_URL: postgres://signapps:signapps_dev@localhost:5432/signapps
      JWT_SECRET: thisisaverylongdevsecretatleast32bytes
      KEYSTORE_MASTER_KEY: "0000000000000000000000000000000000000000000000000000000000000000"
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - uses: Swatinem/rust-cache@v2
      - uses: actions/setup-node@v4
        with: { node-version: "20", cache: "npm", cache-dependency-path: client/package-lock.json }
      - name: Build signapps-platform
        run: cargo build --release -p signapps-platform
      - name: Build frontend
        run: cd client && npm ci && npm run build
      - name: Start services
        run: |
          ./target/release/signapps-platform &
          cd client && npm run start &
          sleep 15
      - name: Seed admin
        run: cargo run --bin seed_db -p signapps-identity
      - name: Lighthouse CI
        run: |
          cd client
          npx @lhci/cli@latest autorun --config=lighthouse/config.json
```

---

## 9. Étape 5 — Finalisation (J14)

- `.claude/skills/workers-debug/SKILL.md` (diagnostiquer crashes worker, postMessage timeouts, isolation CSP).
- `.claude/skills/virtualization-debug/SKILL.md` (scroll jump, a11y screen reader, row height mismatch).
- `docs/product-specs/52-polish-runtime.md` (spec produit miroir).
- Update `CLAUDE.md` Préférences : `npm run budget` reste la ref, mentionner `@tanstack/react-virtual` + Workers.
- Merge `feature/phase-d2-p3-polish` → main, push.

---

## 10. Data flow

**Formula worker** : main-thread `evaluateFormula()` → postMessage → worker exécute l'expression dans son contexte isolé → postMessage → Promise resolve. Latence attendue <5 ms pour formules typiques (<500 chars).

**Virtualisation** : scroll event → `@tanstack/react-virtual` calcule fenêtre visible → rendre uniquement ~20 items au lieu de 10k.

**SW `/list` endpoints** : GET → cache hit (instant) → réponse immédiate → revalidation réseau en background → cache update pour prochaine navigation.

---

## 11. Error handling

- **Worker crash** : client détecte via `worker.onerror`, respawn worker, reject les promises en attente, log via `tracing` (console).
- **Worker timeout** : 5 s par défaut sur `evaluateFormula`, reject avec `TimeoutError`.
- **Virtualisation jank** : si frame time > 33 ms détecté via `PerformanceObserver`, log warning (dev) ; reduce overscan.
- **SW cache corruption** : kill-switch `/sw.js` no-store permet purge ; test Playwright valide.
- **Lighthouse CI flaky** : `numberOfRuns: 3` moyennées ; retry 1× en cas d'échec unique.

---

## 12. Testing

| Couche | Test | Cible |
|---|---|---|
| Étape 0 | `npm run budget` | tous routes `ok` |
| Étape 0 | Playwright E2E existants | aucune régression |
| Étape 1 | Unit test `formula-client.spec.ts` | evaluateFormula correct sur 10 formules typiques |
| Étape 1 | Manual smoke `/sheets/editor` | VLOOKUP, SUMIFS, IFS fonctionnent via worker |
| Étape 1 | grep CSP headers prod build | `unsafe-eval` absent |
| Étape 2 | Playwright `p3-chat-scroll.spec.ts` | scroll 5k messages frame time p95 <17 ms |
| Étape 2 | Manual a11y | NVDA navigation liste chat fonctionne |
| Étape 3 | Playwright `p3-sw-killswitch.spec.ts` | cache purgé après SW update |
| Étape 4 | CI `lighthouse-ci` | seuils §8.1 respectés |

---

## 13. Risques & mitigations

| Risque | Proba | Impact | Mitigation |
|---|---|---|---|
| Vendor trim casse un flow Tauri | Faible | Moyen | Smoke Tauri après chaque commit vendor |
| Formula worker latence perçue dans sheets éditeur | Moyen | Moyen | Batch par tick + keepalive worker instance |
| Tiers lib (VAD) déjà worker — double-wrap inutile | Moyen | Faible | Audit J7 avant implémentation |
| Chat virtualisation casse scroll-to-bottom | Moyen | Moyen | Ref-based scroll, test manuel |
| SW kill-switch ne purge pas sur Safari | Faible | Moyen | Test Playwright explicite + fallback doc |
| Lighthouse CI flaky sur GitHub runners | Moyen | Faible | 3 runs moyennés + retry |

---

## 14. Séquencement

```
J1-J3  Vendor trim (audit, actions ciblées, validation bundle-budget green)
J4-J5  Formula worker + retirer unsafe-eval CSP
J6     Markdown worker
J7     VAD worker (ou confirmation native)
J8     Chat virtualisation
J9     Mail + Contacts virtualisation
J10    Storage + Activity virtualisation
J11    SW strategies polish (list + config)
J12    SW kill-switch Playwright test
J13    Lighthouse CI job + seuils
J14    Debug skills + product spec + merge + push
```

Auto-chain : chaque jour enchaîne après tests verts, stop uniquement sur blocker réel.

**Debug skills à créer :**
- `.claude/skills/workers-debug/` — crashes, postMessage timeouts, isolation CSP.
- `.claude/skills/virtualization-debug/` — scroll jump, a11y, row height.

**Product spec** : `docs/product-specs/52-polish-runtime.md`.

---

## 15. Références

- Spec parent : `docs/superpowers/specs/2026-04-18-phase-d2-architectural-perf-design.md` §6.
- P2 spec : `docs/superpowers/specs/2026-04-18-phase-d2-p2-frontend-design.md` §14 baseline.
- P2 plan : `docs/superpowers/plans/2026-04-18-phase-d2-p2-frontend.md`.
- `@tanstack/react-virtual` : https://tanstack.com/virtual/latest
- `serwist` : https://serwist.pages.dev/docs/next/getting-started
- Lighthouse CI : https://github.com/GoogleChrome/lighthouse-ci
