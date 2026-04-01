//! Tenant repository for multi-tenant operations.

pub mod labels;
pub mod projects;
pub mod reservations;
pub mod resource_types;
pub mod tasks;
pub mod calendars;
pub mod tenant;
pub mod tenant_resources;
pub mod templates;
pub mod workspaces;

pub use labels::LabelRepository;
pub use projects::ProjectRepository;
pub use reservations::ReservationRepository;
pub use resource_types::ResourceTypeRepository;
pub use tasks::TenantTaskRepository;
pub use calendars::TenantCalendarRepository;
pub use tenant::TenantRepository;
pub use tenant_resources::TenantResourceRepository;
pub use templates::TemplateRepository;
pub use workspaces::WorkspaceRepository;
