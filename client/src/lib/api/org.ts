/**
 * Org Structure API Module
 *
 * API client for Enterprise Org Structure — trees, nodes, persons, assignments, sites.
 * Uses the Identity service (port 3001).
 */
import { getClient, ServiceName } from './factory';
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
} from '@/types/org';

const client = getClient(ServiceName.IDENTITY);

export const orgApi = {
  // ── Trees ────────────────────────────────────────────────────────────────
  trees: {
    list: () => client.get<OrgTree[]>('/org/trees'),
    create: (data: { tree_type: TreeType; name: string }) =>
      client.post<OrgTree>('/org/trees', data),
    getFull: (id: string) =>
      client.get<{ tree: OrgTree; nodes: OrgNode[] }>(`/org/trees/${id}/full`),
  },

  // ── Nodes ────────────────────────────────────────────────────────────────
  nodes: {
    get: (id: string) => client.get<OrgNode>(`/org/nodes/${id}`),
    create: (data: Partial<OrgNode>) => client.post<OrgNode>('/org/nodes', data),
    update: (id: string, data: Partial<OrgNode>) =>
      client.put<OrgNode>(`/org/nodes/${id}`, data),
    delete: (id: string) => client.delete(`/org/nodes/${id}`),
    move: (id: string, parentId: string) =>
      client.post(`/org/nodes/${id}/move`, { parent_id: parentId }),
    children: (id: string) => client.get<OrgNode[]>(`/org/nodes/${id}/children`),
    descendants: (id: string) => client.get<OrgNode[]>(`/org/nodes/${id}/descendants`),
    ancestors: (id: string) => client.get<OrgNode[]>(`/org/nodes/${id}/ancestors`),
    assignments: (id: string) => client.get<Assignment[]>(`/org/nodes/${id}/assignments`),
    permissions: (id: string) => client.get<PermissionProfile>(`/org/nodes/${id}/permissions`),
    setPermissions: (id: string, data: Partial<PermissionProfile>) =>
      client.put(`/org/nodes/${id}/permissions`, data),
  },

  // ── Persons ──────────────────────────────────────────────────────────────
  persons: {
    list: (params?: {
      role?: string;
      node_id?: string;
      site_id?: string;
      active?: boolean;
    }) => client.get<Person[]>('/persons', { params }),
    create: (data: Partial<Person> & { role_type?: string }) =>
      client.post<Person>('/persons', data),
    update: (id: string, data: Partial<Person>) =>
      client.put<Person>(`/persons/${id}`, data),
    get: (id: string) =>
      client.get<Person & { roles: PersonRole[]; assignments: Assignment[] }>(`/persons/${id}`),
    assignments: (id: string) =>
      client.get<Assignment[]>(`/persons/${id}/assignments`),
    history: (id: string) =>
      client.get<AssignmentHistory[]>(`/persons/${id}/history`),
    linkUser: (id: string, userId: string) =>
      client.post(`/persons/${id}/link-user`, { user_id: userId }),
    unlinkUser: (id: string) => client.post(`/persons/${id}/unlink-user`),
    effectivePermissions: (id: string) =>
      client.get(`/persons/${id}/effective-permissions`),
  },

  // ── Assignments ──────────────────────────────────────────────────────────
  assignments: {
    create: (data: Partial<Assignment>) =>
      client.post<Assignment>('/assignments', data),
    update: (id: string, data: Partial<Assignment>) =>
      client.put<Assignment>(`/assignments/${id}`, data),
    end: (id: string, reason?: string) =>
      client.delete(`/assignments/${id}`, { data: { reason } }),
    history: (params?: Record<string, unknown>) =>
      client.get<AssignmentHistory[]>('/assignments/history', { params }),
  },

  // ── Sites ────────────────────────────────────────────────────────────────
  sites: {
    list: () => client.get<Site[]>('/sites'),
    create: (data: Partial<Site>) => client.post<Site>('/sites', data),
    update: (id: string, data: Partial<Site>) =>
      client.put<Site>(`/sites/${id}`, data),
    get: (id: string) => client.get<Site>(`/sites/${id}`),
    persons: (id: string) => client.get<Person[]>(`/sites/${id}/persons`),
    attachNode: (id: string, nodeId: string) =>
      client.post(`/sites/${id}/attach-node`, { node_id: nodeId }),
    attachPerson: (id: string, personId: string) =>
      client.post(`/sites/${id}/attach-person`, { person_id: personId }),
  },

  // ── Orgchart ─────────────────────────────────────────────────────────────
  orgchart: (params?: { tree_id?: string; date?: string }) =>
    client.get<{ tree: OrgTree; nodes: OrgChartNode[] }>('/org/orgchart', { params }),

  // ── Context ──────────────────────────────────────────────────────────────
  context: () => client.get<OrgContext>('/org/context'),
};
