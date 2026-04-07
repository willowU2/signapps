// Enforce documentation on all public items (only during `cargo doc`, not clippy)
#![cfg_attr(doc, warn(missing_docs))]

//! # SignApps DB Calendar
//!
//! Calendar domain database models and repositories for the SignApps Platform.
//!
//! Contains models and repositories for:
//! - Calendars, Events, Tasks, Attendees, Resources, FloorPlans
//! - HR: Categories, PresenceRules, LeaveBalances, Timesheets, ApprovalWorkflows
//! - Scheduling: TimeItems, RecurrenceRules, SchedulingResources, Templates, Preferences
//! - External Sync: ProviderConnections, ExternalCalendars, SyncConfigs, SyncLogs, Conflicts
//!
//! This is Phase 3 of the `signapps-db` bounded-context split.
//! See `docs/architecture/refactors/01-split-signapps-db.md`.

pub mod models;
pub mod repositories;

pub use models::calendar::*;
pub use models::external_sync::*;
pub use models::scheduling::*;

pub use repositories::calendar::{
    CalendarRepository, EventAttendeeRepository, EventRepository, FloorPlanRepository,
    ResourceRepository, TaskRepository,
};
pub use repositories::calendar_hr::{
    ApprovalWorkflowRepository, CategoryRepository, LeaveBalanceRepository, PresenceRuleRepository,
    TimesheetRepository,
};
pub use repositories::external_sync::{
    EventMappingRepository, ExternalCalendarRepository, OAuthStateRepository,
    ProviderConnectionRepository, SyncConfigRepository, SyncConflictRepository, SyncLogRepository,
};
pub use repositories::scheduling::{
    RecurrenceRuleRepository, SchedulingPreferencesRepository, SchedulingResourceRepository,
    SchedulingTemplateRepository, TimeItemDependencyRepository, TimeItemGroupRepository,
    TimeItemRepository, TimeItemUserRepository,
};

// Re-export DatabasePool from signapps-db-shared for convenience
pub use signapps_db_shared::DatabasePool;
