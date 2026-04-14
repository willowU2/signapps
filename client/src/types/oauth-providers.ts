// TypeScript types mirroring the backend Serde structs for OAuth provider
// configuration. See services/signapps-identity/src/handlers/admin/oauth_providers.rs.

export type ProviderCategory =
  | "Mail"
  | "Calendar"
  | "Drive"
  | "Social"
  | "Sso"
  | "Chat"
  | "Dev"
  | "Crm"
  | "Other";

export type OAuthPurpose = "login" | "integration";

export interface ProviderConfigSummary {
  provider_key: string;
  display_name: string;
  categories: ProviderCategory[];
  enabled: boolean;
  purposes: string[];
  visibility: "all" | "restricted";
  allow_user_override: boolean;
  has_credentials: boolean;
  updated_at: string;
}

export interface ProviderConfigDetail {
  id: string;
  provider_key: string;
  display_name: string;
  categories: ProviderCategory[];
  enabled: boolean;
  purposes: string[];
  allowed_scopes: string[];
  default_scopes: string[];
  visibility: "all" | "restricted";
  visible_to_org_nodes: string[];
  visible_to_groups: string[];
  visible_to_roles: string[];
  visible_to_users: string[];
  allow_user_override: boolean;
  is_tenant_sso: boolean;
  auto_provision_users: boolean;
  default_role: string | null;
  has_credentials: boolean;
  updated_at: string;
}

/** Mirrors UpsertProviderConfigBody — all fields optional (PATCH-style). */
export interface UpsertProviderConfigBody {
  enabled?: boolean;
  purposes?: string[];
  allowed_scopes?: string[];
  /** Plaintext — encrypted server-side before write. Omit to keep existing. */
  client_id?: string;
  client_secret?: string;
  /** Extra provider params, e.g. `{ tenant: "common" }` for Microsoft. */
  extra_params?: Record<string, unknown>;
  visibility?: "all" | "restricted";
  visible_to_org_nodes?: string[];
  visible_to_groups?: string[];
  visible_to_roles?: string[];
  visible_to_users?: string[];
  allow_user_override?: boolean;
  is_tenant_sso?: boolean;
  auto_provision_users?: boolean;
  default_role?: string | null;
}

export interface TestProviderResponse {
  authorization_url: string;
  flow_id: string;
  note: string;
}

export interface ProviderStats {
  provider_key: string;
  total_in_queue: number;
  disabled: number;
  warning_count: number;
  last_disabled_at: string | null;
}
