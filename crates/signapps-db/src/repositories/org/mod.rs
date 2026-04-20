//! Repositories for the canonical org data model (S1 W1 of the
//! org+RBAC refonte). One file per entity, each carrying the
//! sqlx CRUD calls used by the W2 `signapps-org` handlers and the
//! W4 RBAC resolver.
//!
//! **SO1 addition (2026-04-19)** — [`PositionRepository`],
//! [`AuditRepository`], [`DelegationRepository`].
//!
//! **SO2 addition (2026-04-19)** — [`RaciRepository`],
//! [`BoardDecisionRepository`].
//!
//! **SO3 addition (2026-04-19)** — [`TemplateRepository`],
//! [`HeadcountRepository`], [`SkillRepository`].
//!
//! **SO4 addition (2026-04-19)** — [`PublicLinkRepository`],
//! [`WebhookRepository`].
//!
//! **SO6 addition (2026-04-19)** — [`PanelLayoutRepository`] pour la
//! personnalisation du panneau droit `/admin/org-structure`.
//!
//! **SO7 addition (2026-04-19)** — [`GroupRepository`], [`SiteRepository`],
//! [`BookingRepository`] pour les groupes transverses et la gestion des
//! lieux physiques.
//!
//! **SO8 addition (2026-04-19)** — [`ResourceRepository`] pour le
//! catalogue unifié de ressources tangibles (IT + véhicules + clés +
//! badges + AV + licences).

pub mod access_grant_repository;
pub mod ad_config_repository;
pub mod ad_sync_log_repository;
pub mod assignment_repository;
pub mod audit_repository;
pub mod board_decision_repository;
pub mod board_repository;
pub mod booking_repository;
pub mod delegation_repository;
pub mod group_repository;
pub mod headcount_repository;
pub mod node_repository;
pub mod panel_layout_repository;
pub mod person_repository;
pub mod policy_repository;
pub mod position_repository;
pub mod provisioning_log_repository;
pub mod public_link_repository;
pub mod raci_repository;
pub mod resource_repository;
pub mod site_repository;
pub mod skill_repository;
pub mod template_repository;
pub mod webhook_repository;

pub use access_grant_repository::AccessGrantRepository;
pub use ad_config_repository::AdConfigRepository;
pub use ad_sync_log_repository::AdSyncLogRepository;
pub use assignment_repository::AssignmentRepository;
pub use audit_repository::AuditRepository;
pub use board_decision_repository::BoardDecisionRepository;
pub use board_repository::BoardRepository;
pub use booking_repository::{BookingRepository, OccupancyBucket};
pub use delegation_repository::DelegationRepository;
pub use group_repository::GroupRepository;
pub use headcount_repository::HeadcountRepository;
pub use node_repository::NodeRepository;
pub use panel_layout_repository::{default_layout, PanelLayoutRepository, LEGACY_HIDDEN_TABS};
pub use person_repository::PersonRepository;
pub use policy_repository::PolicyRepository;
pub use position_repository::PositionRepository;
pub use provisioning_log_repository::ProvisioningLogRepository;
pub use public_link_repository::PublicLinkRepository;
pub use raci_repository::RaciRepository;
pub use resource_repository::{
    NewResource, ResourceListFilters, ResourceRepository, ResourceUpdate,
};
pub use site_repository::SiteRepository;
pub use skill_repository::SkillRepository;
pub use template_repository::{CloneOutcome, TemplateRepository};
pub use webhook_repository::{WebhookRepository, MAX_CONSECUTIVE_FAILURES};
