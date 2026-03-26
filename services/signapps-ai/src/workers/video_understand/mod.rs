//! Video understanding worker implementations.
//!
//! - [`HttpVideoUnderstand`] — calls a generic video analysis HTTP service.
//! - [`CloudVideoUnderstand`] — calls the Google Gemini API for native video
//!   understanding.

pub mod cloud;
pub mod http;

pub use cloud::CloudVideoUnderstand;
pub use http::HttpVideoUnderstand;
