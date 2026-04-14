// Enforce documentation on all public items
#![warn(missing_docs)]

//! # SignApps Common
//!
//! Shared utilities, types, and middleware for the SignApps Platform.
//!
//! ## Modules
//!
//! - [`alerts`] - Custom alerts system with rule-based conditions and multi-channel notifications
//! - [`approval`] - Document approval workflow (multi-approver, status tracking, comments)
//! - [`accounting`] - FEC (Fichier des Écritures Comptables) export for DGFiP compliance
//! - [`audit`] - Audit trail / activity log (in-memory, middleware + query endpoint) — re-exported from `signapps-audit`
//! - [`auth`] - Authentication types (JWT claims, tokens)
//! - [`bridge`] - Slack/Teams bridge for external messaging platform integrations
//! - [`comments`] - Universal inline comments with @mentions, threads, reactions
//! - [`data_connectors`] - Multi-source data connector system (PostgreSQL, CSV, JSON API)
//! - [`dlp`] - Data Loss Prevention (DLP) with sensitive data pattern detection
//! - [`e2e_crypto`] - End-to-End encrypted channels with XOR cipher stub
//! - [`email_templates`] - Email template engine with {{variable}} substitution
//! - [`error`] - RFC 7807 Problem Details error handling
//! - [`events`] - Inter-service event bus (publish/subscribe domain events)
//! - [`indexer`] - AI indexer HTTP client for RAG pipeline notifications
//! - [`middleware`] - HTTP middleware (auth, logging, request ID, Prometheus metrics)
//! - [`middleware::metrics`] - Prometheus metrics middleware and handlers
//! - [`pii`] - PII Cipher (AES-256-GCM) for encrypting PII fields before DB storage
//! - [`plugins`] - Plugin system architecture (trait, manifest, registry)
//! - [`portal`] - Portal context utilities (employee vs client/supplier/partner detection)
//! - [`rate_limit`] - Token bucket rate limiter middleware
//! - [`reporting`] - Auto-PDF reporting with scheduling and multi-recipient delivery
//! - [`retention`] - RGPD data retention policies (policy engine, expiry checks)
//! - [`sso`] - Single Sign-On (SSO) foundation for SAML2 and OIDC providers
//! - [`triggers`] - Event-driven trigger rule engine with condition evaluation
//! - [`trust_level`] - Trust level system and Axum middleware
//! - [`types`] - Value Objects (Email, Password, UserId, Username)
//! - [`vault`] - Password manager vault with secure entry storage and password generation
//! - `signapps-workflows` crate - AI Workflow Automation engine
//! - [`graphql_layer`] - GraphQL federation configuration and playground support
//! - [`marketplace`] - App Store marketplace with install/uninstall capabilities
//! - [`sql_dashboard`] - SQL query builder with multiple chart visualization types
//! - [`tenant`] - Multi-tenant management with schema isolation and quotas
//! - [`webhooks`] - Outbound webhooks with HMAC-SHA256 signed deliveries
//!
//! ## Example
//!
//! ```rust,ignore
//! use signapps_common::{Error, Result, Email, Password, UserId};
//!
//! fn create_user(email: &str, password: &str) -> Result<UserId> {
//!     let email = Email::new(email)?;
//!     let password = Password::new(password)?;
//!     // ... create user logic
//!     Ok(UserId::new())
//! }
//! ```

// accounting module extracted to signapps-accounting-fec crate
pub use signapps_accounting_fec as accounting;
// alerts module extracted to signapps-alerts crate
pub use signapps_alerts as alerts;
// approval module extracted to signapps-approval crate
pub use signapps_approval as approval;
// audit module extracted to signapps-audit crate
pub use signapps_audit as audit;
pub mod auth;
pub mod bootstrap;
pub mod crypto;
// bridge module extracted to signapps-bridge crate
pub use signapps_bridge as bridge;
// comments module extracted to signapps-comments crate
pub use signapps_comments as comments;
// data_connectors module extracted to signapps-data-connectors crate
pub use signapps_data_connectors as data_connectors;
// dlp module extracted to signapps-dlp crate
pub use signapps_dlp as dlp;
// e2e_crypto module extracted to signapps-e2e-crypto crate
pub use signapps_e2e_crypto as e2e_crypto;
// email_templates module extracted to signapps-email-templates crate
pub use signapps_email_templates as email_templates;
pub mod error;
pub mod events;
// graphql_layer module extracted to signapps-graphql-layer crate
pub use signapps_graphql_layer as graphql_layer;
pub mod healthz;
// indexer module extracted to signapps-indexer crate
pub use signapps_indexer as indexer;
// marketplace module extracted to signapps-marketplace crate
pub use signapps_marketplace as marketplace;
pub mod middleware;
pub mod openapi;
pub mod pg_events;
/// PostgreSQL NOTIFY listener that forwards database events to a broadcast channel.
pub mod pg_listener;
pub mod portal;
// pii module extracted to signapps-pii crate
pub use signapps_pii as pii;
// plugins module extracted to signapps-plugins crate
pub use signapps_plugins as plugins;
// rate_limit module extracted to signapps-rate-limit crate
pub use signapps_rate_limit as rate_limit;
// reporting module extracted to signapps-reporting crate
pub use signapps_reporting as reporting;
// retention module extracted to signapps-retention crate
pub use signapps_retention as retention;
// sql_dashboard module extracted to signapps-sql-dashboard crate
pub use signapps_sql_dashboard as sql_dashboard;
// sso module extracted to signapps-sso crate
pub use signapps_sso as sso;
pub mod tenant;
/// Shared traits for database crawling and cross-service entity linking.
pub mod traits;
// triggers module extracted to signapps-triggers crate
pub use signapps_triggers as triggers;
// trust_level module extracted to signapps-trust crate
pub use signapps_trust as trust_level;
pub mod types;
// ueba module extracted to signapps-ueba crate
pub use signapps_ueba as ueba;
// vault module extracted to signapps-vault-types crate
pub use signapps_vault_types as vault;
// webhooks module extracted to signapps-webhooks crate
pub use signapps_webhooks as webhooks;

// Re-export commonly used items
pub use accounting::{FecEntry, FecExporter};
pub use alerts::{
    Alert, AlertChannel, AlertCondition, AlertManager, AlertRule, ComparisonOperator,
};
pub use approval::{ApprovalComment, ApprovalRequest, ApprovalStatus, ApprovalStore};
pub use audit::{
    audit_middleware, list_audit_entries, AuditAction, AuditEntry, AuditLog, AuditState,
};
pub use auth::{Claims, JwtConfig, TokenPair};
pub use bootstrap::graceful_shutdown;
pub use bridge::{BridgeConfig, BridgeManager, BridgeSource};
pub use comments::{extract_mentions, Comment, CommentStore};
pub use data_connectors::{DataConnectors, DataSource, SourceType};
pub use dlp::{DlpFinding, DlpPattern, DlpRule, DlpScanner, Severity};
pub use e2e_crypto::{E2eChannel, E2eChannelManager};
pub use email_templates::{notification_template, signature_request_template, welcome_template, EmailTemplate, RenderedEmail};
pub use error::{Error, ProblemDetails, Result};
pub use events::{DomainEvent, EventBus, EventEnvelope};
pub use graphql_layer::GraphQlConfig;
pub use indexer::AiIndexerClient;
pub use marketplace::{AppListing, AppStore};
pub use middleware::{
    correlation_id_middleware,
    metrics::{metrics_handler, metrics_middleware, MetricsCollector},
    security_headers_middleware, AuthState, RequestClaimsExt, TenantContext,
};
pub use openapi::create_openapi_router;
pub use pg_events::{NewEvent as PlatformNewEvent, PgEventBus, PlatformEvent};
pub use pii::PiiCipher;
pub use plugins::{Plugin, PluginManifest, PluginRegistry};
pub use rate_limit::{rate_limit_middleware, RateLimiter, RateLimiterConfig};
pub use reporting::{ReportConfig, ReportData, ReportEngine, ReportTemplate};
pub use retention::{RetentionAction, RetentionEngine, RetentionPolicy};
pub use sql_dashboard::{ChartType, SqlDashboard, SqlQuery};
pub use sso::{SsoConfig, SsoProtocol, SsoProvider, SsoProviderRegistry};
pub use tenant::{Tenant, TenantManager};
pub use triggers::{TriggerEngine, TriggerRule};
pub use types::{Email, Password, PasswordHash, PgQueryResult, UserId, Username};
pub use ueba::{Anomaly, AnomalyDetector, BehaviorBaseline, UserBehavior};
pub use vault::{VaultEntry, VaultStore};
pub use webhooks::{DeliveryStatus, WebhookConfig, WebhookDelivery, WebhookManager};

/// Crate version from Cargo.toml
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Crate name
pub const NAME: &str = env!("CARGO_PKG_NAME");
