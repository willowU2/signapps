# CLAUDE.md

Guide de survie pour Claude Code dans ce dépôt. Sections scannables par ordre de priorité.

## Project Overview

SignApps Platform — microservices Rust (Axum/Tokio) + frontend Next.js 16 (React 19, TypeScript). 40 workspace members, 33 services, 5 shared crates. REST APIs avec JWT. Tout tourne nativement (pas de Docker requis sauf PostgreSQL en dev).

---

## Build Commands

```bash
# ─── Justfile (préféré) ──────────────────────────────────
just check                # cargo check workspace
just build                # cargo build debug
just build-release        # cargo build --release (LTO)
just build-svc identity   # Build un service
just run identity         # Run un service
just dev                  # Frontend dev server (port 3000)
just db-start             # PostgreSQL Docker
just db-migrate           # Appliquer migrations SQL

# ─── Cargo aliases (.cargo/config.toml) ──────────────────
cargo c                   # check
cargo t                   # test
cargo lint                # clippy -D warnings
cargo fmtall              # fmt --all
cargo precommit           # fmt + lint + test (chaîné)

# ─── Frontend ────────────────────────────────────────────
cd client && npm install && npm run dev    # port 3000
cd client && npm run build                 # production build
```

## Test Commands

```bash
# ─── Rust (nextest = parallèle, 3-5x plus rapide) ───────
just test                         # Tous les tests
just test-crate signapps-db       # Un crate
cargo nextest run -p signapps-identity -- auth   # Filtre par nom

# ─── Couverture ─────────────────────────────────────────
just coverage                     # → lcov.info
just coverage-html                # → target/llvm-cov/html/

# ─── Mutation testing ────────────────────────────────────
just mutants                      # Workspace entier
just mutants-crate signapps-common   # Un crate ciblé

# ─── Frontend E2E ────────────────────────────────────────
just test-e2e                     # Playwright
cd client && npx playwright test --reporter=list

# ─── Documentation ──────────────────────────────────────
just docs                         # cargo doc --no-deps --workspace
just docs-private                 # cargo doc --document-private-items
just changelog                    # Générer CHANGELOG.md
just changelog-preview            # Preview sans écrire

# ─── Quality pipeline locale ────────────────────────────
just ci                           # fmt + lint + test + audit + deny
just ci-quick                     # check + lint seulement

# ─── Feedback live ──────────────────────────────────────
bacon                 # check en continu (default)
bacon clippy          # lint en continu
bacon test            # tests en continu
# Raccourcis clavier: c=check, l=clippy, t=test, f=fmt, d=doc
```

## Code Style

### Rust — Règles non-négociables

| Règle | Enforcement | Config |
|-------|-------------|--------|
| Edition 2021, MSRV 1.75 | Cargo.toml | `rust-version = "1.75"` |
| Max 100 chars/ligne | rustfmt | `max_width = 100` |
| Imports groupés std/external/crate | rustfmt | `group_imports = StdExternalCrate` |
| Complexité cognitive < 30 | clippy | `cognitive-complexity-threshold = 30` |
| < 150 lignes par fonction | clippy | `too-many-lines-threshold = 150` |
| < 8 paramètres par fonction | clippy | `too-many-arguments-threshold = 8` |
| Release: LTO + codegen-units=1 + panic=abort + strip | Cargo.toml | `[profile.release]` |

### TypeScript/Frontend

- Strict TypeScript, path alias `@/*` → `./src/*`
- shadcn/ui components, Tailwind CSS 4 avec tokens sémantiques (`bg-card`, `text-foreground`, `border-border`, `bg-muted`)
- Zustand stores (pas Redux), react-hook-form + zod, Axios avec JWT auto-refresh

---

## Gouvernance et Qualité

### Zéro-Print Policy & Observabilité

**INTERDIT** en code de production :
```rust
// ❌ JAMAIS
println!("debug: {}", value);
eprintln!("error: {}", err);
dbg!(value);

// ✅ TOUJOURS
tracing::info!("processing request");
tracing::warn!(user_id = %id, "rate limit approached");
tracing::error!(?err, "database connection failed");
tracing::debug!(payload = ?body, "incoming request");
```

**Chaque fonction publique** d'un handler doit porter `#[instrument]` :
```rust
#[tracing::instrument(skip(pool, claims), fields(user_id = %claims.sub))]
pub async fn create_event(
    State(pool): State<PgPool>,
    claims: Claims,
    Json(input): Json<CreateEvent>,
) -> Result<Json<Event>, AppError> {
    // ...
}
```

Les spans structurés permettent le tracing distribué. Les champs `skip` évitent de logger les données volumineuses (pool, tokens).

### Gestion des Erreurs — Tolérance Zéro

```rust
// ❌ INTERDIT en production (OK uniquement dans #[cfg(test)])
let value = result.unwrap();
let value = result.expect("should exist");

// ✅ Propagation avec contexte
let value = result.map_err(|e| AppError::internal(format!("DB query failed: {e}")))?;
let value = result.context("failed to fetch user")?;  // anyhow

// ✅ Pattern matching explicite
match result {
    Ok(v) => v,
    Err(e) => {
        tracing::error!(?e, "operation failed");
        return Err(AppError::internal("operation failed"));
    }
}
```

| Crate | Usage | Où |
|-------|-------|-----|
| `thiserror` | Erreurs typées avec `#[derive(Error)]` | Crates partagés (`signapps-common`, `signapps-db`) |
| `anyhow` | Erreurs contextuelles avec `.context()` | Services (handlers, main.rs) |
| `AppError` | RFC 7807 Problem Details pour les réponses HTTP | Tous les handlers |

### Sécurité et Spécifications API (Code-First OpenAPI)

Toute API REST DOIT avoir sa documentation OpenAPI dérivée du code :

```rust
// ✅ Chaque handler documenté avec utoipa
#[utoipa::path(
    post,
    path = "/api/v1/events",
    request_body = CreateEvent,
    responses(
        (status = 201, description = "Event created", body = Event),
        (status = 400, description = "Invalid input", body = AppError),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearer" = [])),
    tag = "Events"
)]
pub async fn create_event(/* ... */) -> Result<Json<Event>, AppError> { /* ... */ }

// ✅ Chaque struct de requête/réponse dérive ToSchema
#[derive(Serialize, Deserialize, utoipa::ToSchema)]
pub struct CreateEvent {
    /// Titre de l'événement
    pub title: String,
    /// Date de début (ISO 8601)
    pub start_time: DateTime<Utc>,
}
```

Le Swagger UI est exposé sur `/swagger-ui/` de chaque service (via `utoipa-swagger-ui`). Le schéma JSON est disponible sur `/api-docs/openapi.json`.

### Documentation Vivante (rustdoc strict)

**`#![warn(missing_docs)]`** est activé dans les crates partagés (`signapps-common`, `signapps-db`). Tout item public non documenté génère un warning.

Chaque structure de données publique DOIT être documentée avec les sections standard :

```rust
/// Représente un événement dans le calendrier unifié.
///
/// Supporte les types: event, task, leave, shift, booking, milestone, blocker, cron.
///
/// # Examples
///
/// ```
/// let event = Event { title: "Réunion".into(), ..Default::default() };
/// ```
///
/// # Errors
///
/// Les méthodes de création retournent `AppError::BadRequest` si le titre est vide.
///
/// # Panics
///
/// Aucun panic possible — toutes les erreurs sont propagées via `Result`.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, utoipa::ToSchema)]
pub struct Event {
    /// Identifiant unique (UUID v4)
    pub id: Uuid,
    /// Calendrier propriétaire
    pub calendar_id: Uuid,
    /// Titre affiché à l'utilisateur
    pub title: String,
}
```

**Sections rustdoc obligatoires pour les fonctions publiques d'API :**

| Section | Quand | Exemple |
|---------|-------|---------|
| `/// # Examples` | Toute fonction publique | Montrer un appel typique |
| `/// # Errors` | Si retourne `Result` | Lister les cas d'erreur |
| `/// # Panics` | Si panic possible (sinon écrire "Aucun panic") | Documenter les conditions |

### Synchronisation README (cargo-rdme)

Le README.md de chaque crate est généré depuis la doc `//!` du `lib.rs` :

```bash
cargo rdme -w                     # Met à jour les README de tous les crates
cargo rdme -p signapps-common     # Un crate spécifique
```

Générer la doc complète : `just docs` ou `cargo doc --no-deps --workspace --open`

### Conventional Commits — Obligation stricte

Chaque commit DOIT suivre le format Conventional Commits. C'est la source du CHANGELOG automatique via git-cliff.

```
<type>[scope optionnel]: <description>

[corps optionnel]

[footer optionnel]
```

| Type | Usage |
|------|-------|
| `feat` | Nouvelle fonctionnalité |
| `fix` | Correction de bug |
| `perf` | Amélioration de performance |
| `refactor` | Refactoring sans changement de comportement |
| `docs` | Documentation uniquement |
| `test` | Ajout/modification de tests |
| `chore` | Maintenance (deps, config, CI) |
| `ci` | Pipeline CI/CD |
| `style` | Formatage, pas de changement logique |
| `build` | Système de build |

**Exemples :**
```bash
git commit -m "feat(calendar): add leave approval workflow"
git commit -m "fix(identity): handle expired JWT gracefully"
git commit -m "docs: update CLAUDE.md with observability rules"
git commit -m "feat!: rename Event to CalendarEvent"  # Breaking change
```

### Confidentialité — Politique stricte

- **AUCUNE** publication sur crates.io, npm public, Docker Hub public
- **AUCUN** déploiement de documentation sur GitHub Pages ou site public
- Les artefacts CI (rustdoc, coverage) sont des artifacts privés GitHub uniquement
- Le CHANGELOG.md sert aux notes de release internes uniquement
- Le code, la documentation et les artefacts sont la propriété exclusive de l'entreprise

---

## Review Checklist

Avant de déclarer une tâche terminée, valider **chaque point** :

### 1. Tests

- [ ] Tests unitaires présents (`#[cfg(test)] mod tests`)
- [ ] Tests passent : `just test` ou `cargo nextest run`
- [ ] Couverture vérifiée : `just coverage` (pas de régression)
- [ ] Pour les changements critiques : `just mutants-crate <crate>` (mutation testing)

### 2. Qualité

- [ ] Clippy propre : `cargo clippy --workspace --all-features -- -D warnings`
- [ ] Format vérifié : `cargo fmt --all -- --check`
- [ ] Pas de `println!`, `eprintln!`, `dbg!` en code non-test
- [ ] Pas de `.unwrap()` ou `.expect()` en code non-test
- [ ] `#[instrument]` sur les fonctions publiques des handlers
- [ ] `/// rustdoc` sur les structs/enums/traits publics

### 3. Sécurité

- [ ] `cargo audit` — pas de CVE connue
- [ ] `cargo deny check` — licences conformes, pas de vulnérabilité
- [ ] Pas de secrets hardcodés (le pre-commit hook les détecte)
- [ ] Inputs validés côté handler (pas de SQL injection, pas de path traversal)

### 4. API

- [ ] Endpoints documentés avec `#[utoipa::path]`
- [ ] Structs de requête/réponse dérivent `utoipa::ToSchema`
- [ ] Erreurs retournées au format RFC 7807 (`AppError`)
- [ ] Auth middleware appliqué sur les routes protégées

### 5. Commit

- [ ] Message au format Conventional Commits : `feat:`, `fix:`, `perf:`, `refactor:`, `docs:`, `test:`, `chore:`, `ci:`
- [ ] Scope optionnel : `feat(calendar): add leave approval workflow`
- [ ] Breaking changes signalés : `feat!: rename Event to CalendarEvent`

### 6. Documentation

- [ ] `cargo doc --no-deps --workspace` compile sans warnings
- [ ] Structs/enums/traits publics ont `///` avec description
- [ ] Fonctions publiques d'API documentent `/// # Examples`, `/// # Errors`, `/// # Panics`
- [ ] `cargo rdme -w` exécuté si lib.rs modifié (sync README)
- [ ] Commit message au format Conventional Commits
- [ ] `just changelog-preview` pour vérifier le changelog

---

## Architecture

### Workspace Layout

```
crates/
  signapps-common/    → JWT auth, middleware, AppError, value objects, crypto
  signapps-db/        → Models, repositories, migrations, PgPool, pgvector
  signapps-cache/     → TTL cache (moka) — remplace Redis
  signapps-keystore/  → Master key management + per-usage DEK derivation (AES-256-GCM)
  signapps-oauth/     → OAuth2/OIDC/SAML catalog, state machine, scope resolver
  signapps-runtime/   → PostgreSQL lifecycle, hardware detection, model manager
  signapps-service/   → Service bootstrap utilities
services/
  signapps-identity/      → Port 3001 – Auth, LDAP/AD, MFA, RBAC
  signapps-containers/    → Port 3002 – Docker (bollard)
  signapps-proxy/         → Port 3003 – Reverse proxy, TLS/ACME
  signapps-storage/       → Port 3004 – OpenDAL (FS/S3)
  signapps-ai/            → Port 3005 – AI Gateway (10 capabilities)
  signapps-securelink/    → Port 3006 – Web tunnels, DNS
  signapps-metrics/       → Port 3008 – Monitoring, Prometheus
  signapps-media/         → Port 3009 – Native STT/TTS/OCR
  signapps-docs/          → Port 3010 – Tiptap collaborative editing
  signapps-calendar/      → Port 3011 – Calendrier unifié (events, congés, présence, timesheets, CRON)
  signapps-mail/          → Port 3012 – Email IMAP/SMTP
  signapps-collab/        → Port 3013 – Real-time CRDT
  signapps-meet/          → Port 3014 – Vidéoconférence
  signapps-forms/         → Port 3015 – Form builder
  signapps-pxe/           → Port 3016 – PXE network boot
  signapps-remote/        → Port 3017 – Remote desktop
  signapps-office/        → Port 3018 – Office import/export
  signapps-social/        → Port 3019 – Social media
  signapps-chat/          → Port 3020 – Messagerie
  signapps-workforce/     → HR & workforce
  signapps-it-assets/     → IT asset management
  signapps-contacts/      → Contact management
  signapps-notifications/ → Port 8095 – Push notifications
  signapps-billing/       → Port 8096 – Facturation
  signapps-gateway/       → Port 3099 – API gateway aggregator
client/               → Next.js 16 (App Router), port 3000
migrations/           → PostgreSQL schema (pgvector inclus)
scripts/              → start-all, stop, backup, seed, log rotation
```

### Service Pattern

Chaque service Rust est à la fois une bibliothèque et un binaire :
- `src/lib.rs` – Expose `pub async fn router(shared: SharedState) -> anyhow::Result<Router>` consommé par `signapps-platform` (single-binary).
- `src/main.rs` – Binaire legacy `#[tokio::main]` conservé pour `just start-legacy` (debug isolé). Appelle `SharedState::init_once` puis délègue à `lib::router`.
- `src/handlers/` – Request handlers par domaine.
- État `AppState` injecté via `Extension` ou `State` extractors.
- Auth middleware depuis `signapps-common` injecte `Claims`.
- Retourne `Result<_, AppError>` (RFC 7807).

Les ressources partagées (`PgPool`, `JwtConfig`, `Keystore`, `CacheService`, `PgEventBus`) sont construites **une seule fois** par `signapps-service::shared_state::SharedState::init_once()` au boot de `signapps-platform`. Chaque service borrow un `Arc<SharedState>` au lieu d'ouvrir son propre pool.

### Shared Crate Conventions

**signapps-common:** `Claims`, `AppError` (RFC 7807), middleware (auth, admin, logging), value objects (`Email`, `Password`, `UserId`), `crypto::EncryptedField` trait (AES-256-GCM)

**signapps-db:** Repository pattern (`*Repository` + `&PgPool`), models 1:1 PostgreSQL, `VectorRepository` (384d), `MultimodalVectorRepository` (1024d)

**signapps-cache:** `CacheService` (moka TTL + DashMap counters) — rate limiting, JWT blacklist

**signapps-keystore:** `Keystore` (master key + DEK cache), `MasterKey`, `DataEncryptionKey`, `KeystoreBackend` (EnvVar / File / Remote KMS). Loaded once at boot of each service that manipulates encrypted fields.

**signapps-oauth:** `Catalog` (embedded JSON + DB overrides), `FlowState` (HMAC-signed stateless state), `ScopeResolver` (org-aware visibility + purpose + scope filtering), `ConfigStore` (async trait) + `PgConfigStore`, `OAuthError` (RFC 7807-ready). No HTTP engine yet — that's in Plan 3.

**signapps-runtime:** `RuntimeManager::ensure_database()`, `HardwareProfile::detect()`, `ModelManager`

### Structure pour nouvelle fonctionnalité

```
# Backend — Nouveau handler
1. Migration SQL : migrations/NNN_<feature>.sql
2. Modèle Rust  : crates/signapps-db/src/models/<feature>.rs
   → #[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, utoipa::ToSchema)]
   → /// rustdoc sur chaque champ public
3. Repository   : crates/signapps-db/src/repositories/<feature>_repository.rs
4. Handler      : services/signapps-<service>/src/handlers/<feature>.rs
   → #[utoipa::path] sur chaque endpoint
   → #[instrument] sur chaque fn publique
   → Result<_, AppError> comme retour
5. Routes       : services/signapps-<service>/src/main.rs
6. Tests        : #[cfg(test)] mod tests dans le même fichier

# Frontend — Nouveau composant
1. Composant : client/src/components/<domain>/<Component>.tsx
2. Types     : client/src/types/<domain>.ts
3. API       : client/src/lib/api/<domain>.ts
4. Page      : client/src/app/<route>/page.tsx
5. Store     : client/src/stores/<domain>-store.ts (si état partagé)
```

---

## Tooling Avancé

### Outils installés

| Outil | Config | Commande | Rôle |
|-------|--------|----------|------|
| `bacon` | `bacon.toml` | `bacon` / `just watch` | Feedback live en continu |
| `cargo-nextest` | `.config/nextest.toml` | `just test` | Tests parallèles rapides |
| `cargo-llvm-cov` | CI | `just coverage` | Couverture de code |
| `cargo-mutants` | — | `just mutants` | Mutation testing |
| `cargo-deny` | `deny.toml` | `just deny` | Licences + vulnérabilités deps |
| `cargo-audit` | — | `just audit` | CVE advisories |
| `git-cliff` | `cliff.toml` | `just changelog` | CHANGELOG auto (Conventional Commits) |
| `just` | `justfile` | `just --list` | 35+ recettes (build, test, ci, db) |
| `clippy` | `clippy.toml` | `just lint` | Lint strict |
| `rustfmt` | `rustfmt.toml` | `just fmt` | Formatage |
| `sqlx-cli` | — | `sqlx migrate run` | Migrations DB |
| `utoipa` | Cargo.toml | compile-time | OpenAPI Code-First |
| `cargo-rdme` | — | `just rdme` | Sync README depuis lib.rs |

### CI Pipeline (11 jobs parallèles)

| # | Job | Bloquant | Description |
|---|-----|----------|-------------|
| 1 | `check` | oui | `cargo check --workspace --all-features` |
| 2 | `check-offline` | oui | SQLX_OFFLINE=true (compile sans DB) |
| 3 | `fmt` | oui | `cargo fmt --check` |
| 4 | `clippy` | oui | `-D warnings` |
| 5 | `clippy-pedantic` | **non** | pedantic + nursery (advisory) |
| 6 | `test` | oui | `cargo nextest` + PostgreSQL pgvector |
| 7 | `deny` | oui | `cargo-deny` (licences + vulns) |
| 8 | `security` | oui | `cargo audit` |
| 9 | `frontend` | oui | ESLint + type-check + build |
| 10 | `coverage` | **non** | llvm-cov → Codecov |
| 11 | `docs` | oui | rustdoc --document-private-items → artifact privé |

### Git Hooks (pre-commit)

- **Secrets detection** : bloque les commits contenant `password`, `api_key`, `token`, `bearer`, `AWS_ACCESS_KEY`, `private_key`
- **cargo fmt check** : bloque si code non formaté
- **clippy** : avertissement (warn-only, TSC_STRICT=1 pour bloquer)

---

## Automatic Tool Usage

Claude DOIT invoquer ces outils automatiquement. OBLIGATOIRE.

### Superpowers Plugin Skills

| Situation | Skill |
|-----------|-------|
| Avant toute nouvelle feature | `superpowers:brainstorming` |
| Bug, test failure, comportement inattendu | `superpowers:systematic-debugging` |
| Implémenter feature ou bugfix | `superpowers:test-driven-development` |
| Tâche multi-étapes | `superpowers:writing-plans` |
| 2+ tâches indépendantes parallélisables | `superpowers:dispatching-parallel-agents` |
| Avant de déclarer "terminé" | `superpowers:verification-before-completion` |
| Après implémentation majeure | `superpowers:requesting-code-review` |
| Recevoir feedback de review | `superpowers:receiving-code-review` |

### BMAD Workflows

| Situation | Commande |
|-----------|---------|
| Nouvelle feature majeure | `/bmad CB` (Product Brief) |
| Spécifications détaillées | `/bmad CP` (PRD) |
| Architecture à décider | `/bmad CA` |
| Découper en stories | `/bmad CE` |
| Dev rapide sans cérémonie | `/bmad QD` |
| Code review | `/bmad CR` |
| Brainstorming | `/bmad BP` |

### Local Skills (`.agents/skills/`)

**Enterprise Governance (prioritaires) :**
- `claude_md_governance` — Audit et maintien du CLAUDE.md (structure, cohérence, directives)
- `enterprise_code_review` — Revue auto des 5 piliers + garde-fous issus de 828 commits
- `rust_enterprise_handler` — Template handler complet (tracing + utoipa + AppError + tests)
- `observability_tracing` — Standards tracing, zéro-print, spans, métriques
- `frontend_anti_patterns` — Prévention des 6 anti-patterns frontend (dark theme, layout, types, E2E, loops, mega-commits)

**Implementation Patterns :**
- `rust_api_endpoint` — Pattern CRUD Axum
- `rust_db_repository` — Repository pattern sqlx
- `rust_error_handling` — thiserror/anyhow patterns
- `rust_tracing_logging` — Configuration tracing
- `nextjs_component` — Créer un composant Next.js
- `db_migrations` — Migrations avec sqlx
- `rust_debugging_workflow` — Debug patterns
- `playwright_e2e_testing` — Tests E2E

### Priorité : Enterprise Governance > Superpowers > BMAD > Implementation Patterns

---

## Key Environment Variables

```bash
DATABASE_URL=postgres://signapps:password@localhost:5432/signapps
JWT_SECRET=<32+ chars>
STORAGE_MODE=fs                    # "fs" ou "s3"
STORAGE_FS_ROOT=./data/storage
LLM_PROVIDER=ollama|vllm|openai|anthropic|llamacpp
MODELS_DIR=./data/models           # cache modèles AI
GPU_BACKEND=auto                   # auto|cuda|rocm|metal|vulkan|cpu
RUST_LOG=info,signapps=debug,sqlx=warn
```

Voir `.env.example` pour la liste complète.

## Inter-service communication

**Rule:** PgEventBus for async events. Direct DB query (via signapps-db) for synchronous reads. Direct HTTP between services is forbidden except for gateway → backend.

See `docs/architecture/inter-service-communication.md` for details and patterns.

---

## Préférences de développement

- **Frontend port** : TOUJOURS port 3000
- **Frontend dev (défaut)** : `cd client && npm run dev` utilise **Turbopack** (Next.js 16). Cold compile < 1 s par route.
- **Frontend build** : `cd client && npm run build` (Next.js default, Turbopack en prod OU webpack selon Next 16 config).
- **Frontend budget** : `cd client && npm run budget` vérifie la taille gzip par route.
- **Auto-login dev** : `http://localhost:3000/login?auto=admin`
- **PostgreSQL** : `just db-start` (Docker) ou natif
- **Runtime backend (défaut)** : `just start` → **signapps-platform** (single binary, 34 services en tokio tasks, cold start < 3 s)
- **Runtime backend (legacy)** : `just start-legacy` → 33 binaires séparés (debug isolé d'un service)
- **Smoke check** : `just smoke` (ping 5 /health critiques)
- **Bench** : `./scripts/bench-coldstart.sh` (échec si boot > 3 s)
- **Web Workers** : formula evaluator, markdown (turndown) isolés hors main thread → `client/src/workers/*`. VAD déjà worker-native.
- **Virtualisation** : listes massives (chat, mail, storage list, notifs popover) utilisent `<VirtualList>` (`client/src/components/common/virtual-list.tsx`).
- **Lighthouse CI** : CI bloque PR si une des 10 pages clés passe sous seuil (voir `client/lighthouse/config.json`).
- **CSP** : `unsafe-eval` retiré — l'évaluateur de formules sheets est désormais un parser récursif-descendant pur.
- **Conventional Commits** : obligatoires (`feat:`, `fix:`, `perf:`, `refactor:`, `docs:`, `test:`, `chore:`, `ci:`)
- **Changelog** : `just changelog` après chaque release

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"` to keep the graph current
