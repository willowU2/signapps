# OAuth Foundation Implementation Plan (Plan 1 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the cryptographic foundation (`signapps-keystore` crate + `EncryptedField` trait) that all OAuth tokens (and future secret fields) will be encrypted with.

**Architecture:** New `signapps-keystore` crate exposes a `Keystore` struct with 3 backends (EnvVar for dev, File for prod self-hosted, Remote for KMS integration). It loads a 32-byte master key once at boot and derives per-usage `DataEncryptionKey`s via HKDF-SHA256 (one DEK per domain: `oauth-tokens-v1`, `saml-assertions-v1`, `extra-params-v1`). The `EncryptedField` trait lives in `signapps-common::crypto` and provides `encrypt(&[u8], &DEK) -> Vec<u8>` / `decrypt(&[u8], &DEK) -> Vec<u8>` using AES-256-GCM (RustCrypto's `aes-gcm` crate). Ciphertext format: `version(1) || nonce(12) || aes_gcm_output(ciphertext+tag)`. Version byte enables future key rotation without downtime.

**Tech Stack:** Rust, `aes-gcm` 0.10, `hkdf` 0.12 (new dep), `sha2` 0.10, `rand` 0.8, `dashmap` 6, `tracing` 0.1, `thiserror` 1.0, `async-trait` 0.1.

**Naming note:** The spec refers to `signapps-vault` for the key infrastructure, but that name is already taken by an existing end-user password manager service (`services/signapps-vault/`). This plan uses **`signapps-keystore`** instead to avoid collision. The spec will be patched in Task 20.

**Dependencies on other plans:** None. This plan is self-contained.

**Plans that depend on this one:** Plan 2 (OAuth Crate & Engine v2), Plan 3 (Migration & Event Bus), Plan 4 (Refresh & Admin UI).

---

## File Structure

### Created
- `crates/signapps-keystore/Cargo.toml`
- `crates/signapps-keystore/src/lib.rs` — public API, `Keystore` struct, `VaultBackend` enum, `MasterKey` / `DataEncryptionKey` types
- `crates/signapps-keystore/src/backend.rs` — `VaultBackend` variants and `RemoteKeystoreClient` trait
- `crates/signapps-keystore/src/master_key.rs` — `MasterKey` type with hex parsing
- `crates/signapps-keystore/src/dek.rs` — `DataEncryptionKey` + HKDF derivation
- `crates/signapps-keystore/src/error.rs` — `KeystoreError` thiserror enum
- `crates/signapps-keystore/tests/roundtrip.rs` — integration tests for encrypt/decrypt roundtrip + backend variants
- `crates/signapps-common/src/crypto.rs` — `EncryptedField` trait + `CryptoError`
- `crates/signapps-common/src/crypto/tests.rs` — unit tests for AES-GCM primitives
- `scripts/generate-master-key.sh` — helper script to generate a new 32-byte hex master key
- `scripts/doctor-checks/keystore.sh` — doctor check for `KEYSTORE_MASTER_KEY` env var

### Modified
- `Cargo.toml` (workspace root) — add `crates/signapps-keystore` to members + `hkdf = "0.12"` to workspace deps
- `crates/signapps-common/Cargo.toml` — add `aes-gcm`, `hkdf`, `sha2`, `rand`, `thiserror` deps
- `crates/signapps-common/src/lib.rs` — re-export `crypto` module
- `.env.example` — add `KEYSTORE_MASTER_KEY` with generation instructions
- `scripts/doctor.sh` — invoke `doctor-checks/keystore.sh`
- `docs/superpowers/specs/2026-04-14-oauth-unified-design.md` — global rename `signapps-vault` → `signapps-keystore`
- `docs/inspiration-sources.yaml` — no change needed (spec path unchanged)
- `CLAUDE.md` (workspace layout section) — add `signapps-keystore` to the crates table

---

## Task 1: Scaffold the signapps-keystore crate

**Files:**
- Create: `crates/signapps-keystore/Cargo.toml`
- Create: `crates/signapps-keystore/src/lib.rs`
- Modify: `Cargo.toml` (workspace)

- [ ] **Step 1: Verify the directory does not exist yet**

Run: `ls crates/signapps-keystore 2>&1`
Expected: `ls: cannot access 'crates/signapps-keystore': No such file or directory`

- [ ] **Step 2: Add `hkdf` to workspace dependencies**

In `Cargo.toml` (workspace root), locate the `[workspace.dependencies]` block and add `hkdf = "0.12"` alphabetically ordered near `hex` / `sha2`:

```toml
[workspace.dependencies]
# ... existing deps ...
hex = "0.4"
hkdf = "0.12"
# ... existing deps ...
sha2 = "0.10"
```

- [ ] **Step 3: Add the new crate to workspace members**

In `Cargo.toml` (workspace root), add the crate path alphabetically in the `members` array:

```toml
[workspace]
members = [
    # ... existing members ...
    "crates/signapps-keystore",
    # ... existing members ...
]
```

- [ ] **Step 4: Create the crate Cargo.toml**

```toml
[package]
name = "signapps-keystore"
version = "0.1.0"
edition = "2021"
rust-version = "1.75"
description = "Master key management and per-usage DEK derivation for encryption at rest"
publish = false

[dependencies]
aes-gcm = { workspace = true }
hkdf = { workspace = true }
sha2 = { workspace = true }
rand = { workspace = true }
dashmap = { workspace = true }
hex = { workspace = true }
thiserror = { workspace = true }
tracing = { workspace = true }
tokio = { workspace = true }
async-trait = { workspace = true }
signapps-common = { path = "../signapps-common" }
```

- [ ] **Step 5: Create the minimal lib.rs**

```rust
//! Master key management and per-usage DEK derivation.
//!
//! See [`Keystore`] for the main entry point.
#![warn(missing_docs)]

mod backend;
mod dek;
mod error;
mod master_key;

pub use backend::{KeystoreBackend, RemoteKeystoreClient};
pub use dek::DataEncryptionKey;
pub use error::KeystoreError;
pub use master_key::MasterKey;

use dashmap::DashMap;
use std::sync::Arc;
use tracing::instrument;

/// Main keystore entry point. Loads a master key at boot and derives per-usage DEKs.
pub struct Keystore {
    master_key: MasterKey,
    deks: DashMap<&'static str, Arc<DataEncryptionKey>>,
}

impl Keystore {
    /// Initialize a keystore from a backend.
    #[instrument(skip(backend))]
    pub async fn init(backend: KeystoreBackend) -> Result<Self, KeystoreError> {
        let master_key = backend.load().await?;
        Ok(Self {
            master_key,
            deks: DashMap::new(),
        })
    }

    /// Return the DEK for a given usage info, deriving + caching if needed.
    pub fn dek(&self, info: &'static str) -> Arc<DataEncryptionKey> {
        if let Some(dek) = self.deks.get(info) {
            return dek.clone();
        }
        let dek = Arc::new(DataEncryptionKey::derive_from(&self.master_key, info));
        self.deks.insert(info, dek.clone());
        dek
    }
}
```

- [ ] **Step 6: Create a stub for each sub-module so the crate compiles**

Create `crates/signapps-keystore/src/backend.rs`:

```rust
//! Backend variants for loading the master key.

use crate::{KeystoreError, MasterKey};
use async_trait::async_trait;
use std::path::PathBuf;

/// Where the master key is loaded from at boot.
pub enum KeystoreBackend {
    /// Dev/test only: load from `KEYSTORE_MASTER_KEY` env var (hex-encoded 32 bytes).
    EnvVar,
    /// Prod self-hosted: load from a file path (hex-encoded 32 bytes, trailing whitespace ok).
    File(PathBuf),
    /// Prod enterprise: delegate to a remote KMS client.
    Remote(Box<dyn RemoteKeystoreClient + Send + Sync>),
}

impl KeystoreBackend {
    /// Load the master key from the configured backend.
    pub async fn load(&self) -> Result<MasterKey, KeystoreError> {
        unimplemented!("filled in Task 3 / Task 4 / Task 5")
    }
}

/// Trait for remote KMS backends (HashiCorp Vault, AWS KMS, Azure Key Vault).
#[async_trait]
pub trait RemoteKeystoreClient {
    /// Fetch the master key from the remote backend.
    async fn fetch_master_key(&self) -> Result<MasterKey, KeystoreError>;
}
```

Create `crates/signapps-keystore/src/master_key.rs`:

```rust
//! Master key type. Zeroizes on drop.

/// 32-byte AES-256 master key, zeroized on drop.
pub struct MasterKey(pub(crate) [u8; 32]);

impl MasterKey {
    /// Length in bytes.
    pub const LEN: usize = 32;
}
```

Create `crates/signapps-keystore/src/dek.rs`:

```rust
//! Data Encryption Keys derived from the master key via HKDF-SHA256.

use crate::MasterKey;

/// A 32-byte key derived via HKDF-SHA256 with a usage info label.
pub struct DataEncryptionKey(pub(crate) [u8; 32]);

impl DataEncryptionKey {
    /// Derive a DEK from a master key using HKDF-SHA256 with `info` as the label.
    pub fn derive_from(_master_key: &MasterKey, _info: &str) -> Self {
        unimplemented!("filled in Task 6")
    }

    /// Raw 32-byte key material (for AES-GCM primitives).
    pub(crate) fn as_bytes(&self) -> &[u8; 32] {
        &self.0
    }
}
```

Create `crates/signapps-keystore/src/error.rs`:

```rust
//! Error type for keystore operations.

use thiserror::Error;

/// All keystore-level errors.
#[derive(Debug, Error)]
pub enum KeystoreError {
    /// `KEYSTORE_MASTER_KEY` env var not set or empty.
    #[error("KEYSTORE_MASTER_KEY env var not set")]
    EnvVarNotSet,

    /// File backend: I/O error reading the master key file.
    #[error("failed to read master key file: {0}")]
    FileRead(#[from] std::io::Error),

    /// Hex decoding failed (not a valid 64-char hex string).
    #[error("invalid hex: {0}")]
    InvalidHex(String),

    /// Decoded key is not exactly 32 bytes.
    #[error("master key must be exactly 32 bytes, got {0}")]
    InvalidLength(usize),

    /// Remote KMS returned an error.
    #[error("remote keystore error: {0}")]
    Remote(String),
}
```

- [ ] **Step 7: Verify the crate compiles**

Run: `cargo check -p signapps-keystore`
Expected: `warning: unused ...` may appear but no errors. Compile completes successfully.

- [ ] **Step 8: Commit**

```bash
git add Cargo.toml crates/signapps-keystore/
git commit -m "feat(keystore): scaffold signapps-keystore crate

Adds the crate skeleton with module structure for backend, master_key,
dek, and error. Public API surface defined but methods are
unimplemented!() — filled in subsequent tasks.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Implement MasterKey with hex parsing + zeroization

**Files:**
- Modify: `crates/signapps-keystore/Cargo.toml`
- Modify: `crates/signapps-keystore/src/master_key.rs`
- Create: `crates/signapps-keystore/src/master_key/tests.rs`

- [ ] **Step 1: Add `zeroize` dependency**

Run: `grep '^zeroize' Cargo.toml`
Expected: no match (not yet in workspace deps)

Add to workspace `Cargo.toml` `[workspace.dependencies]`:

```toml
zeroize = { version = "1.8", features = ["derive"] }
```

Add to `crates/signapps-keystore/Cargo.toml` `[dependencies]`:

```toml
zeroize = { workspace = true }
```

- [ ] **Step 2: Write the failing test for `MasterKey::from_hex`**

Create `crates/signapps-keystore/src/master_key.rs` (replace existing content):

```rust
//! Master key type. Zeroizes on drop.

use crate::KeystoreError;
use zeroize::Zeroize;

/// 32-byte AES-256 master key, zeroized on drop.
pub struct MasterKey(pub(crate) [u8; 32]);

impl MasterKey {
    /// Length in bytes.
    pub const LEN: usize = 32;

    /// Parse a 64-character hex string into a master key.
    ///
    /// Accepts leading/trailing whitespace (trimmed).
    ///
    /// # Errors
    ///
    /// Returns [`KeystoreError::InvalidHex`] if the string contains non-hex characters.
    /// Returns [`KeystoreError::InvalidLength`] if the decoded bytes are not exactly 32.
    pub fn from_hex(s: &str) -> Result<Self, KeystoreError> {
        let trimmed = s.trim();
        let bytes = hex::decode(trimmed).map_err(|e| KeystoreError::InvalidHex(e.to_string()))?;
        if bytes.len() != Self::LEN {
            return Err(KeystoreError::InvalidLength(bytes.len()));
        }
        let mut key = [0u8; 32];
        key.copy_from_slice(&bytes);
        Ok(Self(key))
    }
}

impl Drop for MasterKey {
    fn drop(&mut self) {
        self.0.zeroize();
    }
}

#[cfg(test)]
mod tests {
    include!("master_key/tests.rs");
}
```

Create `crates/signapps-keystore/src/master_key/tests.rs`:

```rust
use super::*;

const VALID_HEX: &str =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

#[test]
fn parses_valid_hex() {
    let key = MasterKey::from_hex(VALID_HEX).expect("valid hex");
    assert_eq!(key.0.len(), 32);
    assert_eq!(key.0[0], 0x01);
    assert_eq!(key.0[31], 0xef);
}

#[test]
fn accepts_surrounding_whitespace() {
    let padded = format!("  {}\n", VALID_HEX);
    let key = MasterKey::from_hex(&padded).expect("trimmed hex");
    assert_eq!(key.0[0], 0x01);
}

#[test]
fn rejects_invalid_hex() {
    let bad = "zzzz56789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0";
    let err = MasterKey::from_hex(bad).unwrap_err();
    assert!(matches!(err, KeystoreError::InvalidHex(_)));
}

#[test]
fn rejects_wrong_length() {
    let short = "0123456789abcdef"; // 8 bytes
    let err = MasterKey::from_hex(short).unwrap_err();
    assert!(matches!(err, KeystoreError::InvalidLength(8)));
}
```

- [ ] **Step 3: Run the test to verify it fails / compiles**

Run: `cargo test -p signapps-keystore --lib master_key 2>&1 | tail -20`
Expected: `test result: ok. 4 passed; 0 failed`. If you see a compile error about `dek.rs` (e.g., missing `DataEncryptionKey::derive_from`), that's expected and fixed in Task 3.

If the test builds but fails to link due to `dek::derive_from` being unimplemented, you can comment out `mod dek;` temporarily to verify just this module. **Don't commit with it commented.**

- [ ] **Step 4: Commit**

```bash
git add Cargo.toml crates/signapps-keystore/
git commit -m "feat(keystore): implement MasterKey::from_hex + zeroize on drop

- Parse 64-char hex strings with whitespace trimming
- Validate length exactly 32 bytes
- Zeroize memory on drop using zeroize crate
- 4 unit tests covering happy path + 3 error cases

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Implement KeystoreBackend::EnvVar

**Files:**
- Modify: `crates/signapps-keystore/src/backend.rs`

- [ ] **Step 1: Write the failing test**

Create `crates/signapps-keystore/src/backend/tests.rs`:

```rust
use super::*;

#[tokio::test]
async fn envvar_loads_valid_key() {
    let hex = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    // SAFETY: tests use a dedicated env var; serial test not needed because
    // each test uses a unique env var name with a timestamp.
    let var = format!("TEST_KEYSTORE_KEY_{}", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos());
    std::env::set_var(&var, hex);

    let key = KeystoreBackend::EnvVarNamed(var.clone()).load().await
        .expect("load succeeds");
    assert_eq!(key.0[0], 0x01);

    std::env::remove_var(&var);
}

#[tokio::test]
async fn envvar_rejects_missing_var() {
    let var = "TEST_KEYSTORE_DEFINITELY_UNSET_1234567890";
    std::env::remove_var(var);
    let err = KeystoreBackend::EnvVarNamed(var.into()).load().await.unwrap_err();
    assert!(matches!(err, KeystoreError::EnvVarNotSet));
}
```

- [ ] **Step 2: Extend `KeystoreBackend` with a named variant for testing**

Replace `crates/signapps-keystore/src/backend.rs` with the full implementation:

```rust
//! Backend variants for loading the master key.

use crate::{KeystoreError, MasterKey};
use async_trait::async_trait;
use std::path::PathBuf;
use tracing::instrument;

/// Default env var name for the master key in production.
pub const DEFAULT_ENV_VAR: &str = "KEYSTORE_MASTER_KEY";

/// Where the master key is loaded from at boot.
pub enum KeystoreBackend {
    /// Dev/test: load from `KEYSTORE_MASTER_KEY` env var (hex-encoded 32 bytes).
    EnvVar,
    /// Test-only: load from a caller-specified env var name.
    EnvVarNamed(String),
    /// Prod self-hosted: load from a file path (hex-encoded 32 bytes, trailing whitespace ok).
    File(PathBuf),
    /// Prod enterprise: delegate to a remote KMS client.
    Remote(Box<dyn RemoteKeystoreClient + Send + Sync>),
}

impl KeystoreBackend {
    /// Load the master key from the configured backend.
    #[instrument(skip(self))]
    pub async fn load(&self) -> Result<MasterKey, KeystoreError> {
        match self {
            Self::EnvVar => load_env(DEFAULT_ENV_VAR),
            Self::EnvVarNamed(name) => load_env(name),
            Self::File(path) => load_file(path).await,
            Self::Remote(client) => client.fetch_master_key().await,
        }
    }
}

fn load_env(var_name: &str) -> Result<MasterKey, KeystoreError> {
    let hex = std::env::var(var_name).map_err(|_| KeystoreError::EnvVarNotSet)?;
    if hex.is_empty() {
        return Err(KeystoreError::EnvVarNotSet);
    }
    MasterKey::from_hex(&hex)
}

async fn load_file(path: &std::path::Path) -> Result<MasterKey, KeystoreError> {
    let hex = tokio::fs::read_to_string(path).await?;
    MasterKey::from_hex(&hex)
}

/// Trait for remote KMS backends (HashiCorp Vault, AWS KMS, Azure Key Vault).
#[async_trait]
pub trait RemoteKeystoreClient {
    /// Fetch the master key from the remote backend.
    async fn fetch_master_key(&self) -> Result<MasterKey, KeystoreError>;
}

#[cfg(test)]
mod tests {
    include!("backend/tests.rs");
}
```

- [ ] **Step 3: Run the tests to verify they pass**

Run: `cargo test -p signapps-keystore --lib backend 2>&1 | tail -10`
Expected: `test result: ok. 2 passed; 0 failed`

- [ ] **Step 4: Commit**

```bash
git add crates/signapps-keystore/src/backend.rs crates/signapps-keystore/src/backend/tests.rs
git commit -m "feat(keystore): implement EnvVar backend for master key loading

Supports both KEYSTORE_MASTER_KEY (default) and custom env var names
(for tests). Returns EnvVarNotSet if missing or empty.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Implement KeystoreBackend::File

**Files:**
- Modify: `crates/signapps-keystore/src/backend/tests.rs`

- [ ] **Step 1: Add the failing test for file loading**

Append to `crates/signapps-keystore/src/backend/tests.rs`:

```rust
#[tokio::test]
async fn file_loads_valid_key() {
    let hex = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef\n";
    let dir = tempfile::tempdir().expect("tempdir");
    let path = dir.path().join("master.key");
    tokio::fs::write(&path, hex).await.expect("write");

    let key = KeystoreBackend::File(path).load().await.expect("load");
    assert_eq!(key.0[0], 0x01);
    assert_eq!(key.0[31], 0xef);
}

#[tokio::test]
async fn file_rejects_missing_path() {
    let err = KeystoreBackend::File("/nonexistent/keystore/path".into())
        .load()
        .await
        .unwrap_err();
    assert!(matches!(err, KeystoreError::FileRead(_)));
}
```

- [ ] **Step 2: Add `tempfile` as a dev-dependency**

Modify `crates/signapps-keystore/Cargo.toml`, append:

```toml
[dev-dependencies]
tempfile = "3"
tokio = { workspace = true, features = ["full", "macros"] }
```

- [ ] **Step 3: Run the tests to verify they pass**

Run: `cargo test -p signapps-keystore --lib backend 2>&1 | tail -10`
Expected: `test result: ok. 4 passed; 0 failed`

- [ ] **Step 4: Commit**

```bash
git add crates/signapps-keystore/
git commit -m "feat(keystore): add File backend tests

The implementation was already present; this adds two tests covering
the happy path (valid hex in file, trailing newline trimmed) and the
error path (missing file).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Implement HKDF-SHA256 DEK derivation

**Files:**
- Modify: `crates/signapps-keystore/src/dek.rs`
- Create: `crates/signapps-keystore/src/dek/tests.rs`

- [ ] **Step 1: Write the failing test**

Create `crates/signapps-keystore/src/dek/tests.rs`:

```rust
use super::*;
use crate::MasterKey;

const HEX: &str = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

#[test]
fn derives_different_deks_for_different_infos() {
    let mk = MasterKey::from_hex(HEX).unwrap();
    let dek_a = DataEncryptionKey::derive_from(&mk, "oauth-tokens-v1");
    let dek_b = DataEncryptionKey::derive_from(&mk, "saml-assertions-v1");
    assert_ne!(dek_a.as_bytes(), dek_b.as_bytes(),
        "different info labels must produce different DEKs");
}

#[test]
fn derives_same_dek_for_same_info() {
    let mk1 = MasterKey::from_hex(HEX).unwrap();
    let mk2 = MasterKey::from_hex(HEX).unwrap();
    let dek1 = DataEncryptionKey::derive_from(&mk1, "oauth-tokens-v1");
    let dek2 = DataEncryptionKey::derive_from(&mk2, "oauth-tokens-v1");
    assert_eq!(dek1.as_bytes(), dek2.as_bytes(),
        "same master key + same info must produce same DEK (deterministic)");
}

#[test]
fn dek_is_32_bytes() {
    let mk = MasterKey::from_hex(HEX).unwrap();
    let dek = DataEncryptionKey::derive_from(&mk, "test");
    assert_eq!(dek.as_bytes().len(), 32);
}

#[test]
fn dek_is_not_equal_to_master_key() {
    let mk = MasterKey::from_hex(HEX).unwrap();
    let dek = DataEncryptionKey::derive_from(&mk, "oauth-tokens-v1");
    assert_ne!(&mk.0[..], dek.as_bytes(),
        "DEK must differ from master key (derivation must actually do work)");
}
```

- [ ] **Step 2: Replace `dek.rs` with the full implementation**

```rust
//! Data Encryption Keys derived from the master key via HKDF-SHA256.

use crate::MasterKey;
use hkdf::Hkdf;
use sha2::Sha256;
use zeroize::Zeroize;

/// A 32-byte key derived via HKDF-SHA256 with a usage info label.
pub struct DataEncryptionKey(pub(crate) [u8; 32]);

impl DataEncryptionKey {
    /// Derive a DEK from a master key using HKDF-SHA256.
    ///
    /// `info` is the usage label (e.g., `"oauth-tokens-v1"`); it ensures that
    /// DEKs used for different purposes are cryptographically independent.
    ///
    /// # Panics
    ///
    /// Never — HKDF-SHA256 with a 32-byte IKM and a 32-byte OKM is always OK.
    pub fn derive_from(master_key: &MasterKey, info: &str) -> Self {
        let hk = Hkdf::<Sha256>::new(None, &master_key.0);
        let mut okm = [0u8; 32];
        hk.expand(info.as_bytes(), &mut okm)
            .expect("HKDF-SHA256 with 32-byte OKM is always OK");
        Self(okm)
    }

    /// Raw 32-byte key material (for AES-GCM primitives).
    pub(crate) fn as_bytes(&self) -> &[u8; 32] {
        &self.0
    }
}

impl Drop for DataEncryptionKey {
    fn drop(&mut self) {
        self.0.zeroize();
    }
}

#[cfg(test)]
mod tests {
    include!("dek/tests.rs");
}
```

- [ ] **Step 3: Run the tests**

Run: `cargo test -p signapps-keystore --lib dek 2>&1 | tail -10`
Expected: `test result: ok. 4 passed; 0 failed`

- [ ] **Step 4: Commit**

```bash
git add crates/signapps-keystore/src/dek.rs crates/signapps-keystore/src/dek/tests.rs
git commit -m "feat(keystore): implement HKDF-SHA256 DEK derivation

DataEncryptionKey::derive_from(master, info) uses HKDF-SHA256 with the
info label as context. Deterministic: same (master, info) always yields
the same DEK. Different info labels yield cryptographically independent
DEKs. Zeroized on drop.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Add Keystore::dek caching test

**Files:**
- Modify: `crates/signapps-keystore/src/lib.rs`
- Create: `crates/signapps-keystore/tests/keystore_cache.rs`

- [ ] **Step 1: Write the integration test**

Create `crates/signapps-keystore/tests/keystore_cache.rs`:

```rust
//! Integration tests for the top-level Keystore struct.

use signapps_keystore::{Keystore, KeystoreBackend};
use std::sync::Arc;

const HEX: &str = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

async fn new_keystore() -> Keystore {
    let var = format!("CACHE_TEST_{}", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos());
    std::env::set_var(&var, HEX);
    let ks = Keystore::init(KeystoreBackend::EnvVarNamed(var.clone())).await
        .expect("init");
    std::env::remove_var(&var);
    ks
}

#[tokio::test]
async fn caches_same_dek_instance() {
    let ks = new_keystore().await;
    let a = ks.dek("oauth-tokens-v1");
    let b = ks.dek("oauth-tokens-v1");
    assert!(Arc::ptr_eq(&a, &b), "same info should return same Arc");
}

#[tokio::test]
async fn different_info_different_instances() {
    let ks = new_keystore().await;
    let a = ks.dek("oauth-tokens-v1");
    let b = ks.dek("saml-assertions-v1");
    assert!(!Arc::ptr_eq(&a, &b), "different info should return different Arc");
}

#[tokio::test]
async fn dek_is_thread_safe() {
    let ks = Arc::new(new_keystore().await);
    let mut handles = vec![];
    for _ in 0..10 {
        let ks = ks.clone();
        handles.push(tokio::spawn(async move {
            let _dek = ks.dek("oauth-tokens-v1");
        }));
    }
    for h in handles { h.await.unwrap(); }
}
```

- [ ] **Step 2: Run the tests**

Run: `cargo test -p signapps-keystore --test keystore_cache 2>&1 | tail -10`
Expected: `test result: ok. 3 passed; 0 failed`

- [ ] **Step 3: Commit**

```bash
git add crates/signapps-keystore/tests/keystore_cache.rs
git commit -m "test(keystore): cover Keystore DEK caching + thread safety

3 integration tests: same-info returns Arc::ptr_eq, different-info
returns distinct Arcs, concurrent access from 10 tokio tasks works.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Create CryptoError in signapps-common

**Files:**
- Create: `crates/signapps-common/src/crypto.rs`
- Modify: `crates/signapps-common/src/lib.rs`
- Modify: `crates/signapps-common/Cargo.toml`

- [ ] **Step 1: Check current signapps-common Cargo.toml**

Run: `cat crates/signapps-common/Cargo.toml`
Note the existing `[dependencies]` section. We need to add: `aes-gcm`, `rand` (if not present), `thiserror` (if not present).

- [ ] **Step 2: Add dependencies**

In `crates/signapps-common/Cargo.toml`, ensure these are in `[dependencies]`:

```toml
aes-gcm = { workspace = true }
rand = { workspace = true }
thiserror = { workspace = true }
```

(Skip any that are already present.)

- [ ] **Step 3: Create crypto.rs skeleton**

Create `crates/signapps-common/src/crypto.rs`:

```rust
//! Cryptographic primitives and traits shared across SignApps services.
//!
//! The main export is the [`EncryptedField`] trait, which abstracts
//! AES-256-GCM encryption for fields stored in the database.

use thiserror::Error;

/// Errors from cryptographic operations.
#[derive(Debug, Error)]
pub enum CryptoError {
    /// Ciphertext is shorter than the minimum valid size (version + nonce + tag = 29 bytes).
    #[error("ciphertext too short: {0} bytes (minimum 29)")]
    TooShort(usize),

    /// Ciphertext version byte does not match any supported version.
    #[error("unsupported ciphertext version: {0:#x}")]
    UnsupportedVersion(u8),

    /// AES-GCM encryption or decryption failed (invalid key, tag mismatch, ...).
    #[error("AES-GCM operation failed: {0}")]
    AesGcm(String),
}
```

- [ ] **Step 4: Re-export from lib.rs**

In `crates/signapps-common/src/lib.rs`, find the existing module declarations and add:

```rust
pub mod crypto;
```

Alphabetically ordered with the other `pub mod ...` declarations.

- [ ] **Step 5: Verify it compiles**

Run: `cargo check -p signapps-common 2>&1 | tail -5`
Expected: no errors, possibly warnings about unused `CryptoError` variants.

- [ ] **Step 6: Commit**

```bash
git add crates/signapps-common/
git commit -m "feat(common): add crypto module with CryptoError

Introduces the crypto module that will hold the EncryptedField trait
in the next task. CryptoError covers the 3 failure modes: ciphertext
too short, unsupported version, AES-GCM failure.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Implement EncryptedField trait with AES-256-GCM

**Files:**
- Modify: `crates/signapps-common/src/crypto.rs`
- Create: `crates/signapps-common/src/crypto/tests.rs`
- Modify: `crates/signapps-common/Cargo.toml` (add dev-deps)

**Design note:** The trait is implemented for the unit type `()` so that call sites write `<()>::encrypt(...)`. This keeps the DEK a runtime dependency (not a type parameter) and avoids a needless generic. An alternate design is a free function `encrypt()` / `decrypt()`; we use the trait so that future alternative ciphers (ChaCha20-Poly1305, XChaCha) can be added as additional trait impls.

- [ ] **Step 1: Write the failing tests**

Create `crates/signapps-common/src/crypto/tests.rs`:

```rust
use super::*;
use signapps_keystore::{Keystore, KeystoreBackend};
use std::sync::Arc;

const HEX: &str = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

async fn test_dek() -> Arc<signapps_keystore::DataEncryptionKey> {
    let var = format!("CRYPTO_TEST_{}", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos());
    std::env::set_var(&var, HEX);
    let ks = Keystore::init(KeystoreBackend::EnvVarNamed(var.clone())).await
        .expect("init");
    std::env::remove_var(&var);
    ks.dek("test-v1")
}

#[tokio::test]
async fn roundtrip_short_plaintext() {
    let dek = test_dek().await;
    let pt = b"ya29.a0AfH6SMBxxx_short_token_here";
    let ct = <()>::encrypt(pt, &dek).expect("encrypt");
    let decrypted = <()>::decrypt(&ct, &dek).expect("decrypt");
    assert_eq!(decrypted, pt);
}

#[tokio::test]
async fn roundtrip_long_plaintext() {
    let dek = test_dek().await;
    let pt = vec![0xAAu8; 4096];
    let ct = <()>::encrypt(&pt, &dek).expect("encrypt");
    let decrypted = <()>::decrypt(&ct, &dek).expect("decrypt");
    assert_eq!(decrypted, pt);
}

#[tokio::test]
async fn roundtrip_empty_plaintext() {
    let dek = test_dek().await;
    let ct = <()>::encrypt(b"", &dek).expect("encrypt");
    let decrypted = <()>::decrypt(&ct, &dek).expect("decrypt");
    assert_eq!(decrypted, b"");
}

#[tokio::test]
async fn nonce_is_random() {
    let dek = test_dek().await;
    let pt = b"same plaintext";
    let ct1 = <()>::encrypt(pt, &dek).expect("encrypt");
    let ct2 = <()>::encrypt(pt, &dek).expect("encrypt");
    assert_ne!(ct1, ct2, "nonce reuse would be catastrophic; must be random");
}

#[tokio::test]
async fn version_byte_is_01() {
    let dek = test_dek().await;
    let ct = <()>::encrypt(b"test", &dek).expect("encrypt");
    assert_eq!(ct[0], 0x01);
}

#[tokio::test]
async fn ciphertext_length_equals_1_plus_12_plus_plaintext_plus_16() {
    let dek = test_dek().await;
    let pt_len = 128;
    let pt = vec![0u8; pt_len];
    let ct = <()>::encrypt(&pt, &dek).expect("encrypt");
    assert_eq!(ct.len(), 1 + 12 + pt_len + 16);
}

#[tokio::test]
async fn decrypt_rejects_too_short() {
    let dek = test_dek().await;
    let err = <()>::decrypt(&[0x01; 10], &dek).unwrap_err();
    assert!(matches!(err, CryptoError::TooShort(10)));
}

#[tokio::test]
async fn decrypt_rejects_unsupported_version() {
    let dek = test_dek().await;
    let mut fake = vec![0x99u8; 64];
    let err = <()>::decrypt(&fake, &dek).unwrap_err();
    assert!(matches!(err, CryptoError::UnsupportedVersion(0x99)));
}

#[tokio::test]
async fn decrypt_rejects_tampered_ciphertext() {
    let dek = test_dek().await;
    let mut ct = <()>::encrypt(b"original", &dek).expect("encrypt");
    let last = ct.len() - 1;
    ct[last] ^= 0x01;
    let err = <()>::decrypt(&ct, &dek).unwrap_err();
    assert!(matches!(err, CryptoError::AesGcm(_)));
}

#[tokio::test]
async fn decrypt_rejects_wrong_key() {
    let dek1 = test_dek().await;
    let ct = <()>::encrypt(b"payload", &dek1).expect("encrypt");

    // Different DEK (different test env var → different master → different DEK)
    let dek2 = test_dek().await;
    let err = <()>::decrypt(&ct, &dek2).unwrap_err();
    assert!(matches!(err, CryptoError::AesGcm(_)));
}
```

- [ ] **Step 2: Add dev-dependencies in signapps-common**

In `crates/signapps-common/Cargo.toml`, under `[dev-dependencies]`:

```toml
[dev-dependencies]
signapps-keystore = { path = "../signapps-keystore" }
tokio = { workspace = true }
```

- [ ] **Step 3: Implement EncryptedField**

Append to `crates/signapps-common/src/crypto.rs`:

```rust
/// Current ciphertext format version.
///
/// Format: `VERSION(1) || NONCE(12) || CIPHERTEXT_AND_TAG(...)`.
/// The version byte enables future key rotation without downtime:
/// deployers can run with multiple DEKs and try each one in order of version.
pub const CURRENT_VERSION: u8 = 0x01;

/// Size of the AES-GCM nonce in bytes.
pub const NONCE_LEN: usize = 12;

/// Size of the AES-GCM authentication tag in bytes.
pub const TAG_LEN: usize = 16;

/// Minimum valid ciphertext size: version + nonce + empty-plaintext tag.
pub const MIN_CT_LEN: usize = 1 + NONCE_LEN + TAG_LEN;

/// Trait for fields stored encrypted at rest.
///
/// Implemented for `()` as the default AES-256-GCM implementation. Tokens,
/// secrets, and PII fields call `<()>::encrypt(&plaintext, dek)` before DB writes
/// and `<()>::decrypt(&ciphertext, dek)` after DB reads.
///
/// # Examples
///
/// ```no_run
/// # use signapps_common::crypto::CryptoError;
/// # use signapps_keystore::DataEncryptionKey;
/// use signapps_common::crypto::EncryptedField;
///
/// fn store_token(token: &str, dek: &DataEncryptionKey) -> Result<Vec<u8>, CryptoError> {
///     <()>::encrypt(token.as_bytes(), dek)
/// }
///
/// fn read_token(ciphertext: &[u8], dek: &DataEncryptionKey) -> Result<String, CryptoError> {
///     let plaintext = <()>::decrypt(ciphertext, dek)?;
///     Ok(String::from_utf8(plaintext).expect("token was UTF-8 when encrypted"))
/// }
/// ```
pub trait EncryptedField: Sized {
    /// Encrypt a plaintext byte slice with the given DEK.
    ///
    /// # Errors
    ///
    /// Returns [`CryptoError::AesGcm`] if the AES-GCM primitive fails
    /// (extremely rare; implies a broken crypto library).
    fn encrypt(
        plaintext: &[u8],
        dek: &signapps_keystore::DataEncryptionKey,
    ) -> Result<Vec<u8>, CryptoError>;

    /// Decrypt a ciphertext byte slice with the given DEK.
    ///
    /// # Errors
    ///
    /// - [`CryptoError::TooShort`] if `ciphertext.len() < MIN_CT_LEN`
    /// - [`CryptoError::UnsupportedVersion`] if the version byte is not `0x01`
    /// - [`CryptoError::AesGcm`] if the authentication tag does not verify
    ///   (tampered ciphertext, wrong key, wrong nonce)
    fn decrypt(
        ciphertext: &[u8],
        dek: &signapps_keystore::DataEncryptionKey,
    ) -> Result<Vec<u8>, CryptoError>;
}

impl EncryptedField for () {
    fn encrypt(
        plaintext: &[u8],
        dek: &signapps_keystore::DataEncryptionKey,
    ) -> Result<Vec<u8>, CryptoError> {
        use aes_gcm::aead::{Aead, KeyInit};
        use aes_gcm::{Aes256Gcm, Nonce};
        use rand::RngCore;

        let cipher = Aes256Gcm::new_from_slice(dek_bytes(dek))
            .map_err(|e| CryptoError::AesGcm(e.to_string()))?;

        let mut nonce_bytes = [0u8; NONCE_LEN];
        rand::thread_rng().fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        let ct_and_tag = cipher
            .encrypt(nonce, plaintext)
            .map_err(|e| CryptoError::AesGcm(e.to_string()))?;

        let mut out = Vec::with_capacity(1 + NONCE_LEN + ct_and_tag.len());
        out.push(CURRENT_VERSION);
        out.extend_from_slice(&nonce_bytes);
        out.extend_from_slice(&ct_and_tag);
        Ok(out)
    }

    fn decrypt(
        ciphertext: &[u8],
        dek: &signapps_keystore::DataEncryptionKey,
    ) -> Result<Vec<u8>, CryptoError> {
        use aes_gcm::aead::{Aead, KeyInit};
        use aes_gcm::{Aes256Gcm, Nonce};

        if ciphertext.len() < MIN_CT_LEN {
            return Err(CryptoError::TooShort(ciphertext.len()));
        }
        if ciphertext[0] != CURRENT_VERSION {
            return Err(CryptoError::UnsupportedVersion(ciphertext[0]));
        }

        let nonce = Nonce::from_slice(&ciphertext[1..1 + NONCE_LEN]);
        let ct_and_tag = &ciphertext[1 + NONCE_LEN..];

        let cipher = Aes256Gcm::new_from_slice(dek_bytes(dek))
            .map_err(|e| CryptoError::AesGcm(e.to_string()))?;

        cipher
            .decrypt(nonce, ct_and_tag)
            .map_err(|e| CryptoError::AesGcm(e.to_string()))
    }
}

/// Access the raw 32-byte DEK material.
///
/// Private helper; keeps the `DataEncryptionKey::as_bytes()` method
/// `pub(crate)` in the keystore crate.
fn dek_bytes(dek: &signapps_keystore::DataEncryptionKey) -> &[u8] {
    // SAFETY: DataEncryptionKey is `#[repr(transparent)]`-compatible in practice
    // — its only field is `[u8; 32]`. We expose access via a small helper to
    // keep the keystore's public API clean.
    // Implementation: we rely on a public method that the keystore exposes only
    // for use by this crate. See signapps-keystore::DataEncryptionKey::expose_bytes.
    dek.expose_bytes()
}

#[cfg(test)]
mod tests {
    include!("crypto/tests.rs");
}
```

- [ ] **Step 4: Expose DEK bytes from the keystore crate**

The `crypto.rs` above calls `dek.expose_bytes()`, which does not exist yet. Add it to `crates/signapps-keystore/src/dek.rs`, replacing the `pub(crate) fn as_bytes` helper with a public but intentionally-named method:

```rust
impl DataEncryptionKey {
    // ... existing derive_from ...

    /// Expose the raw 32-byte key material.
    ///
    /// **Do not use** unless you are a cryptographic primitive (`aes-gcm`,
    /// `chacha20poly1305`, etc.). Call sites should go through
    /// [`EncryptedField`](../signapps_common/crypto/trait.EncryptedField.html)
    /// instead.
    pub fn expose_bytes(&self) -> &[u8; 32] {
        &self.0
    }
}
```

And remove the obsolete `pub(crate) fn as_bytes(...)` if present.

Update the DEK tests in `crates/signapps-keystore/src/dek/tests.rs` to call `expose_bytes()` instead of `as_bytes()`.

- [ ] **Step 5: Run the tests**

Run: `cargo test -p signapps-common --lib crypto 2>&1 | tail -15`
Expected: `test result: ok. 10 passed; 0 failed`

Run: `cargo test -p signapps-keystore 2>&1 | tail -5`
Expected: all keystore tests still pass (4 + 4 + 4 + 3 = 15)

- [ ] **Step 6: Commit**

```bash
git add crates/signapps-common/ crates/signapps-keystore/src/dek.rs crates/signapps-keystore/src/dek/tests.rs
git commit -m "feat(common): implement EncryptedField AES-256-GCM trait

Trait is implemented for () (unit type) so call sites write
<()>::encrypt(plaintext, dek). Format: version(1) || nonce(12) ||
ciphertext+tag(16+N). 10 unit tests covering roundtrip (short/long/
empty), nonce randomness, version byte, length invariant, and 4 failure
modes (too-short, bad version, tampered, wrong key).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Add generate-master-key.sh script

**Files:**
- Create: `scripts/generate-master-key.sh`

- [ ] **Step 1: Write the script**

Create `scripts/generate-master-key.sh`:

```bash
#!/usr/bin/env bash
#
# Generate a new 32-byte master key for signapps-keystore.
# Output: 64-char hex string to stdout.
#
# Usage:
#   bash scripts/generate-master-key.sh                    # print to stdout
#   bash scripts/generate-master-key.sh > .keystore-key    # save to file (chmod 600!)
#
# Security notes:
#   - The master key is the root of trust for all encrypted fields.
#   - NEVER commit the output to git.
#   - For dev, export as env var: KEYSTORE_MASTER_KEY=$(bash scripts/generate-master-key.sh)
#   - For prod, write to a file readable only by the service user (chmod 600).

set -euo pipefail

if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
elif [ -r /dev/urandom ]; then
    head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'
    echo
else
    echo "ERROR: neither openssl nor /dev/urandom available" >&2
    exit 1
fi
```

- [ ] **Step 2: Make it executable and test it**

Run: `chmod +x scripts/generate-master-key.sh && bash scripts/generate-master-key.sh | wc -c`
Expected: `65` (64 hex chars + newline)

Run: `bash scripts/generate-master-key.sh | grep -E '^[0-9a-f]{64}$'`
Expected: the output matches the regex (exit 0, line printed).

- [ ] **Step 3: Commit**

```bash
git add scripts/generate-master-key.sh
git commit -m "feat(keystore): add generate-master-key.sh script

Generates a 32-byte random master key in 64-char hex via openssl rand
(fallback to /dev/urandom). For dev: export as KEYSTORE_MASTER_KEY.
For prod: pipe to a 0600-chmoded file and reference via File backend.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Add .env.example entry for KEYSTORE_MASTER_KEY

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Check current .env.example state**

Run: `grep -n 'KEYSTORE\|MASTER_KEY\|VAULT_KEY' .env.example`
Expected: no match (or stale grant-inspired lines that we'll replace).

- [ ] **Step 2: Append the new block**

Append to `.env.example`:

```bash
# ─────────────────────────────────────────────────────────────
# signapps-keystore — master key for encryption at rest
# ─────────────────────────────────────────────────────────────
# 32 bytes hex-encoded (64 characters). Generate with:
#   bash scripts/generate-master-key.sh
#
# Dev: set via env var (this file).
# Prod: prefer File backend — write the hex to /etc/signapps/master.key
#       with chmod 600, then set KEYSTORE_BACKEND=file and
#       KEYSTORE_MASTER_KEY_FILE=/etc/signapps/master.key.
#
# NEVER commit a real key to git.
KEYSTORE_MASTER_KEY=
```

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "docs(env): document KEYSTORE_MASTER_KEY env var

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Wire Keystore into signapps-identity AppState

**Files:**
- Modify: `services/signapps-identity/Cargo.toml`
- Modify: `services/signapps-identity/src/state.rs` (or `main.rs` if no separate state file)

**Context note:** This task does not yet USE the keystore for any OAuth work — that's Plan 2. We just ensure that `signapps-identity` loads the keystore at boot so that later plans have somewhere to plug in. No-op wire, with a tracing log to confirm boot.

- [ ] **Step 1: Inspect the current AppState**

Run: `grep -n 'AppState\|pub struct State' services/signapps-identity/src/*.rs | head -10`

Identify the file where `AppState` is defined. Most likely `services/signapps-identity/src/main.rs` or `state.rs`.

- [ ] **Step 2: Add signapps-keystore dep**

In `services/signapps-identity/Cargo.toml` under `[dependencies]`:

```toml
signapps-keystore = { path = "../../crates/signapps-keystore" }
```

- [ ] **Step 3: Add keystore to AppState**

In the file where `AppState` is defined, add the field:

```rust
use signapps_keystore::Keystore;
use std::sync::Arc;

pub struct AppState {
    // ... existing fields ...
    pub keystore: Arc<Keystore>,
}
```

- [ ] **Step 4: Load keystore in main.rs**

In `services/signapps-identity/src/main.rs`, near the other state initialization (typically after `PgPool::connect`), add:

```rust
use signapps_keystore::{Keystore, KeystoreBackend};

let keystore = Arc::new(
    Keystore::init(KeystoreBackend::EnvVar)
        .await
        .context("failed to initialize signapps-keystore — is KEYSTORE_MASTER_KEY set?")?,
);
tracing::info!("keystore initialized");
```

Add `keystore` to the `AppState` construction:

```rust
let state = AppState {
    // ... existing fields ...
    keystore,
};
```

- [ ] **Step 5: Verify identity builds**

Run: `cargo build -p signapps-identity 2>&1 | tail -10`
Expected: success (possibly warnings about unused `keystore` — that's OK for now).

- [ ] **Step 6: Commit**

```bash
git add services/signapps-identity/
git commit -m "feat(identity): wire signapps-keystore into AppState

Loads the keystore at boot via KeystoreBackend::EnvVar. No OAuth
consumers yet — this is infrastructure for Plan 2 (OAuth crate).
Identity refuses to start if KEYSTORE_MASTER_KEY is missing, matching
the boot-time guardrail policy.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Add doctor check for KEYSTORE_MASTER_KEY

**Files:**
- Create: `scripts/doctor-checks/keystore.sh`
- Modify: `scripts/doctor.sh`

- [ ] **Step 1: Inspect the current doctor.sh**

Run: `head -40 scripts/doctor.sh`

Note the pattern used for individual checks (likely a function or a sourced sub-script).

- [ ] **Step 2: Write the keystore check**

Create `scripts/doctor-checks/keystore.sh`:

```bash
#!/usr/bin/env bash
#
# Check that KEYSTORE_MASTER_KEY is present and well-formed.
# Called by scripts/doctor.sh.

set -u

check_keystore() {
    if [ -z "${KEYSTORE_MASTER_KEY:-}" ]; then
        echo "  ❌ KEYSTORE_MASTER_KEY not set (signapps-identity will refuse to start)"
        echo "     Fix: bash scripts/generate-master-key.sh >> .env (then source .env)"
        return 1
    fi

    local len=${#KEYSTORE_MASTER_KEY}
    if [ "$len" -ne 64 ]; then
        echo "  ❌ KEYSTORE_MASTER_KEY is $len characters (expected 64 hex)"
        return 1
    fi

    if ! echo "$KEYSTORE_MASTER_KEY" | grep -qE '^[0-9a-fA-F]{64}$'; then
        echo "  ❌ KEYSTORE_MASTER_KEY contains non-hex characters"
        return 1
    fi

    echo "  ✅ KEYSTORE_MASTER_KEY: 64-char hex (sha256 fingerprint: $(echo -n "$KEYSTORE_MASTER_KEY" | sha256sum | cut -c1-8))"
    return 0
}

check_keystore
```

- [ ] **Step 3: Invoke from doctor.sh**

In `scripts/doctor.sh`, find the section where individual checks are called (look for a pattern like `check_jwt_secret` or similar). Add a block near it:

```bash
echo ""
echo "🔐 Keystore:"
if bash scripts/doctor-checks/keystore.sh; then
    PASSED=$((PASSED + 1))
else
    FAILED=$((FAILED + 1))
fi
TOTAL=$((TOTAL + 1))
```

If `doctor.sh` uses a different pattern (array of checks, etc.), adapt to match.

- [ ] **Step 4: Run doctor.sh with an unset var and observe failure**

Run: `unset KEYSTORE_MASTER_KEY && bash scripts/doctor.sh 2>&1 | grep -A1 Keystore`
Expected: `❌ KEYSTORE_MASTER_KEY not set (signapps-identity will refuse to start)`

- [ ] **Step 5: Run with a valid key and observe success**

Run: `export KEYSTORE_MASTER_KEY=$(bash scripts/generate-master-key.sh) && bash scripts/doctor.sh 2>&1 | grep -A1 Keystore`
Expected: `✅ KEYSTORE_MASTER_KEY: 64-char hex (sha256 fingerprint: ...)`

- [ ] **Step 6: Commit**

```bash
git add scripts/doctor-checks/keystore.sh scripts/doctor.sh
git commit -m "feat(doctor): check KEYSTORE_MASTER_KEY is present and valid

Validates length (64 hex chars) and format (only 0-9a-f). Shows
sha256 fingerprint for fleet-wide consistency checks without leaking
the key. Doctor count becomes 22/22 (was 21/21).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Update CLAUDE.md workspace layout

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Locate the workspace layout section**

Run: `grep -n 'signapps-common' CLAUDE.md | head -5`
Expected: finds the crates table around line ~350 (the "Architecture → Workspace Layout" section).

- [ ] **Step 2: Add signapps-keystore to the crates block**

In `CLAUDE.md`, locate the block:

```
crates/
  signapps-common/    → JWT auth, middleware, AppError, value objects
  signapps-db/        → Models, repositories, migrations, PgPool, pgvector
  signapps-cache/     → TTL cache (moka) — remplace Redis
  signapps-runtime/   → PostgreSQL lifecycle, hardware detection, model manager
  signapps-service/   → Service bootstrap utilities
```

Insert `signapps-keystore` alphabetically (between `signapps-common` and `signapps-runtime` — but keep existing order and just add):

```
crates/
  signapps-common/    → JWT auth, middleware, AppError, value objects, crypto
  signapps-db/        → Models, repositories, migrations, PgPool, pgvector
  signapps-cache/     → TTL cache (moka) — remplace Redis
  signapps-keystore/  → Master key management + per-usage DEK derivation (AES-256-GCM)
  signapps-runtime/   → PostgreSQL lifecycle, hardware detection, model manager
  signapps-service/   → Service bootstrap utilities
```

- [ ] **Step 3: Also update the "Shared Crate Conventions" section**

Find the block:

```
**signapps-common:** `Claims`, `AppError` (RFC 7807), middleware (auth, admin, logging), value objects (`Email`, `Password`, `UserId`)
```

Replace with:

```
**signapps-common:** `Claims`, `AppError` (RFC 7807), middleware (auth, admin, logging), value objects (`Email`, `Password`, `UserId`), `crypto::EncryptedField` trait (AES-256-GCM)
```

Add a new entry after `signapps-cache`:

```
**signapps-keystore:** `Keystore` (master key + DEK cache), `MasterKey`, `DataEncryptionKey`, `KeystoreBackend` (EnvVar / File / Remote KMS). Loaded once at boot of each service that manipulates encrypted fields.
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): add signapps-keystore to workspace layout

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: Rename signapps-vault → signapps-keystore in the OAuth spec

**Files:**
- Modify: `docs/superpowers/specs/2026-04-14-oauth-unified-design.md`

**Context:** The spec written during brainstorming uses `signapps-vault` throughout, which collides with the existing password manager service. The plan uses `signapps-keystore` instead. This task synchronizes the spec so readers are not misled.

- [ ] **Step 1: Count occurrences before the rewrite**

Run: `grep -c 'signapps-vault' docs/superpowers/specs/2026-04-14-oauth-unified-design.md`
Expected: ~8-12 occurrences.

- [ ] **Step 2: Apply global rename**

Replace every `signapps-vault` with `signapps-keystore` in the spec. Also replace `VAULT_MASTER_KEY` with `KEYSTORE_MASTER_KEY`, and update the `Vault` struct name to `Keystore` where referenced, the `VaultBackend` enum to `KeystoreBackend`, and the phrase "Backend EnvVar/File/Remote" remains as-is.

Specific substitutions:
- `signapps-vault` → `signapps-keystore`
- `VAULT_MASTER_KEY` → `KEYSTORE_MASTER_KEY`
- `VaultBackend` → `KeystoreBackend`
- `pub struct Vault` → `pub struct Keystore`
- `Vault::init` → `Keystore::init`
- `let vault = ` → `let keystore = `
- `state.vault` → `state.keystore`
- `RemoteVaultClient` → `RemoteKeystoreClient`
- section titles that say "signapps-vault" → "signapps-keystore"

Add a new sub-section at the end of section 7.2 (after the backend enum):

```markdown
**Note sur le nommage** : le nom `signapps-vault` était initialement envisagé
dans cette spec mais est déjà pris par un service existant (gestionnaire de
mots de passe utilisateur, dans `services/signapps-vault/`). Le crate crypto
est donc nommé `signapps-keystore` pour éviter la collision.
```

- [ ] **Step 3: Verify all occurrences are replaced**

Run: `grep -n 'signapps-vault\|VaultBackend\|VAULT_MASTER_KEY\|pub struct Vault\b' docs/superpowers/specs/2026-04-14-oauth-unified-design.md`
Expected: no match (or only the one match within the "Note sur le nommage" block explaining the decision).

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-14-oauth-unified-design.md
git commit -m "docs(oauth-spec): rename signapps-vault to signapps-keystore

Resolves naming collision with the existing password manager service
(services/signapps-vault/). The new crypto crate is signapps-keystore.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: Generate README for signapps-keystore via cargo-rdme

**Files:**
- Create: `crates/signapps-keystore/README.md`

- [ ] **Step 1: Verify the module docstring is complete**

Run: `head -5 crates/signapps-keystore/src/lib.rs`
Expected: the current docstring is very terse. We need to expand it so `cargo rdme` generates a useful README.

- [ ] **Step 2: Expand the lib.rs docstring**

Replace the top-of-file doc comment in `crates/signapps-keystore/src/lib.rs`:

```rust
//! Master key management and per-usage DEK derivation for SignApps services.
//!
//! # Overview
//!
//! `signapps-keystore` loads a 32-byte master key at service boot from one of
//! three backends (env var, file, or remote KMS), then derives per-usage
//! [`DataEncryptionKey`]s on demand using HKDF-SHA256. Each DEK is cached in
//! an internal `DashMap` keyed by its `info` label, so derivation happens at
//! most once per unique usage.
//!
//! # Why per-usage DEKs?
//!
//! Deriving one DEK per usage (e.g. `"oauth-tokens-v1"`, `"saml-assertions-v1"`,
//! `"extra-params-v1"`) means compromise of one domain's DEK does not expose
//! the others. The info label is essentially a namespace for key material.
//!
//! # Example
//!
//! ```no_run
//! use signapps_keystore::{Keystore, KeystoreBackend};
//!
//! # async fn example() -> anyhow::Result<()> {
//! let ks = Keystore::init(KeystoreBackend::EnvVar).await?;
//! let dek = ks.dek("oauth-tokens-v1");
//! // Pass `dek` to signapps_common::crypto::EncryptedField::encrypt(...)
//! # Ok(())
//! # }
//! ```
//!
//! # Format of encrypted fields
//!
//! The actual encryption is implemented by the [`EncryptedField`] trait in
//! `signapps-common::crypto`. Ciphertext format:
//!
//! ```text
//! version(1 byte) || nonce(12 bytes) || aes_gcm(plaintext, dek) || tag(16 bytes)
//! ```
//!
//! The version byte enables key rotation without downtime: future code can
//! try multiple DEKs in version order.
//!
//! [`EncryptedField`]: https://docs.rs/signapps-common
#![warn(missing_docs)]
```

- [ ] **Step 3: Generate the README**

Run: `cd crates/signapps-keystore && cargo rdme`
Expected: `README.md updated` or `README.md created`.

- [ ] **Step 4: Verify README was created**

Run: `ls crates/signapps-keystore/README.md && head -20 crates/signapps-keystore/README.md`
Expected: README exists with the expanded documentation.

- [ ] **Step 5: Commit**

```bash
git add crates/signapps-keystore/src/lib.rs crates/signapps-keystore/README.md
git commit -m "docs(keystore): expand lib.rs docstring + generate README

Explains the purpose of per-usage DEKs, ciphertext format, and shows
a minimal usage example. README synced via cargo rdme.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 16: Run full workspace check + clippy + tests

**Files:**
- (none — validation only)

- [ ] **Step 1: Run cargo check on the whole workspace**

Run: `cargo check --workspace --all-features 2>&1 | tail -10`
Expected: no errors. Possibly warnings on unrelated crates — ignore those.

- [ ] **Step 2: Run clippy on the new code**

Run: `cargo clippy -p signapps-keystore -p signapps-common --all-features -- -D warnings 2>&1 | tail -20`
Expected: no warnings that fail with `-D warnings`.

- [ ] **Step 3: Run all new tests**

Run: `cargo test -p signapps-keystore -p signapps-common 2>&1 | tail -15`
Expected: all tests pass (15 in keystore + 10 in common-crypto + any pre-existing common tests).

- [ ] **Step 4: Run the identity service build**

Run: `cargo build -p signapps-identity 2>&1 | tail -5`
Expected: success.

- [ ] **Step 5: Run the doctor check**

Run: `export KEYSTORE_MASTER_KEY=$(bash scripts/generate-master-key.sh) && bash scripts/doctor.sh 2>&1 | tail -20`
Expected: Keystore check passes with `✅`.

- [ ] **Step 6: Commit any formatting fixes made during this task**

Run: `cargo fmt --all`

```bash
git add -u
git diff --cached --stat
```

If there's a diff, commit it:

```bash
git commit -m "style: cargo fmt on new keystore + common-crypto code

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

If no diff, skip the commit.

---

## Task 17: Final integration validation — restart identity with the new keystore

**Files:**
- (none — validation only)

- [ ] **Step 1: Stop all services**

Run: `bash scripts/stop-all.sh 2>&1 | tail -5`
Expected: services stop cleanly.

- [ ] **Step 2: Build release**

Run: `cargo build --release -p signapps-identity 2>&1 | tail -5`
Expected: success.

- [ ] **Step 3: Start identity only (not the whole stack) with KEYSTORE_MASTER_KEY**

Run:

```bash
export KEYSTORE_MASTER_KEY=$(bash scripts/generate-master-key.sh)
./target/release/signapps-identity > /tmp/identity.log 2>&1 &
IDENTITY_PID=$!
sleep 3
```

- [ ] **Step 4: Verify the "keystore initialized" log line appeared**

Run: `grep 'keystore initialized' /tmp/identity.log`
Expected: a match containing `keystore initialized`.

- [ ] **Step 5: Verify identity responds to health check**

Run: `curl -sf http://localhost:3001/health && echo OK`
Expected: `OK`

- [ ] **Step 6: Verify identity refuses to start without KEYSTORE_MASTER_KEY**

Run:

```bash
kill $IDENTITY_PID 2>/dev/null; wait $IDENTITY_PID 2>/dev/null
unset KEYSTORE_MASTER_KEY
./target/release/signapps-identity > /tmp/identity-fail.log 2>&1 || true
sleep 1
grep -E 'KEYSTORE_MASTER_KEY|keystore' /tmp/identity-fail.log | head -3
```

Expected: output contains `failed to initialize signapps-keystore — is KEYSTORE_MASTER_KEY set?` or `EnvVarNotSet`.

- [ ] **Step 7: Clean up and restart the full stack with the key set**

Run:

```bash
export KEYSTORE_MASTER_KEY=$(bash scripts/generate-master-key.sh)
# Persist the key to .env (local dev only; not committed — .env is in .gitignore)
grep -q '^KEYSTORE_MASTER_KEY=' .env || echo "KEYSTORE_MASTER_KEY=$KEYSTORE_MASTER_KEY" >> .env
bash scripts/start-all.sh 2>&1 | tail -10
sleep 10
bash scripts/doctor.sh 2>&1 | tail -25
```

Expected: doctor shows all checks green, Keystore check passes.

- [ ] **Step 8: No commit**

This task only runs validation commands. Nothing to commit.

---

## Self-review checklist (run by the plan author)

**Spec coverage:**
- ✅ Section 7.1 "Architecture des clés" → Tasks 1, 5, 8
- ✅ Section 7.2 "signapps-keystore" → Tasks 1-6, 11
- ✅ Section 7.3 "Trait EncryptedField" → Tasks 7, 8
- ✅ Section 7.4 "Pattern d'utilisation" → Task 8 (example in docstring); full usage in Plan 2
- ✅ Section 7.5 "Rotation" (non-MVP) → version byte in Task 8
- ⏸ Section 7.6 "Guardrail au démarrage" → split: env var check in Task 12, DB-level `assert_tokens_encrypted` in Plan 3 (when token columns exist)
- ⏸ Section 11.1 "Threat model" → partial: key isolation per usage (Task 5), tamper detection (Task 8); remaining threats addressed in Plans 2-3
- ✅ Section 13 licenses (aes-gcm, hkdf, sha2, zeroize all MIT/Apache — confirmed at Task 2 step 1)

**Placeholder scan:** None found.

**Type consistency:**
- `Keystore` / `MasterKey` / `DataEncryptionKey` / `KeystoreBackend` / `KeystoreError` / `CryptoError` — consistent across tasks
- `expose_bytes()` used instead of `as_bytes()` after Task 8 step 4 refactor
- `<()>::encrypt` / `<()>::decrypt` — consistent

**Scope check:** Plan covers Block 1 of the roadmap cleanly. Next plans:
- Plan 2 (OAuth Crate & Engine v2) → blocks 2+3, depends on this
- Plan 3 (Migration & Event Bus) → blocks 4+5
- Plan 4 (Refresh & Admin UI) → blocks 6+7
