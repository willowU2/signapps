//! Conflict and scheduling rules handler.

use axum::{
    extract::{Extension, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::Utc;
use uuid::Uuid;

use crate::AppState;
use signapps_common::{Claims, TenantContext};

use super::helpers::analyze_gaps_internal;
use super::types::{ConflictQueryParams, ConflictType, GapAnalysisParams, SchedulingConflict};

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
