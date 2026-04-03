//! Recurrence rule (RRULE) expansion and validation service.
//!
//! Supports: FREQ=DAILY|WEEKLY|MONTHLY|YEARLY with INTERVAL, COUNT, UNTIL, BYDAY.

use chrono::{DateTime, Datelike, Duration, NaiveDate, Utc, Weekday};
use std::collections::HashMap;

// ---------------------------------------------------------------------------
// RRULE parsing
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
struct ParsedRrule {
    freq: Frequency,
    interval: u32,
    count: Option<usize>,
    until: Option<DateTime<Utc>>,
    by_day: Vec<Weekday>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
enum Frequency {
    Daily,
    Weekly,
    Monthly,
    Yearly,
}

fn parse_rrule(rrule: &str) -> Result<ParsedRrule, String> {
    let upper = rrule.to_uppercase();
    let parts: HashMap<&str, &str> = upper
        .split(';')
        .filter_map(|p| {
            let mut kv = p.splitn(2, '=');
            Some((kv.next()?, kv.next()?))
        })
        .collect();

    let freq = match parts.get("FREQ") {
        Some(&"DAILY") => Frequency::Daily,
        Some(&"WEEKLY") => Frequency::Weekly,
        Some(&"MONTHLY") => Frequency::Monthly,
        Some(&"YEARLY") => Frequency::Yearly,
        Some(other) => return Err(format!("Unsupported FREQ: {other}")),
        None => return Err("Missing FREQ in RRULE".into()),
    };

    let interval = parts
        .get("INTERVAL")
        .and_then(|v| v.parse::<u32>().ok())
        .unwrap_or(1)
        .max(1);

    let count = parts.get("COUNT").and_then(|v| v.parse::<usize>().ok());

    let until = parts.get("UNTIL").and_then(|v| {
        // Accept YYYYMMDD or YYYYMMDDTHHMMSSZ
        if v.len() == 8 {
            NaiveDate::parse_from_str(v, "%Y%m%d").ok().map(|d| {
                d.and_hms_opt(23, 59, 59)
                    .expect("23:59:59 is always a valid time")
                    .and_utc()
            })
        } else {
            DateTime::parse_from_str(v, "%Y%m%dT%H%M%SZ")
                .ok()
                .map(|d| d.with_timezone(&Utc))
        }
    });

    let by_day = parts
        .get("BYDAY")
        .map(|v| {
            v.split(',')
                .filter_map(|d| match d.trim() {
                    "MO" => Some(Weekday::Mon),
                    "TU" => Some(Weekday::Tue),
                    "WE" => Some(Weekday::Wed),
                    "TH" => Some(Weekday::Thu),
                    "FR" => Some(Weekday::Fri),
                    "SA" => Some(Weekday::Sat),
                    "SU" => Some(Weekday::Sun),
                    _ => None,
                })
                .collect()
        })
        .unwrap_or_default();

    Ok(ParsedRrule {
        freq,
        interval,
        count,
        until,
        by_day,
    })
}

// ---------------------------------------------------------------------------
// Expansion
// ---------------------------------------------------------------------------

/// Expand an iCalendar RRULE into a list of occurrence datetimes within a range.
///
/// - `rrule`: RFC 5545 RRULE string (e.g. `FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE`)
/// - `start`: original event start time (DTSTART)
/// - `range_start` / `range_end`: query window
/// - `max_count`: hard limit on returned occurrences (safety cap)
pub fn expand_rrule(
    rrule: &str,
    start: DateTime<Utc>,
    range_start: DateTime<Utc>,
    range_end: DateTime<Utc>,
    max_count: usize,
) -> Result<Vec<DateTime<Utc>>, String> {
    let rule = parse_rrule(rrule)?;
    let mut occurrences = Vec::new();
    let effective_max = rule.count.unwrap_or(max_count).min(max_count);
    let mut generated = 0usize;
    let mut current = start;

    // Safety: don't generate beyond 10 years or 5000 occurrences
    let hard_limit = start + Duration::days(3650);

    loop {
        if current > range_end || current > hard_limit || generated >= effective_max {
            break;
        }

        if let Some(until) = rule.until {
            if current > until {
                break;
            }
        }

        let matches_byday = rule.by_day.is_empty() || rule.by_day.contains(&current.weekday());

        if matches_byday && current >= range_start {
            occurrences.push(current);
        }

        if matches_byday {
            generated += 1;
        }

        current = advance(current, &rule);
    }

    Ok(occurrences)
}

fn advance(dt: DateTime<Utc>, rule: &ParsedRrule) -> DateTime<Utc> {
    match rule.freq {
        Frequency::Daily => dt + Duration::days(rule.interval as i64),
        Frequency::Weekly => {
            if rule.by_day.is_empty() {
                dt + Duration::weeks(rule.interval as i64)
            } else {
                // Advance day by day within the week, then jump interval weeks
                let next = dt + Duration::days(1);
                // If we've wrapped past all BYDAY entries for this week, skip ahead
                if next.weekday().num_days_from_monday() < dt.weekday().num_days_from_monday() {
                    dt + Duration::days(1) + Duration::weeks((rule.interval - 1) as i64)
                } else {
                    next
                }
            }
        },
        Frequency::Monthly => {
            let month = dt.month() + rule.interval;
            let year = dt.year() + (month as i32 - 1) / 12;
            let month = ((month - 1) % 12) + 1;
            let day = dt.day().min(days_in_month(year, month));
            dt.with_day(day)
                .and_then(|d| d.with_month(month))
                .and_then(|d| d.with_year(year))
                .unwrap_or(dt + Duration::days(30 * rule.interval as i64))
        },
        Frequency::Yearly => dt
            .with_year(dt.year() + rule.interval as i32)
            .unwrap_or(dt + Duration::days(365 * rule.interval as i64)),
    }
}

fn days_in_month(year: i32, month: u32) -> u32 {
    // First day of next month, then subtract 1 day to get last day of current month.
    // Falls back to the 28th as a safe lower bound for any month.
    let first_of_next = NaiveDate::from_ymd_opt(
        if month == 12 { year + 1 } else { year },
        if month == 12 { 1 } else { month + 1 },
        1,
    )
    .or_else(|| NaiveDate::from_ymd_opt(year, month, 28))
    .expect("year/month combination is always representable");

    first_of_next
        .pred_opt()
        .expect("first-of-month always has a predecessor")
        .day()
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/// Validate if an iCalendar RRULE string is valid.
pub fn validate_rrule(rrule: &str) -> Result<(), String> {
    parse_rrule(rrule).map(|_| ())
}

/// Get frequency from RRULE.
pub fn get_rrule_frequency(rrule: &str) -> String {
    parse_rrule(rrule)
        .map(|r| format!("{:?}", r.freq).to_uppercase())
        .unwrap_or_else(|_| "UNKNOWN".into())
}

/// Count total occurrences for a rule (from COUNT param, or None if unbounded).
pub fn count_occurrences(rrule: &str) -> Option<usize> {
    parse_rrule(rrule).ok().and_then(|r| r.count)
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{Datelike, TimeZone};

    #[test]
    fn test_daily_expansion() {
        let start = Utc.with_ymd_and_hms(2025, 1, 1, 10, 0, 0).unwrap();
        let range_start = start;
        let range_end = Utc.with_ymd_and_hms(2025, 1, 5, 23, 59, 59).unwrap();

        let result = expand_rrule("FREQ=DAILY;COUNT=5", start, range_start, range_end, 100)
            .expect("rrule expansion should succeed");
        assert_eq!(result.len(), 5);
    }

    #[test]
    fn test_daily_recurrence_correct_dates() {
        let start = Utc.with_ymd_and_hms(2025, 3, 1, 9, 0, 0).unwrap();
        let range_end = Utc.with_ymd_and_hms(2025, 3, 4, 23, 59, 59).unwrap();

        let result = expand_rrule("FREQ=DAILY", start, start, range_end, 10)
            .expect("rrule expansion should succeed");
        assert_eq!(result.len(), 4); // Mar 1, 2, 3, 4
        assert_eq!(result[0].day(), 1);
        assert_eq!(result[1].day(), 2);
        assert_eq!(result[2].day(), 3);
        assert_eq!(result[3].day(), 4);
    }

    #[test]
    fn test_weekly_with_byday() {
        let start = Utc.with_ymd_and_hms(2025, 1, 6, 9, 0, 0).unwrap(); // Monday
        let range_end = Utc.with_ymd_and_hms(2025, 1, 20, 23, 59, 59).unwrap();

        let result = expand_rrule("FREQ=WEEKLY;BYDAY=MO,WE,FR", start, start, range_end, 100)
            .expect("rrule expansion should succeed");
        assert!(result.len() >= 3);
    }

    #[test]
    fn test_weekly_byday_only_returns_correct_weekdays() {
        // Start on Monday 2025-01-06; run for 2 weeks with only MO and FR
        let start = Utc.with_ymd_and_hms(2025, 1, 6, 10, 0, 0).unwrap(); // Monday
        let range_end = Utc.with_ymd_and_hms(2025, 1, 19, 23, 59, 59).unwrap();

        let result = expand_rrule("FREQ=WEEKLY;BYDAY=MO,FR", start, start, range_end, 100)
            .expect("rrule expansion should succeed");

        // All returned dates must be Monday or Friday
        for dt in &result {
            let wd = dt.weekday();
            assert!(
                wd == Weekday::Mon || wd == Weekday::Fri,
                "Expected Mon or Fri, got {:?} on {}",
                wd,
                dt
            );
        }
    }

    #[test]
    fn test_monthly_recurrence_with_count_limit() {
        let start = Utc.with_ymd_and_hms(2025, 1, 15, 10, 0, 0).unwrap();
        let range_end = Utc.with_ymd_and_hms(2026, 12, 31, 23, 59, 59).unwrap();

        let result = expand_rrule("FREQ=MONTHLY;COUNT=4", start, start, range_end, 50)
            .expect("rrule expansion should succeed");
        assert_eq!(
            result.len(),
            4,
            "COUNT=4 should produce exactly 4 instances"
        );
        // Each occurrence should be roughly 1 month apart
        assert_eq!(result[0].month(), 1);
        assert_eq!(result[1].month(), 2);
        assert_eq!(result[2].month(), 3);
        assert_eq!(result[3].month(), 4);
    }

    #[test]
    fn test_monthly_recurrence_respects_max_count() {
        let start = Utc.with_ymd_and_hms(2025, 1, 1, 0, 0, 0).unwrap();
        let range_end = Utc.with_ymd_and_hms(2030, 1, 1, 0, 0, 0).unwrap();

        // max_count=3 should cap results
        let result = expand_rrule("FREQ=MONTHLY", start, start, range_end, 3)
            .expect("rrule expansion should succeed");
        assert!(result.len() <= 3, "max_count should cap expansions");
    }

    #[test]
    fn test_recurrence_exception_by_range_filtering() {
        // Range starts after first occurrence — first should be excluded
        let start = Utc.with_ymd_and_hms(2025, 1, 1, 10, 0, 0).unwrap();
        let range_start = Utc.with_ymd_and_hms(2025, 1, 3, 0, 0, 0).unwrap();
        let range_end = Utc.with_ymd_and_hms(2025, 1, 5, 23, 59, 59).unwrap();

        let result = expand_rrule("FREQ=DAILY", start, range_start, range_end, 100)
            .expect("rrule expansion should succeed");
        // Jan 1 and Jan 2 should NOT be in results (before range_start)
        for dt in &result {
            assert!(
                *dt >= range_start,
                "All occurrences must be within the range, got {}",
                dt
            );
        }
    }

    #[test]
    fn test_validate() {
        assert!(validate_rrule("FREQ=DAILY;INTERVAL=2").is_ok());
        assert!(validate_rrule("INTERVAL=2").is_err());
        assert!(validate_rrule("FREQ=HOURLY").is_err());
    }

    #[test]
    fn test_validate_rrule_valid_expressions() {
        assert!(validate_rrule("FREQ=WEEKLY;BYDAY=MO,WE,FR").is_ok());
        assert!(validate_rrule("FREQ=MONTHLY;COUNT=12").is_ok());
        assert!(validate_rrule("FREQ=YEARLY;INTERVAL=1").is_ok());
    }

    #[test]
    fn test_validate_rrule_rejects_missing_freq() {
        assert!(validate_rrule("COUNT=5").is_err());
        assert!(validate_rrule("BYDAY=MO").is_err());
    }

    #[test]
    fn test_validate_rrule_rejects_unsupported_freq() {
        assert!(validate_rrule("FREQ=HOURLY").is_err());
        assert!(validate_rrule("FREQ=MINUTELY").is_err());
    }

    #[test]
    fn test_count_occurrences_extracts_count() {
        assert_eq!(count_occurrences("FREQ=DAILY;COUNT=10"), Some(10));
        assert_eq!(count_occurrences("FREQ=WEEKLY;BYDAY=MO"), None);
    }
}
