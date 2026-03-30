# Architecture — SignApps Platform

> Documentation technique interne — dernière mise à jour : 2026-03-30

---

## 1. Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CLIENT (Next.js 16 — port 3000)                │
│   App Router · React 19 · Zustand · shadcn/ui · Tailwind CSS 4         │
└────────────────────────────┬────────────────────────────────────────────┘
                             │ HTTP/REST  JWT Bearer
          ┌──────────────────▼──────────────────────────────────────┐
          │              signapps-gateway  (port 3099)              │
          │          Aggregator proxy — agrège les services         │
          └───┬──────┬──────┬──────┬──────┬──────┬──────┬──────────┘
              │      │      │      │      │      │      │
    ┌─────────▼─┐ ┌──▼───┐ ┌▼────┐ ┌▼───┐ ┌▼───┐ ┌▼──┐ ┌▼───────┐
    │ identity  │ │ cal- │ │ ai  │ │sto-│ │con-│ │me-│ │ autres │
    │ :3001     │ │ endar│ │:3005│ │rage│ │tai-│ │tri│ │services│
    │ Auth/RBAC │ │:3011 │ │ RAG │ │:3004│ │ners│ │cs │        │
    └─────┬─────┘ └──┬───┘ └──┬──┘ └─┬──┘ │:3002│ │:3008│ └────────┘
          │          │        │      │    └────┘ └───┘
          └──────────┴────────┴──────┴──────────────────────┐
                                                             │
          ┌──────────────────────────────────────────────────▼──────────┐
          │                  PostgreSQL (natif) + pgvector               │
          │   Schémas: identity · calendar · scheduling(deprecated)      │
          │   storage · chat · docs · forms · billing · social · …       │
          └──────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────▼──────────────┐
          │   signapps-cache (in-process)    │
          │   moka (TTL) + DashMap (compteurs)│
          └──────────────────────────────────┘
```

---

## 2. Principes architecturaux

### Microservices indépendants
Chaque service Rust est un binaire autonome avec son propre port, son propre état Axum et ses propres handlers. Les services ne se partagent pas de mémoire — toute communication passe par REST/WebSocket.

### Authentification JWT
Le crate `signapps-common` fournit `auth_middleware` : chaque requête protégée est validée via un JWT signé (HS256, secret configurable). Le struct `Claims` (sub: UUID, username, role: i16) est injecté dans tous les handlers via `Extension<Claims>`.

### Repository pattern
`signapps-db` expose des `*Repository` (ex. `EventRepository`, `UserRepository`) qui encapsulent toutes les requêtes SQL (`sqlx`). Les handlers ne touchent jamais `sqlx` directement.

### Trait-based workers (AI Gateway)
Chaque capacité IA implémente un trait `AiWorker` + un trait spécialisé (ex. `VisionWorker`, `ImageGenWorker`). Le `GatewayRouter` route automatiquement vers le meilleur backend disponible : Native > HTTP > Cloud.

### Zéro infrastructure externe requise
Pas de Redis, pas de Docker pour les services eux-mêmes. Le cache est `moka` (in-process). PostgreSQL tourne en natif (auto-détecté via `signapps-runtime`).

---

## 3. Services — Tableau complet

| Port | Service | Description | Dépendances principales |
|------|---------|-------------|------------------------|
| 3000 | frontend (Next.js) | Interface utilisateur complète | Tous les services |
| 3001 | signapps-identity | Auth, LDAP/AD, MFA TOTP, RBAC, groupes, API keys | PostgreSQL, moka |
| 3002 | signapps-containers | Cycle de vie Docker (bollard), app store, réseau | PostgreSQL, Docker daemon |
| 3003 | signapps-proxy | Reverse proxy, TLS/ACME, SmartShield, rate-limit | moka, PostgreSQL |
| 3004 | signapps-storage | Stockage fichiers (OpenDAL: FS ou S3), RAID, quotas | PostgreSQL, filesystem/S3 |
| 3005 | signapps-ai | Gateway IA : RAG, LLM, Vision, ImageGen, AudioGen | PostgreSQL, pgvector, GPU opt. |
| 3006 | signapps-securelink | Tunnels web, DNS ad-blocking | PostgreSQL |
| 3007 | signapps-scheduler | CRON jobs (absorbé dans calendar en migration 098) | PostgreSQL |
| 3008 | signapps-metrics | Monitoring système, Prometheus, alertes seuils | PostgreSQL, sysinfo |
| 3009 | signapps-media | STT/TTS/OCR natifs (whisper-rs, piper-rs, ocrs), WebSocket voix | GPU opt. |
| 3010 | signapps-docs | Édition collaborative (Tiptap), CRDT | PostgreSQL |
| 3011 | signapps-calendar | Calendrier unifié, congés, présence, fiches d'heures, CRON | PostgreSQL |
| 3012 | signapps-mail | Service email (IMAP/SMTP), synchronisation incrémentale FTS | PostgreSQL |
| 3013 | signapps-collab | Collaboration temps-réel (CRDT) | PostgreSQL |
| 3014 | signapps-meet | Visioconférence (LiveKit) | PostgreSQL |
| 3014* | signapps-contacts | Gestion de contacts (port configurable via SERVER_PORT) | PostgreSQL |
| 3015 | signapps-forms | Form builder, soumissions | PostgreSQL |
| 3015* | signapps-it-assets | Gestion actifs IT (port configurable via SERVER_PORT) | PostgreSQL |
| 3016 | signapps-pxe | Boot réseau PXE, déploiement images | PostgreSQL |
| 3017 | signapps-remote | Bureau à distance | PostgreSQL |
| 3018 | signapps-office | Suite bureautique (import/export, rapports) | PostgreSQL |
| 3019 | signapps-social | Gestion réseaux sociaux | PostgreSQL |
| 3019* | signapps-workforce | RH, gestion de la main-d'œuvre (port configurable) | PostgreSQL |
| 3020 | signapps-chat | Messagerie d'équipe, canaux | PostgreSQL |
| 3099 | signapps-gateway | API gateway aggregateur | Tous services |
| 8095 | signapps-notifications | Notifications push (Web Push, FCM) | PostgreSQL |
| 8096 | signapps-billing | Facturation, abonnements | PostgreSQL |

> `*` : partage de port par défaut — utiliser `SERVER_PORT` pour les faire coexister.

---

## 4. Crates partagés

### signapps-common

Bibliothèque de composants réutilisables entre tous les services.

**Modules principaux :**

| Module | Rôle |
|--------|------|
| `auth` | `Claims` (sub, username, role), décodage JWT |
| `error` | `AppError` / `ProblemDetails` (RFC 7807) |
| `middleware` | `auth_middleware`, `admin_middleware`, request ID, Prometheus |
| `types` | Value Objects : `Email`, `Password`, `UserId`, `Username` |
| `audit` | Journal d'audit in-memory + middleware |
| `alerts` | Système d'alertes avec règles et notifications multi-canal |
| `approval` | Workflow d'approbation multi-approbateur |
| `sso` | Base SSO pour SAML2 et OIDC |
| `dlp` | Data Loss Prevention (détection de données sensibles) |
| `pii` | Chiffrement PII AES-256-GCM avant stockage DB |
| `tenant` | Multi-tenant avec isolation de schéma |
| `workflows` | Moteur d'automatisation AI (trigger/condition/action) |
| `vault` | Gestionnaire de mots de passe intégré |
| `ueba` | User and Entity Behavior Analytics |
| `retention` | Politiques de rétention RGPD |

### signapps-db

Accès aux données via le pattern Repository.

**Structure :**
```
models/     → Structs Rust mappés aux tables PostgreSQL (Calendar, Event, User…)
repositories/ → Une *Repository par entité avec CRUD + requêtes métier
pool.rs     → create_pool(url) + run_migrations(pool)
```

**Repositories notables :**
- `EventRepository` — événements calendrier unifiés
- `VectorRepository` — pgvector 384 dimensions (embeddings texte nomic-embed)
- `MultimodalVectorRepository` — pgvector 1024 dimensions (SigLIP multimodal)
- `ConversationRepository` — historique conversations IA
- `CalendarHrRepository` — congés, présence, fiches d'heures

### signapps-cache

Cache in-process remplaçant Redis.

```rust
CacheService {
    cache: moka::future::Cache<String, String>,  // TTL-based
    counters: DashMap<String, AtomicI64>,        // compteurs atomiques
}
BinaryCacheService { cache: moka::future::Cache<String, Vec<u8>> }
```

**Usages :** rate-limiting (SmartShield), blacklist JWT, cache général, PDFs/documents lourds.

### signapps-runtime

Gestion du cycle de vie des dépendances système.

| Composant | Rôle |
|-----------|------|
| `RuntimeManager::ensure_database()` | Auto-détection PostgreSQL (DATABASE_URL → pg_isready → TCP) |
| `HardwareProfile::detect()` | Détection GPU (NVIDIA/AMD/Intel/Apple), VRAM, CPU cores |
| `ModelManager` | Téléchargement et cache des modèles IA (STT/TTS/OCR/LLM) |
| `InferenceBackend` | Sélection automatique : GPU CUDA/ROCm/Metal/Vulkan → CPU |

Cache modèles : `data/models/{stt,tts,ocr,llm,embeddings}/` (configurable via `MODELS_DIR`).

---

## 5. Communication inter-services

### REST APIs (HTTP/JSON)
- Convention : tous les endpoints sous `/api/v1/...`
- Format JSON, Content-Type: application/json
- Auth : `Authorization: Bearer <jwt>`
- Erreurs : RFC 7807 Problem Details

### WebSocket
- `signapps-calendar` — `/api/v1/calendars/:id/ws` (collaboration temps-réel)
- `signapps-media` — pipeline voix STT/TTS en temps réel
- `signapps-docs` — édition collaborative (Tiptap)
- `signapps-chat` — messagerie temps-réel

### Server-Sent Events (SSE)
- Streaming des réponses LLM (`/api/v1/chat/stream`)
- Logs de conteneurs en temps réel (xterm.js côté client)

### CalDAV
- `signapps-calendar` expose `/caldav/...` pour compatibilité clients tiers (Apple Calendar, Thunderbird)

---

## 6. Base de données

### PostgreSQL — Schémas

| Schéma | Contenu |
|--------|---------|
| `identity` | users, groups, roles, sessions, api_keys, audit_logs, tenants |
| `calendar` | calendars, events (unifié), tasks, resources, categories, presence_rules, leave_balances, timesheet_entries, approval_workflows |
| `scheduling` | **DÉPRÉCIÉ** depuis migration 098 — données migrées vers `calendar` |
| `storage` | buckets, files, quotas, raid_arrays, drive_nodes |
| `chat` | channels, messages, members |
| `docs` | documents, versions, collaborators |
| `forms` | forms, submissions, fields |
| `billing` | subscriptions, invoices, plans |
| `social` | social_accounts, posts, campaigns |

### Migrations

Format numéroté séquentiellement : `NNN_description.sql`. Les migrations sont idempotentes (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`). Gestion via `sqlx` au démarrage de chaque service.

Migrations clés :
- `093_calendar_unified_event_types.sql` — enums event_type, leave_type, presence_mode
- `095_calendar_hr_tables.sql` — categories, presence_rules, leave_balances, timesheet_entries
- `098_migrate_scheduling_to_calendar.sql` — absorption du scheduler dans le calendar

### pgvector

Extension PostgreSQL pour la recherche vectorielle :
- Index HNSW pour recherche approximative rapide
- Espace texte 384 dimensions (nomic-embed-text)
- Espace multimodal 1024 dimensions (SigLIP)
- Fusion RRF (Reciprocal Rank Fusion) pour recherche hybride

---

## 7. Frontend

### Stack

| Composant | Technologie |
|-----------|-------------|
| Framework | Next.js 16, App Router |
| UI Library | React 19 |
| State | Zustand (stores par domaine, pas de Redux) |
| Composants | shadcn/ui dans `components/ui/` |
| Styling | Tailwind CSS 4 |
| Forms | react-hook-form + zod |
| HTTP | Axios (client `client/src/lib/api/`) avec JWT auto-refresh |
| Terminal | xterm.js pour logs conteneurs |
| Temps réel | EventSource/SSE pour streaming LLM |
| Cartes | Leaflet pour vues cartographiques |
| Thème | Dark/Light mode, variable CSS-first |
| i18n | next-intl (fr/en) |

### Architecture des stores Zustand

Un store par domaine dans `client/src/stores/` :

```
auth.ts, calendar.ts, containers.ts, ai.ts, storage.ts,
chat.ts, mail.ts, docs.ts, metrics.ts, notifications.ts,
workforce.ts, contacts.ts, billing.ts, social.ts, ...
```

### Routing (App Router)

```
app/
  (auth)/login/        → Page de connexion
  (dashboard)/         → Layout protégé avec sidebar
    calendar/          → Calendrier unifié (11 vues)
    containers/        → Gestion Docker
    storage/           → Gestionnaire de fichiers
    ai/                → AI Gateway
    mail/              → Messagerie email
    chat/              → Messagerie équipe
    metrics/           → Tableau de bord monitoring
    identity/          → Administration utilisateurs
    ...
```

### Connexion automatique (développement)

`http://localhost:3000/login?auto=admin` — bypass du formulaire de login (développement uniquement).

---

## 8. AI Gateway (signapps-ai — port 3005)

### Architecture

```
gateway/
  GatewayRouter      → Route: Native > Http > Cloud
  QualityAdvisor     → Décide si cloud > local (qualité vs latence)
  CapabilityRegistry → Liste des workers disponibles par capacité

workers/
  llm/               → Chat, complétion (Ollama, vLLM, OpenAI, Anthropic, Gemini, llama.cpp)
  vision/            → Analyse image, VQA (multimodal vLLM, GPT-4o Vision)
  imagegen/          → Génération d'image (ComfyUI/A1111, DALL-E 3, candle SD/FLUX)
  videogen/          → Génération vidéo (HTTP, Replicate)
  video_understand/  → Analyse vidéo (HTTP, Gemini 1.5 Pro)
  audiogen/          → Génération audio/musique (HTTP, Replicate)
  reranker/          → Reclassement (TEI, Cohere, ONNX bge-reranker)
  embeddings_mm/     → Embeddings multimodaux (SigLIP HTTP, OpenAI, ONNX natif)
  docparse/          → Parsing document (ocrs natif, Azure Doc Intelligence)

rag/
  DualSpaceIndexer   → Indexation texte (384d) + multimodal (1024d)
  RrfFusionSearch    → Fusion RRF des deux espaces vectoriels
  CircularPipeline   → Les outputs IA sont ré-indexés automatiquement

memory/
  ConversationMemory → Historique de conversation par session
  ContextBuilder     → Construction du contexte pour le LLM
  AutoSummarizer     → Résumé automatique des conversations longues

models/
  ModelOrchestrator  → Gestion multi-GPU avec éviction LRU
  HardwareProfiles   → Profils par tier GPU (VRAM disponible)
```

### Feature flags natifs

| Flag | Backend activé |
|------|---------------|
| `native-reranker` | ONNX bge-reranker |
| `native-embedmm` | ONNX SigLIP |
| `native-vision` | llama.cpp multimodal |
| `native-imagegen` | candle Stable Diffusion / FLUX |
| `gpu-cuda` / `gpu-rocm` / `gpu-metal` / `gpu-vulkan` | Backend GPU |

---

## 9. Calendrier unifié (signapps-calendar — port 3011)

Voir `docs/CALENDAR_UNIFIED.md` pour la documentation complète.

### Vue d'ensemble

`signapps-calendar` absorbe `signapps-scheduler` (migration 098). Un seul service gère :
- Événements personnels / d'équipe / d'organisation
- Congés et absences avec workflow d'approbation
- Présence RH (télétravail, bureau, absent)
- Fiches d'heures (auto-générées depuis les événements)
- Tâches hiérarchiques (arbre avec parent/enfant)
- CRON jobs (migration depuis signapps-scheduler)

### Modèle unifié

La table `calendar.events` est étendue avec `event_type` (8 valeurs possibles) :

| Type | Description |
|------|-------------|
| `event` | Événement calendrier standard |
| `task` | Tâche avec statut et priorité |
| `leave` | Demande de congé (CP, RTT, maladie...) |
| `shift` | Permanence / astreinte |
| `booking` | Réservation de ressource |
| `milestone` | Jalon de projet |
| `blocker` | Bloqueur (temps réservé) |
| `cron` | Job planifié CRON |

---

## 10. Sécurité

### Authentification et autorisation

| Mécanisme | Détail |
|-----------|--------|
| JWT (HS256) | Secret ≥ 32 chars, expiry configurable |
| MFA TOTP | Setup/verify/disable via TOTP (RFC 6238) |
| LDAP/AD | Synchronisation et authentification LDAP |
| RBAC | Rôles numeriques (i16) : 0=user, 50=manager, 100=admin |
| API Keys | Clés générées avec hash, révocables |
| Guest Tokens | Tokens temporaires pour accès invité |

### Hachage des mots de passe

Argon2id (via `argon2` crate) avec paramètres par défaut sécurisés.

### Rate limiting

SmartShield dans `signapps-proxy` utilise `signapps-cache` (moka) pour le rate-limiting sans Redis. Compteurs atomiques `DashMap<String, AtomicI64>`.

### Chiffrement des données sensibles

`signapps-common::pii` — AES-256-GCM pour les champs PII (email, nom) avant stockage en base.

### DLP (Data Loss Prevention)

`signapps-common::dlp` — détection de patterns sensibles (numéros de carte, IBAN, données médicales) avant transmission.

### Sécurité des sessions

`signapps-identity` gère la blacklist JWT via `signapps-cache` (révocation immédiate sans rotation de clé).

---

## 11. Observabilité

### Logging structuré

Tous les services utilisent `tracing` + `tracing-subscriber` avec format JSON en production. Le request ID (`x-request-id`) est propagé dans tous les logs.

### OpenTelemetry

`signapps-common::middleware::metrics` exporte les métriques Prometheus sur `/metrics`. Intégration OTel disponible via feature flag.

### Prometheus

`signapps-metrics` (port 3008) agrège les métriques système (CPU, RAM, disque, réseau) via `sysinfo` et les métriques applicatives via Prometheus scrape.

### Alertes seuils

Système de règles configurable dans `signapps-common::alerts` : conditions (threshold, rate-of-change) + canaux (email, webhook, notification push).

---

## 12. Déploiement

### Images Docker

Le workflow `release.yml` publie sur GHCR (`ghcr.io/<org>/<service>`) pour les 8 services core lors d'un tag `v*` :

```
signapps-identity, signapps-containers, signapps-proxy, signapps-storage,
signapps-ai, signapps-securelink, signapps-scheduler, signapps-metrics
```

Tous les artifacts CI sont **privés** (pas de GitHub Pages, pas d'hébergement public).

### Développement natif

```bash
# PostgreSQL local (auto-détecté par RuntimeManager)
just db-start

# Démarrer tous les services
just start        # powershell scripts/start-all.ps1
just dev          # frontend Next.js port 3000

# Pipeline CI locale
just ci           # fmt-check + lint + test + audit + deny + docs-check
just ci-quick     # check + lint uniquement
```

### Configuration clé

```bash
DATABASE_URL=postgres://signapps:password@localhost:5432/signapps
JWT_SECRET=<32+ chars>
STORAGE_MODE=fs|s3
LLM_PROVIDER=ollama|vllm|openai|anthropic|llamacpp
GPU_BACKEND=auto|cuda|rocm|metal|vulkan|cpu
```

---

*Pour l'API complète, voir `docs/API_REFERENCE.md`. Pour le calendrier unifié en détail, voir `docs/CALENDAR_UNIFIED.md`. Pour les outils de développement, voir `docs/TOOLING.md`.*
