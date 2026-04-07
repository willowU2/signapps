//! Storage domain repositories.

pub mod drive_acl_repository;
pub mod quota_repository;
pub mod storage_tier2_repository;
pub mod storage_tier3_repository;

pub use drive_acl_repository::{AuditAlertConfigRepository, DriveAuditLogRepository};
pub use quota_repository::QuotaRepository;
pub use storage_tier2_repository::StorageTier2Repository;
pub use storage_tier3_repository::StorageTier3Repository;
