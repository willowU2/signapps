//! Validation Engine
//!
//! Core validation logic for coverage requirements and scheduling rules.
//! Used by the validation handlers to perform complex validation operations.

use chrono::{DateTime, Datelike, NaiveTime, Utc, Weekday};
use sqlx::PgPool;

use crate::handlers::validation::{CoverageGap, GapSeverity, TimeSpan, ValidationSummary};

/// Validation engine for workforce scheduling
#[derive(Clone)]
#[allow(dead_code)] // Scaffolded — will be wired when handler is implemented
pub struct ValidationEngine {
    pool: PgPool,
}

#[allow(dead_code)] // Scaffolded — will be wired when handler is implemented
impl ValidationEngine {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Validate that a time span doesn't violate rest time rules
    pub fn validate_rest_time(
        &self,
        previous_shift_end: DateTime<Utc>,
        next_shift_start: DateTime<Utc>,
        min_rest_hours: i64,
    ) -> bool {
        let rest_duration = next_shift_start - previous_shift_end;
        rest_duration.num_hours() >= min_rest_hours
    }

    /// Validate maximum weekly hours
    pub fn validate_weekly_hours(&self, shifts: &[TimeSpan], max_hours: i64) -> (bool, i64) {
        let total_minutes: i64 = shifts.iter().map(|s| s.duration_minutes()).sum();
        let total_hours = total_minutes / 60;
        (total_hours <= max_hours, total_hours)
    }

    /// Check for overlapping shifts
    pub fn find_overlapping_shifts(&self, shifts: &[TimeSpan]) -> Vec<(usize, usize)> {
        let mut overlaps = Vec::new();

        for i in 0..shifts.len() {
            for j in (i + 1)..shifts.len() {
                if shifts[i].overlaps(&shifts[j]) {
                    overlaps.push((i, j));
                }
            }
        }

        overlaps
    }

    /// Calculate gap severity based on coverage ratio
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

    /// Calculate validation summary from gaps
    pub fn calculate_summary(
        total_slots: i32,
        gaps: &[CoverageGap],
        overstaffed_count: i32,
    ) -> ValidationSummary {
        let covered_slots = total_slots - gaps.len() as i32;
        let coverage_percentage = if total_slots > 0 {
            (covered_slots as f64 / total_slots as f64) * 100.0
        } else {
            100.0
        };

        ValidationSummary {
            total_slots,
            covered_slots,
            gap_count: gaps.len() as i32,
            overstaffed_count,
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
        }
    }

    /// Check if a function set satisfies requirements
    pub fn functions_satisfy_requirements(
        employee_functions: &[String],
        required_functions: &[String],
    ) -> bool {
        if required_functions.is_empty() {
            return true;
        }

        required_functions
            .iter()
            .any(|req| employee_functions.contains(req))
    }

    /// Parse time string to NaiveTime
    pub fn parse_time(time_str: &str) -> Option<NaiveTime> {
        NaiveTime::parse_from_str(time_str, "%H:%M").ok()
    }

    /// Check if a datetime falls within a slot
    pub fn is_in_slot(
        datetime: DateTime<Utc>,
        slot_day: i32,
        slot_start: &str,
        slot_end: &str,
    ) -> bool {
        let weekday = datetime.weekday();
        let day_index = match weekday {
            Weekday::Sun => 0,
            Weekday::Mon => 1,
            Weekday::Tue => 2,
            Weekday::Wed => 3,
            Weekday::Thu => 4,
            Weekday::Fri => 5,
            Weekday::Sat => 6,
        };

        if day_index != slot_day {
            return false;
        }

        let time = datetime.time();
        let start = Self::parse_time(slot_start);
        let end = Self::parse_time(slot_end);

        match (start, end) {
            (Some(s), Some(e)) => time >= s && time < e,
            _ => false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_severity() {
        assert_eq!(
            ValidationEngine::calculate_severity(0, 4),
            GapSeverity::Critical
        );
        assert_eq!(
            ValidationEngine::calculate_severity(1, 4),
            GapSeverity::High
        );
        assert_eq!(
            ValidationEngine::calculate_severity(2, 4),
            GapSeverity::Medium
        );
        assert_eq!(ValidationEngine::calculate_severity(3, 4), GapSeverity::Low);
    }

    #[test]
    fn test_functions_satisfy_requirements() {
        let employee = vec!["nurse".to_string(), "manager".to_string()];
        let required = vec!["nurse".to_string()];

        assert!(ValidationEngine::functions_satisfy_requirements(
            &employee, &required
        ));
        assert!(ValidationEngine::functions_satisfy_requirements(
            &employee,
            &[]
        ));
        assert!(!ValidationEngine::functions_satisfy_requirements(
            &[],
            &required
        ));
    }

    #[test]
    fn test_timespan_overlap() {
        let span1 = TimeSpan::new(
            "2024-01-01T09:00:00Z"
                .parse()
                .expect("hardcoded timestamp is valid RFC3339"),
            "2024-01-01T17:00:00Z"
                .parse()
                .expect("hardcoded timestamp is valid RFC3339"),
        );
        let span2 = TimeSpan::new(
            "2024-01-01T14:00:00Z"
                .parse()
                .expect("hardcoded timestamp is valid RFC3339"),
            "2024-01-01T22:00:00Z"
                .parse()
                .expect("hardcoded timestamp is valid RFC3339"),
        );
        let span3 = TimeSpan::new(
            "2024-01-01T18:00:00Z"
                .parse()
                .expect("hardcoded timestamp is valid RFC3339"),
            "2024-01-01T22:00:00Z"
                .parse()
                .expect("hardcoded timestamp is valid RFC3339"),
        );

        assert!(span1.overlaps(&span2));
        assert!(!span1.overlaps(&span3));
    }
}
