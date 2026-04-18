//! Filter registry -- maps formats to their filter implementations.

use std::collections::HashMap;

use crate::detector::Format;
use crate::error::{FilterError, FilterResult};
use crate::intermediate::IntermediateDocument;
use crate::traits::FilterTrait;

/// Central registry of all available filters.
pub struct FilterRegistry {
    filters: HashMap<Format, Box<dyn FilterTrait>>,
}

impl FilterRegistry {
    /// Create an empty registry.
    pub fn new() -> Self {
        Self {
            filters: HashMap::new(),
        }
    }

    /// Register a filter for a format.
    pub fn register(&mut self, format: Format, filter: Box<dyn FilterTrait>) {
        self.filters.insert(format, filter);
    }

    /// Import bytes in the given format into an IntermediateDocument.
    ///
    /// # Errors
    ///
    /// Returns `FilterError::UnsupportedFormat` if no filter is registered
    /// for the given format or if the filter does not support import.
    pub fn import(&self, format: Format, bytes: &[u8]) -> FilterResult<IntermediateDocument> {
        let filter = self
            .filters
            .get(&format)
            .ok_or_else(|| FilterError::UnsupportedFormat(format!("{format:?}")))?;

        if !filter.can_import() {
            return Err(FilterError::UnsupportedFormat(format!(
                "{:?} filter does not support import",
                format
            )));
        }

        tracing::info!(format = ?format, filter = filter.name(), "importing document");
        filter.import(bytes)
    }

    /// Export an IntermediateDocument to bytes in the given format.
    ///
    /// # Errors
    ///
    /// Returns `FilterError::UnsupportedFormat` if no filter is registered
    /// for the given format or if the filter does not support export.
    pub fn export(&self, doc: &IntermediateDocument, format: Format) -> FilterResult<Vec<u8>> {
        let filter = self
            .filters
            .get(&format)
            .ok_or_else(|| FilterError::UnsupportedFormat(format!("{format:?}")))?;

        if !filter.can_export() {
            return Err(FilterError::UnsupportedFormat(format!(
                "{:?} filter does not support export",
                format
            )));
        }

        tracing::info!(format = ?format, filter = filter.name(), "exporting document");
        filter.export(doc)
    }

    /// Get the MIME type for a format's export output.
    pub fn export_mime_type(&self, format: Format) -> Option<&str> {
        self.filters.get(&format).map(|f| f.export_mime_type())
    }

    /// Get the file extension for a format's export output.
    pub fn export_extension(&self, format: Format) -> Option<&str> {
        self.filters.get(&format).map(|f| f.export_extension())
    }

    /// List all registered formats.
    pub fn supported_formats(&self) -> Vec<Format> {
        self.filters.keys().copied().collect()
    }
}

impl Default for FilterRegistry {
    fn default() -> Self {
        // Returns empty for now -- filters will be registered in Task 4+5
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_registry_returns_unsupported() {
        let registry = FilterRegistry::default();
        let result = registry.import(Format::Docx, b"data");
        assert!(result.is_err());
    }

    #[test]
    fn supported_formats_empty_by_default() {
        let registry = FilterRegistry::default();
        assert!(registry.supported_formats().is_empty());
    }
}
