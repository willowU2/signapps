//! Reranker worker implementations.
//!
//! - [`HttpReranker`] — calls a TEI-compatible `/rerank` endpoint.
//! - [`CloudReranker`] — calls the Cohere Rerank API.
//! - [`NativeReranker`] — runs bge-reranker locally via ONNX Runtime
//!   (requires the `native-reranker` feature).

pub mod cloud;
pub mod http;
#[cfg(feature = "native-reranker")]
pub mod native;

pub use cloud::CloudReranker;
pub use http::HttpReranker;
#[cfg(feature = "native-reranker")]
pub use native::NativeReranker;
