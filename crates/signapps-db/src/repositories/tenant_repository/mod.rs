//! Tenant repository for multi-tenant operations.

pub mod calendars;
pub mod labels;
pub mod projects;
pub mod reservations;
pub mod resource_types;
pub mod tasks;
pub mod templates;
pub mod tenant;
pub mod tenant_resources;
pub mod workspaces;

pub use calendars::TenantCalendarRepository;
pub use labels::LabelRepository;
pub use projects::ProjectRepository;
pub use reservations::ReservationRepository;
pub use resource_types::ResourceTypeRepository;
pub use tasks::TenantTaskRepository;
pub use templates::TemplateRepository;
pub use tenant::TenantRepository;
pub use tenant_resources::TenantResourceRepository;
pub use workspaces::WorkspaceRepository;
