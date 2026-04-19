//! OpenAPI documentation for signapps-workforce (post S1 cutover).
//!
//! After the S1 org+RBAC refonte the workforce service keeps only
//! HR-pure endpoints. Org hierarchy, AD, boards, groups, policies,
//! delegations and employee CRUD are documented in `signapps-org`.

use utoipa::{
    openapi::security::{HttpAuthScheme, HttpBuilder, SecurityScheme},
    Modify, OpenApi,
};

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

#[derive(OpenApi)]
#[openapi(
    paths(
        // ── Coverage Templates ───────────────────────────────────────────────
        crate::handlers::coverage::list_templates,
        crate::handlers::coverage::create_template,
        crate::handlers::coverage::get_template,
        crate::handlers::coverage::update_template,
        crate::handlers::coverage::delete_template,
        crate::handlers::coverage::duplicate_template,
        // ── Coverage Rules ───────────────────────────────────────────────────
        crate::handlers::coverage::list_rules,
        crate::handlers::coverage::create_rule,
        crate::handlers::coverage::get_rule,
        crate::handlers::coverage::update_rule,
        crate::handlers::coverage::delete_rule,
        crate::handlers::coverage::get_rules_by_node,
        crate::handlers::coverage::get_effective_coverage,
        // ── Validation ───────────────────────────────────────────────────────
        crate::handlers::validation::validate_coverage,
        crate::handlers::validation::analyze_gaps,
        crate::handlers::validation::simulate_leave,
        crate::handlers::validation::simulate_shift_change,
        crate::handlers::validation::get_conflicts,
        // ── Attendance ───────────────────────────────────────────────────────
        crate::handlers::attendance::clock_in,
        crate::handlers::attendance::clock_out,
        crate::handlers::attendance::list_attendance,
        // ── Learning ─────────────────────────────────────────────────────────
        crate::handlers::learning::list_courses,
        crate::handlers::learning::get_course,
        crate::handlers::learning::update_progress,
        // ── Audit ──────────────────────────────────────────────────────────────
        crate::handlers::audit::query_audit,
        crate::handlers::audit::entity_history,
        crate::handlers::audit::actor_history,
    ),
    components(schemas(
        // Coverage
        crate::handlers::coverage::CoverageTemplate,
        crate::handlers::coverage::CoverageRule,
        crate::handlers::coverage::CoverageSlot,
        crate::handlers::coverage::WeeklyPattern,
        crate::handlers::coverage::CreateTemplateRequest,
        crate::handlers::coverage::UpdateTemplateRequest,
        crate::handlers::coverage::CreateRuleRequest,
        crate::handlers::coverage::UpdateRuleRequest,
        // Validation
        crate::handlers::validation::TimeSpan,
        crate::handlers::validation::DateRange,
        crate::handlers::validation::ValidateCoverageRequest,
        crate::handlers::validation::LeaveSimulationRequest,
        crate::handlers::validation::ShiftChangeSimulationRequest,
        // Attendance
        crate::handlers::attendance::AttendanceRecord,
        crate::handlers::attendance::ClockInRequest,
        crate::handlers::attendance::ClockOutRequest,
        // Learning
        crate::handlers::learning::Course,
        crate::handlers::learning::CourseProgress,
        crate::handlers::learning::UpdateProgressRequest,
    )),
    modifiers(&SecurityAddon),
    tags(
        (name = "Workforce Coverage", description = "Coverage templates and rules"),
        (name = "Workforce Validation", description = "Gap analysis and leave simulation"),
        (name = "Workforce Attendance", description = "Clock-in/clock-out attendance tracking"),
        (name = "Workforce Learning", description = "Learning courses and progress"),
        (name = "Workforce Audit", description = "Org structure audit log queries"),
    ),
    info(
        title = "SignApps Workforce API",
        version = "1.0.0",
        description = "Workforce HR (post S1 cutover) — coverage, validation, attendance, learning, audit. \
                       Org hierarchy, AD, boards, groups, policies and delegations now live in signapps-org."
    )
)]
pub struct WorkforceApiDoc;

pub fn swagger_router() -> utoipa_swagger_ui::SwaggerUi {
    utoipa_swagger_ui::SwaggerUi::new("/swagger-ui")
        .url("/api-docs/openapi.json", WorkforceApiDoc::openapi())
}
