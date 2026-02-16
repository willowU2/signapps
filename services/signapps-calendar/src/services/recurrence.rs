//! RRULE parsing and event expansion service

use chrono::{DateTime, Utc};
use rrule::RRuleSet;
use std::str::FromStr;

/// Parse RFC 5545 RRULE and expand to instances within date range
///
/// # Arguments
/// * `rrule_str` - RFC 5545 RRULE string (e.g., "FREQ=WEEKLY;BYDAY=MO,WE;COUNT=52")
/// * `start_time` - Event start datetime (used as DTSTART)
/// * `range_start` - Start of expansion range
/// * `range_end` - End of expansion range
/// * `max_instances` - Maximum instances to return (safety limit, default 365)
///
/// # Returns
/// Vec of expanded event start times
pub fn expand_rrule(
    rrule_str: &str,
    start_time: DateTime<Utc>,
    range_start: DateTime<Utc>,
    range_end: DateTime<Utc>,
    max_instances: usize,
) -> Result<Vec<DateTime<Utc>>, String> {
    // Parse RRULE string with DTSTART
    let rrule_with_dtstart = format!(
        "DTSTART:{}\nRRULE:{}",
        start_time.format("%Y%m%dT%H%M%SZ"),
        rrule_str
    );

    let rruleset = RRuleSet::from_str(&rrule_with_dtstart)
        .map_err(|e| format!("Failed to parse RRULE: {}", e))?;

    // Get occurrences within range
    let occurrences = rruleset
        .into_iter()
        .take(max_instances)
        .filter_map(|dt| {
            // Convert RRuleSet datetime to UTC
            let utc_dt = dt.with_timezone(&Utc);
            if utc_dt >= range_start && utc_dt <= range_end {
                Some(utc_dt)
            } else {
                None
            }
        })
        .collect::<Vec<_>>();

    if occurrences.is_empty() {
        tracing::warn!(
            "No occurrences found for RRULE: {} within {:?} to {:?}",
            rrule_str,
            range_start,
            range_end
        );
    }

    Ok(occurrences)
}

/// Validate RRULE string
pub fn validate_rrule(rrule_str: &str) -> Result<(), String> {
    // Basic validation: check for required FREQ parameter
    if !rrule_str.contains("FREQ=") {
        return Err("RRULE must contain FREQ parameter".to_string());
    }

    // Check for supported FREQ values
    let supported_freqs = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"];
    let has_supported_freq = supported_freqs.iter().any(|freq| rrule_str.contains(freq));
    if !has_supported_freq {
        return Err("FREQ must be one of: DAILY, WEEKLY, MONTHLY, YEARLY".to_string());
    }

    // Try to parse to catch syntax errors
    let test_rrule = format!("DTSTART:20260101T000000Z\nRRULE:{}", rrule_str);
    RRuleSet::from_str(&test_rrule)
        .map_err(|e| format!("Invalid RRULE syntax: {}", e))?;

    Ok(())
}

/// Parse RRULE string to extract frequency
pub fn get_rrule_frequency(rrule_str: &str) -> Option<String> {
    rrule_str
        .split(';')
        .find(|part| part.starts_with("FREQ="))
        .map(|part| part.replace("FREQ=", ""))
}

/// Count occurrences within date range for an RRULE
pub fn count_occurrences(
    rrule_str: &str,
    start_time: DateTime<Utc>,
    range_start: DateTime<Utc>,
    range_end: DateTime<Utc>,
) -> Result<usize, String> {
    let occurrences = expand_rrule(rrule_str, start_time, range_start, range_end, 365)?;
    Ok(occurrences.len())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_rrule_daily() {
        assert!(validate_rrule("FREQ=DAILY;COUNT=10").is_ok());
    }

    #[test]
    fn test_validate_rrule_weekly() {
        assert!(validate_rrule("FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=52").is_ok());
    }

    #[test]
    fn test_validate_rrule_missing_freq() {
        assert!(validate_rrule("COUNT=10").is_err());
    }

    #[test]
    fn test_get_frequency() {
        assert_eq!(
            get_rrule_frequency("FREQ=WEEKLY;BYDAY=MO,WE"),
            Some("WEEKLY".to_string())
        );
    }
}
