//! Transcription pipeline trait.

/// Errors that can occur during transcription.
#[derive(Debug, thiserror::Error)]
pub enum TranscriptionError {
    #[error("audio fetch failed: {0}")]
    AudioFetch(String),
    #[error("STT engine failed: {0}")]
    Stt(String),
    #[error("diarization failed: {0}")]
    Diarization(String),
    #[error("document creation failed: {0}")]
    DocCreation(String),
    #[error("{0}")]
    Internal(String),
}

/// Input audio for transcription.
pub struct AudioInput {
    /// Raw PCM or encoded audio bytes.
    pub data: Vec<u8>,
    /// Original filename or identifier.
    pub filename: String,
    /// MIME type if known.
    pub content_type: Option<String>,
}
