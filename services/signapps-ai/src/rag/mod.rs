//! RAG (Retrieval-Augmented Generation) pipeline.

pub mod chunker;
pub mod pipeline;

#[cfg(test)]
mod pipeline_tests;

pub use pipeline::RagPipeline;
