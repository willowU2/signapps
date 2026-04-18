//! Declarative list of every service running inside the single-binary.
//!
//! Each entry provides a short name, its canonical port, and an async
//! factory that builds the service's router then binds it to that port.
//! Services are wired one-by-one in Tasks 9, 11–17, 21.

use signapps_service::{shared_state::SharedState, supervisor::ServiceSpec};

/// Build the list of every service to run.  Currently empty — services
/// are added by subsequent tasks.
pub fn declare(_shared: SharedState) -> Vec<ServiceSpec> {
    Vec::new()
}
