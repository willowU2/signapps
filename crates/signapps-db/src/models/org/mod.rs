//! Canonical organization data model — the single source of truth for
//! the SignApps org hierarchy, persons, assignments, policies, boards,
//! access grants, AD configuration, AD sync log and provisioning log.
//!
//! This module is the W1 deliverable of the **S1 org+RBAC refonte**
//! (`docs/superpowers/specs/2026-04-18-s1-org-rbac-refonte-design.md`).
//! Workforce / `core_org` legacy types remain available during the
//! transition; they are dropped by migration 426 in W2.
//!
//! **SO1 addition (2026-04-19)** — 4 new entity families:
//! - [`Position`] + [`PositionIncumbent`] : siège typé et incumbents.
//! - [`AuditLogEntry`] : piste d'audit automatique (trigger SQL).
//! - [`Delegation`] + [`DelegationScope`] : délégations temporaires.
//!
//! **SO2 addition (2026-04-19)** — gouvernance & permissions:
//! - [`Raci`] + [`RaciRole`] : matrix R/A/C/I par projet (focus node).
//! - [`BoardDecision`] + [`DecisionStatus`] : décisions d'un board.
//! - [`BoardVote`] + [`VoteKind`] : votes nominatifs sur décisions.
//!
//! **SO3 addition (2026-04-19)** — scale & power tools:
//! - [`Template`] : hiérarchie prête à cloner (built-in + custom).
//! - [`HeadcountPlan`] + [`HeadcountRollup`] : planification effectifs.
//! - [`Skill`] + [`SkillCategory`] + [`PersonSkill`] : compétences.
//!
//! **SO4 addition (2026-04-19)** — external integrations:
//! - [`PublicLink`] + [`Visibility`] : partage public d'un sous-arbre.
//! - [`Webhook`] : souscription sortante HMAC-signée par tenant.
//! - [`WebhookDelivery`] : log d'audit des fan-outs.
//!
//! **SO6 addition (2026-04-19)** — DetailPanel refonte:
//! - [`PanelLayout`] + [`PanelRole`] + [`PanelEntityType`] +
//!   [`PanelLayoutConfig`] : config personnalisable par (tenant, role,
//!   entity_type) du panneau droit `/admin/org-structure`.
//!
//! ## Design choices
//!
//! - Each entity carries `tenant_id` for multi-tenancy.
//! - The hierarchy uses a materialized path (`org_nodes.path` LTREE)
//!   so that subtree queries stay O(log n) at scale.
//! - Enums (`NodeKind`, `Axis`, `AdSyncMode`, `ConflictStrategy`,
//!   `DelegationScope`) are stored as `TEXT` round-tripped via
//!   `sqlx::Type` with the `snake_case` rename rule.
//! - All structs derive `FromRow` and gate `utoipa::ToSchema` behind
//!   the `openapi` feature, matching the rest of `signapps-db`.

pub mod access_grant;
pub mod ad_config;
pub mod ad_sync_log;
pub mod assignment;
pub mod audit;
pub mod board;
pub mod board_decision;
pub mod board_vote;
pub mod delegation;
pub mod headcount;
pub mod node;
pub mod panel_layout;
pub mod person;
pub mod person_skill;
pub mod policy;
pub mod position;
pub mod position_incumbent;
pub mod provisioning_log;
pub mod public_link;
pub mod raci;
pub mod skill;
pub mod template;
pub mod webhook;
pub mod webhook_delivery;

pub use access_grant::AccessGrant;
pub use ad_config::{AdConfig, AdSyncMode, ConflictStrategy};
pub use ad_sync_log::AdSyncLog;
pub use assignment::{Assignment, Axis};
pub use audit::AuditLogEntry;
pub use board::{Board, BoardMember};
pub use board_decision::{BoardDecision, DecisionStatus};
pub use board_vote::{BoardVote, VoteKind};
pub use delegation::{Delegation, DelegationScope};
pub use headcount::{HeadcountPlan, HeadcountRollup};
pub use node::{NodeKind, OrgNode};
pub use panel_layout::{
    PanelEntityType, PanelHeroKpi, PanelLayout, PanelLayoutConfig, PanelRole, PanelTabItem,
};
pub use person::Person;
pub use person_skill::{PersonSkill, PersonSkillWithName};
pub use policy::{PermissionSpec, Policy, PolicyBinding};
pub use position::Position;
pub use position_incumbent::PositionIncumbent;
pub use provisioning_log::ProvisioningLog;
pub use public_link::{PublicLink, Visibility};
pub use raci::{Raci, RaciRole};
pub use skill::{Skill, SkillCategory};
pub use template::{template_spec, Template};
pub use webhook::{pattern_matches, Webhook};
pub use webhook_delivery::WebhookDelivery;
