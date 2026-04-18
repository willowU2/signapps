//! Declarative list of every service running inside the single-binary.

use signapps_common::bootstrap::run_server_on_addr;
use signapps_service::{shared_state::SharedState, supervisor::ServiceSpec};

/// Build the list of services to run.  Grows as Tasks 11-17, 21 wire
/// each service.
pub fn declare(shared: SharedState) -> Vec<ServiceSpec> {
    vec![spec_identity(shared.clone())]
}

fn spec_identity(shared: SharedState) -> ServiceSpec {
    ServiceSpec::new("signapps-identity", 3001, move || {
        let shared = shared.clone();
        async move {
            let router = signapps_identity::router(shared).await?;
            run_server_on_addr(router, "0.0.0.0", 3001).await
        }
    })
}
