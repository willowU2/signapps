//! RAG (Retrieval-Augmented Generation) pipeline.

pub mod chunker;
pub mod pipeline;

pub use chunker::TextChunker;
pub use pipeline::RagPipeline;
