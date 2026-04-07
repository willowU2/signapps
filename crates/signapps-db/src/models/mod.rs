//! Database models for SignApps Platform.

pub mod activity;
pub mod audit_log;

// Infrastructure domain models — now live in signapps-db-infrastructure (Phase 5 split).
pub mod ad_dns {
    pub use signapps_db_infrastructure::models::ad_dns::*;
}
pub mod ad_sync {
    pub use signapps_db_infrastructure::models::ad_sync::*;
}
pub mod ad_domain {
    pub use signapps_db_infrastructure::models::ad_domain::*;
}
pub mod ad_principal_keys {
    pub use signapps_db_infrastructure::models::ad_principal_keys::*;
}
pub mod infrastructure {
    pub use signapps_db_infrastructure::models::infrastructure::*;
}

pub mod backup;

// Calendar domain models — now live in signapps-db-calendar (Phase 3 split).
// Kept as re-export aliases so that `use signapps_db::models::calendar::*` still works.
pub use signapps_db_calendar::models as calendar_domain;
pub mod calendar {
    pub use signapps_db_calendar::models::calendar::*;
}
pub mod external_sync {
    pub use signapps_db_calendar::models::external_sync::*;
}
pub mod scheduling {
    pub use signapps_db_calendar::models::scheduling::*;
}

// Billing/proxy domain models — now live in signapps-db-billing (Phase 5 split).
pub mod certificate {
    pub use signapps_db_billing::models::certificate::*;
}
pub mod route {
    pub use signapps_db_billing::models::route::*;
}

// ITAM domain models — now live in signapps-db-itam (Phase 5 split).
pub mod container {
    pub use signapps_db_itam::models::container::*;
}
pub mod device {
    pub use signapps_db_itam::models::device::*;
}
pub mod raid {
    pub use signapps_db_itam::models::raid::*;
}

// AI domain models — now live in signapps-db-ai (Phase 5 split).
pub mod conversation {
    pub use signapps_db_ai::models::conversation::*;
}
pub mod document_vector {
    pub use signapps_db_ai::models::document_vector::*;
}
pub mod generated_media {
    pub use signapps_db_ai::models::generated_media::*;
}
pub mod kg {
    pub use signapps_db_ai::models::kg::*;
}
pub mod multimodal_vector {
    pub use signapps_db_ai::models::multimodal_vector::*;
}

pub mod core_org;

// Storage domain models — now live in signapps-db-storage (Phase 4 split).
// Kept as re-export aliases so that `use signapps_db::models::drive::*` still works.
pub mod drive {
    pub use signapps_db_storage::models::drive::*;
}
pub mod drive_acl {
    pub use signapps_db_storage::models::drive_acl::*;
}
pub mod storage_quota {
    pub use signapps_db_storage::models::storage_quota::*;
}
pub mod storage_tier2 {
    pub use signapps_db_storage::models::storage_tier2::*;
}
pub mod storage_tier3 {
    pub use signapps_db_storage::models::storage_tier3::*;
}

pub mod entity_reference;

// Forms domain models — now live in signapps-db-forms (Phase 4 split).
pub mod form {
    pub use signapps_db_forms::models::form::*;
}

pub mod group;
pub mod job;
pub mod ldap;

// Mail domain models — now live in signapps-db-mail (Phase 4 split).
pub mod mailserver {
    pub use signapps_db_mail::models::mailserver::*;
}

// Notifications domain models — now live in signapps-db-notifications (Phase 4 split).
pub mod notification {
    pub use signapps_db_notifications::models::notification::*;
}

pub mod org_audit;
pub mod org_boards;
pub mod org_delegations;
pub mod org_groups;
pub mod org_policies;
pub mod signature;
pub mod tenant;
pub mod user;
pub mod user_preferences;

// Vault domain models — now live in signapps-db-vault (Phase 5 split).
pub mod vault {
    pub use signapps_db_vault::models::vault::*;
}

pub use audit_log::*;
pub use backup::*;
pub use calendar::*;
pub use certificate::*;
pub use container::*;
pub use conversation::*;
pub use core_org::*;
pub use device::*;
pub use document_vector::*;
pub use drive::*;
pub use drive_acl::*;
pub use external_sync::*;
pub use form::*;
pub use generated_media::*;
pub use group::*;
pub use job::*;
pub use kg::*;
pub use ldap::*;
pub use mailserver::*;
pub use multimodal_vector::*;
pub use notification::*;
pub use org_audit::*;
pub use org_boards::*;
pub use org_delegations::*;
pub use org_groups::*;
pub use org_policies::*;
pub use raid::*;
pub use route::*;
pub use scheduling::*;
pub use storage_quota::*;
pub use storage_tier2::*;
pub use storage_tier3::*;
pub use tenant::*;
pub use user::*;
pub use user_preferences::*;
pub use vault::*;
