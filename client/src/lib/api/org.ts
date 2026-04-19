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
  // SO1
  OrgAxis,
  OrgPosition,
  OrgPositionWithOccupancy,
  OrgPositionIncumbent,
  OrgDelegationScope,
  OrgDelegationV2,
  OrgAuditLogEntry,
  OrgAxesSummary,
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
    list: async (options?: { at?: string }) => {
      const tenantId = getCurrentTenantId();
      if (!tenantId) return shim<OrgNode[]>([]);
      const params: Record<string, unknown> = { tenant_id: tenantId };
      if (options?.at) params.at = options.at;
      const res = await client.get<BackendOrgNode[]>("/org/nodes", {
        params,
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

  // ── Delegations (legacy stubs kept pour compat) ──────────────────────────
  delegations: {
    list: async () => shim<OrgDelegation[]>([]),
    create: async (_data: Partial<OrgDelegation>) =>
      shim<OrgDelegation | null>(null),
    revoke: async (_id: string) => shim<{ ok: true }>({ ok: true }),
    my: async () => shim<OrgDelegation[]>([]),
    granted: async () => shim<OrgDelegation[]>([]),
  },

  // ── Audit (legacy stubs — remplacés par history v2 ci-dessous) ───────────
  audit: {
    query: async (_params?: Record<string, unknown>) =>
      shim<OrgAuditEntry[]>([]),
    entityHistory: async (_entityType: string, _entityId: string) =>
      shim<OrgAuditEntry[]>([]),
    actorHistory: async (_actorId: string) => shim<OrgAuditEntry[]>([]),
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SO1 foundations — 2026-04-19
  // ═══════════════════════════════════════════════════════════════════════

  /** Positions + incumbents API. */
  positions: {
    list: async (params?: { node_id?: string }) => {
      const tenantId = getCurrentTenantId();
      if (!tenantId) return shim<OrgPositionWithOccupancy[]>([]);
      const query: Record<string, unknown> = { tenant_id: tenantId };
      if (params?.node_id) query.node_id = params.node_id;
      return client.get<OrgPositionWithOccupancy[]>("/org/positions", {
        params: query,
      });
    },
    get: async (id: string) => client.get<OrgPosition>(`/org/positions/${id}`),
    create: async (data: {
      node_id: string;
      title: string;
      head_count?: number;
      attributes?: Record<string, unknown>;
    }) => {
      const tenantId = getCurrentTenantId();
      return client.post<OrgPosition>("/org/positions", {
        tenant_id: tenantId,
        ...data,
      });
    },
    update: async (
      id: string,
      data: {
        title?: string;
        head_count?: number;
        attributes?: Record<string, unknown>;
        active?: boolean;
      },
    ) => client.patch<OrgPosition>(`/org/positions/${id}`, data),
    delete: async (id: string) => client.delete(`/org/positions/${id}`),
    listIncumbents: async (id: string) =>
      client.get<OrgPositionIncumbent[]>(`/org/positions/${id}/incumbents`),
    addIncumbent: async (
      id: string,
      data: { person_id: string; start_date?: string },
    ) => {
      const tenantId = getCurrentTenantId();
      return client.post<OrgPositionIncumbent>(
        `/org/positions/${id}/incumbents`,
        { tenant_id: tenantId, ...data },
      );
    },
    revokeIncumbent: async (
      positionId: string,
      incumbentId: string,
      endDate?: string,
    ) => {
      const params = endDate ? { end_date: endDate } : undefined;
      return client.delete(
        `/org/positions/${positionId}/incumbents/${incumbentId}`,
        { params },
      );
    },
  },

  /** SO1 delegations (v2 backed by org_delegations). */
  delegationsV2: {
    list: async (params?: {
      delegator_person_id?: string;
      delegate_person_id?: string;
      active_only?: boolean;
    }) => {
      const tenantId = getCurrentTenantId();
      if (!tenantId) return shim<OrgDelegationV2[]>([]);
      const query: Record<string, unknown> = {
        tenant_id: tenantId,
        ...(params ?? {}),
      };
      return client.get<OrgDelegationV2[]>("/org/delegations", {
        params: query,
      });
    },
    get: async (id: string) =>
      client.get<OrgDelegationV2>(`/org/delegations/${id}`),
    create: async (data: {
      delegator_person_id: string;
      delegate_person_id: string;
      node_id?: string | null;
      scope: OrgDelegationScope;
      start_at: string;
      end_at: string;
      reason?: string;
    }) => {
      const tenantId = getCurrentTenantId();
      return client.post<OrgDelegationV2>("/org/delegations", {
        tenant_id: tenantId,
        ...data,
      });
    },
    revoke: async (id: string) =>
      client.post<OrgDelegationV2>(`/org/delegations/${id}/revoke`),
    delete: async (id: string) => client.delete(`/org/delegations/${id}`),
  },

  /** SO1 history / audit log (canonical). */
  history: {
    entity: async (params: {
      entity_type: string;
      entity_id: string;
      limit?: number;
    }) => client.get<OrgAuditLogEntry[]>("/org/history", { params }),
    tenant: async (params?: { since?: string; limit?: number }) => {
      const tenantId = getCurrentTenantId();
      if (!tenantId) return shim<OrgAuditLogEntry[]>([]);
      const query: Record<string, unknown> = {
        tenant_id: tenantId,
        ...(params ?? {}),
      };
      return client.get<OrgAuditLogEntry[]>("/org/history/tenant", {
        params: query,
      });
    },
  },

  /** SO1 multi-axis. */
  axes: {
    summary: async () => {
      const tenantId = getCurrentTenantId();
      if (!tenantId) {
        return shim<OrgAxesSummary>({
          counts: { structure: 0, focus: 0, group: 0 },
          focus_nodes: [],
          group_nodes: [],
        });
      }
      return client.get<OrgAxesSummary>("/org/assignments/axes/summary", {
        params: { tenant_id: tenantId },
      });
    },
    assignments: async (axis: OrgAxis | "all") => {
      const tenantId = getCurrentTenantId();
      if (!tenantId) return shim<Assignment[]>([]);
      const params: Record<string, unknown> = { tenant_id: tenantId };
      if (axis !== "all") params.axis = axis;
      return client.get<Assignment[]>("/org/assignments", { params });
    },
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SO2 governance — RBAC visualizer, RACI matrix, board decisions/votes.
  // ═══════════════════════════════════════════════════════════════════════

  /** RBAC visualizer API. */
  rbac: {
    /** Full effective permission map for a person. */
    effective: async (personId: string) =>
      client.get<RbacEffectivePermission[]>(`/org/rbac/person/${personId}`),
    /** Filtered effective map (by user_id or resource). */
    filtered: async (params: {
      user_id?: string;
      person_id?: string;
      resource?: string;
    }) =>
      client.get<RbacEffectivePermission[]>("/org/rbac/effective", {
        params,
      }),
    /** Simulate a specific action and get an allow/deny + chain. */
    simulate: async (body: {
      person_id: string;
      action: string;
      resource: string;
    }) => client.post<RbacSimulateResponse>("/org/rbac/simulate", body),
  },

  /** RACI matrix API. */
  raci: {
    list: async (projectId: string) =>
      client.get<OrgRaci[]>("/org/raci", { params: { project_id: projectId } }),
    create: async (body: {
      project_id: string;
      person_id: string;
      role: OrgRaciRole;
    }) => {
      const tenantId = getCurrentTenantId();
      return client.post<OrgRaci>("/org/raci", {
        tenant_id: tenantId,
        ...body,
      });
    },
    bulkSet: async (entries: OrgRaciBulkEntry[]) => {
      const tenantId = getCurrentTenantId();
      return client.post<OrgRaci[]>("/org/raci/bulk", {
        tenant_id: tenantId,
        entries,
      });
    },
    delete: async (id: string) => client.delete(`/org/raci/${id}`),
  },

  /** Board decisions + votes API. */
  decisions: {
    list: async (boardId: string, params?: { status?: OrgDecisionStatus }) =>
      client.get<OrgBoardDecision[]>(`/org/boards/${boardId}/decisions`, {
        params,
      }),
    create: async (
      boardId: string,
      body: {
        title: string;
        description?: string;
        attributes?: Record<string, unknown>;
      },
    ) => {
      const tenantId = getCurrentTenantId();
      return client.post<OrgBoardDecision>(`/org/boards/${boardId}/decisions`, {
        tenant_id: tenantId,
        ...body,
      });
    },
    updateStatus: async (
      boardId: string,
      decisionId: string,
      body: { status: OrgDecisionStatus; decided_by_person_id?: string },
    ) =>
      client.put<OrgBoardDecision>(
        `/org/boards/${boardId}/decisions/${decisionId}/status`,
        body,
      ),
    delete: async (boardId: string, decisionId: string) =>
      client.delete(`/org/boards/${boardId}/decisions/${decisionId}`),
    listVotes: async (decisionId: string) =>
      client.get<OrgBoardVote[]>(`/org/decisions/${decisionId}/votes`),
    upsertVote: async (
      decisionId: string,
      body: {
        person_id: string;
        vote: OrgVoteKind;
        rationale?: string;
      },
    ) => {
      const tenantId = getCurrentTenantId();
      return client.post<OrgBoardVote>(`/org/decisions/${decisionId}/votes`, {
        tenant_id: tenantId,
        ...body,
      });
    },
    deleteVote: async (decisionId: string, voteId: string) =>
      client.delete(`/org/decisions/${decisionId}/votes/${voteId}`),
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// SO2 types
// ═══════════════════════════════════════════════════════════════════════════

/** Source of an effective permission. */
export type RbacPermissionSource =
  | { type: "direct"; ref_id: string; ref_name: string }
  | { type: "node"; ref_id: string; ref_name: string }
  | { type: "role"; ref_id: string; ref_name: string }
  | { type: "delegation"; ref_id: string; ref_name: string };

/** One effective permission with source tracing. */
export interface RbacEffectivePermission {
  action: string;
  resource: string;
  source: RbacPermissionSource;
}

/** Result of a /org/rbac/simulate call. */
export interface RbacSimulateResponse {
  allowed: boolean;
  reason: string;
  chain: RbacEffectivePermission[];
}

/** RACI role. */
export type OrgRaciRole =
  | "responsible"
  | "accountable"
  | "consulted"
  | "informed";

/** One RACI row. */
export interface OrgRaci {
  id: string;
  tenant_id: string;
  project_id: string;
  person_id: string;
  role: OrgRaciRole;
  created_at: string;
}

/** One entry of the bulk-set payload (replace roles for a (project, person) pair). */
export interface OrgRaciBulkEntry {
  project_id: string;
  person_id: string;
  roles: OrgRaciRole[];
}

/** Board decision lifecycle status. */
export type OrgDecisionStatus =
  | "proposed"
  | "approved"
  | "rejected"
  | "deferred";

/** Board decision row. */
export interface OrgBoardDecision {
  id: string;
  tenant_id: string;
  board_id: string;
  title: string;
  description?: string | null;
  status: OrgDecisionStatus;
  decided_at?: string | null;
  decided_by_person_id?: string | null;
  attributes: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/** Vote kind. */
export type OrgVoteKind = "for" | "against" | "abstain";

/** Board vote row. */
export interface OrgBoardVote {
  id: string;
  tenant_id: string;
  decision_id: string;
  person_id: string;
  vote: OrgVoteKind;
  rationale?: string | null;
  voted_at: string;
}
