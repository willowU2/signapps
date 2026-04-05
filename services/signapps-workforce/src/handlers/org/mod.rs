//! Organizational Tree Handlers
//!
//! CRUD operations for the organizational hierarchy using closure table pattern.

pub mod hierarchy;
pub mod node_types;
pub mod nodes;
pub mod trees;
pub mod types;

pub use hierarchy::*;
pub use node_types::*;
pub use nodes::*;
pub use trees::*;
pub use types::*;

#[cfg(test)]
mod tests {
    #[allow(unused_imports)]
    use super::*;

    #[test]
    fn module_compiles() {
        // Verify this handler module compiles correctly.
        // Integration tests require a running database and service.
        assert!(true, "{} handler module loaded", module_path!());
    }
}
