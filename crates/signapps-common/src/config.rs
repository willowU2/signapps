//! Application configuration.

use serde::Deserialize;

/// Main application configuration.
#[derive(Debug, Clone, Deserialize)]
pub struct AppConfig {
    /// Server configuration
    pub server: ServerConfig,
    /// Database configuration
    pub database: DatabaseConfig,
    /// JWT configuration
    pub jwt: JwtSettings,
    /// LDAP configuration (optional)
    pub ldap: Option<LdapSettings>,
}

/// Server configuration.
#[derive(Debug, Clone, Deserialize)]
pub struct ServerConfig {
    /// Host to bind to
    #[serde(default = "default_host")]
    pub host: String,
    /// Port to listen on
    #[serde(default = "default_port")]
    pub port: u16,
}

fn default_host() -> String {
    "0.0.0.0".to_string()
}

fn default_port() -> u16 {
    3000
}

/// Database configuration.
#[derive(Debug, Clone, Deserialize)]
pub struct DatabaseConfig {
    /// PostgreSQL connection URL
    pub url: String,
    /// Maximum connections in pool
    #[serde(default = "default_max_connections")]
    pub max_connections: u32,
}

fn default_max_connections() -> u32 {
    20
}

/// JWT settings.
#[derive(Debug, Clone, Deserialize)]
pub struct JwtSettings {
    /// Secret for signing tokens
    pub secret: String,
    /// Access token expiration in seconds
    #[serde(default = "default_access_expiration")]
    pub access_expiration: i64,
    /// Refresh token expiration in seconds
    #[serde(default = "default_refresh_expiration")]
    pub refresh_expiration: i64,
}

fn default_access_expiration() -> i64 {
    900 // 15 minutes
}

fn default_refresh_expiration() -> i64 {
    604800 // 7 days
}

/// LDAP/Active Directory settings.
#[derive(Debug, Clone, Deserialize)]
pub struct LdapSettings {
    /// LDAP server URL
    pub url: String,
    /// Bind DN for service account
    pub bind_dn: String,
    /// Bind password
    pub bind_password: String,
    /// Base DN for searches
    pub base_dn: String,
    /// User search filter
    #[serde(default = "default_user_filter")]
    pub user_filter: String,
    /// Use TLS
    #[serde(default = "default_true")]
    pub use_tls: bool,
    /// Skip TLS verification (not recommended)
    #[serde(default)]
    pub skip_tls_verify: bool,
}

fn default_user_filter() -> String {
    "(&(objectClass=user)(sAMAccountName={username}))".to_string()
}

fn default_true() -> bool {
    true
}

impl AppConfig {
    /// Load configuration from environment variables and config files.
    pub fn load() -> Result<Self, config::ConfigError> {
        let config = config::Config::builder()
            .add_source(config::Environment::default().separator("__"))
            .build()?;

        config.try_deserialize()
    }
}
