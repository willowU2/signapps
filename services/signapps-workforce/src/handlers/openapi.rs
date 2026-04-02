/// OpenAPI documentation for signapps-workforce.
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
        // ── Org ──────────────────────────────────────────────────────────────
        crate::handlers::org::get_tree,
        crate::handlers::org::create_node,
        crate::handlers::org::get_node,
        crate::handlers::org::update_node,
        crate::handlers::org::delete_node,
        crate::handlers::org::move_node,
        crate::handlers::org::get_children,
        crate::handlers::org::get_descendants,
        crate::handlers::org::get_ancestors,
        crate::handlers::org::list_node_types,
        crate::handlers::org::create_node_type,
        crate::handlers::org::delete_node_type,
        // ── Employees ────────────────────────────────────────────────────────
        crate::handlers::employees::list_employees,
        crate::handlers::employees::create_employee,
        crate::handlers::employees::get_employee,
        crate::handlers::employees::update_employee,
        crate::handlers::employees::delete_employee,
        crate::handlers::employees::link_user,
        crate::handlers::employees::unlink_user,
        crate::handlers::employees::get_functions,
        crate::handlers::employees::update_functions,
        crate::handlers::employees::list_by_org_node,
        crate::handlers::employees::search_employees,
        crate::handlers::employees::import_employees,
        // ── Function Definitions ─────────────────────────────────────────────
        crate::handlers::employees::list_function_definitions,
        crate::handlers::employees::create_function_definition,
        crate::handlers::employees::update_function_definition,
        crate::handlers::employees::delete_function_definition,
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
    ),
    components(schemas(
        // Org
        crate::handlers::org::OrgNode,
        crate::handlers::org::OrgNodeType,
        crate::handlers::org::CreateNodeRequest,
        crate::handlers::org::UpdateNodeRequest,
        crate::handlers::org::MoveNodeRequest,
        crate::handlers::org::CreateNodeTypeRequest,
        // Employees
        crate::handlers::employees::Employee,
        crate::handlers::employees::FunctionDefinition,
        crate::handlers::employees::ImportResult,
        crate::handlers::employees::CreateEmployeeRequest,
        crate::handlers::employees::UpdateEmployeeRequest,
        crate::handlers::employees::LinkUserRequest,
        crate::handlers::employees::UpdateFunctionsRequest,
        crate::handlers::employees::CreateFunctionDefinitionRequest,
        crate::handlers::employees::UpdateFunctionDefinitionRequest,
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
        (name = "Workforce Org", description = "Organizational hierarchy management"),
        (name = "Workforce Employees", description = "Employee CRUD and HR operations"),
        (name = "Workforce Functions", description = "Job function/role definitions"),
        (name = "Workforce Coverage", description = "Coverage templates and rules"),
        (name = "Workforce Validation", description = "Gap analysis and leave simulation"),
        (name = "Workforce Attendance", description = "Clock-in/clock-out attendance tracking"),
        (name = "Workforce Learning", description = "Learning courses and progress"),
    ),
    info(
        title = "SignApps Workforce API",
        version = "1.0.0",
        description = "Workforce planning — org hierarchy, employees, coverage, validation, attendance, learning"
    )
)]
pub struct WorkforceApiDoc;

pub fn swagger_router() -> utoipa_swagger_ui::SwaggerUi {
    utoipa_swagger_ui::SwaggerUi::new("/swagger-ui")
        .url("/api-docs/openapi.json", WorkforceApiDoc::openapi())
}
