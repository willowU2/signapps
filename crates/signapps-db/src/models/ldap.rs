//! LDAP configuration model.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// LDAP/Active Directory configuration.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct LdapConfig {
    pub id: Uuid,
    pub enabled: bool,
    pub server_url: String,
    pub bind_dn: String,
    #[serde(skip_serializing)]
    pub bind_password_encrypted: String,
    pub base_dn: String,
    pub user_filter: Option<String>,
    pub group_filter: Option<String>,
    pub admin_groups: Vec<String>,
    pub user_groups: Vec<String>,
    pub use_tls: bool,
    pub skip_tls_verify: bool,
    pub sync_interval_minutes: i32,
    pub fallback_local_auth: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// LDAP configuration for API responses (without password).
#[derive(Debug, Clone, Serialize)]
pub struct LdapConfigResponse {
    pub id: Uuid,
    pub enabled: bool,
    pub server_url: String,
    pub bind_dn: String,
    pub base_dn: String,
    pub user_filter: String,
    pub group_filter: String,
    pub admin_groups: Vec<String>,
    pub user_groups: Vec<String>,
    pub use_tls: bool,
    pub skip_tls_verify: bool,
    pub sync_interval_minutes: i32,
    pub fallback_local_auth: bool,
}

impl From<LdapConfig> for LdapConfigResponse {
    fn from(config: LdapConfig) -> Self {
        Self {
            id: config.id,
            enabled: config.enabled,
            server_url: config.server_url,
            bind_dn: config.bind_dn,
            base_dn: config.base_dn,
            user_filter: config.user_filter.unwrap_or_else(|| "(&(objectClass=user)(sAMAccountName={username}))".to_string()),
            group_filter: config.group_filter.unwrap_or_else(|| "(objectClass=group)".to_string()),
            admin_groups: config.admin_groups,
            user_groups: config.user_groups,
            use_tls: config.use_tls,
            skip_tls_verify: config.skip_tls_verify,
            sync_interval_minutes: config.sync_interval_minutes,
            fallback_local_auth: config.fallback_local_auth,
        }
    }
}

/// Request to create or update LDAP configuration.
#[derive(Debug, Clone, Deserialize)]
pub struct CreateLdapConfig {
    pub server_url: String,
    pub bind_dn: String,
    pub bind_password: String,
    pub base_dn: String,
    pub user_filter: Option<String>,
    pub group_filter: Option<String>,
    pub admin_groups: Option<Vec<String>>,
    pub user_groups: Option<Vec<String>>,
    pub use_tls: Option<bool>,
    pub skip_tls_verify: Option<bool>,
    pub sync_interval_minutes: Option<i32>,
    pub fallback_local_auth: Option<bool>,
}

/// Request to update LDAP configuration.
#[derive(Debug, Clone, Deserialize)]
pub struct UpdateLdapConfig {
    pub enabled: Option<bool>,
    pub server_url: Option<String>,
    pub bind_dn: Option<String>,
    pub bind_password: Option<String>,
    pub base_dn: Option<String>,
    pub user_filter: Option<String>,
    pub group_filter: Option<String>,
    pub admin_groups: Option<Vec<String>>,
    pub user_groups: Option<Vec<String>>,
    pub use_tls: Option<bool>,
    pub skip_tls_verify: Option<bool>,
    pub sync_interval_minutes: Option<i32>,
    pub fallback_local_auth: Option<bool>,
}

/// LDAP test result.
#[derive(Debug, Clone, Serialize)]
pub struct LdapTestResult {
    pub success: bool,
    pub message: String,
    pub connection_time_ms: Option<u64>,
    pub users_found: Option<i32>,
    pub groups_found: Option<i32>,
}

/// LDAP group from directory.
#[derive(Debug, Clone, Serialize)]
pub struct LdapGroup {
    pub dn: String,
    pub name: String,
    pub description: Option<String>,
    pub member_count: i32,
}

/// LDAP sync result.
#[derive(Debug, Clone, Serialize)]
pub struct LdapSyncResult {
    pub users_created: i32,
    pub users_updated: i32,
    pub users_disabled: i32,
    pub groups_synced: i32,
    pub errors: Vec<String>,
}
