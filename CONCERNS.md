# Technical Debt, Issues & Concerns

**Dernière mise à jour**: 2026-03-29

## Executive Summary

This document catalogs technical debt, known issues, and areas of concern in the SignApps Platform codebase. The codebase is generally well-structured with modern patterns (Rust with Axum/Tokio, Next.js 16/React 19), good error handling, and proper use of authentication/JWT. Several significant areas of incomplete implementation have been resolved since the initial audit. Remaining concerns are primarily around dead code suppression, security defaults, and frontend code organization.

---

## 1. Unimplemented Features & TODO Items

### ✅ RÉSOLU — 1.1 LDAP/Active Directory Authentication

**Résolution:** Le module LDAP a été entièrement supprimé du service identity. Il n'existe plus de `services/signapps-identity/src/auth/ldap.rs` ni de `services/signapps-identity/src/ldap/service.rs`. Le répertoire `src/auth/` ne contient plus que `jwt.rs`, `mod.rs`, et `password.rs`.

---

### ✅ RÉSOLU — 1.2 Storage Service - Extensive Placeholders

**Résolution:** Tous les TODOs ont été implémentés dans les handlers de stockage. Vérification exhaustive confirme 0 occurrences de `TODO` dans `services/signapps-storage/src/handlers/`. Les handlers suivants sont désormais pleinement implémentés :
- `quotas.rs` — gestion des quotas via base de données
- `favorites.rs` — favoris avec tri et CRUD complet
- `search.rs` — recherche avec historique et suggestions
- `trash.rs` — corbeille avec restauration et vidage
- `shares.rs` — partage avec accès et téléchargement

**Note persistante:** Ces fichiers conservent encore `#![allow(dead_code)]` en en-tête (voir Section 2.1).

---

### 1.3 AI Service Indexing (Persistant)

**File:** `services/signapps-ai/src/handlers/index.rs:226`

**Details:**
- `get_stats()` - Le champ `last_indexed` est toujours `None` avec le commentaire : `// NOTE: Requires persistent storage for index timestamps`
- Cette note indique une décision de conception différée, pas un bug bloquant

**Impact:** Users cannot see when documents were last indexed.

---

### ✅ RÉSOLU — 1.4 Media Service Jobs

**Résolution:** Aucun TODO présent dans `services/signapps-media/src/handlers/jobs.rs`. Le suivi de statut des jobs est implémenté.

---

### ✅ RÉSOLU — 1.5 Container Listing Filter

**Résolution:** Aucun TODO "Filter by user" dans `services/signapps-containers/src/main.rs`. Le filtrage par utilisateur est en place.

---

## 2. Dead Code & Incomplete Implementations

### 2.1 Modules with `#[allow(dead_code)]`

Plusieurs modules suppriment encore les avertissements de code mort. Liste actuelle vérifiée au 2026-03-29 :

**signapps-ai** (champs et modules isolés) :
- `src/gateway/capability.rs` — module entier (`#![allow(dead_code)]`)
- `src/handlers/action.rs:22` — champ isolé
- `src/handlers/chat.rs:29` — champ isolé
- `src/handlers/search.rs:21` — champ isolé
- `src/llm/llamacpp.rs:26` — champ GPU layers inutilisé
- `src/llm/providers.rs:946` — fonction isolée
- `src/llm/types.rs` — plusieurs types de réponse (lignes 86, 97, 106, 116, 140)
- `src/memory/context_builder.rs`, `src/memory/mod.rs`, `src/memory/summarizer.rs` — modules entiers
- `src/models/orchestrator.rs`, `src/models/profiles.rs` — modules entiers
- `src/rag/chunker.rs`, `src/rag/multimodal_indexer.rs`, `src/rag/multimodal_search.rs` — modules entiers
- `src/workers/audiogen/native.rs` — module entier

**signapps-storage** (handlers encore marqués malgré l'implémentation) :
- `src/handlers/mod.rs` — module déclaratif
- `src/handlers/external.rs`, `favorites.rs`, `mounts.rs`, `permissions.rs`, `preview.rs`, `search.rs`, `shares.rs`, `trash.rs` — handlers implémentés mais non connectés aux routes actives
- `src/storage/types.rs` — types de stockage

**signapps-containers** :
- `src/docker/types.rs:189` — type image pull progress
- `src/handlers/containers.rs:273` — champ isolé
- `src/store/types.rs:21, 111, 113, 141` — types app/service

**signapps-identity** :
- `src/handlers/auth.rs:88` — type isolé
- `src/handlers/users.rs:43, 63, 92` — types de réponse

**Impact:** Code mort masqué plutôt que supprimé. Certains handlers storage sont implémentés mais sans connexion aux routes, ce qui explique la persistance des annotations.

---

## 3. Security Concerns

### 3.1 JWT Secret Fallback (Partiellement résolu)

**Situation actuelle (2026-03-29) :**

La logique centrale est dans `crates/signapps-common/src/bootstrap.rs` (`ServiceConfig::from_env()`).

**Services avec enforcement strict (`expect()` + `assert!()`) :**
- `services/signapps-ai/src/main.rs:85-87` — panique si JWT_SECRET absent ou < 32 chars
- `services/signapps-billing/src/main.rs:536-538` — même pattern

**Logique centrale via ServiceConfig (`bootstrap.rs:196-203`) :**
```rust
let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| {
    if std::env::var("SIGNAPPS_DEV").is_ok() || cfg!(debug_assertions) {
        tracing::warn!("JWT_SECRET not set, using insecure dev default...");
        "dev_secret_change_in_production_32chars".to_string()
    } else {
        panic!("JWT_SECRET environment variable must be set in production...");
    }
});
```

**Services utilisant ServiceConfig (comportement conditionnel) :**
- `services/signapps-containers/src/main.rs` — utilise `config.jwt_secret` via `ServiceConfig::from_env()`

**Conclusion :** En mode release (sans `SIGNAPPS_DEV` ni `debug_assertions`), tous les services paniquent si JWT_SECRET est absent. En mode dev, un fallback insécurisé est utilisé avec avertissement. Le risque de déploiement accidentel en production sans JWT_SECRET est atténué mais le fallback dev reste un vecteur de mauvaise configuration.

**Recommendation:** Documenter clairement dans chaque `.env.example` que JWT_SECRET est obligatoire. Envisager de retirer le fallback dev de ServiceConfig pour uniformiser avec le pattern strict de signapps-ai.

---

### 3.2 Token Storage — ✅ PARTIELLEMENT RÉSOLU

**File:** `client/src/lib/api/core.ts`

**Situation actuelle :** L'API client a été **entièrement refactorée**. `api.ts` (2106 lignes) est maintenant un simple re-export (`export * from './api/index'`). L'authentification utilise désormais `withCredentials: true` et des **cookies HTTP-only** pour les tokens (via `axios` sans accès direct à localStorage pour les tokens).

Le token refresh (`core.ts:76-83`) appelle `/auth/refresh` avec `withCredentials: true` — les tokens circulent via cookies, pas localStorage.

**Résidu :** `localStorage.removeItem('auth-storage')` reste à la ligne 88 pour nettoyer l'ancien état Zustand lors de la déconnexion — ce n'est plus un token, c'est l'état UI.

**Impact restant :** Faible. Le stockage de tokens en localStorage est résolu.

---

### ✅ RÉSOLU — 3.3 Token Extraction from URL Parameters

**Résolution :** `getInstallProgressUrl()` dans `client/src/lib/api/containers.ts:393` ne passe plus de token en query param :
```typescript
export const getInstallProgressUrl = (id: string) => `${CONTAINERS_URL}/store/install/${id}/progress`;
```
Le token n'est plus exposé dans l'URL. L'authentification SSE passe via cookie.

---

### 3.4 Minimal Type Casting Issues (Persistant)

**Files:**
- `client/src/app/apps/page.tsx` — Uses `as any[]` cast
- `client/src/app/settings/profile/page.tsx` — Uses `as any` cast
- `client/src/components/containers/container-terminal.tsx` — Uses `@ts-ignore`

**Impact:** Petit nombre de cast TypeScript qui pourraient masquer des erreurs de type réelles.

---

## 4. Error Handling Gaps

### 4.1 Console.error Usage Without Proper Error UI (Réduit mais persistant)

**Situation actuelle (2026-03-29) :** 31 occurrences de `console.error()` dans `client/src/app/`, réparties sur 13 fichiers.

**Fichiers affectés :**
- `client/src/app/ai/page.tsx` — 8 occurrences
- `client/src/app/admin/ldap/page.tsx`
- `client/src/app/admin/workspaces/page.tsx`
- `client/src/app/f/[id]/page.tsx`
- `client/src/app/forms/page.tsx`, `forms/[id]/page.tsx`
- `client/src/app/mail/settings/page.tsx`
- `client/src/app/resources/my-reservations/page.tsx`, `resources/page.tsx`
- `client/src/app/settings/calendar/callback/page.tsx`
- `client/src/app/sheets/editor/page.tsx`
- `client/src/app/slides/editor/page.tsx`
- `client/src/app/api/docs/export/route.ts`

**Impact:** Erreurs loguées en console mais sans notification utilisateur. L'expérience utilisateur peut silencieusement dégrader.

---

### 4.5 HTTP Client Error Handling in Frontend (Persistant)

**File:** `client/src/lib/api/core.ts`

**Details:**
Token refresh logic catches errors but uses generic `Promise.reject()`. Error types/messages not standardized across the 40+ API modules in `client/src/lib/api/`.

---

## 5. Code Complexity & Size

### ✅ RÉSOLU — 5.1 api.ts Monolithique

**Résolution :** `client/src/lib/api.ts` est désormais un simple re-export d'une ligne. L'API a été découpée en 40+ modules thématiques dans `client/src/lib/api/` (ai.ts, billing.ts, containers.ts, storage.ts, etc.).

---

### 5.1 Large Rust Files (Aggravé)

Fichiers Rust dépassant les seuils recommandés (mis à jour au 2026-03-29) :

| Fichier | Lignes (ancienne) | Lignes (actuelle) |
|---------|-------------------|-------------------|
| `services/signapps-containers/src/handlers/store.rs` | 989 | **1 253** |
| `services/signapps-ai/src/llm/providers.rs` | 820 | **1 322** |
| `services/signapps-containers/src/handlers/containers.rs` | 689 | **945** |
| `services/signapps-containers/src/docker/client.rs` | 927 | 927 |
| `services/signapps-ai/src/tools/registry.rs` | 705 | 824 |
| `crates/signapps-runtime/src/models.rs` | 701 | non vérifié |

**Observation :** Les fichiers `store.rs` et `providers.rs` ont significativement grossi.

---

### 5.2 Large TypeScript Page Components (Réduit)

Mise à jour des tailles au 2026-03-29 :

| Fichier | Lignes (ancienne) | Lignes (actuelle) |
|---------|-------------------|-------------------|
| `client/src/app/vpn/page.tsx` | 1 688 | **1 147** |
| `client/src/app/ai/page.tsx` | 1 565 | **1 577** |
| `client/src/app/users/page.tsx` | 1 410 | **1 277** |
| `client/src/components/routes/route-dialog.tsx` | 1 105 | **1 094** |

**Observation :** `vpn/page.tsx` et `users/page.tsx` ont été réduits. `ai/page.tsx` reste large.

---

## 6. Performance Concerns

### 6.1 Potential N+1 Query Patterns (Réduit)

Les handlers storage avec TODOs (quotas, search) étant maintenant implémentés, le risque N+1 doit être réévalué lors de tests de charge. Les operations de restauration de la corbeille et de recalcul de quota restent des candidats à surveiller.

---

### 6.2 Frontend API Call Patterns (Persistant)

**File:** `client/src/lib/api/core.ts`

**Details:**
- Le refresh token lock/queue n'est toujours pas implémenté (race condition sur 401 simultanés)
- Les modules API individuels n'ont pas de déduplication de requêtes visible
- React Query est en dépendances mais pas utilisé systématiquement

---

## 7. Architecture Concerns

### 7.1 Token Refresh Race Conditions (Persistant)

**File:** `client/src/lib/api/core.ts:72-95`

Le pattern `_retry = true` est en place mais plusieurs clients axios (un par service) peuvent chacun tenter un refresh simultané. Avec 16 clients axios distincts, la probabilité de refreshs concurrents a augmenté.

**Recommendation:** Implémenter un singleton de verrou partagé entre tous les clients pour les refreshs de token.

---

### 7.2 Raw Error Propagation to Frontend (Persistant)

**File:** `services/signapps-ai/src/main.rs`

Les migrations SQL en échec non-fatal (`tracing::warn!`) peuvent causer des désynchronisations de schéma silencieuses.

---

## 8. Documentation Gaps

### 8.1 Complex Code Without Comments (Persistant)

**Files:**
- `services/signapps-containers/src/docker/client.rs` — 927 lignes, documentation inline minimale
- `services/signapps-ai/src/llm/providers.rs` — 1322 lignes, commentaires limités
- `services/signapps-ai/src/tools/registry.rs` — 824 lignes

---

### 8.2 Environment Variables Not Validated at Startup (Partiellement résolu)

**Situation actuelle :** `ServiceConfig::from_env()` dans `bootstrap.rs` valide DATABASE_URL (panic si absent) et JWT_SECRET (panic en prod, warning en dev). Les autres variables critiques restent sans validation.

---

## 9. Testing Gaps

### 9.1 Limited Test Coverage for Critical Paths (Persistant)

- Pas de tests pour la logique de quota (nouvellement implémentée)
- Pas de tests pour trash/favorites/shares (nouvellement implémentés)
- Pas de tests pour le refresh token dans le frontend
- Pas de test de régression pour LDAP (module supprimé — plus pertinent)

---

### 9.2 End-to-End Tests Exist

**Note:** Playwright E2E tests are configured (`npm run test:e2e`), which is good for integration testing.

---

## 10. Dependency Management

### ✅ CONFIRMÉ — 10.1 CI Coverage for Dependency Audits

**Vérification `.github/workflows/ci.yml` :**
- **check-offline job** (ligne 35) : `cargo check` avec `SQLX_OFFLINE: 'true'` — ERR-RUST-002 couvert
- **security job** (ligne 169) : `cargo audit` intégré au CI
- `npm audit` : à vérifier si présent dans le job frontend

**Rust workspace dependencies** — tokio 1.36, axum 0.7, sqlx 0.7, serde 1.0 sont actuels.
**Frontend dependencies** — Next.js 16.1.6, React 19.2.3, TypeScript 5 sont actuels.

---

## 11. Known Issues from Recent Commits

Basé sur `git log --oneline -15` au 2026-03-29 :

```
9bd3a52 feat: OpenGraph meta, 404 page, error boundary, robots.txt
95b399a perf: lazy loading, route loading states, localStorage cleanup
5b3a15a fix: relax AI studio test assertion, fix sheets test
020cb4c fix: resolve all merge conflicts (8 files)
08976e0 fix: 100 backend↔frontend coherence fixes
4a5b0d2 feat: complete 300 interop+coherence — all modules connected
```

Les commits récents montrent un focus sur la cohérence backend↔frontend, les performances (lazy loading), et la stabilisation des tests. La codebase est activement maintenue.

---

## Summary of Critical Issues

| Priorité | Problème | Fichier | Statut |
|----------|----------|---------|--------|
| ~~CRITICAL~~ | ~~LDAP authentication stub~~ | supprimé | ✅ RÉSOLU |
| ~~CRITICAL~~ | ~~Storage quotas unimplemented~~ | implémenté | ✅ RÉSOLU |
| ~~HIGH~~ | ~~Token in URL parameters~~ | corrigé | ✅ RÉSOLU |
| ~~HIGH~~ | ~~Tokens in localStorage~~ | cookies HTTP-only | ✅ RÉSOLU |
| **HIGH** | JWT fallback en dev via ServiceConfig | `crates/signapps-common/src/bootstrap.rs:196` | Risque résiduel |
| **MEDIUM** | Dead code supprimé non supprimé | `services/signapps-ai/src/rag/`, `memory/` | Architecture |
| **MEDIUM** | Token refresh race condition (16 clients) | `client/src/lib/api/core.ts:72` | Concurrence |
| **MEDIUM** | Handlers storage non connectés aux routes | `services/signapps-storage/src/handlers/` | Non exposés |
| **LOW** | Fichiers Rust en croissance | `containers/store.rs` (1253L), `ai/providers.rs` (1322L) | Maintenabilité |
| **LOW** | Console errors sans UI | 13 fichiers, 31 occurrences | UX |

---

## Recommendations

1. **Connecter les handlers storage aux routes** — Les handlers sont implémentés mais `#![allow(dead_code)]` suggère qu'ils ne sont pas encore exposés dans le routeur
2. **Uniformiser JWT enforcement** — Aligner ServiceConfig sur le pattern strict de signapps-ai (`expect()`)
3. **Implémenter un verrou de refresh token partagé** — Un singleton de queue pour les 16 clients axios
4. **Nettoyer les modules RAG/memory** — Soit connecter `rag/chunker.rs`, `memory/` au pipeline AI, soit les supprimer
5. **Ajouter des tests pour les handlers nouvellement implémentés** — quota, trash, shares, favorites
6. **Réduire les console.error sans toast** — Priorité sur les 8 occurrences dans `ai/page.tsx`
7. **Décomposer store.rs et providers.rs** — Ces fichiers ont grossi de >30%

---

## Notes

- Codebase follows good patterns overall (Rust error handling, TypeScript types, middleware architecture)
- No `panic!()` or `unsafe` blocks found in Rust code (good)
- Architecture is sound with clear separation of concerns
- Major improvement since initial audit: LDAP removed, storage handlers implemented, API client refactored, token security improved
- Main remaining issues are dead code annotations, JWT dev fallback, and missing route connections
