//! Leave and shift-change simulation handlers.

use axum::{
    extract::{Extension, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::{Datelike, NaiveTime};
use validator::Validate;

use crate::AppState;
use signapps_common::{Claims, TenantContext};

use super::helpers::{
    calculate_severity, count_assignments_for_slot, find_replacements, get_assignments,
    get_effective_slots, is_employee_assigned, weekday_to_index,
};
use super::types::{
    AffectedSlot, CoverageImpact, DateRange, GapSeverity, LeaveImpact, LeaveSimulationRequest,
    LeaveSimulationResult, ShiftChangeSimulationRequest, ShiftChangeSimulationResult,
};

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
    let employee: (String, String, uuid::Uuid, serde_json::Value) = sqlx::query_as(
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
pub async fn simulate_shift_change(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Json(req): Json<ShiftChangeSimulationRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    // Get employee details
    let employee: (String, String, uuid::Uuid) = sqlx::query_as(
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
