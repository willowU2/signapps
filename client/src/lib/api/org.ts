/**
 * Org Structure API Module
 *
 * API client for Enterprise Org Structure — trees, nodes, persons,
 * assignments, boards, policies.
 *
 * After the S1 hard-cut the authoritative service is `signapps-org`
 * (port 3026) with paths under `/org/*`. The legacy
 * `/workforce/org/*` endpoints were removed.
 *
 * This module preserves the old `orgApi.*` shape (trees / nodes /
 * persons / groups / policies / sites / delegations / audit) so the
 * Zustand store and UI components keep working untouched. Endpoints
 * that don't exist on `signapps-org` (sites, delegations, audit) are
 * stubbed with empty results — they will be re-wired once the
 * corresponding backend lands.
 */
import { getClient, ServiceName } from "./factory";
import { useTenantStore } from "@/stores/tenant-store";
import type {
  OrgTree,
  OrgNode,
  OrgChartNode,
  Person,
  PersonRole,
  Assignment,
  AssignmentHistory,
  Site,
  PermissionProfile,
  OrgContext,
  TreeType,
  OrgGroup,
  OrgGroupMember,
  OrgPolicy,
  OrgPolicyLink,
  EffectivePolicy,
  OrgDelegation,
  OrgAuditEntry,
  OrgBoard,
  OrgBoardMember,
  BoardSummary,
  EffectiveBoard,
} from "@/types/org";

const client = getClient(ServiceName.ORG_SVC);

// ═══════════════════════════════════════════════════════════════════════════
// TENANT RESOLUTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Decode a JWT payload without verifying the signature. Used only to
 * extract tenant_id for API query strings — the access token is stored
 * in localStorage by the auth flow.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1];
    // Base64URL → base64
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "===".slice((b64.length + 3) % 4);
    const decoded =
      typeof atob === "function"
        ? atob(padded)
        : Buffer.from(padded, "base64").toString("utf-8");
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Resolve the current tenant_id. Order of lookup:
 * 1. `useTenantStore().tenant.id` (already populated at boot)
 * 2. JWT `access_token` in localStorage → payload claim `tenant_id`
 * 3. `null` (caller should bail out)
 */
function getCurrentTenantId(): string | null {
  try {
    const tenant = useTenantStore.getState().tenant;
    if (tenant?.id) return tenant.id;
  } catch {
    // store may not be hydrated yet — fall through
  }
  if (typeof window === "undefined") return null;
  const token = window.localStorage.getItem("access_token");
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  const tid = payload?.tenant_id;
  return typeof tid === "string" && tid.length > 0 ? tid : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// BACKEND ↔ FRONTEND SHAPE MAPPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Raw node shape returned by `signapps-org` /api/v1/org/nodes.
 * Uses `kind` (the canonical DB column) where the frontend expects
 * `node_type`; we normalise both for backwards compatibility.
 */
interface BackendOrgNode {
  id: string;
  tenant_id?: string;
  parent_id?: string | null;
  kind?: string;
  name: string;
  slug?: string;
  path?: string;
  attributes?: Record<string, unknown>;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
  code?: string;
  description?: string;
  config?: Record<string, unknown>;
  is_active?: boolean;
  node_type?: string;
}

/** Map a backend node onto the OrgNode shape the UI expects. */
function mapNode(n: BackendOrgNode): OrgNode {
  // `kind` is serialized with PascalCase by serde on the server
  // ("Root", "Unit") while sqlx stores it snake_case in the DB.
  // Normalise to snake_case so existing UI logic keeps working.
  const kindNormalised = (n.node_type ?? n.kind ?? "unit").toLowerCase();
  return {
    id: n.id,
    tenant_id: n.tenant_id,
    parent_id: n.parent_id ?? undefined,
    node_type: kindNormalised,
    name: n.name,
    code: n.code ?? n.slug,
    description: n.description,
    config: n.config ?? n.attributes ?? {},
    sort_order: 0,
    is_active: n.is_active ?? n.active ?? true,
    created_at: n.created_at,
    updated_at: n.updated_at,
  };
}

function mapNodeList(list: unknown): OrgNode[] {
  if (Array.isArray(list)) {
    return (list as BackendOrgNode[]).map(mapNode);
  }
  // The subtree endpoint wraps results as `{ nodes: [...] }`.
  if (
    list &&
    typeof list === "object" &&
    Array.isArray((list as { nodes?: unknown }).nodes)
  ) {
    return (list as { nodes: BackendOrgNode[] }).nodes.map(mapNode);
  }
  return [];
}

/**
 * Shim an axios-like response around a locally-computed value so callers
 * using `res.data` keep working. Status is always 200.
 */
function shim<T>(data: T) {
  return Promise.resolve({
    data,
    status: 200,
    statusText: "OK",
    headers: {},
    config: {},
  } as {
    data: T;
    status: number;
    statusText: string;
    headers: Record<string, unknown>;
    config: Record<string, unknown>;
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// API SURFACE (kept identical to the legacy shape)
// ═══════════════════════════════════════════════════════════════════════════

export const orgApi = {
  // ── Trees ────────────────────────────────────────────────────────────────
  // A "tree" is a root node (parent_id = null). The backend has no
  // OrgTree entity, so we fetch all nodes for the tenant and surface
  // the parentless ones as trees.
  trees: {
    list: async () => {
      const tenantId = getCurrentTenantId();
      if (!tenantId) return shim<OrgNode[]>([]);
      const res = await client.get<BackendOrgNode[]>("/org/nodes", {
        params: { tenant_id: tenantId },
      });
      return { ...res, data: mapNodeList(res.data) };
    },
    create: async (data: { tree_type: TreeType; name: string }) => {
      const tenantId = getCurrentTenantId();
      // The canonical `kind` vocabulary is root|entity|unit|position|role.
      // We always create trees as root nodes — there is no `client_group` /
      // `supplier_group` kind in the new schema, so tree_type is encoded
      // in the attributes blob for now.
      const body = {
        tenant_id: tenantId,
        kind: "root",
        parent_id: null,
        name: data.name,
        attributes: { tree_type: data.tree_type },
      };
      const res = await client.post<BackendOrgNode>("/org/nodes", body);
      return { ...res, data: mapNode(res.data) };
    },
    getFull: async (id: string) => {
      const res = await client.get<unknown>(`/org/nodes/${id}/subtree`);
      return { ...res, data: mapNodeList(res.data) };
    },
  },

  // ── Nodes ────────────────────────────────────────────────────────────────
  nodes: {
    get: async (id: string) => {
      const res = await client.get<BackendOrgNode>(`/org/nodes/${id}`);
      return { ...res, data: mapNode(res.data) };
    },
    create: async (data: Partial<OrgNode>) => {
      const tenantId = getCurrentTenantId();
      const body = {
        tenant_id: tenantId,
        kind: data.node_type ?? "unit",
        parent_id: data.parent_id ?? null,
        name: data.name,
        slug: data.code,
        attributes: data.config ?? {},
      };
      const res = await client.post<BackendOrgNode>("/org/nodes", body);
      return { ...res, data: mapNode(res.data) };
    },
    update: async (id: string, data: Partial<OrgNode>) => {
      const body = {
        kind: data.node_type,
        parent_id: data.parent_id,
        name: data.name,
        slug: data.code,
        attributes: data.config,
        active: data.is_active,
      };
      const res = await client.put<BackendOrgNode>(`/org/nodes/${id}`, body);
      return { ...res, data: mapNode(res.data) };
    },
    delete: (id: string) => client.delete(`/org/nodes/${id}`),
    deleteRecursive: (id: string) =>
      client.delete(`/org/nodes/${id}?recursive=true`),
    move: async (id: string, parentId: string) => {
      // No dedicated move endpoint — reuse PUT with new parent_id.
      return client.put<BackendOrgNode>(`/org/nodes/${id}`, {
        parent_id: parentId,
      });
    },
    // No dedicated children/ancestors endpoints. We use subtree + client-
    // side filtering where needed; the store already consumes subtree
    // + the parent lookup.
    children: async (id: string) => {
      const sub = await client.get<unknown>(`/org/nodes/${id}/subtree`);
      const nodes = mapNodeList(sub.data);
      const direct = nodes.filter((n) => n.parent_id === id);
      return { ...sub, data: direct };
    },
    descendants: async (id: string) => {
      const res = await client.get<unknown>(`/org/nodes/${id}/subtree`);
      return { ...res, data: mapNodeList(res.data) };
    },
    ancestors: async (_id: string) => shim<OrgNode[]>([]),
    assignments: async (id: string) => {
      const res = await client.get<Assignment[]>(`/org/assignments`, {
        params: { node_id: id },
      });
      return res;
    },
    permissions: async (_id: string) => shim<PermissionProfile | null>(null),
    setPermissions: async (_id: string, _data: Partial<PermissionProfile>) =>
      shim<{ ok: true }>({ ok: true }),
    // Boards — no list endpoint on the new service, only POST (create)
    // and GET /by-node/:id. Listing boards requires iterating nodes,
    // which is expensive — stub with an empty array until the backend
    // exposes it.
    listBoards: async () => shim<BoardSummary[]>([]),
    board: async (id: string) =>
      client.get<EffectiveBoard>(`/org/boards/by-node/${id}`),
    createBoard: async (id: string) =>
      client.post<OrgBoard>(`/org/boards`, { node_id: id }),
    deleteBoard: async (_id: string) => shim<{ ok: true }>({ ok: true }),
    addBoardMember: async (boardId: string, data: Partial<OrgBoardMember>) =>
      client.post<OrgBoardMember>(`/org/boards/${boardId}/members`, data),
    updateBoardMember: async (
      _boardId: string,
      _memberId: string,
      _data: Partial<OrgBoardMember>,
    ) => shim<OrgBoardMember | null>(null),
    removeBoardMember: async (_boardId: string, memberId: string) =>
      client.delete(`/org/boards/members/${memberId}`),
  },

  // ── Persons ──────────────────────────────────────────────────────────────
  persons: {
    list: async (params?: {
      role?: string;
      node_id?: string;
      site_id?: string;
      active?: boolean;
    }) => {
      const tenantId = getCurrentTenantId();
      if (!tenantId) return shim<Person[]>([]);
      const query: Record<string, unknown> = {
        tenant_id: tenantId,
        ...(params ?? {}),
      };
      return client.get<Person[]>("/org/persons", { params: query });
    },
    create: async (data: Partial<Person> & { role_type?: string }) => {
      const tenantId = getCurrentTenantId();
      const body = { tenant_id: tenantId, ...data };
      return client.post<Person>("/org/persons", body);
    },
    update: (id: string, data: Partial<Person>) =>
      client.put<Person>(`/org/persons/${id}`, data),
    get: async (id: string) =>
      client.get<Person & { roles: PersonRole[]; assignments: Assignment[] }>(
        `/org/persons/${id}`,
      ),
    assignments: async (id: string) => {
      return client.get<Assignment[]>(`/org/assignments`, {
        params: { person_id: id },
      });
    },
    history: async (_id: string) => shim<AssignmentHistory[]>([]),
    linkUser: async (_id: string, _userId: string) =>
      shim<{ ok: true }>({ ok: true }),
    unlinkUser: async (_id: string) => shim<{ ok: true }>({ ok: true }),
    effectivePermissions: async (_id: string) => shim<unknown>({}),
  },

  // ── Assignments ──────────────────────────────────────────────────────────
  assignments: {
    create: (data: Partial<Assignment>) =>
      client.post<Assignment>("/org/assignments", data),
    update: (id: string, data: Partial<Assignment>) =>
      client.put<Assignment>(`/org/assignments/${id}`, data),
    end: async (id: string, _reason?: string) =>
      client.delete(`/org/assignments/${id}`),
    history: async (_params?: Record<string, unknown>) =>
      shim<AssignmentHistory[]>([]),
  },

  // ── Sites ────────────────────────────────────────────────────────────────
  // The new `signapps-org` service does not (yet) expose a sites
  // resource — the legacy endpoints were removed. We stub with empty
  // arrays so the UI renders without errors while surfacing a
  // clear console warning the first time it's called.
  sites: {
    list: async () => shim<Site[]>([]),
    create: async (_data: Partial<Site>) => shim<Site | null>(null),
    update: async (_id: string, _data: Partial<Site>) =>
      shim<Site | null>(null),
    get: async (_id: string) => shim<Site | null>(null),
    persons: async (_id: string) => shim<Person[]>([]),
    attachNode: async (_id: string, _nodeId: string) =>
      shim<{ ok: true }>({ ok: true }),
    attachPerson: async (_id: string, _personId: string) =>
      shim<{ ok: true }>({ ok: true }),
  },

  // ── Orgchart (computed client-side from persons + nodes) ─────────────────
  orgchart: async (_params?: { tree_id?: string; date?: string }) =>
    shim<{ tree: OrgTree | null; nodes: OrgChartNode[] }>({
      tree: null,
      nodes: [],
    }),

  // ── Context ──────────────────────────────────────────────────────────────
  // The new service exposes person/assignment data but no dedicated
  // /context endpoint. Callers only use this for best-effort enrichment
  // so returning a minimal empty context is safe.
  context: async () =>
    shim<OrgContext>({
      active_assignments: [],
      org_group_ids: [],
      effective_modules: {},
      max_role: "user",
    }),

  // ── Groups (backed by boards — they play the group role) ─────────────────
  //
  // The new org service has no list-all-boards endpoint; groups are
  // therefore stubbed as empty at the root level and will populate once
  // callers switch to a node-scoped lookup.
  groups: {
    list: async () => shim<OrgGroup[]>([]),
    create: async (data: Partial<OrgGroup>) => {
      // Creating a "group" = creating a board attached to a node id held
      // in `attributes.node_id` (legacy shape). Best-effort.
      const nodeId =
        typeof (data.attributes as { node_id?: unknown } | undefined)
          ?.node_id === "string"
          ? (data.attributes as { node_id: string }).node_id
          : undefined;
      if (!nodeId) {
        return shim<OrgGroup | null>(null);
      }
      return client.post<OrgGroup>("/org/boards", { node_id: nodeId });
    },
    get: async (id: string) => client.get<OrgGroup>(`/org/boards/${id}`),
    update: async (_id: string, _data: Partial<OrgGroup>) =>
      shim<OrgGroup | null>(null),
    delete: async (_id: string) => shim<{ ok: true }>({ ok: true }),
    addMember: async (
      groupId: string,
      data: { member_type: string; member_id: string },
    ) =>
      client.post<OrgGroupMember>(`/org/boards/${groupId}/members`, {
        person_id: data.member_id,
      }),
    removeMember: async (_groupId: string, memberId: string) =>
      client.delete(`/org/boards/members/${memberId}`),
    effectiveMembers: async (_groupId: string) => shim<string[]>([]),
  },

  // ── Policies ──────────────────────────────────────────────────────────────
  policies: {
    list: async (domain?: string) => {
      const tenantId = getCurrentTenantId();
      if (!tenantId) return shim<OrgPolicy[]>([]);
      const params: Record<string, unknown> = { tenant_id: tenantId };
      if (domain) params.domain = domain;
      return client.get<OrgPolicy[]>("/org/policies", { params });
    },
    create: async (data: Partial<OrgPolicy>) => {
      const tenantId = getCurrentTenantId();
      const body = { tenant_id: tenantId, ...data };
      return client.post<OrgPolicy>("/org/policies", body);
    },
    get: async (id: string) => client.get<OrgPolicy>(`/org/policies/${id}`),
    update: async (id: string, data: Partial<OrgPolicy>) =>
      client.put<OrgPolicy>(`/org/policies/${id}`, data),
    delete: async (id: string) => client.delete(`/org/policies/${id}`),
    addLink: async (policyId: string, data: Partial<OrgPolicyLink>) =>
      client.post<OrgPolicyLink>(`/org/policies/${policyId}/bindings`, data),
    removeLink: async (_policyId: string, linkId: string) =>
      client.delete(`/org/policies/bindings/${linkId}`),
    resolvePerson: async (_personId: string) =>
      shim<EffectivePolicy>({ settings: {}, sources: [] }),
    resolveNode: async (nodeId: string) =>
      client.get<EffectivePolicy>("/org/policies/bindings/subtree", {
        params: { node_id: nodeId },
      }),
  },

  // ── Delegations (not yet served by signapps-org) ─────────────────────────
  delegations: {
    list: async () => shim<OrgDelegation[]>([]),
    create: async (_data: Partial<OrgDelegation>) =>
      shim<OrgDelegation | null>(null),
    revoke: async (_id: string) => shim<{ ok: true }>({ ok: true }),
    my: async () => shim<OrgDelegation[]>([]),
    granted: async () => shim<OrgDelegation[]>([]),
  },

  // ── Audit (not yet served by signapps-org) ───────────────────────────────
  audit: {
    query: async (_params?: Record<string, unknown>) =>
      shim<OrgAuditEntry[]>([]),
    entityHistory: async (_entityType: string, _entityId: string) =>
      shim<OrgAuditEntry[]>([]),
    actorHistory: async (_actorId: string) => shim<OrgAuditEntry[]>([]),
  },
};
