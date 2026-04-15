/**
 * Vault Enterprise — Types
 */

export type VaultItemType =
  | "login"
  | "secure_note"
  | "card"
  | "ssh_key"
  | "api_token"
  | "identity"
  | "passkey";

export type ShareType = "person" | "group";

export type AccessLevel = "full" | "use_only" | "read_only";

export interface VaultUserKeys {
  user_id: string;
  encrypted_sym_key: string;
  encrypted_private_key: string;
  public_key: string;
  kdf_type: string;
  kdf_iterations: number;
  has_master_password: boolean;
}

export interface VaultItem {
  id: string;
  owner_id: string;
  folder_id?: string;
  item_type: VaultItemType;
  name: string;
  data: string; // encrypted JSON
  notes?: string; // encrypted
  fields?: string; // encrypted custom fields JSON
  totp_secret?: string; // encrypted
  uri?: string; // encrypted
  favorite: boolean;
  reprompt: boolean;
  created_at: string;
  updated_at: string;
}

export interface DecryptedVaultItem extends Omit<
  VaultItem,
  "name" | "data" | "notes" | "uri" | "totp_secret"
> {
  name: string;
  data: Record<string, unknown>;
  notes?: string;
  uri?: string;
  totp_secret?: string;
}

export interface VaultFolder {
  id: string;
  owner_id: string;
  name: string; // encrypted
}

export interface DecryptedFolder {
  id: string;
  name: string;
}

export interface VaultShare {
  id: string;
  item_id: string;
  share_type: ShareType;
  grantee_id: string;
  access_level: AccessLevel;
  granted_by: string;
  expires_at?: string;
}

export interface VaultAuditEntry {
  id: string;
  item_id?: string;
  action: string;
  actor_id: string;
  actor_ip?: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface BrowseSession {
  token: string;
  proxy_url: string;
  expires_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Item data shapes (plain, before encryption)
// ─────────────────────────────────────────────────────────────────────────────

export interface LoginData {
  username: string;
  password: string;
  uris?: string[];
}

export interface SecureNoteData {
  content: string;
}

export interface CardData {
  cardholder: string;
  number: string;
  expiry: string; // MM/YY
  cvv: string;
}

export interface SshKeyData {
  private_key: string;
  public_key?: string;
  passphrase?: string;
}

export interface ApiTokenData {
  token: string;
  endpoint?: string;
}

export interface IdentityData {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  address?: string;
  id_number?: string;
}

export interface PasskeyData {
  relying_party: string;
  credential_id: string;
  public_key: string;
}
