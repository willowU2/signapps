# Phase C — lib/api + stores any Elimination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer les 17 occurrences de `any` dans `client/src/lib/api/**/*.ts` et `client/src/stores/**/*.ts` par des types explicites, puis verrouiller le périmètre avec un override ESLint strict.

**Architecture:** 3 commits séquentiels. Commit 1 traite les 8 fichiers lib/api, commit 2 les 2 stores, commit 3 ajoute l'override ESLint. Les types "API brute" (snake_case) sont co-localisés dans les fichiers qui les consomment ; les types domain restent inchangés. Validation par `tsc --noEmit` après chaque commit.

**Tech Stack:** TypeScript strict, ESLint 9 flat config (`eslint.config.mjs`), Next.js 16 client compilation via Webpack.

**Spec :** `docs/superpowers/specs/2026-04-16-phase-c-api-stores-design.md`

---

# COMMIT 1 — lib/api typing

## Task 1: `src/lib/api/crm.ts` — typer mapDeal, mapLead, et leurs casts

**Files:**
- Modify: `client/src/lib/api/crm.ts:96-151,161,225`

- [ ] **Step 1: Ajouter les interfaces `ApiDeal` et `ApiLead` au-dessus de `mapDeal`**

Remplacer les lignes 96-151 par :

```ts
// ─── Backend ↔ frontend mappers ───────────────────────────────────────────────

/** Raw shape returned by the backend for a CRM deal (crm.deals table). */
interface ApiDeal {
  id: string;
  title: string;
  contact_name?: string | null;
  contact_id?: string | null;
  contact_email?: string | null;
  amount?: number | null;
  probability?: number | null;
  stage?: string | null;
  close_date?: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

/** Raw shape returned by the backend for a CRM lead (crm.leads table). */
interface ApiLead {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  source?: string | null;
  status?: string | null;
  score?: number | null;
  owner_id: string;
  tenant_id?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

// Backend returns snake_case; map to the camelCase Deal interface.
function mapDeal(d: ApiDeal): Deal {
  return {
    id: d.id,
    title: d.title,
    company: d.contact_name ?? "",
    contactId: d.contact_id ?? undefined,
    contactEmail: d.contact_email ?? undefined,
    value: d.amount ?? 0,
    probability: d.probability ?? 10,
    stage: (d.stage ?? "prospect") as DealStage,
    closeDate: d.close_date ?? undefined,
    assignedTo: d.owner_id,
    tags: [],
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  };
}

// Map Deal (UI) → backend create/update payload
function dealToPayload(data: Partial<Deal>) {
  return {
    ...(data.title !== undefined && { title: data.title }),
    ...(data.stage !== undefined && { stage: data.stage }),
    ...(data.value !== undefined && { amount: data.value }),
    ...(data.company !== undefined && { contact_name: data.company }),
    ...(data.contactId !== undefined && { contact_id: data.contactId }),
    ...(data.contactEmail !== undefined && {
      contact_email: data.contactEmail,
    }),
    ...(data.closeDate !== undefined && { close_date: data.closeDate }),
    ...(data.probability !== undefined && { probability: data.probability }),
  };
}

function mapLead(l: ApiLead): Lead {
  return {
    id: l.id,
    name: l.name,
    email: l.email ?? undefined,
    phone: l.phone ?? undefined,
    company: l.company ?? undefined,
    source: l.source ?? undefined,
    status: l.status ?? "new",
    score: l.score ?? 0,
    ownerId: l.owner_id,
    tenantId: l.tenant_id ?? undefined,
    notes: l.notes ?? undefined,
    createdAt: l.created_at,
    updatedAt: l.updated_at,
  };
}
```

- [ ] **Step 2: Remplacer les 2 casts `as any[]` par des casts typés**

Ligne 161 avant :
```ts
      const res = await contactsClient().get("/crm/deals", { params });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (res.data as any[]).map(mapDeal);
```
après :
```ts
      const res = await contactsClient().get<ApiDeal[]>("/crm/deals", {
        params,
      });
      return (res.data ?? []).map(mapDeal);
```

Ligne 225 avant :
```ts
      const res = await contactsClient().get("/crm/leads", { params });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (res.data as any[]).map(mapLead);
```
après :
```ts
      const res = await contactsClient().get<ApiLead[]>("/crm/leads", {
        params,
      });
      return (res.data ?? []).map(mapLead);
```

- [ ] **Step 3: Vérifier les appels de `mapDeal`/`mapLead` isolés (lignes 170, 180, 192, puis équivalents Lead)**

Les callsites `return mapDeal(res.data);` doivent typer le `get` aussi. Dans `dealsApi.get` ligne 169 :
```ts
      const res = await contactsClient().get<ApiDeal>(`/crm/deals/${id}`);
      return mapDeal(res.data);
```
Même pattern pour `create` (ligne 179) et `update` (ligne 188).

Dans `leadsApi.get`, `create`, `update` : appliquer `get<ApiLead>` / `post<ApiLead>` / `put<ApiLead>`. Rechercher tous les appels qui passent `res.data` à `mapLead` :

```bash
cd client && grep -n "mapLead\|mapDeal" src/lib/api/crm.ts
```

Pour chaque callsite, ajouter le type générique explicite au verbe HTTP.

- [ ] **Step 4: Vérifier le fichier compile**

Run :
```bash
cd /c/Prog/signapps-platform/client && npx tsc --noEmit 2>&1 | grep "crm.ts" | head -10
```
Expected : aucune ligne d'erreur mentionnant `crm.ts`.

- [ ] **Step 5: Vérifier qu'il n'y a plus de `any` dans le fichier**

Run :
```bash
grep -nE ": any|<any>| as any" client/src/lib/api/crm.ts
```
Expected : aucune ligne affichée.

---

## Task 2: `src/lib/api/scheduler.ts` — typer create/update de timeItems

**Files:**
- Modify: `client/src/lib/api/scheduler.ts:214-216`

- [ ] **Step 1: Déclarer les types de payload**

Ajouter juste avant `export const timeItemsApi = {` (ligne ~204) :

```ts
/**
 * Shape of the body accepted by POST /time_items (TimeItem creation).
 * Mirrors the backend `CreateTimeItemRequest` in signapps-scheduler.
 * All fields are optional except those required to instantiate the item
 * (item_type, title); the backend applies defaults otherwise.
 */
export interface CreateTimeItemRequest {
  item_type: string;
  title: string;
  description?: string;
  start_time?: string;
  end_time?: string;
  deadline?: string;
  duration_minutes?: number;
  all_day?: boolean;
  timezone?: string;
  project_id?: string;
  status?: string;
  priority?: string;
  location_name?: string;
  location_address?: string;
  location_url?: string;
}

/**
 * Shape of the body accepted by PUT /time_items/:id. All fields optional —
 * only provided keys are updated (backend uses partial update semantics).
 */
export type UpdateTimeItemRequest = Partial<CreateTimeItemRequest>;
```

- [ ] **Step 2: Remplacer les `any` par les nouveaux types**

Lignes 214-216 avant :
```ts
  create: (data: any) => schedulerClient.post<TimeItem>("/time_items", data),
  update: (id: string, data: any) =>
    schedulerClient.put<TimeItem>(`/time_items/${id}`, data),
```
après :
```ts
  create: (data: CreateTimeItemRequest) =>
    schedulerClient.post<TimeItem>("/time_items", data),
  update: (id: string, data: UpdateTimeItemRequest) =>
    schedulerClient.put<TimeItem>(`/time_items/${id}`, data),
```

- [ ] **Step 3: Vérifier tsc**

Run :
```bash
npx tsc --noEmit 2>&1 | grep "scheduler.ts\|time_items" | head -10
```
Expected : aucune ligne d'erreur.

Si des consumers de `timeItemsApi.create` ou `.update` passent des objets qui ne correspondent pas à `CreateTimeItemRequest`/`UpdateTimeItemRequest`, ajouter les champs manquants à l'interface plutôt que de revenir à `any`.

- [ ] **Step 4: Vérifier l'absence de `any` dans le fichier**

Run :
```bash
grep -nE ": any|<any>| as any" client/src/lib/api/scheduler.ts
```
Expected : aucune ligne.

---

## Task 3: `src/lib/api/metrics.ts` — typer les `.then((res: any) => res.data)`

**Files:**
- Modify: `client/src/lib/api/metrics.ts:36-46`

- [ ] **Step 1: Typer les deux callbacks `then`**

Axios `get<T>()` retourne `Promise<AxiosResponse<T>>`. Le callback `.then(res => res.data)` reçoit déjà un `AxiosResponse<T>` typé — aucun besoin d'annoter `res` explicitement. Remplacer les deux appels.

Ligne 36-45 avant :
```ts
export const schedulerMetricsApi = {
  getWorkload: (params?: MetricsQuery) =>
    schedulerClient
      .get<WorkloadMetrics>("/metrics/workload", { params })
      .then((res: any) => res.data),

  getResources: () =>
    schedulerClient
      .get<ResourceMetrics>("/metrics/resources")
      .then((res: any) => res.data),
};
```
après :
```ts
export const schedulerMetricsApi = {
  getWorkload: (params?: MetricsQuery) =>
    schedulerClient
      .get<WorkloadMetrics>("/metrics/workload", { params })
      .then((res) => res.data),

  getResources: () =>
    schedulerClient
      .get<ResourceMetrics>("/metrics/resources")
      .then((res) => res.data),
};
```

- [ ] **Step 2: Vérifier tsc + absence de `any`**

Run :
```bash
npx tsc --noEmit 2>&1 | grep "metrics.ts" | head -5
grep -nE ": any|<any>| as any" client/src/lib/api/metrics.ts
```
Expected : tsc clean ET grep vide.

---

## Task 4: `src/lib/api/containers.ts` — typer networksApi.create + volumesApi.create

**Files:**
- Modify: `client/src/lib/api/containers.ts:472-494`

- [ ] **Step 1: Déclarer les types de payload**

Juste avant `export const networksApi = {` (ligne ~472), ajouter :

```ts
/**
 * Body for POST /networks (Docker network creation).
 * Mirrors Docker Engine API's NetworkCreateRequest with the minimal fields
 * used by the frontend. Additional fields (IPAM, Labels, etc.) can be added
 * as needed.
 */
export interface CreateNetworkRequest {
  Name: string;
  Driver?: string;
  Internal?: boolean;
  Attachable?: boolean;
  Labels?: Record<string, string>;
}

/**
 * Body for POST /volumes (Docker volume creation).
 * Mirrors Docker Engine API's VolumeCreateRequest.
 */
export interface CreateVolumeRequest {
  Name: string;
  Driver?: string;
  DriverOpts?: Record<string, string>;
  Labels?: Record<string, string>;
}
```

- [ ] **Step 2: Remplacer les deux `data: any`**

Ligne 475 avant :
```ts
  create: (data: any) => containersClient.post("/networks", data),
```
après :
```ts
  create: (data: CreateNetworkRequest) =>
    containersClient.post("/networks", data),
```

Ligne 491 avant :
```ts
  create: (data: any) => containersClient.post("/volumes", data),
```
après :
```ts
  create: (data: CreateVolumeRequest) =>
    containersClient.post("/volumes", data),
```

- [ ] **Step 3: Vérifier tsc + absence de `any`**

Run :
```bash
npx tsc --noEmit 2>&1 | grep "containers.ts" | head -10
grep -nE ": any|<any>| as any" client/src/lib/api/containers.ts
```

Si tsc signale des consumers qui passent des objets qui n'ont pas `Name`, ajouter les champs requis. Ne PAS revenir à `any`.

---

## Task 5: `src/lib/api/spreadsheet.ts` — typer le champ `style`

**Files:**
- Modify: `client/src/lib/api/spreadsheet.ts:263-266`

- [ ] **Step 1: Examiner le champ style des consumers pour dériver la shape**

Run :
```bash
grep -rn "\.style" client/src/components/sheets/*.ts client/src/components/sheets/*.tsx | grep -v node_modules | head -20
```

La shape typique d'un style de cellule dans un spreadsheet : font, background, color, alignment, bold, italic.

- [ ] **Step 2: Déclarer `CellStyle` et l'utiliser**

Ligne 263 avant :
```ts
export function convertToApiFormat(
  data: Record<string, { value: string; formula?: string; style?: any }>,
```
après :
```ts
/**
 * Cell style attributes that can be serialized alongside a cell value.
 * All fields optional — a cell with no explicit style uses defaults.
 */
export interface CellStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  backgroundColor?: string;
  fontSize?: number;
  fontFamily?: string;
  alignment?: "left" | "center" | "right";
  verticalAlignment?: "top" | "middle" | "bottom";
  numberFormat?: string;
}

export function convertToApiFormat(
  data: Record<string, { value: string; formula?: string; style?: CellStyle }>,
```

- [ ] **Step 3: Vérifier tsc**

Run :
```bash
npx tsc --noEmit 2>&1 | grep "spreadsheet.ts" | head -10
```
Si les consumers passent des styles avec des champs non listés, ajouter-les à `CellStyle`. Ne PAS revenir à `any`.

- [ ] **Step 4: Vérifier l'absence de `any`**

Run :
```bash
grep -nE ": any|<any>| as any" client/src/lib/api/spreadsheet.ts
```
Expected : vide.

---

## Task 6: `src/lib/api/monitoring.ts` — typer `AlertAction.config`

**Files:**
- Modify: `client/src/lib/api/monitoring.ts:169-172`

- [ ] **Step 1: Typer `config` selon le type d'action**

`AlertAction` a un `type: string` et un `config: any` — c'est un cas de discriminated union potentiel. Si `type` est "email" on a `{ to: string[] }`, si "webhook" on a `{ url: string }`, etc. Pour une version minimale sans casser les consumers, utiliser `Record<string, unknown>` (type-safe, force le narrowing).

Ligne 169-172 avant :
```ts
export interface AlertAction {
  type: string;
  config: any;
}
```
après :
```ts
/**
 * Configuration payload for an alert action. Shape varies by action type
 * (email, webhook, slack, etc.); callers narrow via the `type` field.
 * Use `Record<string, unknown>` rather than `any` so narrowing is required
 * before accessing specific fields.
 */
export type AlertActionConfig = Record<string, unknown>;

export interface AlertAction {
  type: string;
  config: AlertActionConfig;
}
```

- [ ] **Step 2: Vérifier tsc**

Run :
```bash
npx tsc --noEmit 2>&1 | grep "monitoring.ts" | head -10
```
Si des consumers font `action.config.url` sans narrow, TS va exiger un cast. Soit narrow (`(action.config as { url?: string }).url`), soit ajouter `// @ts-expect-error` avec justification, soit étendre le type en discriminated union — NE PAS revenir à `any`.

- [ ] **Step 3: Vérifier l'absence de `any`**

Run :
```bash
grep -nE ": any|<any>| as any" client/src/lib/api/monitoring.ts
```
Expected : vide.

---

## Task 7: `src/lib/api/forms.ts` — typer `FormAnswer.value` en union

**Files:**
- Modify: `client/src/lib/api/forms.ts:90-95`

- [ ] **Step 1: Déclarer `FormFieldValue` en union**

Ligne 90-95 avant :
```ts
export interface FormAnswer {
  field_id: string;
  // Intentionally permissive: form answers can be string, number, string[], File, etc.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any; // noqa
}
```
après :
```ts
/**
 * Possible value types for a form answer. A form field can be:
 * - text/long-text → string
 * - number/rating → number
 * - boolean/checkbox → boolean
 * - multiselect/checkbox-group → string[]
 * - date/datetime → string (ISO 8601)
 * - file → File (browser File object, uploaded separately)
 * - empty/skipped → null
 *
 * If a new field type requires a value shape not listed above, ADD it to
 * this union rather than falling back to `any`.
 */
export type FormFieldValue =
  | string
  | number
  | boolean
  | string[]
  | File
  | null;

export interface FormAnswer {
  field_id: string;
  value: FormFieldValue;
}
```

- [ ] **Step 2: Vérifier tsc**

Run :
```bash
npx tsc --noEmit 2>&1 | grep -E "forms\.ts|FormAnswer" | head -10
```
Si des consumers passent une shape non listée (e.g. `{ lat, lng }` pour un geolocation field), étendre l'union avec un objet structuré (`| { lat: number; lng: number }`) — pas revenir à `any`.

- [ ] **Step 3: Vérifier l'absence de `any`**

Run :
```bash
grep -nE ": any|<any>| as any" client/src/lib/api/forms.ts
```
Expected : vide.

---

## Task 8: `src/lib/api/factory.ts` — typer le retour de `handleAuthError`

**Files:**
- Modify: `client/src/lib/api/factory.ts:620-623`

- [ ] **Step 1: Importer `AxiosResponse` si pas déjà importé**

Vérifier l'import en haut du fichier :
```bash
grep -n "AxiosResponse" client/src/lib/api/factory.ts | head -3
```

Si `AxiosResponse` n'est pas importé, ajouter dans l'import existant d'`axios` :
```ts
import type { AxiosError, AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from "axios";
```

- [ ] **Step 2: Typer le retour**

Ligne 620-623 avant :
```ts
async function handleAuthError(
  error: AxiosError,
  client: AxiosInstance,
): Promise<any> {
```
après :
```ts
async function handleAuthError(
  error: AxiosError,
  client: AxiosInstance,
): Promise<AxiosResponse> {
```

Note : en pratique cette fonction peut rejeter (via `throw` ou `return Promise.reject`). Le type `Promise<AxiosResponse>` est correct parce qu'Axios's error interceptor attend précisément ça : soit la réponse du retry, soit un rejet propagé comme exception.

- [ ] **Step 3: Vérifier tsc**

Run :
```bash
npx tsc --noEmit 2>&1 | grep "factory.ts" | head -10
```

Si tsc signale que le corps de `handleAuthError` retourne autre chose (e.g. `Promise.reject(error)` is typed as `Promise<never>` and compatible), tout est bon. Si la fonction fait `return client.request(originalRequest)` et que request retourne `Promise<AxiosResponse>`, compatible.

- [ ] **Step 4: Vérifier l'absence de `any`**

Run :
```bash
grep -nE ": any|<any>| as any" client/src/lib/api/factory.ts
```
Expected : vide.

---

## Task 9: Commit 1 — lib/api

- [ ] **Step 1: Valider le périmètre global**

Run :
```bash
cd /c/Prog/signapps-platform/client && npx tsc --noEmit 2>&1 | grep -c "error TS"
```
Expected : `0`.

```bash
grep -rnE ": any|<any>| as any" src/lib/api/ 2>&1
```
Expected : aucune ligne.

- [ ] **Step 2: Commit**

```bash
cd /c/Prog/signapps-platform && rtk git add client/src/lib/api/ && rtk git commit -m "refactor(api): replace any with explicit types in lib/api

Typed 8 files in client/src/lib/api/, eliminating all any usages:

- crm.ts: ApiDeal + ApiLead interfaces for backend-raw mappers
- scheduler.ts: CreateTimeItemRequest + UpdateTimeItemRequest payload types
- metrics.ts: dropped explicit \`res: any\` annotations (Axios already types res)
- containers.ts: CreateNetworkRequest + CreateVolumeRequest payload types
- spreadsheet.ts: CellStyle interface for cell style attributes
- monitoring.ts: AlertActionConfig = Record<string, unknown> (narrow-required)
- forms.ts: FormFieldValue = string | number | boolean | string[] | File | null
- factory.ts: handleAuthError returns Promise<AxiosResponse>

No behavior change — only annotations.
Validation: tsc --noEmit 0 errors, grep confirms 0 any remaining in lib/api.

Part of Phase C (docs/superpowers/specs/2026-04-16-phase-c-api-stores-design.md)."
```

---

# COMMIT 2 — stores typing

## Task 10: `src/stores/design-store.ts` — typer ApiDesign et son usage

**Files:**
- Modify: `client/src/stores/design-store.ts:110-130,250-280`

- [ ] **Step 1: Déclarer `ApiDesign` en haut du fichier**

Juste sous les imports et au-dessus de la définition du store, ajouter :

```ts
/**
 * Raw shape returned by signapps-docs for GET /designs and /designs/:id.
 * All fields are optional because the backend progressively rolled out
 * snake_case and some older records still use camelCase.
 */
interface ApiDesign {
  id: string;
  name?: string;
  title?: string;
  format?: {
    width: number;
    height: number;
    label?: string;
    unit?: string;
  };
  pages?: Design["pages"];
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
}
```

- [ ] **Step 2: Typer `loadDesigns`**

Ligne 114-130 avant :
```ts
      loadDesigns: async () => {
        try {
          const res = await docsClient.get<any[]>("/designs");
          const metas: DesignMeta[] = (res.data ?? []).map((d: any) => ({
            id: d.id,
            name: d.name ?? d.title ?? "Untitled",
            format: d.format ?? DESIGN_FORMATS[0],
            createdAt: d.created_at ?? d.createdAt ?? new Date().toISOString(),
            updatedAt: d.updated_at ?? d.updatedAt ?? new Date().toISOString(),
          }));
          if (metas.length > 0) {
            set({ designs: metas });
          }
        } catch {
          // keep local persist state
        }
      },
```
après :
```ts
      loadDesigns: async () => {
        try {
          const res = await docsClient.get<ApiDesign[]>("/designs");
          const metas: DesignMeta[] = (res.data ?? []).map((d) => ({
            id: d.id,
            name: d.name ?? d.title ?? "Untitled",
            format: d.format ?? DESIGN_FORMATS[0],
            createdAt: d.created_at ?? d.createdAt ?? new Date().toISOString(),
            updatedAt: d.updated_at ?? d.updatedAt ?? new Date().toISOString(),
          }));
          if (metas.length > 0) {
            set({ designs: metas });
          }
        } catch {
          // keep local persist state
        }
      },
```

- [ ] **Step 3: Typer `loadDesign`**

Ligne 254-279 avant :
```ts
      loadDesign: async (id) => {
        if (typeof window === "undefined") return;
        // DW1: Try Drive API first, fallback to localStorage
        try {
          const res = await docsClient.get<any>(`/designs/${id}`);
          if (res.data) {
            const design: Design = {
              id: res.data.id,
              name: res.data.name ?? res.data.title ?? "Untitled",
              format: res.data.format ?? {
                ...
```
après :
```ts
      loadDesign: async (id) => {
        if (typeof window === "undefined") return;
        // DW1: Try Drive API first, fallback to localStorage
        try {
          const res = await docsClient.get<ApiDesign>(`/designs/${id}`);
          if (res.data) {
            const design: Design = {
              id: res.data.id,
              name: res.data.name ?? res.data.title ?? "Untitled",
              format: res.data.format ?? {
                ...
```

Le corps de l'`if (res.data)` reste inchangé — `res.data` est maintenant typé `ApiDesign`, et tous les accès (`res.data.name`, `res.data.pages`, etc.) sont typés.

- [ ] **Step 4: Vérifier tsc + absence de `any`**

Run :
```bash
npx tsc --noEmit 2>&1 | grep "design-store.ts" | head -10
grep -nE ": any|<any>| as any" client/src/stores/design-store.ts
```
Expected : tsc clean + grep vide.

---

## Task 11: `src/stores/org-store.ts` — typer allNodes

**Files:**
- Modify: `client/src/stores/org-store.ts:105-143`

- [ ] **Step 1: Déclarer `ApiOrgTreeNode` en haut du fichier**

Juste sous les imports, ajouter :

```ts
/**
 * Raw shape returned by GET /workforce/org/tree — the `res` comes from
 * orgApi.trees.list() which returns the flattened OrgTreeNode[] (backend
 * applies serde(flatten) so all OrgNode fields are directly on the item).
 */
interface ApiOrgTreeNode {
  id: string;
  parent_id: string | null;
  tenant_id?: string;
  node_type: string;
  name: string;
  children?: ApiOrgTreeNode[];
  depth?: number;
  employee_count?: number;
}
```

- [ ] **Step 2: Typer `fetchTrees`**

Ligne 113-134 avant :
```ts
          const raw = res.data ?? [];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const allNodes: any[] = Array.isArray(raw) ? raw : [];
          // GET /workforce/org/tree returns OrgTreeNode[] with serde(flatten),
          // so each item has all OrgNode fields directly (id, parent_id, node_type, name, ...)
          // plus children, depth, employee_count. Root nodes are the top-level items (parent_id = null).
          const roots: OrgTree[] = allNodes
            .filter((n) => !n.parent_id)
            .map((n) => {
              const nodeType = (n.node_type as string) ?? "";
              const treeType: TreeType = nodeType.startsWith("client")
                ? "clients"
                : nodeType.startsWith("supplier")
                  ? "suppliers"
                  : "internal";
              return {
                id: n.id as string,
                tenant_id: (n.tenant_id as string) ?? "",
                tree_type: treeType,
                name: n.name as string,
              };
            });
```
après :
```ts
          const raw = res.data ?? [];
          const allNodes: ApiOrgTreeNode[] = Array.isArray(raw) ? raw : [];
          // GET /workforce/org/tree returns OrgTreeNode[] with serde(flatten),
          // so each item has all OrgNode fields directly (id, parent_id, node_type, name, ...)
          // plus children, depth, employee_count. Root nodes are the top-level items (parent_id = null).
          const roots: OrgTree[] = allNodes
            .filter((n) => !n.parent_id)
            .map((n) => {
              const nodeType = n.node_type ?? "";
              const treeType: TreeType = nodeType.startsWith("client")
                ? "clients"
                : nodeType.startsWith("supplier")
                  ? "suppliers"
                  : "internal";
              return {
                id: n.id,
                tenant_id: n.tenant_id ?? "",
                tree_type: treeType,
                name: n.name,
              };
            });
```

Note : les `as string` casts inline (`n.id as string`, etc.) deviennent inutiles puisque `n` est typé `ApiOrgTreeNode`.

- [ ] **Step 3: Vérifier tsc + absence de `any`**

Run :
```bash
npx tsc --noEmit 2>&1 | grep "org-store.ts" | head -10
grep -nE ": any|<any>| as any" client/src/stores/org-store.ts
```
Expected : tsc clean + grep vide.

---

## Task 12: Commit 2 — stores

- [ ] **Step 1: Valider le périmètre global**

Run :
```bash
cd /c/Prog/signapps-platform/client && npx tsc --noEmit 2>&1 | grep -c "error TS"
grep -rnE ": any|<any>| as any" src/stores/ 2>&1
```
Expected : `0` + aucune ligne.

- [ ] **Step 2: Commit**

```bash
cd /c/Prog/signapps-platform && rtk git add client/src/stores/ && rtk git commit -m "refactor(stores): replace any with explicit types in stores

Typed 2 stores, eliminating all any usages:

- design-store.ts: ApiDesign interface for loadDesigns + loadDesign
- org-store.ts: ApiOrgTreeNode interface for fetchTrees (drops inline
  'as string' casts that were compensating for the any[] array)

No behavior change — only annotations.
Validation: tsc --noEmit 0 errors, grep confirms 0 any remaining in stores.

Part of Phase C (docs/superpowers/specs/2026-04-16-phase-c-api-stores-design.md)."
```

---

# COMMIT 3 — ESLint guardrail

## Task 13: Override ESLint ciblé

**Files:**
- Modify: `client/eslint.config.mjs`

- [ ] **Step 1: Lire la structure actuelle**

Run :
```bash
cat client/eslint.config.mjs
```

Noter la forme exacte de la flat config pour ajouter un objet compatible.

- [ ] **Step 2: Ajouter l'override**

À la fin du tableau exporté par `eslint.config.mjs`, ajouter un dernier objet :

```js
{
  // Phase C — lib/api + stores any elimination
  // These directories are treated as strict: any regression re-introduces
  // a lint ERROR (not warning), blocking the build. The rest of the
  // codebase stays on the global 'warn' level until Phase C-UI is done.
  // See docs/superpowers/specs/2026-04-16-phase-c-api-stores-design.md
  files: ["src/lib/api/**/*.ts", "src/stores/**/*.ts"],
  rules: {
    "@typescript-eslint/no-explicit-any": "error",
  },
},
```

L'objet est ajouté APRÈS toute la configuration existante pour que l'override s'applique en dernier (règle flat config : l'ordre compte).

- [ ] **Step 3: Vérifier que l'override s'applique**

Run :
```bash
cd client && npx eslint src/lib/api src/stores --max-warnings 0 2>&1 | tail -5
```
Expected : `0 problems` (si étape 2 est propre).

Pour vérifier que la règle **bloquerait** une régression, tester en ajoutant temporairement un `any` :
```bash
cd client && echo 'const x: any = 1;' >> src/lib/api/crm.ts
npx eslint src/lib/api/crm.ts --max-warnings 0 2>&1 | tail -5
# Expected: ERROR — Unexpected any
# Cleanup:
git checkout -- src/lib/api/crm.ts
```

- [ ] **Step 4: Vérifier que le reste du codebase n'est pas impacté**

Run :
```bash
cd client && npx eslint src/ 2>&1 | grep -c "error"
```
Expected : `0` (les ~291 `any` restants ailleurs restent en warning, pas error).

```bash
cd client && npx eslint src/ 2>&1 | grep -c "warning"
```
Expected : un count non-nul (~291 warnings, mais pas d'erreurs de build).

- [ ] **Step 5: Commit**

```bash
cd /c/Prog/signapps-platform && rtk git add client/eslint.config.mjs && rtk git commit -m "chore(eslint): enforce no-explicit-any in lib/api + stores

Add a targeted flat-config override that promotes
@typescript-eslint/no-explicit-any to 'error' for:
- src/lib/api/**/*.ts
- src/stores/**/*.ts

Rest of the codebase keeps the global 'warn' level — Phase C-UI will
tackle those ~270 remaining any usages in components (recharts, tiptap,
y.js deps require per-library shapes).

This closes the Phase C scope-restricted pass:
- Commit 1: typed 8 lib/api files (no any)
- Commit 2: typed 2 stores (no any)
- Commit 3: this — anti-regression guardrail

Validation:
- eslint src/lib/api src/stores --max-warnings 0 → 0 problems
- rest of codebase unchanged (warnings stay warnings, no new errors)

Part of Phase C (docs/superpowers/specs/2026-04-16-phase-c-api-stores-design.md)."
```

---

# Post-completion sanity check

## Task 14: Verify end-state

- [ ] **Step 1: Zero `any` in scope**

```bash
cd /c/Prog/signapps-platform/client && grep -rnE ": any|<any>| as any" src/lib/api/ src/stores/ 2>&1
```
Expected : aucune ligne.

- [ ] **Step 2: Typescript clean**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```
Expected : `0`.

- [ ] **Step 3: ESLint strict on scope passes**

```bash
npx eslint src/lib/api src/stores --max-warnings 0 2>&1 | tail -3
```
Expected : `0 problems (0 errors, 0 warnings)` or equivalent.

- [ ] **Step 4: Global lint status unchanged from baseline**

```bash
npx eslint src/ 2>&1 | grep -cE "^\s+[0-9]+:"
```
Expected : count ~291 (±2, same as before Phase C — les warnings n'ont pas diminué globalement, mais les 17 warnings dans le périmètre sont maintenant 0 errors = net -17 ou équivalent).

- [ ] **Step 5: Build still works**

```bash
cd client && npm run build 2>&1 | tail -5
```
Expected : `Compiled successfully` ou équivalent.
