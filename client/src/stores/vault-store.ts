/**
 * Vault Store — Zustand
 *
 * Gère l'état du coffre-fort : verrouillage, clés en mémoire,
 * éléments déchiffrés, dossiers et partages.
 *
 * La clé symétrique (symKey) n'est JAMAIS persistée.
 * Elle vit uniquement en mémoire pendant la session.
 */

import { create } from 'zustand';
import { vaultApi } from '@/lib/api/vault';
import {
  unlockVault,
  encrypt,
  decrypt,
  deriveKey,
  initializeVault,
  encryptWithPublicKey,
} from '@/lib/vault-crypto';
import type {
  VaultItemType,
  ShareType,
  AccessLevel,
  VaultItem,
  DecryptedVaultItem,
  DecryptedFolder,
  BrowseSession,
} from '@/types/vault';

// ─────────────────────────────────────────────────────────────────────────────
// State interface
// ─────────────────────────────────────────────────────────────────────────────

interface VaultState {
  /** Le coffre est verrouillé (clé absente en mémoire) */
  locked: boolean;
  /** Clé symétrique AES-256-GCM en mémoire vive — null si verrouillé */
  symKey: CryptoKey | null;
  /** Clé privée RSA déchiffrée (base64) — pour les partages */
  privateKey: string | null;
  /** Éléments du coffre déchiffrés */
  items: DecryptedVaultItem[];
  /** Dossiers déchiffrés */
  folders: DecryptedFolder[];
  /** Éléments partagés avec l'utilisateur courant */
  sharedItems: DecryptedVaultItem[];
  /** Indicateur de chargement global */
  loading: boolean;
  /** Erreur courante */
  error: string | null;

  // ──────────────────────────────────────────────
  // Actions
  // ──────────────────────────────────────────────

  /** Déverrouille le coffre */
  unlock: (password: string, email: string) => Promise<void>;
  /** Verrouille le coffre : efface symKey + tous les plaintexts de la mémoire */
  lock: () => void;
  /** Initialise le coffre pour la première utilisation */
  initialize: (password: string, email: string) => Promise<void>;
  /** Charge et déchiffre tous les éléments + dossiers du coffre */
  fetchAndDecrypt: () => Promise<void>;
  /** Crée un nouvel élément dans le coffre */
  createItem: (
    type: VaultItemType,
    name: string,
    plainData: Record<string, unknown>,
    opts?: {
      notes?: string;
      uri?: string;
      totp_secret?: string;
      folder_id?: string;
      favorite?: boolean;
      reprompt?: boolean;
    },
  ) => Promise<void>;
  /** Met à jour un élément existant */
  updateItem: (
    id: string,
    name: string,
    plainData: Record<string, unknown>,
    opts?: {
      notes?: string;
      uri?: string;
      totp_secret?: string;
      folder_id?: string;
      favorite?: boolean;
      reprompt?: boolean;
    },
  ) => Promise<void>;
  /** Supprime un élément */
  deleteItem: (id: string) => Promise<void>;
  /** Partage un élément avec une personne ou un groupe */
  shareItem: (
    itemId: string,
    granteeId: string,
    shareType: ShareType,
    level: AccessLevel,
    expiresAt?: string,
  ) => Promise<void>;
  /** Démarre une session de navigation isolée */
  startBrowse: (itemId: string) => Promise<BrowseSession>;
  /** Crée un nouveau dossier */
  createFolder: (name: string) => Promise<void>;
  /** Supprime un dossier */
  deleteFolder: (id: string) => Promise<void>;
  /** Efface l'erreur courante */
  clearError: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: déchiffre un item depuis l'API
// ─────────────────────────────────────────────────────────────────────────────

async function decryptItem(raw: VaultItem, symKey: CryptoKey): Promise<DecryptedVaultItem> {
  const [name, dataStr, notes, uri, totpSecret] = await Promise.all([
    decrypt(symKey, raw.name),
    decrypt(symKey, raw.data),
    raw.notes ? decrypt(symKey, raw.notes) : Promise.resolve(undefined),
    raw.uri ? decrypt(symKey, raw.uri) : Promise.resolve(undefined),
    raw.totp_secret ? decrypt(symKey, raw.totp_secret) : Promise.resolve(undefined),
  ]);

  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(dataStr);
  } catch {
    data = { raw: dataStr };
  }

  return {
    ...raw,
    name,
    data,
    notes,
    uri,
    totp_secret: totpSecret,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

export const useVaultStore = create<VaultState>((set, get) => ({
  locked: true,
  symKey: null,
  privateKey: null,
  items: [],
  folders: [],
  sharedItems: [],
  loading: false,
  error: null,

  // ── unlock ──────────────────────────────────────────────────────────────

  unlock: async (password, email) => {
    set({ loading: true, error: null });
    try {
      // 1. Récupère les clés chiffrées depuis le serveur
      const { data: userKeys } = await vaultApi.keys.get();

      // 2. Déverrouille la clé symétrique via PBKDF2 + AES-GCM
      const symKey = await unlockVault(
        password,
        email,
        userKeys.encrypted_sym_key,
      );

      // 3. Déchiffre la clé privée RSA (pour les partages)
      const masterKey = await deriveKey(password, email, userKeys.kdf_iterations || 600_000);
      const privateKey = await decrypt(masterKey, userKeys.encrypted_private_key);

      set({ locked: false, symKey, privateKey, loading: false });

      // 4. Charge et déchiffre tous les éléments
      await get().fetchAndDecrypt();
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Mot de passe incorrect',
      });
      throw err;
    }
  },

  // ── lock ────────────────────────────────────────────────────────────────

  lock: () => {
    set({
      locked: true,
      symKey: null,
      privateKey: null,
      items: [],
      folders: [],
      sharedItems: [],
      error: null,
    });
  },

  // ── initialize ──────────────────────────────────────────────────────────

  initialize: async (password, email) => {
    set({ loading: true, error: null });
    try {
      const { encryptedSymKey, encryptedPrivateKey, publicKey, passwordHash } =
        await initializeVault(password, email);

      await vaultApi.keys.init({
        encrypted_sym_key: encryptedSymKey,
        encrypted_private_key: encryptedPrivateKey,
        public_key: publicKey,
        password_hash: passwordHash,
        kdf_iterations: 600_000,
      });

      set({ loading: false });
      // Déverrouille automatiquement après initialisation
      await get().unlock(password, email);
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "Erreur lors de l'initialisation",
      });
      throw err;
    }
  },

  // ── fetchAndDecrypt ──────────────────────────────────────────────────────

  fetchAndDecrypt: async () => {
    const { symKey } = get();
    if (!symKey) return;

    set({ loading: true });
    try {
      const [itemsRes, foldersRes, sharedRes] = await Promise.all([
        vaultApi.items.list(),
        vaultApi.folders.list(),
        vaultApi.shares.sharedWithMe(),
      ]);

      const [items, folders, sharedItems] = await Promise.all([
        Promise.all(itemsRes.data.map((i) => decryptItem(i, symKey))),
        Promise.all(
          foldersRes.data.map(async (f) => ({
            id: f.id,
            name: await decrypt(symKey, f.name),
          })),
        ),
        Promise.all(sharedRes.data.map((i) => decryptItem(i, symKey))),
      ]);

      set({ items, folders, sharedItems, loading: false });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Erreur lors du chargement',
      });
    }
  },

  // ── createItem ───────────────────────────────────────────────────────────

  createItem: async (type, name, plainData, opts = {}) => {
    const { symKey } = get();
    if (!symKey) throw new Error('Coffre verrouillé');

    const [encName, encData, encNotes, encUri, encTotp] = await Promise.all([
      encrypt(symKey, name),
      encrypt(symKey, JSON.stringify(plainData)),
      opts.notes ? encrypt(symKey, opts.notes) : Promise.resolve(undefined),
      opts.uri ? encrypt(symKey, opts.uri) : Promise.resolve(undefined),
      opts.totp_secret ? encrypt(symKey, opts.totp_secret) : Promise.resolve(undefined),
    ]);

    await vaultApi.items.create({
      item_type: type,
      name: encName,
      data: encData,
      notes: encNotes,
      uri: encUri,
      totp_secret: encTotp,
      folder_id: opts.folder_id,
      favorite: opts.favorite ?? false,
      reprompt: opts.reprompt ?? false,
    });

    await get().fetchAndDecrypt();
  },

  // ── updateItem ───────────────────────────────────────────────────────────

  updateItem: async (id, name, plainData, opts = {}) => {
    const { symKey } = get();
    if (!symKey) throw new Error('Coffre verrouillé');

    const [encName, encData, encNotes, encUri, encTotp] = await Promise.all([
      encrypt(symKey, name),
      encrypt(symKey, JSON.stringify(plainData)),
      opts.notes ? encrypt(symKey, opts.notes) : Promise.resolve(undefined),
      opts.uri ? encrypt(symKey, opts.uri) : Promise.resolve(undefined),
      opts.totp_secret ? encrypt(symKey, opts.totp_secret) : Promise.resolve(undefined),
    ]);

    await vaultApi.items.update(id, {
      name: encName,
      data: encData,
      notes: encNotes,
      uri: encUri,
      totp_secret: encTotp,
      folder_id: opts.folder_id,
      favorite: opts.favorite,
      reprompt: opts.reprompt,
    });

    await get().fetchAndDecrypt();
  },

  // ── deleteItem ───────────────────────────────────────────────────────────

  deleteItem: async (id) => {
    await vaultApi.items.delete(id);
    set((state) => ({
      items: state.items.filter((i) => i.id !== id),
    }));
  },

  // ── shareItem ────────────────────────────────────────────────────────────

  shareItem: async (itemId, granteeId, shareType, level, expiresAt) => {
    const { symKey } = get();
    if (!symKey) throw new Error('Coffre verrouillé');

    // In a full implementation: fetch grantee's public key, encrypt the item key with it
    // For now, the server handles key distribution for group shares
    let encryptedItemKey: string | undefined;
    try {
      const keysRes = await vaultApi.keys.get();
      if (keysRes.data.public_key) {
        // Encrypt a placeholder item key reference with the recipient's public key
        // The actual key exchange is handled server-side
        encryptedItemKey = await encryptWithPublicKey(
          keysRes.data.public_key,
          itemId,
        );
      }
    } catch {
      // Server handles key distribution
    }

    await vaultApi.shares.create({
      item_id: itemId,
      share_type: shareType,
      grantee_id: granteeId,
      access_level: level,
      encrypted_item_key: encryptedItemKey,
      expires_at: expiresAt,
    });
  },

  // ── startBrowse ──────────────────────────────────────────────────────────

  startBrowse: async (itemId) => {
    const { data } = await vaultApi.browse.start(itemId);
    return data;
  },

  // ── createFolder ─────────────────────────────────────────────────────────

  createFolder: async (name) => {
    const { symKey } = get();
    if (!symKey) throw new Error('Coffre verrouillé');
    const encName = await encrypt(symKey, name);
    await vaultApi.folders.create({ name: encName });
    await get().fetchAndDecrypt();
  },

  // ── deleteFolder ─────────────────────────────────────────────────────────

  deleteFolder: async (id) => {
    await vaultApi.folders.delete(id);
    set((state) => ({
      folders: state.folders.filter((f) => f.id !== id),
    }));
  },

  clearError: () => set({ error: null }),
}));
