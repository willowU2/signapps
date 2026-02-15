//! Native TTS backend using piper-rs (ONNX Piper voices).

use async_trait::async_trait;
use bytes::Bytes;
use futures::Stream;
use signapps_runtime::ModelManager;
use std::collections::HashMap;
use std::pin::Pin;
use std::sync::Arc;
use tokio::sync::RwLock;

use super::*;

/// Native TTS backend using Piper ONNX voices.
pub struct NativeTtsBackend {
    voices: Arc<RwLock<HashMap<String, LoadedVoice>>>,
    default_voice: String,
    model_manager: Arc<ModelManager>,
}

struct LoadedVoice {
    synth: piper_rs::PiperSynthesizer,
    info: Voice,
}

// Safety: PiperSynthesizer uses ONNX runtime which is thread-safe
unsafe impl Send for LoadedVoice {}
unsafe impl Sync for LoadedVoice {}

impl NativeTtsBackend {
    /// Create a new native TTS backend.
    pub async fn new(
        default_voice: &str,
        model_manager: Arc<ModelManager>,
    ) -> Result<Self, TtsError> {
        let backend = Self {
            voices: Arc::new(RwLock::new(HashMap::new())),
            default_voice: default_voice.to_string(),
            model_manager,
        };

        // Pre-load the default voice
        backend.ensure_voice(default_voice).await?;

        Ok(backend)
    }

    /// Ensure a voice is loaded, downloading if necessary.
    async fn ensure_voice(&self, voice_id: &str) -> Result<(), TtsError> {
        // Check if already loaded
        {
            let voices = self.voices.read().await;
            if voices.contains_key(voice_id) {
                return Ok(());
            }
        }

        // Map voice_id to model IDs
        let model_id = format!("piper-{}", voice_id.replace('_', "-").replace('/', "-"));
        let config_id = format!("{}-config", model_id);

        // Download model and config
        let model_path = self
            .model_manager
            .ensure_model(&model_id)
            .await
            .map_err(|e| TtsError::ModelError(format!("Model download failed: {}", e)))?;

        let config_path = self
            .model_manager
            .ensure_model(&config_id)
            .await
            .map_err(|e| TtsError::ModelError(format!("Config download failed: {}", e)))?;

        tracing::info!(
            "Loading Piper voice '{}' from {}",
            voice_id,
            model_path.display()
        );

        let voice_id_owned = voice_id.to_string();
        let model_path_str = model_path.to_string_lossy().to_string();
        let config_path_str = config_path.to_string_lossy().to_string();

        let (synth, sample_rate) = tokio::task::spawn_blocking(move || {
            let config = piper_rs::PiperConfig::load(&config_path_str)
                .map_err(|e| TtsError::ModelError(format!("Config load failed: {}", e)))?;

            let sample_rate = config.audio.sample_rate as u32;

            let synth = piper_rs::PiperSynthesizer::new(&model_path_str, &config)
                .map_err(|e| TtsError::ModelError(format!("Voice load failed: {}", e)))?;

            Ok::<_, TtsError>((synth, sample_rate))
        })
        .await
        .map_err(|e| TtsError::ServiceError(format!("Task join error: {}", e)))??;

        let voice_info = find_voice_info(&voice_id_owned, sample_rate);

        let mut voices = self.voices.write().await;
        voices.insert(
            voice_id_owned.clone(),
            LoadedVoice {
                synth,
                info: voice_info,
            },
        );

        tracing::info!("Piper voice '{}' loaded successfully", voice_id_owned);
        Ok(())
    }
}

#[async_trait]
impl TtsBackend for NativeTtsBackend {
    async fn synthesize(&self, request: TtsRequest) -> Result<TtsResult, TtsError> {
        let voice_id = request.voice.as_deref().unwrap_or(&self.default_voice);
        self.ensure_voice(voice_id).await?;

        let voice_id_owned = voice_id.to_string();
        let text = request.text.clone();
        let voices = self.voices.clone();

        let (audio_data, sample_rate) = tokio::task::spawn_blocking(move || {
            let voices_guard = voices.blocking_read();
            let voice = voices_guard
                .get(&voice_id_owned)
                .ok_or_else(|| TtsError::VoiceNotFound(voice_id_owned.clone()))?;

            let samples = voice
                .synth
                .synthesize(&text)
                .map_err(|e| TtsError::ServiceError(format!("Synthesis failed: {}", e)))?;

            let wav_data = crate::audio::encode_wav(&samples, voice.info.sample_rate, 1)
                .map_err(|e| TtsError::ServiceError(format!("WAV encoding failed: {}", e)))?;

            Ok::<_, TtsError>((wav_data, voice.info.sample_rate))
        })
        .await
        .map_err(|e| TtsError::ServiceError(format!("Task join error: {}", e)))??;

        let duration_ms = 0; // Could compute from samples/sample_rate

        Ok(TtsResult {
            audio_data,
            format: AudioFormat::Wav,
            sample_rate,
            duration_ms,
            voice_used: voice_id.to_string(),
        })
    }

    async fn synthesize_stream(
        &self,
        request: TtsRequest,
    ) -> Result<Pin<Box<dyn Stream<Item = Result<Bytes, TtsError>> + Send>>, TtsError> {
        // For native Piper, synthesize the whole text and return as single chunk
        let result = self.synthesize(request).await?;
        let stream = futures::stream::once(async move { Ok(Bytes::from(result.audio_data)) });
        Ok(Box::pin(stream))
    }

    async fn list_voices(&self) -> Result<Vec<Voice>, TtsError> {
        let loaded: Vec<Voice> = {
            let voices = self.voices.read().await;
            voices.values().map(|v| v.info.clone()).collect()
        };

        if loaded.is_empty() {
            Ok(default_piper_voices())
        } else {
            Ok(loaded)
        }
    }
}

fn find_voice_info(voice_id: &str, sample_rate: u32) -> Voice {
    // Try to match from known voices
    for voice in default_piper_voices() {
        if voice.id == voice_id {
            return Voice {
                sample_rate,
                ..voice
            };
        }
    }

    // Generate info from voice_id pattern: lang_REGION-name-quality
    let parts: Vec<&str> = voice_id.split('-').collect();
    let (language_code, name, quality) = match parts.len() {
        3 => (
            parts[0].to_string(),
            parts[1].to_string(),
            parts[2].to_string(),
        ),
        _ => (
            "unknown".to_string(),
            voice_id.to_string(),
            "medium".to_string(),
        ),
    };

    Voice {
        id: voice_id.to_string(),
        name: name.clone(),
        language: language_code.clone(),
        language_code,
        gender: None,
        quality: match quality.as_str() {
            "low" => VoiceQuality::Low,
            "high" => VoiceQuality::High,
            _ => VoiceQuality::Medium,
        },
        sample_rate,
    }
}
