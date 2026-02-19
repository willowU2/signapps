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
