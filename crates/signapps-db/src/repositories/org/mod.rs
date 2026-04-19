//! Repositories for the canonical org data model (S1 W1 of the
//! org+RBAC refonte). One file per entity, each carrying the
//! sqlx CRUD calls used by the W2 `signapps-org` handlers and the
//! W4 RBAC resolver.

pub mod access_grant_repository;
pub mod ad_config_repository;
pub mod ad_sync_log_repository;
pub mod assignment_repository;
pub mod board_repository;
pub mod node_repository;
pub mod person_repository;
pub mod policy_repository;
pub mod provisioning_log_repository;

pub use access_grant_repository::AccessGrantRepository;
pub use ad_config_repository::AdConfigRepository;
pub use ad_sync_log_repository::AdSyncLogRepository;
pub use assignment_repository::AssignmentRepository;
pub use board_repository::BoardRepository;
pub use node_repository::NodeRepository;
pub use person_repository::PersonRepository;
pub use policy_repository::PolicyRepository;
pub use provisioning_log_repository::ProvisioningLogRepository;
