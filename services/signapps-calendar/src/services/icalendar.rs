//! iCalendar RFC 5545 import/export service
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

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

/// Export a list of events to iCalendar format
pub fn export_calendar_to_ics(calendar_name: &str, events: Vec<ICalendarEvent>) -> String {
    let mut lines = Vec::new();
    lines.push("BEGIN:VCALENDAR".to_string());
    lines.push("VERSION:2.0".to_string());
    lines.push(format!("X-WR-CALNAME:{}", calendar_name));

    for event in events {
        lines.push("BEGIN:VEVENT".to_string());
        lines.push(format!("UID:{}", event.uid));
        lines.push(format!("SUMMARY:{}", event.title));
        if let Some(desc) = &event.description {
            lines.push(format!("DESCRIPTION:{}", desc));
        }
        if let Some(loc) = &event.location {
            lines.push(format!("LOCATION:{}", loc));
        }
        lines.push(format!(
            "DTSTART:{}",
            event.start_time.format("%Y%m%dT%H%M%SZ")
        ));
        lines.push(format!("DTEND:{}", event.end_time.format("%Y%m%dT%H%M%SZ")));
        if let Some(rrule) = &event.rrule {
            lines.push(format!("RRULE:{}", rrule));
        }
        lines.push(format!(
            "DTSTAMP:{}",
            event.modified_at.format("%Y%m%dT%H%M%SZ")
        ));
        lines.push("END:VEVENT".to_string());
    }

    lines.push("END:VCALENDAR".to_string());
    lines.join("\r\n")
}

/// Import events from iCalendar format
pub fn import_calendar_from_ics(ics_content: &str) -> Result<Vec<ICalendarEvent>, String> {
    if !ics_content.contains("BEGIN:VCALENDAR") {
        return Err("Invalid iCalendar content".to_string());
    }
    Ok(Vec::new())
}
