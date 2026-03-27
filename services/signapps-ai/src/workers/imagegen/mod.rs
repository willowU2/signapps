//! Image generation worker implementations.
//!
//! - [`HttpImageGen`] — calls a ComfyUI or Automatic1111/SDAPI-compatible endpoint.
//! - [`CloudImageGen`] — calls the OpenAI DALL-E API.
//! - [`NativeImageGen`] — native Stable Diffusion / FLUX inference via candle
//!   (behind the `native-imagegen` feature).

pub mod cloud;
pub mod http;
#[cfg(feature = "native-imagegen")]
pub mod native;

pub use cloud::CloudImageGen;
pub use http::HttpImageGen;
#[cfg(feature = "native-imagegen")]
#[allow(unused_imports)]
pub use native::NativeImageGen;
