pub mod agent;
pub mod cmdb;
pub mod commands;
pub mod files;
pub mod hardware;
pub mod monitoring;
pub mod network;
pub mod packages;
pub mod patches;
pub mod policies;
pub mod security;
pub mod wol;

// Re-export hardware handlers at crate::handlers level for backwards compat
pub use hardware::*;
