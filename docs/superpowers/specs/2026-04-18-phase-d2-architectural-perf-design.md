# Phase D2 — Performance architecturale — Design Spec

**Date :** 2026-04-18
**Statut :** Design validé, prêt pour writing-plans
**Auteurs :** Brainstorming Claude + Étienne
**Référence interne :** suite de `2026-04-16-phase-d-targeted-perf-design.md` (fixes chirurgicaux déjà faits)
**Prior art :** `docs/single-binary-design.md` (2026-03-22, non implémenté)

---

## 1. Contexte & Objectifs

### 1.1 Problème constaté (2026-04-18)

Trois douleurs perf simultanées observées sur le projet :

**A. Premier rendu frontend lent.** Logs `next dev --webpack` (Next.js 16.2.3, mode webpack explicite) :

| Route | Compile initial | Next.js pur | App code |
|---|---|---|---|
| `/dashboard` | 13.1 s | 11.7 s | 1.36 s |
| `/whiteboard` | 4.3 s | 3.4 s | 0.88 s |
| `/sheets/editor` | 9.5 s | 9.4 s | 0.18 s |
| `/design/editor` | 7.5 s | 7.4 s | 0.12 s |

Revisite après compile : 40-100 ms. Le coût est 100 % dans le bundling webpack première passe.

**B. Démarrage backend long.** 33 services Rust lancés via `scripts/start-all.ps1`. Premier service prêt à t+0.5 s (identity), dernier service prêt à t+60 s (gateway). Chaque service :
- ouvre son propre `PgPool`,
- ré-exécute les migrations (warnings « constraint already exists »),
- pour `signapps-ai` : hardware detection + ModelManager + 4 providers + RAG + 93 tools (~5 s à lui seul).

**C. Runtime laggy.** Scroll listes massives (chat, mail, storage), frappe dans les éditeurs (Tiptap/Monaco), charges initiales lourdes par bundle monolithique (Tiptap 20+ extensions, LiveKit, MediaPipe, @tanstack, @radix, @base-ui) servies dès la route racine.

### 1.2 Causes racines

| Symptôme | Cause |
|---|---|
| A | `next dev --webpack` au lieu de Turbopack ; absence de dynamic imports sur deps lourdes ; pas de RSC sur pages fetch-heavy |
| B | 33 process indépendants × init complète (PgPool, JWT, tracing, migrations, AI boot) |
| C | Bundle initial tout-en-un ; évaluation sync dans main thread (formules, Markdown, VAD) ; pas de virtualisation systématique ; pas de cache edge pour GET idempotents |

### 1.3 Objectifs mesurables

| Axe | Baseline (2026-04-18) | Cible |
|---|---|---|
| Cold start backend (tous services prêts) | 60 s | **< 3 s** |
| First compile `/dashboard` (dev) | 13.1 s | **< 1 s** |
| First compile `/sheets/editor` (dev) | 9.5 s | **< 1 s** |
| Bundle initial `/` (gzip) | non mesuré | **< 250 kB** |
| Bundle routes éditeur (gzip) | non mesuré | **< 800 kB** |
| LCP pages critiques (Lighthouse) | non mesuré | **< 2.5 s** |
| INP interactions (Lighthouse) | non mesuré | **< 200 ms** |
| Scroll 10 k items listes | drops | **60 fps stable** |

### 1.4 Non-goals

- Pas de migration Rust → autre langage.
- Pas de changement de stack frontend (Next.js + Tauri restent).
- Pas d'edge runtime externe (on reste on-prem + Tauri).
- Pas de réécriture Tiptap/Monaco/LiveKit/MediaPipe — uniquement chargement paresseux.
- Pas de suppression de service fonctionnel (nettoyage au passage autorisé mais pas goal).
- Pas d'instrumentation APM payante type Datadog/NewRelic.

---

## 2. Paramètres validés

| Axe | Choix |
|---|---|
| Niveau d'agressivité | **C — Refactoring architectural** (1-2 mois) |
| Approche de décomposition | **Approche 1 — Bottom-up** (backend cold start en premier, puis frontend, puis polish) |
| Gouvernance | **Auto-chain** après approbation (cf. `feedback_auto_chain.md`) — une phase enchaîne la suivante après tests verts ; stop uniquement sur blocker réel |
| Métriques | Quantitatives (cold start timer, `npm run analyze`, Lighthouse CI) |
| Compat dev | Binaires legacy conservés derrière `just start-legacy` ; `just start` bascule sur single-binary |

---

## 3. Architecture cible

```
┌─────────────────────────────────────────────────┐
│  signapps-platform (single binary, ~150 MB)     │
│  ┌───────────────────────────────────────────┐  │
│  │  Shared resources (init once):            │  │
│  │    PgPool · Keystore · JwtConfig          │  │
│  │    Tracing · Moka cache · EventBus        │  │
│  └───────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────┐  │
│  │  tokio::spawn × 33 Axum routers           │  │
│  │  Each bound to its own port               │  │
│  │  Lazy init: AI providers, GPU, models     │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
          │
          ↓
┌─────────────────────────────────────────────────┐
│  Next.js 16 + Turbopack (dev) + RSC             │
│  · dashboard    → Server Components streaming   │
│  · editors      → Web Workers (Tiptap, Monaco)  │
│  · listes       → react-virtual + React.memo    │
│  · heavy deps   → dynamic import (LiveKit …)    │
└─────────────────────────────────────────────────┘
          │
          ↓ (Serwist service worker)
┌─────────────────────────────────────────────────┐
│  Edge cache : /_next/static, fonts, images,     │
│  SWR pour GET idempotents                       │
└─────────────────────────────────────────────────┘
```

---

## 4. Phase 1 — Single-binary (4 semaines)

### 4.1 Structure du nouveau binaire

**Nouveau crate :** `services/signapps-platform/` avec `Cargo.toml` qui dépend de chaque `signapps-<svc>` en library (+ feature flag `lib`).

**Refactor chaque service :** extraire la construction du router dans `lib.rs` :

```rust
// services/signapps-identity/src/lib.rs  (nouveau)
pub fn router(state: SharedState) -> axum::Router {
    Router::new()
        .route("/api/v1/auth/login", post(handlers::login))
        // … existant déplacé depuis main.rs
        .with_state(state)
}

// services/signapps-identity/src/bin/main.rs  (legacy binaire conservé)
#[tokio::main]
async fn main() -> Result<()> {
    let state = SharedState::init_once(&cfg).await?;
    signapps_common::bootstrap::run_server(3001, signapps_identity::router(state)).await
}
```

### 4.2 Shared state (init une fois)

```rust
// crates/signapps-service/src/shared_state.rs
pub struct SharedState {
    pub pool:     Arc<PgPool>,
    pub jwt:      Arc<JwtConfig>,
    pub keystore: Arc<Keystore>,
    pub cache:    Arc<CacheService>,
    pub events:   Arc<PgEventBus>,
    pub tracing:  TracingHandle,
}

impl SharedState {
    pub async fn init_once(cfg: &Config) -> Result<Self> { /* … */ }
}
```

**Une seule init** pour : tracing, DB pool (avec `max_connections` dimensionné pour tout le process, pas par service), JWT, Keystore, moka cache, LISTEN/NOTIFY bus.

### 4.3 Supervisor & lazy boot

```rust
// services/signapps-platform/src/main.rs
#[tokio::main]
async fn main() -> Result<()> {
    let shared = SharedState::init_once(&cfg).await?;
    run_migrations_once(&shared.pool).await?;

    let services: Vec<ServiceSpec> = vec![
        spec("identity",    3001, signapps_identity::router(shared.clone())),
        spec("containers",  3002, signapps_containers::router(shared.clone())),
        // … 31 autres
        spec("gateway",     3099, signapps_gateway::router(shared.clone())),
    ];

    let supervisor = Supervisor::new(services);
    supervisor.run_forever().await  // respawn avec backoff si une task crashe
}
```

**Supervisor pattern** : si une task se termine en erreur, tracing log + restart avec backoff exponentiel (1s, 2s, 4s, max 30s). Une panic dans un service ne tue pas le process global.

### 4.4 Lazy init AI

`signapps-ai` reporte actuellement au boot : GPU detection, ModelManager, 4 providers, 93 tools, RAG, index pipeline. Refactor → `OnceCell<ProviderRegistry>` initialisé à la **première requête** AI. Le routeur exist dès t0 ; la première requête paie le coût (~5 s) mais les suivantes sont instantanées.

### 4.5 Migrations idempotentes

Audit de toutes les migrations SQL. Convention stricte :

```sql
-- ✅ Idempotent
CREATE TABLE IF NOT EXISTS brand_kits ( … );
ALTER TABLE event_attendees
  ADD CONSTRAINT IF NOT EXISTS chk_attendee_identifier CHECK ( … );
CREATE INDEX IF NOT EXISTS idx_… ON …;

-- ❌ À bannir
CREATE TABLE brand_kits ( … );
ALTER TABLE … ADD CONSTRAINT chk_… …;
```

Les migrations sont exécutées **une seule fois** au boot du single-binary (pas par service). Le lock `_sqlx_migrations` gère déjà la concurrence, donc le mode legacy reste OK.

### 4.6 Compat dev

- `just start` → lance `signapps-platform` (nouveau default).
- `just start-legacy` → conserve `scripts/start-all.ps1` (33 process) pour debug isolé d'un service individuel (attach debugger, iterate sur un service sans redémarrer tout).
- `just restart-svc <name>` → kill + rebuild + respawn la task dans le process single-binary (ou tombe sur legacy si `just start-legacy` actif).

### 4.7 Gateway

`signapps-gateway` (reverse proxy aggregator) reste sur :3099 avec son comportement HTTP actuel en P1 (compatibilité legacy preserved). L'optimisation « appels in-process » via trait `ServiceHub` partagé est **reportée en P1.5 (optionnel, post-P3)** : elle ne bloque pas les gains principaux du single-binary (shared pool + lazy init + supervisor), qui viennent majoritairement de l'init une-fois et non du transport inter-services.

### 4.8 Tests P1

- `tests/single_binary_boot.rs` : démarre `signapps-platform`, attend que les 33 `/health` renvoient 200, assert `elapsed < 3s`.
- `tests/supervisor_restart.rs` : force le panic d'une task, vérifie que le superviseur la redémarre et que les 32 autres restent servies.
- `tests/migration_idempotent.rs` : boot 2x de suite, assert zéro warning.

---

## 5. Phase 2 — Frontend dev + runtime (2 semaines)

### 5.1 Turbopack

`client/package.json` :

```diff
- "dev": "next dev --webpack",
+ "dev": "next dev --turbopack",
```

Purge du cache Serwist/webpack au premier boot. Validation : `/dashboard` compile < 1 s (cible) mesurée dans les logs Next. Fallback : si incompatibilité avec une dep critique, documenter et revenir sur webpack ciblé pour cette route.

### 5.2 Dynamic imports — dépendances lourdes

```tsx
// client/src/components/editor/tiptap-lazy.tsx
const TiptapEditor = dynamic(
  () => import("@/components/editor/tiptap"),
  { ssr: false, loading: () => <EditorSkeleton /> }
);
```

Cibles prioritaires :
- `@tiptap/*` (20+ extensions) → importés uniquement dans `/docs/*`, `/mail/composer`
- `@livekit/components-react` → uniquement dans `/meet/*`
- `@mediapipe/selfie_segmentation`, `@ricky0123/vad-web` → uniquement dans `/meet/*`
- `monaco-editor` → uniquement éditeurs code
- `@tauri-apps/*` → isolés derrière un flag `isTauri` (déjà en place à vérifier)

### 5.3 React Server Components

Candidats évidents (fetch-heavy, interactivité limitée au top) :
- `/dashboard` — fetch stats → stream en RSC, îlots client pour les graphes interactifs.
- `/forms`, `/projects`, `/contacts` list pages — idem.
- `/mail/inbox` liste top-level (le viewer reste client).

Pattern :
```tsx
// app/dashboard/page.tsx  (RSC)
export default async function DashboardPage() {
  const stats = await fetchStatsServer();
  return <DashboardShell stats={stats}><ClientCharts data={stats.series} /></DashboardShell>;
}
```

Stores Zustand restent 100 % client — ne pas exposer dans les RSC.

### 5.4 Bundle splitting par sous-domaine

`client/next.config.ts` :

```ts
experimental: {
  optimizePackageImports: [
    "@tiptap/*", "@radix-ui/*", "@base-ui-components/react",
    "@livekit/components-react", "@tanstack/react-query",
    "lucide-react", "date-fns",
  ],
},
```

Vérification via `npm run analyze` (budget bundle en CI).

### 5.5 Tests P2

- `tests/dev-compile-benchmark.ts` (Playwright) : cold boot `next dev --turbopack`, hit `/dashboard`, assert TTFB < 2 s.
- `npm run analyze` exécuté dans CI avec budget strict (échec du job si route > seuil).
- Revalider les E2E existants (pas de régression fonctionnelle).

---

## 6. Phase 3 — Polish runtime (2 semaines)

### 6.1 Web Workers

**Formules spreadsheet** (`client/src/lib/sheets/formula.ts`) — migration vers un Worker dédié. Bonus sécurité : plus besoin de `unsafe-eval` dans la CSP (C6 du header actuel devient retirable).

**Parsing Markdown** (`turndown`) — migration Worker. Les éditeurs appellent `worker.postMessage(markdown)` et reçoivent le HTML.

**VAD** (`@ricky0123/vad-web`) — déjà designé pour Worker, juste vérifier qu'il n'est pas chargé sur main thread par défaut.

### 6.2 Virtualisation systématique

`@tanstack/react-virtual` est déjà en dépendance. Listes à instrumenter :
- Chat messages (`client/src/components/chat/`)
- Mail inbox (`client/src/components/mail/`)
- Storage file list (`client/src/components/storage/`)
- Contacts list
- Activity log / notifications
- Sheets editor grid (déjà virtualisé à vérifier)

Seuil : toute liste > 100 items rendus simultanément doit être virtualisée.

### 6.3 Edge cache via Serwist

Stratégies Workbox-like :

| URL pattern | Stratégie | TTL |
|---|---|---|
| `/_next/static/*` | `CacheFirst` | 1 an (immutable) |
| `/fonts/*`, `/images/*` | `CacheFirst` | 30 jours |
| `/api/v1/**/list` GET | `StaleWhileRevalidate` | 5 min |
| `/api/v1/auth/me` | `NetworkOnly` | - |
| `/api/v1/**` POST/PUT/DELETE | `NetworkOnly` | - |
| HTML routes | `NetworkFirst` avec fallback cache | - |

Kill-switch `/sw.js` no-store déjà en place (vérifié dans `next.config`).

### 6.4 Mesure & CI

**Lighthouse CI** sur 10 pages clés : dashboard, all-apps, mail inbox, sheets/editor, design/editor, docs/editor, meet, forms, settings/profile, login.

Seuils stricts (failing build) :
- Performance score ≥ 85
- LCP < 2.5 s
- INP < 200 ms
- CLS < 0.1
- TBT < 200 ms

**Bundle budget** dans CI (`npm run analyze`) :
- `/` initial < 250 kB gzip
- Routes éditeur < 800 kB gzip
- Routes liste standard < 400 kB gzip

---

## 7. Data flow

### 7.1 Single-binary vs legacy

HTTP inchangé du point de vue **externe** (frontend, Tauri, clients externes) : chaque service garde son port, son API, ses tokens JWT.

**Interne** : le gateway appelle en priorité les routers in-process via un trait `ServiceHub` partagé :

```rust
#[async_trait]
pub trait ServiceHub {
    async fn call<T: Handler>(&self, req: Request) -> Response;
}
```

Permet d'éliminer l'aller-retour HTTP localhost intra-process.

### 7.2 RSC

Fetch serveur → stream HTML → hydration sélective. Les stores Zustand et `@tanstack/react-query` restent côté client.

### 7.3 Service Worker

Intercepte selon les patterns ci-dessus. Revalide en arrière-plan pour SWR. Kill-switch respecté : `/sw.js` ne vient jamais du cache.

---

## 8. Error handling

**P1 — Supervisor** : task crash → tracing log structuré + restart avec backoff exp (1, 2, 4, 8, 16, max 30 s). Plafond : si 5 crashes consécutifs < 1 min, la task passe en état `failed` (HTTP 503 sur son port) sans plus retry ; alerte ops via `tracing::error!`.

**P1 — Migration failure** : si les migrations échouent au boot, le process refuse de démarrer (pas de mode dégradé).

**P2 — RSC fail-safe** : chaque segment d'app router a son `error.tsx` et `loading.tsx`. Dynamic imports exposent un `loading: <Skeleton />` et un `onError` fallback UI.

**P3 — Service Worker** : si le cache est corrompu ou la stratégie buggy, bascule auto en `NetworkOnly` ; kill-switch `/sw.js` reste la voie de secours ultime.

---

## 9. Testing

| Couche | Test | Cible |
|---|---|---|
| P1 | `tests/single_binary_boot.rs` | Boot 33 services < 3 s |
| P1 | `tests/supervisor_restart.rs` | Respawn OK, pas de cascade |
| P1 | `tests/migration_idempotent.rs` | Zéro warning au 2e boot |
| P1 | Existants (nextest workspace) | Aucune régression |
| P2 | `tests/dev-compile-benchmark.ts` | `/dashboard` cold compile < 2 s |
| P2 | `npm run analyze` (CI) | Budgets bundle respectés |
| P2 | Playwright E2E existants | Aucune régression |
| P3 | Lighthouse CI sur 10 pages | Scores ≥ seuils §6.4 |
| P3 | Playwright scroll stress | 10 k items, frame time < 17 ms p95 |

---

## 10. Risques & mitigations

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Incompat Turbopack avec une dep (Serwist, Monaco…) | Moyen | Moyen | Fallback webpack route-ciblé ; logger les issues ; remonter upstream |
| Fuite mémoire partagée (single pool trop sollicité) | Faible | Élevé | Métriques pgpool (taille, acquisition time), dimensionner `max_connections` ; tests charge |
| Regression fonctionnelle durant refactor main.rs → lib.rs | Moyen | Moyen | Tests existants + canary (1 service d'abord, puis propagation) |
| RSC casse des composants qui lisent `window`/localStorage | Moyen | Faible | Lint (`"use client"` strict), migration progressive, types serveur/client distincts |
| Bundle budget bloque livraisons futures | Faible | Faible | Bypass explicite via PR label `perf-budget-exception` documenté |
| Service Worker cache des routes privées → leak cross-user | Faible | Élevé | Stratégies `NetworkOnly` sur tout ce qui n'est pas idempotent public ; tests fuite |
| Supervisor infini loop sur panic déterministe | Faible | Moyen | Plafond 5 restart/min, puis failed state avec 503 |

---

## 11. Séquencement & livraison

**Auto-chain** (cf. `feedback_auto_chain.md`) : après approbation initiale, enchaînement sans go/no-go intermédiaire, stop uniquement sur blocker réel.

```
Semaine 1-2 : P1.1 refactor services → lib + binaire legacy conservé
Semaine 3   : P1.2 SharedState + supervisor + migrations idempotentes
Semaine 4   : P1.3 lazy init AI + tests P1 + basculer `just start` par défaut
Semaine 5   : P2.1 Turbopack + dynamic imports deps lourdes
Semaine 6   : P2.2 RSC pages candidates + bundle splitting + CI bundle budget
Semaine 7   : P3.1 Web Workers (formules, markdown) + virtualisation listes
Semaine 8   : P3.2 Service Worker stratégies + Lighthouse CI + doc
```

Chaque fin de semaine = commit batch conforme Conventional Commits (cf. CLAUDE.md). Une update du `product-specs` et du debug skill concerné à chaque commit (cf. `feedback_commit_workflow.md`).

**Debug skills à créer/updater** (cf. `feedback_feature_spec_workflow.md`) :
- `.claude/skills/single-binary-debug/` — triage boot issues, lire supervisor logs, détecter task qui ne restart pas, dimensionner PgPool.
- `.claude/skills/turbopack-debug/` — diagnostiquer compile errors Turbopack, toggle fallback webpack route-ciblé, lire invalidations SW.
- `.claude/skills/web-workers-debug/` — inspecter messages worker, catch uncaught, verifier isolation, postMessage perf.

**Product-specs** à créer : `docs/product-specs/XX-perf-architecturale.md` en plus de cette spec (spec technique vs spec produit).

---

## 12. Références

- `docs/single-binary-design.md` — prior art single-binary (2026-03-22).
- `docs/superpowers/specs/2026-04-16-phase-d-targeted-perf-design.md` — Phase D fixes chirurgicaux.
- `CLAUDE.md` — règles workspace (tracing, erreur, commits, docs).
- `feedback_shared_code_extraction.md` — règle d'extraction vers crates partagés.
- `feedback_design_patterns.md` — patterns GoF à appliquer (Supervisor = Observer ; SharedState = Singleton/Facade ; Lazy init = Proxy).
- Next.js Turbopack docs : https://nextjs.org/docs/app/api-reference/turbopack
- React Server Components docs : https://nextjs.org/docs/app/building-your-application/rendering/server-components
- Serwist / Workbox strategies : https://serwist.pages.dev/docs/serwist/runtime-caching/strategies
