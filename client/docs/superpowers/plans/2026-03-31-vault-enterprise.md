# Vault Enterprise — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a zero-knowledge password/secret manager with browse-without-seeing-password proxy, integrated TOTP 2FA, and person/group sharing at 3 access levels (full, use_only, read_only).

**Architecture:** Client-side encryption (Web Crypto API: PBKDF2 + AES-256-GCM + RSA-2048), server stores only ciphertext. Browse proxy in signapps-proxy injects credentials server-side for use_only mode. TOTP codes generated client-side (full) or server-side (use_only proxy). Sharing via RSA key exchange (person) or org symmetric key (group).

**Tech Stack:** Rust (Axum, sha2, hmac, aes-gcm, base32), PostgreSQL, Web Crypto API, Next.js 16, React 19, Zustand

**Spec:** `docs/superpowers/specs/2026-03-31-vault-enterprise-design.md`

---

## Sub-Projects

| # | Sub-Project | Tasks | Depends On |
|---|-------------|-------|------------|
| **P1** | DB + Models + Repos | 1-2 | — |
| **P2** | Vault handlers + server crypto | 3-5 | P1 |
| **P3** | Browse proxy (use_only) | 6 | P2 |
| **P4** | Frontend crypto + API + store | 7-8 | P2 |
| **P5** | Frontend UI (pages + components) | 9-12 | P4 |

---

## P1: Database + Backend Core

### Task 1: Migration

**Files:**
- Create: `migrations/123_vault_schema.sql`

- [ ] **Step 1: Write migration**

Full schema: vault.user_keys, vault.items, vault.folders, vault.shares, vault.org_keys, vault.browse_sessions, vault.audit_log. Enums for item_type, share_type, access_level, audit_action. Indexes on owner_id, folder_id, item_type, shares grantee, sessions token/expiry.

- [ ] **Step 2: Apply**

```bash
docker exec -i signapps-postgres psql -U signapps < migrations/123_vault_schema.sql
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(vault): schema — user_keys, items, folders, shares, org_keys, browse_sessions, audit_log"
```

---

### Task 2: Models + Repository

**Files:**
- Create: `crates/signapps-db/src/models/vault.rs`
- Create: `crates/signapps-db/src/repositories/vault_repository.rs`
- Modify: `crates/signapps-db/src/models/mod.rs`
- Modify: `crates/signapps-db/src/repositories/mod.rs`

- [ ] **Step 1: Models**

Structs: VaultUserKeys, CreateUserKeys, VaultItem, CreateVaultItem, UpdateVaultItem, VaultFolder, CreateFolder, VaultShare, CreateShare, VaultOrgKey, BrowseSession, CreateBrowseSession, VaultAuditLog.

- [ ] **Step 2: Repository**

5 repos:
- `VaultKeysRepository`: get_by_user, create, update
- `VaultItemRepository`: list_by_owner, list_shared_with, create, update, delete, get_history
- `VaultFolderRepository`: list_by_owner, create, update, delete
- `VaultShareRepository`: create, delete, list_by_item, list_shared_with_user
- `VaultBrowseRepository`: create_session, get_session, delete_session, cleanup_expired
- `VaultAuditRepository`: insert, list (with filters)
- `VaultOrgKeyRepository`: upsert, get_for_member, list_by_group

- [ ] **Step 3: Build + commit**

```bash
cargo check -p signapps-db
git commit -m "feat(vault): models + repository — keys, items, folders, shares, browse, audit, org_keys"
```

---

## P2: Vault Handlers

### Task 3: Server-side crypto service

**Files:**
- Create: `services/signapps-identity/src/services/vault_crypto.rs`

- [ ] **Step 1: Implement**

```rust
/// Generate TOTP code from secret (for use_only mode)
pub fn generate_totp(secret_base32: &str) -> Result<String, AppError>

/// Generate random password
pub fn generate_password(length: usize, uppercase: bool, lowercase: bool, digits: bool, symbols: bool) -> String

/// Verify vault password hash (PBKDF2 double-hash)
pub fn verify_vault_hash(stored_hash: &str, provided_hash: &str) -> bool
```

Uses `sha2`, `hmac`, `base32`, `rand` crates (already in workspace).

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(vault): server-side crypto — TOTP generation, password generator"
```

---

### Task 4: Vault handlers (15 endpoints)

**Files:**
- Create: `services/signapps-identity/src/handlers/vault.rs`
- Modify: `services/signapps-identity/src/main.rs`

- [ ] **Step 1: Key management**

3 endpoints:
- `POST /api/v1/vault/keys/init` — Store initial encrypted keys
- `GET /api/v1/vault/keys` — Retrieve encrypted keys for client-side decryption
- `PUT /api/v1/vault/keys` — Update keys (password change)

- [ ] **Step 2: Item CRUD**

4 endpoints:
- `GET /api/v1/vault/items` — List own items + shared with me (all ciphertext)
- `POST /api/v1/vault/items` — Create (server stores ciphertext as-is)
- `PUT /api/v1/vault/items/:id` — Update
- `DELETE /api/v1/vault/items/:id` — Delete

Each operation logs to vault.audit_log.

- [ ] **Step 3: Folders**

4 endpoints: GET/POST/PUT/DELETE /api/v1/vault/folders (encrypted names)

- [ ] **Step 4: Sharing**

3 endpoints:
- `POST /api/v1/vault/shares` — Create share (encrypted_key for recipient)
- `DELETE /api/v1/vault/shares/:id` — Revoke
- `GET /api/v1/vault/shared-with-me` — List items shared with current user

- [ ] **Step 5: Utility endpoints**

4 endpoints:
- `GET /api/v1/vault/totp/:item_id` — Server-side TOTP (for use_only proxy)
- `POST /api/v1/vault/generate-password` — Random password
- `POST/GET/DELETE /api/v1/vault/org-keys` — Org key management
- `GET /api/v1/vault/audit` — Audit log (admin)

- [ ] **Step 6: Register routes, build, commit**

```bash
cargo check -p signapps-identity
git commit -m "feat(vault): 18 handler endpoints — keys, items, folders, shares, TOTP, audit"
```

---

### Task 5: Browse session handlers

**Files:**
- Modify: `services/signapps-identity/src/handlers/vault.rs`

- [ ] **Step 1: Browse endpoints**

2 endpoints:
- `POST /api/v1/vault/browse/start` — Create browse session {item_id} → {token, proxy_url, expires_at}
  - Verify user has use_only or full access
  - For use_only: decrypt credentials server-side using org_key
  - Store encrypted credentials in browse_session (with ephemeral session key)
  - Return proxy URL: `/proxy/vault/{token}`

- `DELETE /api/v1/vault/browse/:token` — End session

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(vault): browse session management for use_only proxy mode"
```

---

## P3: Browse Proxy

### Task 6: Vault browse proxy handler

**Files:**
- Create: `services/signapps-proxy/src/handlers/vault_browse.rs`
- Modify: `services/signapps-proxy/src/main.rs`

- [ ] **Step 1: Implement proxy handler**

```rust
/// GET /proxy/vault/:token — Proxy the target website with credential injection
pub async fn vault_browse(
    State(state): State<AppState>,
    Path(token): Path<String>,
    request: Request,
) -> Result<Response, AppError>
```

Implementation:
1. Look up browse_session by token (check not expired)
2. Fetch the target URL via reqwest
3. Parse HTML, find login forms
4. Inject credentials JavaScript snippet (username/password/TOTP)
5. Rewrite all URLs to go through the proxy (`/proxy/vault/{token}/path`)
6. Serve the modified HTML
7. For sub-resources (CSS, JS, images): proxy transparently
8. Log `browse` action in vault.audit_log

The credential injection script:
```javascript
(function(){
  var u='{{USERNAME}}',p='{{PASSWORD}}',t='{{TOTP}}';
  var pi=document.querySelector('input[type="password"]');
  if(pi){
    var fi=pi.form;
    if(fi){
      var ui=fi.querySelector('input[type="text"],input[type="email"],input[name*="user"],input[name*="login"],input[name*="email"]');
      if(ui){ui.value=u;ui.dispatchEvent(new Event('input',{bubbles:true}))}
      pi.value=p;pi.dispatchEvent(new Event('input',{bubbles:true}));
    }
  }
  // TOTP injection on 2FA pages
  if(t){
    var ti=document.querySelector('input[maxlength="6"],input[name*="code"],input[name*="otp"],input[name*="totp"]');
    if(ti){ti.value=t;ti.dispatchEvent(new Event('input',{bubbles:true}))}
  }
})();
```

- [ ] **Step 2: URL rewriting**

All `href`, `src`, `action` attributes in HTML are rewritten:
- `https://example.com/path` → `/proxy/vault/{token}/path`
- Relative URLs resolved against target base URL

- [ ] **Step 3: Register route**

```rust
.route("/proxy/vault/:token", any(vault_browse::vault_browse))
.route("/proxy/vault/:token/*path", any(vault_browse::vault_browse))
```

- [ ] **Step 4: Build + commit**

```bash
cargo check -p signapps-proxy
git commit -m "feat(vault): HTTP reverse proxy for use_only browse — credential + TOTP injection"
```

---

## P4: Frontend Crypto + API

### Task 7: Client-side crypto library

**Files:**
- Create: `client/src/lib/vault-crypto.ts`

- [ ] **Step 1: Implement Web Crypto API wrappers**

```typescript
// Key derivation
export async function deriveKey(password: string, salt: string, iterations: number): Promise<CryptoKey>
// → PBKDF2-SHA256, returns AES-GCM key

// Symmetric encryption
export async function encrypt(key: CryptoKey, plaintext: string): Promise<string>
// → AES-256-GCM with random IV, returns base64(iv + ciphertext)

export async function decrypt(key: CryptoKey, ciphertext: string): Promise<string>
// → Decode base64, extract IV, decrypt

// RSA key pair
export async function generateKeyPair(): Promise<{ publicKey: string; privateKey: string }>
// → RSA-OAEP 2048-bit, export as base64

export async function encryptWithPublicKey(publicKeyB64: string, data: string): Promise<string>
export async function decryptWithPrivateKey(privateKeyB64: string, data: string): Promise<string>

// Password hash for server auth
export async function hashForServer(masterKey: CryptoKey, password: string): Promise<string>
// → PBKDF2(masterKey, password, 1 iteration) → base64

// TOTP generation
export function generateTotp(secretBase32: string): string
// → HMAC-SHA1 based 6-digit code

// Password generator
export function generatePassword(options: { length: number; upper: boolean; lower: boolean; digits: boolean; symbols: boolean }): string

// Master key management
export async function initializeVault(password: string, email: string): Promise<{
  encryptedSymKey: string;
  encryptedPrivateKey: string;
  publicKey: string;
  passwordHash: string;
}>

export async function unlockVault(password: string, email: string, encryptedSymKey: string): Promise<CryptoKey>
// → Returns the sym_key for decrypting items
```

~300 lines. All crypto runs in browser via `window.crypto.subtle`.

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(vault): client-side Web Crypto library — PBKDF2, AES-GCM, RSA, TOTP"
```

---

### Task 8: API client + store + types

**Files:**
- Create: `client/src/types/vault.ts`
- Create: `client/src/lib/api/vault.ts`
- Create: `client/src/stores/vault-store.ts`

- [ ] **Step 1: Types**

All TypeScript interfaces matching the DB schema + decrypted variants.

- [ ] **Step 2: API client**

`vaultApi` with all 20 endpoint methods.

- [ ] **Step 3: Zustand store**

State: `locked: bool`, `symKey: CryptoKey | null`, `items: DecryptedVaultItem[]`, `folders: DecryptedFolder[]`, `sharedItems: DecryptedVaultItem[]`.

Actions: `unlock(password)`, `lock()`, `fetchAndDecryptItems()`, `createItem(plaintext)`, `updateItem(id, plaintext)`, `deleteItem(id)`, `shareItem(itemId, granteeId, level)`, `startBrowse(itemId)`.

The store handles: fetch ciphertext from API → decrypt with symKey → store plaintext in memory. On lock: clear all plaintext from memory.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(vault): frontend types, API client, Zustand store with encrypt/decrypt cycle"
```

---

## P5: Frontend UI

### Task 9: Vault page + list

**Files:**
- Create: `client/src/app/vault/page.tsx`
- Create: `client/src/components/vault/vault-list.tsx`
- Create: `client/src/components/vault/vault-unlock.tsx`

- [ ] **Step 1: Unlock dialog**

Modal that appears when vault is locked. Master password input → calls `store.unlock()`. Shows error on wrong password. Biometric hint (future).

- [ ] **Step 2: Vault page**

`/vault` with AppLayout. If locked → show VaultUnlock. If unlocked → show VaultList.
Header: search bar, "Nouveau" dropdown (Login, Note, Carte, Clé SSH, Token API, Identité), folder filter.

- [ ] **Step 3: Vault list**

Table/grid of items:
- Type icon (Key=login, StickyNote=note, CreditCard=card, Terminal=ssh, Code=api, User=identity, Shield=passkey)
- Name (decrypted), username preview, URI domain favicon
- Favorite star, folder badge
- "Partagé" badge if shared
- Click → opens detail/edit
- Actions: Copy password, Copy username, Open URI, Browse (if use_only available), Share, Delete

~400 lines.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(vault): main page with unlock dialog, item list with search/folders"
```

---

### Task 10: Item form + TOTP display

**Files:**
- Create: `client/src/components/vault/vault-item-form.tsx`
- Create: `client/src/components/vault/totp-display.tsx`

- [ ] **Step 1: Item form**

Adaptive form based on item_type:
- **Login**: username, password (show/hide toggle), URI(s), TOTP secret (with QR scan), notes
- **Secure note**: title, content (textarea)
- **Card**: cardholder, number (masked), expiry, CVV (masked), billing address
- **SSH key**: name, private key (textarea), public key, passphrase
- **API token**: service name, token (show/hide), endpoint URL, notes
- **Identity**: first/last name, email, phone, address, passport/ID number
- **Passkey**: relying party, credential ID, public key

Password field has: generate button, show/hide, strength indicator, copy.
All fields encrypted before save via vault-crypto.

~500 lines.

- [ ] **Step 2: TOTP display**

When item has totp_secret:
- Shows 6-digit code in large font
- Circular progress bar (30s countdown)
- Auto-refreshes every 30s
- Copy button
- Uses `generateTotp()` from vault-crypto.ts

~100 lines.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(vault): item form (7 types) + TOTP live display with countdown"
```

---

### Task 11: Share dialog + password generator

**Files:**
- Create: `client/src/components/vault/vault-share-dialog.tsx`
- Create: `client/src/components/vault/password-generator.tsx`

- [ ] **Step 1: Share dialog**

Dialog with:
- Share type: "Personne" / "Groupe" radio
- Person picker (search) or group picker (from org tree)
- Access level: `full` (green), `use_only` (amber), `read_only` (gray) with descriptions
- Expiration date (optional)
- "Partager" encrypts the item key with recipient's public key and calls API

~250 lines.

- [ ] **Step 2: Password generator**

Configurable generator with:
- Length slider (8-128, default 16)
- Toggles: uppercase, lowercase, digits, symbols
- Live preview
- Strength bar (weak/medium/strong/excellent)
- "Utiliser" button to fill the password field
- History of generated passwords (session only)

~200 lines.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(vault): share dialog (person/group/3 levels) + password generator"
```

---

### Task 12: Browse frame + sidebar link

**Files:**
- Create: `client/src/app/vault/browse/[token]/page.tsx`
- Modify: `client/src/components/layout/sidebar.tsx`

- [ ] **Step 1: Browse page**

Full-screen page (no AppLayout) that renders the proxied website:
- iframe pointing to `/proxy/vault/{token}`
- Top bar: site name, timer (remaining session time), "Terminer la session" button
- On close/timeout: calls DELETE browse session
- No access to actual credentials shown anywhere

~150 lines.

- [ ] **Step 2: Sidebar link**

Add to essentialNavItems:
```typescript
{ href: '/vault', icon: Shield, label: 'Coffre-fort', color: 'text-emerald-500', badgeKey: null },
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(vault): browse frame (use_only proxy) + sidebar link"
```
