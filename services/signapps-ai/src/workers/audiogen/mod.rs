//! Audio generation worker implementations.
//!
//! - [`HttpAudioGen`] — calls a generic audio generation HTTP service
//!   (e.g. MusicGen or Stable Audio server).
//! - [`CloudAudioGen`] — calls the Replicate API for MusicGen / Stable Audio.
//! - [`NativeAudioGen`] — runs MusicGen-Large locally via candle
//!   (requires the `native-audiogen` feature).

pub mod cloud;
pub mod http;
#[cfg(feature = "native-audiogen")]
pub mod native;

pub use cloud::CloudAudioGen;
pub use http::HttpAudioGen;
#[cfg(feature = "native-audiogen")]
pub use native::NativeAudioGen;
