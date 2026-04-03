//! CalDAV REPORT helpers.
//!
//! Provides response builders for CalDAV `calendar-query` and
//! `calendar-multiget` REPORT methods. Responses are built as DAV
//! multistatus XML with embedded `calendar-data` (iCalendar).

use crate::xml::{build_multistatus, MultistatusResponse};

/// A calendar resource for inclusion in a CalDAV multistatus response.
///
/// # Examples
///
/// ```
/// use signapps_dav::caldav::CalendarResource;
/// let res = CalendarResource {
///     href: "/dav/calendars/user@ex.com/cal/event1.ics".to_string(),
///     etag: "\"abc123\"".to_string(),
///     calendar_data: "BEGIN:VCALENDAR...END:VCALENDAR".to_string(),
/// };
/// ```
#[derive(Debug, Clone)]
pub struct CalendarResource {
    /// The href (path) of the resource.
    pub href: String,
    /// ETag of the resource (quoted string).
    pub etag: String,
    /// Full iCalendar data as a string.
    pub calendar_data: String,
}

/// A calendar collection for PROPFIND responses.
///
/// # Examples
///
/// ```
/// use signapps_dav::caldav::CalendarInfo;
/// let info = CalendarInfo {
///     href: "/dav/calendars/user@ex.com/work/".to_string(),
///     display_name: "Work".to_string(),
///     ctag: "\"ctag-v1\"".to_string(),
///     color: Some("#0000FF".to_string()),
///     description: Some("Work calendar".to_string()),
/// };
/// ```
#[derive(Debug, Clone)]
pub struct CalendarInfo {
    /// The href (path) of the calendar collection.
    pub href: String,
    /// Display name of the calendar.
    pub display_name: String,
    /// CTag (collection tag) for sync detection.
    pub ctag: String,
    /// Calendar color (Apple extension, e.g. `#FF0000`).
    pub color: Option<String>,
    /// Calendar description.
    pub description: Option<String>,
}

/// Build a CalDAV multistatus response for a list of calendar resources.
///
/// Used for `calendar-query` and `calendar-multiget` REPORT responses.
///
/// # Examples
///
/// ```
/// use signapps_dav::caldav::{CalendarResource, build_calendar_multiget_response};
/// let resources = vec![CalendarResource {
///     href: "/dav/calendars/u@ex.com/cal/e.ics".to_string(),
///     etag: "\"v1\"".to_string(),
///     calendar_data: "BEGIN:VCALENDAR\r\nEND:VCALENDAR".to_string(),
/// }];
/// let xml = build_calendar_multiget_response(&resources);
/// assert!(xml.contains("calendar-data"));
/// ```
///
/// # Panics
///
/// None.
pub fn build_calendar_multiget_response(resources: &[CalendarResource]) -> String {
    let responses: Vec<MultistatusResponse> = resources
        .iter()
        .map(|r| MultistatusResponse {
            href: r.href.clone(),
            found_props: vec![
                ("D:getetag".to_string(), r.etag.clone()),
                ("C:calendar-data".to_string(), r.calendar_data.clone()),
            ],
            status: "HTTP/1.1 200 OK".to_string(),
        })
        .collect();

    build_multistatus(&responses)
}

/// Build a CalDAV PROPFIND response for calendar collections.
///
/// Returns a multistatus XML listing calendar properties (displayname,
/// resourcetype, ctag, color).
///
/// # Examples
///
/// ```
/// use signapps_dav::caldav::{CalendarInfo, build_calendar_propfind_response};
/// let calendars = vec![CalendarInfo {
///     href: "/dav/calendars/u@ex.com/work/".to_string(),
///     display_name: "Work".to_string(),
///     ctag: "\"ct1\"".to_string(),
///     color: Some("#FF0000".to_string()),
///     description: None,
/// }];
/// let xml = build_calendar_propfind_response(&calendars);
/// assert!(xml.contains("Work"));
/// ```
///
/// # Panics
///
/// None.
pub fn build_calendar_propfind_response(calendars: &[CalendarInfo]) -> String {
    let responses: Vec<MultistatusResponse> = calendars
        .iter()
        .map(|c| {
            let mut props = vec![
                ("D:displayname".to_string(), c.display_name.clone()),
                (
                    "D:resourcetype".to_string(),
                    "<D:collection/><C:calendar/>".to_string(),
                ),
                ("CS:getctag".to_string(), c.ctag.clone()),
            ];
            if let Some(ref color) = c.color {
                props.push((
                    "x1:calendar-color xmlns:x1=\"http://apple.com/ns/ical/\"".to_string(),
                    color.clone(),
                ));
            }
            if let Some(ref desc) = c.description {
                props.push(("C:calendar-description".to_string(), desc.clone()));
            }
            MultistatusResponse {
                href: c.href.clone(),
                found_props: props,
                status: "HTTP/1.1 200 OK".to_string(),
            }
        })
        .collect();

    build_multistatus(&responses)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_calendar_multiget_response() {
        let resources = vec![
            CalendarResource {
                href: "/dav/calendars/u@ex.com/cal/e1.ics".to_string(),
                etag: "\"v1\"".to_string(),
                calendar_data: "BEGIN:VCALENDAR\r\nEND:VCALENDAR".to_string(),
            },
            CalendarResource {
                href: "/dav/calendars/u@ex.com/cal/e2.ics".to_string(),
                etag: "\"v2\"".to_string(),
                calendar_data: "BEGIN:VCALENDAR\r\nEND:VCALENDAR".to_string(),
            },
        ];
        let xml = build_calendar_multiget_response(&resources);
        assert!(xml.contains("<D:multistatus"));
        assert!(xml.contains("e1.ics"));
        assert!(xml.contains("e2.ics"));
        assert!(xml.contains("calendar-data"));
    }

    #[test]
    fn test_build_calendar_propfind_response() {
        let calendars = vec![CalendarInfo {
            href: "/dav/calendars/u@ex.com/work/".to_string(),
            display_name: "Work Calendar".to_string(),
            ctag: "\"ctag-42\"".to_string(),
            color: Some("#0000FF".to_string()),
            description: Some("My work calendar".to_string()),
        }];
        let xml = build_calendar_propfind_response(&calendars);
        assert!(xml.contains("Work Calendar"));
        assert!(xml.contains("ctag-42"));
        assert!(xml.contains("#0000FF"));
        assert!(xml.contains("My work calendar"));
        assert!(xml.contains("<C:calendar/>"));
    }
}
