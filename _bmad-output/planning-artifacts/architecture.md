# Architecture Technique - SignApps Platform

**Version:** 1.0
**Date:** 2026-03-15
**Status:** Validé (Post-Sprint 2)

---

## Vue d'Ensemble

SignApps Platform est une suite de productivité self-hosted composée de 18 microservices Rust et un frontend Next.js 16.

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js 16)                        │
│                    Port: 3000                                   │
├─────────────────────────────────────────────────────────────────┤
│  React 19 · Zustand · Tailwind CSS 4 · shadcn/ui · Tiptap v3   │
└────────────────────────────┬────────────────────────────────────┘
                             │ REST API (JWT)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SERVICES RUST (Axum)                         │
├──────────────┬──────────────┬──────────────┬────────────────────┤
│ identity     │ containers   │ proxy        │ storage            │
│ :3001        │ :3002        │ :3003        │ :3004              │
├──────────────┼──────────────┼──────────────┼────────────────────┤
│ ai           │ securelink   │ scheduler    │ metrics            │
│ :3005        │ :3006        │ :3007        │ :3008              │
├──────────────┼──────────────┼──────────────┼────────────────────┤
│ media        │ docs         │ calendar     │ mail               │
│ :3009        │ :3010        │ :3011        │ :3012              │
├──────────────┼──────────────┼──────────────┼────────────────────┤
│ collab       │ meet         │ it-assets    │ pxe                │
│ :3013        │ :3014        │ :3015        │ :3016              │
├──────────────┼──────────────┴──────────────┴────────────────────┤
│ remote       │ office                                           │
│ :3017        │ :3018                                            │
└──────────────┴──────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PostgreSQL + pgvector                        │
│                    (Native, pas de Docker)                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Allocation des Ports

| Port | Service | Status | Description |
|------|---------|--------|-------------|
| 3000 | client | ✅ | Frontend Next.js |
| 3001 | identity | ✅ | Auth, RBAC, LDAP/AD, MFA |
| 3002 | containers | ✅ | Docker lifecycle (bollard) |
| 3003 | proxy | ✅ | Reverse proxy, TLS/ACME |
| 3004 | storage | ✅ | File storage (OpenDAL) |
| 3005 | ai | ✅ | RAG, LLM, pgvector |
| 3006 | securelink | ✅ | Web tunnels, DNS |
| 3007 | scheduler | ✅ | CRON, Tasks, Calendar |
| 3008 | metrics | ✅ | Monitoring, Prometheus |
| 3009 | media | ✅ | STT/TTS/OCR natif |
| 3010 | docs | ✅ | Documents Yjs/CRDT |
| 3011 | calendar | ✅ | CalDAV, Events |
| 3012 | mail | ✅ | IMAP/SMTP, Mailboxes |
| 3013 | collab | ✅ | WebSocket collaboration |
| 3014 | meet | ⚠️ | Visioconférence (partiel) |
| 3015 | it-assets | ❌ | Gestion parc IT (skeleton) |
| 3016 | pxe | ❌ | Boot réseau (skeleton) |
| 3017 | remote | ❌ | Accès distant (skeleton) |
| 3018 | office | ⚠️ | Conversion formats (partiel) |

---

## Patterns Techniques

### 1. Service Bootstrap (Rust)

Tous les services Rust utilisent le module `signapps-common::bootstrap`:

```rust
use signapps_common::bootstrap::{init_tracing, load_env, ServiceConfig, env_or};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    init_tracing("signapps_identity");
    load_env();

    let config = ServiceConfig::from_env("signapps-identity", 3001);
    config.log_startup();

    let pool = signapps_db::create_pool(&config.database_url).await?;

    let app = Router::new()
        .route("/health", get(|| async { "OK" }))
        // ... routes
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive())
        .with_state(app_state);

    let addr: SocketAddr = format!("{}:{}", config.host, config.port).parse()?;
    let listener = TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
```

### 2. API Client Factory (Frontend)

Tous les modules API utilisent `@/lib/api/factory`:

```typescript
import { getClient, ServiceName } from '@/lib/api/factory';

// Usage
const client = getClient(ServiceName.IDENTITY);
const response = await client.get('/users');

// Services disponibles
export enum ServiceName {
  IDENTITY = 'identity',      // :3001
  CONTAINERS = 'containers',  // :3002
  PROXY = 'proxy',            // :3003
  STORAGE = 'storage',        // :3004
  AI = 'ai',                  // :3005
  SECURELINK = 'securelink',  // :3006
  SCHEDULER = 'scheduler',    // :3007
  METRICS = 'metrics',        // :3008
  MEDIA = 'media',            // :3009
  DOCS = 'docs',              // :3010
  CALENDAR = 'calendar',      // :3011
  MAIL = 'mail',              // :3012
  COLLAB = 'collab',          // :3013
  MEET = 'meet',              // :3014
  IT_ASSETS = 'it-assets',    // :3015
  PXE = 'pxe',                // :3016
  REMOTE = 'remote',          // :3017
  OFFICE = 'office',          // :3018
}
```

**Fonctionnalités incluses:**
- JWT auto-injection via intercepteur
- Auto-refresh token sur 401
- Health check par service
- Cache des instances Axios

### 3. Feature Flags (Frontend)

Pattern "No Dead Ends" via `@/lib/features.ts`:

```typescript
export const FEATURES = {
  // Services actifs
  IDENTITY: true,
  STORAGE: true,
  CONTAINERS: true,
  AI: true,
  SCHEDULER: true,
  CALENDAR: true,
  METRICS: true,
  MEDIA: true,
  MAIL: true,
  MEET: true,
  VPN: true,
  DOCS: true,
  COLLAB: true,
  OFFICE: true,

  // Services skeleton (cachés)
  REMOTE: false,
  PXE: false,
  IT_ASSETS: false,

  // Features spécifiques non-prêtes
  MEMBER_MANAGEMENT: false,
  ARCHIVE_EXTRACTION: false,
  DND_FILE_TO_TASK: false,
  DND_TASK_TO_CALENDAR: false,
  CHAT_PRESENCE: false,
  CHAT_UNREAD_COUNT: false,
} as const;
```

**Usage:**
```tsx
import { FEATURES } from "@/lib/features";

// Sidebar conditionnel
{FEATURES.REMOTE && <NavItem href="/remote" icon={Monitor} label="Remote" />}

// Feature conditionnel
{FEATURES.CHAT_PRESENCE && dm.status === "online" && (
  <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-green-500" />
)}
```

### 4. Repository Pattern (Rust)

Accès données via `signapps-db`:

```rust
use signapps_db::{DatabasePool, repositories::UserRepository};

// Dans un handler
pub async fn get_user(
    State(pool): State<DatabasePool>,
    Path(user_id): Path<Uuid>,
) -> Result<Json<User>, AppError> {
    let user = UserRepository::find_by_id(&pool, user_id)
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(Json(user))
}
```

### 5. Error Handling (Rust)

Erreurs RFC 7807 via `signapps-common::AppError`:

```rust
use signapps_common::AppError;

// Retourner une erreur
Err(AppError::Unauthorized("Invalid credentials".into()))
Err(AppError::NotFound)
Err(AppError::BadRequest("Missing field: name".into()))
Err(AppError::Internal(anyhow::anyhow!("Database error")))
```

### 6. State Management (Frontend)

Zustand stores dans `@/lib/store.ts`:

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      login: (user) => set({ user, isAuthenticated: true }),
      logout: () => set({ user: null, isAuthenticated: false }),
    }),
    { name: 'auth-storage' }
  )
);
```

---

## Crates Partagés

### signapps-common

| Module | Description |
|--------|-------------|
| `bootstrap` | init_tracing, load_env, ServiceConfig, env_or |
| `auth` | JWT Claims, middleware auth/admin |
| `errors` | AppError (RFC 7807) |
| `middleware` | Request logging, CORS, tracing |

### signapps-db

| Module | Description |
|--------|-------------|
| `pool` | create_pool, DatabasePool |
| `repositories/*` | UserRepository, GroupRepository, etc. |
| `models/*` | Entities mappées aux tables |
| `migrations` | run_migrations |

### signapps-cache

| Module | Description |
|--------|-------------|
| `CacheService` | TTL cache (moka) + compteurs atomiques |

---

## Conventions API

### Endpoints REST

```
GET    /api/v1/{resource}           → Liste
GET    /api/v1/{resource}/{id}      → Détail
POST   /api/v1/{resource}           → Création
PUT    /api/v1/{resource}/{id}      → Mise à jour
DELETE /api/v1/{resource}/{id}      → Suppression
```

### Réponses

```json
// Succès
{ "data": {...}, "message": "OK" }

// Liste paginée
{ "data": [...], "total": 100, "page": 1, "per_page": 20 }

// Erreur (RFC 7807)
{
  "type": "https://errors.signapps.io/not-found",
  "title": "Not Found",
  "status": 404,
  "detail": "User not found"
}
```

### Headers

```
Authorization: Bearer <jwt>
Content-Type: application/json
X-Request-Id: <uuid>
```

---

## Sécurité

### JWT

- Algorithme: HS256
- Expiration: 1h (access), 7j (refresh)
- Claims: sub (user_id), username, role, tenant_id

### RBAC

| Role | Value | Permissions |
|------|-------|-------------|
| User | 0 | Lecture/écriture propres ressources |
| Admin | 1 | Gestion utilisateurs, configuration |
| SuperAdmin | 2 | Accès complet, multi-tenant |

---

## Technologies

### Backend (Rust)

| Crate | Version | Usage |
|-------|---------|-------|
| axum | 0.8+ | Framework web |
| tokio | 1.x | Runtime async |
| sqlx | 0.8+ | PostgreSQL driver |
| serde | 1.x | Serialization |
| tracing | 0.1+ | Logging |
| jsonwebtoken | 9+ | JWT |

### Frontend (TypeScript)

| Package | Version | Usage |
|---------|---------|-------|
| next | 16.x | Framework React |
| react | 19.x | UI |
| zustand | 5.x | State management |
| axios | 1.x | HTTP client |
| @tiptap/core | 3.x | Rich text editor |
| yjs | 13.x | CRDT sync |
| fabric | 7.x | Canvas (Slides) |

---

## Règle UX Absolue

```
╔════════════════════════════════════════════════════════════╗
║  NO DEAD ENDS                                              ║
║                                                            ║
║  • Si ça ne fonctionne pas → ça ne s'affiche pas          ║
║  • Feature flags obligatoires pour tout nouveau dev        ║
║  • Definition of Done = fonctionne de A à Z               ║
║  • Code review : pas de merge si UI pointe vers du vide   ║
╚════════════════════════════════════════════════════════════╝
```

---

*Document généré automatiquement - BMAD Method v6.0.4*
