#![warn(missing_docs)]

//! # SignApps JMAP
//!
//! Pure-library crate implementing JMAP (JSON Meta Application Protocol) core
//! types as defined in RFC 8620 and RFC 8621.
//!
//! This crate provides the protocol envelope types (request, response, method
//! call), session resource, and standard error types. It contains no I/O, no
//! network code, and no database access — all of that lives in the consuming
//! service (`signapps-mail`).
//!
//! ## Modules
//!
//! - [`types`] — Core request/response envelope types and method call tuples
//! - [`session`] — JMAP Session resource (capabilities, accounts, URLs)
//! - [`error`] — JMAP error types (method-level and request-level)
//!
//! ## Quick Start
//!
//! ```rust
//! use signapps_jmap::types::{JmapRequest, JmapResponse, MethodCall, MethodResponse};
//! use signapps_jmap::session::JmapSession;
//!
//! // Parse a JMAP request
//! let json = r#"{
//!     "using": ["urn:ietf:params:jmap:core", "urn:ietf:params:jmap:mail"],
//!     "methodCalls": [["Email/get", {"accountId": "u1", "ids": ["m1"]}, "c0"]]
//! }"#;
//! let request: JmapRequest = serde_json::from_str(json).unwrap();
//! assert_eq!(request.method_calls[0].name, "Email/get");
//!
//! // Build a session resource
//! let session = JmapSession::new("user@example.com".into(), "https://jmap.example.com".into());
//! assert!(session.capabilities.contains_key("urn:ietf:params:jmap:core"));
//! ```
//!
//! ## Standards
//!
//! - RFC 8620 — The JSON Meta Application Protocol (JMAP)
//! - RFC 8621 — The JSON Meta Application Protocol (JMAP) for Mail

pub mod error;
pub mod session;
pub mod types;

// Re-export commonly used types at crate root for convenience.
pub use error::MethodError;
pub use session::{JmapAccount, JmapSession};
pub use types::{
    ChangesRequest, ChangesResponse, GetRequest, GetResponse, JmapRequest, JmapResponse,
    MethodCall, MethodResponse, QueryRequest, QueryResponse, SetRequest, SetResponse,
};
