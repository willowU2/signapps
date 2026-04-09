//! Shared database repositories extracted from `signapps-db`.

pub mod activity_repository;
pub use activity_repository::ActivityRepository;

pub mod entity_reference_repository;
pub use entity_reference_repository::EntityReferenceRepository;

pub mod job_repository;
pub use job_repository::JobRepository;

pub mod resource_booking_repository;
pub use resource_booking_repository::ResourceBookingRepository;

pub mod tenant_repository;
pub use tenant_repository::{
    LabelRepository, ProjectRepository, ReservationRepository, ResourceTypeRepository,
    TemplateRepository, TenantCalendarRepository, TenantRepository, TenantResourceRepository,
    TenantTaskRepository, WorkspaceRepository,
};
