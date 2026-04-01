//! OpenAPI 3.1 spec — code-first via utoipa.
//!
//! `ContainersApiDoc` derives `OpenApi` and collects all annotated paths and schemas.
//! The spec is served at `GET /api/v1/openapi.json` and Swagger UI at `/swagger-ui/`.

use utoipa::OpenApi;

/// Top-level OpenAPI document for the Containers service.
#[derive(OpenApi)]
#[openapi(
    info(
        title = "SignApps Containers Service",
        version = "1.0.0",
        description = "Docker container lifecycle management for the SignApps Platform.",
        license(name = "Apache-2.0", url = "https://www.apache.org/licenses/LICENSE-2.0"),
    ),
    servers(
        (url = "http://localhost:3002", description = "Local development"),
    ),
    paths(
        // Health
        crate::handlers::health::health_check,
        // Containers
        crate::handlers::containers::list,
        crate::handlers::containers::get,
        crate::handlers::containers::create,
        crate::handlers::containers::start,
        crate::handlers::containers::stop,
        crate::handlers::containers::restart,
        crate::handlers::containers::update,
        crate::handlers::containers::logs,
        crate::handlers::containers::stats,
        crate::handlers::containers::delete,
        crate::handlers::containers::start_docker,
        crate::handlers::containers::stop_docker,
        crate::handlers::containers::restart_docker,
        crate::handlers::containers::remove_docker,
        crate::handlers::containers::logs_docker,
        crate::handlers::containers::stats_docker,
        crate::handlers::containers::inspect_docker,
        crate::handlers::containers::list_by_user,
        // Images
        crate::handlers::images::list,
        crate::handlers::images::pull,
        crate::handlers::images::delete,
        crate::handlers::images::force_delete,
        // Networks & Volumes
        crate::handlers::networks::list_networks,
        crate::handlers::networks::list_volumes,
        // Store
        crate::handlers::store::list_apps,
        crate::handlers::store::get_app_details,
        crate::handlers::store::install_app,
        crate::handlers::store::install_multi,
        crate::handlers::store::install_progress,
        crate::handlers::store::check_ports,
        crate::handlers::store::list_sources,
        crate::handlers::store::add_source,
        crate::handlers::store::delete_source,
        crate::handlers::store::validate_source,
        crate::handlers::store::refresh_source,
        crate::handlers::store::refresh_all,
        // Compose
        crate::handlers::compose::preview_compose,
        crate::handlers::compose::import_compose,
        // Updates
        crate::handlers::updates::check_update,
        crate::handlers::updates::set_auto_update,
        crate::handlers::updates::updates_status,
        // Backups
        crate::handlers::backups::list_profiles,
        crate::handlers::backups::get_profile,
        crate::handlers::backups::create_profile,
        crate::handlers::backups::update_profile,
        crate::handlers::backups::delete_profile,
        crate::handlers::backups::run_backup,
        crate::handlers::backups::list_snapshots,
        crate::handlers::backups::restore_snapshot,
        crate::handlers::backups::list_runs,
        // Quotas
        crate::handlers::quotas::get_my_quota,
        crate::handlers::quotas::get_user_quota,
        crate::handlers::quotas::update_user_quota,
    ),
    components(
        schemas(
            // Health
            crate::handlers::health::HealthResponse,
            // Container schemas
            crate::handlers::containers::ContainerResponse,
            crate::handlers::containers::ActionResponse,
            crate::handlers::containers::StopRequest,
            // Docker types
            crate::docker::ContainerConfig,
            crate::docker::ContainerInfo,
            crate::docker::ContainerStats,
            crate::docker::PortMapping,
            crate::docker::VolumeMount,
            crate::docker::RestartPolicy,
            crate::docker::ResourceLimits,
            crate::docker::MountInfo,
            crate::docker::ResourceInfo,
            crate::docker::HealthInfo,
            crate::docker::PortInfo,
            crate::docker::ImageInfo,
            crate::docker::NetworkInfo,
            crate::docker::VolumeInfo,
            // Image schemas
            crate::handlers::images::PullRequest,
            crate::handlers::images::PullResponse,
            // Store schemas
            crate::store::types::StoreApp,
            crate::store::types::SourceInfo,
            crate::store::types::AppDetails,
            crate::store::types::ParsedAppConfig,
            crate::store::types::ParsedService,
            crate::store::types::EnvVar,
            crate::store::types::AppPort,
            crate::store::types::AppVolume,
            crate::store::types::InstallRequest,
            crate::store::types::MultiServiceInstallRequest,
            crate::store::types::ServiceOverride,
            crate::store::types::PortOverride,
            crate::store::types::VolumeOverride,
            crate::store::types::AddSourceRequest,
            crate::store::types::AppSource,
            crate::store::types::InstallStarted,
            crate::store::types::PortConflict,
            crate::store::types::SourceValidation,
            // Compose schemas
            crate::handlers::compose::ImportComposeRequest,
            crate::handlers::compose::ComposePreview,
            crate::handlers::compose::ServicePreview,
            crate::handlers::compose::PortPreview,
            crate::handlers::compose::EnvPreview,
            crate::handlers::compose::VolumePreview,
            // Updates schemas
            crate::handlers::updates::CheckUpdateResponse,
            crate::handlers::updates::SetAutoUpdateRequest,
            crate::handlers::updates::AutoUpdateResponse,
            crate::handlers::updates::ContainerUpdateStatus,
            crate::handlers::updates::UpdatesStatusResponse,
            // Backup schemas
            crate::handlers::backups::ProfileListResponse,
            crate::handlers::backups::RunListResponse,
            crate::handlers::backups::SnapshotListResponse,
            crate::handlers::backups::RestoreRequest,
            signapps_db::models::BackupProfile,
            signapps_db::models::BackupRun,
            signapps_db::models::CreateBackupProfile,
            signapps_db::models::UpdateBackupProfile,
            crate::backup::restic::Snapshot,
            // Quota schemas
            crate::handlers::quotas::QuotaResponse,
            crate::handlers::quotas::QuotaUsagePercent,
            signapps_db::models::UpdateQuota,
        )
    ),
    tags(
        (name = "system", description = "Health check"),
        (name = "containers", description = "Container lifecycle management"),
        (name = "images", description = "Docker image management (admin)"),
        (name = "networks", description = "Docker networks and volumes (admin)"),
        (name = "store", description = "App store — catalog, install, sources"),
        (name = "compose", description = "Docker Compose import"),
        (name = "updates", description = "Container auto-update"),
        (name = "backups", description = "Backup profiles and restic snapshots"),
        (name = "quotas", description = "User container quotas"),
    ),
    modifiers(&SecurityAddon),
)]
pub struct ContainersApiDoc;

/// Adds the Bearer JWT security scheme to the OpenAPI spec.
struct SecurityAddon;

impl utoipa::Modify for SecurityAddon {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        if let Some(components) = openapi.components.as_mut() {
            use utoipa::openapi::security::{HttpAuthScheme, HttpBuilder, SecurityScheme};
            components.add_security_scheme(
                "bearerAuth",
                SecurityScheme::Http(
                    HttpBuilder::new()
                        .scheme(HttpAuthScheme::Bearer)
                        .bearer_format("JWT")
                        .build(),
                ),
            );
        }
    }
}
