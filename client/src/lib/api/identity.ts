import { identityApiClient } from './core';

// Auth API
export const authApi = {
    login: (credentials: LoginRequest) =>
        identityApiClient.post<LoginResponse>('/auth/login', credentials),
    refresh: (refreshToken: string) =>
        identityApiClient.post<RefreshResponse>('/auth/refresh', {
            refresh_token: refreshToken,
        }),
    logout: () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('auth-storage');
        document.cookie = 'auth-storage=; path=/; max-age=0';
        window.location.href = '/login';
        return Promise.resolve();
    },
    me: () => identityApiClient.get<User>('/auth/me'),
    mfaVerify: (sessionToken: string, code: string) =>
        identityApiClient.post<LoginResponse>('/auth/mfa/verify', {
            session_token: sessionToken,
            code,
        }),
    ldapLogin: (username: string, password: string, rememberMe?: boolean) =>
        identityApiClient.post<LoginResponse>('/auth/ldap/login', {
            username,
            password,
            remember_me: rememberMe,
        }),
    getLdapConfig: () => identityApiClient.get<LdapConfig>('/auth/ldap/config'),
    updateLdapConfig: (config: LdapConfig) =>
        identityApiClient.put<LdapConfig>('/auth/ldap/config', config),
    testLdapConnection: (config: LdapConfig) =>
        identityApiClient.post('/auth/ldap/test', config),
    syncLdap: () => identityApiClient.post('/auth/ldap/sync'),
    // MFA
    mfaSetup: () => identityApiClient.post<{ secret: string; qr_code_url: string; backup_codes: string[] }>('/auth/mfa/setup'),
    // Aliases used by settings page
    ldapGetConfig: () => identityApiClient.get<LdapConfig>('/auth/ldap/config'),
    ldapUpdateConfig: (config: LdapConfig) =>
        identityApiClient.put<LdapConfig>('/auth/ldap/config', config),
    ldapTestConnection: (config?: LdapConfig) =>
        identityApiClient.post<{ success: boolean; message?: string }>('/auth/ldap/test', config),
};

export interface LoginRequest {
    username: string;
    password?: string;
    remember_me?: boolean;
}

export interface LoginResponse {
    access_token: string;
    refresh_token: string;
    user: User;
    mfa_required?: boolean;
    mfa_session_token?: string;
}

export interface RefreshResponse {
    access_token: string;
    refresh_token: string;
}

// Aligned with Rust UserResponse from signapps-identity
export interface User {
    id: string;
    username: string;
    email?: string;
    display_name?: string;
    role: number; // i16 in Rust: 0=guest, 1=user, 2=admin
    mfa_enabled: boolean;
    auth_provider: string; // 'local' | 'ldap'
    created_at: string;
    last_login?: string;
    // Frontend-only computed fields
    avatar_url?: string;
}

// Helper to check if user is admin (role >= 2)
export function isAdmin(user: User): boolean {
    return user.role >= 2;
}

// Helper to check if user is LDAP user
export function isLdap(user: User): boolean {
    return user.auth_provider === 'ldap';
}

export interface LdapConfig {
    enabled: boolean;
    url: string;
    server_url?: string;
    bind_dn: string;
    bind_password?: string;
    base_dn: string;
    user_filter: string;
    group_filter: string;
    email_attribute: string;
    display_name_attribute: string;
    sync_interval_seconds: number;
}

// Users API
export const usersApi = {
    list: (page?: number, limit?: number) =>
        identityApiClient.get<UserListResponse>('/users', { params: { page, limit } }),
    get: (id: string) => identityApiClient.get<User>(`/users/${id}`),
    create: (data: CreateUserRequest) => identityApiClient.post<User>('/users', data),
    update: (id: string, data: Partial<CreateUserRequest>) =>
        identityApiClient.put<User>(`/users/${id}`, data),
    delete: (id: string) => identityApiClient.delete(`/users/${id}`),
};

export interface UserListResponse {
    users: User[];
    total: number;
    page: number;
    limit: number;
}

export interface CreateUserRequest {
    username: string;
    email: string;
    password: string;
    display_name?: string;
    role?: number;
}

// Groups API
export const groupsApi = {
    list: () => identityApiClient.get<Group[]>('/groups'),
    get: (id: string) => identityApiClient.get<Group>(`/groups/${id}`),
    create: (data: CreateGroupRequest) => identityApiClient.post<Group>('/groups', data),
    update: (id: string, data: Partial<CreateGroupRequest>) =>
        identityApiClient.put<Group>(`/groups/${id}`, data),
    delete: (id: string) => identityApiClient.delete(`/groups/${id}`),
    // Members
    addMembers: (id: string, userIds: string[]) =>
        identityApiClient.post(`/groups/${id}/members`, { user_ids: userIds }),
    removeMember: (id: string, userId: string) =>
        identityApiClient.delete(`/groups/${id}/members/${userId}`),
    // Permissions
    getPermissions: (id: string) =>
        identityApiClient.get<GroupPermissions>(`/groups/${id}/permissions`),
    updatePermissions: (id: string, permissions: GroupPermissions) =>
        identityApiClient.put(`/groups/${id}/permissions`, permissions),
};

export interface Group {
    id: string;
    name: string;
    description?: string;
    parent_id?: string;
    ldap_dn?: string;
    member_count: number;
    created_at: string;
    updated_at: string;
}

export interface GroupPermissions {
    containers?: string[];  // ['read', 'write', 'delete']
    storage?: string[];
    routes?: string[];
    users?: string[];
    settings?: string[];
}

export interface CreateGroupRequest {
    name: string;
    description?: string;
    parent_id?: string;
}

// Audit Logs API
export const auditApi = {
    list: (filters?: AuditLogFilters) =>
        identityApiClient.get<AuditLogListResponse>('/audit-logs', { params: filters }),
    get: (id: string) => identityApiClient.get<AuditLog>(`/audit-logs/${id}`),
    getByUser: (userId: string, limit?: number, offset?: number) =>
        identityApiClient.get<AuditLogListResponse>(`/audit-logs/user/${userId}`, {
            params: { limit, offset },
        }),
    export: (filters?: AuditLogFilters) =>
        identityApiClient.get('/audit-logs/export', {
            params: filters,
            responseType: 'blob',
        }),
};

export interface AuditLog {
    id: string;
    user_id: string;
    username: string;
    action: AuditAction;
    resource_type: string;
    resource_id?: string;
    ip_address: string;
    user_agent?: string;
    details?: Record<string, unknown>;
    status: 'success' | 'failure';
    created_at: string;
}

export type AuditAction =
    | 'login'
    | 'logout'
    | 'login_failed'
    | 'mfa_enabled'
    | 'mfa_disabled'
    | 'password_changed'
    | 'password_reset'
    | 'user_created'
    | 'user_updated'
    | 'user_deleted'
    | 'role_changed'
    | 'group_created'
    | 'group_updated'
    | 'group_deleted'
    | 'member_added'
    | 'member_removed'
    | 'permission_changed'
    | 'api_key_created'
    | 'api_key_revoked';

export interface AuditLogFilters {
    user_id?: string;
    username?: string;
    action?: AuditAction;
    resource_type?: string;
    status?: 'success' | 'failure';
    start_date?: string;
    end_date?: string;
    limit?: number;
    offset?: number;
}

export interface AuditLogListResponse {
    logs: AuditLog[];
    total: number;
    limit: number;
    offset: number;
}

// Users Import/Export
export interface UserImportRow {
    username: string;
    email: string;
    role: string;
    display_name?: string;
    mfa_enabled?: string;
}

export interface UserImportResult {
    success: number;
    failed: number;
    duplicates: number;
    errors: { row: number; username: string; error: string }[];
}
