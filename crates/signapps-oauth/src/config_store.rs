//! Tenant-level provider config storage (Postgres-backed).

use crate::error::OAuthError;
use crate::provider::ProviderConfig;
use async_trait::async_trait;
use sqlx::PgPool;
use tracing::instrument;
use uuid::Uuid;

/// Trait for fetching per-tenant provider configs.
///
/// Implemented by [`PgConfigStore`] for Postgres; can be mocked in tests.
#[async_trait]
pub trait ConfigStore: Send + Sync {
    /// Fetch the config for a (tenant, provider_key) pair.
    ///
    /// Returns `Ok(None)` if no config exists for this pair (not an error).
    ///
    /// # Errors
    ///
    /// Returns [`OAuthError::Database`] on connection or query errors.
    async fn get(
        &self,
        tenant_id: Uuid,
        provider_key: &str,
    ) -> Result<Option<ProviderConfig>, OAuthError>;

    /// List all configs (enabled or not) for a tenant.
    ///
    /// # Errors
    ///
    /// Returns [`OAuthError::Database`] on connection or query errors.
    async fn list_for_tenant(&self, tenant_id: Uuid) -> Result<Vec<ProviderConfig>, OAuthError>;
}

/// Postgres-backed [`ConfigStore`] using sqlx.
#[derive(Debug, Clone)]
pub struct PgConfigStore {
    pool: PgPool,
}

impl PgConfigStore {
    /// Build a new config store from a shared Postgres pool.
    #[must_use]
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl ConfigStore for PgConfigStore {
    #[instrument(skip(self))]
    async fn get(
        &self,
        tenant_id: Uuid,
        provider_key: &str,
    ) -> Result<Option<ProviderConfig>, OAuthError> {
        let row = sqlx::query_as::<_, ProviderConfigRow>(
            r#"
            SELECT id, tenant_id, provider_key,
                   client_id_enc, client_secret_enc, extra_params_enc,
                   enabled, purposes, allowed_scopes,
                   visibility, visible_to_org_nodes, visible_to_groups,
                   visible_to_roles, visible_to_users,
                   allow_user_override, is_tenant_sso, auto_provision_users,
                   default_role
            FROM identity.oauth_provider_configs
            WHERE tenant_id = $1 AND provider_key = $2
            "#,
        )
        .bind(tenant_id)
        .bind(provider_key)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| OAuthError::Database(e.to_string()))?;
        Ok(row.map(Into::into))
    }

    #[instrument(skip(self))]
    async fn list_for_tenant(&self, tenant_id: Uuid) -> Result<Vec<ProviderConfig>, OAuthError> {
        let rows = sqlx::query_as::<_, ProviderConfigRow>(
            r#"
            SELECT id, tenant_id, provider_key,
                   client_id_enc, client_secret_enc, extra_params_enc,
                   enabled, purposes, allowed_scopes,
                   visibility, visible_to_org_nodes, visible_to_groups,
                   visible_to_roles, visible_to_users,
                   allow_user_override, is_tenant_sso, auto_provision_users,
                   default_role
            FROM identity.oauth_provider_configs
            WHERE tenant_id = $1
            ORDER BY provider_key
            "#,
        )
        .bind(tenant_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| OAuthError::Database(e.to_string()))?;
        Ok(rows.into_iter().map(Into::into).collect())
    }
}

/// Row mirror of `identity.oauth_provider_configs` for sqlx::FromRow.
#[derive(Debug, sqlx::FromRow)]
struct ProviderConfigRow {
    id: Uuid,
    tenant_id: Uuid,
    provider_key: String,
    client_id_enc: Option<Vec<u8>>,
    client_secret_enc: Option<Vec<u8>>,
    extra_params_enc: Option<Vec<u8>>,
    enabled: bool,
    purposes: Vec<String>,
    allowed_scopes: Vec<String>,
    visibility: String,
    visible_to_org_nodes: Vec<Uuid>,
    visible_to_groups: Vec<Uuid>,
    visible_to_roles: Vec<String>,
    visible_to_users: Vec<Uuid>,
    allow_user_override: bool,
    is_tenant_sso: bool,
    auto_provision_users: bool,
    default_role: Option<String>,
}

impl From<ProviderConfigRow> for ProviderConfig {
    fn from(r: ProviderConfigRow) -> Self {
        Self {
            id: r.id,
            tenant_id: r.tenant_id,
            provider_key: r.provider_key,
            client_id_enc: r.client_id_enc,
            client_secret_enc: r.client_secret_enc,
            extra_params_enc: r.extra_params_enc,
            enabled: r.enabled,
            purposes: r.purposes,
            allowed_scopes: r.allowed_scopes,
            visibility: r.visibility,
            visible_to_org_nodes: r.visible_to_org_nodes,
            visible_to_groups: r.visible_to_groups,
            visible_to_roles: r.visible_to_roles,
            visible_to_users: r.visible_to_users,
            allow_user_override: r.allow_user_override,
            is_tenant_sso: r.is_tenant_sso,
            auto_provision_users: r.auto_provision_users,
            default_role: r.default_role,
        }
    }
}
