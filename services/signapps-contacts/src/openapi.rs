//! OpenAPI 3.1 spec — code-first via utoipa.
//!
//! `ContactsApiDoc` collects all annotated paths and schemas.
//! Spec served at `GET /api-docs/openapi.json`, Swagger UI at `/swagger-ui/`.

use utoipa::{
    openapi::security::{HttpAuthScheme, HttpBuilder, SecurityScheme},
    Modify, OpenApi,
};
use utoipa_swagger_ui::SwaggerUi;

/// Adds the Bearer JWT security scheme to the OpenAPI spec.
pub struct SecurityAddon;

impl Modify for SecurityAddon {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        if let Some(components) = openapi.components.as_mut() {
            components.add_security_scheme(
                "bearer",
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

/// Top-level OpenAPI document for the Contacts service.
#[derive(OpenApi)]
#[openapi(
    info(
        title = "SignApps Contacts",
        version = "1.0.0",
        description = "Contact and address book management with group support, vCard import/export, and CardDAV sync."
    ),
    servers(
        (url = "http://localhost:3014", description = "Local development"),
    ),
    paths(
        // System
        crate::health_check,
        // Contacts CRUD
        crate::list_contacts,
        crate::create_contact,
        crate::get_contact,
        crate::update_contact,
        crate::delete_contact,
        // Import / Export
        crate::import_contacts_csv,
        crate::carddav::export_vcf,
        crate::carddav::import_vcf,
        // Groups
        crate::list_groups,
        crate::create_group,
        crate::update_group,
        crate::delete_group,
        crate::add_group_member,
        crate::remove_group_member,
        // CardDAV sync
        crate::carddav_sync::sync_carddav,
    ),
    components(schemas(
        crate::Contact,
        crate::ContactGroup,
        crate::CreateContactRequest,
        crate::UpdateContactRequest,
        crate::CreateGroupRequest,
        crate::UpdateGroupRequest,
        crate::AddGroupMemberRequest,
        crate::carddav_sync::CardDavSyncRequest,
        crate::carddav_sync::CardDavSyncResult,
    )),
    tags(
        (name = "System", description = "Health and system endpoints"),
        (name = "Contacts", description = "Contact management (CRUD, import, export)"),
        (name = "Groups", description = "Contact group management"),
        (name = "CardDAV", description = "CardDAV sync with external address book servers"),
    ),
    modifiers(&SecurityAddon),
)]
pub struct ContactsApiDoc;

/// Returns a `SwaggerUi` router for the Contacts service.
pub fn swagger_router() -> SwaggerUi {
    SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", ContactsApiDoc::openapi())
}
