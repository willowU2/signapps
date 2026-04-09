---
name: vault-debug
description: Use when debugging the Vault (encrypted personal safe) module. Spec at docs/product-specs/10-vault.md. Frontend exists (3 pages, 7 components), backend via signapps-storage encrypted bucket. 0 data-testids, 0 E2E tests. Key features: encrypted file storage, master password, biometric unlock, secure notes, password manager, auto-lock timeout.
---

# Vault — Debug Skill

## Source of truth
**`docs/product-specs/10-vault.md`**

## Code map
- **Frontend**: `client/src/app/vault/` (3 pages), `client/src/components/vault/` (7 components)
- **Backend**: Encrypted storage bucket via `signapps-storage` (port 3004) — no dedicated vault service
- **E2E**: 0 tests, 0 data-testids, no Page Object

## Key data-testids to add
`vault-root`, `vault-unlock-dialog`, `vault-master-password-input`, `vault-unlock-button`, `vault-file-list`, `vault-file-item-{id}`, `vault-upload-button`, `vault-new-note-button`, `vault-lock-button`, `vault-settings-button`

## Key journeys to test
1. Unlock vault with master password → see contents
2. Upload encrypted file → verify in list
3. Create secure note → verify saved
4. Lock vault → verify contents hidden
5. Auto-lock after timeout

## Common bug patterns (anticipated)
1. **Master password stored in memory after unlock** — must be zeroized on lock
2. **Encrypted files corrupt on re-encrypt** — test full round-trip
3. **Auto-lock timer resets on every click** — should only reset on real activity

## Dependencies
- **age** or **rage** (Apache-2.0/MIT) for encryption ✅
- **argon2** (MIT/Apache-2.0) for KDF ✅
- **WebCrypto API** for client-side crypto ✅

## Historique
- **2026-04-09** : Skill créé. Frontend 3 pages + 7 composants, 0 E2E, 0 testids.
