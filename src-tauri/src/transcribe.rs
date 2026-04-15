//! Local transcription pipeline for Tauri.
//!
//! Sends captured audio to the media service STT endpoint, parses the
//! response into [`TranscriptionResult`], and generates a Tiptap document.

use signapps_transcription::{
    tiptap::to_tiptap_doc, Segment, SessionMeta, Speaker, TranscriptionResult, TranscriptionSource,
};
use tauri::State;
use uuid::Uuid;

use crate::capture::CaptureState;

/// Status returned after transcription completes.
#[derive(serde::Serialize)]
pub struct TranscribeStatus {
    /// Current stage (always "completed" on success).
    pub stage: String,
    /// Number of transcribed segments.
    pub segments: usize,
    /// Number of identified speakers.
    pub speakers: usize,
    /// Audio duration in milliseconds.
    pub duration_ms: u64,
}

/// Transcribe the last captured audio buffer via the media service.
///
/// Consumes the buffer stored by [`stop_capture`](crate::capture::stop_capture),
/// sends it to the STT endpoint, and posts the resulting Tiptap document back.
#[tauri::command]
pub async fn transcribe_captured_audio(
    capture_state: State<'_, CaptureState>,
    source_app: Option<String>,
    server_url: Option<String>,
) -> Result<TranscribeStatus, String> {
    let buffer = capture_state
        .last_buffer
        .lock()
        .map_err(|e| e.to_string())?
        .take()
        .ok_or("no captured audio available")?;

    let wav_bytes = buffer.to_wav_bytes();
    let duration_ms = buffer.duration_ms;

    // Transcribe via media service STT
    let media_url = server_url.unwrap_or_else(|| {
        std::env::var("MEDIA_URL").unwrap_or_else(|_| "http://localhost:3009".into())
    });
    let client = reqwest::Client::new();
    let form = reqwest::multipart::Form::new().part(
        "file",
        reqwest::multipart::Part::bytes(wav_bytes.clone())
            .file_name("capture.wav")
            .mime_str("audio/wav")
            .map_err(|e| format!("MIME error: {e}"))?,
    );
    let resp: serde_json::Value = client
        .post(format!(
            "{media_url}/api/v1/stt/transcribe?word_timestamps=true"
        ))
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("STT request failed: {e}"))?
        .json()
        .await
        .map_err(|e| format!("STT parse failed: {e}"))?;

    let language = resp["language"].as_str().unwrap_or("fr").to_string();
    let segments: Vec<Segment> = resp["segments"]
        .as_array()
        .cloned()
        .unwrap_or_default()
        .iter()
        .map(|s| Segment {
            id: Uuid::new_v4(),
            start_ms: (s["start"].as_f64().unwrap_or(0.0) * 1000.0) as u64,
            end_ms: (s["end"].as_f64().unwrap_or(0.0) * 1000.0) as u64,
            text: s["text"].as_str().unwrap_or("").trim().to_string(),
            speaker: None,
            confidence: s["avg_logprob"].as_f64().unwrap_or(0.0) as f32,
        })
        .filter(|s| !s.text.is_empty())
        .collect();

    let speakers = vec![Speaker {
        id: "speaker_0".into(),
        label: "Speaker".into(),
        person_id: None,
    }];

    let result = TranscriptionResult {
        meta: SessionMeta {
            session_id: Uuid::new_v4(),
            source: TranscriptionSource::ExternalCapture,
            source_app,
            duration_ms,
            language,
            speakers: speakers.clone(),
            created_at: chrono::Utc::now(),
            recording_id: None,
        },
        segments,
    };

    let segment_count = result.segments.len();
    let speaker_count = result.meta.speakers.len();

    // POST result to server for Tiptap doc creation
    let tiptap_doc = to_tiptap_doc(&result);
    let _ = client
        .post(format!("{media_url}/api/v1/stt/transcription-result"))
        .json(&serde_json::json!({
            "result": result,
            "tiptap_doc": tiptap_doc,
        }))
        .send()
        .await;

    Ok(TranscribeStatus {
        stage: "completed".into(),
        segments: segment_count,
        speakers: speaker_count,
        duration_ms,
    })
}
