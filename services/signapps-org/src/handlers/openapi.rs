//! Aggregated OpenAPI spec for the canonical `/api/v1/org/*` surface (S1 W2).
//!
//! The Swagger UI router is wired in by `signapps_org::create_router()`.
//! The paths list will be fleshed out as Task 10/11 add utoipa-decorated
//! handlers. Keeping the `OrgApiDoc` struct even when empty lets the
//! Swagger UI mount successfully from day one.

use utoipa::OpenApi;

/// Canonical OpenAPI document for `/api/v1/org/*`.
#[derive(OpenApi)]
#[openapi(
    info(
        title = "SignApps Org API",
        description = "Canonical organization data model — nodes, persons, \
                       assignments, policies, boards, grants, AD & provisioning",
        version = "0.1.0",
    ),
    paths(),
    components(schemas()),
    tags((name = "Org", description = "Canonical organization data model"))
)]
pub struct OrgApiDoc;
