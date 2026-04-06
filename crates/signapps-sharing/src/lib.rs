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
//!
//! ## Planned Modules (not yet implemented)
//!
//! - `repository` — CRUD operations over `sharing.*` PostgreSQL tables
//! - `resolver` — Multi-axis permission resolution with caching
//! - `cache` — TTL cache layer for resolved permissions
//! - `engine` — High-level [`SharingEngine`] public API
//! - `audit` — Structured audit logging for sharing events
//! - `middleware` — Axum middleware for permission enforcement
//! - `defaults` — Tenant-level default visibility management
//! - `handlers` — Axum HTTP handlers
//! - `routes` — Route registration helpers
//!
//! ## Example
//!
//! ```rust,ignore
//! use signapps_sharing::types::{ResourceRef, Grantee, Role};
//! use uuid::Uuid;
//!
//! let resource = ResourceRef::file(Uuid::new_v4());
//! let grantee = Grantee::User(Uuid::new_v4());
//! let role = Role::Editor;
//! ```

pub mod models;
pub mod types;

// Modules to be added in subsequent tasks:
// pub mod repository;
// pub mod resolver;
// pub mod cache;
// pub mod engine;
// pub mod audit;
// pub mod middleware;
// pub mod defaults;
// pub mod handlers;
// pub mod routes;

// ─── Re-exports ───────────────────────────────────────────────────────────────

pub use models::{
    AuditEntry, Capability, CreateGrant, DefaultVisibility, EffectivePermission, Grant, Policy,
    PermissionSource, Template, UserContext,
};
pub use types::{Action, Grantee, GranteeType, ResourceRef, ResourceType, Role};

/// Crate version from Cargo.toml.
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Crate name.
pub const NAME: &str = env!("CARGO_PKG_NAME");
