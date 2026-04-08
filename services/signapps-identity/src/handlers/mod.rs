//! HTTP handlers for the Identity service.

pub mod activities;
pub mod admin_security;
pub mod api_keys;
pub mod audit_logs;
pub mod auth;
// backup moved to signapps-backup service (port 3031)
pub mod branding;
pub mod bulk_users;
pub mod comms;
pub mod compliance;
pub mod data_export;
pub mod entity_links;
pub mod feature_flags;
pub mod groups;
pub mod guest_tokens;
pub mod health;
pub mod jwks;
pub mod ip_allowlist;
pub mod ldap;
pub mod mfa;
pub mod migration;
pub mod openapi;
pub mod preferences;
pub mod retention_purge;
pub mod roles;
pub mod security_events;
pub mod sessions;
// signatures moved to signapps-signatures service (port 3028)
// tenant_css moved to signapps-tenant-config service (port 3029)
pub mod tenants;
pub mod user_profile;
// user_signatures moved to signapps-signatures service (port 3028)
pub mod users;
// webhooks moved to signapps-webhooks service (port 3027)
pub mod workspace_features;
