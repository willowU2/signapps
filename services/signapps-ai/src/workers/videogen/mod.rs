//! Video generation worker implementations.
//!
//! - [`HttpVideoGen`] — calls a generic video generation HTTP service
//!   (e.g. CogVideoX server).
//! - [`CloudVideoGen`] — calls the Replicate API for video generation
//!   models (Runway, CogVideoX, minimax, etc.).
//! - [`NativeVideoGen`] — runs CogVideoX-5B locally via candle
//!   (requires the `native-videogen` feature).

pub mod cloud;
pub mod http;
#[cfg(feature = "native-videogen")]
pub mod native;

pub use cloud::CloudVideoGen;
pub use http::HttpVideoGen;
#[cfg(feature = "native-videogen")]
pub use native::NativeVideoGen;
