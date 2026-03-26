//! Document parse worker implementations.
//!
//! - [`NativeDocParse`] — uses existing OCR infrastructure (ocrs) for basic
//!   document text extraction.
//! - [`CloudDocParse`] — calls Azure Document Intelligence API for
//!   high-fidelity document parsing with table extraction.

pub mod cloud;
pub mod native;

pub use cloud::CloudDocParse;
pub use native::NativeDocParse;
