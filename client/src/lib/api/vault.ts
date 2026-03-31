/**
 * Vault API — Identity service (port 3001) endpoints under /vault/*
 */
import { getClient, ServiceName } from './factory';
import type {
  VaultUserKeys,
  VaultItem,
  VaultFolder,
  VaultShare,
  VaultAuditEntry,
  BrowseSession,
} from '@/types/vault';

const client = getClient(ServiceName.IDENTITY);

export const vaultApi = {
  // ──────────────────────────────────────────────
  // User key management
  // ──────────────────────────────────────────────
  keys: {
    /** Initialise les clés du coffre (première utilisation) */
    init: (data: {
      encrypted_sym_key: string;
      encrypted_private_key: string;
      public_key: string;
      password_hash: string;
      kdf_iterations?: number;
    }) => client.post('/vault/keys', data),

    /** Récupère les clés chiffrées de l'utilisateur courant */
    get: () => client.get<VaultUserKeys>('/vault/keys'),

    /** Met à jour les clés (changement de mot de passe maître) */
    update: (data: {
      encrypted_sym_key: string;
      encrypted_private_key: string;
      password_hash: string;
    }) => client.put('/vault/keys', data),
  },

  // ──────────────────────────────────────────────
  // Items
  // ──────────────────────────────────────────────
  items: {
    /** Liste tous les éléments du coffre de l'utilisateur */
    list: () => client.get<VaultItem[]>('/vault/items'),

    /** Crée un nouvel élément (données déjà chiffrées) */
    create: (data: {
      item_type: string;
      name: string;
      data: string;
      notes?: string;
      fields?: string;
      totp_secret?: string;
      uri?: string;
      folder_id?: string;
      favorite?: boolean;
      reprompt?: boolean;
    }) => client.post<VaultItem>('/vault/items', data),

    /** Met à jour un élément existant */
    update: (
      id: string,
      data: {
        name?: string;
        data?: string;
        notes?: string;
        fields?: string;
        totp_secret?: string;
        uri?: string;
        folder_id?: string;
        favorite?: boolean;
        reprompt?: boolean;
      },
    ) => client.put<VaultItem>(`/vault/items/${id}`, data),

    /** Supprime un élément */
    delete: (id: string) => client.delete(`/vault/items/${id}`),
  },

  // ──────────────────────────────────────────────
  // Folders
  // ──────────────────────────────────────────────
  folders: {
    list: () => client.get<VaultFolder[]>('/vault/folders'),
    create: (data: { name: string }) =>
      client.post<VaultFolder>('/vault/folders', data),
    update: (id: string, data: { name: string }) =>
      client.put<VaultFolder>(`/vault/folders/${id}`, data),
    delete: (id: string) => client.delete(`/vault/folders/${id}`),
  },

  // ──────────────────────────────────────────────
  // Sharing
  // ──────────────────────────────────────────────
  shares: {
    /** Partage un élément avec une personne ou un groupe */
    create: (data: {
      item_id: string;
      share_type: string;
      grantee_id: string;
      access_level: string;
      encrypted_item_key?: string;
      expires_at?: string;
    }) => client.post<VaultShare>('/vault/shares', data),

    /** Révoque un partage */
    delete: (id: string) => client.delete(`/vault/shares/${id}`),

    /** Éléments partagés avec l'utilisateur courant */
    sharedWithMe: () => client.get<VaultItem[]>('/vault/shared-with-me'),
  },

  // ──────────────────────────────────────────────
  // TOTP
  // ──────────────────────────────────────────────
  /** Demande un code TOTP généré côté serveur (mode use_only) */
  totp: (itemId: string) =>
    client.post<{ code: string }>(`/vault/items/${itemId}/totp`),

  // ──────────────────────────────────────────────
  // Password generator
  // ──────────────────────────────────────────────
  generatePassword: (params?: {
    length?: number;
    upper?: boolean;
    lower?: boolean;
    digits?: boolean;
    symbols?: boolean;
  }) =>
    client.get<{ password: string }>('/vault/generate-password', { params }),

  // ──────────────────────────────────────────────
  // Organisation keys (chiffrement partagé de groupe)
  // ──────────────────────────────────────────────
  orgKeys: {
    upsert: (data: { group_id: string; encrypted_org_key: string; public_key: string }) =>
      client.put('/vault/org-keys', data),
    get: (groupId: string) =>
      client.get<{ group_id: string; encrypted_org_key: string; public_key: string }>(
        `/vault/org-keys/${groupId}`,
      ),
  },

  // ──────────────────────────────────────────────
  // Browse (proxy isolé)
  // ──────────────────────────────────────────────
  browse: {
    /** Démarre une session de navigation isolée (use_only) */
    start: (itemId: string) =>
      client.post<BrowseSession>('/vault/browse/start', { item_id: itemId }),

    /** Termine et invalide la session */
    end: (token: string) => client.delete(`/vault/browse/${token}`),
  },

  // ──────────────────────────────────────────────
  // Audit
  // ──────────────────────────────────────────────
  audit: (params?: {
    item_id?: string;
    action?: string;
    limit?: number;
    offset?: number;
  }) => client.get<VaultAuditEntry[]>('/vault/audit', { params }),
};
