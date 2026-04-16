# Phase D — Targeted Performance Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Appliquer 5 fixes de performance ciblés identifiés dans le journal Phase A — forms bulk endpoint, storage delete_many parallélisation, chat useShallow, chat MessageItem memo, storage file-row memo (vérif).

**Architecture:** 3 commits séquentiels. Commit 1 = backend endpoint + frontend refactor (couplés). Commit 2 = backend parallélisation. Commit 3 = 3 optimisations frontend (chat + verify storage). Chaque fix a un ratio perf documenté en commit message.

**Tech Stack:** Rust (Axum, sqlx, tokio), TypeScript/React (Zustand, zustand/react/shallow).

**Spec :** `docs/superpowers/specs/2026-04-16-phase-d-targeted-perf-design.md`

---

# COMMIT 1 — Forms bulk response-counts (backend + frontend)

## Task 1: Repository method `list_response_counts`

**Files:**
- Modify: `crates/signapps-db-forms/src/repositories/form_repository.rs` (add method after `list_responses`)

- [ ] **Step 1: Ajouter la méthode `list_response_counts`**

Juste après `list_responses` (ligne ~123), ajouter :

```rust
    /// Return a mapping `form_id → response count` for the given form IDs.
    ///
    /// Unlike `list_responses` which fetches every response per form, this
    /// aggregates counts server-side so the frontend can hydrate a forms
    /// list in a single request instead of N+1.
    pub async fn list_response_counts(
        pool: &PgPool,
        form_ids: &[Uuid],
    ) -> Result<Vec<(Uuid, i64)>> {
        if form_ids.is_empty() {
            return Ok(Vec::new());
        }
        let rows: Vec<(Uuid, i64)> = sqlx::query_as(
            "SELECT form_id, COUNT(*)::bigint \
             FROM forms.form_responses \
             WHERE form_id = ANY($1) \
             GROUP BY form_id",
        )
        .bind(form_ids)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(rows)
    }
```

- [ ] **Step 2: Vérifier le crate compile**

Run :
```bash
cd /c/Prog/signapps-platform && rtk cargo check -p signapps-db-forms 2>&1 | tail -5
```
Expected : 0 erreurs.

---

## Task 2: Handler `list_response_counts` dans signapps-forms

**Files:**
- Modify: `services/signapps-forms/src/main.rs` (add handler + route)

- [ ] **Step 1: Ajouter le handler**

Juste après `list_responses` (ligne ~538), ajouter :

```rust
/// GET /api/v1/forms/response-counts
///
/// Bulk response-count endpoint for the forms dashboard. Replaces the
/// N+1 pattern where the frontend fetched `/forms/:id/responses` once
/// per form just to count the length.
#[utoipa::path(
    get,
    path = "/api/v1/forms/response-counts",
    responses(
        (status = 200, description = "Map of form_id -> response count"),
    ),
    security(("bearerAuth" = [])),
    tag = "forms"
)]
async fn list_response_counts(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    // Fetch the caller's owned forms first so we only count responses
    // for forms they can see.
    let forms = match FormRepository::list_by_owner(&state.pool, claims.sub).await {
        Ok(f) => f,
        Err(e) => {
            tracing::error!("Failed to list forms for response-counts: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Internal Error" })),
            );
        }
    };
    let form_ids: Vec<Uuid> = forms.iter().map(|f| f.id).collect();

    match FormRepository::list_response_counts(&state.pool, &form_ids).await {
        Ok(rows) => {
            // Serialize as { form_id: count } map (JSON object with string keys).
            let map: serde_json::Map<String, serde_json::Value> = rows
                .into_iter()
                .map(|(id, count)| (id.to_string(), serde_json::json!(count)))
                .collect();
            (StatusCode::OK, Json(serde_json::Value::Object(map)))
        }
        Err(e) => {
            tracing::error!("Failed to list response counts: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Internal Error" })),
            )
        }
    }
}
```

- [ ] **Step 2: Registrer la route**

Dans `create_router` (ligne ~712-728), ajouter la route AVANT la ligne `.route("/api/v1/forms/:id/responses", get(list_responses))` pour que le path fixe `response-counts` soit matché avant le path paramétré `:id/responses` :

```rust
    let protected_routes = Router::new()
        .route("/api/v1/forms", get(list_forms).post(create_form))
        .route(
            "/api/v1/forms/:id",
            get(get_form).put(update_form).delete(delete_form),
        )
        .route("/api/v1/forms/:id/publish", post(publish_form))
        .route(
            "/api/v1/forms/:id/unpublish",
            axum::routing::patch(unpublish_form),
        )
        // Bulk aggregate — MUST come before `:id/responses` to avoid the
        // :id pattern catching "response-counts" as a form id.
        .route("/api/v1/forms/response-counts", get(list_response_counts))
        .route("/api/v1/forms/:id/responses", get(list_responses))
        // ... rest unchanged
```

- [ ] **Step 3: Vérifier le service compile**

Run :
```bash
rtk cargo check -p signapps-forms 2>&1 | tail -5
```
Expected : 0 erreurs.

---

## Task 3: API client `formsApi.responseCounts`

**Files:**
- Modify: `client/src/lib/api/forms.ts` (add method in `formsApi`)

- [ ] **Step 1: Ajouter la méthode**

Juste après `responses` (ligne ~136), ajouter :

```ts
  /**
   * Bulk response-count endpoint. Returns a map `form_id → count` for all
   * forms the caller owns. Replaces N+1 pattern of calling `responses(id)`
   * per form just to count.
   */
  responseCounts: () =>
    formsClient().get<Record<string, number>>("/forms/response-counts"),
```

- [ ] **Step 2: Vérifier tsc**

Run :
```bash
cd /c/Prog/signapps-platform/client && timeout 90 npx tsc --noEmit 2>&1 | grep "error TS" | head -3
```
Expected : aucun.

---

## Task 4: Refactorer `forms/page.tsx` pour utiliser le bulk endpoint

**Files:**
- Modify: `client/src/app/forms/page.tsx:190-213`

- [ ] **Step 1: Remplacer la `queryFn` par un double appel parallèle**

Ligne 190-213 avant :
```ts
  const { data: forms = [], isLoading: formsLoading } = useQuery<Form[]>({
    queryKey: ["forms"],
    queryFn: async () => {
      const res = await formsApi.list();
      return Promise.all(
        res.data.map(async (f: any) => {
          let response_count = 0;
          try {
            const rr = await formsApi.responses(f.id);
            response_count = Array.isArray(rr.data) ? rr.data.length : 0;
          } catch {}
          return {
            id: f.id,
            title: f.title,
            description: f.description || "",
            status: (f.is_published ? "published" : "draft") as
              | "published"
              | "draft",
            response_count,
            created_at: f.created_at,
```

après :
```ts
  const { data: forms = [], isLoading: formsLoading } = useQuery<Form[]>({
    queryKey: ["forms"],
    queryFn: async () => {
      // 2 parallel requests instead of 1 + N (was: list + N× responses(f.id)).
      const [listRes, countsRes] = await Promise.all([
        formsApi.list(),
        formsApi.responseCounts().catch(() => ({ data: {} as Record<string, number> })),
      ]);
      const counts = countsRes.data ?? {};
      return listRes.data.map((f) => ({
        id: f.id,
        title: f.title,
        description: f.description || "",
        status: (f.is_published ? "published" : "draft") as
          | "published"
          | "draft",
        response_count: counts[f.id] ?? 0,
        created_at: f.created_at,
```

Le `.catch` garantit qu'un échec du bulk endpoint dégrade gracieusement (counts à 0) plutôt que de casser la liste entière.

- [ ] **Step 2: Vérifier les lignes suivantes du map restent cohérentes**

Lire les lignes 213-230 pour confirmer que le rest du `.map((f) => ({ ... }))` n'utilise plus `any` et accède bien aux champs de `Form` via le typage retourné par `formsApi.list()`.

```bash
cd /c/Prog/signapps-platform/client && sed -n '195,230p' src/app/forms/page.tsx
```

- [ ] **Step 3: Vérifier tsc + eslint**

Run :
```bash
npx tsc --noEmit 2>&1 | grep "error TS" | head -5
npx eslint src/app/forms/page.tsx 2>&1 | tail -5
```
Expected : 0 erreurs tsc + 0 errors eslint (warnings OK).

---

## Task 5: Commit 1

- [ ] **Step 1: Valider workspace**

Run :
```bash
cd /c/Prog/signapps-platform && rtk cargo check -p signapps-forms -p signapps-db-forms 2>&1 | tail -3
cd client && timeout 90 npx tsc --noEmit 2>&1 | grep -c "error TS"
```
Expected : 0 + 0.

- [ ] **Step 2: Commit**

```bash
cd /c/Prog/signapps-platform && rtk git add crates/signapps-db-forms/src/repositories/form_repository.rs services/signapps-forms/src/main.rs client/src/lib/api/forms.ts client/src/app/forms/page.tsx && rtk git commit -m "perf(forms): add bulk response-counts endpoint + client switch

Eliminate the N+1 pattern on /forms dashboard load:
- Backend: new GET /api/v1/forms/response-counts handler returning a
  {form_id: count} map. Single SQL: GROUP BY form_id WHERE form_id =
  ANY(owned_ids). Route registered BEFORE :id/responses so the fixed
  path is matched first.
- Backend: FormRepository::list_response_counts aggregates in one
  query.
- Frontend: formsApi.responseCounts() + forms/page.tsx switches to
  2 parallel requests (list + counts) with graceful fallback to 0 if
  counts endpoint fails.

Metrics: N+1 HTTP requests -> 2 HTTP requests for N forms. Measurable
difference: /forms page load with 50 forms goes from 51 round-trips
to 2.

Validation: cargo check -p signapps-forms -p signapps-db-forms 0 errors,
tsc --noEmit 0 errors.

Part of Phase D (docs/superpowers/specs/2026-04-16-phase-d-targeted-perf-design.md)."
```

---

# COMMIT 2 — Storage delete_many parallelization

## Task 6: Ajouter la dépendance `futures`

**Files:**
- Modify: `services/signapps-storage/Cargo.toml`

- [ ] **Step 1: Lire l'état actuel**

```bash
cat services/signapps-storage/Cargo.toml | grep -A30 "\[dependencies\]" | head -40
```

- [ ] **Step 2: Ajouter `futures = "0.3"` dans `[dependencies]`**

Dans `[dependencies]` (après `tokio = { workspace = true }` ligne ~21), ajouter :

```toml
futures = "0.3"
```

Si `futures` apparaît déjà dans le workspace via `[workspace.dependencies]`, préférer :

```toml
futures = { workspace = true }
```

Vérifier avec :
```bash
grep -E "^futures" /c/Prog/signapps-platform/Cargo.toml | head -3
```
Si une ligne existe dans le workspace root Cargo.toml, utiliser `{ workspace = true }`.

- [ ] **Step 3: Vérifier le lock est à jour**

Run :
```bash
rtk cargo check -p signapps-storage 2>&1 | tail -3
```
Expected : 0 erreurs (peut ajouter une entry dans Cargo.lock).

---

## Task 7: Paralléliser `delete_many`

**Files:**
- Modify: `services/signapps-storage/src/handlers/files.rs:920-949`

- [ ] **Step 1: Ajouter les imports nécessaires**

Tout en haut du fichier (ligne ~15, après les `use signapps_common::...`), ajouter :

```rust
use futures::stream::{self, StreamExt, TryStreamExt};
```

Vérifier la ligne 15 :
```bash
sed -n '13,18p' services/signapps-storage/src/handlers/files.rs
```

- [ ] **Step 2: Remplacer la boucle séquentielle par un stream parallèle**

Lignes 926-943 avant :
```rust
    let user_id = claims.sub;
    for key in &payload.keys {
        // Authorization must be checked per key — batch endpoints cannot
        // rely on the single-file handler's check.
        check_file_permission(&state, &claims, &bucket, key, Action::delete()).await?;

        // Get info first to know size for quota update
        let info = state.storage.get_object_info(&bucket, key).await.ok();

        // Even if delete fails, we might want to continue, but here we propagate error as typically requested
        // Or we could try best effort. Using ? implies we stop on error.
        state.storage.delete_object(&bucket, key).await?;

        if let Some(info) = info {
            if let Err(e) = quotas::record_delete(&state, user_id, &bucket, key, info.size).await {
                tracing::error!(error = %e, "Failed to record delete quota");
            }
        }
    }
```

après :
```rust
    let user_id = claims.sub;

    // Parallelize per-key work with a bounded concurrency (8). This
    // preserves per-key permission checks but divides latency by
    // `buffer_unordered(8)` for large batches (was sequential,
    // resulting in N × (perm + info + delete + quota) round-trips in
    // series).
    //
    // Any per-key error short-circuits via try_collect, matching the
    // previous `?` propagation semantics: if one key fails, the batch
    // fails, the remaining in-flight futures are dropped.
    const CONCURRENCY: usize = 8;
    stream::iter(payload.keys.clone())
        .map(|key| {
            let state = state.clone();
            let claims = claims.clone();
            let bucket = bucket.clone();
            async move {
                check_file_permission(&state, &claims, &bucket, &key, Action::delete())
                    .await?;
                let info = state.storage.get_object_info(&bucket, &key).await.ok();
                state.storage.delete_object(&bucket, &key).await?;
                if let Some(info) = info {
                    if let Err(e) =
                        quotas::record_delete(&state, user_id, &bucket, &key, info.size)
                            .await
                    {
                        tracing::error!(error = %e, "Failed to record delete quota");
                    }
                }
                Ok::<_, Error>(())
            }
        })
        .buffer_unordered(CONCURRENCY)
        .try_collect::<Vec<_>>()
        .await?;
```

- [ ] **Step 3: Vérifier que `AppState` et `Claims` sont `Clone`**

Les deux doivent être Clone pour que le stream puisse les cloner dans chaque itération. Vérifier :

```bash
grep -nE "^#\[derive.*Clone|impl Clone for AppState" services/signapps-storage/src/state.rs 2>&1 | head -5
grep -nE "^#\[derive.*Clone|impl Clone for Claims" crates/signapps-common/src/auth.rs 2>&1 | head -5
```

Expected : les deux dérivent `Clone`. Si `AppState` ne dérive pas `Clone`, cette task est bloquée — escalader.

- [ ] **Step 4: Vérifier la compilation**

Run :
```bash
rtk cargo check -p signapps-storage 2>&1 | grep -E "^error" | head -10
```
Expected : 0 erreurs.

Si erreur "cannot move out of `claims`" ou similaire, vérifier que `claims` est bien cloné dans le closure via `let claims = claims.clone()` avant `async move`. Si erreur "doesn't live long enough" sur `bucket`, même fix avec `let bucket = bucket.clone()`.

---

## Task 8: Commit 2

- [ ] **Step 1: Valider**

Run :
```bash
rtk cargo check -p signapps-storage 2>&1 | tail -3
```
Expected : 0 erreurs.

- [ ] **Step 2: Commit**

```bash
rtk git add services/signapps-storage/Cargo.toml services/signapps-storage/src/handlers/files.rs Cargo.lock && rtk git commit -m "perf(storage): parallelize delete_many permission checks

delete_many was a sequential 'for key in keys' loop, running per-key:
  check_file_permission -> get_object_info -> delete_object -> quota

For N keys this produced N × 4 sequential round-trips to the DB and
object store. Re-wrote using futures::stream with buffer_unordered(8)
to run up to 8 keys in flight simultaneously.

Semantics preserved:
- Per-key authorization check (no batch bypass)
- First error short-circuits the batch (matches previous ? propagation)
- Quota errors logged but do not fail the batch (unchanged)

Metrics: N sequential -> N parallel with concurrency=8. For a 16-key
batch, latency drops from 16× single-key time to ~2× (2 waves of 8).

Added: futures = '0.3' (or { workspace = true } if already there)

Validation: cargo check -p signapps-storage 0 errors.

Part of Phase D (docs/superpowers/specs/2026-04-16-phase-d-targeted-perf-design.md)."
```

---

# COMMIT 3 — Chat + storage frontend optimizations

## Task 9: Chat — `useUser(id)` selector avec shallow equality

**Files:**
- Modify: `client/src/lib/store/chat-store.ts` (add `useUser` selector)
- Modify: `client/src/components/chat/message-item.tsx:79,133-135` (switch to new selector)

- [ ] **Step 1: Ajouter `useUser(userId)` selector**

Dans `chat-store.ts`, ligne ~89 (juste après `useUsersMap`), ajouter :

```ts
/**
 * Return a single user from the usersMap keyed by either `userId` (id) or
 * `username` (fallback). Uses a selector that returns only the relevant
 * user — consumers re-render only when THIS user changes, not on any
 * modification of the map.
 *
 * Prefer this over `useUsersMap()` for per-message usage where you only
 * need one user.
 */
export const useUser = (
  userId: string | undefined,
  username?: string,
): { id?: string; username?: string; avatar_url?: string } | undefined =>
  useChatStore((state) => {
    if (!userId && !username) return undefined;
    if (userId && state.usersMap[userId]) return state.usersMap[userId];
    if (username) {
      return Object.values(state.usersMap).find((u) => u.username === username);
    }
    return undefined;
  });
```

Note: le type de retour reprend ce que `chat-store.ts` expose déjà ; si le type `User` est exporté, le remplacer. Vérifier :
```bash
grep -n "export.*interface User\|^interface User" src/lib/store/chat-store.ts | head -3
```
Si `User` est exporté, écrire `): User | undefined =>`. Sinon, garder le type inline ci-dessus.

- [ ] **Step 2: Remplacer l'usage dans `message-item.tsx`**

Ligne 30 (import) reste identique mais ajouter `useUser` dans l'import :

```ts
import { useUsersMap, useUser } from "@/lib/store/chat-store";
```

Si `useUsersMap` n'est plus utilisé ailleurs dans le fichier (vérifier avec grep), le retirer de l'import.

Ligne 79 avant :
```ts
  const usersMap = useUsersMap();
```
après : supprimer cette ligne.

Ligne 133-135 avant :
```ts
  const targetUser =
    usersMap[message.senderId] ||
    Object.values(usersMap).find((u) => u.username === message.senderName);
```
après :
```ts
  const targetUser = useUser(message.senderId, message.senderName);
```

- [ ] **Step 3: Vérifier qu'il n'y a pas d'autres usages de `usersMap` dans le fichier**

Run :
```bash
grep -n "usersMap" src/components/chat/message-item.tsx
```
Expected : aucune ligne. Si des lignes apparaissent, les migrer vers `useUser()` ou garder `useUsersMap` dans l'import et dans le code pour ces usages résiduels.

- [ ] **Step 4: Vérifier tsc**

Run :
```bash
cd /c/Prog/signapps-platform/client && npx tsc --noEmit 2>&1 | grep "error TS" | head -5
```
Expected : aucun.

---

## Task 10: Wrap `MessageItem` dans `React.memo`

**Files:**
- Modify: `client/src/components/chat/message-item.tsx:66` (export signature)

- [ ] **Step 1: Inspecter le pattern d'export actuel**

```bash
grep -nE "^export function MessageItem|^export const MessageItem|^const MessageItem" src/components/chat/message-item.tsx
```

Le pattern actuel est `export function MessageItem(...)`. Fix : extraire le corps en fonction interne et exporter un `React.memo` wrap.

- [ ] **Step 2: Remplacer le signature d'export**

Ligne 66 avant :
```ts
export function MessageItem({
```
après :
```ts
function MessageItemInner({
```

Puis en fin de fichier (juste avant le `}` final du composant, qui est typiquement ~1000+ lignes plus bas), ajouter une ligne d'export memo. Pour localiser la fin :

```bash
grep -n "^}" src/components/chat/message-item.tsx | tail -3
```

Le dernier `}` termine la fonction. Après ce `}` (dernière ligne du fichier), ajouter :

```ts

/**
 * Memoized export — re-renders only when props change, not on every
 * parent render. Critical for chat lists where hundreds of messages
 * can share the same parent update.
 */
export const MessageItem = React.memo(MessageItemInner);
```

Si `React` n'est pas importé en haut du fichier, ajouter :
```bash
grep -n "^import.*from \"react\"" src/components/chat/message-item.tsx | head -2
```

Si l'import existant n'inclut pas `React`, le modifier :
```ts
import React, { useState, useRef, useEffect } from "react";
```

- [ ] **Step 3: Vérifier tsc**

Run :
```bash
npx tsc --noEmit 2>&1 | grep "error TS" | head -5
```
Expected : aucun. Si erreur "Cannot find name 'React'", l'import React.memo via le namespace `React` nécessite le `import React from "react"` explicite.

---

## Task 11: Vérifier que storage file-row est déjà memoized (no-op)

**Files:**
- Check-only: `client/src/components/storage/file-list-item.tsx:35`, `file-grid-item.tsx:36`

- [ ] **Step 1: Confirmer l'état actuel**

Run :
```bash
grep -nE "React.memo" src/components/storage/file-list-item.tsx src/components/storage/file-grid-item.tsx
```

Expected :
```
src/components/storage/file-list-item.tsx:35:export const FileListItem = React.memo(function FileListItem({
src/components/storage/file-grid-item.tsx:36:export const FileGridItem = React.memo(function FileGridItem({
```

- [ ] **Step 2: Si confirmé, aucune action — documenter en commit message**

La vérification a confirmé que fix 5 est non-applicable (déjà fait dans la codebase). Notre commit Phase D documentera ce no-op dans son message.

Si PAS memoized, appliquer le même pattern que Task 10 à ce fichier et ajouter ce détail au commit message du Task 12.

---

## Task 12: Commit 3

- [ ] **Step 1: Valider**

Run :
```bash
cd /c/Prog/signapps-platform/client && timeout 90 npx tsc --noEmit 2>&1 | grep -c "error TS"
```
Expected : 0.

- [ ] **Step 2: Commit**

```bash
cd /c/Prog/signapps-platform && rtk git add client/src/lib/store/chat-store.ts client/src/components/chat/message-item.tsx && rtk git commit -m "perf(chat): useUser selector + MessageItem React.memo

Reduce re-renders in the chat message list:

1. New useUser(userId, username?) selector in chat-store. Returns the
   relevant user and re-renders only when THAT user changes — not on
   every modification of usersMap. Replaces the 'grab the whole map,
   index into it, re-render on any change' anti-pattern in
   message-item.tsx.

2. Wrapped MessageItem in React.memo. With the new selector feeding
   stable props, React now skips re-renders of unchanged messages
   entirely.

Metrics:
- Before: 1 user update -> N MessageItem re-renders (N = visible
  messages).
- After: 1 user update -> 1 MessageItem re-render (only the affected
  message).

Storage file-list-item and file-grid-item were confirmed already
wrapped in React.memo (lines file-list-item.tsx:35 and
file-grid-item.tsx:36) — no action needed, documented here.

Validation: tsc --noEmit 0 errors.

Part of Phase D (docs/superpowers/specs/2026-04-16-phase-d-targeted-perf-design.md)."
```

---

# Post-completion sanity check

## Task 13: Verify end-state

- [ ] **Step 1: Global cargo + tsc**

```bash
cd /c/Prog/signapps-platform && rtk cargo check --workspace 2>&1 | tail -3
cd client && timeout 90 npx tsc --noEmit 2>&1 | grep -c "error TS"
```
Expected : 0 erreurs cargo + 0 erreurs tsc.

- [ ] **Step 2: ESLint**

```bash
npx eslint src/ 2>&1 | tail -3
```
Expected : 0 errors (warnings OK).

- [ ] **Step 3: Git log**

```bash
cd /c/Prog/signapps-platform && rtk git log --oneline -6
```
Expected : 3 commits Phase D (`perf(forms)`, `perf(storage)`, `perf(chat)`).

- [ ] **Step 4: Manual smoke (optional mais recommandé)**

Démarrer le frontend + les services concernés et vérifier :
```bash
cd client && npm run dev
```
- `/forms` charge avec 2 HTTP requests (visible dans Network tab)
- Drive batch delete fonctionne (plusieurs fichiers sélectionnés)
- Chat n'a pas de régression visuelle

Si smoke OK, Phase D est complète.
