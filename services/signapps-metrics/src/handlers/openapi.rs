//! OpenAPI documentation for SignApps Metrics service.

use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

#[derive(OpenApi)]
#[openapi(
    paths(
        crate::handlers::metrics::health_check,
        crate::handlers::metrics::get_all_metrics,
        crate::handlers::metrics::get_cpu_metrics,
        crate::handlers::metrics::get_memory_metrics,
        crate::handlers::metrics::get_disk_metrics,
        crate::handlers::metrics::get_network_metrics,
        crate::handlers::metrics::get_summary,
        crate::handlers::alerts::list_alerts,
        crate::handlers::alerts::get_alert,
        crate::handlers::alerts::create_alert,
        crate::handlers::alerts::update_alert,
        crate::handlers::alerts::delete_alert,
        crate::handlers::alerts::get_active_alerts,
        crate::handlers::alerts::list_alert_events,
        crate::handlers::alerts::acknowledge_alert,
        crate::handlers::analytics::get_overview,
        crate::handlers::analytics::get_storage,
        crate::handlers::analytics::get_activity,
        crate::handlers::api_quota::list_api_quotas,
        crate::handlers::api_quota::get_user_api_quota,
        crate::handlers::esg::get_esg_scores,
        crate::handlers::esg::upsert_esg_score,
        crate::handlers::esg::get_esg_quarterly,
        crate::handlers::esg::upsert_esg_quarterly,
        crate::handlers::experiments::list_experiments,
        crate::handlers::experiments::create_experiment,
        crate::handlers::experiments::update_experiment,
        crate::handlers::experiments::delete_experiment,
        crate::handlers::pool_stats::get_pool_stats,
        crate::handlers::slow_queries::list_slow_queries,
    ),
    components(schemas(
        crate::handlers::metrics::HealthResponse,
        crate::handlers::metrics::SummaryMetrics,
        crate::metrics::collector::SystemMetrics,
        crate::metrics::collector::CpuMetrics,
        crate::metrics::collector::LoadAverage,
        crate::metrics::collector::MemoryMetrics,
        crate::metrics::collector::DiskMetrics,
        crate::metrics::collector::NetworkMetrics,
        crate::handlers::alerts::AlertConfig,
        crate::handlers::alerts::AlertEvent,
        crate::handlers::alerts::AlertSeverity,
        crate::handlers::alerts::AlertStatus,
        crate::handlers::alerts::MetricType,
        crate::handlers::alerts::Operator,
        crate::handlers::alerts::CreateAlertRequest,
        crate::handlers::alerts::UpdateAlertRequest,
        crate::handlers::alerts::AcknowledgeRequest,
        crate::handlers::analytics::AnalyticsOverview,
        crate::handlers::analytics::StorageByUser,
        crate::handlers::analytics::ActivityPoint,
        crate::handlers::api_quota::ApiQuotaEntry,
        crate::handlers::esg::EsgScore,
        crate::handlers::esg::EsgQuarterly,
        crate::handlers::esg::UpsertEsgScoreRequest,
        crate::handlers::esg::UpsertEsgQuarterlyRequest,
        crate::handlers::experiments::Experiment,
        crate::handlers::experiments::CreateExperimentRequest,
        crate::handlers::experiments::UpdateExperimentRequest,
        crate::handlers::pool_stats::PoolStats,
        crate::handlers::slow_queries::SlowQuery,
        crate::handlers::slow_queries::SlowQueriesResponse,
    )),
    modifiers(&SecurityAddon),
    info(title = "SignApps Metrics", version = "1.0.0", description = "Monitoring and metrics service for SignApps Platform")
)]
pub struct MetricsApiDoc;

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
    SwaggerUi::new("/swagger-ui/{_:.*}")
        .url("/api-docs/openapi.json", MetricsApiDoc::openapi())
}
