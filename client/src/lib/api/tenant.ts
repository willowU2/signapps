/**
 * Tenant API Module
 *
 * Migrated to use API Factory pattern.
 * @see factory.ts for client creation details
 */
import { getClient, ServiceName } from './factory';

// Get the identity service client (cached)
const identityClient = getClient(ServiceName.IDENTITY);

// ============================================================================
// Types
// ============================================================================

export interface Tenant {
    id: string;
    name: string;
    slug: string;
    domain?: string;
    logo_url?: string;
    plan: string;
    max_users: number;
    max_resources: number;
    max_workspaces: number;
    is_active: boolean;
    created_at: string;
}

export interface CreateTenantRequest {
    name: string;
    slug: string;
    domain?: string;
    logo_url?: string;
    plan?: string;
}

export interface UpdateTenantRequest {
    name?: string;
    domain?: string;
    logo_url?: string;
    plan?: string;
    max_users?: number;
    max_resources?: number;
    max_workspaces?: number;
    is_active?: boolean;
}

export interface Workspace {
    id: string;
    tenant_id: string;
    name: string;
    description?: string;
    color: string;
    icon?: string;
    is_default: boolean;
    created_at: string;
}

export interface CreateWorkspaceRequest {
    name: string;
    description?: string;
    color?: string;
    icon?: string;
    is_default?: boolean;
}

export interface UpdateWorkspaceRequest {
    name?: string;
    description?: string;
    color?: string;
    icon?: string;
    is_default?: boolean;
}

export interface WorkspaceMember {
    id: string;
    user_id: string;
    username: string;
    email?: string;
    display_name?: string;
    avatar_url?: string;
    role: WorkspaceRole;
    joined_at: string;
}

export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface AddWorkspaceMemberRequest {
    user_id: string;
    role?: WorkspaceRole;
}

export interface UpdateMemberRoleRequest {
    role: WorkspaceRole;
}

// ============================================================================
// Tenant API (Super-Admin only)
// ============================================================================

export const tenantsApi = {
    /** List all tenants (super-admin only) */
    list: (limit?: number, offset?: number) =>
        identityClient.get<Tenant[]>('/tenants', { params: { limit, offset } }),

    /** Get tenant by ID */
    get: (id: string) =>
        identityClient.get<Tenant>(`/tenants/${id}`),

    /** Create a new tenant (super-admin only) */
    create: (data: CreateTenantRequest) =>
        identityClient.post<Tenant>('/tenants', data),

    /** Update a tenant */
    update: (id: string, data: UpdateTenantRequest) =>
        identityClient.put<Tenant>(`/tenants/${id}`, data),

    /** Delete (deactivate) a tenant */
    delete: (id: string) =>
        identityClient.delete(`/tenants/${id}`),
};

// ============================================================================
// Current Tenant API
// ============================================================================

export const tenantApi = {
    /** Get current user's tenant */
    get: () =>
        identityClient.get<Tenant>('/tenant'),
};

// ============================================================================
// Workspace API
// ============================================================================

export const workspacesApi = {
    /** List all workspaces in current tenant */
    list: (limit?: number, offset?: number) =>
        identityClient.get<Workspace[]>('/workspaces', { params: { limit, offset } }),

    /** List workspaces the current user is a member of */
    mine: () =>
        identityClient.get<Workspace[]>('/workspaces/mine'),

    /** Get workspace by ID */
    get: (id: string) =>
        identityClient.get<Workspace>(`/workspaces/${id}`),

    /** Create a new workspace */
    create: (data: CreateWorkspaceRequest) =>
        identityClient.post<Workspace>('/workspaces', data),

    /** Update a workspace */
    update: (id: string, data: UpdateWorkspaceRequest) =>
        identityClient.put<Workspace>(`/workspaces/${id}`, data),

    /** Delete a workspace */
    delete: (id: string) =>
        identityClient.delete(`/workspaces/${id}`),

    // Members
    /** List workspace members */
    listMembers: (workspaceId: string) =>
        identityClient.get<WorkspaceMember[]>(`/workspaces/${workspaceId}/members`),

    /** Add member to workspace */
    addMember: (workspaceId: string, data: AddWorkspaceMemberRequest) =>
        identityClient.post(`/workspaces/${workspaceId}/members`, data),

    /** Update member role */
    updateMemberRole: (workspaceId: string, userId: string, data: UpdateMemberRoleRequest) =>
        identityClient.put(`/workspaces/${workspaceId}/members/${userId}`, data),

    /** Remove member from workspace */
    removeMember: (workspaceId: string, userId: string) =>
        identityClient.delete(`/workspaces/${workspaceId}/members/${userId}`),
};
