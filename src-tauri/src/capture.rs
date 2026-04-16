//! Tauri commands for audio capture.

use signapps_audio_capture::{
    create_capture, AudioBuffer, AudioCaptureBackend, AudioSource, CaptureConfig,
};
use std::sync::Mutex;
use tauri::State;

/// Shared state for audio capture across Tauri commands.
pub struct CaptureState {
    /// The platform-specific capture backend (lazily initialized).
    pub backend: Mutex<Option<Box<dyn AudioCaptureBackend>>>,
    /// The last captured audio buffer, consumed by transcription.
    pub last_buffer: Mutex<Option<AudioBuffer>>,
}

impl Default for CaptureState {
    fn default() -> Self {
        Self {
            backend: Mutex::new(None),
            last_buffer: Mutex::new(None),
        }
    }
}

impl CaptureState {
    /// Create a new empty capture state.
    pub fn new() -> Self {
        Self::default()
    }
}

/// List available audio sources on this platform.
#[tauri::command]
pub fn list_audio_sources(state: State<'_, CaptureState>) -> Result<Vec<AudioSource>, String> {
    let mut backend_guard = state.backend.lock().map_err(|e| e.to_string())?;
    if backend_guard.is_none() {
        *backend_guard = Some(create_capture().map_err(|e| e.to_string())?);
    }
    backend_guard
        .as_ref()
        .expect("backend just initialized")
        .list_sources()
        .map_err(|e| e.to_string())
}

/// Start audio capture with the given configuration.
#[tauri::command]
pub fn start_capture(
    state: State<'_, CaptureState>,
    capture_mic: bool,
    capture_system: bool,
    source_filter: Option<String>,
) -> Result<(), String> {
    let mut backend_guard = state.backend.lock().map_err(|e| e.to_string())?;
    if backend_guard.is_none() {
        *backend_guard = Some(create_capture().map_err(|e| e.to_string())?);
    }
    let config = CaptureConfig {
        capture_mic,
        capture_system,
        source_filter,
        ..Default::default()
    };
    backend_guard
        .as_mut()
        .expect("backend just initialized")
        .start(config)
        .map_err(|e| e.to_string())
}

/// Stop audio capture and return the duration in milliseconds.
///
/// The captured buffer is stored internally and consumed by
/// [`transcribe_captured_audio`](crate::transcribe::transcribe_captured_audio).
#[tauri::command]
pub fn stop_capture(state: State<'_, CaptureState>) -> Result<u64, String> {
    let mut backend_guard = state.backend.lock().map_err(|e| e.to_string())?;
    let backend = backend_guard.as_mut().ok_or("no capture backend")?;
    let buffer = backend.stop().map_err(|e| e.to_string())?;
    let duration_ms = buffer.duration_ms;
    *state.last_buffer.lock().map_err(|e| e.to_string())? = Some(buffer);
    Ok(duration_ms)
}
