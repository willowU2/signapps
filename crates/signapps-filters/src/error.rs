//! Filter pipeline error types.

use thiserror::Error;

/// Errors produced by the filter pipeline.
#[derive(Error, Debug)]
pub enum FilterError {
    /// Format could not be detected from the input bytes.
    #[error("unable to detect format: {0}")]
    UnknownFormat(String),

    /// No filter registered for the requested format.
    #[error("no filter available for format: {0}")]
    UnsupportedFormat(String),

    /// Import failed.
    #[error("import failed: {0}")]
    ImportFailed(String),

    /// Export failed.
    #[error("export failed: {0}")]
    ExportFailed(String),

    /// I/O error during filter processing.
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    /// JSON serialization/deserialization error.
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),

    /// ZIP archive error (for OOXML formats).
    #[error("zip error: {0}")]
    Zip(#[from] zip::result::ZipError),
}

/// Convenience alias.
pub type FilterResult<T> = std::result::Result<T, FilterError>;
