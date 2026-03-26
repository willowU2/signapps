//! RAG (Retrieval-Augmented Generation) pipeline.

pub mod chunker;
#[allow(unused)]
pub mod multimodal_indexer;
pub mod pipeline;

#[cfg(test)]
mod pipeline_tests;

#[allow(unused_imports)]
pub use multimodal_indexer::MultimodalIndexer;
pub use pipeline::RagPipeline;
