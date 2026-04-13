//! Transcription core types and pipeline trait for SignApps.
//!
//! Shared between server-side (MeetPipeline) and desktop (CapturePipeline).

pub mod pipeline;
pub mod tiptap;
pub mod types;

pub use pipeline::{AudioInput, TranscriptionError};
pub use types::{Segment, SessionMeta, Speaker, TranscriptionResult, TranscriptionSource};
