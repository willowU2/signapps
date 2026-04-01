//! Repositories for the `core` schema: persons, org trees, org nodes, assignments, sites,
//! permission profiles.

pub mod assignments;
pub mod nodes;
pub mod permissions;
pub mod persons;
pub mod sites;
pub mod trees;

pub use assignments::AssignmentRepository;
pub use nodes::OrgNodeRepository;
pub use permissions::PermissionProfileRepository;
pub use persons::PersonRepository;
pub use sites::SiteRepository;
pub use trees::OrgTreeRepository;
