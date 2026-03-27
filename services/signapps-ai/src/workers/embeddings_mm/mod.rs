//! Multimodal embeddings worker implementations.
//!
//! - [`HttpMultimodalEmbed`] — calls a CLIP/SigLIP HTTP service (TEI-compatible).
//! - [`CloudMultimodalEmbed`] — calls the OpenAI embeddings API.
//! - [`NativeSigLIP`] — runs SigLIP locally via ONNX Runtime (feature `native-embedmm`).

pub mod cloud;
pub mod http;
#[cfg(feature = "native-embedmm")]
pub mod native;

pub use cloud::CloudMultimodalEmbed;
pub use http::HttpMultimodalEmbed;
#[cfg(feature = "native-embedmm")]
#[allow(unused_imports)]
pub use native::NativeSigLIP;
