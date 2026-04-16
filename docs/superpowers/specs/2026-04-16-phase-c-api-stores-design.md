# Phase C — lib/api + stores `any` Elimination — Design Spec

**Date:** 2026-04-16
**Statut:** Validated, ready for implementation plan
**Auteurs:** Brainstorming Claude + Étienne

---

## 1. Context & Goals

### 1.1 Problem

La Phase A (bug sweep) a réduit les warnings ESLint de 298 à 291. La majorité des warnings restants sont des `@typescript-eslint/no-explicit-any` — 291 au total côté frontend, à travers 130+ fichiers. Un passage global est trop gros pour une session unique :

- Les composants UI dépendent de types tiers (recharts, tiptap, y.js) qui demandent une analyse par-fichier
- Les hooks de collaboration utilisent `any` pour contourner des limitations de y-websocket
- Le scope complet mélange plusieurs domaines (API, state, UI, integrations)

Cette spec traite un sous-ensemble contenu avec une frontière claire : **les 17 `any` présents dans `client/src/lib/api/**/*.ts` et `client/src/stores/**/*.ts`**. Ce sont des fichiers à interface nette (appels HTTP typés, stores Zustand) avec peu de dépendances tierces.

### 1.2 Goals

1. **Zéro `any`** dans `client/src/lib/api/` et `client/src/stores/` après l'implémentation
2. **Zéro changement de comportement** — uniquement des annotations de type
3. **Guardrail anti-régression** via règle ESLint `no-explicit-any: "error"` ciblée sur ces deux répertoires
4. **Validation automatique** — `tsc --noEmit` à 0 erreur, `eslint --max-warnings 0` sur le périmètre

### 1.3 Non-goals

- **Pas d'élimination des `any` dans les composants UI** — session C2 dédiée (recharts, tiptap, y.js)
- **Pas de codegen OpenAPI** — les types backend sont redéclarés manuellement côté TS dans cette phase
- **Pas de rustdoc coverage** — Phase C-backend dédiée
- **Pas de tests ajoutés** — les tests sont Phase F ; les tests existants restent verts

---

## 2. Paramètres validés

Décisions prises pendant le brainstorming :

| Axe | Choix |
|---|---|
| Niveau de rigueur | **Pragmatique** : `any` → type explicite ou `unknown` + narrowing, pas de codegen |
| Organisation des types | **Hybride** : `Api<Resource>` co-localisés dans `lib/api/<file>.ts`, types domain dans `src/types/` inchangés |
| Guardrail | **Override ESLint ciblé** : `no-explicit-any: "error"` sur `src/lib/api/**` + `src/stores/**` uniquement |
| Gouvernance | **Auto-chain** après approbation (validation auto tsc + eslint sur périmètre) |

---

## 3. Inventory précis

10 fichiers, 17 occurrences :

| Fichier | Count | Catégorie |
|---|---|---|
| `src/lib/api/crm.ts` | 4 | mappers (mapDeal, mapLead) |
| `src/stores/design-store.ts` | 2 | map callback + get<any> |
| `src/lib/api/scheduler.ts` | 2 | HTTP generics |
| `src/lib/api/metrics.ts` | 2 | HTTP generics |
| `src/lib/api/containers.ts` | 2 | HTTP generics |
| `src/stores/org-store.ts` | 1 | raw API array |
| `src/lib/api/spreadsheet.ts` | 1 | HTTP generic |
| `src/lib/api/monitoring.ts` | 1 | HTTP generic |
| `src/lib/api/forms.ts` | 1 | champ polymorphe `value: any` |
| `src/lib/api/factory.ts` | 1 | `Promise<any>` retour générique |

---

## 4. Architecture du pass

### 4.1 Règles de remplacement

**Catégorie 1 — API mappers** (crm.ts l.100/135/161/225, design-store.ts l.117)

Pattern avant :
```ts
function mapDeal(d: any): Deal { ... }
return (res.data as any[]).map(mapDeal);
```

Pattern après :
```ts
interface ApiDeal {
  id: string;
  name: string;
  amount_cents: number;
  stage: string;
  // ... shape backend snake_case
}
function mapDeal(d: ApiDeal): Deal { ... }
return res.data.map(mapDeal); // res.data déjà typé via get<ApiDeal[]>
```

Co-localisation : l'interface `Api<Resource>` vit dans le fichier API qui la consomme. Réutilisation possible via `export` si un store en a besoin.

**Catégorie 2 — Client HTTP génériques** (factory.ts, monitoring.ts, containers.ts, metrics.ts, scheduler.ts, spreadsheet.ts)

Pattern avant :
```ts
const res = await client.get<any>("/endpoint");
```

Pattern après :
```ts
interface ApiEndpointResponse { /* shape */ }
const res = await client.get<ApiEndpointResponse>("/endpoint");
```

`factory.ts:623 Promise<any>` : c'est le retour de `handleAuthError(error, client)`, appelé depuis l'error interceptor d'Axios (ligne 835). Ce handler soit rejette le promise, soit retry la requête et retourne sa réponse. Type correct : `Promise<AxiosResponse>` (ou `Promise<never>` si on modélise strictement les rejects — mais Axios s'attend à `Promise<AxiosResponse | undefined>` dans ce slot).

**Catégorie 3 — Champ polymorphe** (forms.ts:94 `value: any`)

Pattern avant :
```ts
interface FormFieldValue {
  value: any; // noqa
}
```

Pattern après :
```ts
type FormFieldValue =
  | string
  | number
  | boolean
  | string[]
  | Date
  | null;

interface FormField {
  value: FormFieldValue;
}
```

Union discriminée. Si une valeur custom apparaît à l'usage, on l'ajoute à l'union (jamais re-cast en `any`).

**Catégorie 4 — Store raw data** (org-store.ts:115, design-store.ts:258)

Pattern avant :
```ts
const allNodes: any[] = Array.isArray(raw) ? raw : [];
const res = await docsClient.get<any>(`/designs/${id}`);
```

Pattern après :
```ts
// Déclarer ApiOrgNode dans le fichier du store (ou importer depuis lib/api/org si déjà défini)
interface ApiOrgNode { id: string; parent_id: string | null; /* ... */ }
const allNodes: ApiOrgNode[] = Array.isArray(raw) ? raw : [];

interface ApiDesign { id: string; name: string; content: string; /* ... */ }
const res = await docsClient.get<ApiDesign>(`/designs/${id}`);
```

### 4.2 Guardrail ESLint

`eslint.config.mjs` gagne un override :

```js
{
  files: ["src/lib/api/**/*.ts", "src/stores/**/*.ts"],
  rules: {
    "@typescript-eslint/no-explicit-any": "error",
  },
}
```

L'override est additif — il ne touche pas les règles globales. Le reste du codebase garde ses 291 warnings existants. Seules les régressions dans le périmètre traité seront bloquantes.

---

## 5. Plan d'exécution

3 commits en séquence :

1. **`refactor(api): replace any with explicit types`** — 8 fichiers dans `src/lib/api/`. Définition des `Api<Resource>` interfaces, mise à jour des signatures, validation `tsc`.
2. **`refactor(stores): replace any with explicit types`** — 2 fichiers dans `src/stores/`. Même approche, réutilise les types API là où pertinent (import depuis `lib/api/`).
3. **`chore(eslint): enforce no-explicit-any in lib/api + stores`** — override ESLint + commit de validation.

### Validation par commit

Pour chaque commit :
- `npx tsc --noEmit` retourne 0 erreur
- `npx eslint src/lib/api src/stores --max-warnings 99999` retourne 0 warning sur les lignes modifiées
- Après le commit 3 : `npx eslint src/lib/api src/stores --max-warnings 0` passe

Pour le dernier commit :
- Au cas où une régression glisse (par exemple un cast oublié), le build ESLint strict l'attrape immédiatement.

---

## 6. Strategy pour déduire les types backend

Pour chaque `Api<Resource>`, la shape vient de 3 sources en ordre de préférence :

1. **Model Rust** déjà documenté (`grep 'struct Deal' crates/signapps-db*/src/models/`) — source of truth
2. **Handler `utoipa::path` + `ToSchema`** qui décrit le body/response — confirme les noms snake_case
3. **Exemples de réponse** stockés en logs ou tests — fallback si les deux ci-dessus ne sont pas clairs

Si une shape est ambiguë après ces 3 vérifications, l'interface peut être déclarée avec des champs optionnels (`field?: string`) plutôt que d'introduire un `any`.

---

## 7. Error handling

Les appels API qui échouent lèvent toujours via Axios (les catch existants restent). Le typage ne change rien aux erreurs runtime. Si un response backend revient avec un champ manquant, le mapper TS échoue silencieusement (undefined propagé) — c'est le comportement actuel et il n'est pas modifié par cette phase.

---

## 8. Testing

Pas de nouveau test (Phase F dédiée). Validation :

- `tsc --noEmit` : compile sans erreurs
- `eslint src/lib/api src/stores --max-warnings 0` : zéro warning dans le périmètre
- `npm run build` : build frontend réussit
- Tests existants (si présents) restent verts

---

## 9. Success criteria

- [ ] Zéro `any` dans `src/lib/api/**/*.ts` (grep check)
- [ ] Zéro `any` dans `src/stores/**/*.ts` (grep check)
- [ ] `eslint.config.mjs` contient l'override `error` sur les deux patterns
- [ ] `tsc --noEmit` passe (0 erreur)
- [ ] `eslint src/lib/api src/stores --max-warnings 0` passe
- [ ] 3 commits bien séparés pour le review
- [ ] Aucun changement de comportement runtime (tests verts, build OK)

---

## 10. Out-of-scope (futures phases)

- **Phase C-UI** : `any` dans `src/components/**` et `src/app/**` (recharts, tiptap, y.js — ~270 warnings restants)
- **Phase C-backend** : rustdoc coverage + clippy strict cleanup (~2735 rustdoc warnings)
- **Phase C-codegen** : generation automatique des types TS depuis OpenAPI (ajoute outillage + CI step)

Chacune aura son propre brainstorming → spec → plan au moment voulu.

---

## 11. Glossaire

- **`Api<Resource>`** : interface TypeScript décrivant la shape brute de l'API backend (snake_case, champs Rust tels quels). Par opposition au type domain `<Resource>` (camelCase, possiblement enrichi/transformé).
- **Pragmatic rigor** : accepter `unknown` + narrowing quand un type polymorphe est justifié ; sinon exiger un type explicite.
- **Override ESLint ciblé** : règle plus stricte appliquée seulement à un file pattern, additive par rapport aux règles globales.
