//! Cross-platform audio capture for meeting transcription.
//!
//! Provides a unified [`AudioCaptureBackend`] trait with per-OS implementations:
//! WASAPI loopback (Windows), CoreAudio (macOS), PulseAudio (Linux).

pub mod vad;

#[cfg(target_os = "macos")]
pub mod coreaudio;
#[cfg(target_os = "linux")]
pub mod pulseaudio;
#[cfg(target_os = "windows")]
pub mod wasapi;

use thiserror::Error;

/// Audio capture errors.
#[derive(Debug, Error)]
pub enum CaptureError {
    /// No audio device found.
    #[error("no audio device found: {0}")]
    NoDevice(String),
    /// Capture operation failed.
    #[error("capture failed: {0}")]
    CaptureFailed(String),
    /// The current platform is not supported.
    #[error("unsupported platform")]
    UnsupportedPlatform,
}

/// Configuration for audio capture.
#[derive(Debug, Clone)]
pub struct CaptureConfig {
    /// Sample rate in Hz (default: 16000).
    pub sample_rate: u32,
    /// Number of audio channels (default: 1 for mono).
    pub channels: u16,
    /// Whether to capture microphone input.
    pub capture_mic: bool,
    /// Whether to capture system/loopback audio.
    pub capture_system: bool,
    /// Optional filter to select a specific audio source by name.
    pub source_filter: Option<String>,
    /// Seconds of silence before auto-stopping capture.
    pub silence_timeout_secs: u64,
}

impl Default for CaptureConfig {
    fn default() -> Self {
        Self {
            sample_rate: 16000,
            channels: 1,
            capture_mic: true,
            capture_system: true,
            source_filter: None,
            silence_timeout_secs: 120,
        }
    }
}

/// A detected audio source.
#[derive(Debug, Clone, serde::Serialize)]
pub struct AudioSource {
    /// Unique identifier for the source.
    pub id: String,
    /// Human-readable name.
    pub name: String,
    /// Type of audio source.
    pub source_type: SourceType,
}

/// Type of audio source.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "snake_case")]
pub enum SourceType {
    /// Application-level audio source.
    App,
    /// Hardware audio device.
    Device,
    /// Monitor/loopback source.
    Monitor,
}

/// Captured audio buffer.
pub struct AudioBuffer {
    /// PCM samples, mono, 16-bit signed, at `sample_rate`.
    pub samples: Vec<i16>,
    /// Sample rate in Hz.
    pub sample_rate: u32,
    /// Duration in milliseconds.
    pub duration_ms: u64,
}

impl AudioBuffer {
    /// Convert to WAV bytes for Whisper ingestion.
    ///
    /// Produces a valid WAV file (RIFF header + PCM data) suitable for
    /// speech-to-text pipelines.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_audio_capture::AudioBuffer;
    ///
    /// let buf = AudioBuffer {
    ///     samples: vec![0i16; 16000],
    ///     sample_rate: 16000,
    ///     duration_ms: 1000,
    /// };
    /// let wav = buf.to_wav_bytes();
    /// assert_eq!(&wav[..4], b"RIFF");
    /// ```
    pub fn to_wav_bytes(&self) -> Vec<u8> {
        let data_len = (self.samples.len() * 2) as u32;
        let file_len = 36 + data_len;
        let mut buf = Vec::with_capacity(file_len as usize + 8);
        // RIFF header
        buf.extend_from_slice(b"RIFF");
        buf.extend_from_slice(&file_len.to_le_bytes());
        buf.extend_from_slice(b"WAVE");
        // fmt chunk
        buf.extend_from_slice(b"fmt ");
        buf.extend_from_slice(&16u32.to_le_bytes());
        buf.extend_from_slice(&1u16.to_le_bytes()); // PCM
        buf.extend_from_slice(&1u16.to_le_bytes()); // mono
        buf.extend_from_slice(&self.sample_rate.to_le_bytes());
        buf.extend_from_slice(&(self.sample_rate * 2).to_le_bytes());
        buf.extend_from_slice(&2u16.to_le_bytes());
        buf.extend_from_slice(&16u16.to_le_bytes());
        // data chunk
        buf.extend_from_slice(b"data");
        buf.extend_from_slice(&data_len.to_le_bytes());
        for s in &self.samples {
            buf.extend_from_slice(&s.to_le_bytes());
        }
        buf
    }
}

/// Create the platform-appropriate audio capture backend.
///
/// # Errors
///
/// Returns [`CaptureError::UnsupportedPlatform`] on unsupported operating systems.
/// Returns [`CaptureError::NoDevice`] if the platform backend cannot initialize.
pub fn create_capture() -> Result<Box<dyn AudioCaptureBackend>, CaptureError> {
    #[cfg(target_os = "windows")]
    {
        Ok(Box::new(wasapi::WasapiCapture::new()?))
    }

    #[cfg(target_os = "macos")]
    {
        return Ok(Box::new(coreaudio::CoreAudioCapture::new()?));
    }

    #[cfg(target_os = "linux")]
    {
        return Ok(Box::new(pulseaudio::PulseAudioCapture::new()?));
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Err(CaptureError::UnsupportedPlatform)
    }
}

/// Platform audio capture backend.
///
/// Implementations provide audio source enumeration, recording start/stop,
/// and recording state queries.
pub trait AudioCaptureBackend: Send {
    /// List available audio sources on this platform.
    ///
    /// # Errors
    ///
    /// Returns [`CaptureError`] if source enumeration fails.
    fn list_sources(&self) -> Result<Vec<AudioSource>, CaptureError>;

    /// Start recording audio with the given configuration.
    ///
    /// # Errors
    ///
    /// Returns [`CaptureError`] if the capture cannot be started.
    fn start(&mut self, config: CaptureConfig) -> Result<(), CaptureError>;

    /// Stop recording and return the captured audio buffer.
    ///
    /// # Errors
    ///
    /// Returns [`CaptureError`] if the capture cannot be stopped cleanly.
    fn stop(&mut self) -> Result<AudioBuffer, CaptureError>;

    /// Returns `true` if currently recording.
    fn is_recording(&self) -> bool;
}
