//! Video generation worker implementations.
//!
//! - [`HttpVideoGen`] — calls a generic video generation HTTP service
//!   (e.g. CogVideoX server).
//! - [`CloudVideoGen`] — calls the Replicate API for video generation
//!   models (Runway, CogVideoX, minimax, etc.).

pub mod cloud;
pub mod http;

pub use cloud::CloudVideoGen;
pub use http::HttpVideoGen;
