//! Shared database repositories extracted from `signapps-db`.

pub mod activity_repository;
pub use activity_repository::ActivityRepository;

pub mod automation_repository;
pub use automation_repository::AutomationRepository;

pub mod brand_kit_repository;
pub use brand_kit_repository::BrandKitRepository;

pub mod cell_format_repository;
pub use cell_format_repository::CellFormatRepository;

pub mod company_repository;
pub use company_repository::CompanyRepository;

pub mod entity_reference_repository;
pub use entity_reference_repository::EntityReferenceRepository;

pub mod job_repository;
pub use job_repository::JobRepository;

pub mod resource_booking_repository;
pub use resource_booking_repository::ResourceBookingRepository;

pub mod presentation_repository;
pub use presentation_repository::PresentationRepository;

pub mod style_repository;
pub use style_repository::StyleRepository;

pub mod tenant_repository;
pub use tenant_repository::{
    LabelRepository, ProjectRepository, ReservationRepository, ResourceTypeRepository,
    TemplateRepository, TenantCalendarRepository, TenantRepository, TenantResourceRepository,
    TenantTaskRepository, WorkspaceRepository,
};

pub mod template_variable_repository;
pub use template_variable_repository::TemplateVariableRepository;

pub mod validation_repository;
pub use validation_repository::ValidationRepository;

pub mod versioning_repository;
pub use versioning_repository::VersioningRepository;
