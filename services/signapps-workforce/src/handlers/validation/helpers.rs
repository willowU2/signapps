//! Internal helper functions for the validation module.

use axum::http::StatusCode;
use chrono::{Datelike, NaiveDate, NaiveTime, TimeZone, Utc, Weekday};
use uuid::Uuid;

use crate::handlers::coverage::{CoverageSlot, WeeklyPattern};
use crate::AppState;

use super::types::{
    Assignment, DateRange, GapSeverity, SchedulerTimeItemsResponse, SuggestedReplacement,
};

/// Get effective coverage slots for an org node
pub async fn get_effective_slots(
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
            return Ok(super::super::coverage::flatten_weekly_pattern(&weekly));
        }
    }

    Ok(vec![])
}

/// Get assignments for a node and date range by calling the scheduler service.
///
/// Resolves employees for `org_node_id`, fetches their `user_id`s, then queries
/// `GET /api/v1/time-items` with `types=shift` and the date window.
pub async fn get_assignments(
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
pub fn urlencoding_simple(s: &str) -> String {
    s.replace(':', "%3A").replace('+', "%2B")
}

/// Count assignments that cover a specific slot
pub fn count_assignments_for_slot(
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
pub async fn is_employee_assigned(
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
pub async fn find_replacements(
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
pub async fn compute_availability_score(
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
pub fn calculate_severity(assigned: i32, required: i32) -> GapSeverity {
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
pub fn weekday_to_index(weekday: Weekday) -> i32 {
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
pub async fn analyze_gaps_internal(
    state: &AppState,
    tenant_id: Uuid,
    params: super::types::GapAnalysisParams,
) -> Result<Vec<super::types::CoverageGap>, StatusCode> {
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

                    all_gaps.push(super::types::CoverageGap {
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
