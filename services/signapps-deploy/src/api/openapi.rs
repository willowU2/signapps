//! OpenAPI aggregator for the Phase 3a deploy API.
//!
//! Composes every handler's `#[utoipa::path]` attribute and every exposed
//! schema into a single document served at `/api-docs/openapi.json` with
//! a Swagger UI at `/swagger-ui/`.

use utoipa::OpenApi;

use crate::api::handlers::{
    deploy, envs, feature_flags, history, maintenance, promote, rollback, versions,
};

/// Aggregated OpenAPI document for the deploy API.
#[derive(OpenApi)]
#[openapi(
    paths(
        envs::list_envs,
        envs::env_health,
        versions::list_versions,
        history::list_history,
        deploy::deploy,
        rollback::rollback,
        maintenance::toggle_maintenance,
        promote::promote,
        feature_flags::list_flags,
        feature_flags::get_flag,
        feature_flags::upsert_flag,
        feature_flags::delete_flag,
    ),
    components(schemas(
        envs::EnvStatus,
        envs::EnvHealth,
        versions::VersionEntry,
        history::DeploymentEntry,
        deploy::DeployRequest,
        deploy::DeployResponse,
        rollback::RollbackRequest,
        rollback::RollbackResponse,
        maintenance::MaintenanceRequest,
        maintenance::MaintenanceResponse,
        promote::PromoteRequest,
        promote::PromoteResponse,
        feature_flags::UpsertRequest,
        feature_flags::DeleteResponse,
        signapps_feature_flags::FeatureFlag,
    )),
    tags(
        (name = "deploy", description = "Deployment orchestrator API"),
        (name = "feature-flags", description = "Feature flag management"),
    ),
    info(title = "SignApps Deploy API", version = "0.1.0"),
)]
pub struct ApiDoc;
