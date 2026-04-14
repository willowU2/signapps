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
//! use signapps_keystore::{Keystore, KeystoreBackend, KeystoreError};
//!
//! # async fn example() -> Result<(), KeystoreError> {
//! let ks = Keystore::init(KeystoreBackend::EnvVar).await?;
//! let dek = ks.dek("oauth-tokens-v1");
//! // Pass `dek` to signapps_common::crypto::EncryptedField::encrypt(...)
//! # Ok(())
//! # }
//! ```
//!
//! # Format of encrypted fields
//!
//! The actual encryption is implemented by the `EncryptedField` trait in
//! `signapps-common::crypto`. Ciphertext format:
//!
//! ```text
//! version(1 byte) || nonce(12 bytes) || aes_gcm(plaintext, dek) || tag(16 bytes)
//! ```
//!
//! The version byte enables key rotation without downtime: future code can
//! try multiple DEKs in version order.
#![warn(missing_docs)]

mod backend;
mod dek;
mod error;
mod guardrail;
mod helpers;
mod master_key;

pub use backend::{KeystoreBackend, RemoteKeystoreClient};
pub use dek::DataEncryptionKey;
pub use error::{CryptoError, KeystoreError};
pub use guardrail::{assert_tokens_encrypted, GuardrailError, TokenColumnSpec};
pub use helpers::{decrypt_string, decrypt_string_arc, encrypt_string, encrypt_string_arc};
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
    ///
    /// # Errors
    ///
    /// Returns [`KeystoreError`] if the backend cannot load the master key
    /// (missing env var, unreadable file, or remote KMS failure).
    #[instrument(skip(backend))]
    pub async fn init(backend: KeystoreBackend) -> Result<Self, KeystoreError> {
        let master_key = backend.load().await?;
        Ok(Self {
            master_key,
            deks: DashMap::new(),
        })
    }

    /// Return the DEK for a given usage info, deriving + caching if needed.
    ///
    /// The returned `Arc` is cheap to clone and shares the same underlying key
    /// material for subsequent calls with the same `info` label.
    #[must_use]
    pub fn dek(&self, info: &'static str) -> Arc<DataEncryptionKey> {
        // `entry().or_insert_with(...)` is atomic: at most one thread derives
        // the DEK for a given info label, even under concurrent access.
        self.deks
            .entry(info)
            .or_insert_with(|| Arc::new(DataEncryptionKey::derive_from(&self.master_key, info)))
            .clone()
    }
}
