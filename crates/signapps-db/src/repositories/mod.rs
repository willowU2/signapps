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
pub use backup_repository::BackupRepository;

pub mod certificate_repository;
pub use certificate_repository::CertificateRepository;

pub mod vector_repository;
pub use vector_repository::VectorRepository;

pub mod calendar_repository;
pub use calendar_repository::{
    CalendarMemberRepository, CalendarRepository, EventAttendeeRepository, EventRepository,
    ResourceRepository, TaskRepository,
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
