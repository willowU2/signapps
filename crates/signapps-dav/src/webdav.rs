//! WebDAV base protocol types.
//!
//! Defines the core request/response structures for WebDAV methods:
//! PROPFIND, PROPPATCH, MKCOL, PUT, DELETE, OPTIONS.

use serde::{Deserialize, Serialize};

/// WebDAV method variants.
///
/// # Examples
///
/// ```
/// use signapps_dav::webdav::DavMethod;
/// let m = DavMethod::Propfind;
/// assert_eq!(m.as_str(), "PROPFIND");
/// ```
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DavMethod {
    /// PROPFIND — retrieve properties of a resource.
    Propfind,
    /// PROPPATCH — modify properties on a resource.
    Proppatch,
    /// REPORT — CalDAV/CardDAV query and multiget.
    Report,
    /// PUT — create or replace a resource.
    Put,
    /// DELETE — remove a resource.
    Delete,
    /// MKCOL — create a collection (calendar/addressbook).
    Mkcol,
    /// OPTIONS — query supported methods and features.
    Options,
    /// GET — retrieve a resource's content.
    Get,
}

impl DavMethod {
    /// Return the HTTP method string.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_dav::webdav::DavMethod;
    /// assert_eq!(DavMethod::Report.as_str(), "REPORT");
    /// ```
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Propfind => "PROPFIND",
            Self::Proppatch => "PROPPATCH",
            Self::Report => "REPORT",
            Self::Put => "PUT",
            Self::Delete => "DELETE",
            Self::Mkcol => "MKCOL",
            Self::Options => "OPTIONS",
            Self::Get => "GET",
        }
    }

    /// Parse a DAV method from an HTTP method string.
    ///
    /// # Errors
    ///
    /// Returns `None` if the method string is not a recognized DAV method.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_dav::webdav::DavMethod;
    /// assert_eq!(DavMethod::parse_method("PROPFIND"), Some(DavMethod::Propfind));
    /// assert_eq!(DavMethod::parse_method("PATCH"), None);
    /// ```
    pub fn parse_method(s: &str) -> Option<Self> {
        match s.to_uppercase().as_str() {
            "PROPFIND" => Some(Self::Propfind),
            "PROPPATCH" => Some(Self::Proppatch),
            "REPORT" => Some(Self::Report),
            "PUT" => Some(Self::Put),
            "DELETE" => Some(Self::Delete),
            "MKCOL" => Some(Self::Mkcol),
            "OPTIONS" => Some(Self::Options),
            "GET" => Some(Self::Get),
            _ => None,
        }
    }
}

/// Incoming WebDAV request.
///
/// Represents a parsed WebDAV request with method, path, depth, body, and
/// conditional headers.
///
/// # Examples
///
/// ```
/// use signapps_dav::webdav::{DavRequest, DavMethod};
/// let req = DavRequest {
///     method: DavMethod::Propfind,
///     path: "/dav/calendars/user@example.com/".to_string(),
///     depth: 1,
///     body: None,
///     if_match: None,
/// };
/// assert_eq!(req.depth, 1);
/// ```
#[derive(Debug, Clone)]
pub struct DavRequest {
    /// The WebDAV method.
    pub method: DavMethod,
    /// Request path (e.g. `/dav/calendars/user@example.com/cal-id/`).
    pub path: String,
    /// Depth header: 0, 1, or 255 (infinity).
    pub depth: u8,
    /// Request body (XML for PROPFIND/PROPPATCH/REPORT, iCal/vCard for PUT).
    pub body: Option<String>,
    /// If-Match header value for conditional updates.
    pub if_match: Option<String>,
}

/// WebDAV response.
///
/// Wraps HTTP status, headers, and XML/iCal/vCard body for the response.
///
/// # Examples
///
/// ```
/// use signapps_dav::webdav::DavResponse;
/// let resp = DavResponse::new(207, "<multistatus/>".to_string());
/// assert_eq!(resp.status, 207);
/// ```
#[derive(Debug, Clone)]
pub struct DavResponse {
    /// HTTP status code.
    pub status: u16,
    /// Additional response headers.
    pub headers: Vec<(String, String)>,
    /// Response body.
    pub body: String,
}

impl DavResponse {
    /// Create a new DAV response with the given status and body.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_dav::webdav::DavResponse;
    /// let r = DavResponse::new(200, "OK".to_string());
    /// assert_eq!(r.status, 200);
    /// ```
    pub fn new(status: u16, body: String) -> Self {
        Self {
            status,
            headers: Vec::new(),
            body,
        }
    }

    /// Create a DAV response with additional headers.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_dav::webdav::DavResponse;
    /// let r = DavResponse::with_headers(
    ///     200,
    ///     "OK".to_string(),
    ///     vec![("ETag".to_string(), "\"abc\"".to_string())],
    /// );
    /// assert_eq!(r.headers.len(), 1);
    /// ```
    pub fn with_headers(status: u16, body: String, headers: Vec<(String, String)>) -> Self {
        Self {
            status,
            headers,
            body,
        }
    }

    /// Create a 207 Multi-Status response with XML body.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_dav::webdav::DavResponse;
    /// let r = DavResponse::multistatus("<multistatus/>".to_string());
    /// assert_eq!(r.status, 207);
    /// ```
    pub fn multistatus(xml_body: String) -> Self {
        Self {
            status: 207,
            headers: vec![("Content-Type".to_string(), "application/xml; charset=utf-8".to_string())],
            body: xml_body,
        }
    }

    /// Create a 404 Not Found response.
    pub fn not_found() -> Self {
        Self::new(404, String::new())
    }

    /// Create a 403 Forbidden response.
    pub fn forbidden() -> Self {
        Self::new(403, String::new())
    }

    /// Create a 401 Unauthorized response.
    pub fn unauthorized() -> Self {
        Self {
            status: 401,
            headers: vec![(
                "WWW-Authenticate".to_string(),
                "Basic realm=\"SignApps DAV\"".to_string(),
            )],
            body: String::new(),
        }
    }
}

/// Depth header values.
pub const DEPTH_ZERO: u8 = 0;
/// Depth 1 — immediate children.
pub const DEPTH_ONE: u8 = 1;
/// Depth infinity.
pub const DEPTH_INFINITY: u8 = 255;

/// Parse a Depth header string into a u8 value.
///
/// # Examples
///
/// ```
/// use signapps_dav::webdav::parse_depth;
/// assert_eq!(parse_depth(Some("0")), 0);
/// assert_eq!(parse_depth(Some("1")), 1);
/// assert_eq!(parse_depth(Some("infinity")), 255);
/// assert_eq!(parse_depth(None), 0);
/// ```
pub fn parse_depth(header: Option<&str>) -> u8 {
    match header {
        Some("0") => DEPTH_ZERO,
        Some("1") => DEPTH_ONE,
        Some("infinity") | Some("Infinity") => DEPTH_INFINITY,
        _ => DEPTH_ZERO,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dav_method_roundtrip() {
        let methods = [
            DavMethod::Propfind,
            DavMethod::Proppatch,
            DavMethod::Report,
            DavMethod::Put,
            DavMethod::Delete,
            DavMethod::Mkcol,
            DavMethod::Options,
            DavMethod::Get,
        ];
        for m in methods {
            assert_eq!(DavMethod::parse_method(m.as_str()), Some(m));
        }
    }

    #[test]
    fn test_parse_depth() {
        assert_eq!(parse_depth(Some("0")), 0);
        assert_eq!(parse_depth(Some("1")), 1);
        assert_eq!(parse_depth(Some("infinity")), 255);
        assert_eq!(parse_depth(Some("Infinity")), 255);
        assert_eq!(parse_depth(None), 0);
        assert_eq!(parse_depth(Some("invalid")), 0);
    }

    #[test]
    fn test_dav_response_multistatus() {
        let resp = DavResponse::multistatus("<ms/>".to_string());
        assert_eq!(resp.status, 207);
        assert!(resp.headers.iter().any(|(k, v)| k == "Content-Type" && v.contains("xml")));
    }

    #[test]
    fn test_dav_response_unauthorized() {
        let resp = DavResponse::unauthorized();
        assert_eq!(resp.status, 401);
        assert!(resp.headers.iter().any(|(k, _)| k == "WWW-Authenticate"));
    }
}
