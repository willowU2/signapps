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
//! - [`audit`] - Audit trail / activity log (in-memory, middleware + query endpoint)
//! - [`auth`] - Authentication types (JWT claims, tokens)
//! - [`bridge`] - Slack/Teams bridge for external messaging platform integrations
//! - [`comments`] - Universal inline comments with @mentions, threads, reactions
//! - [`config`] - Application configuration
//! - [`data_connectors`] - Multi-source data connector system (PostgreSQL, CSV, JSON API)
//! - [`dlp`] - Data Loss Prevention (DLP) with sensitive data pattern detection
//! - [`e2e_crypto`] - End-to-End encrypted channels with XOR cipher stub
//! - [`email_templates`] - Email template engine with {{variable}} substitution (signature, notification, welcome)
//! - [`error`] - RFC 7807 Problem Details error handling
//! - [`events`] - Inter-service event bus (publish/subscribe domain events)
//! - [`middleware`] - HTTP middleware (auth, logging, request ID, Prometheus metrics)
//! - [`middleware::metrics`] - Prometheus metrics middleware and handlers
//! - [`pii`] - PII Cipher (AES-256-GCM) for encrypting PII fields (email, name) before DB storage
//! - [`plugins`] - Plugin system architecture (trait, manifest, registry)
//! - [`reporting`] - Auto-PDF reporting with scheduling and multi-recipient delivery
//! - [`retention`] - RGPD data retention policies (policy engine, expiry checks)
//! - [`sso`] - Single Sign-On (SSO) foundation for SAML2 and OIDC providers
//! - [`types`] - Value Objects (Email, Password, UserId, Username)
//! - [`vault`] - Password manager vault with secure entry storage and password generation
//! - [`workflows`] - AI Workflow Automation engine (trigger, conditions, actions)
//! - [`graphql_layer`] - GraphQL federation configuration and playground support
//! - [`marketplace`] - App Store marketplace with install/uninstall capabilities
//! - [`sql_dashboard`] - SQL query builder with multiple chart visualization types
//! - [`tenant`] - Multi-tenant management with schema isolation and quotas
//! - [`triggers`] - Event-driven trigger rule engine with condition evaluation
//! - [`ueba`] - User and Entity Behavior Analytics (UEBA) for anomaly detection
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

pub mod accounting;
pub mod alerts;
pub mod approval;
pub mod audit;
pub mod auth;
pub mod bootstrap;
pub mod bridge;
pub mod comments;
pub mod config;
pub mod data_connectors;
pub mod dlp;
pub mod e2e_crypto;
pub mod email_templates;
pub mod error;
pub mod events;
pub mod graphql_layer;
pub mod healthz;
pub mod indexer;
pub mod marketplace;
pub mod middleware;
pub mod openapi;
pub mod pg_events;
pub mod pg_listener;
pub mod pii;
pub mod plugins;
pub mod qrcode_gen;
pub mod rate_limit;
pub mod reporting;
pub mod retention;
#[cfg(feature = "search")]
pub mod search;
pub mod sql_dashboard;
pub mod sso;
pub mod tenant;
pub mod traits;
pub mod triggers;
pub mod trust_level;
pub mod types;
pub mod ueba;
pub mod vault;
pub mod webhooks;
pub mod workflows;

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
pub use config::AppConfig;
pub use data_connectors::{DataConnectors, DataSource, SourceType};
pub use dlp::{DlpFinding, DlpPattern, DlpRule, DlpScanner, Severity};
pub use e2e_crypto::{E2eChannel, E2eChannelManager};
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
pub use plugins::{Plugin, PluginManifest, PluginRegistry};
pub use qrcode_gen::generate_qr_svg;
pub use reporting::{ReportConfig, ReportData, ReportEngine, ReportTemplate};
pub use retention::{RetentionAction, RetentionEngine, RetentionPolicy};
#[cfg(feature = "search")]
pub use search::{SearchError, SearchHit, SearchIndex};
pub use sql_dashboard::{ChartType, SqlDashboard, SqlQuery};
pub use sso::{SsoConfig, SsoProtocol, SsoProvider, SsoProviderRegistry};
pub use tenant::{Tenant, TenantManager};
pub use triggers::{TriggerEngine, TriggerRule};
pub use types::{Email, Password, PasswordHash, PgQueryResult, UserId, Username};
pub use ueba::{Anomaly, AnomalyDetector, BehaviorBaseline, UserBehavior};
pub use vault::{VaultEntry, VaultStore};
pub use webhooks::{DeliveryStatus, WebhookConfig, WebhookDelivery, WebhookManager};
pub use workflows::{
    Condition, ConditionOp, WorkflowAction, WorkflowDefinition, WorkflowEngine, WorkflowExecution,
    WorkflowTrigger,
};

/// Crate version from Cargo.toml
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Crate name
pub const NAME: &str = env!("CARGO_PKG_NAME");
