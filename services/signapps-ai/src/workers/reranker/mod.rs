//! Reranker worker implementations.
//!
//! - [`HttpReranker`] — calls a TEI-compatible `/rerank` endpoint.
//! - [`CloudReranker`] — calls the Cohere Rerank API.

pub mod cloud;
pub mod http;

pub use cloud::CloudReranker;
pub use http::HttpReranker;
