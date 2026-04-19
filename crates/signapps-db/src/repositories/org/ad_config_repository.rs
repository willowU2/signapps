//! CRUD for `org_ad_config`.

use anyhow::Result;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::org::{AdConfig, AdSyncMode, ConflictStrategy};

/// Repository for the canonical `org_ad_config` table.
pub struct AdConfigRepository<'a> {
    pool: &'a PgPool,
}

impl<'a> AdConfigRepository<'a> {
    /// Construct a new repository bound to the given pool.
    pub fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    /// Upsert the AD config for a tenant.
    ///
    /// `bind_password_enc` MUST already be ciphertext sealed by
    /// `signapps-keystore`. This repository never touches plaintext.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error if the upsert fails.
    #[allow(clippy::too_many_arguments)]
    pub async fn upsert(
        &self,
        tenant_id: Uuid,
        mode: AdSyncMode,
        ldap_url: Option<&str>,
        bind_dn: Option<&str>,
        bind_password_enc: Option<&[u8]>,
        base_dn: Option<&str>,
        user_filter: Option<&str>,
        ou_filter: Option<&str>,
        sync_interval_sec: i32,
        conflict_strategy: ConflictStrategy,
    ) -> Result<AdConfig> {
        let row = sqlx::query_as::<_, AdConfig>(
            "INSERT INTO org_ad_config
                (tenant_id, mode, ldap_url, bind_dn, bind_password_enc, base_dn,
                 user_filter, ou_filter, sync_interval_sec, conflict_strategy)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (tenant_id) DO UPDATE SET
                mode              = EXCLUDED.mode,
                ldap_url          = EXCLUDED.ldap_url,
                bind_dn           = EXCLUDED.bind_dn,
                bind_password_enc = EXCLUDED.bind_password_enc,
                base_dn           = EXCLUDED.base_dn,
                user_filter       = EXCLUDED.user_filter,
                ou_filter         = EXCLUDED.ou_filter,
                sync_interval_sec = EXCLUDED.sync_interval_sec,
                conflict_strategy = EXCLUDED.conflict_strategy,
                updated_at        = now()
             RETURNING *",
        )
        .bind(tenant_id)
        .bind(mode)
        .bind(ldap_url)
        .bind(bind_dn)
        .bind(bind_password_enc)
        .bind(base_dn)
        .bind(user_filter)
        .bind(ou_filter)
        .bind(sync_interval_sec)
        .bind(conflict_strategy)
        .fetch_one(self.pool)
        .await?;
        Ok(row)
    }

    /// Fetch the AD config for a tenant, `Ok(None)` when not configured.
    pub async fn get(&self, tenant_id: Uuid) -> Result<Option<AdConfig>> {
        let row = sqlx::query_as::<_, AdConfig>(
            "SELECT * FROM org_ad_config WHERE tenant_id = $1",
        )
        .bind(tenant_id)
        .fetch_optional(self.pool)
        .await?;
        Ok(row)
    }
}
