//! Vision worker implementations.
//!
//! - [`HttpVision`] — calls a vLLM/Ollama multimodal endpoint (OpenAI-compatible).
//! - [`CloudVision`] — calls the OpenAI GPT-4o Vision API.
//! - [`NativeVision`] — runs multimodal GGUF models locally via llama.cpp
//!   (requires the `native-vision` feature).

pub mod cloud;
pub mod http;
#[cfg(feature = "native-vision")]
pub mod native;

pub use cloud::CloudVision;
pub use http::HttpVision;
#[cfg(feature = "native-vision")]
pub use native::NativeVision;
