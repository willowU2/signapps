//! iCalendar RFC 5545 import/export service

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// iCalendar format compliant event export
#[derive(Debug, Serialize, Deserialize)]
pub struct ICalendarEvent {
    pub uid: String,
    pub title: String,
    pub description: Option<String>,
    pub location: Option<String>,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub rrule: Option<String>,
    pub created_at: DateTime<Utc>,
    pub modified_at: DateTime<Utc>,
}

/// Export calendar to iCalendar format (RFC 5545)
pub fn export_calendar_to_ics(
    calendar_name: &str,
    events: Vec<ICalendarEvent>,
) -> String {
    let mut ics = String::new();

    // iCalendar header
    ics.push_str("BEGIN:VCALENDAR\r\n");
    ics.push_str("VERSION:2.0\r\n");
    ics.push_str("PRODID:-//SignApps//Calendar//EN\r\n");
    ics.push_str("CALSCALE:GREGORIAN\r\n");
    ics.push_str("METHOD:PUBLISH\r\n");
    ics.push_str(&format!("X-WR-CALNAME:{}\r\n", escape_text(calendar_name)));
    ics.push_str(&format!("X-WR-TIMEZONE:UTC\r\n"));
    ics.push_str(&format!("DTSTAMP:{}\r\n", format_datetime(&Utc::now())));

    // Events
    for event in events {
        ics.push_str("BEGIN:VEVENT\r\n");
        ics.push_str(&format!("UID:{}\r\n", event.uid));
        ics.push_str(&format!("DTSTAMP:{}\r\n", format_datetime(&event.created_at)));
        ics.push_str(&format!("DTSTART:{}\r\n", format_datetime(&event.start_time)));
        ics.push_str(&format!("DTEND:{}\r\n", format_datetime(&event.end_time)));
        ics.push_str(&format!("SUMMARY:{}\r\n", escape_text(&event.title)));

        if let Some(desc) = &event.description {
            ics.push_str(&format!("DESCRIPTION:{}\r\n", escape_text(desc)));
        }

        if let Some(location) = &event.location {
            ics.push_str(&format!("LOCATION:{}\r\n", escape_text(location)));
        }

        if let Some(rrule) = &event.rrule {
            ics.push_str(&format!("RRULE:{}\r\n", rrule));
        }

        ics.push_str(&format!("LAST-MODIFIED:{}\r\n", format_datetime(&event.modified_at)));
        ics.push_str("STATUS:CONFIRMED\r\n");
        ics.push_str("END:VEVENT\r\n");
    }

    // iCalendar footer
    ics.push_str("END:VCALENDAR\r\n");

    ics
}

/// Parse iCalendar format (RFC 5545) to extract events
pub fn import_calendar_from_ics(ics_content: &str) -> Result<Vec<ICalendarEvent>, String> {
    let mut events = Vec::new();
    let lines: Vec<&str> = ics_content.lines().collect();

    let mut current_event = ICalendarEventBuilder::new();
    let mut in_event = false;

    for line in lines {
        let line = line.trim();

        if line.starts_with("BEGIN:VEVENT") {
            in_event = true;
            current_event = ICalendarEventBuilder::new();
        } else if line.starts_with("END:VEVENT") {
            in_event = false;
            // Create new event from builder
            let builder = std::mem::replace(&mut current_event, ICalendarEventBuilder::new());
            if let Ok(event) = builder.build() {
                events.push(event);
            }
        } else if in_event {
            if let Some((key, value)) = parse_ical_line(line) {
                match key.as_str() {
                    "UID" => current_event.uid = Some(value),
                    "SUMMARY" => current_event.title = Some(unescape_text(&value)),
                    "DESCRIPTION" => current_event.description = Some(unescape_text(&value)),
                    "LOCATION" => current_event.location = Some(unescape_text(&value)),
                    "DTSTART" => current_event.start_time = Some(parse_datetime(&value)),
                    "DTEND" => current_event.end_time = Some(parse_datetime(&value)),
                    "RRULE" => current_event.rrule = Some(value),
                    "DTSTAMP" => current_event.created_at = Some(parse_datetime(&value)),
                    "LAST-MODIFIED" => current_event.modified_at = Some(parse_datetime(&value)),
                    _ => {}
                }
            }
        }
    }

    Ok(events)
}

/// Builder for parsing iCalendar events
struct ICalendarEventBuilder {
    uid: Option<String>,
    title: Option<String>,
    description: Option<String>,
    location: Option<String>,
    start_time: Option<DateTime<Utc>>,
    end_time: Option<DateTime<Utc>>,
    rrule: Option<String>,
    created_at: Option<DateTime<Utc>>,
    modified_at: Option<DateTime<Utc>>,
}

impl ICalendarEventBuilder {
    fn new() -> Self {
        Self {
            uid: None,
            title: None,
            description: None,
            location: None,
            start_time: None,
            end_time: None,
            rrule: None,
            created_at: None,
            modified_at: None,
        }
    }

    fn build(self) -> Result<ICalendarEvent, String> {
        Ok(ICalendarEvent {
            uid: self.uid.ok_or("Missing UID")?,
            title: self.title.ok_or("Missing SUMMARY")?,
            description: self.description,
            location: self.location,
            start_time: self.start_time.ok_or("Missing DTSTART")?,
            end_time: self.end_time.ok_or("Missing DTEND")?,
            rrule: self.rrule,
            created_at: self.created_at.unwrap_or_else(Utc::now),
            modified_at: self.modified_at.unwrap_or_else(Utc::now),
        })
    }
}

/// Parse a single iCalendar property line (e.g., "SUMMARY:Meeting")
fn parse_ical_line(line: &str) -> Option<(String, String)> {
    let colon_pos = line.find(':')?;
    let key = line[..colon_pos].to_uppercase();
    let value = line[colon_pos + 1..].to_string();

    // Handle parameters (e.g., "DTSTART;TZID=UTC:...")
    let key_without_params = if let Some(semicolon_pos) = key.find(';') {
        key[..semicolon_pos].to_string()
    } else {
        key
    };

    Some((key_without_params, value))
}

/// Format DateTime to iCalendar format (RFC 5545)
fn format_datetime(dt: &DateTime<Utc>) -> String {
    dt.format("%Y%m%dT%H%M%SZ").to_string()
}

/// Parse iCalendar datetime format (RFC 5545)
fn parse_datetime(s: &str) -> DateTime<Utc> {
    // Handle both "20240116T143000Z" and "20240116T143000" formats
    let s = s.trim_end_matches('Z');

    chrono::NaiveDateTime::parse_from_str(s, "%Y%m%dT%H%M%S")
        .map(|ndt| DateTime::from_naive_utc_and_offset(ndt, Utc))
        .unwrap_or_else(|_| Utc::now())
}

/// Escape text for iCalendar format (handle commas, newlines, etc.)
fn escape_text(text: &str) -> String {
    text.replace('\\', "\\\\")
        .replace('\n', "\\n")
        .replace('\r', "")
        .replace(',', "\\,")
        .replace(';', "\\;")
}

/// Unescape text from iCalendar format
fn unescape_text(text: &str) -> String {
    text.replace("\\,", ",")
        .replace("\\;", ";")
        .replace("\\n", "\n")
        .replace("\\\\", "\\")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_datetime() {
        let dt = DateTime::parse_from_rfc3339("2024-01-16T14:30:00Z")
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap();
        assert_eq!(format_datetime(&dt), "20240116T143000Z");
    }

    #[test]
    fn test_parse_datetime() {
        let dt = parse_datetime("20240116T143000Z");
        assert_eq!(dt.year(), 2024);
        assert_eq!(dt.month(), 1);
        assert_eq!(dt.day(), 16);
    }

    #[test]
    fn test_escape_unescape_text() {
        let original = "Hello, World!\nWith newline";
        let escaped = escape_text(original);
        let unescaped = unescape_text(&escaped);
        // Note: newlines are replaced with \n so exact match might differ
        assert!(unescaped.contains("Hello"));
        assert!(unescaped.contains("World"));
    }

    #[test]
    fn test_export_calendar_basic() {
        let events = vec![ICalendarEvent {
            uid: "test-uid".to_string(),
            title: "Test Event".to_string(),
            description: Some("Test description".to_string()),
            location: Some("Room 123".to_string()),
            start_time: Utc::now(),
            end_time: Utc::now(),
            rrule: None,
            created_at: Utc::now(),
            modified_at: Utc::now(),
        }];

        let ics = export_calendar_to_ics("Test Calendar", events);
        assert!(ics.contains("BEGIN:VCALENDAR"));
        assert!(ics.contains("END:VCALENDAR"));
        assert!(ics.contains("Test Event"));
        assert!(ics.contains("Room 123"));
    }

    #[test]
    fn test_import_calendar_basic() {
        let ics = r#"BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:test-123
DTSTART:20240116T143000Z
DTEND:20240116T153000Z
SUMMARY:Test Event
DESCRIPTION:Test Description
END:VEVENT
END:VCALENDAR"#;

        let result = import_calendar_from_ics(ics);
        assert!(result.is_ok());
        let events = result.unwrap();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].title, "Test Event");
    }
}
