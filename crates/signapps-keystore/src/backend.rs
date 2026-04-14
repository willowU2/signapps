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
