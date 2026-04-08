//! LDAP configuration repository.

use sqlx::PgPool;
use uuid::Uuid;

use crate::models::ldap::{CreateLdapConfig, LdapConfig, UpdateLdapConfig};
use signapps_common::{Error, Result};

/// Repository for LDAP configuration.
pub struct LdapRepository;

impl LdapRepository {
    /// Get the current LDAP configuration (there should only be one).
    pub async fn get_config(pool: &PgPool) -> Result<Option<LdapConfig>> {
        let config = sqlx::query_as::<_, LdapConfig>(
            r#"
            SELECT id, enabled, server_url, bind_dn, bind_password_encrypted, base_dn,
                   user_filter, group_filter, admin_groups, user_groups, use_tls,
                   skip_tls_verify, sync_interval_minutes, fallback_local_auth,
                   created_at, updated_at
            FROM identity.ldap_config
            ORDER BY created_at DESC
            LIMIT 1
            "#,
        )
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(config)
    }

    /// Create or replace LDAP configuration.
    pub async fn create_config(
        pool: &PgPool,
        config: CreateLdapConfig,
        encrypted_password: &str,
    ) -> Result<LdapConfig> {
        // Delete existing config first (only one config allowed)
        sqlx::query("DELETE FROM identity.ldap_config")
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;

        let result = sqlx::query_as::<_, LdapConfig>(
            r#"
            INSERT INTO identity.ldap_config (
                enabled, server_url, bind_dn, bind_password_encrypted, base_dn,
                user_filter, group_filter, admin_groups, user_groups, use_tls,
                skip_tls_verify, sync_interval_minutes, fallback_local_auth
            )
            VALUES (true, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING id, enabled, server_url, bind_dn, bind_password_encrypted, base_dn,
                      user_filter, group_filter, admin_groups, user_groups, use_tls,
                      skip_tls_verify, sync_interval_minutes, fallback_local_auth,
                      created_at, updated_at
            "#,
        )
        .bind(&config.server_url)
        .bind(&config.bind_dn)
        .bind(encrypted_password)
        .bind(&config.base_dn)
        .bind(&config.user_filter)
        .bind(&config.group_filter)
        .bind(config.admin_groups.unwrap_or_default())
        .bind(config.user_groups.unwrap_or_default())
        .bind(config.use_tls.unwrap_or(true))
        .bind(config.skip_tls_verify.unwrap_or(false))
        .bind(config.sync_interval_minutes.unwrap_or(60))
        .bind(config.fallback_local_auth.unwrap_or(true))
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(result)
    }

    /// Update LDAP configuration.
    pub async fn update_config(
        pool: &PgPool,
        id: Uuid,
        update: UpdateLdapConfig,
        encrypted_password: Option<&str>,
    ) -> Result<LdapConfig> {
        // Build dynamic update query
        let mut query = String::from("UPDATE identity.ldap_config SET updated_at = NOW()");
        let mut param_count = 0;

        if update.enabled.is_some() {
            param_count += 1;
            query.push_str(&format!(", enabled = ${}", param_count));
        }
        if update.server_url.is_some() {
            param_count += 1;
            query.push_str(&format!(", server_url = ${}", param_count));
        }
        if update.bind_dn.is_some() {
            param_count += 1;
            query.push_str(&format!(", bind_dn = ${}", param_count));
        }
        if encrypted_password.is_some() {
            param_count += 1;
            query.push_str(&format!(", bind_password_encrypted = ${}", param_count));
        }
        if update.base_dn.is_some() {
            param_count += 1;
            query.push_str(&format!(", base_dn = ${}", param_count));
        }
        if update.user_filter.is_some() {
            param_count += 1;
            query.push_str(&format!(", user_filter = ${}", param_count));
        }
        if update.group_filter.is_some() {
            param_count += 1;
            query.push_str(&format!(", group_filter = ${}", param_count));
        }
        if update.admin_groups.is_some() {
            param_count += 1;
            query.push_str(&format!(", admin_groups = ${}", param_count));
        }
        if update.user_groups.is_some() {
            param_count += 1;
            query.push_str(&format!(", user_groups = ${}", param_count));
        }
        if update.use_tls.is_some() {
            param_count += 1;
            query.push_str(&format!(", use_tls = ${}", param_count));
        }
        if update.skip_tls_verify.is_some() {
            param_count += 1;
            query.push_str(&format!(", skip_tls_verify = ${}", param_count));
        }
        if update.sync_interval_minutes.is_some() {
            param_count += 1;
            query.push_str(&format!(", sync_interval_minutes = ${}", param_count));
        }
        if update.fallback_local_auth.is_some() {
            param_count += 1;
            query.push_str(&format!(", fallback_local_auth = ${}", param_count));
        }

        param_count += 1;
        query.push_str(&format!(
            " WHERE id = ${} RETURNING id, enabled, server_url, bind_dn, bind_password_encrypted, base_dn,
                      user_filter, group_filter, admin_groups, user_groups, use_tls,
                      skip_tls_verify, sync_interval_minutes, fallback_local_auth,
                      created_at, updated_at",
            param_count
        ));

        // Build and execute query with dynamic bindings
        let mut q = sqlx::query_as::<_, LdapConfig>(&query);

        if let Some(enabled) = update.enabled {
            q = q.bind(enabled);
        }
        if let Some(ref server_url) = update.server_url {
            q = q.bind(server_url);
        }
        if let Some(ref bind_dn) = update.bind_dn {
            q = q.bind(bind_dn);
        }
        if let Some(password) = encrypted_password {
            q = q.bind(password);
        }
        if let Some(ref base_dn) = update.base_dn {
            q = q.bind(base_dn);
        }
        if let Some(ref user_filter) = update.user_filter {
            q = q.bind(user_filter);
        }
        if let Some(ref group_filter) = update.group_filter {
            q = q.bind(group_filter);
        }
        if let Some(ref admin_groups) = update.admin_groups {
            q = q.bind(admin_groups);
        }
        if let Some(ref user_groups) = update.user_groups {
            q = q.bind(user_groups);
        }
        if let Some(use_tls) = update.use_tls {
            q = q.bind(use_tls);
        }
        if let Some(skip_tls_verify) = update.skip_tls_verify {
            q = q.bind(skip_tls_verify);
        }
        if let Some(sync_interval_minutes) = update.sync_interval_minutes {
            q = q.bind(sync_interval_minutes);
        }
        if let Some(fallback_local_auth) = update.fallback_local_auth {
            q = q.bind(fallback_local_auth);
        }

        q = q.bind(id);

        let result = q
            .fetch_one(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;

        Ok(result)
    }

    /// Enable or disable LDAP.
    pub async fn set_enabled(pool: &PgPool, id: Uuid, enabled: bool) -> Result<()> {
        sqlx::query(
            "UPDATE identity.ldap_config SET enabled = $1, updated_at = NOW() WHERE id = $2",
        )
        .bind(enabled)
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(())
    }

    /// Delete LDAP configuration.
    pub async fn delete_config(pool: &PgPool, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM identity.ldap_config WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;

        Ok(())
    }
}
