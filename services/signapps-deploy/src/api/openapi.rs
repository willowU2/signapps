//! OpenAPI aggregator — expanded per handler in later tasks.

use utoipa::OpenApi;

/// Aggregated OpenAPI document for the Phase 3a deploy API.
#[derive(OpenApi)]
#[openapi(
    paths(),
    components(schemas()),
    tags(
        (name = "deploy", description = "Deployment orchestrator API"),
        (name = "feature-flags", description = "Feature flag management"),
    ),
    info(title = "SignApps Deploy API", version = "0.1.0"),
)]
pub struct ApiDoc;
