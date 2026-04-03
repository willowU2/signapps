//! Pure WebDAV/CalDAV/CardDAV protocol library.
//!
//! Provides iCalendar (RFC 5545) and vCard (RFC 6350) parsing/building,
//! WebDAV XML request/response helpers, and CalDAV/CardDAV REPORT handling.
//!
//! This crate has **no I/O** — it only deals with protocol-level parsing and
//! serialization, leaving transport and storage to the consuming service.
//!
//! # Modules
//!
//! - [`webdav`] — WebDAV method types, request/response structs
//! - [`caldav`] — CalDAV REPORT builders (calendar-query, calendar-multiget)
//! - [`carddav`] — CardDAV REPORT builders (addressbook-query, addressbook-multiget)
//! - [`xml`] — DAV-specific XML request parsing and response generation
//! - [`ical`] — iCalendar (VCALENDAR/VEVENT/VTODO) parser and builder
//! - [`vcard`] — vCard parser and builder

#![warn(missing_docs)]

pub mod caldav;
pub mod carddav;
pub mod ical;
pub mod vcard;
pub mod webdav;
pub mod xml;

/// Errors produced by DAV protocol operations.
#[derive(Debug, thiserror::Error)]
pub enum DavError {
    /// XML parsing or generation failed.
    #[error("XML error: {0}")]
    Xml(String),

    /// iCalendar parsing failed.
    #[error("iCal parse error: {0}")]
    ICalParse(String),

    /// vCard parsing failed.
    #[error("vCard parse error: {0}")]
    VCardParse(String),

    /// Invalid DAV request.
    #[error("Invalid DAV request: {0}")]
    InvalidRequest(String),

    /// Unsupported DAV method or feature.
    #[error("Unsupported: {0}")]
    Unsupported(String),
}

/// Result type alias for DAV operations.
pub type DavResult<T> = Result<T, DavError>;
