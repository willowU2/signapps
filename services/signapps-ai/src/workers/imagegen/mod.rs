//! Image generation worker implementations.
//!
//! - [`HttpImageGen`] — calls a ComfyUI or Automatic1111/SDAPI-compatible endpoint.
//! - [`CloudImageGen`] — calls the OpenAI DALL-E API.

pub mod cloud;
pub mod http;

pub use cloud::CloudImageGen;
pub use http::HttpImageGen;
