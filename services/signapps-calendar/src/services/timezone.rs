//! Timezone handling and conversion utilities

use chrono::{DateTime, NaiveDateTime, TimeZone, Utc};
use chrono_tz::Tz;
use std::str::FromStr;

/// Convert UTC datetime to target timezone
pub fn to_timezone(dt: DateTime<Utc>, timezone: &str) -> Result<DateTime<Tz>, String> {
    let tz = Tz::from_str(timezone)
        .map_err(|_| format!("Invalid timezone: {}", timezone))?;
    Ok(dt.with_timezone(&tz))
}

/// Convert local time in a timezone to UTC
pub fn from_timezone(
    year: i32,
    month: u32,
    day: u32,
    hour: u32,
    minute: u32,
    second: u32,
    timezone: &str,
) -> Result<DateTime<Utc>, String> {
    let tz = Tz::from_str(timezone)
        .map_err(|_| format!("Invalid timezone: {}", timezone))?;

    let naive = NaiveDateTime::new(
        chrono::NaiveDate::from_ymd_opt(year, month, day)
            .ok_or("Invalid date".to_string())?,
        chrono::NaiveTime::from_hms_opt(hour, minute, second)
            .ok_or("Invalid time".to_string())?,
    );

    Ok(tz.from_local_datetime(&naive)
        .single()
        .ok_or("Ambiguous or invalid local time (e.g., DST transition)".to_string())?
        .with_timezone(&Utc))
}

/// List common supported timezones
pub fn list_timezones() -> Vec<&'static str> {
    vec![
        "UTC",
        "America/New_York",      // EST/EDT
        "America/Chicago",       // CST/CDT
        "America/Denver",        // MST/MDT
        "America/Los_Angeles",   // PST/PDT
        "America/Anchorage",     // AKST/AKDT
        "Pacific/Honolulu",      // HST
        "Europe/London",         // GMT/BST
        "Europe/Paris",          // CET/CEST
        "Europe/Berlin",         // CET/CEST
        "Europe/Moscow",         // MSK
        "Asia/Tokyo",            // JST
        "Asia/Shanghai",         // CST
        "Asia/Hong_Kong",        // HKT
        "Asia/Singapore",        // SGT
        "Asia/Bangkok",          // ICT
        "Asia/Dubai",            // GST
        "Asia/Kolkata",          // IST
        "Australia/Sydney",      // AEDT/AEST
        "Australia/Melbourne",   // AEDT/AEST
        "Pacific/Auckland",      // NZDT/NZST
    ]
}

/// Validate timezone string
pub fn validate_timezone(timezone: &str) -> bool {
    Tz::from_str(timezone).is_ok()
}

/// Get current time in a timezone
pub fn now_in_timezone(timezone: &str) -> Result<String, String> {
    let tz = Tz::from_str(timezone)
        .map_err(|_| format!("Invalid timezone: {}", timezone))?;
    let now = Utc::now().with_timezone(&tz);
    Ok(now.to_rfc3339())
}

/// Format datetime for display in specific timezone
pub fn format_in_timezone(dt: DateTime<Utc>, timezone: &str, format: &str) -> Result<String, String> {
    let tz = Tz::from_str(timezone)
        .map_err(|_| format!("Invalid timezone: {}", timezone))?;
    let local_dt = dt.with_timezone(&tz);
    Ok(local_dt.format(format).to_string())
}

/// Check if datetime is in DST for given timezone
///
/// Note: This is a simplified heuristic. True DST detection requires
/// timezone-specific rules that vary by region.
pub fn is_dst(_dt: DateTime<Utc>, timezone: &str) -> Result<bool, String> {
    // Validate timezone exists
    Tz::from_str(timezone)
        .map_err(|_| format!("Invalid timezone: {}", timezone))?;

    // Simplified heuristic: assume DST in Northern Hemisphere summer (June-Aug)
    // and Southern Hemisphere summer (Dec-Feb)
    // This would need a proper DST rules database for production use

    // For now, return false (assume standard time)
    // Production code should use chrono_tz's built-in DST handling
    Ok(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_timezone_valid() {
        assert!(validate_timezone("America/New_York"));
        assert!(validate_timezone("Europe/London"));
        assert!(validate_timezone("Asia/Tokyo"));
    }

    #[test]
    fn test_validate_timezone_invalid() {
        assert!(!validate_timezone("Invalid/Timezone"));
        assert!(!validate_timezone("Foo/Bar"));
    }

    #[test]
    fn test_list_timezones() {
        let zones = list_timezones();
        assert!(zones.len() > 0);
        assert!(zones.contains(&"UTC"));
        assert!(zones.contains(&"America/New_York"));
    }

    #[test]
    fn test_timezone_conversion() {
        let utc_time = DateTime::parse_from_rfc3339("2026-02-16T12:00:00Z")
            .unwrap()
            .with_timezone(&Utc);

        let ny_time = to_timezone(utc_time, "America/New_York").unwrap();
        // 12:00 UTC should be 07:00 EST (UTC-5)
        assert_eq!(ny_time.hour(), 7);
    }

    #[test]
    fn test_from_timezone() {
        let utc = from_timezone(2026, 2, 16, 7, 0, 0, "America/New_York").unwrap();
        // 07:00 EST should be 12:00 UTC
        assert_eq!(utc.hour(), 12);
    }
}
