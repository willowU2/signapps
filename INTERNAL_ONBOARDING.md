# Guide d'intégration interne — SignApps Platform

> **CONFIDENTIEL** — Document réservé aux membres de l'équipe interne. Ne pas diffuser.

---

## 1. Bienvenue

Bienvenue dans l'équipe SignApps. Ce guide remplace tout document de contribution publique — ce projet est **strictement privé** et n'accepte aucune contribution externe.

SignApps Platform est une infrastructure de gestion de microservices d'entreprise. Elle est composée de :

- **Backend** : 20+ microservices en Rust (Axum / Tokio), organisés en workspace Cargo
- **Frontend** : Application Next.js 16 (React 19, TypeScript, App Router), port 3000
- **Base de données** : PostgreSQL natif + extension pgvector pour la recherche vectorielle
- **IA native** : Inférence GGUF (llama-cpp-2), STT (whisper-rs), TTS (piper-rs), OCR (ocrs)
- **Équipe** : 40 membres workspace (développeurs, architectes, ops)

Toutes les dépendances système s'exécutent **en natif** — aucun Docker n'est requis pour les services applicatifs (PostgreSQL peut être lancé via Docker en développement local).

---

## 2. Prérequis

### Outils obligatoires

| Outil | Version minimale | Installation |
|---|---|---|
| Rust (rustup) | 1.75+ | https://rustup.rs |
| Node.js | 20+ | https://nodejs.org |
| PostgreSQL | 15+ | Natif ou Docker |
| Git | 2.40+ | Gestionnaire de paquets système |

### Outils cargo à installer

```bash
cargo install cargo-binstall
cargo binstall -y cargo-nextest bacon cargo-mutants git-cliff just cargo-deny cargo-audit
```

Description des outils :

- **cargo-nextest** — Exécuteur de tests plus rapide et plus lisible que `cargo test`
- **bacon** — Watcher de compilation en arrière-plan, feedback live sur les erreurs
- **cargo-mutants** — Test de mutation pour évaluer la robustesse des tests
- **git-cliff** — Génération automatique du CHANGELOG depuis les commits conventionnels
- **just** — Gestionnaire de recettes (remplace Makefile), voir `justfile` à la racine
- **cargo-deny** — Contrôle des licences et des vulnérabilités des dépendances
- **cargo-audit** — Audit des CVE via la base RUSTSEC

### Composants optionnels

- **GPU CUDA / ROCm / Metal** — Nécessaire pour les backends d'IA natifs (LLM, image gen)
- **llvm-tools-preview** — Nécessaire pour la couverture de code : `rustup component add llvm-tools-preview`

---

## 3. Configuration locale

### Étape 1 — Cloner le dépôt

```bash
git clone <url-interne-du-repo> signapps-platform
cd signapps-platform
```

### Étape 2 — Variables d'environnement

```bash
cp .env.example .env
```

Ouvrir `.env` et configurer au minimum :

```env
DATABASE_URL=postgres://signapps:password@localhost:5432/signapps
JWT_SECRET=<chaine-aleatoire-32-chars-minimum>
STORAGE_MODE=fs
STORAGE_FS_ROOT=./data/storage
```

Le fichier `.env` est gitignored. Ne jamais commettre de secrets dans le dépôt.

### Étape 3 — Démarrer PostgreSQL

```bash
just db-start        # Lance PostgreSQL via Docker (image postgres:15 + pgvector)
```

Si vous utilisez une installation PostgreSQL native, assurez-vous que l'extension `pgvector` est installée et que l'utilisateur `signapps` existe avec les droits sur la base `signapps`.

### Étape 4 — Appliquer les migrations

```bash
just db-migrate      # Exécute sqlx migrate run sur DATABASE_URL
```

Les fichiers de migration se trouvent dans `migrations/`. Ils sont versionnés et séquentiels.

### Étape 5 — Compiler le workspace

```bash
just build           # cargo build --workspace
```

La première compilation prend plusieurs minutes (dépendances Rust). Les builds suivants sont incrémentaux.

### Étape 6 — Vérifier l'installation

```bash
just test            # cargo nextest run --workspace --all-features
```

Tous les tests doivent passer avant de commencer à développer.

---

## 4. Stack de développement

| Outil | Commande principale | Rôle |
|---|---|---|
| **just** | `just <recette>` | Orchestration des tâches (build, test, db, ci) |
| **bacon** | `bacon` | Recompilation live, feedback immédiat sur les erreurs |
| **cargo-nextest** | `just test` | Exécution des tests unitaires et d'intégration |
| **cargo-llvm-cov** | `just coverage` | Couverture de code (rapport HTML + lcov) |
| **cargo-mutants** | `just mutants` | Test de mutation sur les fonctions critiques |
| **cargo-deny** | `just deny` | Vérification des licences et CVE des dépendances |
| **cargo-audit** | `just audit` | Audit de sécurité via RUSTSEC |
| **git-cliff** | `just changelog` | Génération du CHANGELOG depuis les commits |
| **clippy** | `just lint` | Linting Rust strict (`-D warnings`) |
| **rustfmt** | `just fmt` | Formatage automatique du code |

### Recettes just disponibles

```bash
just                 # Affiche toutes les recettes disponibles
just build           # Compiler le workspace (debug)
just build-release   # Compiler en release (LTO activé)
just test            # Lancer tous les tests
just lint            # Clippy + fmt check
just fmt             # Formater le code
just ci              # Chaîne complète : fmt check + clippy + test + audit + deny
just db-start        # Démarrer PostgreSQL
just db-stop         # Arrêter PostgreSQL
just db-migrate      # Appliquer les migrations
just db-reset        # Remettre à zéro la base (DESTRUCTIF)
just audit           # cargo audit
just deny            # cargo deny check
just coverage        # Couverture de code llvm-cov
just changelog       # Générer le CHANGELOG
```

---

## 5. Conventions de code

### Commits conventionnels (obligatoires)

Tous les commits doivent suivre le format [Conventional Commits](https://www.conventionalcommits.org/) :

```
<type>(<scope>): <description courte>

[corps optionnel]

[pied de page optionnel]
```

Types autorisés :

| Type | Usage |
|---|---|
| `feat` | Nouvelle fonctionnalité |
| `fix` | Correction de bug |
| `refactor` | Refactoring sans changement de comportement |
| `perf` | Amélioration de performance |
| `test` | Ajout ou modification de tests |
| `docs` | Documentation uniquement |
| `chore` | Tâches de maintenance (deps, CI, tooling) |
| `ci` | Modifications du pipeline CI |
| `build` | Système de build ou dépendances externes |

Exemples valides :

```bash
git commit -m "feat(calendar): add leave approval workflow"
git commit -m "fix(identity): handle expired JWT refresh token"
git commit -m "refactor(ai): extract vision worker trait"
git commit -m "chore(deps): update axum to 0.8.1"
```

### Règles Rust

- **Pas de `println!` en production** — Utiliser `tracing::info!/warn!/error!`
- **Pas de `.unwrap()` en dehors des tests** — Utiliser `?`, `.expect("contexte")` ou traiter l'erreur
- **`#[instrument]` sur les handlers** — Permet le tracing distribué automatique
- **`#[derive(utoipa::ToSchema)]` sur les DTOs** — Génération automatique de la doc OpenAPI
- **`///` rustdoc sur tous les types publics** — Minimum : une ligne de description
- **Erreurs** : `thiserror` pour les crates bibliothèque, `anyhow` pour les services applicatifs
- **Longueur de ligne** : 100 caractères max (rustfmt.toml)
- **Complexité cognitive** : max 30 (clippy.toml)

### Règles TypeScript/Frontend

- TypeScript strict activé (pas de `any` implicite)
- Alias de chemin `@/*` pour les imports depuis `src/`
- Composants UI : shadcn/ui en priorité, Tailwind CSS 4 pour le style
- État global : Zustand (pas de Redux)
- Formulaires : react-hook-form + validation zod
- Pas de `console.log` en production (ESLint le bloque)

---

## 6. Workflow quotidien

### Démarrage de session

```bash
# 1. Démarrer la base de données
just db-start

# 2. Lancer le watcher de compilation (dans un terminal dédié)
bacon

# 3. Lancer le service sur lequel vous travaillez
cargo run -p signapps-identity   # exemple
# ou
cd client && npm run dev         # frontend
```

### Développement

```bash
# Écrire le code...

# Lancer les tests du crate concerné
cargo nextest run -p signapps-identity

# Ou tous les tests
just test
```

### Avant chaque commit

```bash
# Validation complète obligatoire
just ci
# Équivalent à : fmt check + clippy -D warnings + nextest + audit + deny
```

### Créer un commit

```bash
git add <fichiers-concernés>
git commit -m "feat(calendar): add leave approval"
```

### Workflow de branche

- `main` — Branche principale, toujours stable et déployable
- `develop` — Intégration continue des features en cours
- `feat/<nom>` — Feature branch (depuis `develop`)
- `fix/<nom>` — Bugfix branch
- `hotfix/<nom>` — Correctif urgent (depuis `main`)

Toute modification passe par une pull request interne avec revue de code par au moins un autre membre de l'équipe.

---

## 7. Architecture

### Structure du dépôt

```
crates/                     # Crates partagées
  signapps-common/          # JWT, middleware, AppError, value objects
  signapps-db/              # Modèles, repositories, migrations, pgvector
  signapps-cache/           # Cache TTL in-process (moka)
  signapps-runtime/         # PostgreSQL lifecycle, hardware detection, model manager

services/                   # Microservices (un binaire par service)
  signapps-identity/        # Port 3001 — Auth, LDAP/AD, MFA, RBAC
  signapps-containers/      # Port 3002 — Cycle de vie des conteneurs Docker
  signapps-proxy/           # Port 3003 — Reverse proxy, TLS/ACME
  signapps-storage/         # Port 3004 — Stockage fichiers (OpenDAL)
  signapps-ai/              # Port 3005 — Gateway IA (RAG, LLM, Vision, ImageGen)
  signapps-metrics/         # Port 3008 — Monitoring système, Prometheus
  signapps-media/           # Port 3009 — STT/TTS/OCR, pipeline voix WebSocket
  signapps-calendar/        # Port 3011 — Calendrier et planification
  signapps-mail/            # Port 3012 — Service email
  signapps-chat/            # Port 3020 — Messagerie équipe
  signapps-workforce/       # RH et gestion du personnel
  signapps-contacts/        # Gestion des contacts
  signapps-billing/         # Port 8096 — Facturation
  # ... et 10+ autres services

client/                     # Frontend Next.js 16 (port 3000)
migrations/                 # Migrations PostgreSQL (sqlx, séquentielles)
scripts/                    # Scripts de démarrage/arrêt, backup, rotation logs
data/                       # Données locales (gitignored)
  models/                   # Cache des modèles IA (STT, TTS, OCR, LLM)
  storage/                  # Stockage fichiers local
```

### Patterns communs

- **Service Rust** : `main.rs` (router Axum + état partagé) + `handlers/` (logique métier)
- **Authentification** : Middleware JWT depuis `signapps-common`, injecte `Claims` dans les handlers
- **Erreurs** : `AppError` (RFC 7807 Problem Details), tous les handlers retournent `Result<_, AppError>`
- **Repository pattern** : Chaque entité a un `*Repository` avec CRUD prenant `&PgPool`
- **Frontend** : Axios avec auto-refresh JWT (`client/src/lib/api.ts`), URLs par service

---

## 8. Contacts internes

| Rôle | Responsabilité | Contact |
|---|---|---|
| Architecte principal | Décisions d'architecture, revues techniques | _[à renseigner]_ |
| Lead backend Rust | Standards Rust, revues crates et services | _[à renseigner]_ |
| Lead frontend | Standards TypeScript/React, revues UI | _[à renseigner]_ |
| Responsable sécurité | Audits, gestion des vulnérabilités | _[à renseigner]_ |
| DevOps / Ops | Déploiement, infrastructure, CI/CD | _[à renseigner]_ |
| Responsable données | Schémas DB, migrations, pgvector | _[à renseigner]_ |

Pour les questions urgentes liées à la sécurité, contacter directement le responsable sécurité via le canal interne dédié.

---

## 9. Confidentialité

**Ce projet est strictement confidentiel.**

- Tout le code source, la documentation, les schémas d'architecture et les artefacts de build sont la propriété exclusive de l'organisation.
- Il est **interdit** de partager du code, des extraits, des logs ou tout artefact lié à ce projet sur des plateformes publiques (GitHub public, StackOverflow, forums, réseaux sociaux, etc.).
- Les clés API, secrets JWT, credentials de base de données et certificats ne doivent **jamais** être commis dans le dépôt ni partagés hors des canaux sécurisés internes.
- L'utilisation de services d'IA externes (ChatGPT, GitHub Copilot, etc.) pour soumettre du code de ce projet est **soumise à validation préalable** par le responsable sécurité.
- Tout incident de sécurité ou fuite suspectée doit être signalé **immédiatement** au responsable sécurité.

En rejoignant ce projet, vous acceptez ces conditions de confidentialité.

---

*Document maintenu par l'équipe architecture — dernière mise à jour : 2026-03*
