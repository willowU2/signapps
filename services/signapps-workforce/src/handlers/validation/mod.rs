//! Validation Handlers
//!
//! Coverage validation, gap analysis, and leave simulation.
//! The validation engine checks staffing requirements against scheduled assignments.

pub mod gap_analysis;
pub mod helpers;
pub mod rules;
pub mod simulation;
pub mod types;

pub use gap_analysis::*;
pub use rules::*;
pub use simulation::*;
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
