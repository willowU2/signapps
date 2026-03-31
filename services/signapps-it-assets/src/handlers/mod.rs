pub mod agent;
pub mod automation;
pub mod cmdb;
pub mod commands;
pub mod custom_fields;
pub mod device_docs;
pub mod files;
pub mod groups;
pub mod hardware;
pub mod monitoring;
pub mod network;
pub mod packages;
pub mod patches;
pub mod playbooks;
pub mod policies;
pub mod remote_ws;
pub mod script_library;
pub mod security;
pub mod software_policies;
pub mod tickets;
pub mod wol;

// Re-export hardware handlers at crate::handlers level for backwards compat
pub use hardware::*;
// Re-export AppState for use in main and routes
pub use remote_ws::AppState;
