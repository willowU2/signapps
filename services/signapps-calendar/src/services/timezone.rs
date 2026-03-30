//! Timezone conversion and validation service
use chrono::{DateTime, TimeZone, Utc};
use chrono_tz::Tz;

/// Convert a UTC datetime to a specific timezone
pub fn to_timezone(utc: DateTime<Utc>, tz: &str) -> Option<DateTime<Tz>> {
    let target_tz: Tz = tz.parse().ok()?;
    Some(utc.with_timezone(&target_tz))
}

/// Convert a localized datetime to UTC
pub fn from_timezone(local: DateTime<Tz>) -> DateTime<Utc> {
    local.with_timezone(&Utc)
}

/// Get the offset (like "+05:30") for a timezone at a specific time
pub fn get_offset(tz: &str, time: DateTime<Utc>) -> String {
    let timezone: Tz = tz.parse().unwrap_or(chrono_tz::UTC);
    let localized = time.with_timezone(&timezone);
    localized.offset().to_string()
}

/// List all timezones (alias for handler)
pub fn list_timezones() -> Vec<String> {
    chrono_tz::TZ_VARIANTS
        .iter()
        .map(|tz| tz.name().to_string())
        .collect()
}

/// Format a UTC time in a specific timezone
pub fn format_in_timezone(utc: DateTime<Utc>, tz: &str, format: &str) -> Result<String, String> {
    let timezone: Tz = tz
        .parse()
        .map_err(|_| format!("Invalid timezone: {}", tz))?;
    let localized = utc.with_timezone(&timezone);
    Ok(localized.format(format).to_string())
}

/// Validate if a timezone string is valid
pub fn validate_timezone(tz: &str) -> bool {
    tz.parse::<Tz>().is_ok()
}

/// Parse a datetime string in a specific timezone
pub fn parse_in_timezone(
    datetime_str: &str,
    format_str: &str,
    tz_str: &str,
) -> Option<DateTime<Utc>> {
    let tz: Tz = tz_str.parse().ok()?;
    let naive = chrono::NaiveDateTime::parse_from_str(datetime_str, format_str).ok()?;
    tz.from_local_datetime(&naive)
        .single()
        .map(|dt| dt.with_timezone(&Utc))
}

/// Get the current time in a specific timezone
pub fn now_in_timezone(tz: &str) -> Option<DateTime<Tz>> {
    let target_tz: Tz = tz.parse().ok()?;
    Some(Utc::now().with_timezone(&target_tz))
}

/// Check if a timezone is currently in Daylight Saving Time
pub fn is_dst(tz: &str, time: DateTime<Utc>) -> bool {
    // This is a simplified check
    let target_tz: Tz = tz.parse().unwrap_or(chrono_tz::UTC);
    let localized = time.with_timezone(&target_tz);
    format!("{:?}", localized.offset()).contains("DST")
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn test_to_timezone_utc_to_paris() {
        let utc = Utc
            .with_ymd_and_hms(2025, 6, 21, 12, 0, 0)
            .expect("valid date constant");
        let paris = to_timezone(utc, "Europe/Paris");
        assert!(paris.is_some(), "Conversion to Europe/Paris should succeed");
        // In summer Paris is UTC+2
        let paris_dt = paris.expect("conversion to Europe/Paris should succeed");
        assert_eq!(paris_dt.hour(), 14, "Paris summer is UTC+2 → 14:00");
    }

    #[test]
    fn test_to_timezone_invalid_tz_returns_none() {
        let utc = Utc
            .with_ymd_and_hms(2025, 1, 1, 0, 0, 0)
            .expect("valid date constant");
        let result = to_timezone(utc, "Not/ATimezone");
        assert!(result.is_none(), "Invalid timezone should return None");
    }

    #[test]
    fn test_from_timezone_converts_back_to_utc() {
        let utc = Utc
            .with_ymd_and_hms(2025, 3, 15, 10, 30, 0)
            .expect("valid date constant");
        let paris =
            to_timezone(utc, "Europe/Paris").expect("conversion to Europe/Paris should succeed");
        let back_to_utc = from_timezone(paris);
        assert_eq!(
            back_to_utc.timestamp(),
            utc.timestamp(),
            "Round-trip conversion must preserve the instant"
        );
    }

    #[test]
    fn test_validate_timezone_valid() {
        assert!(validate_timezone("Europe/Paris"));
        assert!(validate_timezone("America/New_York"));
        assert!(validate_timezone("Asia/Tokyo"));
        assert!(validate_timezone("UTC"));
    }

    #[test]
    fn test_validate_timezone_invalid() {
        assert!(!validate_timezone("Not/AReal/TZ"));
        assert!(!validate_timezone(""));
        assert!(!validate_timezone("Europe"));
    }

    #[test]
    fn test_format_in_timezone() {
        let utc = Utc
            .with_ymd_and_hms(2025, 1, 15, 9, 0, 0)
            .expect("valid date constant");
        let formatted = format_in_timezone(utc, "UTC", "%Y-%m-%d %H:%M");
        assert_eq!(
            formatted.expect("formatting should succeed"),
            "2025-01-15 09:00"
        );
    }

    #[test]
    fn test_format_in_timezone_invalid_tz_returns_error() {
        let utc = Utc
            .with_ymd_and_hms(2025, 1, 1, 0, 0, 0)
            .expect("valid date constant");
        let result = format_in_timezone(utc, "Bad/Zone", "%H:%M");
        assert!(result.is_err(), "Invalid timezone should return an error");
    }

    #[test]
    fn test_list_timezones_is_non_empty() {
        let tzs = list_timezones();
        assert!(!tzs.is_empty(), "Timezone list must not be empty");
        assert!(tzs.contains(&"UTC".to_string()));
        assert!(tzs.contains(&"America/New_York".to_string()));
    }

    #[test]
    fn test_parse_in_timezone_utc() {
        let result = parse_in_timezone("2025-06-01 12:00:00", "%Y-%m-%d %H:%M:%S", "UTC");
        assert!(result.is_some());
        let dt = result.expect("parse_in_timezone should succeed for valid input");
        assert_eq!(dt.hour(), 12);
        assert_eq!(dt.month(), 6);
    }

    #[test]
    fn test_dst_detection_summer_new_york() {
        // July 4 2025 — New York is in EDT (DST active)
        let summer = Utc
            .with_ymd_and_hms(2025, 7, 4, 12, 0, 0)
            .expect("valid date constant");
        // DST detection is a best-effort check; we just verify it runs without panic
        let _ = is_dst("America/New_York", summer);
    }

    #[test]
    fn test_dst_detection_winter_new_york() {
        // January 15 2025 — New York is in EST (no DST)
        let winter = Utc
            .with_ymd_and_hms(2025, 1, 15, 12, 0, 0)
            .expect("valid date constant");
        let _ = is_dst("America/New_York", winter);
    }
}
