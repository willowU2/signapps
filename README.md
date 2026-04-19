# SignApps Platform

> Plateforme de gestion d'infrastructure et de collaboration d'entreprise.
> Microservices Rust (Axum/Tokio) + Frontend Next.js 16 (React 19, TypeScript).

![CI](https://github.com/signapps/signapps-platform/actions/workflows/ci.yml/badge.svg)
![Coverage](https://codecov.io/gh/signapps/signapps-platform/branch/main/graph/badge.svg)
![Rust](https://img.shields.io/badge/rust-1.75%2B-orange)
![Node](https://img.shields.io/badge/node-20%2B-green)
![License](https://img.shields.io/badge/license-Proprietary-red)

> **CONFIDENTIEL** — Projet strictement privé. Réservé aux membres de l'équipe interne.
> Voir [`INTERNAL_ONBOARDING.md`](INTERNAL_ONBOARDING.md) et [`SECURITY_POLICY.md`](SECURITY_POLICY.md).

---

## Vue d'ensemble

| Dimension | Détail |
|-----------|--------|
| Workspace Cargo | 40 membres (5 crates partagés + 1 app Tauri + 33 services + 1 gateway) |
| Microservices | 33 services Rust indépendants (Axum 0.7 / Tokio 1.36) |
| Frontend | Next.js 16 (App Router, React 19, TypeScript strict) — 180+ pages |
| Base de données | PostgreSQL 15+ natif + extension pgvector (recherche vectorielle) |
| Cache | moka in-process (remplace Redis pour la majorité des usages) |
| Stockage fichiers | OpenDAL (filesystem local ou S3 compatible) |
| AI Gateway | 10 capabilities (LLM, Vision, ImageGen, STT, TTS, OCR, RAG, Reranking…) |
| Calendrier unifié | 11 vues, layers superposables, congés RH, fiches d'heures, CRON |
| App desktop | Tauri 2.2 (src-tauri/) |
| OpenAPI | Code-first via utoipa — Swagger UI sur `/swagger-ui/` de chaque service |

---

## Démarrage rapide

```bash
# Prérequis : Rust 1.75+, Node.js 20+, Docker (PostgreSQL uniquement)
# Voir INTERNAL_ONBOARDING.md pour l'installation complète des outils

# 1. Variables d'environnement
cp .env.example .env
# Éditer .env : DATABASE_URL, JWT_SECRET (32+ chars minimum)

# 2. PostgreSQL
just db-start          # Lance postgres:17-alpine via Docker

# 3. Migrations
just db-migrate        # Applique migrations/ séquentiellement

# 4. Données démo (Acme Corp — 15 services, ~280 rows, idempotent)
just db-seed           # signapps-seed — remplace l'ancien script bash

# 5. Compiler le workspace
just build             # cargo build --workspace (debug)

# 6. Lancer les tests
just test              # cargo nextest run --workspace

# 7. Développement
just dev               # Frontend Next.js — port 3000
just run identity      # Service identity — port 3001
bacon                  # Watcher de compilation live
```

**Auto-login dev** : `http://localhost:3000/login?auto=admin`
**Seed users** : `admin` / `admin` ou `marie.dupont` / `Demo1234!` (+ 14 autres Acme users)

---

## Architecture

### Crates partagés

| Crate | Rôle |
|-------|------|
| `signapps-common` | JWT / Claims, AppError (RFC 7807), middleware auth/admin, value objects |
| `signapps-db` | Repository pattern, modèles sqlx, VectorRepository (384d), MultimodalVectorRepository (1024d) |
| `signapps-cache` | CacheService (moka TTL + DashMap compteurs atomiques) — rate limiting, blacklist JWT |
| `signapps-runtime` | RuntimeManager (PostgreSQL lifecycle), HardwareProfile (GPU/VRAM), ModelManager |
| `signapps-service` | Utilitaires de bootstrap des services |

### Services

| Port | Service | Description |
|------|---------|-------------|
| 3000 | `client/` (Next.js) | Frontend App Router |
| 3001 | `signapps-identity` | Auth, LDAP/AD, MFA (TOTP), RBAC, groupes |
| 3002 | `signapps-containers` | Cycle de vie conteneurs Docker (bollard) |
| 3003 | `signapps-proxy` | Reverse proxy, TLS/ACME, SmartShield |
| 3004 | `signapps-storage` | Stockage fichiers — OpenDAL (FS ou S3) |
| 3005 | `signapps-ai` | AI Gateway multimodal (10 capabilities, RAG, LLM, Vision) |
| 3006 | `signapps-securelink` | Tunnels web, DNS avec ad-blocking |
| 3007 | `signapps-scheduler` | Gestion des tâches CRON |
| 3008 | `signapps-metrics` | Monitoring système, Prometheus, alertes seuils |
| 3009 | `signapps-media` | STT/TTS/OCR natifs, pipeline voix WebSocket |
| 3010 | `signapps-docs` | Édition collaborative Tiptap |
| 3011 | `signapps-calendar` | Calendrier unifié (événements, congés, présence, timesheets) |
| 3012 | `signapps-mail` | Service email IMAP/SMTP |
| 3013 | `signapps-collab` | Collaboration temps réel (CRDT) |
| 3014 | `signapps-meet` | Vidéoconférence |
| 3015 | `signapps-forms` | Form builder & soumissions |
| 3016 | `signapps-pxe` | Boot réseau PXE |
| 3017 | `signapps-remote` | Bureau à distance |
| 3018 | `signapps-office` | Suite Office — import/export/rapports |
| 3019 | `signapps-social` | Gestion réseaux sociaux |
| 3020 | `signapps-chat` | Messagerie équipe & canaux |
| var. | `signapps-workforce` | RH & gestion du personnel |
| var. | `signapps-it-assets` | Gestion des actifs IT |
| var. | `signapps-contacts` | Gestion des contacts |
| 3099 | `signapps-gateway` | API Gateway agrégateur |
| 8095 | `signapps-notifications` | Notifications push |
| 8096 | `signapps-billing` | Facturation & abonnements |

> Services partageant un port (`workforce`, `it-assets`, `contacts`) : utiliser `SERVER_PORT` pour les différencier en dev.

---

## Stack technique

| Composant | Technologie | Rôle |
|-----------|-------------|------|
| Runtime async | Tokio 1.36 | Exécuteur async Rust |
| Framework web | Axum 0.7 | Router HTTP, middleware, WebSocket |
| Base de données | PostgreSQL 15+ + pgvector | Données relationnelles + vecteurs |
| ORM/Migrations | sqlx 0.7 (compile-time checked) | Requêtes typées, migrations séquentielles |
| Cache in-process | moka 0.12 | Cache TTL et compteurs atomiques |
| Stockage | OpenDAL 0.51 | Abstraction FS/S3 |
| Auth | jsonwebtoken 9, argon2 0.5 | JWT + hachage de mots de passe |
| MFA | totp-rs 5 | TOTP (Google Authenticator compatible) |
| LDAP/AD | ldap3 0.11 | Authentification annuaire |
| Observabilité | tracing + OpenTelemetry + Prometheus | Spans distribués, métriques |
| OpenAPI | utoipa 5 + swagger-ui 8 | Documentation code-first automatique |
| Erreurs | thiserror (crates) + anyhow (services) | Erreurs typées et contextuelles |
| Full-text search | tantivy 0.22 | Moteur de recherche embarqué |
| AI — LLM natif | llama-cpp-2 (GGUF) | Inférence modèles GGUF locale |
| AI — STT natif | whisper-rs | Transcription vocale (Whisper) |
| AI — TTS natif | piper-rs | Synthèse vocale (Piper) |
| AI — OCR natif | ocrs + rten | Reconnaissance optique de caractères |
| Détection GPU | sysinfo | NVIDIA / AMD / Intel / Apple / CPU |
| App desktop | Tauri 2.2 | Application native cross-platform |
| Frontend | Next.js 16, React 19, TypeScript | App Router, SSR |
| UI Components | shadcn/ui + Tailwind CSS 4 | Design system interne |
| State frontend | Zustand | Stores globaux (pas Redux) |
| Formulaires | react-hook-form + zod | Validation typée |
| HTTP client | Axios avec auto-refresh JWT | Communication frontend → services |

---

## Commandes essentielles

Toutes les commandes principales passent par `just`. Lister : `just --list`.

### Build & Run

| Commande | Description |
|----------|-------------|
| `just check` | `cargo check --workspace --all-features` |
| `just build` | Build debug du workspace entier |
| `just build-release` | Build release (LTO + strip) |
| `just build-svc <name>` | Build un service (`just build-svc identity`) |
| `just run <name>` | Lancer un service (`just run calendar`) |
| `just dev` | Frontend Next.js sur port 3000 |
| `just start` | Tous les services (PowerShell) |
| `just stop` | Arrêter tous les services |
| `just status` | Health-check rapide des services principaux |

### Tests & Qualité

| Commande | Description |
|----------|-------------|
| `just test` | Tests rapides (cargo-nextest, parallèle) |
| `just test-crate <crate>` | Tests d'un seul crate |
| `just lint` | Clippy `-D warnings` |
| `just fmt` | Formatage automatique |
| `just fmt-check` | Vérification formatage (CI) |
| `just audit` | Audit CVE (cargo-audit) |
| `just deny` | Licences + vulnérabilités (cargo-deny) |
| `just coverage` | Couverture llvm-cov → `lcov.info` |
| `just coverage-html` | Rapport HTML → `target/llvm-cov/html/` |
| `just mutants` | Mutation testing workspace |
| `just mutants-crate <c>` | Mutation testing ciblé |
| `just test-e2e` | Tests E2E Playwright |
| `just ci` | Pipeline locale complète (fmt + lint + test + audit + deny + docs) |
| `just ci-quick` | Vérification rapide (check + lint) |

### Base de données

| Commande | Description |
|----------|-------------|
| `just db-start` | PostgreSQL Docker (postgres:17-alpine) |
| `just db-stop` | Arrêter PostgreSQL |
| `just db-migrate` | Appliquer les migrations SQL |
| `just db-backup` | Backup PostgreSQL |
| `just db-seed` | Seed des données de démonstration |

### Documentation & Maintenance

| Commande | Description |
|----------|-------------|
| `just docs` | rustdoc workspace → `target/doc/` |
| `just docs-private` | rustdoc avec items privés |
| `just rdme` | Sync README crates depuis `lib.rs` (cargo-rdme) |
| `just changelog` | Générer `CHANGELOG.md` (git-cliff) |
| `just changelog-preview` | Aperçu changelog sans écrire |
| `just watch` | Watcher bacon (recompilation live) |
| `just clean` | Nettoyage complet build + cache frontend |

---

## Qualité et CI

### Pipeline CI — 11 jobs parallèles

| # | Job | Bloquant | Description |
|---|-----|:--------:|-------------|
| 1 | `check` | oui | `cargo check --workspace --all-features` |
| 2 | `check-offline` | oui | `SQLX_OFFLINE=true` (sans DB, vérifie les requêtes compilées) |
| 3 | `fmt` | oui | `cargo fmt --all -- --check` |
| 4 | `clippy` | oui | `cargo clippy -D warnings` |
| 5 | `clippy-pedantic` | non | Pedantic + nursery (advisory seulement) |
| 6 | `test` | oui | `cargo nextest` + PostgreSQL 15 + pgvector |
| 7 | `deny` | oui | `cargo deny check` — licences + vulnérabilités |
| 8 | `security` | oui | `cargo audit` — CVE via RUSTSEC |
| 9 | `frontend` | oui | ESLint + type-check TypeScript + `next build` |
| 10 | `coverage` | non | llvm-cov → Codecov (artifact privé) |
| 11 | `docs` | oui | `rustdoc --document-private-items` → artifact GitHub privé |

### Git Hooks (pre-commit)

| Hook | Comportement |
|------|-------------|
| Détection de secrets | Bloque sur `password`, `api_key`, `token`, `AWS_ACCESS_KEY`, `private_key` |
| cargo fmt | Bloque si code non formaté |
| clippy | Avertissement (bloquer avec `TSC_STRICT=1`) |

### Conventional Commits (obligatoires)

Format : `<type>(<scope>): <description>`

| Type | Usage |
|------|-------|
| `feat` | Nouvelle fonctionnalité |
| `fix` | Correction de bug |
| `perf` | Amélioration de performance |
| `refactor` | Refactoring sans changement de comportement |
| `docs` | Documentation uniquement |
| `test` | Ajout ou modification de tests |
| `chore` | Maintenance (deps, config, tooling) |
| `ci` | Pipeline CI/CD |

---

## AI Gateway (signapps-ai — port 3005)

Architecture gateway multimodal avec workers à backends multiples (natif > HTTP > cloud) :

| Capability | Backends natifs | Backends cloud |
|-----------|----------------|----------------|
| LLM (chat) | llama-cpp-2 (GGUF) | Ollama, vLLM, OpenAI, Anthropic, Gemini |
| Vision | llama.cpp multimodal | GPT-4o Vision, vLLM multimodal |
| Image gen | candle (SD/FLUX) | DALL-E 3, ComfyUI, A1111 |
| STT | whisper-rs | HTTP backend, cloud |
| TTS | piper-rs | HTTP backend, cloud |
| OCR | ocrs + rten | Azure Document Intelligence |
| Reranking | ONNX bge-reranker | Cohere, TEI |
| Embeddings texte | nomic-embed 384d (pgvector) | OpenAI |
| Embeddings MM | ONNX SigLIP 1024d | OpenAI CLIP |
| RAG | Dual-space pgvector (384d + 1024d) + RRF fusion | — |

Routing automatique : **Native > HTTP > Cloud** (sauf si qualité cloud >> local).

---

## Calendrier unifié (signapps-calendar — port 3011)

Feature centrale de la plateforme :

| Aspect | Détail |
|--------|--------|
| Vues | 11 vues : Jour, Semaine (5j/7j), Mois, Année, Agenda, Timeline, Kanban, Gantt, Step-chart, Liste |
| Types d'événements | `event`, `task`, `leave` (congé), `shift` (planning), `booking`, `milestone`, `blocker`, `cron` |
| Layers superposables | Calendriers personnel, équipe, congés RH, plannings, tâches projet — activation individuelle |
| Intégration RH | Workflow d'approbation des congés, types de congés (payés, maladie, RTT…) |
| Fiches d'heures | Saisie, validation manager, export — intégré dans la vue calendrier |
| Visualisation CRON | Jobs scheduler visibles dans la vue Step-chart |
| Collaboration | Invitations, partage, visibilité par rôle (RBAC) |

---

## Documentation

| Ressource | Accès |
|-----------|-------|
| Guide d'intégration | [`INTERNAL_ONBOARDING.md`](INTERNAL_ONBOARDING.md) |
| Conventions & architecture | [`CLAUDE.md`](CLAUDE.md) |
| Politique de sécurité | [`SECURITY_POLICY.md`](SECURITY_POLICY.md) |
| Variables d'environnement | [`.env.example`](.env.example) |
| rustdoc workspace | `just docs` → `target/doc/` |
| rustdoc privé | `just docs-private` → `target/doc/` |
| Swagger UI | `http://localhost:<port>/swagger-ui/` (chaque service) |
| OpenAPI JSON | `http://localhost:<port>/api-docs/openapi.json` |
| Changelog | [`CHANGELOG.md`](CHANGELOG.md) — généré via `just changelog` |

---

## Structure du dépôt

```
crates/               # Crates partagés (common, db, cache, runtime, service)
services/             # 33 microservices Rust (un binaire par service)
src-tauri/            # Application desktop Tauri 2.2
client/               # Frontend Next.js 16 (App Router, port 3000)
migrations/           # Migrations PostgreSQL séquentielles (sqlx)
scripts/              # start-all, stop, pg-backup, seed, rotate-logs
data/                 # Données locales gitignored
  models/             # Cache modèles IA (STT, TTS, OCR, LLM, embeddings)
  storage/            # Stockage fichiers local
.cargo/               # config.toml (aliases cargo : c, t, lint, fmtall, precommit)
justfile              # 35+ recettes (build, test, ci, db, docs, changelog)
Cargo.toml            # Workspace + dépendances partagées
deny.toml             # cargo-deny (licences + vulnérabilités)
cliff.toml            # git-cliff (CHANGELOG Conventional Commits)
bacon.toml            # bacon (watcher de compilation)
rustfmt.toml          # max_width=100, imports groupés
clippy.toml           # cognitive-complexity=30, too-many-lines=150
```

---

## Confidentialité

**Ce dépôt est la propriété exclusive de l'organisation SignApps.**

- Publication interdite sur crates.io, npm public, Docker Hub public ou tout dépôt public
- Aucune documentation ne doit être déployée sur GitHub Pages ou tout site accessible publiquement
- Les artefacts CI (rustdoc, couverture) sont des artifacts GitHub privés uniquement
- Les secrets (JWT, clés API, credentials DB) ne doivent jamais être commis ni partagés hors des canaux internes sécurisés
- L'utilisation de services IA externes (ChatGPT, Copilot…) pour soumettre du code est soumise à validation préalable par le responsable sécurité
- Tout incident ou fuite suspectée doit être signalé immédiatement au responsable sécurité

*En travaillant sur ce projet, vous acceptez ces conditions de confidentialité.*

---

*Document interne — équipe SignApps — 2026*
