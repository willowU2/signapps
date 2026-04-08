//! User model and related types.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// User authentication provider.
#[derive(Debug, Clone, Default, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "VARCHAR", rename_all = "lowercase")]
pub enum AuthProvider {
    #[default]
    Local,
    Ldap,
}

/// User role level.
#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, sqlx::Type)]
#[repr(i16)]
pub enum UserRole {
    #[default]
    User = 1,
    Admin = 2,
    SuperAdmin = 3,
}

/// User entity from the database.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct User {
    pub id: Uuid,
    pub username: String,
    pub email: Option<String>,
    #[serde(skip_serializing)]
    pub password_hash: Option<String>,
    pub role: i16,
    #[serde(skip_serializing)]
    pub mfa_secret: Option<String>,
    pub mfa_enabled: bool,
    pub auth_provider: String,
    pub ldap_dn: Option<String>,
    pub ldap_groups: Option<Vec<String>>,
    pub display_name: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_login: Option<DateTime<Utc>>,
    /// Tenant ID for multi-tenant isolation (NULL = not assigned to a tenant)
    pub tenant_id: Option<Uuid>,
    pub department: Option<String>,
    pub job_title: Option<String>,
    pub phone: Option<String>,
    pub timezone: Option<String>,
    pub locale: Option<String>,
    pub avatar_url: Option<String>,
    pub user_settings: Option<serde_json::Value>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub webdav_enabled: Option<bool>,
    pub onboarding_completed_at: Option<DateTime<Utc>>,
    pub streak_count: i32,
    pub streak_last_date: Option<chrono::NaiveDate>,
}

/// Request to create a new user account.
#[derive(Debug, Clone, Deserialize)]
pub struct CreateUser {
    pub username: String,
    pub email: Option<String>,
    pub password: Option<String>,
    pub display_name: Option<String>,
    pub role: i16,
    pub auth_provider: String,
    pub ldap_dn: Option<String>,
    pub ldap_groups: Option<Vec<String>>,
    pub avatar_url: Option<String>,
}

impl Default for CreateUser {
    fn default() -> Self {
        Self {
            username: String::new(),
            email: None,
            password: None,
            display_name: None,
            role: 1,
            auth_provider: "local".to_string(),
            ldap_dn: None,
            ldap_groups: None,
            avatar_url: None,
        }
    }
}

/// Request to update an existing user's profile or role.
#[derive(Debug, Clone, Deserialize, Default)]
pub struct UpdateUser {
    pub email: Option<String>,
    pub display_name: Option<String>,
    pub role: Option<i16>,
    pub ldap_dn: Option<String>,
    pub ldap_groups: Option<Vec<String>>,
    pub avatar_url: Option<String>,
}

/// User session entity.
#[derive(Debug, Clone, FromRow, Serialize)]
pub struct Session {
    pub id: Uuid,
    pub user_id: Uuid,
    pub token_hash: String,
    pub expires_at: DateTime<Utc>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// API key entity.
#[derive(Debug, Clone, FromRow, Serialize)]
pub struct ApiKey {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    #[serde(skip_serializing)]
    pub key_hash: String,
    pub scopes: Vec<String>,
    pub expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}
