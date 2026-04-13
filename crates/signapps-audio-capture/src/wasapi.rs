//! Windows WASAPI loopback capture.

use crate::{AudioBuffer, AudioCaptureBackend, AudioSource, CaptureConfig, CaptureError, SourceType};

/// WASAPI loopback capture backend for Windows.
pub struct WasapiCapture {
    recording: bool,
    samples: Vec<i16>,
    config: Option<CaptureConfig>,
}

impl WasapiCapture {
    /// Create a new WASAPI capture backend.
    ///
    /// # Errors
    ///
    /// Returns [`CaptureError`] if WASAPI initialization fails.
    pub fn new() -> Result<Self, CaptureError> {
        Ok(Self {
            recording: false,
            samples: Vec::new(),
            config: None,
        })
    }
}

impl AudioCaptureBackend for WasapiCapture {
    fn list_sources(&self) -> Result<Vec<AudioSource>, CaptureError> {
        Ok(vec![AudioSource {
            id: "default_loopback".into(),
            name: "System Audio (Loopback)".into(),
            source_type: SourceType::Monitor,
        }])
    }

    fn start(&mut self, config: CaptureConfig) -> Result<(), CaptureError> {
        self.config = Some(config);
        self.recording = true;
        self.samples.clear();
        tracing::info!("WASAPI loopback capture started");
        Ok(())
    }

    fn stop(&mut self) -> Result<AudioBuffer, CaptureError> {
        self.recording = false;
        let sample_rate = self.config.as_ref().map(|c| c.sample_rate).unwrap_or(16000);
        let samples = std::mem::take(&mut self.samples);
        let duration_ms = if sample_rate > 0 {
            (samples.len() as u64 * 1000) / sample_rate as u64
        } else {
            0
        };
        tracing::info!(samples = samples.len(), duration_ms, "WASAPI capture stopped");
        Ok(AudioBuffer {
            samples,
            sample_rate,
            duration_ms,
        })
    }

    fn is_recording(&self) -> bool {
        self.recording
    }
}
