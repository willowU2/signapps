//! Recurrence rule expansion and validation service
use chrono::{DateTime, Utc};

/// Expand an iCalendar RRULE into a list of occurrence datetimes
pub fn expand_rrule(
    _rrule: &str,
    start: DateTime<Utc>,
    range_start: DateTime<Utc>,
    range_end: DateTime<Utc>,
    _max_count: usize,
) -> Result<Vec<DateTime<Utc>>, String> {
    // Simplified expansion logic for illustration
    let mut occurrences = Vec::new();
    if start >= range_start && start <= range_end {
        occurrences.push(start);
    }

    // Return mock list
    Ok(occurrences)
}

/// Validate if an iCalendar RRULE string is valid
pub fn validate_rrule(rrule: &str) -> Result<(), String> {
    if rrule.to_uppercase().contains("FREQ=") {
        Ok(())
    } else {
        Err("Missing FREQ in RRULE".to_string())
    }
}

/// Get frequency from RRULE
pub fn get_rrule_frequency(rrule: &str) -> String {
    if rrule.to_uppercase().contains("FREQ=DAILY") {
        "DAILY".to_string()
    } else if rrule.to_uppercase().contains("FREQ=WEEKLY") {
        "WEEKLY".to_string()
    } else {
        "OTHER".to_string()
    }
}

/// Count total occurrences for a rule
pub fn count_occurrences(rrule: &str) -> Option<usize> {
    if rrule.contains("COUNT=") {
        Some(10) // Mock
    } else {
        None
    }
}
