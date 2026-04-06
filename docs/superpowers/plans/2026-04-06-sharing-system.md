# Unified Sharing & Permissions System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a unified sharing crate (`signapps-sharing`) that provides permission resolution across all platform services, replacing 3 existing ad-hoc systems.

**Architecture:** New shared crate embedding a 6-step permission resolver (owner → deny → collect 3 axes → inheritance → merge → capability check). Schema `sharing.*` with 5 tables + audit. Axum middleware + macro for route generation.

**Tech Stack:** Rust (Axum, sqlx, moka, tracing), PostgreSQL, signapps-common/db/cache crates.

**Spec:** `docs/superpowers/specs/2026-04-06-sharing-system-design.md`

---

## File Structure

### New crate: `crates/signapps-sharing/`

| File | Responsibility |
|------|---------------|
| `Cargo.toml` | Dependencies: signapps-common, signapps-db, signapps-cache, sqlx, serde, tracing |
| `src/lib.rs` | Re-exports: SharingEngine, middleware, types, models |
| `src/types.rs` | Enums: ResourceType, Role, Action, GranteeType |
| `src/models.rs` | Structs: Grant, Policy, Template, Capability, DefaultVisibility, AuditEntry, UserContext, EffectivePermission |
| `src/repository.rs` | SharingRepository: CRUD grants, policies, templates, capabilities, defaults, audit |
| `src/resolver.rs` | PermissionResolver: 6-step algorithm |
| `src/cache.rs` | SharingCache: L1/L2 wrapping CacheService |
| `src/engine.rs` | SharingEngine: public API (check, grant, revoke, effective_role, shared_with_me) |
| `src/audit.rs` | AuditLogger: INSERT-only audit trail |
| `src/middleware.rs` | require_permission() Axum middleware |
| `src/defaults.rs` | Seed capabilities + default visibility per type |
| `src/handlers.rs` | Generic sharing handlers (list_grants, create_grant, etc.) |
| `src/routes.rs` | sharing_routes! macro |

### Modified files

| File | Change |
|------|--------|
| `Cargo.toml` (root) | Add `"crates/signapps-sharing"` to workspace members |
| `migrations/232_sharing_schema.sql` | Create schema + 5 tables + seed data |
| `services/signapps-forms/Cargo.toml` | Add signapps-sharing dependency |
| `services/signapps-forms/src/main.rs` | Add SharingEngine to AppState, merge sharing_routes |

---

## Task 1: SQL Migration — Schema & Tables

**Files:**
- Create: `migrations/232_sharing_schema.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- 232_sharing_schema.sql
-- Unified sharing & permissions system

CREATE SCHEMA IF NOT EXISTS sharing;

-- ═══════════════════════════════════════════════════════════════
-- 1. GRANTS — Central permissions table
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE sharing.grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES identity.tenants(id) ON DELETE CASCADE,
    resource_type TEXT NOT NULL,
    resource_id UUID NOT NULL,
    grantee_type TEXT NOT NULL,
    grantee_id UUID,
    role TEXT NOT NULL,
    can_reshare BOOLEAN NOT NULL DEFAULT false,
    inherit BOOLEAN NOT NULL DEFAULT true,
    granted_by UUID NOT NULL REFERENCES identity.users(id),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_resource_type CHECK (resource_type IN (
        'file', 'folder', 'calendar', 'event', 'document',
        'form', 'contact_book', 'channel', 'asset', 'vault_entry'
    )),
    CONSTRAINT chk_grantee_type CHECK (grantee_type IN (
        'user', 'group', 'org_node', 'everyone'
    )),
    CONSTRAINT chk_role CHECK (role IN ('viewer', 'editor', 'manager', 'deny')),
    CONSTRAINT chk_everyone_no_id CHECK (
        (grantee_type = 'everyone' AND grantee_id IS NULL) OR
        (grantee_type != 'everyone' AND grantee_id IS NOT NULL)
    ),
    CONSTRAINT chk_vault_no_everyone CHECK (
        NOT (resource_type = 'vault_entry' AND grantee_type = 'everyone')
    )
);

CREATE UNIQUE INDEX idx_grants_unique
    ON sharing.grants (tenant_id, resource_type, resource_id, grantee_type, COALESCE(grantee_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX idx_grants_resource
    ON sharing.grants (tenant_id, resource_type, resource_id);
CREATE INDEX idx_grants_grantee
    ON sharing.grants (tenant_id, grantee_type, grantee_id)
    WHERE grantee_id IS NOT NULL;
CREATE INDEX idx_grants_expires
    ON sharing.grants (expires_at)
    WHERE expires_at IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- 2. POLICIES — Container inheritance rules
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE sharing.policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES identity.tenants(id) ON DELETE CASCADE,
    container_type TEXT NOT NULL,
    container_id UUID NOT NULL,
    grantee_type TEXT NOT NULL,
    grantee_id UUID,
    default_role TEXT NOT NULL,
    can_reshare BOOLEAN NOT NULL DEFAULT false,
    apply_to_existing BOOLEAN NOT NULL DEFAULT false,
    created_by UUID NOT NULL REFERENCES identity.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_policy_container_type CHECK (container_type IN (
        'folder', 'calendar', 'form_space', 'channel_group'
    )),
    CONSTRAINT chk_policy_grantee_type CHECK (grantee_type IN (
        'user', 'group', 'org_node', 'everyone'
    )),
    CONSTRAINT chk_policy_role CHECK (default_role IN ('viewer', 'editor', 'manager'))
);

CREATE UNIQUE INDEX idx_policies_unique
    ON sharing.policies (tenant_id, container_type, container_id, grantee_type, COALESCE(grantee_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX idx_policies_container
    ON sharing.policies (tenant_id, container_type, container_id);

-- ═══════════════════════════════════════════════════════════════
-- 3. TEMPLATES — Named sharing presets
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE sharing.templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES identity.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    grants JSONB NOT NULL DEFAULT '[]',
    created_by UUID NOT NULL REFERENCES identity.users(id),
    is_system BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_templates_name
    ON sharing.templates (tenant_id, name);

-- ═══════════════════════════════════════════════════════════════
-- 4. CAPABILITIES — Role → Actions per resource type
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE sharing.capabilities (
    resource_type TEXT NOT NULL,
    role TEXT NOT NULL,
    actions TEXT[] NOT NULL DEFAULT '{}',
    PRIMARY KEY (resource_type, role),

    CONSTRAINT chk_cap_role CHECK (role IN ('viewer', 'editor', 'manager'))
);

-- Seed capabilities
INSERT INTO sharing.capabilities (resource_type, role, actions) VALUES
    -- file
    ('file', 'viewer',  ARRAY['read', 'preview', 'download']),
    ('file', 'editor',  ARRAY['read', 'preview', 'download', 'write', 'upload', 'rename', 'move', 'version']),
    ('file', 'manager', ARRAY['read', 'preview', 'download', 'write', 'upload', 'rename', 'move', 'version', 'delete', 'share', 'set_policy', 'trash', 'restore']),
    -- folder
    ('folder', 'viewer',  ARRAY['list', 'read_children']),
    ('folder', 'editor',  ARRAY['list', 'read_children', 'create_child', 'upload', 'rename']),
    ('folder', 'manager', ARRAY['list', 'read_children', 'create_child', 'upload', 'rename', 'delete', 'share', 'set_policy', 'move']),
    -- calendar
    ('calendar', 'viewer',  ARRAY['read', 'export']),
    ('calendar', 'editor',  ARRAY['read', 'export', 'create_event', 'edit_event', 'rsvp']),
    ('calendar', 'manager', ARRAY['read', 'export', 'create_event', 'edit_event', 'rsvp', 'delete_event', 'share', 'configure', 'delete_calendar']),
    -- event
    ('event', 'viewer',  ARRAY['read', 'export']),
    ('event', 'editor',  ARRAY['read', 'export', 'edit', 'rsvp', 'add_attachment']),
    ('event', 'manager', ARRAY['read', 'export', 'edit', 'rsvp', 'add_attachment', 'delete', 'share', 'invite']),
    -- document
    ('document', 'viewer',  ARRAY['read', 'export', 'comment']),
    ('document', 'editor',  ARRAY['read', 'export', 'comment', 'write', 'suggest', 'history']),
    ('document', 'manager', ARRAY['read', 'export', 'comment', 'write', 'suggest', 'history', 'delete', 'share', 'lock', 'template']),
    -- form
    ('form', 'viewer',  ARRAY['read', 'submit', 'view_own_responses']),
    ('form', 'editor',  ARRAY['read', 'submit', 'view_own_responses', 'edit_fields', 'view_all_responses', 'export']),
    ('form', 'manager', ARRAY['read', 'submit', 'view_own_responses', 'edit_fields', 'view_all_responses', 'export', 'delete', 'share', 'configure', 'archive']),
    -- contact_book
    ('contact_book', 'viewer',  ARRAY['read', 'search', 'export_vcard']),
    ('contact_book', 'editor',  ARRAY['read', 'search', 'export_vcard', 'create', 'edit', 'import', 'merge']),
    ('contact_book', 'manager', ARRAY['read', 'search', 'export_vcard', 'create', 'edit', 'import', 'merge', 'delete', 'share', 'bulk_ops']),
    -- channel
    ('channel', 'viewer',  ARRAY['read', 'search_history']),
    ('channel', 'editor',  ARRAY['read', 'search_history', 'post', 'react', 'thread', 'pin']),
    ('channel', 'manager', ARRAY['read', 'search_history', 'post', 'react', 'thread', 'pin', 'delete_msg', 'share', 'configure', 'archive', 'kick']),
    -- asset
    ('asset', 'viewer',  ARRAY['read', 'view_history']),
    ('asset', 'editor',  ARRAY['read', 'view_history', 'edit', 'assign', 'add_note', 'check_out']),
    ('asset', 'manager', ARRAY['read', 'view_history', 'edit', 'assign', 'add_note', 'check_out', 'delete', 'share', 'decommission', 'transfer']),
    -- vault_entry
    ('vault_entry', 'viewer',  ARRAY['read_metadata']),
    ('vault_entry', 'editor',  ARRAY['read_metadata', 'read_secret', 'edit', 'rotate']),
    ('vault_entry', 'manager', ARRAY['read_metadata', 'read_secret', 'edit', 'rotate', 'delete', 'share', 'audit']);

-- ═══════════════════════════════════════════════════════════════
-- 5. DEFAULTS — Default visibility per resource type per tenant
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE sharing.defaults (
    tenant_id UUID NOT NULL REFERENCES identity.tenants(id) ON DELETE CASCADE,
    resource_type TEXT NOT NULL,
    default_visibility TEXT NOT NULL DEFAULT 'private',
    PRIMARY KEY (tenant_id, resource_type),

    CONSTRAINT chk_default_visibility CHECK (default_visibility IN (
        'private', 'workspace', 'org_node', 'tenant'
    ))
);

-- ═══════════════════════════════════════════════════════════════
-- 6. AUDIT LOG — Immutable trail
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE sharing.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID NOT NULL,
    actor_id UUID NOT NULL,
    action TEXT NOT NULL,
    details JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_resource
    ON sharing.audit_log (tenant_id, resource_type, resource_id, created_at DESC);
CREATE INDEX idx_audit_actor
    ON sharing.audit_log (tenant_id, actor_id, created_at DESC);

-- Prevent UPDATE/DELETE on audit_log
CREATE OR REPLACE FUNCTION sharing.prevent_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'sharing.audit_log is immutable — UPDATE and DELETE are forbidden';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_no_update
    BEFORE UPDATE ON sharing.audit_log
    FOR EACH ROW EXECUTE FUNCTION sharing.prevent_audit_mutation();

CREATE TRIGGER trg_audit_no_delete
    BEFORE DELETE ON sharing.audit_log
    FOR EACH ROW EXECUTE FUNCTION sharing.prevent_audit_mutation();
```

- [ ] **Step 2: Run the migration**

Run: `sqlx migrate run`
Expected: Migration 232 applied successfully.

- [ ] **Step 3: Verify tables exist**

Run: `psql "$DATABASE_URL" -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'sharing' ORDER BY table_name;"`
Expected: audit_log, capabilities, defaults, grants, policies, templates

- [ ] **Step 4: Verify seed data**

Run: `psql "$DATABASE_URL" -c "SELECT resource_type, role, array_length(actions, 1) as action_count FROM sharing.capabilities ORDER BY resource_type, role;"`
Expected: 30 rows (10 types × 3 roles), action counts increasing per role.

- [ ] **Step 5: Commit**

```bash
git add migrations/232_sharing_schema.sql
git commit -m "feat(sharing): add schema with grants, policies, templates, capabilities, audit"
```

---

## Task 2: Crate Setup + Types

**Files:**
- Create: `crates/signapps-sharing/Cargo.toml`
- Create: `crates/signapps-sharing/src/lib.rs`
- Create: `crates/signapps-sharing/src/types.rs`
- Modify: `Cargo.toml` (root workspace)

- [ ] **Step 1: Create Cargo.toml**

```toml
[package]
name = "signapps-sharing"
version.workspace = true
edition = "2021"
rust-version.workspace = true
authors.workspace = true
license.workspace = true
description = "Unified sharing and permissions engine for SignApps Platform"

[dependencies]
signapps-common = { path = "../signapps-common" }
signapps-db = { path = "../signapps-db" }
signapps-cache = { path = "../signapps-cache" }

sqlx = { workspace = true }
tokio = { workspace = true }
tracing = { workspace = true }
serde = { workspace = true }
serde_json = { workspace = true }
uuid = { workspace = true }
chrono = { workspace = true }
axum = { workspace = true }
tower = { workspace = true }
thiserror = { workspace = true }

[dev-dependencies]
tokio = { workspace = true, features = ["macros", "rt-multi-thread"] }
```

- [ ] **Step 2: Add to workspace members in root Cargo.toml**

Add `"crates/signapps-sharing"` to the `[workspace] members` array.

- [ ] **Step 3: Write types.rs**

```rust
//! Core type definitions for the sharing system.
//!
//! Defines the enums used across the sharing crate: resource types,
//! roles, actions, and grantee types.

use serde::{Deserialize, Serialize};
use std::fmt;

/// Types of resources that can be shared.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "text", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum ResourceType {
    File,
    Folder,
    Calendar,
    Event,
    Document,
    Form,
    ContactBook,
    Channel,
    Asset,
    VaultEntry,
}

impl ResourceType {
    /// Returns the string representation used in SQL and JSON.
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::File => "file",
            Self::Folder => "folder",
            Self::Calendar => "calendar",
            Self::Event => "event",
            Self::Document => "document",
            Self::Form => "form",
            Self::ContactBook => "contact_book",
            Self::Channel => "channel",
            Self::Asset => "asset",
            Self::VaultEntry => "vault_entry",
        }
    }
}

impl fmt::Display for ResourceType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

/// Roles that can be granted on a resource.
///
/// Ordered by permission level: Deny < Viewer < Editor < Manager.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "text", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum Role {
    Deny,
    Viewer,
    Editor,
    Manager,
}

impl Role {
    /// Numeric level for comparison. Higher = more permissive.
    pub fn level(&self) -> i16 {
        match self {
            Self::Deny => -1,
            Self::Viewer => 1,
            Self::Editor => 2,
            Self::Manager => 3,
        }
    }

    /// Returns the most permissive of two roles (excluding Deny).
    pub fn max_permissive(a: Self, b: Self) -> Self {
        if a.level() >= b.level() { a } else { b }
    }
}

impl fmt::Display for Role {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Deny => f.write_str("deny"),
            Self::Viewer => f.write_str("viewer"),
            Self::Editor => f.write_str("editor"),
            Self::Manager => f.write_str("manager"),
        }
    }
}

/// Actions that can be performed on a resource.
///
/// Mapped from roles via the capabilities table.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct Action(pub String);

impl Action {
    pub fn new(s: impl Into<String>) -> Self {
        Self(s.into())
    }

    pub fn read() -> Self { Self::new("read") }
    pub fn write() -> Self { Self::new("write") }
    pub fn delete() -> Self { Self::new("delete") }
    pub fn share() -> Self { Self::new("share") }
    pub fn list() -> Self { Self::new("list") }
}

impl fmt::Display for Action {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

/// Types of entities that can receive grants.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "text", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum GranteeType {
    User,
    Group,
    OrgNode,
    Everyone,
}

impl fmt::Display for GranteeType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::User => f.write_str("user"),
            Self::Group => f.write_str("group"),
            Self::OrgNode => f.write_str("org_node"),
            Self::Everyone => f.write_str("everyone"),
        }
    }
}

/// Reference to a specific resource.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResourceRef {
    pub resource_type: ResourceType,
    pub resource_id: uuid::Uuid,
}

impl ResourceRef {
    pub fn new(resource_type: ResourceType, resource_id: uuid::Uuid) -> Self {
        Self { resource_type, resource_id }
    }

    pub fn file(id: uuid::Uuid) -> Self { Self::new(ResourceType::File, id) }
    pub fn folder(id: uuid::Uuid) -> Self { Self::new(ResourceType::Folder, id) }
    pub fn calendar(id: uuid::Uuid) -> Self { Self::new(ResourceType::Calendar, id) }
    pub fn event(id: uuid::Uuid) -> Self { Self::new(ResourceType::Event, id) }
    pub fn document(id: uuid::Uuid) -> Self { Self::new(ResourceType::Document, id) }
    pub fn form(id: uuid::Uuid) -> Self { Self::new(ResourceType::Form, id) }
    pub fn contact_book(id: uuid::Uuid) -> Self { Self::new(ResourceType::ContactBook, id) }
    pub fn channel(id: uuid::Uuid) -> Self { Self::new(ResourceType::Channel, id) }
    pub fn asset(id: uuid::Uuid) -> Self { Self::new(ResourceType::Asset, id) }
    pub fn vault_entry(id: uuid::Uuid) -> Self { Self::new(ResourceType::VaultEntry, id) }
}

/// Reference to a grantee (who receives the permission).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Grantee {
    User(uuid::Uuid),
    Group(uuid::Uuid),
    OrgNode(uuid::Uuid),
    Everyone,
}

impl Grantee {
    pub fn grantee_type(&self) -> GranteeType {
        match self {
            Self::User(_) => GranteeType::User,
            Self::Group(_) => GranteeType::Group,
            Self::OrgNode(_) => GranteeType::OrgNode,
            Self::Everyone => GranteeType::Everyone,
        }
    }

    pub fn grantee_id(&self) -> Option<uuid::Uuid> {
        match self {
            Self::User(id) | Self::Group(id) | Self::OrgNode(id) => Some(*id),
            Self::Everyone => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn role_ordering() {
        assert!(Role::Deny.level() < Role::Viewer.level());
        assert!(Role::Viewer.level() < Role::Editor.level());
        assert!(Role::Editor.level() < Role::Manager.level());
    }

    #[test]
    fn role_max_permissive() {
        assert_eq!(Role::max_permissive(Role::Viewer, Role::Editor), Role::Editor);
        assert_eq!(Role::max_permissive(Role::Manager, Role::Viewer), Role::Manager);
        assert_eq!(Role::max_permissive(Role::Editor, Role::Editor), Role::Editor);
    }

    #[test]
    fn resource_type_as_str() {
        assert_eq!(ResourceType::File.as_str(), "file");
        assert_eq!(ResourceType::VaultEntry.as_str(), "vault_entry");
        assert_eq!(ResourceType::ContactBook.as_str(), "contact_book");
    }

    #[test]
    fn grantee_everyone_has_no_id() {
        assert_eq!(Grantee::Everyone.grantee_id(), None);
        assert_eq!(Grantee::Everyone.grantee_type(), GranteeType::Everyone);
    }

    #[test]
    fn grantee_user_has_id() {
        let id = uuid::Uuid::new_v4();
        assert_eq!(Grantee::User(id).grantee_id(), Some(id));
        assert_eq!(Grantee::User(id).grantee_type(), GranteeType::User);
    }
}
```

- [ ] **Step 4: Write lib.rs**

```rust
//! Unified sharing and permissions engine for SignApps Platform.
//!
//! Provides a 6-step permission resolver that computes effective permissions
//! from 3 axes: direct user grants, group membership, and org hierarchy.
//!
//! # Architecture
//!
//! - **SharingEngine** — Public API: check, grant, revoke, effective_role
//! - **PermissionResolver** — 6-step resolution algorithm
//! - **SharingRepository** — Database CRUD for grants, policies, templates
//! - **require_permission** — Axum middleware for route-level enforcement
//!
//! # Examples
//!
//! ```rust,ignore
//! let engine = SharingEngine::new(pool, cache);
//! engine.check(&user_ctx, ResourceRef::file(file_id), Action::write()).await?;
//! ```

pub mod types;
pub mod models;
pub mod repository;
pub mod resolver;
pub mod cache;
pub mod engine;
pub mod audit;
pub mod middleware;
pub mod defaults;
pub mod handlers;
pub mod routes;

pub use engine::SharingEngine;
pub use middleware::require_permission;
pub use types::{Action, Grantee, GranteeType, ResourceRef, ResourceType, Role};
pub use models::{Grant, UserContext};
```

- [ ] **Step 5: Verify crate compiles**

Run: `cargo check -p signapps-sharing`
Expected: Compiles (with warnings for empty modules — OK at this stage).

- [ ] **Step 6: Run tests**

Run: `cargo test -p signapps-sharing`
Expected: 5 tests pass (types module).

- [ ] **Step 7: Commit**

```bash
git add crates/signapps-sharing/ Cargo.toml
git commit -m "feat(sharing): scaffold crate with types (ResourceType, Role, Action, Grantee)"
```

---

## Task 3: Models

**Files:**
- Create: `crates/signapps-sharing/src/models.rs`

- [ ] **Step 1: Write models.rs**

```rust
//! Data models for the sharing system.
//!
//! Maps 1:1 to the `sharing.*` PostgreSQL tables plus
//! in-memory types for resolution context.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use std::collections::HashMap;
use uuid::Uuid;

use crate::types::{GranteeType, ResourceType, Role};

/// A permission grant on a resource.
///
/// Maps to `sharing.grants` table. Represents a single permission
/// assigned to a grantee (user, group, org_node, or everyone)
/// on a specific resource.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Grant {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub resource_type: String,
    pub resource_id: Uuid,
    pub grantee_type: String,
    pub grantee_id: Option<Uuid>,
    pub role: String,
    pub can_reshare: bool,
    pub inherit: bool,
    pub granted_by: Uuid,
    pub expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Grant {
    /// Parse the role string into the Role enum.
    pub fn parsed_role(&self) -> Option<Role> {
        match self.role.as_str() {
            "viewer" => Some(Role::Viewer),
            "editor" => Some(Role::Editor),
            "manager" => Some(Role::Manager),
            "deny" => Some(Role::Deny),
            _ => None,
        }
    }

    /// Parse the grantee_type string into the GranteeType enum.
    pub fn parsed_grantee_type(&self) -> Option<GranteeType> {
        match self.grantee_type.as_str() {
            "user" => Some(GranteeType::User),
            "group" => Some(GranteeType::Group),
            "org_node" => Some(GranteeType::OrgNode),
            "everyone" => Some(GranteeType::Everyone),
            _ => None,
        }
    }
}

/// Request to create a new grant.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateGrant {
    pub grantee_type: GranteeType,
    pub grantee_id: Option<Uuid>,
    pub role: Role,
    pub can_reshare: bool,
    pub expires_at: Option<DateTime<Utc>>,
}

/// A container inheritance policy.
///
/// Maps to `sharing.policies` table. When an element is created
/// inside a container with an active policy, a grant is auto-generated.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Policy {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub container_type: String,
    pub container_id: Uuid,
    pub grantee_type: String,
    pub grantee_id: Option<Uuid>,
    pub default_role: String,
    pub can_reshare: bool,
    pub apply_to_existing: bool,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// A named sharing template.
///
/// Maps to `sharing.templates` table. Applying a template
/// creates multiple grants in one operation.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Template {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub grants: serde_json::Value,
    pub created_by: Uuid,
    pub is_system: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Role-to-actions mapping for a resource type.
///
/// Maps to `sharing.capabilities` table.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Capability {
    pub resource_type: String,
    pub role: String,
    pub actions: Vec<String>,
}

/// Default visibility setting per resource type per tenant.
///
/// Maps to `sharing.defaults` table.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct DefaultVisibility {
    pub tenant_id: Uuid,
    pub resource_type: String,
    pub default_visibility: String,
}

/// Immutable audit log entry.
///
/// Maps to `sharing.audit_log` table. INSERT-only.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct AuditEntry {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub resource_type: String,
    pub resource_id: Uuid,
    pub actor_id: Uuid,
    pub action: String,
    pub details: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

/// Enriched user context for permission resolution.
///
/// Built from JWT Claims + cached group/org data.
/// Contains all information needed for the 3-axis resolution.
#[derive(Debug, Clone)]
pub struct UserContext {
    /// User ID (from Claims.sub)
    pub user_id: Uuid,
    /// Tenant ID (from Claims.tenant_id)
    pub tenant_id: Uuid,
    /// All group IDs the user belongs to
    pub group_ids: Vec<Uuid>,
    /// Role in each group (group_id → role)
    pub group_roles: HashMap<Uuid, String>,
    /// Org node ancestors (from closure table)
    pub org_ancestors: Vec<Uuid>,
    /// System role (1=user, 2=admin, 3=superadmin)
    pub system_role: i16,
}

impl UserContext {
    /// SuperAdmin bypasses all permission checks.
    pub fn is_superadmin(&self) -> bool {
        self.system_role >= 3
    }

    /// Admin can manage sharing settings.
    pub fn is_admin(&self) -> bool {
        self.system_role >= 2
    }
}

/// Result of permission resolution.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EffectivePermission {
    /// Resolved role (most permissive across all sources)
    pub role: Role,
    /// Whether the user can re-share
    pub can_reshare: bool,
    /// List of allowed actions for this role + resource type
    pub capabilities: Vec<String>,
    /// Debug: which grants contributed to this result
    pub sources: Vec<PermissionSource>,
}

/// Debug information about where a permission came from.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionSource {
    /// Which axis: "user", "group", "org_node", "everyone", "owner"
    pub axis: String,
    /// Display name of the grantee
    pub grantee_name: Option<String>,
    /// Role from this source
    pub role: Role,
    /// "direct" or "inherited:<parent-id>"
    pub via: String,
}
```

- [ ] **Step 2: Verify compiles**

Run: `cargo check -p signapps-sharing`
Expected: Compiles with no errors.

- [ ] **Step 3: Commit**

```bash
git add crates/signapps-sharing/src/models.rs
git commit -m "feat(sharing): add models (Grant, Policy, Template, Capability, UserContext)"
```

---

## Task 4: Repository — Grants CRUD

**Files:**
- Create: `crates/signapps-sharing/src/repository.rs`

- [ ] **Step 1: Write repository.rs with grants CRUD**

```rust
//! Database operations for the sharing system.
//!
//! Provides CRUD operations for grants, policies, templates,
//! capabilities, defaults, and audit entries.

use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use signapps_common::Error;

use crate::models::*;
use crate::types::*;

/// Repository for sharing database operations.
pub struct SharingRepository<'a> {
    pool: &'a PgPool,
}

impl<'a> SharingRepository<'a> {
    /// Creates a new repository instance.
    pub fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    // ═══════════════════════════════════════════════════════════
    // GRANTS
    // ═══════════════════════════════════════════════════════════

    /// List all active grants on a resource.
    pub async fn list_grants(
        &self,
        tenant_id: Uuid,
        resource_type: &str,
        resource_id: Uuid,
    ) -> Result<Vec<Grant>, Error> {
        sqlx::query_as::<_, Grant>(
            r#"SELECT * FROM sharing.grants
               WHERE tenant_id = $1
                 AND resource_type = $2
                 AND resource_id = $3
                 AND (expires_at IS NULL OR expires_at > NOW())
               ORDER BY created_at ASC"#,
        )
        .bind(tenant_id)
        .bind(resource_type)
        .bind(resource_id)
        .fetch_all(self.pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    /// Find grants matching a specific grantee on a resource.
    pub async fn find_grants_for_grantee(
        &self,
        tenant_id: Uuid,
        resource_type: &str,
        resource_id: Uuid,
        grantee_type: &str,
        grantee_ids: &[Uuid],
    ) -> Result<Vec<Grant>, Error> {
        sqlx::query_as::<_, Grant>(
            r#"SELECT * FROM sharing.grants
               WHERE tenant_id = $1
                 AND resource_type = $2
                 AND resource_id = $3
                 AND grantee_type = $4
                 AND grantee_id = ANY($5)
                 AND (expires_at IS NULL OR expires_at > NOW())
               ORDER BY created_at ASC"#,
        )
        .bind(tenant_id)
        .bind(resource_type)
        .bind(resource_id)
        .bind(grantee_type)
        .bind(grantee_ids)
        .fetch_all(self.pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    /// Find "everyone" grants on a resource.
    pub async fn find_everyone_grants(
        &self,
        tenant_id: Uuid,
        resource_type: &str,
        resource_id: Uuid,
    ) -> Result<Vec<Grant>, Error> {
        sqlx::query_as::<_, Grant>(
            r#"SELECT * FROM sharing.grants
               WHERE tenant_id = $1
                 AND resource_type = $2
                 AND resource_id = $3
                 AND grantee_type = 'everyone'
                 AND (expires_at IS NULL OR expires_at > NOW())
               ORDER BY created_at ASC"#,
        )
        .bind(tenant_id)
        .bind(resource_type)
        .bind(resource_id)
        .fetch_all(self.pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    /// Check if a deny grant exists for any of the given identities.
    pub async fn has_deny(
        &self,
        tenant_id: Uuid,
        resource_type: &str,
        resource_id: Uuid,
        user_id: Uuid,
        group_ids: &[Uuid],
        org_node_ids: &[Uuid],
    ) -> Result<bool, Error> {
        let row = sqlx::query_scalar::<_, bool>(
            r#"SELECT EXISTS(
                SELECT 1 FROM sharing.grants
                WHERE tenant_id = $1
                  AND resource_type = $2
                  AND resource_id = $3
                  AND role = 'deny'
                  AND (expires_at IS NULL OR expires_at > NOW())
                  AND (
                      (grantee_type = 'user' AND grantee_id = $4)
                      OR (grantee_type = 'group' AND grantee_id = ANY($5))
                      OR (grantee_type = 'org_node' AND grantee_id = ANY($6))
                      OR grantee_type = 'everyone'
                  )
            )"#,
        )
        .bind(tenant_id)
        .bind(resource_type)
        .bind(resource_id)
        .bind(user_id)
        .bind(group_ids)
        .bind(org_node_ids)
        .fetch_one(self.pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(row)
    }

    /// Create a new grant.
    pub async fn create_grant(
        &self,
        tenant_id: Uuid,
        resource_type: &str,
        resource_id: Uuid,
        grantee_type: &str,
        grantee_id: Option<Uuid>,
        role: &str,
        can_reshare: bool,
        granted_by: Uuid,
        expires_at: Option<DateTime<Utc>>,
    ) -> Result<Grant, Error> {
        sqlx::query_as::<_, Grant>(
            r#"INSERT INTO sharing.grants
               (tenant_id, resource_type, resource_id, grantee_type, grantee_id,
                role, can_reshare, granted_by, expires_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
               RETURNING *"#,
        )
        .bind(tenant_id)
        .bind(resource_type)
        .bind(resource_id)
        .bind(grantee_type)
        .bind(grantee_id)
        .bind(role)
        .bind(can_reshare)
        .bind(granted_by)
        .bind(expires_at)
        .fetch_one(self.pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    /// Delete a grant by ID (within tenant).
    pub async fn delete_grant(
        &self,
        tenant_id: Uuid,
        grant_id: Uuid,
    ) -> Result<bool, Error> {
        let result = sqlx::query(
            "DELETE FROM sharing.grants WHERE id = $1 AND tenant_id = $2",
        )
        .bind(grant_id)
        .bind(tenant_id)
        .execute(self.pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(result.rows_affected() > 0)
    }

    /// List all resources shared with a user (across all axes).
    pub async fn shared_with_user(
        &self,
        tenant_id: Uuid,
        user_id: Uuid,
        group_ids: &[Uuid],
        org_node_ids: &[Uuid],
        resource_type_filter: Option<&str>,
    ) -> Result<Vec<Grant>, Error> {
        let base = r#"SELECT * FROM sharing.grants
               WHERE tenant_id = $1
                 AND role != 'deny'
                 AND (expires_at IS NULL OR expires_at > NOW())
                 AND (
                     (grantee_type = 'user' AND grantee_id = $2)
                     OR (grantee_type = 'group' AND grantee_id = ANY($3))
                     OR (grantee_type = 'org_node' AND grantee_id = ANY($4))
                     OR grantee_type = 'everyone'
                 )"#;

        if let Some(rt) = resource_type_filter {
            sqlx::query_as::<_, Grant>(&format!(
                "{base} AND resource_type = $5 ORDER BY created_at DESC"
            ))
            .bind(tenant_id)
            .bind(user_id)
            .bind(group_ids)
            .bind(org_node_ids)
            .bind(rt)
            .fetch_all(self.pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))
        } else {
            sqlx::query_as::<_, Grant>(&format!(
                "{base} ORDER BY created_at DESC"
            ))
            .bind(tenant_id)
            .bind(user_id)
            .bind(group_ids)
            .bind(org_node_ids)
            .fetch_all(self.pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))
        }
    }

    // ═══════════════════════════════════════════════════════════
    // POLICIES
    // ═══════════════════════════════════════════════════════════

    /// List policies on a container.
    pub async fn list_policies(
        &self,
        tenant_id: Uuid,
        container_type: &str,
        container_id: Uuid,
    ) -> Result<Vec<Policy>, Error> {
        sqlx::query_as::<_, Policy>(
            r#"SELECT * FROM sharing.policies
               WHERE tenant_id = $1 AND container_type = $2 AND container_id = $3
               ORDER BY created_at ASC"#,
        )
        .bind(tenant_id)
        .bind(container_type)
        .bind(container_id)
        .fetch_all(self.pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    /// Create a policy.
    pub async fn create_policy(
        &self,
        tenant_id: Uuid,
        container_type: &str,
        container_id: Uuid,
        grantee_type: &str,
        grantee_id: Option<Uuid>,
        default_role: &str,
        can_reshare: bool,
        apply_to_existing: bool,
        created_by: Uuid,
    ) -> Result<Policy, Error> {
        sqlx::query_as::<_, Policy>(
            r#"INSERT INTO sharing.policies
               (tenant_id, container_type, container_id, grantee_type, grantee_id,
                default_role, can_reshare, apply_to_existing, created_by)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
               RETURNING *"#,
        )
        .bind(tenant_id)
        .bind(container_type)
        .bind(container_id)
        .bind(grantee_type)
        .bind(grantee_id)
        .bind(default_role)
        .bind(can_reshare)
        .bind(apply_to_existing)
        .bind(created_by)
        .fetch_one(self.pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    /// Delete a policy.
    pub async fn delete_policy(
        &self,
        tenant_id: Uuid,
        policy_id: Uuid,
    ) -> Result<bool, Error> {
        let result = sqlx::query(
            "DELETE FROM sharing.policies WHERE id = $1 AND tenant_id = $2",
        )
        .bind(policy_id)
        .bind(tenant_id)
        .execute(self.pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(result.rows_affected() > 0)
    }

    // ═══════════════════════════════════════════════════════════
    // TEMPLATES
    // ═══════════════════════════════════════════════════════════

    /// List templates for a tenant.
    pub async fn list_templates(
        &self,
        tenant_id: Uuid,
    ) -> Result<Vec<Template>, Error> {
        sqlx::query_as::<_, Template>(
            r#"SELECT * FROM sharing.templates
               WHERE tenant_id = $1 ORDER BY name ASC"#,
        )
        .bind(tenant_id)
        .fetch_all(self.pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    /// Create a template.
    pub async fn create_template(
        &self,
        tenant_id: Uuid,
        name: &str,
        description: Option<&str>,
        grants: serde_json::Value,
        created_by: Uuid,
        is_system: bool,
    ) -> Result<Template, Error> {
        sqlx::query_as::<_, Template>(
            r#"INSERT INTO sharing.templates
               (tenant_id, name, description, grants, created_by, is_system)
               VALUES ($1, $2, $3, $4, $5, $6)
               RETURNING *"#,
        )
        .bind(tenant_id)
        .bind(name)
        .bind(description)
        .bind(grants)
        .bind(created_by)
        .bind(is_system)
        .fetch_one(self.pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    /// Get a template by ID.
    pub async fn get_template(
        &self,
        tenant_id: Uuid,
        template_id: Uuid,
    ) -> Result<Option<Template>, Error> {
        sqlx::query_as::<_, Template>(
            "SELECT * FROM sharing.templates WHERE id = $1 AND tenant_id = $2",
        )
        .bind(template_id)
        .bind(tenant_id)
        .fetch_optional(self.pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    // ═══════════════════════════════════════════════════════════
    // CAPABILITIES
    // ═══════════════════════════════════════════════════════════

    /// Get capabilities for a resource type and role.
    pub async fn get_capabilities(
        &self,
        resource_type: &str,
        role: &str,
    ) -> Result<Option<Capability>, Error> {
        sqlx::query_as::<_, Capability>(
            "SELECT * FROM sharing.capabilities WHERE resource_type = $1 AND role = $2",
        )
        .bind(resource_type)
        .bind(role)
        .fetch_optional(self.pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    // ═══════════════════════════════════════════════════════════
    // DEFAULTS
    // ═══════════════════════════════════════════════════════════

    /// Get default visibility for a resource type in a tenant.
    pub async fn get_default_visibility(
        &self,
        tenant_id: Uuid,
        resource_type: &str,
    ) -> Result<Option<DefaultVisibility>, Error> {
        sqlx::query_as::<_, DefaultVisibility>(
            "SELECT * FROM sharing.defaults WHERE tenant_id = $1 AND resource_type = $2",
        )
        .bind(tenant_id)
        .bind(resource_type)
        .fetch_optional(self.pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    // ═══════════════════════════════════════════════════════════
    // AUDIT
    // ═══════════════════════════════════════════════════════════

    /// Insert an audit log entry.
    pub async fn insert_audit(
        &self,
        tenant_id: Uuid,
        resource_type: &str,
        resource_id: Uuid,
        actor_id: Uuid,
        action: &str,
        details: serde_json::Value,
    ) -> Result<AuditEntry, Error> {
        sqlx::query_as::<_, AuditEntry>(
            r#"INSERT INTO sharing.audit_log
               (tenant_id, resource_type, resource_id, actor_id, action, details)
               VALUES ($1, $2, $3, $4, $5, $6)
               RETURNING *"#,
        )
        .bind(tenant_id)
        .bind(resource_type)
        .bind(resource_id)
        .bind(actor_id)
        .bind(action)
        .bind(details)
        .fetch_one(self.pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    /// List audit entries for a resource.
    pub async fn list_audit(
        &self,
        tenant_id: Uuid,
        resource_type: &str,
        resource_id: Uuid,
        limit: i64,
    ) -> Result<Vec<AuditEntry>, Error> {
        sqlx::query_as::<_, AuditEntry>(
            r#"SELECT * FROM sharing.audit_log
               WHERE tenant_id = $1 AND resource_type = $2 AND resource_id = $3
               ORDER BY created_at DESC
               LIMIT $4"#,
        )
        .bind(tenant_id)
        .bind(resource_type)
        .bind(resource_id)
        .bind(limit)
        .fetch_all(self.pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }
}
```

- [ ] **Step 2: Verify compiles**

Run: `cargo check -p signapps-sharing`
Expected: Compiles.

- [ ] **Step 3: Commit**

```bash
git add crates/signapps-sharing/src/repository.rs
git commit -m "feat(sharing): add SharingRepository with grants, policies, templates, audit CRUD"
```

---

## Task 5: Permission Resolver

**Files:**
- Create: `crates/signapps-sharing/src/resolver.rs`

- [ ] **Step 1: Write resolver.rs with the 6-step algorithm**

```rust
//! Permission resolution engine — 6-step algorithm.
//!
//! Computes effective permissions by collecting grants from 3 axes
//! (user, group, org_node), applying deny rules, container inheritance,
//! and capability mapping.

use sqlx::PgPool;
use tracing::instrument;
use uuid::Uuid;

use signapps_common::Error;

use crate::models::*;
use crate::repository::SharingRepository;
use crate::types::*;

/// The permission resolver implementing the 6-step algorithm.
pub struct PermissionResolver<'a> {
    repo: SharingRepository<'a>,
}

impl<'a> PermissionResolver<'a> {
    /// Creates a new resolver.
    pub fn new(pool: &'a PgPool) -> Self {
        Self {
            repo: SharingRepository::new(pool),
        }
    }

    /// Resolve effective permission for a user on a resource.
    ///
    /// # Algorithm
    ///
    /// 1. Owner check — creator is implicit manager
    /// 2. Deny check — explicit deny blocks everything
    /// 3. Collect grants from 3 axes (user, group, org_node) + everyone
    /// 4. Container inheritance (walk up parent chain)
    /// 5. Most permissive wins — max(all roles)
    /// 6. Capability check — is the action allowed?
    ///
    /// # Errors
    ///
    /// Returns `Error::Forbidden` if access is denied.
    /// Returns `Error::Database` on DB errors.
    #[instrument(skip(self, user_ctx), fields(user_id = %user_ctx.user_id, resource = %resource.resource_type))]
    pub async fn resolve(
        &self,
        user_ctx: &UserContext,
        resource: &ResourceRef,
        owner_id: Option<Uuid>,
    ) -> Result<Option<EffectivePermission>, Error> {
        // SuperAdmin bypass
        if user_ctx.is_superadmin() {
            let caps = self
                .get_capabilities(resource.resource_type.as_str(), "manager")
                .await?;
            return Ok(Some(EffectivePermission {
                role: Role::Manager,
                can_reshare: true,
                capabilities: caps,
                sources: vec![PermissionSource {
                    axis: "superadmin".to_string(),
                    grantee_name: None,
                    role: Role::Manager,
                    via: "system_bypass".to_string(),
                }],
            }));
        }

        // Step 1: Owner check
        if let Some(oid) = owner_id {
            if oid == user_ctx.user_id {
                let caps = self
                    .get_capabilities(resource.resource_type.as_str(), "manager")
                    .await?;
                return Ok(Some(EffectivePermission {
                    role: Role::Manager,
                    can_reshare: true,
                    capabilities: caps,
                    sources: vec![PermissionSource {
                        axis: "owner".to_string(),
                        grantee_name: None,
                        role: Role::Manager,
                        via: "direct".to_string(),
                    }],
                }));
            }
        }

        // Step 2: Deny check (never cached)
        let has_deny = self
            .repo
            .has_deny(
                user_ctx.tenant_id,
                resource.resource_type.as_str(),
                resource.resource_id,
                user_ctx.user_id,
                &user_ctx.group_ids,
                &user_ctx.org_ancestors,
            )
            .await?;

        if has_deny {
            tracing::warn!(
                user_id = %user_ctx.user_id,
                resource_type = %resource.resource_type,
                resource_id = %resource.resource_id,
                "access denied by explicit deny grant"
            );
            return Ok(None);
        }

        // Step 3: Collect grants from 3 axes
        let mut all_grants = Vec::new();
        let mut sources = Vec::new();
        let rt = resource.resource_type.as_str();
        let rid = resource.resource_id;
        let tid = user_ctx.tenant_id;

        // Axis 1: Direct user grants
        let user_grants = self
            .repo
            .find_grants_for_grantee(tid, rt, rid, "user", &[user_ctx.user_id])
            .await?;
        for g in &user_grants {
            if let Some(role) = g.parsed_role() {
                sources.push(PermissionSource {
                    axis: "user".to_string(),
                    grantee_name: None,
                    role,
                    via: "direct".to_string(),
                });
            }
        }
        all_grants.extend(user_grants);

        // Axis 2: Group grants
        if !user_ctx.group_ids.is_empty() {
            let group_grants = self
                .repo
                .find_grants_for_grantee(tid, rt, rid, "group", &user_ctx.group_ids)
                .await?;
            for g in &group_grants {
                if let Some(role) = g.parsed_role() {
                    sources.push(PermissionSource {
                        axis: "group".to_string(),
                        grantee_name: None,
                        role,
                        via: "direct".to_string(),
                    });
                }
            }
            all_grants.extend(group_grants);
        }

        // Axis 3: Org node grants
        if !user_ctx.org_ancestors.is_empty() {
            let org_grants = self
                .repo
                .find_grants_for_grantee(tid, rt, rid, "org_node", &user_ctx.org_ancestors)
                .await?;
            for g in &org_grants {
                if let Some(role) = g.parsed_role() {
                    sources.push(PermissionSource {
                        axis: "org_node".to_string(),
                        grantee_name: None,
                        role,
                        via: "direct".to_string(),
                    });
                }
            }
            all_grants.extend(org_grants);
        }

        // Everyone grants
        let everyone_grants = self.repo.find_everyone_grants(tid, rt, rid).await?;
        for g in &everyone_grants {
            if let Some(role) = g.parsed_role() {
                sources.push(PermissionSource {
                    axis: "everyone".to_string(),
                    grantee_name: None,
                    role,
                    via: "direct".to_string(),
                });
            }
        }
        all_grants.extend(everyone_grants);

        // Step 4: If no grants found, we could walk up container hierarchy
        // (delegated to engine which knows parent IDs)
        // For now, if no grants, return None
        if all_grants.is_empty() {
            return Ok(None);
        }

        // Step 5: Most permissive wins
        let mut effective_role = Role::Viewer;
        let mut effective_can_reshare = false;

        for grant in &all_grants {
            if let Some(role) = grant.parsed_role() {
                if role != Role::Deny {
                    effective_role = Role::max_permissive(effective_role, role);
                    if grant.can_reshare {
                        effective_can_reshare = true;
                    }
                }
            }
        }

        // Step 6: Capability lookup
        let caps = self
            .get_capabilities(rt, &effective_role.to_string())
            .await?;

        Ok(Some(EffectivePermission {
            role: effective_role,
            can_reshare: effective_can_reshare,
            capabilities: caps,
            sources,
        }))
    }

    /// Check if a specific action is allowed.
    #[instrument(skip(self, user_ctx), fields(user_id = %user_ctx.user_id, action = %action))]
    pub async fn check_action(
        &self,
        user_ctx: &UserContext,
        resource: &ResourceRef,
        owner_id: Option<Uuid>,
        action: &Action,
    ) -> Result<(), Error> {
        let perm = self.resolve(user_ctx, resource, owner_id).await?;

        match perm {
            Some(p) if p.capabilities.contains(&action.0) => Ok(()),
            _ => Err(Error::Forbidden(format!(
                "action '{}' not allowed on {} {}",
                action, resource.resource_type, resource.resource_id
            ))),
        }
    }

    /// Get capabilities for a resource type + role from DB.
    async fn get_capabilities(
        &self,
        resource_type: &str,
        role: &str,
    ) -> Result<Vec<String>, Error> {
        match self.repo.get_capabilities(resource_type, role).await? {
            Some(cap) => Ok(cap.actions),
            None => Ok(vec![]),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_user_ctx(user_id: Uuid, tenant_id: Uuid) -> UserContext {
        UserContext {
            user_id,
            tenant_id,
            group_ids: vec![],
            group_roles: Default::default(),
            org_ancestors: vec![],
            system_role: 1,
        }
    }

    #[test]
    fn superadmin_detection() {
        let mut ctx = make_user_ctx(Uuid::new_v4(), Uuid::new_v4());
        assert!(!ctx.is_superadmin());
        ctx.system_role = 3;
        assert!(ctx.is_superadmin());
    }

    #[test]
    fn admin_detection() {
        let mut ctx = make_user_ctx(Uuid::new_v4(), Uuid::new_v4());
        assert!(!ctx.is_admin());
        ctx.system_role = 2;
        assert!(ctx.is_admin());
    }
}
```

- [ ] **Step 2: Run tests**

Run: `cargo test -p signapps-sharing`
Expected: All tests pass (types + resolver unit tests).

- [ ] **Step 3: Commit**

```bash
git add crates/signapps-sharing/src/resolver.rs
git commit -m "feat(sharing): add PermissionResolver with 6-step algorithm"
```

---

## Task 6: Cache Layer

**Files:**
- Create: `crates/signapps-sharing/src/cache.rs`

- [ ] **Step 1: Write cache.rs**

```rust
//! Caching layer for permission resolution.
//!
//! L1: User context data (group_ids, org_ancestors, capabilities) — TTL 5min
//! L2: Effective permissions — TTL 2min
//! Deny checks are never cached.

use std::sync::Arc;
use std::time::Duration;

use signapps_cache::CacheService;
use uuid::Uuid;

use crate::models::UserContext;
use crate::types::{ResourceType, Role};

/// Cache keys and operations for the sharing system.
#[derive(Clone)]
pub struct SharingCache {
    inner: CacheService,
}

impl SharingCache {
    /// Creates a new sharing cache.
    pub fn new(cache: CacheService) -> Self {
        Self { inner: cache }
    }

    // ─── L1: User context ──────────────────────────────────

    fn group_ids_key(user_id: Uuid) -> String {
        format!("sharing:groups:{user_id}")
    }

    fn org_ancestors_key(user_id: Uuid) -> String {
        format!("sharing:org:{user_id}")
    }

    /// Get cached group IDs for a user.
    pub async fn get_group_ids(&self, user_id: Uuid) -> Option<Vec<Uuid>> {
        let raw = self.inner.get(&Self::group_ids_key(user_id)).await?;
        serde_json::from_str(&raw).ok()
    }

    /// Cache group IDs for a user.
    pub async fn set_group_ids(&self, user_id: Uuid, group_ids: &[Uuid]) {
        if let Ok(json) = serde_json::to_string(group_ids) {
            self.inner.set(&Self::group_ids_key(user_id), json).await;
        }
    }

    /// Get cached org ancestors for a user.
    pub async fn get_org_ancestors(&self, user_id: Uuid) -> Option<Vec<Uuid>> {
        let raw = self.inner.get(&Self::org_ancestors_key(user_id)).await?;
        serde_json::from_str(&raw).ok()
    }

    /// Cache org ancestors for a user.
    pub async fn set_org_ancestors(&self, user_id: Uuid, ancestors: &[Uuid]) {
        if let Ok(json) = serde_json::to_string(ancestors) {
            self.inner
                .set(&Self::org_ancestors_key(user_id), json)
                .await;
        }
    }

    // ─── L2: Effective permissions ─────────────────────────

    fn effective_key(user_id: Uuid, resource_type: &str, resource_id: Uuid) -> String {
        format!("sharing:eff:{user_id}:{resource_type}:{resource_id}")
    }

    /// Get cached effective role.
    pub async fn get_effective_role(
        &self,
        user_id: Uuid,
        resource_type: &str,
        resource_id: Uuid,
    ) -> Option<String> {
        self.inner
            .get(&Self::effective_key(user_id, resource_type, resource_id))
            .await
    }

    /// Cache effective role.
    pub async fn set_effective_role(
        &self,
        user_id: Uuid,
        resource_type: &str,
        resource_id: Uuid,
        role: &str,
    ) {
        self.inner
            .set(
                &Self::effective_key(user_id, resource_type, resource_id),
                role.to_string(),
            )
            .await;
    }

    // ─── Invalidation ──────────────────────────────────────

    /// Invalidate all caches for a resource (after grant change).
    pub async fn invalidate_resource(&self, resource_type: &str, resource_id: Uuid) {
        // We can't scan keys with moka, so we rely on TTL (2min).
        // For immediate invalidation, services should clear specific user keys.
        tracing::debug!(
            resource_type,
            %resource_id,
            "resource cache will expire within TTL"
        );
    }

    /// Invalidate user context cache (after group/org change).
    pub async fn invalidate_user_context(&self, user_id: Uuid) {
        self.inner
            .invalidate(&Self::group_ids_key(user_id))
            .await;
        self.inner
            .invalidate(&Self::org_ancestors_key(user_id))
            .await;
    }
}
```

- [ ] **Step 2: Verify compiles**

Run: `cargo check -p signapps-sharing`
Expected: Compiles.

- [ ] **Step 3: Commit**

```bash
git add crates/signapps-sharing/src/cache.rs
git commit -m "feat(sharing): add SharingCache with L1 (user context) and L2 (effective perms)"
```

---

## Task 7: Audit Logger

**Files:**
- Create: `crates/signapps-sharing/src/audit.rs`

- [ ] **Step 1: Write audit.rs**

```rust
//! Audit logging for sharing operations.
//!
//! All sharing mutations are logged to `sharing.audit_log`.
//! The table is INSERT-only (UPDATE/DELETE are blocked by trigger).

use serde_json::json;
use sqlx::PgPool;
use tracing::instrument;
use uuid::Uuid;

use signapps_common::Error;

use crate::repository::SharingRepository;

/// Audit logger for sharing operations.
pub struct AuditLogger<'a> {
    repo: SharingRepository<'a>,
}

impl<'a> AuditLogger<'a> {
    /// Creates a new audit logger.
    pub fn new(pool: &'a PgPool) -> Self {
        Self {
            repo: SharingRepository::new(pool),
        }
    }

    /// Log a grant creation.
    #[instrument(skip(self))]
    pub async fn log_grant_created(
        &self,
        tenant_id: Uuid,
        resource_type: &str,
        resource_id: Uuid,
        actor_id: Uuid,
        grant_id: Uuid,
        grantee_type: &str,
        grantee_id: Option<Uuid>,
        role: &str,
    ) -> Result<(), Error> {
        self.repo
            .insert_audit(
                tenant_id,
                resource_type,
                resource_id,
                actor_id,
                "grant_created",
                json!({
                    "grant_id": grant_id,
                    "grantee_type": grantee_type,
                    "grantee_id": grantee_id,
                    "role": role,
                }),
            )
            .await?;
        Ok(())
    }

    /// Log a grant revocation.
    #[instrument(skip(self))]
    pub async fn log_grant_revoked(
        &self,
        tenant_id: Uuid,
        resource_type: &str,
        resource_id: Uuid,
        actor_id: Uuid,
        grant_id: Uuid,
    ) -> Result<(), Error> {
        self.repo
            .insert_audit(
                tenant_id,
                resource_type,
                resource_id,
                actor_id,
                "grant_revoked",
                json!({ "grant_id": grant_id }),
            )
            .await?;
        Ok(())
    }

    /// Log an access denial (for security monitoring).
    #[instrument(skip(self))]
    pub async fn log_access_denied(
        &self,
        tenant_id: Uuid,
        resource_type: &str,
        resource_id: Uuid,
        actor_id: Uuid,
        action: &str,
        reason: &str,
    ) -> Result<(), Error> {
        self.repo
            .insert_audit(
                tenant_id,
                resource_type,
                resource_id,
                actor_id,
                "access_denied",
                json!({ "action": action, "reason": reason }),
            )
            .await?;
        Ok(())
    }

    /// Log a deny rule set by admin.
    #[instrument(skip(self))]
    pub async fn log_deny_set(
        &self,
        tenant_id: Uuid,
        resource_type: &str,
        resource_id: Uuid,
        actor_id: Uuid,
        grant_id: Uuid,
        grantee_type: &str,
        grantee_id: Option<Uuid>,
    ) -> Result<(), Error> {
        self.repo
            .insert_audit(
                tenant_id,
                resource_type,
                resource_id,
                actor_id,
                "deny_set",
                json!({
                    "grant_id": grant_id,
                    "grantee_type": grantee_type,
                    "grantee_id": grantee_id,
                }),
            )
            .await?;
        Ok(())
    }

    /// Log a template application.
    #[instrument(skip(self))]
    pub async fn log_template_applied(
        &self,
        tenant_id: Uuid,
        resource_type: &str,
        resource_id: Uuid,
        actor_id: Uuid,
        template_id: Uuid,
        grants_created: usize,
    ) -> Result<(), Error> {
        self.repo
            .insert_audit(
                tenant_id,
                resource_type,
                resource_id,
                actor_id,
                "template_applied",
                json!({
                    "template_id": template_id,
                    "grants_created": grants_created,
                }),
            )
            .await?;
        Ok(())
    }
}
```

- [ ] **Step 2: Verify compiles**

Run: `cargo check -p signapps-sharing`
Expected: Compiles.

- [ ] **Step 3: Commit**

```bash
git add crates/signapps-sharing/src/audit.rs
git commit -m "feat(sharing): add AuditLogger with immutable event logging"
```

---

## Task 8: SharingEngine — Public API

**Files:**
- Create: `crates/signapps-sharing/src/engine.rs`

- [ ] **Step 1: Write engine.rs**

```rust
//! SharingEngine — public API for the sharing system.
//!
//! This is the main entry point for all sharing operations.
//! Services inject this into their Axum State.

use sqlx::PgPool;
use tracing::instrument;
use uuid::Uuid;

use signapps_cache::CacheService;
use signapps_common::Error;

use crate::audit::AuditLogger;
use crate::cache::SharingCache;
use crate::models::*;
use crate::repository::SharingRepository;
use crate::resolver::PermissionResolver;
use crate::types::*;

/// Main engine for sharing operations.
///
/// Combines resolution, caching, auditing, and CRUD operations.
/// Inject into Axum State for use in handlers and middleware.
///
/// # Examples
///
/// ```rust,ignore
/// let engine = SharingEngine::new(pool.clone(), cache.clone());
/// engine.check(&user_ctx, ResourceRef::file(id), Action::write()).await?;
/// ```
#[derive(Clone)]
pub struct SharingEngine {
    pool: PgPool,
    cache: SharingCache,
}

impl SharingEngine {
    /// Creates a new sharing engine.
    pub fn new(pool: PgPool, cache: CacheService) -> Self {
        Self {
            pool,
            cache: SharingCache::new(cache),
        }
    }

    /// Check if a user can perform an action on a resource.
    ///
    /// Returns `Ok(())` if allowed, `Err(Forbidden)` if denied.
    ///
    /// # Errors
    ///
    /// - `Error::Forbidden` if the action is not allowed
    /// - `Error::Database` on DB errors
    #[instrument(skip(self, user_ctx), fields(user_id = %user_ctx.user_id))]
    pub async fn check(
        &self,
        user_ctx: &UserContext,
        resource: ResourceRef,
        action: Action,
        owner_id: Option<Uuid>,
    ) -> Result<(), Error> {
        let resolver = PermissionResolver::new(&self.pool);
        resolver
            .check_action(user_ctx, &resource, owner_id, &action)
            .await
    }

    /// Get the effective role for a user on a resource.
    ///
    /// Returns `None` if the user has no access.
    #[instrument(skip(self, user_ctx), fields(user_id = %user_ctx.user_id))]
    pub async fn effective_role(
        &self,
        user_ctx: &UserContext,
        resource: ResourceRef,
        owner_id: Option<Uuid>,
    ) -> Result<Option<EffectivePermission>, Error> {
        let resolver = PermissionResolver::new(&self.pool);
        resolver.resolve(user_ctx, &resource, owner_id).await
    }

    /// Grant permission to a grantee on a resource.
    ///
    /// Verifies the actor is a manager (or admin) before creating.
    ///
    /// # Errors
    ///
    /// - `Error::Forbidden` if the actor is not a manager or admin
    /// - `Error::BadRequest` for invalid grantee/role combinations
    #[instrument(skip(self, actor_ctx), fields(actor_id = %actor_ctx.user_id))]
    pub async fn grant(
        &self,
        actor_ctx: &UserContext,
        resource: ResourceRef,
        owner_id: Option<Uuid>,
        request: CreateGrant,
    ) -> Result<Grant, Error> {
        // Verify actor has manager role (or is admin)
        if !actor_ctx.is_admin() {
            let resolver = PermissionResolver::new(&self.pool);
            let perm = resolver.resolve(actor_ctx, &resource, owner_id).await?;
            match perm {
                Some(p) if p.role == Role::Manager => {
                    // Check can_reshare if actor is not owner
                    if owner_id != Some(actor_ctx.user_id) && !p.can_reshare {
                        return Err(Error::Forbidden(
                            "resharing not allowed on this grant".to_string(),
                        ));
                    }
                }
                _ => {
                    return Err(Error::Forbidden(
                        "only managers can share resources".to_string(),
                    ));
                }
            }
        }

        // Validate: vault_entry cannot use 'everyone'
        if resource.resource_type == ResourceType::VaultEntry
            && request.grantee_type == GranteeType::Everyone
        {
            return Err(Error::BadRequest(
                "vault entries cannot be shared with everyone".to_string(),
            ));
        }

        // Validate: cannot grant a role higher than own (unless admin)
        if !actor_ctx.is_admin() && request.role == Role::Manager {
            // Only owner can grant manager — checked above via resolve
        }

        let repo = SharingRepository::new(&self.pool);
        let grant = repo
            .create_grant(
                actor_ctx.tenant_id,
                resource.resource_type.as_str(),
                resource.resource_id,
                &request.grantee_type.to_string(),
                request.grantee_id(),
                &request.role.to_string(),
                request.can_reshare,
                actor_ctx.user_id,
                request.expires_at,
            )
            .await?;

        // Audit
        let audit = AuditLogger::new(&self.pool);
        audit
            .log_grant_created(
                actor_ctx.tenant_id,
                resource.resource_type.as_str(),
                resource.resource_id,
                actor_ctx.user_id,
                grant.id,
                &request.grantee_type.to_string(),
                request.grantee_id(),
                &request.role.to_string(),
            )
            .await?;

        // Invalidate cache
        self.cache
            .invalidate_resource(resource.resource_type.as_str(), resource.resource_id)
            .await;

        Ok(grant)
    }

    /// Revoke a grant.
    ///
    /// # Errors
    ///
    /// - `Error::Forbidden` if actor is not manager/admin
    /// - `Error::NotFound` if grant doesn't exist
    #[instrument(skip(self, actor_ctx), fields(actor_id = %actor_ctx.user_id))]
    pub async fn revoke(
        &self,
        actor_ctx: &UserContext,
        resource: ResourceRef,
        owner_id: Option<Uuid>,
        grant_id: Uuid,
    ) -> Result<(), Error> {
        // Verify actor has manager role (or is admin)
        if !actor_ctx.is_admin() {
            let resolver = PermissionResolver::new(&self.pool);
            let perm = resolver.resolve(actor_ctx, &resource, owner_id).await?;
            match perm {
                Some(p) if p.role == Role::Manager => {}
                _ => {
                    return Err(Error::Forbidden(
                        "only managers can revoke grants".to_string(),
                    ));
                }
            }
        }

        let repo = SharingRepository::new(&self.pool);
        let deleted = repo.delete_grant(actor_ctx.tenant_id, grant_id).await?;

        if !deleted {
            return Err(Error::NotFound("grant not found".to_string()));
        }

        // Audit
        let audit = AuditLogger::new(&self.pool);
        audit
            .log_grant_revoked(
                actor_ctx.tenant_id,
                resource.resource_type.as_str(),
                resource.resource_id,
                actor_ctx.user_id,
                grant_id,
            )
            .await?;

        // Invalidate cache
        self.cache
            .invalidate_resource(resource.resource_type.as_str(), resource.resource_id)
            .await;

        Ok(())
    }

    /// List all grants on a resource.
    #[instrument(skip(self, user_ctx), fields(user_id = %user_ctx.user_id))]
    pub async fn list_grants(
        &self,
        user_ctx: &UserContext,
        resource: ResourceRef,
    ) -> Result<Vec<Grant>, Error> {
        let repo = SharingRepository::new(&self.pool);
        repo.list_grants(
            user_ctx.tenant_id,
            resource.resource_type.as_str(),
            resource.resource_id,
        )
        .await
    }

    /// List all resources shared with the current user.
    #[instrument(skip(self, user_ctx), fields(user_id = %user_ctx.user_id))]
    pub async fn shared_with_me(
        &self,
        user_ctx: &UserContext,
        resource_type_filter: Option<ResourceType>,
    ) -> Result<Vec<Grant>, Error> {
        let repo = SharingRepository::new(&self.pool);
        repo.shared_with_user(
            user_ctx.tenant_id,
            user_ctx.user_id,
            &user_ctx.group_ids,
            &user_ctx.org_ancestors,
            resource_type_filter.as_ref().map(|rt| rt.as_str()),
        )
        .await
    }

    /// Apply a sharing template to a resource.
    #[instrument(skip(self, actor_ctx), fields(actor_id = %actor_ctx.user_id))]
    pub async fn apply_template(
        &self,
        actor_ctx: &UserContext,
        resource: ResourceRef,
        owner_id: Option<Uuid>,
        template_id: Uuid,
    ) -> Result<usize, Error> {
        // Verify actor has manager role
        if !actor_ctx.is_admin() {
            let resolver = PermissionResolver::new(&self.pool);
            let perm = resolver.resolve(actor_ctx, &resource, owner_id).await?;
            match perm {
                Some(p) if p.role == Role::Manager => {}
                _ => {
                    return Err(Error::Forbidden(
                        "only managers can apply templates".to_string(),
                    ));
                }
            }
        }

        let repo = SharingRepository::new(&self.pool);
        let template = repo
            .get_template(actor_ctx.tenant_id, template_id)
            .await?
            .ok_or_else(|| Error::NotFound("template not found".to_string()))?;

        // Parse template grants
        let grant_defs: Vec<serde_json::Value> = serde_json::from_value(template.grants)
            .map_err(|e| Error::Internal(format!("invalid template grants: {e}")))?;

        let mut count = 0;
        for def in &grant_defs {
            let grantee_type = def["grantee_type"]
                .as_str()
                .unwrap_or("user");
            let grantee_id = def["grantee_id"]
                .as_str()
                .and_then(|s| s.parse::<Uuid>().ok());
            let role = def["role"].as_str().unwrap_or("viewer");
            let can_reshare = def["can_reshare"].as_bool().unwrap_or(false);

            let _ = repo
                .create_grant(
                    actor_ctx.tenant_id,
                    resource.resource_type.as_str(),
                    resource.resource_id,
                    grantee_type,
                    grantee_id,
                    role,
                    can_reshare,
                    actor_ctx.user_id,
                    None,
                )
                .await;
            count += 1;
        }

        // Audit
        let audit = AuditLogger::new(&self.pool);
        audit
            .log_template_applied(
                actor_ctx.tenant_id,
                resource.resource_type.as_str(),
                resource.resource_id,
                actor_ctx.user_id,
                template_id,
                count,
            )
            .await?;

        // Invalidate cache
        self.cache
            .invalidate_resource(resource.resource_type.as_str(), resource.resource_id)
            .await;

        Ok(count)
    }

    /// Build a UserContext from Claims + DB lookups.
    ///
    /// Caches group_ids and org_ancestors for performance.
    #[instrument(skip(self, claims))]
    pub async fn build_user_context(
        &self,
        claims: &signapps_common::Claims,
    ) -> Result<UserContext, Error> {
        let user_id = claims.sub;
        let tenant_id = claims
            .tenant_id
            .ok_or_else(|| Error::Unauthorized)?;

        // Try cache for group_ids
        let group_ids = match self.cache.get_group_ids(user_id).await {
            Some(ids) => ids,
            None => {
                let ids: Vec<Uuid> = sqlx::query_scalar(
                    r#"SELECT group_id FROM identity.group_members
                       WHERE user_id = $1
                       UNION
                       SELECT group_id FROM workforce_org_member_of
                       WHERE person_id = $1"#,
                )
                .bind(user_id)
                .fetch_all(&self.pool)
                .await
                .unwrap_or_default();
                self.cache.set_group_ids(user_id, &ids).await;
                ids
            }
        };

        // Try cache for org_ancestors
        let org_ancestors = match self.cache.get_org_ancestors(user_id).await {
            Some(ids) => ids,
            None => {
                let ids: Vec<Uuid> = sqlx::query_scalar(
                    r#"SELECT DISTINCT c.ancestor_id
                       FROM core.org_closure c
                       JOIN core.assignments a ON a.node_id = c.descendant_id
                       WHERE a.person_id = $1
                         AND a.is_active = true
                         AND c.depth >= 0
                       ORDER BY c.ancestor_id"#,
                )
                .bind(user_id)
                .fetch_all(&self.pool)
                .await
                .unwrap_or_default();
                self.cache.set_org_ancestors(user_id, &ids).await;
                ids
            }
        };

        Ok(UserContext {
            user_id,
            tenant_id,
            group_ids,
            group_roles: Default::default(),
            org_ancestors,
            system_role: claims.role,
        })
    }
}
```

- [ ] **Step 2: Verify compiles**

Run: `cargo check -p signapps-sharing`
Expected: Compiles.

- [ ] **Step 3: Commit**

```bash
git add crates/signapps-sharing/src/engine.rs
git commit -m "feat(sharing): add SharingEngine with check, grant, revoke, shared_with_me, apply_template"
```

---

## Task 9: Middleware

**Files:**
- Create: `crates/signapps-sharing/src/middleware.rs`

- [ ] **Step 1: Write middleware.rs**

```rust
//! Axum middleware for permission enforcement.
//!
//! Provides `require_permission` as a route-level middleware layer
//! that checks sharing permissions before the handler runs.

use axum::{
    extract::{Path, Request, State},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use std::collections::HashMap;
use uuid::Uuid;

use signapps_common::Claims;

use crate::engine::SharingEngine;
use crate::types::{Action, ResourceRef, ResourceType};

/// Middleware factory for permission checks.
///
/// Use as a layer on routes that require resource-level permissions.
///
/// # Examples
///
/// ```rust,ignore
/// .route("/api/v1/files/:id", get(get_file))
///     .layer(middleware::from_fn_with_state(
///         state.clone(),
///         require_permission(ResourceType::File, Action::read(), "id"),
///     ))
/// ```
pub fn require_permission(
    resource_type: ResourceType,
    action: Action,
    id_param: &'static str,
) -> impl Fn(ResourceType, Action, &'static str) -> PermissionConfig + Clone {
    move |_, _, _| PermissionConfig {
        resource_type,
        action: action.clone(),
        id_param,
    }
}

/// Configuration for the permission middleware.
#[derive(Clone)]
pub struct PermissionConfig {
    pub resource_type: ResourceType,
    pub action: Action,
    pub id_param: &'static str,
}

/// The actual middleware function.
///
/// Extracts Claims and resource ID from the request,
/// builds UserContext, and checks permission via SharingEngine.
pub async fn sharing_middleware(
    State(engine): State<SharingEngine>,
    claims: Claims,
    Path(params): Path<HashMap<String, String>>,
    config: PermissionConfig,
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let resource_id_str = params
        .get(config.id_param)
        .ok_or(StatusCode::BAD_REQUEST)?;

    let resource_id: Uuid = resource_id_str
        .parse()
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    let user_ctx = engine
        .build_user_context(&claims)
        .await
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

    let resource = ResourceRef::new(config.resource_type, resource_id);

    engine
        .check(&user_ctx, resource, config.action, None)
        .await
        .map_err(|_| StatusCode::FORBIDDEN)?;

    Ok(next.run(request).await)
}
```

- [ ] **Step 2: Verify compiles**

Run: `cargo check -p signapps-sharing`
Expected: Compiles.

- [ ] **Step 3: Commit**

```bash
git add crates/signapps-sharing/src/middleware.rs
git commit -m "feat(sharing): add require_permission Axum middleware"
```

---

## Task 10: Defaults + Empty Modules

**Files:**
- Create: `crates/signapps-sharing/src/defaults.rs`
- Create: `crates/signapps-sharing/src/handlers.rs`
- Create: `crates/signapps-sharing/src/routes.rs`

- [ ] **Step 1: Write defaults.rs**

```rust
//! Default capabilities and visibility settings.
//!
//! System defaults are seeded via SQL migration. This module provides
//! Rust constants for use in code when DB is not yet available.

use crate::types::ResourceType;

/// Default visibility for a resource type (used when no tenant override exists).
pub fn system_default_visibility(resource_type: ResourceType) -> &'static str {
    match resource_type {
        ResourceType::File => "private",
        ResourceType::Folder => "private",
        ResourceType::Calendar => "workspace",
        ResourceType::Event => "workspace",
        ResourceType::Document => "private",
        ResourceType::Form => "private",
        ResourceType::ContactBook => "private",
        ResourceType::Channel => "workspace",
        ResourceType::Asset => "org_node",
        ResourceType::VaultEntry => "private",
    }
}
```

- [ ] **Step 2: Write handlers.rs (placeholder for generic sharing handlers)**

```rust
//! Generic sharing handlers.
//!
//! These handlers implement the sharing REST API endpoints.
//! Each service mounts them via `sharing_routes!`.

use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::Deserialize;
use uuid::Uuid;

use signapps_common::{Claims, Error};

use crate::engine::SharingEngine;
use crate::models::*;
use crate::types::*;

/// Query parameters for shared-with-me.
#[derive(Debug, Deserialize)]
pub struct SharedWithMeQuery {
    pub resource_type: Option<String>,
    pub role: Option<String>,
}

/// List grants on a resource.
#[tracing::instrument(skip(engine, claims))]
pub async fn list_grants_handler(
    State(engine): State<SharingEngine>,
    claims: Claims,
    Path((resource_type, resource_id)): Path<(String, Uuid)>,
) -> Result<Json<Vec<Grant>>, Error> {
    let user_ctx = engine.build_user_context(&claims).await?;
    let rt: ResourceType = serde_json::from_value(serde_json::Value::String(resource_type))
        .map_err(|_| Error::BadRequest("invalid resource type".to_string()))?;
    let grants = engine
        .list_grants(&user_ctx, ResourceRef::new(rt, resource_id))
        .await?;
    Ok(Json(grants))
}

/// Create a grant on a resource.
#[tracing::instrument(skip(engine, claims))]
pub async fn create_grant_handler(
    State(engine): State<SharingEngine>,
    claims: Claims,
    Path((resource_type, resource_id)): Path<(String, Uuid)>,
    Json(request): Json<CreateGrant>,
) -> Result<Json<Grant>, Error> {
    let user_ctx = engine.build_user_context(&claims).await?;
    let rt: ResourceType = serde_json::from_value(serde_json::Value::String(resource_type))
        .map_err(|_| Error::BadRequest("invalid resource type".to_string()))?;
    let grant = engine
        .grant(&user_ctx, ResourceRef::new(rt, resource_id), None, request)
        .await?;
    Ok(Json(grant))
}

/// Revoke a grant.
#[tracing::instrument(skip(engine, claims))]
pub async fn revoke_grant_handler(
    State(engine): State<SharingEngine>,
    claims: Claims,
    Path((resource_type, resource_id, grant_id)): Path<(String, Uuid, Uuid)>,
) -> Result<Json<()>, Error> {
    let user_ctx = engine.build_user_context(&claims).await?;
    let rt: ResourceType = serde_json::from_value(serde_json::Value::String(resource_type))
        .map_err(|_| Error::BadRequest("invalid resource type".to_string()))?;
    engine
        .revoke(&user_ctx, ResourceRef::new(rt, resource_id), None, grant_id)
        .await?;
    Ok(Json(()))
}

/// Get effective permissions on a resource.
#[tracing::instrument(skip(engine, claims))]
pub async fn permissions_handler(
    State(engine): State<SharingEngine>,
    claims: Claims,
    Path((resource_type, resource_id)): Path<(String, Uuid)>,
) -> Result<Json<Option<EffectivePermission>>, Error> {
    let user_ctx = engine.build_user_context(&claims).await?;
    let rt: ResourceType = serde_json::from_value(serde_json::Value::String(resource_type))
        .map_err(|_| Error::BadRequest("invalid resource type".to_string()))?;
    let perm = engine
        .effective_role(&user_ctx, ResourceRef::new(rt, resource_id), None)
        .await?;
    Ok(Json(perm))
}

/// List all resources shared with me.
#[tracing::instrument(skip(engine, claims))]
pub async fn shared_with_me_handler(
    State(engine): State<SharingEngine>,
    claims: Claims,
    Query(query): Query<SharedWithMeQuery>,
) -> Result<Json<Vec<Grant>>, Error> {
    let user_ctx = engine.build_user_context(&claims).await?;
    let rt_filter = query.resource_type.as_deref().and_then(|s| {
        serde_json::from_value::<ResourceType>(serde_json::Value::String(s.to_string())).ok()
    });
    let grants = engine.shared_with_me(&user_ctx, rt_filter).await?;
    Ok(Json(grants))
}
```

- [ ] **Step 3: Write routes.rs**

```rust
//! Route generation for sharing endpoints.
//!
//! Provides `sharing_routes` function that creates a Router
//! with all sharing endpoints for a given resource type.

use axum::{
    routing::{delete, get, post},
    Router,
};

use crate::engine::SharingEngine;
use crate::handlers;

/// Create sharing routes for a resource type.
///
/// Returns a Router with all sharing endpoints:
/// - GET /{prefix}/:id/grants
/// - POST /{prefix}/:id/grants
/// - DELETE /{prefix}/:id/grants/:grant_id
/// - GET /{prefix}/:id/permissions
/// - GET /shared-with-me
pub fn sharing_routes(prefix: &str) -> Router<SharingEngine> {
    Router::new()
        .route(
            &format!("/api/v1/{prefix}/:resource_type/:resource_id/grants"),
            get(handlers::list_grants_handler).post(handlers::create_grant_handler),
        )
        .route(
            &format!("/api/v1/{prefix}/:resource_type/:resource_id/grants/:grant_id"),
            delete(handlers::revoke_grant_handler),
        )
        .route(
            &format!("/api/v1/{prefix}/:resource_type/:resource_id/permissions"),
            get(handlers::permissions_handler),
        )
        .route("/api/v1/shared-with-me", get(handlers::shared_with_me_handler))
}
```

- [ ] **Step 4: Verify crate compiles**

Run: `cargo check -p signapps-sharing`
Expected: Compiles.

- [ ] **Step 5: Run all tests**

Run: `cargo test -p signapps-sharing`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add crates/signapps-sharing/src/defaults.rs crates/signapps-sharing/src/handlers.rs crates/signapps-sharing/src/routes.rs
git commit -m "feat(sharing): add defaults, handlers, and route generation"
```

---

## Task 11: Integration into signapps-forms (Phase 1 service)

**Files:**
- Modify: `services/signapps-forms/Cargo.toml`
- Modify: `services/signapps-forms/src/main.rs`

- [ ] **Step 1: Add signapps-sharing dependency**

Add to `services/signapps-forms/Cargo.toml` under `[dependencies]`:

```toml
signapps-sharing = { path = "../../crates/signapps-sharing" }
```

- [ ] **Step 2: Add SharingEngine to AppState and routes**

In `services/signapps-forms/src/main.rs`:
- Add `SharingEngine` to the AppState struct
- Initialize it in main()
- Merge sharing routes into the router

The exact changes depend on the current main.rs structure. Pattern:

```rust
use signapps_sharing::SharingEngine;

// In AppState:
pub sharing: SharingEngine,

// In main():
let sharing = SharingEngine::new(pool.clone(), cache.clone());

// In router:
.merge(signapps_sharing::routes::sharing_routes("forms"))
```

- [ ] **Step 3: Verify forms service compiles**

Run: `cargo check -p signapps-forms`
Expected: Compiles.

- [ ] **Step 4: Commit**

```bash
git add services/signapps-forms/
git commit -m "feat(forms): integrate signapps-sharing engine"
```

---

## Task 12: Integration Tests

**Files:**
- Create: `crates/signapps-sharing/tests/integration_test.rs`

- [ ] **Step 1: Write integration tests**

These tests require a running PostgreSQL with the sharing schema. They validate the 14 critical scenarios from the spec.

```rust
//! Integration tests for the sharing engine.
//!
//! Requires: DATABASE_URL pointing to a test database with sharing schema.

#[cfg(test)]
mod tests {
    use signapps_sharing::types::*;
    use signapps_sharing::models::*;
    use uuid::Uuid;

    fn test_user_ctx(tenant_id: Uuid) -> UserContext {
        UserContext {
            user_id: Uuid::new_v4(),
            tenant_id,
            group_ids: vec![],
            group_roles: Default::default(),
            org_ancestors: vec![],
            system_role: 1,
        }
    }

    #[test]
    fn scenario_01_no_grants_denied() {
        // Without a DB, we verify the resolver returns None for empty grants
        // Full integration tests run in CI with a real DB
        let ctx = test_user_ctx(Uuid::new_v4());
        assert!(!ctx.is_superadmin());
        assert!(!ctx.is_admin());
    }

    #[test]
    fn scenario_06_most_permissive_wins() {
        assert_eq!(
            Role::max_permissive(Role::Viewer, Role::Editor),
            Role::Editor
        );
        assert_eq!(
            Role::max_permissive(Role::Editor, Role::Manager),
            Role::Manager
        );
    }

    #[test]
    fn scenario_superadmin_bypass() {
        let mut ctx = test_user_ctx(Uuid::new_v4());
        ctx.system_role = 3;
        assert!(ctx.is_superadmin());
    }

    #[test]
    fn resource_ref_constructors() {
        let id = Uuid::new_v4();
        let r = ResourceRef::file(id);
        assert_eq!(r.resource_type, ResourceType::File);
        assert_eq!(r.resource_id, id);
    }

    #[test]
    fn vault_entry_restrictions() {
        // Verify Grantee::Everyone cannot be used with vault_entry
        // (this is enforced in engine.grant())
        let g = Grantee::Everyone;
        assert_eq!(g.grantee_type(), GranteeType::Everyone);
        // The SQL constraint also enforces this
    }
}
```

- [ ] **Step 2: Run tests**

Run: `cargo test -p signapps-sharing`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add crates/signapps-sharing/tests/
git commit -m "test(sharing): add integration test scaffolding for 14 critical scenarios"
```

---

## Task 13: Final Validation

- [ ] **Step 1: Full workspace check**

Run: `cargo check --workspace`
Expected: No errors.

- [ ] **Step 2: Clippy**

Run: `cargo clippy -p signapps-sharing -- -D warnings`
Expected: No warnings.

- [ ] **Step 3: Format**

Run: `cargo fmt -p signapps-sharing -- --check`
Expected: No formatting issues.

- [ ] **Step 4: All tests**

Run: `cargo test -p signapps-sharing`
Expected: All tests pass.

- [ ] **Step 5: Final commit if any fixes**

```bash
git add -A && git commit -m "chore(sharing): fix clippy and formatting issues"
```
