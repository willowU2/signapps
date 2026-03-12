//! PDF operations module.

mod operations;

pub use operations::*;

use thiserror::Error;

/// PDF operation errors
#[derive(Debug, Error)]
pub enum PdfError {
    #[error("Invalid input: {0}")]
    InvalidInput(String),

    #[error("Operation failed: {0}")]
    OperationFailed(String),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("PDF parsing error: {0}")]
    ParseError(String),
}
