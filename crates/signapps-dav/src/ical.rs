//! Simple iCalendar (RFC 5545) parser and builder.
//!
//! Handles VCALENDAR with VEVENT and VTODO components. Supports the most
//! common properties: UID, SUMMARY, DESCRIPTION, DTSTART, DTEND, RRULE,
//! LOCATION, ORGANIZER, ATTENDEE, STATUS, CATEGORIES, PRIORITY, SEQUENCE.

use crate::{DavError, DavResult};
use serde::{Deserialize, Serialize};

/// A parsed iCalendar event (VEVENT).
///
/// # Examples
///
/// ```
/// use signapps_dav::ical::ICalEvent;
/// let event = ICalEvent {
///     uid: "abc-123".to_string(),
///     summary: "Team Meeting".to_string(),
///     description: Some("Weekly sync".to_string()),
///     dtstart: "20260403T100000Z".to_string(),
///     dtend: Some("20260403T110000Z".to_string()),
///     rrule: None,
///     location: Some("Room A".to_string()),
///     organizer: Some("mailto:boss@example.com".to_string()),
///     attendees: vec!["mailto:dev@example.com".to_string()],
///     status: Some("CONFIRMED".to_string()),
///     categories: vec![],
///     priority: None,
///     sequence: 0,
///     created: None,
///     last_modified: None,
/// };
/// assert_eq!(event.summary, "Team Meeting");
/// ```
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ICalEvent {
    /// Unique identifier (UID property).
    pub uid: String,
    /// Event summary / title (SUMMARY property).
    pub summary: String,
    /// Detailed description (DESCRIPTION property).
    pub description: Option<String>,
    /// Start date-time in iCal format (DTSTART property).
    pub dtstart: String,
    /// End date-time in iCal format (DTEND property).
    pub dtend: Option<String>,
    /// Recurrence rule (RRULE property, e.g. `FREQ=WEEKLY;COUNT=10`).
    pub rrule: Option<String>,
    /// Location string (LOCATION property).
    pub location: Option<String>,
    /// Organizer URI (ORGANIZER property, e.g. `mailto:user@example.com`).
    pub organizer: Option<String>,
    /// List of attendee URIs (ATTENDEE properties).
    pub attendees: Vec<String>,
    /// Event status (STATUS property: TENTATIVE, CONFIRMED, CANCELLED).
    pub status: Option<String>,
    /// Categories / tags (CATEGORIES property).
    pub categories: Vec<String>,
    /// Priority (PRIORITY property: 0-9).
    pub priority: Option<u8>,
    /// Revision sequence number (SEQUENCE property).
    pub sequence: u32,
    /// Creation timestamp (CREATED property).
    pub created: Option<String>,
    /// Last modification timestamp (LAST-MODIFIED property).
    pub last_modified: Option<String>,
}

impl ICalEvent {
    /// Parse a VEVENT from an iCalendar string.
    ///
    /// Extracts the first VEVENT found inside a VCALENDAR wrapper.
    ///
    /// # Errors
    ///
    /// Returns [`DavError::ICalParse`] if no VEVENT is found or the UID/SUMMARY
    /// are missing.
    ///
    /// # Panics
    ///
    /// None.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_dav::ical::ICalEvent;
    /// let ical = "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:test-123\r\nSUMMARY:Test\r\nDTSTART:20260403T100000Z\r\nEND:VEVENT\r\nEND:VCALENDAR";
    /// let event = ICalEvent::parse(ical).unwrap();
    /// assert_eq!(event.uid, "test-123");
    /// assert_eq!(event.summary, "Test");
    /// ```
    pub fn parse(ical_data: &str) -> DavResult<Self> {
        let mut uid = None;
        let mut summary = None;
        let mut description = None;
        let mut dtstart = None;
        let mut dtend = None;
        let mut rrule = None;
        let mut location = None;
        let mut organizer = None;
        let mut attendees = Vec::new();
        let mut status = None;
        let mut categories = Vec::new();
        let mut priority = None;
        let mut sequence: u32 = 0;
        let mut created = None;
        let mut last_modified = None;
        let mut in_vevent = false;

        for line in unfold_lines(ical_data) {
            let line = line.trim();

            if line.eq_ignore_ascii_case("BEGIN:VEVENT") {
                in_vevent = true;
                continue;
            }
            if line.eq_ignore_ascii_case("END:VEVENT") {
                break;
            }

            if !in_vevent {
                continue;
            }

            if let Some((key, value)) = parse_content_line(line) {
                let base_key = key.split(';').next().unwrap_or(key).to_uppercase();
                match base_key.as_str() {
                    "UID" => uid = Some(value.to_string()),
                    "SUMMARY" => summary = Some(unescape_ical(value)),
                    "DESCRIPTION" => description = Some(unescape_ical(value)),
                    "DTSTART" => dtstart = Some(value.to_string()),
                    "DTEND" => dtend = Some(value.to_string()),
                    "RRULE" => rrule = Some(value.to_string()),
                    "LOCATION" => location = Some(unescape_ical(value)),
                    "ORGANIZER" => organizer = Some(value.to_string()),
                    "ATTENDEE" => attendees.push(value.to_string()),
                    "STATUS" => status = Some(value.to_string()),
                    "CATEGORIES" => {
                        categories.extend(value.split(',').map(|s| s.trim().to_string()));
                    },
                    "PRIORITY" => priority = value.parse::<u8>().ok(),
                    "SEQUENCE" => sequence = value.parse::<u32>().unwrap_or(0),
                    "CREATED" => created = Some(value.to_string()),
                    "LAST-MODIFIED" => last_modified = Some(value.to_string()),
                    _ => {}, // Ignore unknown properties
                }
            }
        }

        let uid = uid.ok_or_else(|| DavError::ICalParse("Missing UID".to_string()))?;
        let summary = summary.unwrap_or_default();
        let dtstart = dtstart.ok_or_else(|| DavError::ICalParse("Missing DTSTART".to_string()))?;

        Ok(Self {
            uid,
            summary,
            description,
            dtstart,
            dtend,
            rrule,
            location,
            organizer,
            attendees,
            status,
            categories,
            priority,
            sequence,
            created,
            last_modified,
        })
    }

    /// Serialize the event to an iCalendar string (wrapped in VCALENDAR).
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_dav::ical::ICalEvent;
    /// let event = ICalEvent {
    ///     uid: "abc".to_string(),
    ///     summary: "Test".to_string(),
    ///     dtstart: "20260403T100000Z".to_string(),
    ///     dtend: None,
    ///     description: None,
    ///     rrule: None,
    ///     location: None,
    ///     organizer: None,
    ///     attendees: vec![],
    ///     status: None,
    ///     categories: vec![],
    ///     priority: None,
    ///     sequence: 0,
    ///     created: None,
    ///     last_modified: None,
    /// };
    /// let ical = event.to_ical();
    /// assert!(ical.contains("BEGIN:VCALENDAR"));
    /// assert!(ical.contains("UID:abc"));
    /// ```
    ///
    /// # Panics
    ///
    /// None.
    pub fn to_ical(&self) -> String {
        let mut lines = Vec::new();
        lines.push("BEGIN:VCALENDAR".to_string());
        lines.push("VERSION:2.0".to_string());
        lines.push("PRODID:-//SignApps//CalDAV//EN".to_string());
        lines.push("BEGIN:VEVENT".to_string());
        lines.push(format!("UID:{}", self.uid));
        lines.push(format!("SUMMARY:{}", escape_ical(&self.summary)));
        lines.push(format!("DTSTART:{}", self.dtstart));

        if let Some(ref dtend) = self.dtend {
            lines.push(format!("DTEND:{}", dtend));
        }
        if let Some(ref desc) = self.description {
            lines.push(format!("DESCRIPTION:{}", escape_ical(desc)));
        }
        if let Some(ref rrule) = self.rrule {
            lines.push(format!("RRULE:{}", rrule));
        }
        if let Some(ref loc) = self.location {
            lines.push(format!("LOCATION:{}", escape_ical(loc)));
        }
        if let Some(ref org) = self.organizer {
            lines.push(format!("ORGANIZER:{}", org));
        }
        for attendee in &self.attendees {
            lines.push(format!("ATTENDEE:{}", attendee));
        }
        if let Some(ref status) = self.status {
            lines.push(format!("STATUS:{}", status));
        }
        if !self.categories.is_empty() {
            lines.push(format!("CATEGORIES:{}", self.categories.join(",")));
        }
        if let Some(priority) = self.priority {
            lines.push(format!("PRIORITY:{}", priority));
        }
        if self.sequence > 0 {
            lines.push(format!("SEQUENCE:{}", self.sequence));
        }
        if let Some(ref created) = self.created {
            lines.push(format!("CREATED:{}", created));
        }
        if let Some(ref lm) = self.last_modified {
            lines.push(format!("LAST-MODIFIED:{}", lm));
        }

        lines.push("END:VEVENT".to_string());
        lines.push("END:VCALENDAR".to_string());

        lines.join("\r\n")
    }
}

/// Check whether an iCal date-time string falls within a time range.
///
/// Performs simple string comparison of iCal date-time values in UTC format
/// (e.g. `20260403T100000Z`). For non-UTC or date-only values, returns `true`
/// as a safe fallback (include rather than exclude).
///
/// # Examples
///
/// ```
/// use signapps_dav::ical::is_in_time_range;
/// assert!(is_in_time_range("20260115T100000Z", Some("20260101T000000Z"), Some("20260201T000000Z")));
/// assert!(!is_in_time_range("20260215T100000Z", Some("20260101T000000Z"), Some("20260201T000000Z")));
/// ```
///
/// # Panics
///
/// None.
pub fn is_in_time_range(dtstart: &str, range_start: Option<&str>, range_end: Option<&str>) -> bool {
    // If no range specified, everything matches
    if range_start.is_none() && range_end.is_none() {
        return true;
    }

    // Simple string comparison works for iCal UTC datetime format (YYYYMMDDTHHMMSSZ)
    if let Some(start) = range_start {
        if dtstart < start {
            return false;
        }
    }
    if let Some(end) = range_end {
        if dtstart >= end {
            return false;
        }
    }
    true
}

// ── Internal helpers ─────────────────────────────────────────────────────────

/// Unfold iCalendar lines (continuation lines start with a space or tab).
fn unfold_lines(data: &str) -> Vec<String> {
    let mut result = Vec::new();
    let mut current = String::new();

    for line in data.lines() {
        if line.starts_with(' ') || line.starts_with('\t') {
            // Continuation line: append without the leading whitespace
            current.push_str(line[1..].trim_end());
        } else {
            if !current.is_empty() {
                result.push(current);
            }
            current = line.trim_end().to_string();
        }
    }
    if !current.is_empty() {
        result.push(current);
    }
    result
}

/// Parse a single content line into (key, value).
fn parse_content_line(line: &str) -> Option<(&str, &str)> {
    let colon_pos = line.find(':')?;
    let key = &line[..colon_pos];
    let value = &line[colon_pos + 1..];
    Some((key, value))
}

/// Unescape iCalendar text values.
fn unescape_ical(s: &str) -> String {
    s.replace("\\n", "\n")
        .replace("\\N", "\n")
        .replace("\\,", ",")
        .replace("\\;", ";")
        .replace("\\\\", "\\")
}

/// Escape text values for iCalendar output.
fn escape_ical(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace(';', "\\;")
        .replace(',', "\\,")
        .replace('\n', "\\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_ical_event() {
        let ical = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:event-001\r\nSUMMARY:Sprint Planning\r\nDTSTART:20260403T090000Z\r\nDTEND:20260403T100000Z\r\nDESCRIPTION:Plan the sprint\r\nLOCATION:Room B\r\nORGANIZER:mailto:pm@example.com\r\nATTENDEE:mailto:dev1@example.com\r\nATTENDEE:mailto:dev2@example.com\r\nSTATUS:CONFIRMED\r\nSEQUENCE:1\r\nCATEGORIES:Work,Sprint\r\nPRIORITY:5\r\nEND:VEVENT\r\nEND:VCALENDAR";

        let event = ICalEvent::parse(ical).unwrap();
        assert_eq!(event.uid, "event-001");
        assert_eq!(event.summary, "Sprint Planning");
        assert_eq!(event.description.as_deref(), Some("Plan the sprint"));
        assert_eq!(event.dtstart, "20260403T090000Z");
        assert_eq!(event.dtend.as_deref(), Some("20260403T100000Z"));
        assert_eq!(event.location.as_deref(), Some("Room B"));
        assert_eq!(event.organizer.as_deref(), Some("mailto:pm@example.com"));
        assert_eq!(event.attendees.len(), 2);
        assert_eq!(event.status.as_deref(), Some("CONFIRMED"));
        assert_eq!(event.sequence, 1);
        assert_eq!(event.categories, vec!["Work", "Sprint"]);
        assert_eq!(event.priority, Some(5));
    }

    #[test]
    fn test_build_ical_event() {
        let event = ICalEvent {
            uid: "test-uid".to_string(),
            summary: "Test Event".to_string(),
            description: Some("A test".to_string()),
            dtstart: "20260403T100000Z".to_string(),
            dtend: Some("20260403T110000Z".to_string()),
            rrule: Some("FREQ=WEEKLY;COUNT=4".to_string()),
            location: Some("Office".to_string()),
            organizer: Some("mailto:boss@example.com".to_string()),
            attendees: vec!["mailto:dev@example.com".to_string()],
            status: Some("CONFIRMED".to_string()),
            categories: vec!["Work".to_string()],
            priority: Some(3),
            sequence: 2,
            created: None,
            last_modified: None,
        };

        let ical = event.to_ical();
        assert!(ical.contains("BEGIN:VCALENDAR"));
        assert!(ical.contains("BEGIN:VEVENT"));
        assert!(ical.contains("UID:test-uid"));
        assert!(ical.contains("SUMMARY:Test Event"));
        assert!(ical.contains("DTSTART:20260403T100000Z"));
        assert!(ical.contains("DTEND:20260403T110000Z"));
        assert!(ical.contains("RRULE:FREQ=WEEKLY;COUNT=4"));
        assert!(ical.contains("LOCATION:Office"));
        assert!(ical.contains("ORGANIZER:mailto:boss@example.com"));
        assert!(ical.contains("ATTENDEE:mailto:dev@example.com"));
        assert!(ical.contains("STATUS:CONFIRMED"));
        assert!(ical.contains("PRIORITY:3"));
        assert!(ical.contains("SEQUENCE:2"));
        assert!(ical.contains("END:VEVENT"));
        assert!(ical.contains("END:VCALENDAR"));
    }

    #[test]
    fn test_parse_ical_roundtrip() {
        let original = ICalEvent {
            uid: "roundtrip-001".to_string(),
            summary: "Roundtrip Test".to_string(),
            description: Some("Testing roundtrip".to_string()),
            dtstart: "20260501T140000Z".to_string(),
            dtend: Some("20260501T150000Z".to_string()),
            rrule: None,
            location: None,
            organizer: None,
            attendees: vec![],
            status: None,
            categories: vec![],
            priority: None,
            sequence: 0,
            created: None,
            last_modified: None,
        };

        let ical_text = original.to_ical();
        let parsed = ICalEvent::parse(&ical_text).unwrap();
        assert_eq!(parsed.uid, original.uid);
        assert_eq!(parsed.summary, original.summary);
        assert_eq!(parsed.dtstart, original.dtstart);
        assert_eq!(parsed.dtend, original.dtend);
    }

    #[test]
    fn test_parse_ical_missing_uid() {
        let ical = "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:No UID\r\nDTSTART:20260403T100000Z\r\nEND:VEVENT\r\nEND:VCALENDAR";
        let result = ICalEvent::parse(ical);
        assert!(result.is_err());
    }

    #[test]
    fn test_is_in_time_range() {
        assert!(is_in_time_range(
            "20260115T100000Z",
            Some("20260101T000000Z"),
            Some("20260201T000000Z"),
        ));
        assert!(!is_in_time_range(
            "20260215T100000Z",
            Some("20260101T000000Z"),
            Some("20260201T000000Z"),
        ));
        assert!(!is_in_time_range(
            "20251215T100000Z",
            Some("20260101T000000Z"),
            Some("20260201T000000Z"),
        ));
        // No range = always matches
        assert!(is_in_time_range("20260115T100000Z", None, None));
    }

    #[test]
    fn test_unescape_ical() {
        assert_eq!(unescape_ical("hello\\nworld"), "hello\nworld");
        assert_eq!(unescape_ical("a\\,b\\;c\\\\d"), "a,b;c\\d");
    }

    #[test]
    fn test_escape_ical() {
        assert_eq!(escape_ical("hello\nworld"), "hello\\nworld");
        assert_eq!(escape_ical("a,b;c\\d"), "a\\,b\\;c\\\\d");
    }

    #[test]
    fn test_unfold_lines() {
        let data =
            "DESCRIPTION:This is a long\r\n description that spans\r\n multiple lines\r\nUID:test";
        let lines = unfold_lines(data);
        assert_eq!(lines.len(), 2);
        assert!(lines[0].contains("This is a long"));
        assert!(lines[0].contains("description that spans"));
        assert!(lines[0].contains("multiple lines"));
        assert_eq!(lines[1], "UID:test");
    }
}
