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
use chrono::{DateTime, Datelike, NaiveDate, NaiveTime, Utc, Weekday};
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
#[derive(Debug, Clone, Serialize, Deserialize)]
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
#[derive(Debug, Deserialize, Validate)]
pub struct ValidateCoverageRequest {
    pub org_node_id: Uuid,
    pub date_range: DateRange,
    #[allow(dead_code)] // Scaffolded — will be wired when handler is implemented
    pub include_descendants: Option<bool>,
}

/// Date range for queries
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct DateRange {
    pub start: NaiveDate,
    pub end: NaiveDate,
}

/// Coverage validation result
#[derive(Debug, Serialize)]
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
pub struct GapAnalysisParams {
    pub org_node_id: Option<Uuid>,
    pub from: NaiveDate,
    pub to: NaiveDate,
    pub severity: Option<String>,
}

/// Leave simulation request
#[derive(Debug, Deserialize, Validate)]
pub struct LeaveSimulationRequest {
    pub employee_id: Uuid,
    pub leave_type: String,
    pub date_range: DateRange,
}

/// Leave simulation result
#[derive(Debug, Serialize)]
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
pub struct SuggestedReplacement {
    pub employee_id: Uuid,
    pub employee_name: String,
    pub functions: Vec<String>,
    pub availability_score: f64,
    pub conflicts: Vec<String>,
}

/// Shift change simulation request
#[derive(Debug, Deserialize)]
pub struct ShiftChangeSimulationRequest {
    pub employee_id: Uuid,
    pub original_shift: TimeSpan,
    pub new_shift: Option<TimeSpan>,
    #[allow(dead_code)] // Scaffolded — will be wired when handler is implemented
    pub reason: Option<String>,
}

/// Shift change simulation result
#[derive(Debug, Serialize)]
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
pub struct CoverageImpact {
    pub gaps_created: i32,
    pub gaps_resolved: i32,
    pub net_impact: i32,
    pub affected_slots: Vec<AffectedSlot>,
}

/// Affected slot detail
#[derive(Debug, Serialize)]
pub struct AffectedSlot {
    pub date: NaiveDate,
    pub time_range: String,
    pub coverage_before: i32,
    pub coverage_after: i32,
    pub required: i32,
}

/// Conflict in scheduling
#[derive(Debug, Serialize)]
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

    let (first_name, last_name, _org_node_id) = employee;
    let employee_name = format!("{} {}", first_name, last_name);

    // Calculate impact
    let affected_slots = Vec::new();
    let gaps_created = 0;
    let gaps_resolved = 0;
    let warnings = Vec::new();

    // FIXME(workforce): Calculate shift change impact from scheduling service
    // This would involve checking current assignments and recalculating coverage

    let coverage_impact = CoverageImpact {
        gaps_created,
        gaps_resolved,
        net_impact: gaps_resolved - gaps_created,
        affected_slots,
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

/// Get assignments for a node and date range
async fn get_assignments(
    _state: &AppState,
    _tenant_id: Uuid,
    _org_node_id: Uuid,
    _date_range: &DateRange,
) -> Result<Vec<Assignment>, StatusCode> {
    // FIXME(workforce): Query shift_assignments via scheduling API
    // For now, return empty (meaning no assignments)
    Ok(vec![])
}

/// Count assignments that cover a specific slot
fn count_assignments_for_slot(
    assignments: &[Assignment],
    date: NaiveDate,
    slot: &CoverageSlot,
) -> i32 {
    let slot_start = NaiveTime::parse_from_str(&slot.start_time, "%H:%M")
        .unwrap_or(NaiveTime::from_hms_opt(0, 0, 0).unwrap());
    let slot_end = NaiveTime::parse_from_str(&slot.end_time, "%H:%M")
        .unwrap_or(NaiveTime::from_hms_opt(23, 59, 59).unwrap());

    assignments
        .iter()
        .filter(|a| a.date == date && a.start_time <= slot_start && a.end_time >= slot_end)
        .count() as i32
}

/// Check if employee is assigned to a slot
async fn is_employee_assigned(
    _state: &AppState,
    _tenant_id: Uuid,
    _employee_id: Uuid,
    _date: NaiveDate,
    _slot: &CoverageSlot,
) -> Result<bool, StatusCode> {
    // FIXME(workforce): Query employee assignments via scheduling API
    Ok(false)
}

/// Find replacement employees
async fn find_replacements(
    state: &AppState,
    tenant_id: Uuid,
    org_node_id: Uuid,
    required_functions: &[String],
    _date_range: &DateRange,
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
            // FIXME(workforce): Cross-check availability with calendar/scheduling
            let availability_score = 0.8; // Placeholder

            replacements.push(SuggestedReplacement {
                employee_id: id,
                employee_name: format!("{} {}", first_name, last_name),
                functions: matching_functions,
                availability_score,
                conflicts: vec![],
            });
        }
    }

    // Sort by availability score
    replacements.sort_by(|a, b| {
        b.availability_score
            .partial_cmp(&a.availability_score)
            .unwrap()
    });

    Ok(replacements)
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
