//! macOS CoreAudio capture (stub).

use crate::{AudioBuffer, AudioCaptureBackend, AudioSource, CaptureConfig, CaptureError};

/// CoreAudio capture backend for macOS (stub).
pub struct CoreAudioCapture;

impl CoreAudioCapture {
    /// Create a new CoreAudio capture backend.
    ///
    /// # Errors
    ///
    /// Returns [`CaptureError`] if CoreAudio initialization fails.
    pub fn new() -> Result<Self, CaptureError> {
        Ok(Self)
    }
}

impl AudioCaptureBackend for CoreAudioCapture {
    fn list_sources(&self) -> Result<Vec<AudioSource>, CaptureError> {
        Ok(vec![])
    }

    fn start(&mut self, _config: CaptureConfig) -> Result<(), CaptureError> {
        Err(CaptureError::UnsupportedPlatform)
    }

    fn stop(&mut self) -> Result<AudioBuffer, CaptureError> {
        Err(CaptureError::UnsupportedPlatform)
    }

    fn is_recording(&self) -> bool {
        false
    }
}
