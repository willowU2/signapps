/**
 * Identity API Module
 *
 * Migrated to use API Factory pattern.
 * @see factory.ts for client creation details
 */
import { getClient, ServiceName } from "./factory";

// Get the identity service client (cached)
const identityClient = getClient(ServiceName.IDENTITY);

// Auth API
export const authApi = {
  login: (credentials: LoginRequest) =>
    identityClient.post<LoginResponse>("/auth/login", credentials),
  register: (userData: Record<string, unknown>) =>
    identityClient.post("/auth/register", userData),
  logout: () => {
    return identityClient.post("/auth/logout").finally(() => {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("auth-storage");
      document.cookie = "auth-storage=; path=/; max-age=0";
      window.location.href = "/login";
    });
  },
  me: () => identityClient.get<User>("/auth/me"),
  mfaVerify: (sessionToken: string, code: string) =>
    identityClient.post<LoginResponse>("/auth/mfa/verify", {
      session_token: sessionToken,
      code,
    }),
  mfaDisable: (data?: { password?: string; code?: string }) =>
    identityClient.post("/auth/mfa/disable", data),
  mfaStatus: () => identityClient.get("/auth/mfa/status"),
  // LDAP Configuration

  getLdapConfig: () => identityClient.get<LdapConfig>("/auth/ldap/config"),
  updateLdapConfig: (config: LdapConfig) =>
    identityClient.put<LdapConfig>("/auth/ldap/config", config),
  testLdapConnection: (config: LdapConfig) =>
    identityClient.post("/auth/ldap/test", config),
  syncLdap: () => identityClient.post("/auth/ldap/sync"),
  // MFA
  mfaSetup: () =>
    identityClient.post<{
      secret: string;
      qr_code: string;
      qr_code_url?: string;
      backup_codes: string[];
    }>("/auth/mfa/setup"),
  // Aliases used by settings page
  ldapGetConfig: () => identityClient.get<LdapConfig>("/auth/ldap/config"),
  ldapUpdateConfig: (config: LdapConfig) =>
    identityClient.put<LdapConfig>("/auth/ldap/config", config),
  ldapTestConnection: (config?: LdapConfig) =>
    identityClient.post<{ success: boolean; message?: string }>(
      "/auth/ldap/test",
      config,
    ),
};

// Preferences API
export const preferencesApi = {
  get: () => identityClient.get("/users/me/preferences"),
  sync: (data: Record<string, unknown>) =>
    identityClient.post("/users/me/preferences/sync", data),
  patch: (section: string, data: Record<string, unknown>) =>
    identityClient.patch(`/users/me/preferences/${section}`, data),
  reset: () => identityClient.post("/users/me/preferences/reset"),
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
  /** Set to true when the user has multiple company affiliations and must pick one */
  requires_context?: boolean;
  /** Available login contexts when requires_context is true */
  contexts?: import("./companies").LoginContextDisplay[];
}

export interface RefreshResponse {
  access_token: string;
  refresh_token: string;
}

// Role values as sent by backend (i16): 0=guest, 1=user, 2=admin, 3=superadmin
export enum UserRole {
  Guest = 0,
  User = 1,
  Admin = 2,
  SuperAdmin = 3,
}

// Aligned with Rust UserResponse from signapps-identity
export interface User {
  id: string;
  username: string;
  email?: string;
  display_name?: string;
  role: UserRole; // i16 in Rust: 0=guest, 1=user, 2=admin, 3=superadmin
  mfa_enabled: boolean;
  auth_provider: string; // 'local' | 'ldap'
  created_at: string;
  last_login?: string;
  tenant_id?: string;
  department?: string;
  job_title?: string;
  phone?: string;
  timezone?: string;
  locale?: string;
  avatar_url?: string;
  user_settings?: Record<string, unknown>;
  webdav_enabled?: boolean;
  onboarding_completed_at?: string;
  streak_count?: number;
  streak_last_date?: string;
}

// Helper to check if user is admin (role >= Admin)
export function isAdmin(user: User): boolean {
  return user.role >= UserRole.Admin;
}

// Helper to check if user is superadmin
export function isSuperAdmin(user: User): boolean {
  return user.role >= UserRole.SuperAdmin;
}

// Helper to check if user is LDAP user
export function isLdap(user: User): boolean {
  return user.auth_provider === "ldap";
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
  // Backend returns paginated wrapper — see UserListResponse
  // Query params: offset, limit (not page)
  list: (offset?: number, limit?: number) =>
    identityClient.get<UserListResponse>("/users", {
      params: { offset, limit },
    }),
  get: (id: string) => identityClient.get<User>(`/users/${id}`),
  create: (data: CreateUserRequest) =>
    identityClient.post<User>("/users", data),
  update: (id: string, data: UpdateUserRequest) =>
    identityClient.put<User>(`/users/${id}`, data),
  delete: (id: string) => identityClient.delete(`/users/${id}`),
};

// Roles API (RBAC)
export const rolesApi = {
  list: () => identityClient.get<Role[]>("/roles"),
  get: (id: string) => identityClient.get<Role>(`/roles/${id}`),
  create: (data: CreateRoleRequest) =>
    identityClient.post<Role>("/roles", data),
  update: (id: string, data: CreateRoleRequest) =>
    identityClient.put<Role>(`/roles/${id}`, data),
  delete: (id: string) => identityClient.delete(`/roles/${id}`),
};

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: RolePermissions;
  is_system: boolean;
  created_at?: string;
}

export interface RolePermissions {
  [resource: string]: string[]; // e.g., { "containers": ["read", "write"], "storage": ["read"] }
}

export interface CreateRoleRequest {
  name: string;
  description?: string;
  permissions: RolePermissions;
}

// Webhooks API
export const webhooksApi = {
  list: () => identityClient.get<Webhook[]>("/webhooks"),
  get: (id: string) => identityClient.get<Webhook>(`/webhooks/${id}`),
  create: (data: CreateWebhookRequest) =>
    identityClient.post<Webhook>("/webhooks", data),
  update: (id: string, data: Partial<CreateWebhookRequest>) =>
    identityClient.put<Webhook>(`/webhooks/${id}`, data),
  delete: (id: string) => identityClient.delete(`/webhooks/${id}`),
  test: (id: string) =>
    identityClient.post<{ success: boolean; status_code?: number }>(
      `/webhooks/${id}/test`,
    ),
};

export interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  headers: Record<string, string>;
  enabled: boolean;
  last_triggered?: string;
  last_status?: number;
  created_at: string;
  updated_at: string;
}

export interface CreateWebhookRequest {
  name: string;
  url: string;
  secret?: string;
  events: string[];
  headers?: Record<string, string>;
  enabled?: boolean;
}

export interface UserListResponse {
  users: User[];
  total: number;
  // Backend returns `offset` and `limit` (not `page`) — matches UserListResponse in users.rs
  offset: number;
  limit: number;
}

export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  display_name?: string;
  role?: number;
  workspace_ids?: string[];
  avatar_url?: string;
}

export interface UpdateUserRequest {
  email?: string;
  password?: string;
  display_name?: string;
  role?: number;
  workspace_ids?: string[];
  avatar_url?: string;
}

// Groups API
export const groupsApi = {
  list: () => identityClient.get<Group[]>("/groups"),
  get: (id: string) => identityClient.get<Group>(`/groups/${id}`),
  create: (data: CreateGroupRequest) =>
    identityClient.post<Group>("/groups", data),
  update: (id: string, data: Partial<CreateGroupRequest>) =>
    identityClient.put<Group>(`/groups/${id}`, data),
  delete: (id: string) => identityClient.delete(`/groups/${id}`),
  // Members
  listMembers: (id: string) =>
    identityClient.get<GroupMember[]>(`/groups/${id}/members`),
  addMember: (id: string, userId: string, role?: string) =>
    identityClient.post(`/groups/${id}/members`, { user_id: userId, role }),
  removeMember: (id: string, userId: string) =>
    identityClient.delete(`/groups/${id}/members/${userId}`),
  // Permissions
  getPermissions: (id: string) =>
    identityClient.get<GroupPermissions>(`/groups/${id}/permissions`),
  updatePermissions: (id: string, permissions: GroupPermissions) =>
    identityClient.put(`/groups/${id}/permissions`, permissions),
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

export interface GroupMember {
  user_id: string;
  username: string;
  email?: string;
  full_name?: string;
  role: string;
  added_at: string;
}

export interface GroupPermissions {
  containers?: string[]; // ['read', 'write', 'delete']
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
    identityClient.get<AuditLogListResponse>("/audit-logs", {
      params: filters,
    }),
  get: (id: string) => identityClient.get<AuditLog>(`/audit-logs/${id}`),
  getByUser: (userId: string, limit?: number, offset?: number) =>
    identityClient.get<AuditLogListResponse>(`/audit-logs/user/${userId}`, {
      params: { limit, offset },
    }),
  export: (filters?: AuditLogFilters) =>
    identityClient.get("/audit-logs/export", {
      params: filters,
      responseType: "blob",
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
  status: "success" | "failure";
  created_at: string;
}

export type AuditAction =
  | "login"
  | "logout"
  | "login_failed"
  | "mfa_enabled"
  | "mfa_disabled"
  | "password_changed"
  | "password_reset"
  | "user_created"
  | "user_updated"
  | "user_deleted"
  | "role_changed"
  | "group_created"
  | "group_updated"
  | "group_deleted"
  | "member_added"
  | "member_removed"
  | "permission_changed"
  | "api_key_created"
  | "api_key_revoked";

export interface AuditLogFilters {
  user_id?: string;
  username?: string;
  action?: AuditAction;
  resource_type?: string;
  status?: "success" | "failure";
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

// Security Events API (admin only) — GET /api/v1/admin/security/events
export const securityEventsApi = {
  list: (params?: { limit?: number; offset?: number; event_type?: string }) =>
    identityClient.get<SecurityEventsResponse>("/admin/security/events", {
      params,
    }),
  summary: () =>
    identityClient.get<SecurityEventsSummary>("/admin/security/events/summary"),
};

export interface SecurityEvent {
  id: string;
  event_type: string;
  user_id?: string;
  username?: string;
  ip_address?: string;
  user_agent?: string;
  details?: Record<string, unknown>;
  severity: "low" | "medium" | "high" | "critical";
  created_at: string;
}

export interface SecurityEventsResponse {
  events: SecurityEvent[];
  total: number;
  limit: number;
  offset: number;
}

export interface SecurityEventsSummary {
  total_events: number;
  by_severity: Record<string, number>;
  by_type: Record<string, number>;
  recent_count: number;
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

// ============================================================================
// IP Allowlist API — GET/PUT /api/v1/admin/security/ip-allowlist
// ============================================================================

export interface IpAllowlistEntry {
  address: string;
  cidr: string;
  label?: string;
  enabled: boolean;
}

export const identityApi = {
  // IP Allowlist (admin only)
  ipAllowlist: {
    list: () =>
      identityClient.get<IpAllowlistEntry[]>("/admin/security/ip-allowlist"),
    update: (entries: IpAllowlistEntry[]) =>
      identityClient.put<IpAllowlistEntry[]>(
        "/admin/security/ip-allowlist",
        entries,
      ),
  },

  // Guest tokens — /api/v1/guest-tokens
  guestTokens: {
    create: (data: {
      resource_type: string;
      resource_id: string;
      permission: "read" | "comment";
      expires_in_hours?: number;
      description?: string;
    }) => identityClient.post("/guest-tokens", data),
    list: () => identityClient.get("/guest-tokens"),
    revoke: (id: string) => identityClient.delete(`/guest-tokens/${id}`),
    validate: (token: string) =>
      identityClient.post("/guest-tokens/validate", { token }),
  },

  // Webhooks — /api/v1/webhooks (already exported separately as webhooksApi)
  webhooks: {
    list: () => identityClient.get<Webhook[]>("/webhooks"),
    create: (data: CreateWebhookRequest) =>
      identityClient.post<Webhook>("/webhooks", data),
    delete: (id: string) => identityClient.delete(`/webhooks/${id}`),
  },

  // OpenAPI spec — GET /api/v1/openapi.json
  openApiSpec: () => identityClient.get("/openapi.json"),

  // User profile — /api/v1/users/me/profile, recent-docs, history, streak
  profile: {
    get: () => identityClient.get("/users/me/profile"),
    update: (data: {
      onboarding_completed_at?: string;
      streak_count?: number;
      streak_last_date?: string;
    }) => identityClient.patch("/users/me/profile", data),
    recentDocs: () => identityClient.get("/users/me/recent-docs"),
    upsertRecentDoc: (data: {
      doc_id: string;
      doc_name: string;
      doc_kind: string;
      doc_href: string;
    }) => identityClient.post("/users/me/recent-docs", data),
    history: () => identityClient.get("/users/me/history"),
    addHistory: (data: {
      action: string;
      entity_type?: string;
      entity_id?: string;
      entity_title?: string;
      metadata?: Record<string, unknown>;
    }) => identityClient.post("/users/me/history", data),
    streak: () => identityClient.post("/users/me/streak/checkin"),
  },

  // Feature flags (admin only) — /api/v1/admin/feature-flags
  featureFlags: {
    list: () => identityClient.get<FeatureFlag[]>("/admin/feature-flags"),
    create: (data: {
      name: string;
      enabled?: boolean;
      rollout_pct?: number;
      description?: string;
    }) => identityClient.post<FeatureFlag>("/admin/feature-flags", data),
    update: (
      id: string,
      data: {
        name?: string;
        enabled?: boolean;
        rollout_pct?: number;
        description?: string;
      },
    ) => identityClient.put<FeatureFlag>(`/admin/feature-flags/${id}`, data),
    delete: (id: string) => identityClient.delete(`/admin/feature-flags/${id}`),
  },

  // Tenant CSS (admin only) — /api/v1/admin/tenants/:id/css
  tenantCss: {
    get: (tenantId: string) =>
      identityClient.get<TenantCssResponse>(`/admin/tenants/${tenantId}/css`),
    update: (tenantId: string, css_override: string | null) =>
      identityClient.put<TenantCssResponse>(`/admin/tenants/${tenantId}/css`, {
        css_override,
      }),
    clear: (tenantId: string) =>
      identityClient.delete(`/admin/tenants/${tenantId}/css`),
  },
};

// ============================================================================
// Supporting types for identityApi
// ============================================================================

export interface FeatureFlag {
  id: string;
  name: string;
  enabled: boolean;
  rollout_pct: number;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface TenantCssResponse {
  tenant_id: string;
  css_override?: string;
}

// ============================================================================
// Compliance API — CO1/CO2/CO4
// ============================================================================

export const complianceApi = {
  // DPIA
  saveDpia: (data: Record<string, unknown>) =>
    identityClient.post("/compliance/dpia", data),
  listDpias: () => identityClient.get<unknown[]>("/compliance/dpia"),

  // DSAR
  createDsar: (data: {
    type: string;
    subject_name: string;
    subject_email: string;
    description?: string;
  }) => identityClient.post("/compliance/dsar", data),
  listDsars: () => identityClient.get<{ data: unknown[] }>("/compliance/dsar"),
  updateDsar: (id: string, data: { status: string; notes?: string }) =>
    identityClient.patch(`/compliance/dsar/${id}`, data),

  // Retention policies
  saveRetentionPolicies: (policies: unknown) =>
    identityClient.put("/compliance/retention-policies", { policies }),
  getRetentionPolicies: () =>
    identityClient.get<{ data: unknown[] }>("/compliance/retention-policies"),

  // Consent (CO4)
  saveConsent: (consent: unknown) =>
    identityClient.put("/compliance/consent", { consent }),
  getConsent: () =>
    identityClient.get<{ config: unknown }>("/compliance/consent"),

  // Cookie banner
  saveCookieBanner: (config: unknown) =>
    identityClient.put("/compliance/cookie-banner", { config }),
  getCookieBanner: () =>
    identityClient.get<{ config: unknown }>("/compliance/cookie-banner"),
};
