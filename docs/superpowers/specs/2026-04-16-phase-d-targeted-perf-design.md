# Phase D — Targeted Performance Fixes — Design Spec

**Date:** 2026-04-16
**Statut:** Validated, ready for implementation plan
**Auteurs:** Brainstorming Claude + Étienne

---

## 1. Context & Goals

### 1.1 Problem

La Phase A (bug sweep) a identifié plusieurs items de performance lors des audits par module, mais n'a pas pris le temps de les fixer (hors scope de A). Le journal `docs/bug-sweep/journal-2026-04-16.md` documente ces items dans les sections "Deferred" de chaque module.

Plutôt que de lancer un audit perf général (qui demanderait bundle analyze, profiling, mesures de baseline), cette phase traite uniquement les items **déjà identifiés** avec un fix chirurgical.

### 1.2 Goals

1. **Eliminer le N+1 forms** — la page forms charge actuellement 1 + N requêtes HTTP pour obtenir les counts de responses
2. **Paralléliser storage `delete_many`** — les permission checks séquentiels multiplient la latence par N
3. **Réduire les re-renders inutiles** dans les listes massives (chat messages, storage files)
4. **Métriques before/after qualitatives** documentées dans les commit messages (ratio HTTP requests, ratio re-renders)

### 1.3 Non-goals

- **Pas d'audit perf général** (bundle analyze, code splitting, lazy loading) — Phase D2 dédiée
- **Pas d'instrumentation `performance.mark`/`measure`** — overhead de maintenance non justifié pour ces 5 fixes
- **Pas de benchmarks automatisés** (Playwright timing, Lighthouse CI) — Phase F (tests) dédiée
- **Pas de fix du Y.UndoManager spreadsheet** — après re-lecture, le cleanup est correct (journal P2 était conservateur)
- **Pas de billing plans tenant_id** — c'est de la sécurité/isolation (tenant boundary), pas de la perf

---

## 2. Paramètres validés

| Axe | Choix |
|---|---|
| Approche | **Mixte backend + frontend** — les gains les plus visibles sont la latence forms (backend), le reste est frontend micro-optimisation |
| Métriques | **Qualitatives** — ratios HTTP et re-renders dans commits, pas d'instrumentation |
| Gouvernance | **Auto-chain** après approbation — validation auto par tsc + cargo check |

---

## 3. Inventory précis

5 fixes, 3 commits :

| # | Cible | Type | Effort |
|---|---|---|---|
| 1 | `services/signapps-forms/` + `client/src/app/forms/page.tsx` | Backend endpoint + frontend call | Moyen |
| 2 | `services/signapps-storage/src/handlers/files.rs:920` | Backend parallélisation | Faible |
| 3 | `client/src/components/chat/message-item.tsx` | `useShallow` wrap | Faible |
| 4 | `client/src/components/chat/message-item.tsx` | `React.memo` wrap | Faible |
| 5 | `client/src/components/storage/*-row.tsx` ou équivalent | `React.memo` wrap | Faible |

---

## 4. Architecture des fixes

### 4.1 Fix 1 — Forms bulk response-counts

**Problème actuel** (`client/src/app/forms/page.tsx:190-213`) :
```ts
const { data: forms = [], isLoading } = useQuery<Form[]>({
  queryKey: ["forms"],
  queryFn: async () => {
    const res = await formsApi.list();
    return Promise.all(
      res.data.map(async (f: any) => {
        let response_count = 0;
        try {
          const rr = await formsApi.responses(f.id);  // ← 1 HTTP call per form
          response_count = Array.isArray(rr.data) ? rr.data.length : 0;
        } catch {}
        return { ...f, response_count };
      }),
    );
  },
});
```

Pour N forms, on fait 1 + N requêtes HTTP. Sur une organisation avec 50 forms, 51 round-trips au chargement de la page.

**Fix** :
- Backend : nouveau handler `GET /api/v1/forms/response-counts` dans `services/signapps-forms/src/handlers/responses.rs` (ou `forms.rs`), requête SQL unique avec `SELECT form_id, COUNT(*) FROM forms.responses GROUP BY form_id WHERE form_id = ANY($1)` ou même simplement `GROUP BY form_id` limité au tenant courant.
- Frontend : `forms/page.tsx` fait 2 requêtes en parallèle (`formsApi.list()` + nouveau `formsApi.responseCounts()`), joint les deux maps côté client.
- Métrique : **N+1 requêtes → 2 requêtes** pour N forms.

### 4.2 Fix 2 — Storage delete_many parallelisation

**Problème actuel** (`services/signapps-storage/src/handlers/files.rs:920-944`) :
```rust
for key in &payload.keys {
    check_file_permission(&state, &claims, &bucket, key, Action::delete()).await?;
    let info = state.storage.get_object_info(&bucket, key).await.ok();
    state.storage.delete_object(&bucket, key).await?;
    // + quotas::record_delete
}
```

Pour N keys, on a N séquentiels × (1 perm check + 1 info + 1 delete + 1 quota) = 4N DB/storage round-trips en série.

**Fix** :
- Paralléliser la boucle via `futures::future::try_join_all` ou un stream avec concurrency limit.
- Garder `?` propagation pour ne pas poursuivre si une permission échoue (semantics identiques).
- Métrique : **N séquentiel → N parallèle** (latence divisée par ~N jusqu'à la concurrency limit).

Note : une parallélisation agressive peut saturer le pool DB. Utiliser `buffer_unordered(8)` ou similar pour limiter.

### 4.3 Fix 3 — Chat useUsersMap shallow selector

**Problème actuel** (`client/src/components/chat/message-item.tsx:79` supposé) :
```ts
const usersMap = useUsersMap();  // Returns full Map ref
const user = usersMap.get(msg.userId);
```

Tout changement du Map (un user vient online, un avatar change) re-renderise tous les MessageItem.

**Fix** :
- Utiliser `useShallow` de zustand ou un selector avec égalité shallow : `useUsersMap(msg.userId)` retourne juste l'user concerné.
- Pour ne pas casser l'API publique, on peut exposer `useUser(userId)` qui retourne `User | undefined` avec égalité `Object.is` sur l'user lui-même.
- Métrique : **100 messages + 1 user update → 100 re-renders → 1 re-render**.

### 4.4 Fix 4 — Chat MessageItem React.memo

**À vérifier** : est-ce que `MessageItem` est déjà wrapped dans `React.memo` ?
- Si oui : rien à faire.
- Si non : ajouter `export const MessageItem = React.memo(MessageItemInner)`, avec un custom comparator si les props contiennent des objets.
- Métrique : **re-render systématique → re-render uniquement si props changent**.

### 4.5 Fix 5 — Storage file row React.memo

**À évaluer** : quel est le composant qui rend chaque fichier dans la file list ?
- Si `FileRow` / `StorageFileItem` existe et n'est pas memoized, wrap.
- Si le rendering est inline dans un `files.map(...)`, extraction + memo.
- Effort conditionnel selon l'état actuel.
- Métrique : **re-render de tous les rows sur tout changement → rows stables re-render seulement sur changement de leur propre file**.

---

## 5. Plan d'exécution

3 commits séquentiels :

1. **`perf(forms): add bulk response-counts endpoint + client switch`**
   - Backend : handler + route + payload type
   - Frontend : new API client method + query refactor
   - Couplé parce que le client dépend du nouveau endpoint

2. **`perf(storage): parallelize delete_many permission checks`**
   - Backend uniquement, dans `files.rs:920-944`
   - `futures::stream` avec `buffer_unordered`

3. **`perf(chat,storage): React.memo + useShallow optimizations`**
   - Frontend uniquement (fixes 3, 4, 5)
   - Un seul commit car changements interdépendants sur les mêmes listes

### Validation

Pour chaque commit :
- `cargo check --workspace` 0 erreur (pour commits 1 et 2)
- `tsc --noEmit` 0 erreur (pour commits 1 et 3)
- `eslint src/` 0 erreur
- Comportement fonctionnel inchangé (les listes s'affichent correctement, les deletes fonctionnent)

---

## 6. Error handling

- **Fix 1** : si le nouveau endpoint échoue, fallback au comportement précédent (N+1) est inutile — on affiche les forms sans count plutôt que de re-faire N requêtes. Échec silencieux avec count=0 pour tous.
- **Fix 2** : parallélisation préserve la propagation d'erreur via `try_join_all`. Si une permission check échoue, la première erreur est retournée (ordre non garanti, mais semantics "at least one failed" identique à la boucle séquentielle).
- **Fixes 3-5** : aucun changement de comportement runtime, uniquement optimisation de re-renders.

---

## 7. Testing

- Pas de nouveau test (Phase F dédiée).
- Validation manuelle via smoke : charger `/forms`, vérifier les counts s'affichent ; sélectionner plusieurs fichiers dans Drive, vérifier delete batch fonctionne ; spammer un chat et vérifier que les re-renders sont réduits (React DevTools Profiler).
- Tests existants restent verts.

---

## 8. Success criteria

- [ ] Fix 1 : `/forms` page fait exactement 2 HTTP requests au load (vérifiable via Network tab), down from 1+N
- [ ] Fix 2 : `delete_many` utilise `buffer_unordered` ou `try_join_all` — latence divisée par la concurrency (N parallèle au lieu de N séquentiel)
- [ ] Fix 3 : modifier un user dans le usersMap ne re-renderise qu'un seul `MessageItem`
- [ ] Fix 4 : `MessageItem` wrap confirmé
- [ ] Fix 5 : file-row memoization confirmée (ou non-applicable documenté)
- [ ] `tsc --noEmit` 0 erreur
- [ ] `cargo check --workspace` 0 erreur
- [ ] 3 commits bien séparés

---

## 9. Out-of-scope (futures phases)

- **Phase D2 — Bundle analyze** : `@next/bundle-analyzer`, code splitting audit, lazy loading opportunities
- **Phase D3 — Backend profiling** : tracing spans + latency metrics exposés en Prometheus
- **Phase D4 — Database indexing** : audit pg_stat_statements pour slow queries
- **Phase E — Accessibility**
- **Phase F — Test coverage**

Chacune aura son propre brainstorming → spec → plan au moment voulu.

---

## 10. Glossaire

- **N+1 query** : antipattern où 1 requête liste renvoie N items, puis N requêtes supplémentaires enrichissent chaque item. Fix : 1 requête bulk côté serveur.
- **`useShallow`** : helper zustand qui compare le retour du selector via shallow equality (vs `Object.is`). Empêche les re-renders quand la référence change mais le contenu reste égal champ par champ.
- **`React.memo`** : HOC qui évite le re-render d'un composant si ses props sont shallow-equal aux précédentes.
- **Concurrency limit** : nombre max de tâches parallèles dans un stream (`buffer_unordered(8)` = max 8 tâches en vol simultanément).
