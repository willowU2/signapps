//! Employee Handlers
//!
//! CRUD operations for employees (distinct from system users).
//! Employees represent workforce members with HR attributes.

pub mod crud;
pub mod functions;
pub mod import;
pub mod links;
pub mod search;
pub mod types;

pub use crud::*;
pub use functions::*;
pub use import::*;
pub use links::*;
pub use search::*;
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
