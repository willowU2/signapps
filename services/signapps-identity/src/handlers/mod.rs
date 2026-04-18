//! HTTP handlers for the Identity service.

// activities moved to signapps-compliance service (port 3032)
pub mod admin;
pub mod admin_security;
pub mod api_keys;
// audit_logs moved to signapps-compliance service (port 3032)
pub mod auth;
// backup moved to signapps-backup service (port 3031)
pub mod bookmarks;
pub mod brand_kit;
pub mod branding;
pub mod bulk_users;
pub mod comms;
pub mod companies;
// compliance moved to signapps-compliance service (port 3032)
pub mod dashboard;
// data_export moved to signapps-compliance service (port 3032)
pub mod entity_links;
// feature_flags moved to signapps-tenant-config service (port 3029)
pub mod groups;
pub mod guest_tokens;
pub mod health;
pub mod help;
pub mod ip_allowlist;
pub mod jwks;
pub mod keep;
pub mod ldap;
pub mod mfa;
pub mod migration;
pub mod oauth;
pub mod openapi;
pub mod preferences;
pub mod reports;
// retention_purge moved to signapps-compliance service (port 3032)
pub mod roles;
pub mod search;
pub mod security_events;
pub mod sessions;
// signatures moved to signapps-signatures service (port 3028)
// tenant_css moved to signapps-tenant-config service (port 3029)
pub mod tenants;
pub mod trash;
pub mod user_profile;
// user_signatures moved to signapps-signatures service (port 3028)
pub mod users;
// webhooks moved to signapps-webhooks service (port 3027)
// workspace_features: GET moved to tenant-config; PUT update kept here (gateway /api/v1/workspaces → identity)
pub mod workspace_features;
