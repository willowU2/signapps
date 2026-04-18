//! Declarative list of every service running inside the single-binary.

use signapps_common::bootstrap::run_server_on_addr;
use signapps_service::{shared_state::SharedState, supervisor::ServiceSpec};

/// Build the list of services to run.  Grows as Tasks 11-17, 21 wire
/// each service.
pub fn declare(shared: SharedState) -> Vec<ServiceSpec> {
    vec![
        spec_identity(shared.clone()),
        spec_contacts(shared.clone()),
        spec_forms(shared.clone()),
        spec_storage(shared.clone()),
    ]
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

fn spec_contacts(shared: SharedState) -> ServiceSpec {
    ServiceSpec::new("signapps-contacts", 3021, move || {
        let shared = shared.clone();
        async move {
            let router = signapps_contacts::router(shared).await?;
            run_server_on_addr(router, "0.0.0.0", 3021).await
        }
    })
}

fn spec_forms(shared: SharedState) -> ServiceSpec {
    ServiceSpec::new("signapps-forms", 3015, move || {
        let shared = shared.clone();
        async move {
            let router = signapps_forms::router(shared).await?;
            run_server_on_addr(router, "0.0.0.0", 3015).await
        }
    })
}

fn spec_storage(shared: SharedState) -> ServiceSpec {
    ServiceSpec::new("signapps-storage", 3004, move || {
        let shared = shared.clone();
        async move {
            let router = signapps_storage::router(shared).await?;
            run_server_on_addr(router, "0.0.0.0", 3004).await
        }
    })
}
