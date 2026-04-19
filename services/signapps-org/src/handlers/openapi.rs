//! Aggregated OpenAPI spec for the canonical `/api/v1/org/*` surface (S1 W2).
//!
//! Registers every utoipa-decorated handler exposed by the canonical
//! `signapps-org` service. The Swagger UI router is mounted by
//! [`swagger_router`] — plugged into the main router by
//! `signapps_org::create_router()` so operators can browse the API at
//! `/swagger-ui/` and fetch the raw JSON at `/api-docs/openapi.json`.

use utoipa::{
    openapi::security::{HttpAuthScheme, HttpBuilder, SecurityScheme},
    Modify, OpenApi,
};

/// Injects the `bearerAuth` security scheme into every generated
/// component so the `security(("bearerAuth" = []))` hints on each
/// handler resolve correctly in the Swagger UI.
pub struct SecurityAddon;

impl Modify for SecurityAddon {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        if let Some(components) = openapi.components.as_mut() {
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

/// Canonical OpenAPI document for `/api/v1/org/*`.
#[derive(OpenApi)]
#[openapi(
    info(
        title = "SignApps Org API",
        description = "Canonical organization data model — nodes, persons, \
                       assignments, policies, boards, grants, AD & provisioning.",
        version = "0.1.0",
    ),
    paths(
        // ── Nodes ────────────────────────────────────────────────────────────
        crate::handlers::nodes::list,
        crate::handlers::nodes::create,
        crate::handlers::nodes::detail,
        crate::handlers::nodes::update,
        crate::handlers::nodes::archive,
        crate::handlers::nodes::subtree,
        // ── Persons ──────────────────────────────────────────────────────────
        crate::handlers::persons::list,
        crate::handlers::persons::create,
        crate::handlers::persons::detail,
        crate::handlers::persons::update,
        crate::handlers::persons::archive,
        // ── Canonical assignments ────────────────────────────────────────────
        crate::handlers::canonical_assignments::list,
        crate::handlers::canonical_assignments::create,
        crate::handlers::canonical_assignments::archive,
        // ── Policies + bindings ──────────────────────────────────────────────
        crate::handlers::policies::list,
        crate::handlers::policies::create,
        crate::handlers::policies::detail,
        crate::handlers::policies::update,
        crate::handlers::policies::delete_policy,
        crate::handlers::policies::bind,
        crate::handlers::policies::unbind,
        crate::handlers::policies::bindings_subtree,
        // ── Boards + members ─────────────────────────────────────────────────
        crate::handlers::boards::upsert,
        crate::handlers::boards::by_node,
        crate::handlers::boards::add_member,
        crate::handlers::boards::update_member,
        crate::handlers::boards::remove_member,
    ),
    components(schemas(
        // Canonical models re-exported from signapps-db.
        signapps_db::models::org::OrgNode,
        signapps_db::models::org::NodeKind,
        signapps_db::models::org::Person,
        signapps_db::models::org::Assignment,
        signapps_db::models::org::Axis,
        signapps_db::models::org::Policy,
        signapps_db::models::org::PolicyBinding,
        signapps_db::models::org::PermissionSpec,
        signapps_db::models::org::Board,
        signapps_db::models::org::BoardMember,
        // Request / response DTOs.
        crate::handlers::nodes::CreateNodeBody,
        crate::handlers::nodes::UpdateNodeBody,
        crate::handlers::nodes::SubtreeResponse,
        crate::handlers::persons::CreatePersonBody,
        crate::handlers::persons::UpdatePersonBody,
        crate::handlers::canonical_assignments::CreateAssignmentBody,
        crate::handlers::policies::CreatePolicyBody,
        crate::handlers::policies::UpdatePolicyBody,
        crate::handlers::policies::CreateBindingBody,
        crate::handlers::boards::UpsertBoardBody,
        crate::handlers::boards::BoardWithMembers,
        crate::handlers::boards::AddMemberBody,
        crate::handlers::boards::UpdateMemberBody,
    )),
    modifiers(&SecurityAddon),
    tags(
        (name = "Org", description = "Canonical organization data model — \
                                      nodes, persons, assignments, policies, boards, grants"),
    )
)]
pub struct OrgApiDoc;

/// Build the Swagger UI router that exposes the canonical OpenAPI doc.
///
/// Mounted at `/swagger-ui/` by [`signapps_org::create_router`], with
/// the raw JSON at `/api-docs/openapi.json`.
#[must_use]
pub fn swagger_router() -> utoipa_swagger_ui::SwaggerUi {
    utoipa_swagger_ui::SwaggerUi::new("/swagger-ui")
        .url("/api-docs/openapi.json", OrgApiDoc::openapi())
}
