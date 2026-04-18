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
        spec_notifications(shared.clone()),
        spec_chat(shared.clone()),
        spec_collaboration(shared.clone()),
        spec_meet(shared.clone()),
        spec_proxy(shared.clone()),
        spec_media(shared.clone()),
        spec_securelink(shared.clone()),
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

fn spec_notifications(shared: SharedState) -> ServiceSpec {
    ServiceSpec::new("signapps-notifications", 8095, move || {
        let shared = shared.clone();
        async move {
            let router = signapps_notifications::router(shared).await?;
            run_server_on_addr(router, "0.0.0.0", 8095).await
        }
    })
}

fn spec_chat(shared: SharedState) -> ServiceSpec {
    ServiceSpec::new("signapps-chat", 3020, move || {
        let shared = shared.clone();
        async move {
            let router = signapps_chat::router(shared).await?;
            run_server_on_addr(router, "0.0.0.0", 3020).await
        }
    })
}

fn spec_collaboration(shared: SharedState) -> ServiceSpec {
    ServiceSpec::new("signapps-collaboration", 3034, move || {
        let shared = shared.clone();
        async move {
            let router = signapps_collaboration::router(shared).await?;
            run_server_on_addr(router, "0.0.0.0", 3034).await
        }
    })
}

fn spec_meet(shared: SharedState) -> ServiceSpec {
    ServiceSpec::new("signapps-meet", 3014, move || {
        let shared = shared.clone();
        async move {
            let router = signapps_meet::router(shared).await?;
            run_server_on_addr(router, "0.0.0.0", 3014).await
        }
    })
}

fn spec_proxy(shared: SharedState) -> ServiceSpec {
    ServiceSpec::new("signapps-proxy", 3003, move || {
        let shared = shared.clone();
        async move {
            // The proxy may also bind :80/:443 for ACME/HTTP redirect when
            // PROXY_ENABLED=true. Those listeners are spawned inside
            // `signapps_proxy::router(...)` as detached tokio tasks; if they
            // fail (e.g. permission denied on :80 in dev), they log and the
            // admin API on :3003 still serves. The supervisor only treats
            // a failure of the :3003 listener as a crash.
            let router = signapps_proxy::router(shared).await?;
            run_server_on_addr(router, "0.0.0.0", 3003).await
        }
    })
}

fn spec_media(shared: SharedState) -> ServiceSpec {
    ServiceSpec::new("signapps-media", 3009, move || {
        let shared = shared.clone();
        async move {
            let router = signapps_media::router(shared).await?;
            run_server_on_addr(router, "0.0.0.0", 3009).await
        }
    })
}

fn spec_securelink(shared: SharedState) -> ServiceSpec {
    ServiceSpec::new("signapps-securelink", 3006, move || {
        let shared = shared.clone();
        async move {
            let router = signapps_securelink::router(shared).await?;
            run_server_on_addr(router, "0.0.0.0", 3006).await
        }
    })
}
