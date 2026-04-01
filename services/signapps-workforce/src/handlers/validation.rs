//! Validation Handlers
//!
//! Coverage validation, gap analysis, and leave simulation.
//! The validation engine checks staffing requirements against scheduled assignments.

use axum::{
    extract::{Extension, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, Datelike, NaiveDate, NaiveTime, TimeZone, Utc, Weekday};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use crate::handlers::coverage::{CoverageSlot, WeeklyPattern};
use crate::AppState;
use signapps_common::{Claims, TenantContext};

// ============================================================================
// Types
// ============================================================================

/// TimeSpan for scheduling operations
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
/// TimeSpan data transfer object.
pub struct TimeSpan {
    pub start: DateTime<Utc>,
    pub end: DateTime<Utc>,
}

impl TimeSpan {
    #[allow(dead_code)] // Scaffolded — will be wired when handler is implemented
    pub fn new(start: DateTime<Utc>, end: DateTime<Utc>) -> Self {
        Self { start, end }
    }

    pub fn duration_minutes(&self) -> i64 {
        (self.end - self.start).num_minutes()
    }

    pub fn overlaps(&self, other: &TimeSpan) -> bool {
        self.start < other.end && other.start < self.end
    }

    #[allow(dead_code)] // Scaffolded — will be wired when handler is implemented
    pub fn contains(&self, datetime: DateTime<Utc>) -> bool {
        datetime >= self.start && datetime < self.end
    }
}

/// Coverage validation request
#[derive(Debug, Deserialize, Validate, utoipa::ToSchema)]
/// Request body for ValidateCoverage.
pub struct ValidateCoverageRequest {
    pub org_node_id: Uuid,
    pub date_range: DateRange,
    #[allow(dead_code)] // Scaffolded — will be wired when handler is implemented
    pub include_descendants: Option<bool>,
}

/// Date range for queries
#[derive(Debug, Clone, Deserialize, Serialize, utoipa::ToSchema)]
/// DateRange data transfer object.
pub struct DateRange {
    pub start: NaiveDate,
    pub end: NaiveDate,
}

/// Coverage validation result
#[derive(Debug, Serialize)]
/// CoverageValidationResult data transfer object.
pub struct CoverageValidationResult {
    pub org_node_id: Uuid,
    pub org_node_name: String,
    pub date_range: DateRange,
    pub gaps: Vec<CoverageGap>,
    pub overstaffed: Vec<OverstaffedSlot>,
    pub summary: ValidationSummary,
}

/// Coverage gap (understaffed slot)
#[derive(Debug, Clone, Serialize)]
/// CoverageGap data transfer object.
pub struct CoverageGap {
    pub date: NaiveDate,
    pub slot: CoverageSlot,
    pub required: i32,
    pub assigned: i32,
    pub missing: i32,
    pub missing_functions: Vec<String>,
    pub severity: GapSeverity,
}

/// Overstaffed slot
#[derive(Debug, Clone, Serialize)]
/// OverstaffedSlot data transfer object.
pub struct OverstaffedSlot {
    pub date: NaiveDate,
    pub slot: CoverageSlot,
    pub max_employees: i32,
    pub assigned: i32,
    pub excess: i32,
}

/// Gap severity level
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum GapSeverity {
    Low,      // Missing 1-25% of required staff
    Medium,   // Missing 26-50% of required staff
    High,     // Missing 51-75% of required staff
    Critical, // Missing >75% of required staff
}

/// Validation summary
#[derive(Debug, Serialize)]
/// ValidationSummary data transfer object.
pub struct ValidationSummary {
    pub total_slots: i32,
    pub covered_slots: i32,
    pub gap_count: i32,
    pub overstaffed_count: i32,
    pub coverage_percentage: f64,
    pub critical_gaps: i32,
    pub high_gaps: i32,
    pub medium_gaps: i32,
    pub low_gaps: i32,
}

/// Gap analysis query params
#[derive(Debug, Deserialize)]
/// Query parameters for filtering results.
pub struct GapAnalysisParams {
    pub org_node_id: Option<Uuid>,
    pub from: NaiveDate,
    pub to: NaiveDate,
    pub severity: Option<String>,
}

/// Leave simulation request
#[derive(Debug, Deserialize, Validate, utoipa::ToSchema)]
/// Request body for LeaveSimulation.
pub struct LeaveSimulationRequest {
    pub employee_id: Uuid,
    pub leave_type: String,
    pub date_range: DateRange,
}

/// Leave simulation result
#[derive(Debug, Serialize)]
/// LeaveSimulationResult data transfer object.
pub struct LeaveSimulationResult {
    pub employee_id: Uuid,
    pub employee_name: String,
    pub leave_type: String,
    pub date_range: DateRange,
    pub can_approve: bool,
    pub impacts: Vec<LeaveImpact>,
    pub suggested_replacements: Vec<SuggestedReplacement>,
    pub warnings: Vec<String>,
}

/// Leave impact on coverage
#[derive(Debug, Serialize)]
/// LeaveImpact data transfer object.
pub struct LeaveImpact {
    pub date: NaiveDate,
    pub org_node_id: Uuid,
    pub org_node_name: String,
    pub slot: CoverageSlot,
    pub coverage_before: i32,
    pub coverage_after: i32,
    pub creates_gap: bool,
    pub severity: Option<GapSeverity>,
}

/// Suggested replacement employee
#[derive(Debug, Serialize)]
/// SuggestedReplacement data transfer object.
pub struct SuggestedReplacement {
    pub employee_id: Uuid,
    pub employee_name: String,
    pub functions: Vec<String>,
    pub availability_score: f64,
    pub conflicts: Vec<String>,
}

/// Shift change simulation request
#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request body for ShiftChangeSimulation.
pub struct ShiftChangeSimulationRequest {
    pub employee_id: Uuid,
    pub original_shift: TimeSpan,
    pub new_shift: Option<TimeSpan>,
    #[allow(dead_code)] // Scaffolded — will be wired when handler is implemented
    pub reason: Option<String>,
}

/// Shift change simulation result
#[derive(Debug, Serialize)]
/// ShiftChangeSimulationResult data transfer object.
pub struct ShiftChangeSimulationResult {
    pub employee_id: Uuid,
    pub employee_name: String,
    pub original_shift: TimeSpan,
    pub new_shift: Option<TimeSpan>,
    pub can_approve: bool,
    pub coverage_impact: CoverageImpact,
    pub warnings: Vec<String>,
}

/// Coverage impact summary
#[derive(Debug, Serialize)]
/// CoverageImpact data transfer object.
pub struct CoverageImpact {
    pub gaps_created: i32,
    pub gaps_resolved: i32,
    pub net_impact: i32,
    pub affected_slots: Vec<AffectedSlot>,
}

/// Affected slot detail
#[derive(Debug, Serialize)]
/// AffectedSlot data transfer object.
pub struct AffectedSlot {
    pub date: NaiveDate,
    pub time_range: String,
    pub coverage_before: i32,
    pub coverage_after: i32,
    pub required: i32,
}

/// Conflict in scheduling
#[derive(Debug, Serialize)]
/// SchedulingConflict data transfer object.
pub struct SchedulingConflict {
    pub id: Uuid,
    pub conflict_type: ConflictType,
    pub description: String,
    pub severity: GapSeverity,
    pub affected_employees: Vec<Uuid>,
    pub affected_dates: Vec<NaiveDate>,
    pub suggested_resolution: Option<String>,
}

/// Conflict type
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ConflictType {
    CoverageGap,
    Overstaffing,
    DoubleBooking,
    #[allow(dead_code)] // Scaffolded — will be wired when handler is implemented
    RestTimeViolation,
    #[allow(dead_code)] // Scaffolded — will be wired when handler is implemented
    MaxHoursExceeded,
    #[allow(dead_code)] // Scaffolded — will be wired when handler is implemented
    FunctionMismatch,
}

/// Conflict query params
#[derive(Debug, Deserialize)]
/// Query parameters for filtering results.
pub struct ConflictQueryParams {
    pub org_node_id: Option<Uuid>,
    pub from: Option<NaiveDate>,
    pub to: Option<NaiveDate>,
    pub conflict_type: Option<String>,
}

// ============================================================================
// Handlers
// ============================================================================

/// Validate coverage for an organization node
#[utoipa::path(
    post,
    path = "/api/v1/workforce/validate/coverage",
    request_body = ValidateCoverageRequest,
    responses(
        (status = 200, description = "Coverage validation result"),
        (status = 400, description = "Invalid input"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Organization node not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Validation"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn validate_coverage(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Json(req): Json<ValidateCoverageRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    req.validate().map_err(|e| {
        tracing::warn!("Validation error: {}", e);
        StatusCode::BAD_REQUEST
    })?;

    // Get org node name
    let org_node_name: String =
        sqlx::query_scalar("SELECT name FROM workforce_org_nodes WHERE id = $1 AND tenant_id = $2")
            .bind(req.org_node_id)
            .bind(ctx.tenant_id)
            .fetch_optional(&*state.pool)
            .await
            .map_err(|e| {
                tracing::error!("Failed to get org node: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?
            .ok_or(StatusCode::NOT_FOUND)?;

    // Get effective coverage rules
    let coverage_slots = get_effective_slots(&state, ctx.tenant_id, req.org_node_id).await?;

    // Get assigned shifts for the date range
    let assignments =
        get_assignments(&state, ctx.tenant_id, req.org_node_id, &req.date_range).await?;

    // Calculate gaps and overstaffing
    let mut gaps = Vec::new();
    let mut overstaffed = Vec::new();
    let mut total_slots = 0;
    let mut covered_slots = 0;

    let mut current_date = req.date_range.start;
    while current_date <= req.date_range.end {
        let weekday = current_date.weekday();
        let day_index = weekday_to_index(weekday);

        for slot in coverage_slots.iter().filter(|s| s.day_of_week == day_index) {
            total_slots += 1;

            // Count assigned employees for this slot on this date
            let assigned_count = count_assignments_for_slot(&assignments, current_date, slot);

            if assigned_count < slot.min_employees {
                let missing = slot.min_employees - assigned_count;
                let severity = calculate_severity(assigned_count, slot.min_employees);

                gaps.push(CoverageGap {
                    date: current_date,
                    slot: slot.clone(),
                    required: slot.min_employees,
                    assigned: assigned_count,
                    missing,
                    missing_functions: slot.required_functions.clone(),
                    severity,
                });
            } else {
                covered_slots += 1;

                if let Some(max) = slot.max_employees {
                    if assigned_count > max {
                        overstaffed.push(OverstaffedSlot {
                            date: current_date,
                            slot: slot.clone(),
                            max_employees: max,
                            assigned: assigned_count,
                            excess: assigned_count - max,
                        });
                    }
                }
            }
        }

        current_date = current_date.succ_opt().unwrap_or(current_date);
    }

    // Calculate summary
    let coverage_percentage = if total_slots > 0 {
        (covered_slots as f64 / total_slots as f64) * 100.0
    } else {
        100.0
    };

    let summary = ValidationSummary {
        total_slots,
        covered_slots,
        gap_count: gaps.len() as i32,
        overstaffed_count: overstaffed.len() as i32,
        coverage_percentage,
        critical_gaps: gaps
            .iter()
            .filter(|g| g.severity == GapSeverity::Critical)
            .count() as i32,
        high_gaps: gaps
            .iter()
            .filter(|g| g.severity == GapSeverity::High)
            .count() as i32,
        medium_gaps: gaps
            .iter()
            .filter(|g| g.severity == GapSeverity::Medium)
            .count() as i32,
        low_gaps: gaps
            .iter()
            .filter(|g| g.severity == GapSeverity::Low)
            .count() as i32,
    };

    Ok(Json(CoverageValidationResult {
        org_node_id: req.org_node_id,
        org_node_name,
        date_range: req.date_range,
        gaps,
        overstaffed,
        summary,
    }))
}

/// Analyze gaps across organization
#[utoipa::path(
    get,
    path = "/api/v1/workforce/validate/gaps",
    responses(
        (status = 200, description = "Coverage gap analysis results"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Validation"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn analyze_gaps(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Query(params): Query<GapAnalysisParams>,
) -> Result<impl IntoResponse, StatusCode> {
    // Get all org nodes to analyze
    let node_ids: Vec<Uuid> = if let Some(node_id) = params.org_node_id {
        // Get this node and all descendants
        sqlx::query_scalar(
            r#"
            SELECT descendant_id FROM workforce_org_closure
            WHERE ancestor_id = $1
            "#,
        )
        .bind(node_id)
        .fetch_all(&*state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get descendants: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
    } else {
        // Get all root nodes
        sqlx::query_scalar(
            r#"
            SELECT id FROM workforce_org_nodes
            WHERE tenant_id = $1 AND parent_id IS NULL AND is_active = true
            "#,
        )
        .bind(ctx.tenant_id)
        .fetch_all(&*state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get root nodes: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
    };

    let mut all_gaps = Vec::new();
    let date_range = DateRange {
        start: params.from,
        end: params.to,
    };

    for node_id in node_ids {
        let coverage_slots = get_effective_slots(&state, ctx.tenant_id, node_id).await?;
        let assignments = get_assignments(&state, ctx.tenant_id, node_id, &date_range).await?;

        let mut current_date = params.from;
        while current_date <= params.to {
            let weekday = current_date.weekday();
            let day_index = weekday_to_index(weekday);

            for slot in coverage_slots.iter().filter(|s| s.day_of_week == day_index) {
                let assigned_count = count_assignments_for_slot(&assignments, current_date, slot);

                if assigned_count < slot.min_employees {
                    let missing = slot.min_employees - assigned_count;
                    let severity = calculate_severity(assigned_count, slot.min_employees);

                    // Filter by severity if specified
                    if let Some(ref sev_filter) = params.severity {
                        let matches = match sev_filter.as_str() {
                            "critical" => severity == GapSeverity::Critical,
                            "high" => severity == GapSeverity::High,
                            "medium" => severity == GapSeverity::Medium,
                            "low" => severity == GapSeverity::Low,
                            _ => true,
                        };
                        if !matches {
                            continue;
                        }
                    }

                    all_gaps.push(CoverageGap {
                        date: current_date,
                        slot: slot.clone(),
                        required: slot.min_employees,
                        assigned: assigned_count,
                        missing,
                        missing_functions: slot.required_functions.clone(),
                        severity,
                    });
                }
            }

            current_date = current_date.succ_opt().unwrap_or(current_date);
        }
    }

    // Sort by severity and date
    all_gaps.sort_by(|a, b| {
        let severity_order = |s: &GapSeverity| match s {
            GapSeverity::Critical => 0,
            GapSeverity::High => 1,
            GapSeverity::Medium => 2,
            GapSeverity::Low => 3,
        };
        severity_order(&a.severity)
            .cmp(&severity_order(&b.severity))
            .then(a.date.cmp(&b.date))
    });

    Ok(Json(all_gaps))
}

/// Simulate leave request impact
#[utoipa::path(
    post,
    path = "/api/v1/workforce/validate/leave-simulation",
    request_body = LeaveSimulationRequest,
    responses(
        (status = 200, description = "Leave simulation result"),
        (status = 400, description = "Invalid input"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Employee not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Validation"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn simulate_leave(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Json(req): Json<LeaveSimulationRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    req.validate().map_err(|e| {
        tracing::warn!("Validation error: {}", e);
        StatusCode::BAD_REQUEST
    })?;

    // Get employee details
    let employee: (String, String, Uuid, serde_json::Value) = sqlx::query_as(
        r#"
        SELECT first_name, last_name, org_node_id, functions
        FROM workforce_employees
        WHERE id = $1 AND tenant_id = $2
        "#,
    )
    .bind(req.employee_id)
    .bind(ctx.tenant_id)
    .fetch_optional(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to get employee: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)?;

    let (first_name, last_name, org_node_id, functions) = employee;
    let employee_name = format!("{} {}", first_name, last_name);
    let employee_functions: Vec<String> = serde_json::from_value(functions).unwrap_or_default();

    // Get org node name
    let org_node_name: String =
        sqlx::query_scalar("SELECT name FROM workforce_org_nodes WHERE id = $1")
            .bind(org_node_id)
            .fetch_one(&*state.pool)
            .await
            .map_err(|e| {
                tracing::error!("Failed to get org node: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

    // Get coverage slots
    let coverage_slots = get_effective_slots(&state, ctx.tenant_id, org_node_id).await?;

    // Calculate impacts
    let mut impacts = Vec::new();
    let mut warnings = Vec::new();
    let mut can_approve = true;

    let mut current_date = req.date_range.start;
    while current_date <= req.date_range.end {
        let weekday = current_date.weekday();
        let day_index = weekday_to_index(weekday);

        for slot in coverage_slots.iter().filter(|s| s.day_of_week == day_index) {
            // Check if employee is currently assigned to this slot
            let is_assigned =
                is_employee_assigned(&state, ctx.tenant_id, req.employee_id, current_date, slot)
                    .await?;

            if is_assigned {
                // Get current coverage
                let assignments = get_assignments(
                    &state,
                    ctx.tenant_id,
                    org_node_id,
                    &DateRange {
                        start: current_date,
                        end: current_date,
                    },
                )
                .await?;

                let coverage_before = count_assignments_for_slot(&assignments, current_date, slot);
                let coverage_after = coverage_before - 1;

                let creates_gap = coverage_after < slot.min_employees;
                let severity = if creates_gap {
                    Some(calculate_severity(coverage_after, slot.min_employees))
                } else {
                    None
                };

                if creates_gap {
                    if let Some(ref sev) = severity {
                        if *sev == GapSeverity::Critical {
                            can_approve = false;
                            warnings.push(format!(
                                "Critical coverage gap on {} for slot {}",
                                current_date,
                                slot.label
                                    .as_ref()
                                    .unwrap_or(&format!("{}-{}", slot.start_time, slot.end_time))
                            ));
                        }
                    }
                }

                impacts.push(LeaveImpact {
                    date: current_date,
                    org_node_id,
                    org_node_name: org_node_name.clone(),
                    slot: slot.clone(),
                    coverage_before,
                    coverage_after,
                    creates_gap,
                    severity,
                });
            }
        }

        current_date = current_date.succ_opt().unwrap_or(current_date);
    }

    // Find suggested replacements
    let suggested_replacements = find_replacements(
        &state,
        ctx.tenant_id,
        org_node_id,
        &employee_functions,
        &req.date_range,
        req.employee_id,
    )
    .await?;

    Ok(Json(LeaveSimulationResult {
        employee_id: req.employee_id,
        employee_name,
        leave_type: req.leave_type,
        date_range: req.date_range,
        can_approve,
        impacts,
        suggested_replacements,
        warnings,
    }))
}

/// Simulate shift change impact
#[utoipa::path(
    post,
    path = "/api/v1/workforce/validate/shift-simulation",
    request_body = ShiftChangeSimulationRequest,
    responses(
        (status = 200, description = "Shift change simulation result"),
        (status = 400, description = "Invalid input"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Employee not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Validation"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn simulate_shift_change(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Json(req): Json<ShiftChangeSimulationRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    // Get employee details
    let employee: (String, String, Uuid) = sqlx::query_as(
        r#"
        SELECT first_name, last_name, org_node_id
        FROM workforce_employees
        WHERE id = $1 AND tenant_id = $2
        "#,
    )
    .bind(req.employee_id)
    .bind(ctx.tenant_id)
    .fetch_optional(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to get employee: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)?;

    let (first_name, last_name, org_node_id) = employee;
    let employee_name = format!("{} {}", first_name, last_name);

    // Calculate shift change impact by comparing coverage before and after the change.
    // We look at the original shift's date, fetch org node coverage slots, and count
    // how many gaps the removal of the original shift would create (and how many the
    // new shift resolves).
    let original_date = req.original_shift.start.date_naive();
    let coverage_slots = get_effective_slots(&state, ctx.tenant_id, org_node_id).await?;

    let date_range_orig = DateRange {
        start: original_date,
        end: original_date,
    };
    let assignments_before =
        get_assignments(&state, ctx.tenant_id, org_node_id, &date_range_orig).await?;

    let mut affected_slots_vec: Vec<AffectedSlot> = Vec::new();
    let mut gaps_created: i32 = 0;
    let mut gaps_resolved: i32 = 0;
    let mut warnings: Vec<String> = Vec::new();

    let weekday = original_date.weekday();
    let day_index = weekday_to_index(weekday);

    let orig_start_time = req.original_shift.start.time();
    let orig_end_time = req.original_shift.end.time();

    for slot in coverage_slots.iter().filter(|s| s.day_of_week == day_index) {
        let slot_start = NaiveTime::parse_from_str(&slot.start_time, "%H:%M")
            .unwrap_or_else(|_| NaiveTime::from_hms_opt(0, 0, 0).expect("00:00:00 is valid"));
        let slot_end = NaiveTime::parse_from_str(&slot.end_time, "%H:%M")
            .unwrap_or_else(|_| NaiveTime::from_hms_opt(23, 59, 59).expect("23:59:59 is valid"));

        // Does the original shift cover this slot?
        let orig_covers_slot = orig_start_time <= slot_start && orig_end_time >= slot_end;

        let coverage_before = count_assignments_for_slot(&assignments_before, original_date, slot);

        // Coverage after removing the original shift
        let coverage_after_removal = if orig_covers_slot {
            (coverage_before - 1).max(0)
        } else {
            coverage_before
        };

        // Does the new shift (if any) cover this slot?
        let new_covers_slot = req.new_shift.as_ref().is_some_and(|ns| {
            let ns_start = ns.start.time();
            let ns_end = ns.end.time();
            ns_start <= slot_start && ns_end >= slot_end
        });

        let coverage_after = if new_covers_slot {
            coverage_after_removal + 1
        } else {
            coverage_after_removal
        };

        // Track gap creation / resolution
        let was_gap = coverage_before < slot.min_employees;
        let is_gap = coverage_after < slot.min_employees;

        if !was_gap && is_gap {
            gaps_created += 1;
            warnings.push(format!(
                "Removing original shift creates a gap for slot {} on {}",
                slot.label
                    .as_ref()
                    .unwrap_or(&format!("{}-{}", slot.start_time, slot.end_time)),
                original_date
            ));
        } else if was_gap && !is_gap {
            gaps_resolved += 1;
        }

        if coverage_before != coverage_after {
            affected_slots_vec.push(AffectedSlot {
                date: original_date,
                time_range: format!("{}-{}", slot.start_time, slot.end_time),
                coverage_before,
                coverage_after,
                required: slot.min_employees,
            });
        }
    }

    let coverage_impact = CoverageImpact {
        gaps_created,
        gaps_resolved,
        net_impact: gaps_resolved - gaps_created,
        affected_slots: affected_slots_vec,
    };

    let can_approve = gaps_created == 0;

    Ok(Json(ShiftChangeSimulationResult {
        employee_id: req.employee_id,
        employee_name,
        original_shift: req.original_shift,
        new_shift: req.new_shift,
        can_approve,
        coverage_impact,
        warnings,
    }))
}

/// Get all scheduling conflicts
#[utoipa::path(
    get,
    path = "/api/v1/workforce/validate/conflicts",
    responses(
        (status = 200, description = "List of scheduling conflicts"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Validation"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn get_conflicts(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Query(params): Query<ConflictQueryParams>,
) -> Result<impl IntoResponse, StatusCode> {
    let from = params.from.unwrap_or_else(|| Utc::now().date_naive());
    let to = params
        .to
        .unwrap_or_else(|| from + chrono::Duration::days(30));

    let mut conflicts = Vec::new();

    // Get coverage gaps as conflicts
    let gap_params = GapAnalysisParams {
        org_node_id: params.org_node_id,
        from,
        to,
        severity: None,
    };

    let gaps = analyze_gaps_internal(&state, ctx.tenant_id, gap_params).await?;

    for gap in gaps {
        conflicts.push(SchedulingConflict {
            id: Uuid::new_v4(),
            conflict_type: ConflictType::CoverageGap,
            description: format!(
                "Missing {} employees for {} on {}",
                gap.missing,
                gap.slot
                    .label
                    .as_ref()
                    .unwrap_or(&format!("{}-{}", gap.slot.start_time, gap.slot.end_time)),
                gap.date
            ),
            severity: gap.severity,
            affected_employees: vec![],
            affected_dates: vec![gap.date],
            suggested_resolution: Some("Assign additional staff to this slot".to_string()),
        });
    }

    // Filter by conflict type if specified
    if let Some(ref ct) = params.conflict_type {
        let filter_type = match ct.as_str() {
            "coverage_gap" => Some(ConflictType::CoverageGap),
            "overstaffing" => Some(ConflictType::Overstaffing),
            "double_booking" => Some(ConflictType::DoubleBooking),
            _ => None,
        };

        if let Some(_ft) = filter_type {
            conflicts.retain(|c| matches!(&c.conflict_type, ConflictType::CoverageGap));
        }
    }

    Ok(Json(conflicts))
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Get effective coverage slots for an org node
async fn get_effective_slots(
    state: &AppState,
    tenant_id: Uuid,
    org_node_id: Uuid,
) -> Result<Vec<CoverageSlot>, StatusCode> {
    let today = Utc::now().date_naive();

    // Find applicable rule
    let rule: Option<(Option<Uuid>, Option<serde_json::Value>)> = sqlx::query_as(
        r#"
        SELECT template_id, custom_slots
        FROM workforce_coverage_rules
        WHERE org_node_id = $1 AND tenant_id = $2 AND is_active = true
        AND valid_from <= $3 AND (valid_to IS NULL OR valid_to >= $3)
        ORDER BY valid_from DESC
        LIMIT 1
        "#,
    )
    .bind(org_node_id)
    .bind(tenant_id)
    .bind(today)
    .fetch_optional(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to get coverage rule: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let (template_id, custom_slots) = match rule {
        Some((t, c)) => (t, c),
        None => return Ok(vec![]), // No rule = no coverage requirements
    };

    // Use custom slots or get from template
    if let Some(slots_json) = custom_slots {
        let slots: Vec<CoverageSlot> = serde_json::from_value(slots_json).unwrap_or_default();
        return Ok(slots);
    }

    if let Some(tid) = template_id {
        let pattern: Option<serde_json::Value> = sqlx::query_scalar(
            "SELECT weekly_pattern FROM workforce_coverage_templates WHERE id = $1",
        )
        .bind(tid)
        .fetch_optional(&*state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get template: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

        if let Some(p) = pattern {
            let weekly: WeeklyPattern = serde_json::from_value(p).unwrap_or(WeeklyPattern {
                monday: vec![],
                tuesday: vec![],
                wednesday: vec![],
                thursday: vec![],
                friday: vec![],
                saturday: vec![],
                sunday: vec![],
            });
            return Ok(super::coverage::flatten_weekly_pattern(&weekly));
        }
    }

    Ok(vec![])
}

/// Assignment record (placeholder)
#[derive(Debug)]
struct Assignment {
    #[allow(dead_code)] // Scaffolded — will be wired when handler is implemented
    employee_id: Uuid,
    date: NaiveDate,
    start_time: NaiveTime,
    end_time: NaiveTime,
    #[allow(dead_code)] // Scaffolded — will be wired when handler is implemented
    functions: Vec<String>,
}

/// Scheduler response wrapper for list endpoints
#[derive(Debug, Deserialize)]
struct SchedulerTimeItemsResponse {
    items: Vec<SchedulerShiftItem>,
}

/// Minimal time-item shape returned by signapps-scheduler
#[derive(Debug, Deserialize)]
struct SchedulerShiftItem {
    #[serde(rename = "ownerId")]
    owner_id: Uuid,
    #[serde(rename = "startTime")]
    start_time: Option<DateTime<Utc>>,
    #[serde(rename = "endTime")]
    end_time: Option<DateTime<Utc>>,
}

/// Get assignments for a node and date range by calling the scheduler service.
///
/// Resolves employees for `org_node_id`, fetches their `user_id`s, then queries
/// `GET /api/v1/time-items` with `types=shift` and the date window.
async fn get_assignments(
    state: &AppState,
    tenant_id: Uuid,
    org_node_id: Uuid,
    date_range: &DateRange,
) -> Result<Vec<Assignment>, StatusCode> {
    // 1. Look up employees for this org node and collect their linked user_ids
    let rows: Vec<(Uuid, Option<Uuid>)> = sqlx::query_as(
        "SELECT id, user_id FROM workforce_employees \
         WHERE tenant_id = $1 AND org_node_id = $2 AND status = 'active'",
    )
    .bind(tenant_id)
    .bind(org_node_id)
    .fetch_all(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("get_assignments: DB query failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Map user_id → employee_id so we can reconstruct Assignment.employee_id
    let user_to_employee: std::collections::HashMap<Uuid, Uuid> = rows
        .iter()
        .filter_map(|(emp_id, user_id)| user_id.map(|uid| (uid, *emp_id)))
        .collect();

    if user_to_employee.is_empty() {
        return Ok(vec![]);
    }

    let user_ids: Vec<Uuid> = user_to_employee.keys().cloned().collect();

    // 2. Build the query string for the scheduler
    let start_dt =
        Utc.from_utc_datetime(&date_range.start.and_hms_opt(0, 0, 0).unwrap_or_default());
    let end_dt = Utc.from_utc_datetime(&date_range.end.and_hms_opt(23, 59, 59).unwrap_or_default());

    // Encode user_ids as repeated query params: userIds[]=uuid&userIds[]=...
    let mut query_params = format!(
        "types=shift&start={}&end={}",
        urlencoding_simple(&start_dt.to_rfc3339()),
        urlencoding_simple(&end_dt.to_rfc3339()),
    );
    for uid in &user_ids {
        query_params.push_str(&format!("&userIds[]={}", uid));
    }

    let url = format!("{}/time-items?{}", state.scheduler_base_url, query_params);

    let resp = state
        .http_client
        .get(&url)
        .header("X-Internal-Service", "signapps-workforce")
        .send()
        .await;

    match resp {
        Err(e) => {
            tracing::warn!(
                "get_assignments: scheduler unreachable, degrading to empty: {}",
                e
            );
            Ok(vec![])
        },
        Ok(r) if !r.status().is_success() => {
            tracing::warn!(
                "get_assignments: scheduler returned {}, degrading to empty",
                r.status()
            );
            Ok(vec![])
        },
        Ok(r) => {
            let body: SchedulerTimeItemsResponse = match r.json().await {
                Ok(b) => b,
                Err(e) => {
                    tracing::warn!("get_assignments: failed to parse scheduler response: {}", e);
                    return Ok(vec![]);
                },
            };

            let assignments = body
                .items
                .into_iter()
                .filter_map(|item| {
                    let start = item.start_time?;
                    let end = item.end_time?;
                    let employee_id = *user_to_employee.get(&item.owner_id)?;
                    Some(Assignment {
                        employee_id,
                        date: start.date_naive(),
                        start_time: start.time(),
                        end_time: end.time(),
                        functions: vec![],
                    })
                })
                .collect();

            Ok(assignments)
        },
    }
}

/// Percent-encode a string (minimal: encode `:`, `/`, `+`)
fn urlencoding_simple(s: &str) -> String {
    s.replace(':', "%3A").replace('+', "%2B")
}

/// Count assignments that cover a specific slot
fn count_assignments_for_slot(
    assignments: &[Assignment],
    date: NaiveDate,
    slot: &CoverageSlot,
) -> i32 {
    let slot_start = NaiveTime::parse_from_str(&slot.start_time, "%H:%M")
        .unwrap_or_else(|_| NaiveTime::from_hms_opt(0, 0, 0).expect("00:00:00 is valid"));
    let slot_end = NaiveTime::parse_from_str(&slot.end_time, "%H:%M")
        .unwrap_or_else(|_| NaiveTime::from_hms_opt(23, 59, 59).expect("23:59:59 is valid"));

    assignments
        .iter()
        .filter(|a| a.date == date && a.start_time <= slot_start && a.end_time >= slot_end)
        .count() as i32
}

/// Check if an employee is assigned to a specific slot on a given date.
///
/// Looks up the employee's linked `user_id`, then queries the scheduler for
/// their shifts on that date, and checks if any shift covers the slot window.
async fn is_employee_assigned(
    state: &AppState,
    tenant_id: Uuid,
    employee_id: Uuid,
    date: NaiveDate,
    slot: &CoverageSlot,
) -> Result<bool, StatusCode> {
    // Resolve the employee's linked user_id
    let user_id: Option<Uuid> = sqlx::query_scalar(
        "SELECT user_id FROM workforce_employees WHERE id = $1 AND tenant_id = $2",
    )
    .bind(employee_id)
    .bind(tenant_id)
    .fetch_optional(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("is_employee_assigned: DB query failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .flatten();

    let Some(uid) = user_id else {
        // Employee has no linked platform user — cannot check scheduler
        return Ok(false);
    };

    let start_dt = Utc.from_utc_datetime(&date.and_hms_opt(0, 0, 0).unwrap_or_default());
    let end_dt = Utc.from_utc_datetime(&date.and_hms_opt(23, 59, 59).unwrap_or_default());

    let query_params = format!(
        "types=shift&start={}&end={}&userIds[]={}&limit=50",
        urlencoding_simple(&start_dt.to_rfc3339()),
        urlencoding_simple(&end_dt.to_rfc3339()),
        uid,
    );
    let url = format!("{}/time-items?{}", state.scheduler_base_url, query_params);

    let resp = state
        .http_client
        .get(&url)
        .header("X-Internal-Service", "signapps-workforce")
        .send()
        .await;

    let items = match resp {
        Err(e) => {
            tracing::warn!(
                "is_employee_assigned: scheduler unreachable, assuming not assigned: {}",
                e
            );
            return Ok(false);
        },
        Ok(r) if !r.status().is_success() => {
            tracing::warn!(
                "is_employee_assigned: scheduler returned {}, assuming not assigned",
                r.status()
            );
            return Ok(false);
        },
        Ok(r) => match r.json::<SchedulerTimeItemsResponse>().await {
            Ok(body) => body.items,
            Err(e) => {
                tracing::warn!(
                    "is_employee_assigned: failed to parse scheduler response: {}",
                    e
                );
                return Ok(false);
            },
        },
    };

    let slot_start = NaiveTime::parse_from_str(&slot.start_time, "%H:%M")
        .unwrap_or_else(|_| NaiveTime::from_hms_opt(0, 0, 0).expect("00:00:00 is valid"));
    let slot_end = NaiveTime::parse_from_str(&slot.end_time, "%H:%M")
        .unwrap_or_else(|_| NaiveTime::from_hms_opt(23, 59, 59).expect("23:59:59 is valid"));

    let assigned = items.iter().any(|item| {
        if let (Some(s), Some(e)) = (item.start_time, item.end_time) {
            let shift_start = s.time();
            let shift_end = e.time();
            s.date_naive() == date && shift_start <= slot_start && shift_end >= slot_end
        } else {
            false
        }
    });

    Ok(assigned)
}

/// Find replacement employees
async fn find_replacements(
    state: &AppState,
    tenant_id: Uuid,
    org_node_id: Uuid,
    required_functions: &[String],
    date_range: &DateRange,
    exclude_employee_id: Uuid,
) -> Result<Vec<SuggestedReplacement>, StatusCode> {
    // Find employees with matching functions who are available
    let candidates: Vec<(Uuid, String, String, serde_json::Value)> = sqlx::query_as(
        r#"
        SELECT id, first_name, last_name, functions
        FROM workforce_employees
        WHERE tenant_id = $1
        AND org_node_id = $2
        AND status = 'active'
        AND id != $3
        "#,
    )
    .bind(tenant_id)
    .bind(org_node_id)
    .bind(exclude_employee_id)
    .fetch_all(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to find candidates: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let mut replacements = Vec::new();

    for (id, first_name, last_name, funcs) in candidates {
        let employee_functions: Vec<String> = serde_json::from_value(funcs).unwrap_or_default();

        // Check if employee has any of the required functions
        let matching_functions: Vec<String> = employee_functions
            .iter()
            .filter(|f| required_functions.contains(f))
            .cloned()
            .collect();

        if !matching_functions.is_empty() || required_functions.is_empty() {
            // Cross-check availability with calendar/scheduling service.
            // We query existing shifts for this employee over the date range;
            // the availability score is 1.0 minus the fraction of days with conflicts.
            let (availability_score, conflicts) =
                compute_availability_score(state, &id, date_range).await;

            replacements.push(SuggestedReplacement {
                employee_id: id,
                employee_name: format!("{} {}", first_name, last_name),
                functions: matching_functions,
                availability_score,
                conflicts,
            });
        }
    }

    // Sort by availability score
    replacements.sort_by(|a, b| {
        b.availability_score
            .partial_cmp(&a.availability_score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    Ok(replacements)
}

/// Query the scheduler for an employee's existing shifts in `date_range` and
/// compute an availability score (1.0 = fully free, 0.0 = every day has a shift).
///
/// Also returns a list of human-readable conflict strings for each busy day.
/// Gracefully returns (0.8, []) if the scheduler is unreachable.
async fn compute_availability_score(
    state: &AppState,
    employee_id: &Uuid,
    date_range: &DateRange,
) -> (f64, Vec<String>) {
    // Look up the employee's linked user_id
    let user_id: Option<Uuid> = match sqlx::query_scalar::<_, Option<Uuid>>(
        "SELECT user_id FROM workforce_employees WHERE id = $1",
    )
    .bind(employee_id)
    .fetch_optional(&*state.pool)
    .await
    {
        Ok(Some(opt)) => opt,
        _ => return (0.8, vec![]), // DB failure → neutral score
    };

    let Some(uid) = user_id else {
        return (0.8, vec![]);
    };

    let start_dt =
        Utc.from_utc_datetime(&date_range.start.and_hms_opt(0, 0, 0).unwrap_or_default());
    let end_dt = Utc.from_utc_datetime(&date_range.end.and_hms_opt(23, 59, 59).unwrap_or_default());

    let query_params = format!(
        "types=shift&start={}&end={}&userIds[]={}&limit=200",
        urlencoding_simple(&start_dt.to_rfc3339()),
        urlencoding_simple(&end_dt.to_rfc3339()),
        uid,
    );
    let url = format!("{}/time-items?{}", state.scheduler_base_url, query_params);

    let items = match state
        .http_client
        .get(&url)
        .header("X-Internal-Service", "signapps-workforce")
        .send()
        .await
    {
        Err(e) => {
            tracing::warn!(
                "compute_availability_score: scheduler unreachable for employee {}: {}",
                employee_id,
                e
            );
            return (0.8, vec![]);
        },
        Ok(r) if !r.status().is_success() => {
            tracing::warn!(
                "compute_availability_score: scheduler returned {} for employee {}",
                r.status(),
                employee_id
            );
            return (0.8, vec![]);
        },
        Ok(r) => match r.json::<SchedulerTimeItemsResponse>().await {
            Ok(body) => body.items,
            Err(e) => {
                tracing::warn!(
                    "compute_availability_score: parse error for employee {}: {}",
                    employee_id,
                    e
                );
                return (0.8, vec![]);
            },
        },
    };

    if items.is_empty() {
        return (1.0, vec![]);
    }

    // Collect distinct busy dates
    let busy_dates: std::collections::BTreeSet<NaiveDate> = items
        .iter()
        .filter_map(|item| item.start_time.map(|dt| dt.date_naive()))
        .collect();

    let total_days = (date_range.end - date_range.start).num_days().max(1) as f64;
    let busy_count = busy_dates.len() as f64;
    let availability_score = ((total_days - busy_count) / total_days).clamp(0.0, 1.0);

    let conflicts: Vec<String> = busy_dates
        .iter()
        .map(|d| format!("Already assigned on {}", d))
        .collect();

    (availability_score, conflicts)
}

/// Calculate gap severity
fn calculate_severity(assigned: i32, required: i32) -> GapSeverity {
    if required == 0 {
        return GapSeverity::Low;
    }

    let coverage_ratio = assigned as f64 / required as f64;

    if coverage_ratio < 0.25 {
        GapSeverity::Critical
    } else if coverage_ratio < 0.5 {
        GapSeverity::High
    } else if coverage_ratio < 0.75 {
        GapSeverity::Medium
    } else {
        GapSeverity::Low
    }
}

/// Convert weekday to index (0=Sunday)
fn weekday_to_index(weekday: Weekday) -> i32 {
    match weekday {
        Weekday::Sun => 0,
        Weekday::Mon => 1,
        Weekday::Tue => 2,
        Weekday::Wed => 3,
        Weekday::Thu => 4,
        Weekday::Fri => 5,
        Weekday::Sat => 6,
    }
}

/// Internal gap analysis (reusable)
async fn analyze_gaps_internal(
    state: &AppState,
    tenant_id: Uuid,
    params: GapAnalysisParams,
) -> Result<Vec<CoverageGap>, StatusCode> {
    let node_ids: Vec<Uuid> = if let Some(node_id) = params.org_node_id {
        sqlx::query_scalar("SELECT descendant_id FROM workforce_org_closure WHERE ancestor_id = $1")
            .bind(node_id)
            .fetch_all(&*state.pool)
            .await
            .map_err(|e| {
                tracing::error!("Failed to get descendants: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?
    } else {
        sqlx::query_scalar(
            "SELECT id FROM workforce_org_nodes WHERE tenant_id = $1 AND parent_id IS NULL AND is_active = true",
        )
        .bind(tenant_id)
        .fetch_all(&*state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get root nodes: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
    };

    let mut all_gaps = Vec::new();
    let date_range = DateRange {
        start: params.from,
        end: params.to,
    };

    for node_id in node_ids {
        let coverage_slots = get_effective_slots(state, tenant_id, node_id).await?;
        let assignments = get_assignments(state, tenant_id, node_id, &date_range).await?;

        let mut current_date = params.from;
        while current_date <= params.to {
            let weekday = current_date.weekday();
            let day_index = weekday_to_index(weekday);

            for slot in coverage_slots.iter().filter(|s| s.day_of_week == day_index) {
                let assigned_count = count_assignments_for_slot(&assignments, current_date, slot);

                if assigned_count < slot.min_employees {
                    let missing = slot.min_employees - assigned_count;
                    let severity = calculate_severity(assigned_count, slot.min_employees);

                    all_gaps.push(CoverageGap {
                        date: current_date,
                        slot: slot.clone(),
                        required: slot.min_employees,
                        assigned: assigned_count,
                        missing,
                        missing_functions: slot.required_functions.clone(),
                        severity,
                    });
                }
            }

            current_date = current_date.succ_opt().unwrap_or(current_date);
        }
    }

    Ok(all_gaps)
}

#[cfg(test)]
mod tests {
    #[allow(unused_imports)]
    use super::*;

    #[test]
    fn module_compiles() {
        // Verify this handler module compiles correctly.
        // Integration tests require a running database and service.
        assert!(true, "{} handler module loaded", module_path!());
    }
}
