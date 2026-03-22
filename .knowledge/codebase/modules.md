# Carte des Modules - Connaissance du Codebase

> Compréhension structurée du code pour navigation rapide.

---

## Backend (Rust)

### Crates Partagés

| Crate | Responsabilité | Dépend de |
|-------|----------------|-----------|
| `signapps-common` | JWT, middleware, errors, value objects | - |
| `signapps-db` | Models, repositories, migrations, pgvector | common |
| `signapps-cache` | TTL cache (moka), atomic counters | - |
| `signapps-runtime` | PostgreSQL lifecycle, hardware detection, models | common, db |

### Services

| Service | Port | Responsabilité | Crates utilisés |
|---------|------|----------------|-----------------|
| `signapps-identity` | 3001 | Auth, LDAP, MFA, RBAC | common, db, cache |
| `signapps-containers` | 3002 | Docker lifecycle | common, db |
| `signapps-proxy` | 3003 | Reverse proxy, TLS, SmartShield | common, cache |
| `signapps-storage` | 3004 | File storage (OpenDAL) | common, db |
| `signapps-ai` | 3005 | RAG, LLM, pgvector | common, db, runtime |
| `signapps-securelink` | 3006 | Tunnels, DNS ad-blocking | common |
| `signapps-scheduler` | 3007 | CRON jobs | common, db |
| `signapps-metrics` | 3008 | Monitoring, Prometheus | common |
| `signapps-media` | 3009 | STT/TTS/OCR, WebSocket | common, runtime |

### Structure Type d'un Service

```
services/signapps-xxx/
├── Cargo.toml
└── src/
    ├── main.rs          # Router, state, middleware
    ├── handlers/        # HTTP handlers par domaine
    │   ├── mod.rs
    │   └── domain.rs
    ├── models/          # DTOs request/response (optionnel)
    └── lib.rs           # Exports (optionnel)
```

---

## Frontend (TypeScript/React)

### Structure

```
client/
├── src/
│   ├── app/            # Next.js App Router pages
│   │   ├── layout.tsx  # Root layout
│   │   ├── page.tsx    # Home
│   │   └── [module]/   # Pages par module
│   ├── components/     # Composants réutilisables
│   │   ├── ui/        # shadcn/ui primitives
│   │   ├── layout/    # Header, sidebar, etc.
│   │   └── [domain]/  # Composants métier
│   ├── hooks/          # Custom hooks (use-*)
│   ├── lib/            # Utilitaires
│   │   ├── api.ts     # Client Axios + interceptors
│   │   ├── store.ts   # Zustand stores
│   │   └── utils.ts   # Helpers
│   ├── stores/         # Zustand stores détaillés
│   └── types/          # TypeScript interfaces
└── e2e/               # Tests Playwright
```

---

## Points d'Entrée Clés

| Action | Fichier(s) |
|--------|------------|
| Ajouter route API | `services/signapps-xxx/src/main.rs` |
| Ajouter handler | `services/signapps-xxx/src/handlers/` |
| Ajouter page frontend | `client/src/app/[path]/page.tsx` |
| Ajouter composant | `client/src/components/` |
| Ajouter store | `client/src/stores/` |
| Migration DB | `migrations/` |

---

## Graphe de Dépendances Simplifié

```
Frontend (Next.js)
    ↓ HTTP/JSON
Services (Axum)
    ↓
Crates partagés
    ↓
PostgreSQL + pgvector
```

---

*Ce fichier aide à naviguer rapidement dans le code.*
