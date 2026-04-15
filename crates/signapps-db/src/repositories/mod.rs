//! Database repositories for SignApps Platform.

// Infrastructure repositories — now live in signapps-db-infrastructure (Phase 5 split).
pub use signapps_db_infrastructure::repositories::{
    AdDnsRepository, AdDomainRepository, AdOuRepository, AdPrincipalKeysRepository,
    AdSyncQueueRepository, AdUserAccountRepository, DeployProfileRepository, DhcpLeaseRepository,
    DhcpScopeRepository, InfraCertificateRepository, InfraDomainRepository,
};

// Identity repositories — now live in signapps-db-identity (Phase 6 split).
pub use signapps_db_identity::repositories::{GroupRepository, LdapRepository, UserRepository};

// Billing/proxy repositories — now live in signapps-db-billing (Phase 5 split).
pub use signapps_db_billing::repositories::{CertificateRepository, RouteRepository};

// ITAM repositories — now live in signapps-db-itam (Phase 5 split).
pub use signapps_db_itam::repositories::{ContainerRepository, DeviceRepository, RaidRepository};

pub mod job_repository;
pub use job_repository::JobRepository;

// Content repositories — now live in signapps-db-content (Phase 5 split).
pub use signapps_db_content::repositories::{
    BackupRepository, DriveBackupRepository, SignatureRepository,
};

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
    ApprovalWorkflowRepository, CalendarRepository, CategoryRepository, EventAttendeeRepository,
    EventRepository, FloorPlanRepository, LeaveBalanceRepository, PresenceRuleRepository,
    ResourceRepository, TaskRepository, TimesheetRepository,
};

// Notification repositories — now live in signapps-db-notifications (Phase 4 split).
pub use signapps_db_notifications::repositories::{
    NotificationDigestRepository, NotificationPreferencesRepository, NotificationSentRepository,
    NotificationTemplateRepository, PushSubscriptionRepository,
};

// Storage repositories — now live in signapps-db-storage (Phase 4 split).
pub use signapps_db_storage::repositories::{StorageTier2Repository, StorageTier3Repository};

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

// Identity repositories — now live in signapps-db-identity (Phase 6 split).
pub use signapps_db_identity::repositories::UserPreferencesRepository;

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

// Identity repositories — now live in signapps-db-identity (Phase 6 split).
pub use signapps_db_identity::repositories::AuditLogRepository;

pub mod entity_reference_repository;
pub use entity_reference_repository::EntityReferenceRepository;

pub mod activity_repository;
pub use activity_repository::ActivityRepository;

// Resource booking (standalone `resources` schema) — lives in signapps-db-shared.
pub use signapps_db_shared::repositories::ResourceBookingRepository;

// Company / person-company / login-context repositories — lives in signapps-db-shared.
pub use signapps_db_shared::repositories::CompanyRepository;

// Drive ACL repositories — now live in signapps-db-storage (Phase 4 split).
pub use signapps_db_storage::repositories::{AuditAlertConfigRepository, DriveAuditLogRepository};

// Identity repositories — now live in signapps-db-identity (Phase 6 split).
pub use signapps_db_identity::repositories::{
    AssignmentRepository, AuditRepository, BoardRepository, DelegationRepository,
    OrgGroupRepository, OrgNodeRepository, OrgTreeRepository, PermissionProfileRepository,
    PersonRepository, PolicyRepository, PolicyResolver, SiteRepository,
};

// Backward-compatibility module alias: `use signapps_db::repositories::core_org_repository::Foo`
// continues to work for services that import via the sub-module path.
// Note: GroupRepository here is the org-group (cross-functional) repository,
// distinct from the RBAC GroupRepository exported at the top level.
pub mod core_org_repository {
    pub use signapps_db_identity::repositories::core_org_repository::{
        AssignmentRepository, AuditRepository, BoardRepository, DelegationRepository,
        GroupRepository, OrgNodeRepository, OrgTreeRepository, PermissionProfileRepository,
        PersonRepository, PolicyRepository, PolicyResolver, SiteRepository,
    };
}

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
