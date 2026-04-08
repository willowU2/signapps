# Architecture — SignApps Platform

> Documentation technique interne — dernière mise à jour : 2026-04-08
> (session de refactoring majeure — voir `docs/architecture/refactors/` pour les design docs)

---

## 1. Vue d'ensemble

SignApps Platform est une alternative auto-hébergée à Google Workspace / Microsoft 365, conçue pour les entreprises francophones. L'architecture est multi-tenant (isolation par `tenant_id` dans chaque requête SQL), stateless côté services Rust (JWT RS256), et sans infrastructure externe obligatoire (pas de Redis, pas de message broker externe — le cache est in-process via moka, l'async inter-services via `PgEventBus` + outbox pattern).

La plate-forme comprend 32 microservices Rust (Axum/Tokio) exposés derrière un API gateway aggregateur. Le frontend est une SPA Next.js 16 (App Router, React 19) qui communique exclusivement avec le gateway sur le port 3099.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      CLIENT (Next.js 16 — port 3000)                    │
│   App Router · React 19 · Zustand · shadcn/ui · Tailwind CSS 4         │
└────────────────────────────┬────────────────────────────────────────────┘
                             │ HTTP/REST  JWT Bearer (RS256)
          ┌──────────────────▼──────────────────────────────────────┐
          │              signapps-gateway  (port 3099)              │
          │          Aggregator proxy — routes vers les services     │
          └───┬──────┬──────┬──────┬──────┬──────┬──────┬──────────┘
              │      │      │      │      │      │      │
    ┌─────────▼──┐ ┌─▼────┐ ┌▼───┐ ┌▼───┐ ┌▼───┐ ┌▼──┐ ┌▼────────┐
    │ identity   │ │ cal- │ │ ai │ │sto-│ │ sha│ │vau│ │  autres │
    │ :3001 IAM  │ │ endar│ │:3005│ │rage│ │ ring│ │lt │ │services │
    │ auth/RBAC  │ │ :3011│ │ RAG│ │:3004│ │crate│ │:3025│        │
    └─────┬──────┘ └──┬───┘ └─┬──┘ └─┬──┘ └────┘ └───┘ └─────────┘
          │           │       │      │
          └───────────┴───────┴──────┴──────────────────────────────┐
                                                                     │
          ┌──────────────────────────────────────────────────────────▼──┐
          │              PostgreSQL (natif) + pgvector                   │
          │   Schémas: identity · calendar · storage · sharing · …      │
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
Chaque service Rust est un binaire autonome avec son propre port, son propre état Axum et ses propres handlers. Les services ne se partagent pas de mémoire — toute communication synchrone passe par REST, la communication asynchrone par `PgEventBus` (outbox pattern sur PostgreSQL).

### Authentification JWT RS256 + JWKS
`signapps-common` fournit `auth_middleware` : chaque requête protégée est validée via un JWT signé **RS256** (clé asymétrique). La clé publique est exposée sur `/.well-known/jwks.json` de `signapps-identity`, permettant à chaque service de valider les tokens localement sans appel réseau. Le struct `Claims` (sub: UUID, username, role: i16) est injecté via `Extension<Claims>`.

### Bounded-context data layer
`signapps-db` est un crate umbrella qui re-exporte 13 sous-crates contextuels (voir section 4). Chaque service ne dépend que du sous-crate de son domaine, réduisant le graphe de compilation et renforçant les frontières de domaine.

### Unified Sharing Engine
`signapps-sharing` (crate partagé) fournit un moteur de permissions unique pour tous les types de ressources. Les services l'intègrent via `sharing_routes(prefix, ResourceType)` + `sharing_global_routes()`. L'ancienne fragmentation (`drive.acl`, `calendar_members`, `document_permissions`) a été abandonnée.

### Repository pattern
Les sous-crates `signapps-db-*` exposent des `*Repository` qui encapsulent toutes les requêtes SQL (`sqlx`). Les handlers ne touchent jamais `sqlx` directement et passent toujours `tenant_id` en paramètre.

### Zéro infrastructure externe requise
Pas de Redis, pas de Docker pour les services eux-mêmes. Le cache est `moka` (in-process). PostgreSQL tourne en natif (auto-détecté via `signapps-runtime`).

---

## 3. Services — Tableau complet

| Port  | Service                   | Description                                          |
|-------|---------------------------|------------------------------------------------------|
| 3000  | frontend (Next.js)        | Interface utilisateur complète                       |
| 3001  | signapps-identity         | IAM core : auth, LDAP/AD, MFA, RBAC, sessions, API keys, JWKS |
| 3002  | signapps-containers       | Cycle de vie Docker (bollard), app store, réseau     |
| 3003  | signapps-proxy            | Reverse proxy, TLS/ACME, SmartShield, rate-limit     |
| 3004  | signapps-storage          | Stockage fichiers (OpenDAL: FS ou S3), RAID, quotas  |
| 3005  | signapps-ai               | Gateway IA : RAG, LLM, Vision, ImageGen, Audio       |
| 3006  | signapps-securelink       | Tunnels web, DNS ad-blocking, DHCP listener          |
| 3007  | signapps-scheduler        | CRON job management                                  |
| 3008  | signapps-metrics          | Monitoring système, Prometheus, alertes seuils       |
| 3009  | signapps-media            | STT/TTS/OCR natifs (whisper-rs, piper-rs, ocrs)      |
| 3010  | signapps-docs             | Édition collaborative, CRDT, import/export office    |
| 3011  | signapps-calendar         | Calendrier unifié, congés, présence, timesheets      |
| 3012  | signapps-mail             | Email IMAP/SMTP, synchronisation FTS                 |
| 3014  | signapps-meet             | Visioconférence (LiveKit) + bureau à distance        |
| 3015  | signapps-forms            | Form builder, soumissions                            |
| 3016  | signapps-pxe              | Boot réseau PXE, déploiement images, DC network boot |
| 3019  | signapps-social           | Gestion réseaux sociaux                              |
| 3020  | signapps-chat             | Messagerie d'équipe, canaux                          |
| 3021  | signapps-contacts         | Gestion de contacts (CRM/personnes)                  |
| 3022  | signapps-it-assets        | Gestion actifs IT, sites, ressources                 |
| 3024  | signapps-workforce        | RH, gestion de la main-d'œuvre, LMS, supply chain    |
| 3025  | signapps-vault            | Gestionnaire de mots de passe et credentials         |
| 3026  | signapps-org              | Structure organisationnelle (nœuds, arbres, missions)|
| 3027  | signapps-webhooks         | Webhooks sortants, réception webhooks entrants        |
| 3028  | signapps-signatures       | Signatures électroniques, tampons utilisateurs        |
| 3029  | signapps-tenant-config    | Branding tenant, CSS de personnalisation              |
| 3030  | signapps-integrations     | Intégrations externes (Slack, Teams, Discord)         |
| 3031  | signapps-backup           | Sauvegarde base de données et fichiers                |
| 3032  | signapps-compliance       | Conformité RGPD, export de données, rétention, audit  |
| 3099  | signapps-gateway          | API gateway aggregateur                               |
| 8095  | signapps-notifications    | Notifications push (Web Push, FCM)                    |
| 8096  | signapps-billing          | Facturation, abonnements, comptabilité FEC            |

**Services fusionnés (2026-04-08) :**
- `signapps-remote` (3017) → absorbé dans `signapps-meet` (3014)
- `signapps-collab` (3013) + `signapps-office` (3018) → fusionnés dans `signapps-docs` (3010)

---

## 4. Architecture des crates

### Crates partagés principaux

#### signapps-common (~4 000 lignes après slimming)

Bibliothèque de composants fondamentaux réutilisables entre tous les services.

| Module | Rôle |
|--------|------|
| `auth` | `Claims` (sub, username, role), décodage JWT RS256, JWKS |
| `error` | `AppError` / `ProblemDetails` (RFC 7807) |
| `middleware` | `auth_middleware`, `admin_middleware`, request ID, Prometheus |
| `types` | Value Objects : `Email`, `Password`, `UserId`, `Username` |
| `tenant` | Multi-tenant avec isolation par `tenant_id` |
| `sso` | Base SSO pour SAML2 et OIDC |

> Les 27 modules extraits (DLP, PII, audit, vault-types, workflows, alertes, approbations, etc.) vivent désormais dans leurs crates dédiés — voir section ci-dessous.

#### signapps-sharing (crate unifié de permissions)

Moteur de partage/permissions centralisé exposant :
- `SharingEngine` — résolveur avec walk-up inheritance (CTE récursif PostgreSQL)
- `sharing_routes(prefix, ResourceType)` — routes par type de ressource
- `sharing_global_routes()` — templates, audit, bulk-grant, shared-with-me
- Cache L2 (OnceLock sur capabilities, TTL sur permissions résolues)
- Intégré par : `signapps-storage`, `signapps-calendar`, `signapps-docs` (et extensible à tout service)

#### signapps-cache

Cache in-process remplaçant Redis.

```rust
CacheService {
    cache: moka::future::Cache<String, String>,  // TTL-based
    counters: DashMap<String, AtomicI64>,         // compteurs atomiques
}
```

Usages : rate-limiting, blacklist JWT, cache permissions, documents lourds.

#### signapps-db (umbrella crate)

Re-exporte les 13 sous-crates contextuels. Les services qui ont besoin de plusieurs domaines importent `signapps-db` ; ceux qui n'en ont besoin que d'un importent directement le sous-crate.

### signapps-db — 13 sous-crates contextuels

| Sous-crate | Contenu |
|------------|---------|
| `signapps-db-shared` | Pool `PgPool`, modèles tenant, job, activity — base de tout |
| `signapps-db-calendar` | Calendriers, événements, tâches, congés, présence, timesheets |
| `signapps-db-storage` | Drive nodes, quotas, tiers S2/S3, drive-acl legacy |
| `signapps-db-mail` | Mailserver, config CalDAV/CardDAV |
| `signapps-db-forms` | Définitions de formulaires, soumissions, champs |
| `signapps-db-notifications` | Préférences, templates, sent, digest, push tokens |
| `signapps-db-vault` | Items vault, dossiers, partages, clés de chiffrement |
| `signapps-db-ai` | Vecteurs pgvector (384d + 1024d), conversations, médias, KG |
| `signapps-db-infrastructure` | AD/LDAP, DNS zones, DHCP scopes, domaines infra |
| `signapps-db-itam` | Devices, containers, RAID arrays |
| `signapps-db-billing` | Certificats TLS, routes proxy |
| `signapps-db-content` | Profils de sauvegarde, enveloppes de signatures |
| `signapps-db-identity` | Users, groups, roles, sessions, API keys, tenants, preferences |

### 27+ crates extraits de signapps-common

| Crate | Contenu extrait |
|-------|----------------|
| `signapps-audit` | Journal d'audit structuré, middleware |
| `signapps-alerts` | Règles d'alertes, notifications multi-canal |
| `signapps-approval` | Workflow d'approbation multi-approbateur |
| `signapps-dlp` | Data Loss Prevention |
| `signapps-pii` | Chiffrement PII AES-256-GCM |
| `signapps-ueba` | User and Entity Behavior Analytics |
| `signapps-retention` | Politiques de rétention RGPD |
| `signapps-workflows` | Moteur d'automatisation AI (trigger/condition/action) |
| `signapps-vault-types` | Types partagés pour le vault |
| `signapps-sso` | SAML2 + OIDC base |
| `signapps-e2e-crypto` | Chiffrement de bout en bout |
| `signapps-accounting-fec` | Exports comptables FEC |
| `signapps-reporting` | Génération de rapports |
| `signapps-marketplace` | App marketplace |
| `signapps-plugins` | Système de plugins |
| `signapps-webhooks` | Types et client webhooks |
| `signapps-trust` | Trust scoring |
| `signapps-search` | Moteur de recherche full-text |
| `signapps-indexer` | Pipeline d'indexation |
| `signapps-rate-limit` | Rate limiting configurable |
| `signapps-triggers` | Déclencheurs d'événements |
| `signapps-sql-dashboard` | Tableaux de bord SQL dynamiques |
| `signapps-graphql-layer` | Couche GraphQL optionnelle |
| `signapps-data-connectors` | Connecteurs de données externes |
| `signapps-bridge` | Bridge inter-services |
| `signapps-comments` | Système de commentaires générique |
| `signapps-ad-core` | Primitives Active Directory |

### Crates d'infrastructure réseau (protocoles natifs)

| Crate | Protocole |
|-------|-----------|
| `signapps-ldap-server` | RFC 4511 LDAP (codec BER from scratch) |
| `signapps-kerberos-kdc` | AS/TGS Kerberos (AES-CTS + RC4-HMAC) |
| `signapps-smb-sysvol` | SMB2 (Negotiate, Session Setup, TreeConnect, Create, Read, Close) |
| `signapps-dns-server` | Serveur DNS autoritaire + AXFR zone transfer |
| `signapps-dkim` | Signature DKIM pour les emails sortants |
| `signapps-imap` | Serveur IMAP4rev1 |
| `signapps-smtp` | Serveur SMTP MSA/MTA |
| `signapps-jmap` | Protocole JMAP (RFC 8620) |
| `signapps-sieve` | Filtres Sieve pour le routage email |
| `signapps-mime` | Parsing MIME multipart |
| `signapps-spam` | Filtrage spam |
| `signapps-dav` | WebDAV/CalDAV/CardDAV |

### signapps-runtime

| Composant | Rôle |
|-----------|------|
| `RuntimeManager::ensure_database()` | Auto-détection PostgreSQL |
| `HardwareProfile::detect()` | Détection GPU (NVIDIA/AMD/Intel/Apple), VRAM |
| `ModelManager` | Téléchargement et cache des modèles IA |
| `InferenceBackend` | Sélection automatique : CUDA/ROCm/Metal/Vulkan → CPU |

---

## 5. Communication inter-services

### Stratégie adoptée (2026-04-08)

La communication inter-services suit une règle unique : **PgEventBus + outbox pour l'asynchrone, lecture directe PostgreSQL pour le synchrone, HTTP uniquement via le gateway**.

- **Synchrone** : lecture directe en base (un service peut lire la table d'un autre domaine via son sous-crate `signapps-db-*`)
- **Asynchrone** : `PgEventBus` (PostgreSQL LISTEN/NOTIFY + table outbox pour durabilité) — pas de Kafka, pas de RabbitMQ
- **API externes** : uniquement via `signapps-gateway` (3099), jamais d'appels service-à-service directs en HTTP

Voir `docs/architecture/inter-service-communication.md` pour le design complet.

### Protocoles temps-réel

| Service | Endpoint | Protocole |
|---------|----------|-----------|
| signapps-calendar | `/api/v1/calendars/:id/ws` | WebSocket |
| signapps-media | pipeline voix | WebSocket |
| signapps-docs | édition collaborative | WebSocket (CRDT) |
| signapps-chat | messagerie | WebSocket |
| signapps-ai | streaming LLM | SSE (`/api/v1/chat/stream`) |
| signapps-containers | logs | SSE (xterm.js) |

---

## 6. Sharing & Permissions

L'ancien modèle fragmenté (une table ACL par service) a été remplacé par `signapps-sharing` :

```
sharing.grants         — permissions individuelles (user, group, everyone)
sharing.templates      — ensembles de grants réutilisables
sharing.audit_log      — journal des opérations de partage
sharing.resource_paths — chaîne de parents pour walk-up inheritance
```

**Résolution d'une permission :**
1. Check direct grant sur la ressource
2. Walk-up via `resource_paths` (CTE récursif — 1 query au lieu de N)
3. Check template grants
4. Apply Deny rules (un seul Deny sur la chaîne bloque l'accès)
5. Résultat mis en cache (L2 in-process, TTL configurable)

**Services intégrés :** storage (fichiers), calendar (calendriers), docs (documents). Extensible à tout service via les helpers `sharing_routes()`.

---

## 7. Authentification JWT RS256

```
Client                signapps-gateway         Any service
  │                         │                       │
  ├─── POST /auth/login ────►│                       │
  │◄── { access_token: ... }─┤                       │
  │                          │                       │
  ├─── GET /api/v1/files ───►│                       │
  │                          ├─── forward + JWT ────►│
  │                          │       validate RS256   │
  │                          │    (JWKS cache local)  │
  │                          │◄─── 200 OK ───────────┤
  │◄─── 200 OK ──────────────┤                       │
```

- Algorithme : **RS256** (clé privée dans identity, clé publique distribuée via JWKS)
- JWKS endpoint : `signapps-identity:3001/.well-known/jwks.json`
- Chaque service valide les tokens localement (pas d'appel réseau à identity)
- Blacklist JWT via `signapps-cache` (révocation immédiate)

---

## 8. Base de données

### PostgreSQL — Schémas

| Schéma | Contenu |
|--------|---------|
| `identity` | users, groups, roles, sessions, api_keys, audit_logs, tenants |
| `calendar` | calendriers, events unifiés (8 types), tâches, ressources, congés, présence, timesheets |
| `storage` | buckets, files, quotas, raid_arrays, drive_nodes |
| `sharing` | grants, templates, audit_log, resource_paths |
| `chat` | channels, messages, members |
| `docs` | documents, versions, collaborators |
| `forms` | forms, submissions, fields |
| `billing` | subscriptions, invoices, plans |
| `social` | social_accounts, posts, campaigns |
| `infrastructure` | domains, certificates, DHCP scopes, deployments |

### Migrations

Format numéroté séquentiellement : `NNN_description.sql`. Idempotentes (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`). Gérées par `sqlx` au démarrage.

### pgvector

- Index HNSW pour recherche approximative rapide
- Espace texte 384 dimensions (nomic-embed-text)
- Espace multimodal 1024 dimensions (SigLIP)
- Fusion RRF (Reciprocal Rank Fusion) pour recherche hybride

---

## 9. Frontend

| Composant | Technologie |
|-----------|-------------|
| Framework | Next.js 16, App Router |
| UI Library | React 19 |
| State | Zustand (stores par domaine) |
| Composants | shadcn/ui dans `components/ui/` |
| Styling | Tailwind CSS 4, tokens sémantiques (`bg-card`, `text-foreground`, etc.) |
| Forms | react-hook-form + zod |
| HTTP | Axios avec JWT auto-refresh |
| Temps réel | EventSource/SSE pour streaming LLM |
| Thème | Dark/Light mode, CSS-first |
| i18n | next-intl (fr/en) |

### Sécurité frontend

- Sanitisation HTML via **DOMPurify** (remplace l'ancienne implémentation maison)
- Error Boundaries sur 9 sections majeures de l'application
- Imports dynamiques pour les librairies lourdes (pdfjs, exceljs, pptxgenjs, fabric)

---

## 10. AI Gateway (signapps-ai — port 3005)

```
gateway/
  GatewayRouter      → Route: Native > Http > Cloud
  QualityAdvisor     → Décide si cloud > local
  CapabilityRegistry → Liste des workers par capacité (OnceLock)

workers/
  llm/               → Chat, complétion (Ollama, vLLM, OpenAI, Anthropic)
  vision/            → Analyse image, VQA
  imagegen/          → Génération d'image (ComfyUI, DALL-E 3, candle SD/FLUX)
  reranker/          → Reclassement (ONNX bge-reranker)
  embeddings_mm/     → Embeddings multimodaux (SigLIP)
  docparse/          → Parsing document (ocrs natif)

rag/
  DualSpaceIndexer   → Indexation texte (384d) + multimodal (1024d)
  RrfFusionSearch    → Fusion RRF des deux espaces vectoriels

memory/
  ConversationMemory → Historique par session
  AutoSummarizer     → Résumé automatique des conversations longues
```

L'inférence ONNX est déportée sur `spawn_blocking` pour ne pas bloquer le runtime Tokio.

---

## 11. Sécurité

| Mécanisme | Détail |
|-----------|--------|
| JWT RS256 | Clé asymétrique, JWKS pour distribution de clé publique |
| MFA TOTP | RFC 6238 |
| LDAP/AD | Sync et authentification LDAP |
| RBAC | Rôles numériques (i16) : 0=user, 50=manager, 100=admin |
| API Keys | Hash, révocables |
| Argon2id | Hachage des mots de passe |
| CORS | Allowlist explicite par service (plus de `Any`) |
| SQL | Toutes les requêtes paramétrées (plus d'interpolation de chaînes) |
| BOLA | Check de permission par ressource avant tout accès |
| Tenant isolation | `tenant_id` obligatoire sur toutes les requêtes d'entités |
| Deny rules | Un seul grant Deny sur la chaîne d'héritage bloque l'accès |

---

## 12. Déploiement

### Développement natif

```bash
just db-start         # PostgreSQL Docker
just db-migrate       # Migrations SQL
./scripts/start-all.sh          # Tous les services Rust
cd client && npm run dev        # Frontend port 3000
```

### Configuration clé

```bash
DATABASE_URL=postgres://signapps:password@localhost:5432/signapps
JWT_SECRET=<inutilisé si RS256 — voir JWT_PRIVATE_KEY_PATH>
JWT_PRIVATE_KEY_PATH=./keys/private.pem
JWT_PUBLIC_KEY_PATH=./keys/public.pem
STORAGE_MODE=fs|s3
LLM_PROVIDER=ollama|vllm|openai|anthropic|llamacpp
GPU_BACKEND=auto|cuda|rocm|metal|vulkan|cpu
RUST_LOG=info,signapps=debug,sqlx=warn
```

---

*Pour la liste des routes par service, voir `docs/services.md`. Pour le calendrier unifié, voir `docs/CALENDAR_UNIFIED.md`. Pour les outils de développement, voir `docs/TOOLING.md`.*
