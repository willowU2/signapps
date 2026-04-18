//! Unified document filter pipeline for SignApps Platform.
//!
//! Provides a two-stage pipeline for document import/export:
//! 1. `FormatDetector` identifies the input format from bytes
//! 2. `FilterRegistry` selects the appropriate `FilterTrait` implementation
//!
//! # Examples
//!
//! ```rust,ignore
//! let registry = FilterRegistry::default();
//! let format = FormatDetector::detect(&bytes, Some("report.docx"));
//! let doc = registry.import(format, &bytes)?;
//! let pdf = registry.export(&doc, Format::Pdf)?;
//! ```

pub mod detector;
pub mod error;
pub mod formats;
pub mod intermediate;
pub mod registry;
pub mod traits;

pub use detector::{Format, FormatDetector};
pub use error::{FilterError, FilterResult};
pub use intermediate::*;
pub use registry::FilterRegistry;
pub use traits::FilterTrait;
