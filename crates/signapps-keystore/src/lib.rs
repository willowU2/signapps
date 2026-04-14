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
