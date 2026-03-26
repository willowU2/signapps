//! Audio generation worker implementations.
//!
//! - [`HttpAudioGen`] — calls a generic audio generation HTTP service
//!   (e.g. MusicGen or Stable Audio server).
//! - [`CloudAudioGen`] — calls the Replicate API for MusicGen / Stable Audio.

pub mod cloud;
pub mod http;

pub use cloud::CloudAudioGen;
pub use http::HttpAudioGen;
