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
