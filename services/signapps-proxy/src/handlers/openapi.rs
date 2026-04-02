//! OpenAPI documentation for SignApps Proxy service.

use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

#[derive(OpenApi)]
#[openapi(
    paths(
        crate::handlers::health::health_check,
        crate::handlers::proxy_status::get_proxy_status,
        crate::handlers::config::get_proxy_config,
        crate::handlers::config::get_proxy_overview,
        crate::handlers::config::refresh_config,
        crate::handlers::routes::list_routes,
        crate::handlers::routes::get_route,
        crate::handlers::routes::create_route,
        crate::handlers::routes::update_route,
        crate::handlers::routes::delete_route,
        crate::handlers::routes::enable_route,
        crate::handlers::routes::disable_route,
        crate::handlers::certificates::list_certificates,
        crate::handlers::certificates::upload_certificate,
        crate::handlers::certificates::request_certificate,
        crate::handlers::certificates::renew_certificate,
        crate::handlers::certificates::delete_certificate,
        crate::handlers::shield::get_stats,
        crate::handlers::shield::reset_stats,
        crate::handlers::shield::block_ip,
        crate::handlers::shield::unblock_ip,
        crate::handlers::shield::check_blocked,
    ),
    components(schemas(
        crate::handlers::health::HealthResponse,
        crate::handlers::health::ComponentsHealth,
        crate::handlers::proxy_status::ProxyStatusResponse,
        crate::handlers::proxy_status::ListenerStatus,
        crate::handlers::routes::RouteResponse,
        crate::handlers::certificates::CertificateResponse,
        crate::handlers::certificates::RequestCertificateBody,
        crate::handlers::shield::BlockIpRequest,
        crate::handlers::shield::BlockResponse,
        signapps_db::models::Route,
        signapps_db::models::CreateRoute,
        signapps_db::models::UpdateRoute,
        signapps_db::models::ShieldConfig,
        signapps_db::models::ShieldStats,
        signapps_db::models::HeadersConfig,
        signapps_db::models::HeaderEntry,
        signapps_db::models::GeoBlockConfig,
        signapps_db::models::RouteMode,
        signapps_db::models::CreateCertificate,
    )),
    modifiers(&SecurityAddon),
    info(title = "SignApps Proxy", version = "1.0.0", description = "Reverse proxy control plane for SignApps Platform")
)]
pub struct ProxyApiDoc;

struct SecurityAddon;

impl utoipa::Modify for SecurityAddon {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        if let Some(components) = openapi.components.as_mut() {
            components.add_security_scheme(
                "bearer",
                utoipa::openapi::security::SecurityScheme::Http(
                    utoipa::openapi::security::HttpBuilder::new()
                        .scheme(utoipa::openapi::security::HttpAuthScheme::Bearer)
                        .bearer_format("JWT")
                        .build(),
                ),
            );
        }
    }
}

/// Create the Swagger UI router.
pub fn swagger_router() -> SwaggerUi {
    SwaggerUi::new("/swagger-ui")
        .url("/api-docs/openapi.json", ProxyApiDoc::openapi())
}
