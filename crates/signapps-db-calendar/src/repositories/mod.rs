//! Calendar domain repositories.

pub mod calendar;
pub mod calendar_hr;
pub mod external_sync;
pub mod scheduling;

pub use calendar::{
    CalendarRepository, EventAttendeeRepository, EventRepository, FloorPlanRepository,
    ResourceRepository, TaskRepository,
};
pub use calendar_hr::{
    ApprovalWorkflowRepository, CategoryRepository, LeaveBalanceRepository, PresenceRuleRepository,
    TimesheetRepository,
};
pub use external_sync::{
    EventMappingRepository, ExternalCalendarRepository, OAuthStateRepository,
    ProviderConnectionRepository, SyncConfigRepository, SyncConflictRepository, SyncLogRepository,
};
pub use scheduling::{
    RecurrenceRuleRepository, SchedulingPreferencesRepository, SchedulingResourceRepository,
    SchedulingTemplateRepository, TimeItemDependencyRepository, TimeItemGroupRepository,
    TimeItemRepository, TimeItemUserRepository,
};

#[cfg(test)]
mod calendar_repository_tests;
