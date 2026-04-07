//! Database repositories for SignApps Platform.

// Infrastructure repositories — now live in signapps-db-infrastructure (Phase 5 split).
pub use signapps_db_infrastructure::repositories::{
    AdDnsRepository, AdDomainRepository, AdOuRepository, AdPrincipalKeysRepository,
    AdSyncQueueRepository, AdUserAccountRepository, DeployProfileRepository,
    DhcpLeaseRepository, DhcpScopeRepository, InfraCertificateRepository,
    InfraDomainRepository,
};

pub mod group_repository;
pub mod ldap_repository;
pub mod user_repository;

pub use group_repository::GroupRepository;
pub use ldap_repository::LdapRepository;
pub use user_repository::UserRepository;

// Billing/proxy repositories — now live in signapps-db-billing (Phase 5 split).
pub use signapps_db_billing::repositories::{CertificateRepository, RouteRepository};

// ITAM repositories — now live in signapps-db-itam (Phase 5 split).
pub use signapps_db_itam::repositories::{ContainerRepository, DeviceRepository, RaidRepository};

pub mod job_repository;
pub use job_repository::JobRepository;

pub mod backup_repository;
pub use backup_repository::{BackupRepository, DriveBackupRepository};

// Forms repositories — now live in signapps-db-forms (Phase 4 split).
pub use signapps_db_forms::repositories::FormRepository;
// AI repositories — now live in signapps-db-ai (Phase 5 split).
pub use signapps_db_ai::repositories::{
    ChunkInput, ConversationRepository, GeneratedMediaRepository, KgRepository,
    MultimodalVectorRepository, VectorRepository,
};
// Re-export module alias for consumers that import via module path
// e.g. `use signapps_db::repositories::vector_repository::{...}`
pub mod vector_repository {
    pub use signapps_db_ai::repositories::{ChunkInput, VectorRepository};
}

// Calendar repositories — now live in signapps-db-calendar (Phase 3 split).
// Re-exported here so that `use signapps_db::repositories::CalendarRepository` still works.
pub use signapps_db_calendar::repositories::{
    ApprovalWorkflowRepository, CalendarRepository, CategoryRepository,
    EventAttendeeRepository, EventRepository, FloorPlanRepository,
    LeaveBalanceRepository, PresenceRuleRepository, ResourceRepository,
    TaskRepository, TimesheetRepository,
};

// Notification repositories — now live in signapps-db-notifications (Phase 4 split).
pub use signapps_db_notifications::repositories::{
    NotificationDigestRepository, NotificationPreferencesRepository, NotificationSentRepository,
    NotificationTemplateRepository, PushSubscriptionRepository,
};

// Storage repositories — now live in signapps-db-storage (Phase 4 split).
pub use signapps_db_storage::repositories::{
    StorageTier2Repository, StorageTier3Repository,
};

pub mod tenant_repository;
pub use tenant_repository::{
    LabelRepository, ProjectRepository, ReservationRepository, ResourceTypeRepository,
    TemplateRepository, TenantCalendarRepository, TenantRepository, TenantResourceRepository,
    TenantTaskRepository, WorkspaceRepository,
};

// External sync repositories — now live in signapps-db-calendar (Phase 3 split).
pub use signapps_db_calendar::repositories::{
    EventMappingRepository, ExternalCalendarRepository, OAuthStateRepository,
    ProviderConnectionRepository, SyncConfigRepository, SyncConflictRepository, SyncLogRepository,
};

pub mod user_preferences_repository;
pub use user_preferences_repository::UserPreferencesRepository;

// Scheduling repositories — now live in signapps-db-calendar (Phase 3 split).
pub use signapps_db_calendar::repositories::{
    RecurrenceRuleRepository, SchedulingPreferencesRepository, SchedulingResourceRepository,
    SchedulingTemplateRepository, TimeItemDependencyRepository, TimeItemGroupRepository,
    TimeItemRepository, TimeItemUserRepository,
};
pub mod metrics_repository;
pub use metrics_repository::{MetricsRepository, ResourceMetrics, WorkloadMetrics};

// Quota repository — now lives in signapps-db-storage (Phase 4 split).
pub use signapps_db_storage::repositories::QuotaRepository;

pub mod audit_log_repository;
pub use audit_log_repository::AuditLogRepository;

pub mod entity_reference_repository;
pub use entity_reference_repository::EntityReferenceRepository;

pub mod activity_repository;
pub use activity_repository::ActivityRepository;

pub mod signature_repository;
pub use signature_repository::SignatureRepository;


// Drive ACL repositories — now live in signapps-db-storage (Phase 4 split).
pub use signapps_db_storage::repositories::{AuditAlertConfigRepository, DriveAuditLogRepository};

pub mod core_org_repository;
pub use core_org_repository::{
    AssignmentRepository, OrgNodeRepository, OrgTreeRepository, PermissionProfileRepository,
    PersonRepository, SiteRepository,
};

// Vault repositories — now live in signapps-db-vault (Phase 5 split).
pub use signapps_db_vault::repositories::{
    VaultAuditRepository, VaultBrowseRepository, VaultFolderRepository, VaultItemRepository,
    VaultKeysRepository, VaultOrgKeyRepository, VaultShareRepository,
};


// Mail repositories — now live in signapps-db-mail (Phase 4 split).
pub use signapps_db_mail::repositories::{
    AccountRepository, DomainRepository, MailboxRepository, MessageRepository,
};


pub mod test_helpers;
