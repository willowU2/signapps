# Vault Enterprise — Gestionnaire de secrets zero-knowledge — Design Spec

## Objectif

Gestionnaire de mots de passe, secrets, CB, passkeys et 2FA intégré à SignApps. Zero-knowledge (serveur ne voit jamais les secrets en clair). Partage par personne ou groupe org avec 3 niveaux (full, use_only, read_only). Browse intégré via proxy HTTP reverse pour mode use_only. 2FA intégré avec injection automatique TOTP.

## Décisions architecturales

- **Zero-knowledge** : chiffrement/déchiffrement exclusivement client-side (Web Crypto API)
- **Clé dérivée du password SignApps** par défaut, master password optionnel séparé
- **Recovery via clé org** : l'organisation peut re-chiffrer le vault si l'utilisateur oublie
- **Browse intégré** : proxy HTTP reverse (signapps-proxy) injecte credentials sans les exposer au navigateur
- **2FA intégré** : stockage TOTP + génération codes + injection auto via proxy
- **Partage** : par personne (RSA) ou groupe org (clé org partagée), 3 niveaux d'accès
- **Audit forensique** : chaque accès/copie/utilisation/partage loggé

---

## 1. Modèle de chiffrement

### Hiérarchie des clés

```
password (ou master_password)
  → PBKDF2(password, email_salt, 600000) → master_key
    → AES-GCM(master_key) encrypts sym_key
      → AES-GCM(sym_key) encrypts vault items
      → AES-GCM(sym_key) encrypts rsa_private_key
    → RSA public_key (stocké en clair pour le partage)

Partage personne:
  → RSA-OAEP(recipient_public_key, item_key)

Partage groupe:
  → org_sym_key (random AES-256)
  → Pour chaque membre: RSA-OAEP(member_public_key, org_sym_key)
  → AES-GCM(org_sym_key) encrypts shared items
```

### Auth vault

```
password_hash = PBKDF2(master_key, password, 1) → envoyé serveur pour vérification
```

Le serveur stocke le hash (Argon2id) du password_hash. Double hachage = le serveur ne peut pas dériver la master_key.

---

## 2. Modèle de données

### vault.user_keys

| Champ | Type | Description |
|-------|------|-------------|
| id | UUID PK | |
| user_id | UUID FK UNIQUE → users | |
| encrypted_sym_key | bytea | Clé sym chiffrée avec master_key |
| encrypted_private_key | bytea | RSA private chiffrée avec sym_key |
| public_key | text | RSA public en clair |
| kdf_type | text | `pbkdf2` ou `argon2id` |
| kdf_iterations | int | 600000 |
| has_master_password | bool | false = dérivé du password SignApps |
| created_at, updated_at | timestamptz | |

### vault.items

| Champ | Type | Description |
|-------|------|-------------|
| id | UUID PK | |
| owner_id | UUID FK → users | |
| folder_id | UUID FK nullable → folders | |
| item_type | enum | `login`, `secure_note`, `card`, `ssh_key`, `api_token`, `identity`, `passkey` |
| name | bytea | Chiffré |
| data | bytea | JSON chiffré (champs type-spécifiques) |
| notes | bytea nullable | Chiffré |
| fields | bytea nullable | Champs custom chiffrés |
| item_key | bytea nullable | Clé per-item chiffrée (pour partage) |
| totp_secret | bytea nullable | Secret TOTP chiffré |
| password_history | bytea nullable | Historique chiffré |
| uri | bytea nullable | URL(s) chiffrées (pour auto-fill) |
| favorite | bool | |
| reprompt | bool | Re-demander master password |
| created_at, updated_at | timestamptz | |

### vault.folders

| Champ | Type |
|-------|------|
| id | UUID PK |
| owner_id | UUID FK → users |
| name | bytea | Chiffré |
| created_at | timestamptz |

### vault.shares

| Champ | Type | Description |
|-------|------|-------------|
| id | UUID PK | |
| item_id | UUID FK → items | |
| share_type | enum | `person`, `group` |
| grantee_id | UUID | person_id ou group_id |
| access_level | enum | `full`, `use_only`, `read_only` |
| encrypted_key | bytea | Clé item chiffrée pour le destinataire |
| granted_by | UUID FK → users | |
| expires_at | timestamptz nullable | |
| created_at | timestamptz | |

### vault.org_keys

| Champ | Type | Description |
|-------|------|-------------|
| id | UUID PK | |
| group_id | UUID FK → groups | |
| member_user_id | UUID FK → users | |
| encrypted_org_key | bytea | Clé org chiffrée avec member public_key |
| created_at | timestamptz | |
| UNIQUE(group_id, member_user_id) | | |

### vault.browse_sessions

| Champ | Type | Description |
|-------|------|-------------|
| id | UUID PK | |
| token | text UNIQUE | Token de session proxy |
| item_id | UUID FK → items | |
| user_id | UUID FK → users | |
| target_url | text | URL du site cible |
| injected_credentials | bytea | Credentials chiffrées (clé session éphémère) |
| expires_at | timestamptz | +30 min |
| created_at | timestamptz | |

### vault.audit_log

| Champ | Type | Description |
|-------|------|-------------|
| id | UUID PK | |
| item_id | UUID nullable | |
| action | enum | `view`, `copy`, `use`, `browse`, `create`, `update`, `delete`, `share`, `unshare`, `totp_generate` |
| actor_id | UUID FK → users | |
| actor_ip | inet | |
| details | JSONB | |
| created_at | timestamptz | |

---

## 3. Browse intégré (Proxy HTTP)

### Flux use_only

```
1. POST /api/v1/vault/browse/start {item_id}
   → Vérifie access_level >= use_only
   → Déchiffre credentials via org_key (serveur-side pour use_only)
   → Crée browse_session (token, 30min TTL)
   → Retourne {token, proxy_url}

2. GET /proxy/vault/{token}
   → Proxy charge la page cible (reqwest)
   → Détecte les formulaires login (heuristique: input[type=password])
   → Injecte username + password via JavaScript
   → Si TOTP configuré: calcule le code et injecte
   → Sert la page modifiée à l'utilisateur
   → Le mot de passe n'apparaît PAS dans le HTML servi

3. Navigation continue via le proxy (toutes les URLs sont réécrites)

4. DELETE /api/v1/vault/browse/{token} ou expiration 30min
```

### Injection de credentials

```javascript
// Injecté dans la page proxifiée
(function() {
  const forms = document.querySelectorAll('form');
  for (const form of forms) {
    const userInput = form.querySelector('input[type="text"], input[type="email"], input[name*="user"], input[name*="login"]');
    const passInput = form.querySelector('input[type="password"]');
    if (userInput && passInput) {
      userInput.value = '{{USERNAME}}';
      passInput.value = '{{PASSWORD}}';
      // Dispatch events for React/Vue forms
      userInput.dispatchEvent(new Event('input', {bubbles: true}));
      passInput.dispatchEvent(new Event('input', {bubbles: true}));
    }
  }
  // Auto-submit if configured
  // TOTP injection on 2FA page
})();
```

---

## 4. 2FA intégré

### Stockage TOTP

Le `totp_secret` (clé base32) est stocké chiffré dans `vault.items.totp_secret`. Quand l'utilisateur ajoute un login, il peut scanner un QR code ou coller la clé TOTP.

### Génération de codes

Client-side (mode full) :
```typescript
function generateTotp(secret: string): string {
  const key = base32Decode(secret);
  const counter = Math.floor(Date.now() / 30000);
  const hmac = hmacSha1(key, int64ToBytes(counter));
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[offset] & 0x7f) << 24 | hmac[offset+1] << 16 | hmac[offset+2] << 8 | hmac[offset+3]) % 1000000;
  return code.toString().padStart(6, '0');
}
```

Server-side (mode use_only via proxy) : même algorithme en Rust.

### Injection auto

Le proxy détecte les pages 2FA (input avec maxlength=6, labels "code", "verification") et injecte le TOTP calculé.

---

## 5. Endpoints API

```
# Clés
POST   /api/v1/vault/keys/init           — {encrypted_sym_key, encrypted_private_key, public_key, kdf_type, kdf_iterations}
GET    /api/v1/vault/keys                 — récupérer mes clés chiffrées
PUT    /api/v1/vault/keys                 — mettre à jour (changement password)

# Items (tout est ciphertext)
GET    /api/v1/vault/items                — lister mes items + partagés avec moi
POST   /api/v1/vault/items                — créer {name, data, notes, item_type, ...} (tout chiffré)
PUT    /api/v1/vault/items/:id            — modifier
DELETE /api/v1/vault/items/:id            — supprimer
GET    /api/v1/vault/items/:id/history    — historique passwords

# Dossiers
GET    /api/v1/vault/folders
POST   /api/v1/vault/folders
PUT    /api/v1/vault/folders/:id
DELETE /api/v1/vault/folders/:id

# Partage
POST   /api/v1/vault/shares              — {item_id, share_type, grantee_id, access_level, encrypted_key}
DELETE /api/v1/vault/shares/:id           — révoquer
GET    /api/v1/vault/shared-with-me       — items partagés avec moi

# Browse (use_only)
POST   /api/v1/vault/browse/start         — {item_id} → {token, proxy_url}
DELETE /api/v1/vault/browse/:token        — terminer

# TOTP
GET    /api/v1/vault/totp/:item_id        — code actuel (serveur, pour use_only)

# Org keys
POST   /api/v1/vault/org-keys             — {group_id, member_user_id, encrypted_org_key}
GET    /api/v1/vault/org-keys/:group_id   — ma clé org

# Audit
GET    /api/v1/vault/audit                — historique (admin)

# Générateur
POST   /api/v1/vault/generate-password    — {length, uppercase, lowercase, digits, symbols}
```

---

## 6. Frontend

### Pages
- `/vault` — Coffre-fort principal
- `/vault/browse/:token` — Browse intégré (plein écran)

### Composants
| Composant | Lignes | Description |
|-----------|--------|-------------|
| `vault-crypto.ts` | ~300 | Web Crypto API (PBKDF2, AES-GCM, RSA, TOTP) |
| `vault-list.tsx` | ~400 | Liste items avec type badges, recherche, dossiers, favoris |
| `vault-item-form.tsx` | ~500 | Formulaire adaptatif (login, note, card, ssh, api, identity, passkey) |
| `vault-share-dialog.tsx` | ~250 | Partage personne/groupe + access level |
| `vault-browse-frame.tsx` | ~150 | Frame proxy plein écran |
| `totp-display.tsx` | ~100 | Code TOTP live avec barre de progression 30s |
| `password-generator.tsx` | ~200 | Générateur configurable |
| `vault-unlock.tsx` | ~150 | Dialogue déverrouillage master password |
| `vault-store.ts` | ~200 | Zustand (items déchiffrés en mémoire, lock/unlock) |
| `vault-api.ts` | ~120 | API client |

---

## 7. Fichiers à créer/modifier

### Backend
| Action | Fichier |
|--------|---------|
| Créer | `migrations/123_vault_schema.sql` |
| Créer | `crates/signapps-db/src/models/vault.rs` |
| Créer | `crates/signapps-db/src/repositories/vault_repository.rs` |
| Créer | `services/signapps-identity/src/handlers/vault.rs` |
| Créer | `services/signapps-identity/src/services/vault_crypto.rs` |
| Créer | `services/signapps-proxy/src/handlers/vault_browse.rs` |
| Modifier | `services/signapps-identity/src/main.rs` (routes) |
| Modifier | `services/signapps-proxy/src/main.rs` (browse routes) |

### Frontend
| Action | Fichier |
|--------|---------|
| Créer | `client/src/lib/vault-crypto.ts` |
| Créer | `client/src/lib/api/vault.ts` |
| Créer | `client/src/types/vault.ts` |
| Créer | `client/src/stores/vault-store.ts` |
| Créer | `client/src/app/vault/page.tsx` |
| Créer | `client/src/app/vault/browse/[token]/page.tsx` |
| Créer | `client/src/components/vault/vault-list.tsx` |
| Créer | `client/src/components/vault/vault-item-form.tsx` |
| Créer | `client/src/components/vault/vault-share-dialog.tsx` |
| Créer | `client/src/components/vault/vault-browse-frame.tsx` |
| Créer | `client/src/components/vault/totp-display.tsx` |
| Créer | `client/src/components/vault/password-generator.tsx` |
| Créer | `client/src/components/vault/vault-unlock.tsx` |
| Modifier | `client/src/components/layout/sidebar.tsx` (lien vault) |
