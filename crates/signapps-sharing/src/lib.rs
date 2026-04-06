// Enforce documentation on all public items
#![warn(missing_docs)]

//! # SignApps Sharing
//!
//! Unified permission and sharing engine for the SignApps Platform.
//!
//! This crate implements a **multi-axis permission model** covering four grant
//! axes (direct user, group membership, organisational hierarchy, and
//! tenant-wide public grants) with resource-level capabilities and
//! policy-based overrides.
//!
//! ## Modules
//!
//! - [`types`] — Core domain enums and value objects (ResourceType, Role, Action, Grantee…)
//! - [`models`] — Database-mapped structs for grants, policies, templates, audit log, etc.
//! - [`repository`] — CRUD operations over `sharing.*` PostgreSQL tables
//! - [`resolver`] — Multi-axis permission resolution
//! - [`cache`] — TTL cache layer for resolved permissions
//! - [`engine`] — High-level [`SharingEngine`] public API
//! - [`audit`] — Structured audit logging for sharing events
//! - [`middleware`] — Axum middleware for permission enforcement
//! - [`defaults`] — System-level default visibility per resource type
//! - [`handlers`] — Generic Axum HTTP handlers
//! - [`routes`] — Route registration helpers
//!
//! ## Example
//!
//! ```rust,ignore
//! use signapps_sharing::engine::SharingEngine;
//! use signapps_sharing::types::{ResourceRef, Action};
//! use signapps_cache::CacheService;
//!
//! let engine = SharingEngine::new(pool.clone(), CacheService::default_config());
//! engine.check(&user_ctx, ResourceRef::file(file_id), Action::read(), None).await?;
//! ```

pub mod models;
pub mod types;

pub mod repository;
pub mod resolver;

pub mod audit;
pub mod cache;

pub mod defaults;
pub mod engine;
pub mod handlers;
pub mod middleware;
pub mod routes;

// ─── Re-exports ───────────────────────────────────────────────────────────────

pub use engine::SharingEngine;
pub use middleware::require_permission;

pub use models::{
    AuditEntry, Capability, CreateGrant, DefaultVisibility, EffectivePermission, Grant,
    PermissionSource, Policy, Template, UserContext,
};
pub use types::{Action, Grantee, GranteeType, ResourceRef, ResourceType, Role};

/// Crate version from Cargo.toml.
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Crate name.
pub const NAME: &str = env!("CARGO_PKG_NAME");
