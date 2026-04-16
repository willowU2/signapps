//! Gap analysis handlers.

use axum::{
    extract::{Extension, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::Datelike;
use uuid::Uuid;

use crate::AppState;
use signapps_common::{Claims, TenantContext};

use super::helpers::{
    calculate_severity, count_assignments_for_slot, get_assignments, get_effective_slots,
    weekday_to_index,
};
use super::types::{
    CoverageGap, CoverageValidationResult, DateRange, GapAnalysisParams, GapSeverity,
    OverstaffedSlot, ValidateCoverageRequest, ValidationSummary,
};

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
pub async fn validate_coverage(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Json(req): Json<ValidateCoverageRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    use validator::Validate;
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
