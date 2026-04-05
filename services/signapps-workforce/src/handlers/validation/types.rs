//! Shared types for the validation handler module.

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use crate::handlers::coverage::CoverageSlot;

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

/// Assignment record (internal)
#[derive(Debug)]
pub struct Assignment {
    #[allow(dead_code)] // Scaffolded — will be wired when handler is implemented
    pub employee_id: Uuid,
    pub date: NaiveDate,
    pub start_time: chrono::NaiveTime,
    pub end_time: chrono::NaiveTime,
    #[allow(dead_code)] // Scaffolded — will be wired when handler is implemented
    pub functions: Vec<String>,
}

/// Scheduler response wrapper for list endpoints
#[derive(Debug, Deserialize)]
pub struct SchedulerTimeItemsResponse {
    pub items: Vec<SchedulerShiftItem>,
}

/// Minimal time-item shape returned by signapps-scheduler
#[derive(Debug, Deserialize)]
pub struct SchedulerShiftItem {
    #[serde(rename = "ownerId")]
    pub owner_id: Uuid,
    #[serde(rename = "startTime")]
    pub start_time: Option<DateTime<Utc>>,
    #[serde(rename = "endTime")]
    pub end_time: Option<DateTime<Utc>>,
}
