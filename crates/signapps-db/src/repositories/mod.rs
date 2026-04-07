//! Database repositories for SignApps Platform.

pub mod ad_dns_repository;
pub mod ad_domain_repository;
pub mod ad_principal_keys_repository;

pub use ad_dns_repository::AdDnsRepository;
pub use ad_domain_repository::AdDomainRepository;
pub use ad_principal_keys_repository::AdPrincipalKeysRepository;

pub mod container_repository;
pub mod group_repository;
pub mod ldap_repository;
pub mod raid_repository;
pub mod route_repository;
pub mod user_repository;

pub use container_repository::ContainerRepository;
pub use group_repository::GroupRepository;
pub use ldap_repository::LdapRepository;
pub use raid_repository::RaidRepository;
pub use route_repository::RouteRepository;
pub use user_repository::UserRepository;

pub mod device_repository;
pub use device_repository::DeviceRepository;

pub mod job_repository;
pub use job_repository::JobRepository;

pub mod backup_repository;
pub use backup_repository::{BackupRepository, DriveBackupRepository};

pub mod certificate_repository;
pub use certificate_repository::CertificateRepository;

// Forms repositories — now live in signapps-db-forms (Phase 4 split).
pub use signapps_db_forms::repositories::FormRepository;
pub mod vector_repository;
pub use vector_repository::VectorRepository;

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

pub mod multimodal_vector_repository;
pub use multimodal_vector_repository::MultimodalVectorRepository;

pub mod conversation_repository;
pub use conversation_repository::ConversationRepository;

pub mod generated_media_repository;
pub use generated_media_repository::GeneratedMediaRepository;

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

pub mod kg_repository;
pub use kg_repository::KgRepository;

// Mail repositories — now live in signapps-db-mail (Phase 4 split).
pub use signapps_db_mail::repositories::{
    AccountRepository, DomainRepository, MailboxRepository, MessageRepository,
};

pub mod infrastructure_repository;
pub use infrastructure_repository::{
    DeployProfileRepository, DhcpLeaseRepository, DhcpScopeRepository,
    InfraCertificateRepository, InfraDomainRepository,
};

pub mod ad_sync_repository;
pub use ad_sync_repository::{AdOuRepository, AdSyncQueueRepository, AdUserAccountRepository};

pub mod test_helpers;
