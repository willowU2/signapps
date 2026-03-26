//! Multimodal embeddings worker implementations.
//!
//! - [`HttpMultimodalEmbed`] — calls a CLIP/SigLIP HTTP service (TEI-compatible).
//! - [`CloudMultimodalEmbed`] — calls the OpenAI embeddings API.

pub mod cloud;
pub mod http;

pub use cloud::CloudMultimodalEmbed;
pub use http::HttpMultimodalEmbed;
