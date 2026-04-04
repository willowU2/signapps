/**
 * Org Structure API Module
 *
 * API client for Enterprise Org Structure — trees, nodes, persons, assignments, sites.
 * Uses the Identity service (port 3001).
 */
import { getClient, ServiceName } from "./factory";
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
} from "@/types/org";

const client = getClient(ServiceName.WORKFORCE);

export const orgApi = {
  // ── Trees ────────────────────────────────────────────────────────────────
  // A "tree" is a root node (parent_id = null). The backend has no OrgTree entity.
  trees: {
    /** GET /workforce/org/tree returns the full tree hierarchy. We extract root-level nodes as "trees". */
    list: () => client.get<OrgNode[]>("/workforce/org/tree"),
    /** Create a new tree = create a root node with the right node_type and parent_id: null */
    create: (data: { tree_type: TreeType; name: string }) =>
      client.post<OrgNode>("/workforce/org/nodes", {
        name: data.name,
        node_type:
          data.tree_type === "clients"
            ? "client_group"
            : data.tree_type === "suppliers"
              ? "supplier_group"
              : "group",
        parent_id: null,
      }),
    /** Get all descendants of a root node (the full sub-tree) */
    getFull: (id: string) =>
      client.get<OrgNode[]>(`/workforce/org/nodes/${id}/descendants`),
  },

  // ── Nodes ────────────────────────────────────────────────────────────────
  nodes: {
    get: (id: string) => client.get<OrgNode>(`/workforce/org/nodes/${id}`),
    create: (data: Partial<OrgNode>) =>
      client.post<OrgNode>("/workforce/org/nodes", data),
    update: (id: string, data: Partial<OrgNode>) =>
      client.put<OrgNode>(`/workforce/org/nodes/${id}`, data),
    delete: (id: string) => client.delete(`/workforce/org/nodes/${id}`),
    deleteRecursive: (id: string) =>
      client.delete(`/workforce/org/nodes/${id}/recursive`),
    move: (id: string, parentId: string) =>
      client.post(`/workforce/org/nodes/${id}/move`, {
        new_parent_id: parentId,
      }),
    children: (id: string) =>
      client.get<OrgNode[]>(`/workforce/org/nodes/${id}/children`),
    descendants: (id: string) =>
      client.get<OrgNode[]>(`/workforce/org/nodes/${id}/descendants`),
    ancestors: (id: string) =>
      client.get<OrgNode[]>(`/workforce/org/nodes/${id}/ancestors`),
    assignments: (id: string) =>
      client.get<Assignment[]>(`/workforce/org/nodes/${id}/assignments`),
    permissions: (id: string) =>
      client.get<PermissionProfile>(`/workforce/org/nodes/${id}/permissions`),
    setPermissions: (id: string, data: Partial<PermissionProfile>) =>
      client.put(`/workforce/org/nodes/${id}/permissions`, data),
  },

  // ── Persons ──────────────────────────────────────────────────────────────
  persons: {
    list: (params?: {
      role?: string;
      node_id?: string;
      site_id?: string;
      active?: boolean;
    }) => client.get<Person[]>("/workforce/employees", { params }),
    create: (data: Partial<Person> & { role_type?: string }) =>
      client.post<Person>("/workforce/employees", data),
    update: (id: string, data: Partial<Person>) =>
      client.put<Person>(`/workforce/employees/${id}`, data),
    get: (id: string) =>
      client.get<Person & { roles: PersonRole[]; assignments: Assignment[] }>(
        `/workforce/employees/${id}`,
      ),
    assignments: (id: string) =>
      client.get<Assignment[]>(`/workforce/employees/${id}/assignments`),
    history: (id: string) =>
      client.get<AssignmentHistory[]>(`/workforce/employees/${id}/history`),
    linkUser: (id: string, userId: string) =>
      client.post(`/workforce/employees/${id}/link-user`, { user_id: userId }),
    unlinkUser: (id: string) =>
      client.post(`/workforce/employees/${id}/unlink-user`),
    effectivePermissions: (id: string) =>
      client.get(`/workforce/employees/${id}/effective-permissions`),
  },

  // ── Assignments ──────────────────────────────────────────────────────────
  assignments: {
    create: (data: Partial<Assignment>) =>
      client.post<Assignment>("/workforce/assignments", data),
    update: (id: string, data: Partial<Assignment>) =>
      client.put<Assignment>(`/workforce/assignments/${id}`, data),
    end: (id: string, reason?: string) =>
      client.delete(`/workforce/assignments/${id}`, { data: { reason } }),
    history: (params?: Record<string, unknown>) =>
      client.get<AssignmentHistory[]>("/workforce/assignments/history", {
        params,
      }),
  },

  // ── Sites ────────────────────────────────────────────────────────────────
  sites: {
    list: () => client.get<Site[]>("/workforce/sites"),
    create: (data: Partial<Site>) =>
      client.post<Site>("/workforce/sites", data),
    update: (id: string, data: Partial<Site>) =>
      client.put<Site>(`/workforce/sites/${id}`, data),
    get: (id: string) => client.get<Site>(`/workforce/sites/${id}`),
    persons: (id: string) =>
      client.get<Person[]>(`/workforce/sites/${id}/persons`),
    attachNode: (id: string, nodeId: string) =>
      client.post(`/workforce/sites/${id}/attach-node`, { node_id: nodeId }),
    attachPerson: (id: string, personId: string) =>
      client.post(`/workforce/sites/${id}/attach-person`, {
        person_id: personId,
      }),
  },

  // ── Orgchart ─────────────────────────────────────────────────────────────
  orgchart: (params?: { tree_id?: string; date?: string }) =>
    client.get<{ tree: OrgTree; nodes: OrgChartNode[] }>(
      "/workforce/org/orgchart",
      { params },
    ),

  // ── Context ──────────────────────────────────────────────────────────────
  context: () => client.get<OrgContext>("/workforce/org/context"),

  // ── Groups ────────────────────────────────────────────────────────────────
  groups: {
    list: () => client.get<OrgGroup[]>("/workforce/groups"),
    create: (data: Partial<OrgGroup>) =>
      client.post<OrgGroup>("/workforce/groups", data),
    get: (id: string) => client.get<OrgGroup>(`/workforce/groups/${id}`),
    update: (id: string, data: Partial<OrgGroup>) =>
      client.put<OrgGroup>(`/workforce/groups/${id}`, data),
    delete: (id: string) => client.delete(`/workforce/groups/${id}`),
    addMember: (
      groupId: string,
      data: { member_type: string; member_id: string },
    ) =>
      client.post<OrgGroupMember>(`/workforce/groups/${groupId}/members`, data),
    removeMember: (groupId: string, memberId: string) =>
      client.delete(`/workforce/groups/${groupId}/members/${memberId}`),
    effectiveMembers: (groupId: string) =>
      client.get<string[]>(`/workforce/groups/${groupId}/effective-members`),
  },

  // ── Policies ──────────────────────────────────────────────────────────────
  policies: {
    list: (domain?: string) =>
      client.get<OrgPolicy[]>("/workforce/policies", {
        params: domain ? { domain } : undefined,
      }),
    create: (data: Partial<OrgPolicy>) =>
      client.post<OrgPolicy>("/workforce/policies", data),
    get: (id: string) => client.get<OrgPolicy>(`/workforce/policies/${id}`),
    update: (id: string, data: Partial<OrgPolicy>) =>
      client.put<OrgPolicy>(`/workforce/policies/${id}`, data),
    delete: (id: string) => client.delete(`/workforce/policies/${id}`),
    addLink: (policyId: string, data: Partial<OrgPolicyLink>) =>
      client.post<OrgPolicyLink>(`/workforce/policies/${policyId}/links`, data),
    removeLink: (policyId: string, linkId: string) =>
      client.delete(`/workforce/policies/${policyId}/links/${linkId}`),
    resolvePerson: (personId: string) =>
      client.get<EffectivePolicy>(`/workforce/policies/resolve/${personId}`),
    resolveNode: (nodeId: string) =>
      client.get<EffectivePolicy>(`/workforce/policies/resolve/node/${nodeId}`),
  },

  // ── Delegations ───────────────────────────────────────────────────────────
  delegations: {
    list: () => client.get<OrgDelegation[]>("/workforce/delegations"),
    create: (data: Partial<OrgDelegation>) =>
      client.post<OrgDelegation>("/workforce/delegations", data),
    revoke: (id: string) => client.delete(`/workforce/delegations/${id}`),
    my: () => client.get<OrgDelegation[]>("/workforce/delegations/my"),
    granted: () =>
      client.get<OrgDelegation[]>("/workforce/delegations/granted"),
  },

  // ── Audit ─────────────────────────────────────────────────────────────────
  audit: {
    query: (params?: Record<string, unknown>) =>
      client.get<OrgAuditEntry[]>("/workforce/audit", { params }),
    entityHistory: (entityType: string, entityId: string) =>
      client.get<OrgAuditEntry[]>(
        `/workforce/audit/entity/${entityType}/${entityId}`,
      ),
    actorHistory: (actorId: string) =>
      client.get<OrgAuditEntry[]>(`/workforce/audit/actor/${actorId}`),
  },
};
