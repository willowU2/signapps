//! Vision worker implementations.
//!
//! - [`HttpVision`] — calls a vLLM/Ollama multimodal endpoint (OpenAI-compatible).
//! - [`CloudVision`] — calls the OpenAI GPT-4o Vision API.

pub mod cloud;
pub mod http;

pub use cloud::CloudVision;
pub use http::HttpVision;
