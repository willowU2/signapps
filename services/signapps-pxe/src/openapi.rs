//! OpenAPI 3.1 spec — code-first via utoipa.
//!
//! `PxeApiDoc` collects all annotated paths and schemas.
//! Spec served at `GET /api-docs/openapi.json`, Swagger UI at `/swagger-ui/`.

use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

/// Top-level OpenAPI document for the PXE service.
#[derive(OpenApi)]
#[openapi(
    info(
        title = "SignApps PXE Service",
        version = "1.0.0",
        description = "PXE network boot management: profiles, assets, images, templates, deployments.",
        license(name = "Apache-2.0", url = "https://www.apache.org/licenses/LICENSE-2.0"),
    ),
    servers(
        (url = "http://localhost:3016", description = "Local development"),
    ),
    paths(
        // Profiles
        crate::handlers::list_profiles,
        crate::handlers::get_profile,
        crate::handlers::create_profile,
        crate::handlers::update_profile,
        crate::handlers::delete_profile,
        // Profile hooks (PX5)
        crate::images::get_profile_hooks,
        crate::images::update_profile_hooks,
        // Assets
        crate::handlers::list_assets,
        crate::handlers::get_asset,
        crate::handlers::register_asset,
        crate::handlers::update_asset,
        crate::handlers::delete_asset,
        // Boot script
        crate::handlers::generate_ipxe_script,
        // Images (PX2)
        crate::images::list_images,
        crate::images::upload_image,
        crate::images::delete_image,
        // Templates (PX3)
        crate::images::generate_template,
        // Deployments (PX4)
        crate::images::list_deployments,
        crate::images::update_deployment_progress,
        // Golden image capture (PX6)
        crate::images::capture_golden_image,
        // Catalog
        crate::catalog::list_catalog,
        crate::catalog::download_catalog_image,
    ),
    components(
        schemas(
            crate::models::PxeProfile,
            crate::models::CreatePxeProfileRequest,
            crate::models::UpdatePxeProfileRequest,
            crate::models::PxeAsset,
            crate::models::RegisterPxeAssetRequest,
            crate::models::UpdatePxeAssetRequest,
            crate::images::PxeImage,
            crate::images::PxeDeployment,
            crate::images::GenerateTemplateRequest,
            crate::images::TemplateUser,
            crate::images::GeneratedTemplate,
            crate::images::DeploymentProgressRequest,
            crate::images::PostDeployHooks,
            crate::images::DomainJoinConfig,
            crate::images::CaptureImageRequest,
            crate::images::CaptureImageResponse,
            crate::catalog::OsImage,
            crate::catalog::DownloadStarted,
        )
    ),
    tags(
        (name = "pxe-profiles", description = "PXE boot profile management"),
        (name = "pxe-assets", description = "PXE bare-metal asset registry"),
        (name = "pxe-boot", description = "iPXE script generation"),
        (name = "pxe-images", description = "OS image upload and management"),
        (name = "pxe-templates", description = "Kickstart / Preseed / Unattend template generation"),
        (name = "pxe-deployments", description = "Deployment progress tracking"),
        (name = "pxe-catalog", description = "Built-in OS image catalog and download"),
    ),
    modifiers(&SecurityAddon),
)]
pub struct PxeApiDoc;

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

/// Returns the SwaggerUi router to be merged into the main Axum router.
pub fn swagger_router() -> SwaggerUi {
    SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", PxeApiDoc::openapi())
}
