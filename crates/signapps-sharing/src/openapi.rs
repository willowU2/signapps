//! OpenAPI specification for the sharing system.
//!
//! Each service that mounts sharing routes can include this in its OpenAPI
//! bundle by merging `SharingApiDoc` into its own `#[derive(OpenApi)]` struct,
//! or by serving the spec independently.
//!
//! # Example
//!
//! ```rust,ignore
//! use signapps_sharing::openapi::SharingApiDoc;
//! use utoipa::OpenApi;
//!
//! let spec = SharingApiDoc::openapi();
//! println!("{}", spec.to_pretty_json().unwrap());
//! ```

use utoipa::OpenApi;

use crate::{handlers, models, types};

/// Security scheme modifier — adds the Bearer JWT scheme to the OpenAPI spec.
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

/// Top-level OpenAPI document for the sharing subsystem.
///
/// Services that mount the sharing routes can embed this doc into their own
/// spec by referencing the same paths/schemas.
#[derive(OpenApi)]
#[openapi(
    info(
        title = "SignApps Sharing API",
        version = "1.0.0",
        description = "Unified permission and sharing engine for the SignApps Platform.",
    ),
    paths(
        handlers::list_grants_handler,
        handlers::create_grant_handler,
        handlers::revoke_grant_handler,
        handlers::permissions_handler,
        handlers::shared_with_me_handler,
        handlers::list_templates_handler,
        handlers::create_template_handler,
        handlers::delete_template_handler,
        handlers::list_audit_handler,
    ),
    components(
        schemas(
            models::Grant,
            models::CreateGrant,
            models::Policy,
            models::Template,
            models::CreateTemplate,
            models::Capability,
            models::DefaultVisibility,
            models::AuditEntry,
            models::EffectivePermission,
            models::PermissionSource,
            types::ResourceType,
            types::Role,
            types::GranteeType,
            types::Action,
        )
    ),
    tags(
        (name = "Sharing", description = "Unified sharing and permissions API")
    ),
    modifiers(&SecurityAddon),
)]
pub struct SharingApiDoc;
