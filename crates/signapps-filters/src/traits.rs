//! Core filter trait -- every format implements this.

use crate::error::FilterResult;
use crate::intermediate::IntermediateDocument;

/// A bidirectional document filter (import and/or export).
///
/// Not all filters support both directions. A filter that only exports
/// returns `Err(FilterError::UnsupportedFormat(...))` from `import`.
pub trait FilterTrait: Send + Sync {
    /// Human-readable filter name (e.g. "DOCX Filter").
    fn name(&self) -> &str;

    /// MIME types this filter handles.
    fn mime_types(&self) -> &[&str];

    /// File extensions this filter handles (without dot).
    fn extensions(&self) -> &[&str];

    /// Import bytes into an IntermediateDocument.
    fn import(&self, bytes: &[u8]) -> FilterResult<IntermediateDocument>;

    /// Export an IntermediateDocument to bytes.
    fn export(&self, doc: &IntermediateDocument) -> FilterResult<Vec<u8>>;

    /// Whether this filter supports import.
    fn can_import(&self) -> bool {
        true
    }

    /// Whether this filter supports export.
    fn can_export(&self) -> bool {
        true
    }

    /// Output MIME type when exporting.
    fn export_mime_type(&self) -> &str;

    /// Output file extension when exporting (without dot).
    fn export_extension(&self) -> &str;
}
