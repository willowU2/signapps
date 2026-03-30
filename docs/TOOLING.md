# Guide des outils — SignApps Platform

> Documentation des outils de développement — dernière mise à jour : 2026-03-30

---

## 1. Outils installés

| Outil | Commande | Rôle | Config |
|-------|---------|------|--------|
| **just** | `just` | Task runner moderne (remplace make) | `justfile` |
| **bacon** | `bacon` | Feedback live (watch + recompile) | `bacon.toml` |
| **cargo-nextest** | `cargo nextest` | Runner de tests rapide | `.cargo/nextest.toml` |
| **cargo-llvm-cov** | `cargo llvm-cov` | Couverture de code LLVM | — |
| **cargo-mutants** | `cargo mutants` | Mutation testing | — |
| **cargo-audit** | `cargo audit` | Audit CVE des dépendances | `audit.toml` |
| **cargo-deny** | `cargo deny` | Licences + CVE + duplicates | `deny.toml` |
| **git-cliff** | `git cliff` | Génération du CHANGELOG | `cliff.toml` |
| **cargo-rdme** | `cargo rdme` | Sync README depuis lib.rs | — |
| **sqlx-cli** | `sqlx` | Migrations PostgreSQL | — |
| **Node.js 20** | `node`, `npm` | Frontend Next.js | `client/package.json` |
| **Playwright** | `npx playwright` | Tests E2E | `client/playwright.config.ts` |

### Installation des outils Rust

```bash
just update-tools
# Équivalent :
cargo binstall -y cargo-nextest bacon cargo-mutants git-cliff just cargo-deny cargo-audit
```

---

## 2. justfile — Recettes par catégorie

Le justfile contient 35+ recettes organisées en catégories. Lancer avec `just <recette>`.

### Build

| Recette | Commande sous-jacente | Description |
|---------|-----------------------|-------------|
| `check` | `cargo check --workspace --all-features` | Vérification rapide (pas de binaire) |
| `build` | `cargo build --workspace` | Build debug |
| `build-release` | `cargo build --release --workspace` | Build release (LTO, optimisé) |
| `build-svc <nom>` | `cargo build -p signapps-<nom>` | Build un seul service |

### Qualité

| Recette | Commande sous-jacente | Description |
|---------|-----------------------|-------------|
| `lint` | `cargo clippy ... -- -D warnings` | Clippy strict (CI) |
| `lint-pedantic` | `cargo clippy ... -W pedantic` | Clippy pédantique (advisory) |
| `fmt` | `cargo fmt --all` | Formater tout le code |
| `fmt-check` | `cargo fmt --all -- --check` | Vérifier le formatage (CI) |
| `audit` | `cargo audit` | Audit CVE |
| `deny` | `cargo deny check` | Licences + CVE + duplicates |

### Tests

| Recette | Commande sous-jacente | Description |
|---------|-----------------------|-------------|
| `test` | `cargo nextest run --workspace` | Tests rapides (nextest) |
| `test-crate <crate>` | `cargo nextest run -p <crate>` | Tests d'un seul crate |
| `coverage` | `cargo llvm-cov ... --lcov` | Couverture LCOV |
| `coverage-html` | `cargo llvm-cov ... --html` | Couverture HTML |
| `mutants` | `cargo mutants --workspace` | Mutation testing |
| `mutants-crate <crate>` | `cargo mutants -p <crate>` | Mutations d'un crate |
| `test-e2e` | `npx playwright test` | Tests E2E Playwright |

### Run

| Recette | Commande sous-jacente | Description |
|---------|-----------------------|-------------|
| `run <svc>` | `cargo run -p signapps-<svc>` | Lancer un service |
| `dev` | `cd client && npm run dev` | Frontend (port 3000) |
| `start` | `powershell scripts/start-all.ps1` | Tous les services |
| `stop` | `powershell scripts/stop-test-services.ps1` | Arrêter tout |
| `status` | curl health checks | Statut des services clés |

### Base de données

| Recette | Description |
|---------|-------------|
| `db-start` | Démarrer PostgreSQL (Docker) |
| `db-stop` | Arrêter PostgreSQL |
| `db-migrate` | Appliquer toutes les migrations `.sql` |
| `db-backup` | Backup via `scripts/pg-backup.sh` |
| `db-seed` | Seed données démo (10 contacts, 5 events, 2 jobs) |

### Documentation

| Recette | Description |
|---------|-------------|
| `docs` | `cargo doc --no-deps --workspace` |
| `docs-private` | Doc avec items privés |
| `docs-check` | `RUSTDOCFLAGS="-D warnings" cargo doc` |
| `rdme` | Sync README depuis `lib.rs` (cargo-rdme) |

### Changelog et maintenance

| Recette | Description |
|---------|-------------|
| `changelog` | Générer `CHANGELOG.md` (git-cliff) |
| `changelog-preview` | Aperçu des changements non publiés |
| `clean` | `cargo clean` + cache Next.js |
| `rotate-logs` | Rotation des logs via `scripts/rotate-logs.sh` |
| `update-tools` | Mettre à jour tous les outils Cargo |

### Frontend

| Recette | Description |
|---------|-------------|
| `install` | `cd client && npm install` |
| `build-frontend` | `cd client && npm run build` |
| `lint-frontend` | `cd client && npm run lint` |

### CI locale

| Recette | Description |
|---------|-------------|
| `ci` | Pipeline complète : `fmt-check lint test audit deny docs-check` |
| `ci-quick` | Pipeline rapide : `check lint` |
| `watch` | Feedback live avec bacon |

---

## 3. bacon — Configuration et raccourcis

`bacon` surveille les fichiers source et relance automatiquement le job courant.

### Configuration (`bacon.toml`)

| Job | Commande | Usage |
|-----|---------|-------|
| `check` (défaut) | `cargo check --workspace --all-features` | Vérification rapide |
| `clippy` | `cargo clippy --workspace ... -D warnings` | Lint strict |
| `test` | `cargo nextest run --workspace` | Tests |
| `fmt` | `cargo fmt --all -- --check` | Vérification formatage |
| `doc` | `cargo doc --no-deps --workspace` | Documentation |
| `deny` | `cargo deny check` | Dépendances |

### Raccourcis clavier

| Touche | Action |
|--------|--------|
| `c` | Basculer sur le job `check` |
| `l` | Basculer sur le job `clippy` |
| `t` | Basculer sur le job `test` |
| `f` | Basculer sur le job `fmt` |
| `d` | Basculer sur le job `doc` |
| `Esc` / `q` | Quitter bacon |
| `r` | Relancer le job courant manuellement |

### Démarrage

```bash
bacon         # job check (défaut)
bacon clippy  # démarrer directement sur clippy
bacon test    # démarrer sur les tests
just watch    # alias just
```

---

## 4. CI Pipeline (GitHub Actions)

Le pipeline s'exécute sur chaque `push` et `pull_request`.

### Jobs

| Job | Description | Bloquant |
|-----|-------------|---------|
| **check** | `cargo check --workspace --all-features` | Oui |
| **check-offline** | Même chose avec `SQLX_OFFLINE=true` (vérif macros sqlx) | Oui |
| **fmt** | `cargo fmt --all -- --check` | Oui |
| **clippy** | `cargo clippy -- -D warnings` (strict) | Oui |
| **clippy-pedantic** | Clippy pédantique (advisory, `continue-on-error: true`) | Non |
| **test** | `cargo nextest run` avec PostgreSQL + pgvector service | Oui |
| **deny** | `cargo deny check` (licences + CVE + duplicates) | Oui |
| **frontend** | `npm ci && npm run lint && npm run build` | Oui |
| **security** | `cargo audit` (CVE audit) | Oui |
| **coverage** | `cargo llvm-cov` → upload Codecov | Non |
| **docs** | `cargo doc --document-private-items` → artifact privé | Non |

### Variables d'environnement CI

```bash
DATABASE_URL=postgres://signapps:test_password@localhost:5432/signapps_test
JWT_SECRET=test_jwt_secret_minimum_32_characters_long
SQLX_OFFLINE=true  # job check-offline uniquement
```

### Release (`.github/workflows/release.yml`)

Déclenché sur tag `v*`. Build et push des images Docker sur GHCR pour 8 services :

```
ghcr.io/<org>/signapps-identity:<version>
ghcr.io/<org>/signapps-containers:<version>
ghcr.io/<org>/signapps-proxy:<version>
ghcr.io/<org>/signapps-storage:<version>
ghcr.io/<org>/signapps-ai:<version>
ghcr.io/<org>/signapps-securelink:<version>
ghcr.io/<org>/signapps-scheduler:<version>
ghcr.io/<org>/signapps-metrics:<version>
```

**Tous les artifacts CI sont privés** — pas de déploiement GitHub Pages.

---

## 5. Git hooks

### Pre-commit

Vérifie la présence de secrets avant chaque commit :
- Patterns recherchés : clés API, mots de passe en clair, tokens
- Bloque le commit si un secret potentiel est détecté

### Pre-push

Lance les tests avant de pousser vers le remote :
- `cargo nextest run --workspace` (tous les tests)
- Bloque le push si un test échoue

### Installation

Les hooks sont dans `.git/hooks/`. Pour les réinstaller après un clone :

```bash
# Manuellement
cp scripts/hooks/pre-commit .git/hooks/pre-commit
cp scripts/hooks/pre-push .git/hooks/pre-push
chmod +x .git/hooks/pre-commit .git/hooks/pre-push
```

---

## 6. Skills d'agent (`.agents/skills/` et `_bmad/`)

Les skills fournissent des workflows guidés pour les tâches courantes.

### Skills enterprise (BMAD — `_bmad/core/`)

| Skill | Commande | Quand l'utiliser |
|-------|---------|-----------------|
| **Product Brief** | `/bmad CB` | Nouvelle fonctionnalité majeure |
| **PRD** | `/bmad CP` | Spécifications détaillées |
| **Architecture** | `/bmad CA` | Décisions d'architecture |
| **Epics & Stories** | `/bmad CE` | Découpage en stories |
| **Quick Dev** | `/bmad QD` | Développement sans cérémonie |
| **Code Review** | `/bmad CR` | Revue de code |
| **Brainstorm** | `/bmad BP` | Idéation |
| **Party Mode** | `/bmad party` | Collaboration multi-agents |

### Skills d'implémentation (Superpowers)

| Skill | Quand l'utiliser |
|-------|-----------------|
| `superpowers:brainstorming` | Avant toute nouvelle fonctionnalité |
| `superpowers:systematic-debugging` | Face à un bug ou test qui échoue |
| `superpowers:test-driven-development` | Implémentation de feature ou bugfix |
| `superpowers:writing-plans` | Tâche multi-étapes |
| `superpowers:dispatching-parallel-agents` | 2+ tâches indépendantes |
| `superpowers:verification-before-completion` | Avant de déclarer une tâche terminée |
| `superpowers:requesting-code-review` | Après implémentation majeure |
| `superpowers:receiving-code-review` | Traitement d'un feedback de review |

### Skills locaux (`skills/`)

| Skill | Quand l'utiliser |
|-------|-----------------|
| `agent_planning_workflow` | Avant des changements complexes (rôle architecte) |
| `ai_self_refinement` | Détection de dérive des conventions |
| `rust_api_endpoint` | Création d'un endpoint Axum |
| `nextjs_component` | Création d'un composant Next.js |
| `db_migrations` | Migrations sqlx |
| `rust_debugging_workflow` | Patterns de debug Rust |
| `playwright_e2e_testing` | Tests E2E Playwright |

---

## 7. Configuration Rust (`rustfmt.toml`, `.cargo/config.toml`, `clippy.toml`)

### rustfmt.toml

```toml
max_width = 100              # Largeur max des lignes
imports_granularity = "Crate" # Groupement des imports
```

### clippy.toml

```toml
cognitive-complexity-threshold = 30
too-many-lines-threshold = 150
too-many-arguments-threshold = 8
```

### Cargo aliases (`.cargo/config.toml`)

```
cargo c     → cargo check
cargo t     → cargo test
cargo lint  → cargo clippy -D warnings
cargo fmt   → cargo fmt --all
```

### Profil release (`Cargo.toml`)

```toml
[profile.release]
lto = true
codegen-units = 1
panic = "abort"
strip = true
```

---

*Pour l'architecture complète, voir `docs/ARCHITECTURE.md`. Pour la référence API, voir `docs/API_REFERENCE.md`.*
