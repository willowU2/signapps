//! Native STT backend using whisper-rs (whisper.cpp bindings).

use async_trait::async_trait;
use bytes::Bytes;
use futures::Stream;
use signapps_runtime::{HardwareProfile, ModelManager};
use std::pin::Pin;
use std::sync::Arc;
use tokio::sync::Mutex;
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

use super::*;

/// Native STT backend using whisper.cpp.
///
/// NOTE: WhisperContext is wrapped in `Mutex` because `WhisperState` (created
/// from `WhisperContext::create_state()`) is not `Send`/`Sync`, so the context
/// must be held locked for the entire duration of a transcription. This
/// effectively serializes all transcription requests.
///
/// A `Semaphore` is used to limit the number of queued transcriptions so that
/// callers get back-pressure rather than unbounded queueing.
///
/// For higher throughput, consider creating a pool of N `WhisperContext`
/// instances (one per CPU core) and dispatching requests round-robin.
pub struct NativeSttBackend {
    context: Arc<Mutex<WhisperContext>>,
    /// Semaphore to limit how many transcription requests can queue up
    /// concurrently. This prevents unbounded task accumulation when the
    /// single-threaded whisper context is busy.
    transcription_semaphore: Arc<tokio::sync::Semaphore>,
    model_name: String,
    #[allow(dead_code)]
    model_manager: Arc<ModelManager>,
}

impl NativeSttBackend {
    /// Create a new native STT backend.
    pub async fn new(
        model_name: &str,
        model_manager: Arc<ModelManager>,
        hardware: &HardwareProfile,
    ) -> Result<Self, SttError> {
        let model_id = format!("whisper-{}", model_name);

        let model_path = model_manager
            .ensure_model(&model_id)
            .await
            .map_err(|e| SttError::ModelError(format!("Failed to load model: {}", e)))?;

        tracing::info!(
            "Loading Whisper model '{}' from {} (backend: {})",
            model_name,
            model_path.display(),
            hardware.preferred_backend
        );

        let model_path_str = model_path.to_string_lossy().to_string();
        let context = tokio::task::spawn_blocking(move || {
            let params = WhisperContextParameters::default();
            WhisperContext::new_with_params(&model_path_str, params)
                .map_err(|e| SttError::ModelError(format!("Failed to create context: {}", e)))
        })
        .await
        .map_err(|e| SttError::ServiceError(format!("Task join error: {}", e)))??;

        tracing::info!("Whisper model '{}' loaded successfully", model_name);

        // Allow up to 4 transcription requests to queue up. Additional
        // requests will wait at the semaphore, providing back-pressure
        // rather than accumulating unbounded tasks.
        let max_queued = std::env::var("STT_MAX_CONCURRENT")
            .ok()
            .and_then(|v| v.parse::<usize>().ok())
            .unwrap_or(4);

        Ok(Self {
            context: Arc::new(Mutex::new(context)),
            transcription_semaphore: Arc::new(tokio::sync::Semaphore::new(max_queued)),
            model_name: model_name.to_string(),
            model_manager,
        })
    }
}

#[async_trait]
impl SttBackend for NativeSttBackend {
    async fn transcribe(
        &self,
        audio: Bytes,
        filename: &str,
        opts: Option<TranscribeRequest>,
    ) -> Result<TranscribeResult, SttError> {
        // Acquire a semaphore permit to limit queued transcription requests.
        // This provides back-pressure instead of letting tasks pile up
        // unboundedly behind the Mutex-serialized WhisperContext.
        let _permit = self
            .transcription_semaphore
            .acquire()
            .await
            .map_err(|_| SttError::ServiceError("Transcription semaphore closed".to_string()))?;

        let start = std::time::Instant::now();
        let opts = opts.unwrap_or_default();

        // Decode audio to PCM f32 16kHz mono
        let mime_type = mime_guess::from_path(filename)
            .first_or_octet_stream()
            .to_string();

        let audio_data = audio.to_vec();
        let pcm_samples = tokio::task::spawn_blocking(move || {
            crate::audio::decode_to_pcm_f32(&audio_data, &mime_type)
        })
        .await
        .map_err(|e| SttError::ServiceError(format!("Task join error: {}", e)))?
        .map_err(|e| SttError::UnsupportedFormat(e.to_string()))?;

        let duration_seconds = pcm_samples.len() as f32 / 16000.0;

        // Run whisper inference
        let context = self.context.clone();
        let language = opts.language.clone();
        let language_out = language.clone();
        let translate = matches!(opts.task, Some(TranscribeTask::Translate));

        let segments = tokio::task::spawn_blocking(move || {
            let ctx = context.blocking_lock();
            let mut state = ctx
                .create_state()
                .map_err(|e| SttError::ServiceError(format!("State creation failed: {}", e)))?;

            let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });

            if let Some(ref lang) = language {
                params.set_language(Some(lang));
            }
            params.set_translate(translate);
            params.set_print_special(false);
            params.set_print_progress(false);
            params.set_print_realtime(false);
            params.set_print_timestamps(false);

            state
                .full(params, &pcm_samples)
                .map_err(|e| SttError::ServiceError(format!("Inference failed: {}", e)))?;

            let num_segments = state.full_n_segments();

            let mut segments = Vec::new();
            for i in 0..num_segments {
                let seg = state.get_segment(i).ok_or_else(|| {
                    SttError::ServiceError(format!("Segment {} out of bounds", i))
                })?;
                let text = seg
                    .to_str()
                    .map_err(|e| {
                        SttError::ServiceError(format!("Failed to get segment text: {}", e))
                    })?
                    .to_string();
                let start_ts = seg.start_timestamp();
                let end_ts = seg.end_timestamp();

                segments.push(Segment {
                    id: i as u32,
                    start: start_ts as f32 / 100.0,
                    end: end_ts as f32 / 100.0,
                    text,
                    speaker: None,
                    avg_logprob: 0.0,
                    no_speech_prob: 0.0,
                });
            }

            Ok::<Vec<Segment>, SttError>(segments)
        })
        .await
        .map_err(|e| SttError::ServiceError(format!("Task join error: {}", e)))??;

        let full_text = segments
            .iter()
            .map(|s| s.text.as_str())
            .collect::<Vec<_>>()
            .join(" ")
            .trim()
            .to_string();

        let processing_time = start.elapsed().as_millis() as u64;

        Ok(TranscribeResult {
            text: full_text,
            language: language_out.unwrap_or_else(|| "auto".to_string()),
            language_probability: 0.95,
            duration_seconds,
            segments,
            words: None,
            speakers: None,
            model_used: self.model_name.clone(),
            processing_time_ms: processing_time,
        })
    }

    async fn transcribe_stream(
        &self,
        audio: Bytes,
        filename: &str,
        opts: Option<TranscribeRequest>,
    ) -> Result<Pin<Box<dyn Stream<Item = Result<TranscribeChunk, SttError>> + Send>>, SttError>
    {
        // For native backend, do full transcription and stream segments
        let result = self.transcribe(audio, filename, opts).await?;

        let stream = futures::stream::iter(result.segments.into_iter().map(|s| {
            Ok(TranscribeChunk {
                segment_id: s.id,
                text: s.text,
                start: s.start,
                end: s.end,
                is_final: true,
            })
        }));

        Ok(Box::pin(stream))
    }

    async fn list_models(&self) -> Result<Vec<SttModel>, SttError> {
        Ok(default_whisper_models())
    }
}
