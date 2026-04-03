//! Database repositories for SignApps Platform.

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

pub mod form_repository;
pub use form_repository::*;
pub mod vector_repository;
pub use vector_repository::VectorRepository;

pub mod calendar_repository;
pub use calendar_repository::{
    CalendarMemberRepository, CalendarRepository, EventAttendeeRepository, EventRepository,
    FloorPlanRepository, ResourceRepository, TaskRepository,
};

pub mod calendar_hr_repository;
pub use calendar_hr_repository::{
    ApprovalWorkflowRepository, CategoryRepository, LeaveBalanceRepository, PresenceRuleRepository,
    TimesheetRepository,
};

pub mod notification_repository;
pub use notification_repository::{
    NotificationDigestRepository, NotificationPreferencesRepository, NotificationSentRepository,
    NotificationTemplateRepository, PushSubscriptionRepository,
};

pub mod storage_tier2_repository;
pub use storage_tier2_repository::StorageTier2Repository;

pub mod storage_tier3_repository;
pub use storage_tier3_repository::StorageTier3Repository;

pub mod tenant_repository;
pub use tenant_repository::{
    LabelRepository, ProjectRepository, ReservationRepository, ResourceTypeRepository,
    TemplateRepository, TenantCalendarRepository, TenantRepository, TenantResourceRepository,
    TenantTaskRepository, WorkspaceRepository,
};

pub mod external_sync_repository;
pub use external_sync_repository::{
    EventMappingRepository, ExternalCalendarRepository, OAuthStateRepository,
    ProviderConnectionRepository, SyncConfigRepository, SyncConflictRepository, SyncLogRepository,
};

pub mod user_preferences_repository;
pub use user_preferences_repository::UserPreferencesRepository;

pub mod scheduling_repository;
pub use scheduling_repository::{
    RecurrenceRuleRepository, SchedulingPreferencesRepository, SchedulingResourceRepository,
    SchedulingTemplateRepository, TimeItemDependencyRepository, TimeItemGroupRepository,
    TimeItemRepository, TimeItemUserRepository,
};
pub mod metrics_repository;
pub use metrics_repository::{MetricsRepository, ResourceMetrics, WorkloadMetrics};

pub mod quota_repository;
pub use quota_repository::QuotaRepository;

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

pub mod drive_acl_repository;
pub use drive_acl_repository::{
    AclRepository, AuditAlertConfigRepository, DriveAuditLogRepository,
};

pub mod core_org_repository;
pub use core_org_repository::{
    AssignmentRepository, OrgNodeRepository, OrgTreeRepository, PermissionProfileRepository,
    PersonRepository, SiteRepository,
};

pub mod vault_repository;
pub use vault_repository::{
    VaultAuditRepository, VaultBrowseRepository, VaultFolderRepository, VaultItemRepository,
    VaultKeysRepository, VaultOrgKeyRepository, VaultShareRepository,
};

pub mod mailserver_repo;
pub use mailserver_repo::{AccountRepository, DomainRepository, MailboxRepository, MessageRepository};

pub mod test_helpers;
