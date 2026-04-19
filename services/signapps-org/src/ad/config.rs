//! Runtime-resolved AD / LDAP synchronization configuration.
//!
//! [`AdSyncConfig::load`] reads one row from `org_ad_config`, decrypts the
//! `bind_password` using the shared [`Keystore`] (AES-256-GCM) and returns
//! a ready-to-use view for the sync engine.
//!
//! The plaintext password NEVER leaves this struct via `Debug` or
//! `Serialize` — the `bind_password` field is marked
//! `#[serde(skip_serializing)]` so the struct is safe to log once the
//! plaintext has been materialised.

use std::sync::Arc;

use anyhow::Result;
use serde::{Deserialize, Serialize};
use signapps_db::models::org::{AdSyncMode, ConflictStrategy};
use signapps_db::repositories::org::AdConfigRepository;
use signapps_keystore::{decrypt_string_arc, Keystore};
use sqlx::PgPool;
use uuid::Uuid;

/// DEK label used to encrypt/decrypt `org_ad_config.bind_password_enc`.
pub(crate) const BIND_PASSWORD_DEK: &str = "org-ad-bind-password-v1";

/// Fully-decrypted AD sync configuration for a single tenant.
///
/// The `bind_password` field carries the live plaintext — it is never
/// serialised by `serde_json::to_value(&cfg)` thanks to
/// `#[serde(skip_serializing)]`. Callers SHOULD NOT log the struct
/// via the default `Debug` impl outside of DEBUG-level tracing where
/// redaction is enforced.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdSyncConfig {
    /// Tenant owning this configuration row.
    pub tenant_id: Uuid,
    /// Activation mode (`off`, `pull`, `push`, `bidirectional`).
    pub mode: AdSyncMode,
    /// LDAP / LDAPS URL.
    pub ldap_url: String,
    /// DN used to bind.
    pub bind_dn: String,
    /// Plaintext bind password — never serialised.
    #[serde(skip_serializing)]
    pub bind_password: String,
    /// Base DN scanned during each cycle.
    pub base_dn: String,
    /// LDAP filter selecting users.
    pub user_filter: String,
    /// LDAP filter selecting organizational units.
    pub ou_filter: String,
    /// Seconds between two consecutive cycles.
    pub sync_interval_sec: u64,
    /// Conflict resolution strategy.
    pub conflict_strategy: ConflictStrategy,
}

impl AdSyncConfig {
    /// Load the AD config for `tenant_id` and decrypt `bind_password`.
    ///
    /// Returns `Ok(None)` if no row exists for the tenant — the caller
    /// SHOULD treat this as "sync disabled".
    ///
    /// # Errors
    ///
    /// - Propagates sqlx errors from [`AdConfigRepository::get`].
    /// - Propagates [`signapps_keystore::CryptoError`] if the stored
    ///   ciphertext cannot be decrypted (wrong master key, tampered
    ///   bytes, ...).
    #[tracing::instrument(skip(pool, keystore), fields(tenant_id = %tenant_id))]
    pub async fn load(
        pool: &PgPool,
        keystore: &Arc<Keystore>,
        tenant_id: Uuid,
    ) -> Result<Option<Self>> {
        let repo = AdConfigRepository::new(pool);
        let Some(row) = repo.get(tenant_id).await? else {
            return Ok(None);
        };

        let password = if let Some(enc) = row.bind_password_enc.as_ref() {
            let dek = keystore.dek(BIND_PASSWORD_DEK);
            decrypt_string_arc(enc, &dek)?
        } else {
            String::new()
        };

        // NEVER log `password` — even at DEBUG — downstream.
        let sync_interval_sec = u64::try_from(row.sync_interval_sec.max(30)).unwrap_or(300);

        Ok(Some(Self {
            tenant_id,
            mode: row.mode,
            ldap_url: row.ldap_url.unwrap_or_default(),
            bind_dn: row.bind_dn.unwrap_or_default(),
            bind_password: password,
            base_dn: row.base_dn.unwrap_or_default(),
            user_filter: row
                .user_filter
                .unwrap_or_else(|| "(objectClass=user)".into()),
            ou_filter: row
                .ou_filter
                .unwrap_or_else(|| "(objectClass=organizationalUnit)".into()),
            sync_interval_sec,
            conflict_strategy: row.conflict_strategy,
        }))
    }
}
