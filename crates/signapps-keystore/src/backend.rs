//! Backend variants for loading the master key.

use crate::{KeystoreError, MasterKey};
use async_trait::async_trait;
use std::path::PathBuf;
use tracing::instrument;

/// Default env var name for the master key in production.
pub const DEFAULT_ENV_VAR: &str = "KEYSTORE_MASTER_KEY";

/// Where the master key is loaded from at boot.
///
/// Choose `EnvVar` for local development, `File` for self-hosted
/// production (store the key in a file chmoded 0600), and `Remote` for
/// enterprise deployments backed by a KMS service.
pub enum KeystoreBackend {
    /// Dev/test only: load from `KEYSTORE_MASTER_KEY` env var (hex-encoded 32 bytes).
    EnvVar,
    /// Test-only: load from a caller-specified env var name.
    ///
    /// Used by unit tests to avoid clobbering each other's env state when
    /// running in parallel. Not intended for production use.
    EnvVarNamed(String),
    /// Prod self-hosted: load from a file path (hex-encoded 32 bytes,
    /// trailing whitespace ok).
    File(PathBuf),
    /// Prod enterprise: delegate to a remote KMS client.
    Remote(Box<dyn RemoteKeystoreClient + Send + Sync>),
}

impl KeystoreBackend {
    /// Load the master key from the configured backend.
    ///
    /// # Errors
    ///
    /// Returns [`KeystoreError`] describing why loading failed:
    /// - [`KeystoreError::EnvVarNotSet`] for the EnvVar backend
    /// - [`KeystoreError::FileRead`] for the File backend
    /// - [`KeystoreError::Remote`] for Remote KMS backends
    /// - [`KeystoreError::InvalidHex`] or [`KeystoreError::InvalidLength`]
    ///   if the loaded bytes are not a valid 32-byte hex-encoded key
    #[instrument(skip(self))]
    pub async fn load(&self) -> Result<MasterKey, KeystoreError> {
        match self {
            Self::EnvVar => load_env(DEFAULT_ENV_VAR),
            Self::EnvVarNamed(name) => load_env(name),
            Self::File(_) => unimplemented!("filled in Task 4"),
            Self::Remote(client) => client.fetch_master_key().await,
        }
    }
}

/// Load the master key from the given env var name.
///
/// Returns [`KeystoreError::EnvVarNotSet`] if the variable is not set or
/// is set to the empty string. Otherwise delegates to [`MasterKey::from_hex`].
fn load_env(var_name: &str) -> Result<MasterKey, KeystoreError> {
    let hex = std::env::var(var_name).map_err(|_| KeystoreError::EnvVarNotSet)?;
    if hex.is_empty() {
        return Err(KeystoreError::EnvVarNotSet);
    }
    MasterKey::from_hex(&hex)
}

/// Trait for remote KMS backends (`HashiCorp Vault`, `AWS KMS`, `Azure Key Vault`).
#[async_trait]
pub trait RemoteKeystoreClient {
    /// Fetch the master key from the remote backend.
    ///
    /// # Errors
    ///
    /// Returns [`KeystoreError::Remote`] with a description of the remote
    /// failure (network error, authentication failure, missing key, etc.).
    async fn fetch_master_key(&self) -> Result<MasterKey, KeystoreError>;
}

#[cfg(test)]
mod tests {
    include!("backend/tests.rs");
}
