//! XML request/response helpers for DAV protocols.
//!
//! Provides builders for WebDAV multistatus XML responses and parsers for
//! PROPFIND, REPORT, and PROPPATCH request bodies.

use crate::{DavError, DavResult};

/// DAV XML namespace.
pub const DAV_NS: &str = "DAV:";
/// CalDAV namespace.
pub const CALDAV_NS: &str = "urn:ietf:params:xml:ns:caldav";
/// CardDAV namespace.
pub const CARDDAV_NS: &str = "urn:ietf:params:xml:ns:carddav";
/// Apple Calendar Server namespace (used for ctag).
pub const CS_NS: &str = "http://calendarserver.org/ns/";

/// A property name with optional namespace.
#[derive(Debug, Clone, PartialEq)]
pub struct PropName {
    /// The namespace URI (e.g. `DAV:`).
    pub namespace: String,
    /// The local name (e.g. `displayname`).
    pub local_name: String,
}

/// A parsed PROPFIND request.
#[derive(Debug, Clone)]
pub struct PropfindRequest {
    /// If true, client requested `<allprop/>`.
    pub all_prop: bool,
    /// If true, client requested `<propname/>`.
    pub prop_name: bool,
    /// Specific properties requested (if not allprop/propname).
    pub props: Vec<PropName>,
}

/// A single `<response>` element in a multistatus.
#[derive(Debug, Clone)]
pub struct MultistatusResponse {
    /// The `<href>` value (resource path).
    pub href: String,
    /// Properties found with HTTP 200.
    pub found_props: Vec<(String, String)>,
    /// Status line for the response (e.g. `HTTP/1.1 200 OK`).
    pub status: String,
}

/// A CalDAV time-range filter (used in calendar-query REPORT).
#[derive(Debug, Clone)]
pub struct TimeRangeFilter {
    /// Start of the range (ISO 8601 / iCal date-time).
    pub start: Option<String>,
    /// End of the range (ISO 8601 / iCal date-time).
    pub end: Option<String>,
}

/// A parsed REPORT request body.
#[derive(Debug, Clone)]
pub enum ReportRequest {
    /// `calendar-query` — filter events by time range.
    CalendarQuery {
        /// Optional time-range filter.
        time_range: Option<TimeRangeFilter>,
    },
    /// `calendar-multiget` — fetch specific events by href.
    CalendarMultiget {
        /// List of hrefs to fetch.
        hrefs: Vec<String>,
    },
    /// `addressbook-query` — filter contacts.
    AddressbookQuery,
    /// `addressbook-multiget` — fetch specific contacts by href.
    AddressbookMultiget {
        /// List of hrefs to fetch.
        hrefs: Vec<String>,
    },
}

/// Parse a PROPFIND XML request body.
///
/// If the body is empty, treats it as `<allprop/>` per RFC 4918.
///
/// # Errors
///
/// Returns [`DavError::Xml`] if XML parsing fails.
///
/// # Panics
///
/// None.
///
/// # Examples
///
/// ```
/// use signapps_dav::xml::parse_propfind;
/// let req = parse_propfind("").unwrap();
/// assert!(req.all_prop);
/// ```
pub fn parse_propfind(body: &str) -> DavResult<PropfindRequest> {
    if body.trim().is_empty() {
        return Ok(PropfindRequest {
            all_prop: true,
            prop_name: false,
            props: Vec::new(),
        });
    }

    let mut all_prop = false;
    let mut prop_name = false;
    let mut props = Vec::new();
    let mut inside_prop = false;
    let mut current_ns = String::new();

    let mut reader = quick_xml::Reader::from_str(body);
    let mut buf = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(quick_xml::events::Event::Start(ref e))
            | Ok(quick_xml::events::Event::Empty(ref e)) => {
                let local = String::from_utf8_lossy(e.local_name().as_ref()).to_string();
                // Extract namespace from tag prefix or attributes
                let ns = extract_namespace(e, &current_ns);

                match local.as_str() {
                    "allprop" => all_prop = true,
                    "propname" => prop_name = true,
                    "prop" => {
                        inside_prop = true;
                        current_ns = ns;
                    },
                    _ if inside_prop => {
                        props.push(PropName {
                            namespace: ns,
                            local_name: local,
                        });
                    },
                    _ => {},
                }
            },
            Ok(quick_xml::events::Event::End(ref e)) => {
                let local = String::from_utf8_lossy(e.local_name().as_ref()).to_string();
                if local == "prop" {
                    inside_prop = false;
                }
            },
            Ok(quick_xml::events::Event::Eof) => break,
            Err(e) => return Err(DavError::Xml(format!("XML parse error: {e}"))),
            _ => {},
        }
        buf.clear();
    }

    Ok(PropfindRequest {
        all_prop,
        prop_name,
        props,
    })
}

/// Parse a REPORT XML request body for CalDAV/CardDAV.
///
/// Detects the report type from the root element name and extracts relevant
/// parameters (time-range filters, hrefs).
///
/// # Errors
///
/// Returns [`DavError::Xml`] if XML parsing fails or the report type is unknown.
///
/// # Panics
///
/// None.
///
/// # Examples
///
/// ```
/// use signapps_dav::xml::parse_report;
/// let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
/// <C:calendar-multiget xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
///   <D:prop><D:getetag/><C:calendar-data/></D:prop>
///   <D:href>/dav/calendars/user@ex.com/cal/event1.ics</D:href>
///   <D:href>/dav/calendars/user@ex.com/cal/event2.ics</D:href>
/// </C:calendar-multiget>"#;
/// let report = parse_report(xml).unwrap();
/// ```
pub fn parse_report(body: &str) -> DavResult<ReportRequest> {
    if body.trim().is_empty() {
        return Err(DavError::InvalidRequest("Empty REPORT body".to_string()));
    }

    let mut reader = quick_xml::Reader::from_str(body);
    let mut buf = Vec::new();
    let mut root_element: Option<String> = None;
    let mut hrefs = Vec::new();
    let mut time_range: Option<TimeRangeFilter> = None;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(quick_xml::events::Event::Start(ref e))
            | Ok(quick_xml::events::Event::Empty(ref e)) => {
                let local = String::from_utf8_lossy(e.local_name().as_ref()).to_string();

                if root_element.is_none() {
                    root_element = Some(local.clone());
                }

                match local.as_str() {
                    "href" => {
                        // Read text content
                        if let Ok(text) = reader.read_text(e.name()) {
                            let href = text.trim().to_string();
                            if !href.is_empty() {
                                hrefs.push(href);
                            }
                        }
                    },
                    "time-range" => {
                        let mut start = None;
                        let mut end = None;
                        for attr in e.attributes().flatten() {
                            let key = String::from_utf8_lossy(attr.key.as_ref()).to_string();
                            let val = String::from_utf8_lossy(&attr.value).to_string();
                            match key.as_str() {
                                "start" => start = Some(val),
                                "end" => end = Some(val),
                                _ => {},
                            }
                        }
                        time_range = Some(TimeRangeFilter { start, end });
                    },
                    _ => {},
                }
            },
            Ok(quick_xml::events::Event::Eof) => break,
            Err(e) => return Err(DavError::Xml(format!("XML parse error: {e}"))),
            _ => {},
        }
        buf.clear();
    }

    match root_element.as_deref() {
        Some("calendar-query") => Ok(ReportRequest::CalendarQuery { time_range }),
        Some("calendar-multiget") => Ok(ReportRequest::CalendarMultiget { hrefs }),
        Some("addressbook-query") => Ok(ReportRequest::AddressbookQuery),
        Some("addressbook-multiget") => Ok(ReportRequest::AddressbookMultiget { hrefs }),
        Some(other) => Err(DavError::Unsupported(format!(
            "Unknown report type: {other}"
        ))),
        None => Err(DavError::InvalidRequest(
            "No root element in REPORT body".to_string(),
        )),
    }
}

/// Build a DAV multistatus XML response.
///
/// # Examples
///
/// ```
/// use signapps_dav::xml::{build_multistatus, MultistatusResponse};
/// let responses = vec![
///     MultistatusResponse {
///         href: "/dav/calendars/user@ex.com/".to_string(),
///         found_props: vec![
///             ("displayname".to_string(), "My Calendar".to_string()),
///         ],
///         status: "HTTP/1.1 200 OK".to_string(),
///     },
/// ];
/// let xml = build_multistatus(&responses);
/// assert!(xml.contains("<D:multistatus"));
/// assert!(xml.contains("My Calendar"));
/// ```
///
/// # Panics
///
/// None.
pub fn build_multistatus(responses: &[MultistatusResponse]) -> String {
    let mut xml = String::from(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<D:multistatus xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:CR="urn:ietf:params:xml:ns:carddav" xmlns:CS="http://calendarserver.org/ns/">"#,
    );

    for resp in responses {
        xml.push_str("\n  <D:response>\n    <D:href>");
        xml.push_str(&xml_escape(&resp.href));
        xml.push_str("</D:href>\n    <D:propstat>\n      <D:prop>");

        for (name, value) in &resp.found_props {
            xml.push_str("\n        <");
            xml.push_str(name);
            xml.push('>');
            // Values starting with '<' are raw XML (e.g. resourcetype children);
            // everything else is text that needs escaping.
            if value.starts_with('<') {
                xml.push_str(value);
            } else {
                xml.push_str(&xml_escape(value));
            }
            xml.push_str("</");
            // Handle self-closing or namespaced tags
            let tag_name = name.split_whitespace().next().unwrap_or(name);
            xml.push_str(tag_name);
            xml.push('>');
        }

        xml.push_str("\n      </D:prop>\n      <D:status>");
        xml.push_str(&resp.status);
        xml.push_str("</D:status>\n    </D:propstat>\n  </D:response>");
    }

    xml.push_str("\n</D:multistatus>");
    xml
}

/// Build a single resource response for a PROPFIND result.
///
/// # Panics
///
/// None.
pub fn build_resource_response(href: &str, props: Vec<(String, String)>) -> MultistatusResponse {
    MultistatusResponse {
        href: href.to_string(),
        found_props: props,
        status: "HTTP/1.1 200 OK".to_string(),
    }
}

/// Escape special XML characters in a string.
///
/// # Examples
///
/// ```
/// use signapps_dav::xml::xml_escape;
/// assert_eq!(xml_escape("a<b>c&d"), "a&lt;b&gt;c&amp;d");
/// ```
pub fn xml_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

/// Extract namespace from an XML event tag.
fn extract_namespace(event: &quick_xml::events::BytesStart<'_>, default_ns: &str) -> String {
    for attr in event.attributes().flatten() {
        let key = String::from_utf8_lossy(attr.key.as_ref()).to_string();
        if key == "xmlns" {
            return String::from_utf8_lossy(&attr.value).to_string();
        }
    }
    default_ns.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_propfind_empty() {
        let req = parse_propfind("").unwrap();
        assert!(req.all_prop);
        assert!(!req.prop_name);
        assert!(req.props.is_empty());
    }

    #[test]
    fn test_parse_propfind_allprop() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<D:propfind xmlns:D="DAV:">
  <D:allprop/>
</D:propfind>"#;
        let req = parse_propfind(xml).unwrap();
        assert!(req.all_prop);
    }

    #[test]
    fn test_parse_propfind_specific_props() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<D:propfind xmlns:D="DAV:">
  <D:prop>
    <D:displayname/>
    <D:resourcetype/>
  </D:prop>
</D:propfind>"#;
        let req = parse_propfind(xml).unwrap();
        assert!(!req.all_prop);
        assert!(req.props.len() >= 2);
    }

    #[test]
    fn test_parse_report_calendar_multiget() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<C:calendar-multiget xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop><D:getetag/><C:calendar-data/></D:prop>
  <D:href>/dav/calendars/user@ex.com/cal/event1.ics</D:href>
  <D:href>/dav/calendars/user@ex.com/cal/event2.ics</D:href>
</C:calendar-multiget>"#;
        let report = parse_report(xml).unwrap();
        match report {
            ReportRequest::CalendarMultiget { hrefs } => {
                assert_eq!(hrefs.len(), 2);
                assert!(hrefs[0].contains("event1"));
            },
            _ => panic!("Expected CalendarMultiget"),
        }
    }

    #[test]
    fn test_parse_report_calendar_query_with_time_range() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop><D:getetag/><C:calendar-data/></D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT">
        <C:time-range start="20260101T000000Z" end="20260201T000000Z"/>
      </C:comp-filter>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>"#;
        let report = parse_report(xml).unwrap();
        match report {
            ReportRequest::CalendarQuery { time_range } => {
                let tr = time_range.unwrap();
                assert_eq!(tr.start, Some("20260101T000000Z".to_string()));
                assert_eq!(tr.end, Some("20260201T000000Z".to_string()));
            },
            _ => panic!("Expected CalendarQuery"),
        }
    }

    #[test]
    fn test_build_multistatus() {
        let responses = vec![MultistatusResponse {
            href: "/dav/calendars/user@ex.com/".to_string(),
            found_props: vec![("D:displayname".to_string(), "Work".to_string())],
            status: "HTTP/1.1 200 OK".to_string(),
        }];
        let xml = build_multistatus(&responses);
        assert!(xml.contains("<D:multistatus"));
        assert!(xml.contains("<D:href>/dav/calendars/user@ex.com/</D:href>"));
        assert!(xml.contains("Work"));
        assert!(xml.contains("</D:multistatus>"));
    }

    #[test]
    fn test_xml_escape() {
        assert_eq!(
            xml_escape("a<b>c&d\"e'f"),
            "a&lt;b&gt;c&amp;d&quot;e&apos;f"
        );
    }
}
