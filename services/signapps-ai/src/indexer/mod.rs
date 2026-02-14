//! Document indexing pipeline.
//!
//! Orchestrates: file retrieval → OCR (if needed) → chunking → embedding → pgvector storage.

pub mod pipeline;

pub use pipeline::IndexPipeline;
