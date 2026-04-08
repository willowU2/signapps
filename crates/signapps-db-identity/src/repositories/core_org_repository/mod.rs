//! Repositories for the `core` schema: persons, org trees, org nodes, assignments, sites,
//! permission profiles, groups, policies, delegations, and audit.

pub mod assignments;
pub mod audit;
pub mod boards;
pub mod delegations;
pub mod groups;
pub mod nodes;
pub mod permissions;
pub mod persons;
pub mod policies;
pub mod policy_resolver;
pub mod sites;
pub mod trees;

pub use assignments::AssignmentRepository;
pub use audit::AuditRepository;
pub use boards::BoardRepository;
pub use delegations::DelegationRepository;
pub use groups::GroupRepository;
pub use nodes::OrgNodeRepository;
pub use permissions::PermissionProfileRepository;
pub use persons::PersonRepository;
pub use policies::PolicyRepository;
pub use policy_resolver::PolicyResolver;
pub use sites::SiteRepository;
pub use trees::OrgTreeRepository;
