//! Linux PulseAudio monitor capture (stub).

use crate::{AudioBuffer, AudioCaptureBackend, AudioSource, CaptureConfig, CaptureError};

/// PulseAudio capture backend for Linux (stub).
pub struct PulseAudioCapture;

impl PulseAudioCapture {
    /// Create a new PulseAudio capture backend.
    ///
    /// # Errors
    ///
    /// Returns [`CaptureError`] if PulseAudio initialization fails.
    pub fn new() -> Result<Self, CaptureError> {
        Ok(Self)
    }
}

impl AudioCaptureBackend for PulseAudioCapture {
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
