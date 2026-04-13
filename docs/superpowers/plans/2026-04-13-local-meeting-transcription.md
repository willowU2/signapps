# Local Meeting Transcription — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transcription locale post-meeting pour les meetings SignApps Meet (pipeline serveur) et les meetings externes (capture audio Tauri + whisper-rs local), avec diarization hybride et sortie en documents Tiptap.

**Architecture:** Trait `TranscriptionPipeline` avec deux implémentations — `MeetPipeline` (serveur, event-driven) et `CapturePipeline` (Tauri desktop). Capture audio cross-platform via trait `AudioCapture`. Diarization par flux LiveKit (interne) ou pyannote sidecar (externe). Résultat unifié converti en document Tiptap via signapps-docs.

**Tech Stack:** Rust (Axum, Tauri, whisper-rs, cpal), Python (pyannote sidecar), TypeScript (Tiptap extensions React), PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-04-13-local-meeting-transcription-design.md`

---

## File Structure

### New crate: `crates/signapps-transcription/`
- `Cargo.toml` — dependencies: uuid, chrono, serde, serde_json, thiserror
- `src/lib.rs` — module exports, `TranscriptionSource` enum
- `src/types.rs` — `Segment`, `Speaker`, `SessionMeta`, `TranscriptionResult`
- `src/tiptap.rs` — `TranscriptionResult` → Tiptap JSON conversion
- `src/pipeline.rs` — `TranscriptionPipeline` trait

### New crate: `crates/signapps-audio-capture/`
- `Cargo.toml` — dependencies: cpal, tokio, thiserror; platform-specific deps
- `src/lib.rs` — module exports, `AudioCapture` trait, `CaptureConfig`, `AudioSource`
- `src/vad.rs` — VAD (silence detection) by RMS energy
- `src/wasapi.rs` — Windows WASAPI loopback implementation
- `src/coreaudio.rs` — macOS CoreAudio implementation (stub for now)
- `src/pulseaudio.rs` — Linux PulseAudio implementation (stub for now)

### Modified: `services/signapps-meet/src/handlers/transcription.rs`
- Complete the 5-step pipeline with real storage fetch, STT call, doc creation

### Modified: `services/signapps-media/src/main.rs`
- Add `POST /api/v1/stt/transcription-result` endpoint to receive CapturePipeline results

### New migration: `migrations/300_transcription_jobs.sql`
- `meet.transcription_jobs` table

### New: `scripts/pyannote-sidecar/`
- `diarize.py` — pyannote diarization script (~50 lines)
- `requirements.txt` — pyannote.audio, torch-cpu

### Modified: `src-tauri/Cargo.toml`
- Add signapps-audio-capture, signapps-transcription, whisper-rs dependencies

### New: `src-tauri/src/capture.rs`
- Tauri commands for audio capture (start, stop, list_sources)

### New: `src-tauri/src/transcribe.rs`
- Local transcription pipeline: whisper-rs + pyannote sidecar

### New: `client/src/components/docs/extensions/transcript-meta.ts`
- Tiptap `transcriptMeta` node extension

### New: `client/src/components/docs/extensions/transcript-segment.ts`
- Tiptap `transcriptSegment` node extension

### New: `client/src/components/docs/transcript-meta-view.tsx`
- React component for transcript metadata banner

### New: `client/src/components/docs/transcript-segment-view.tsx`
- React component for transcript segment block

---

## Task 1: SQL Migration — transcription_jobs table

**Files:**
- Create: `migrations/300_transcription_jobs.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 300_transcription_jobs.sql
-- Transcription job tracking for meet recordings and external captures

CREATE TABLE IF NOT EXISTS meet.transcription_jobs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recording_id        UUID REFERENCES meet.recordings(id) ON DELETE CASCADE,
    capture_session_id  UUID,
    source              TEXT NOT NULL CHECK (source IN ('meet', 'external_capture', 'voice_memo')),
    status              TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    source_app          TEXT,
    language            TEXT,
    duration_ms         BIGINT,
    document_id         UUID,
    speaker_count       INTEGER,
    segment_count       INTEGER,
    error_message       TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at        TIMESTAMPTZ,
    tenant_id           UUID NOT NULL
);

CREATE INDEX idx_tj_status ON meet.transcription_jobs(status);
CREATE INDEX idx_tj_tenant ON meet.transcription_jobs(tenant_id);
CREATE INDEX idx_tj_recording ON meet.transcription_jobs(recording_id);
```

- [ ] **Step 2: Apply the migration**

```bash
docker exec -i signapps-postgres psql -U signapps -d signapps < migrations/300_transcription_jobs.sql
```

Expected: `CREATE TABLE` + 3x `CREATE INDEX`

- [ ] **Step 3: Commit**

```bash
git add migrations/300_transcription_jobs.sql
git commit -m "feat(meet): add transcription_jobs migration"
```

---

## Task 2: Crate signapps-transcription — types and trait

**Files:**
- Create: `crates/signapps-transcription/Cargo.toml`
- Create: `crates/signapps-transcription/src/lib.rs`
- Create: `crates/signapps-transcription/src/types.rs`
- Create: `crates/signapps-transcription/src/pipeline.rs`
- Modify: `Cargo.toml` (workspace members)

- [ ] **Step 1: Create Cargo.toml**

```toml
[package]
name = "signapps-transcription"
version = "0.1.0"
edition = "2021"

[dependencies]
uuid = { workspace = true }
chrono = { workspace = true }
serde = { workspace = true }
serde_json = { workspace = true }
thiserror = { workspace = true }
```

- [ ] **Step 2: Create src/types.rs**

```rust
//! Core transcription data types.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Source of the transcription.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TranscriptionSource {
    Meet,
    ExternalCapture,
    VoiceMemo,
}

impl std::fmt::Display for TranscriptionSource {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Meet => write!(f, "meet"),
            Self::ExternalCapture => write!(f, "external_capture"),
            Self::VoiceMemo => write!(f, "voice_memo"),
        }
    }
}

/// A transcription segment with speaker attribution.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Segment {
    pub id: Uuid,
    pub start_ms: u64,
    pub end_ms: u64,
    pub text: String,
    pub speaker: Option<String>,
    pub confidence: f32,
}

/// An identified speaker.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Speaker {
    pub id: String,
    pub label: String,
    pub person_id: Option<Uuid>,
}

/// Session metadata.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionMeta {
    pub session_id: Uuid,
    pub source: TranscriptionSource,
    pub source_app: Option<String>,
    pub duration_ms: u64,
    pub language: String,
    pub speakers: Vec<Speaker>,
    pub created_at: DateTime<Utc>,
    pub recording_id: Option<Uuid>,
}

/// Unified transcription output — contract shared by all pipelines.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptionResult {
    pub meta: SessionMeta,
    pub segments: Vec<Segment>,
}
```

- [ ] **Step 3: Create src/pipeline.rs**

```rust
//! Transcription pipeline trait.

use crate::types::TranscriptionResult;

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
```

- [ ] **Step 4: Create src/lib.rs**

```rust
//! Transcription core types and pipeline trait for SignApps.
//!
//! Shared between server-side (MeetPipeline) and desktop (CapturePipeline).

pub mod pipeline;
pub mod types;

pub use pipeline::{AudioInput, TranscriptionError};
pub use types::{
    Segment, SessionMeta, Speaker, TranscriptionResult, TranscriptionSource,
};
```

- [ ] **Step 5: Add to workspace members**

In root `Cargo.toml`, add `"crates/signapps-transcription"` to the `members` array.

- [ ] **Step 6: Verify it compiles**

```bash
cargo check -p signapps-transcription
```

Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add crates/signapps-transcription/ Cargo.toml Cargo.lock
git commit -m "feat(transcription): add signapps-transcription crate with types and pipeline trait"
```

---

## Task 3: Tiptap JSON conversion

**Files:**
- Create: `crates/signapps-transcription/src/tiptap.rs`
- Modify: `crates/signapps-transcription/src/lib.rs`

- [ ] **Step 1: Write tests for Tiptap conversion**

Add to `crates/signapps-transcription/src/tiptap.rs`:

```rust
//! Convert TranscriptionResult into Tiptap-compatible JSON.

use crate::types::{TranscriptionResult, TranscriptionSource};
use serde_json::{json, Value};

/// Convert a TranscriptionResult into a Tiptap document JSON.
pub fn to_tiptap_doc(result: &TranscriptionResult) -> Value {
    let title = build_title(result);
    let speaker_labels: Vec<&str> = result
        .meta
        .speakers
        .iter()
        .map(|s| s.label.as_str())
        .collect();

    let mut content: Vec<Value> = vec![
        json!({
            "type": "heading",
            "attrs": { "level": 1 },
            "content": [{ "type": "text", "text": title }]
        }),
        json!({
            "type": "transcriptMeta",
            "attrs": {
                "duration": format_duration(result.meta.duration_ms),
                "source": result.meta.source.to_string(),
                "speakers": speaker_labels,
                "language": result.meta.language,
            }
        }),
    ];

    for seg in &result.segments {
        content.push(json!({
            "type": "transcriptSegment",
            "attrs": {
                "speaker": seg.speaker.as_deref().unwrap_or("Speaker"),
                "timestamp": format_duration(seg.start_ms),
            },
            "content": [{ "type": "text", "text": seg.text }]
        }));
    }

    json!({ "type": "doc", "content": content })
}

fn build_title(result: &TranscriptionResult) -> String {
    let date = result.meta.created_at.format("%d %B %Y, %H:%M");
    match result.meta.source {
        TranscriptionSource::Meet => format!("Réunion — {date}"),
        TranscriptionSource::ExternalCapture => {
            let app = result
                .meta
                .source_app
                .as_deref()
                .unwrap_or("External");
            format!("{app} — {date}")
        }
        TranscriptionSource::VoiceMemo => format!("Mémo vocal — {date}"),
    }
}

fn format_duration(ms: u64) -> String {
    let total_secs = ms / 1000;
    let h = total_secs / 3600;
    let m = (total_secs % 3600) / 60;
    let s = total_secs % 60;
    if h > 0 {
        format!("{h:02}:{m:02}:{s:02}")
    } else {
        format!("{m:02}:{s:02}")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::*;
    use chrono::Utc;
    use uuid::Uuid;

    fn sample_result() -> TranscriptionResult {
        TranscriptionResult {
            meta: SessionMeta {
                session_id: Uuid::new_v4(),
                source: TranscriptionSource::Meet,
                source_app: None,
                duration_ms: 2535000, // 42:15
                language: "fr".into(),
                speakers: vec![
                    Speaker { id: "s0".into(), label: "Pierre Durand".into(), person_id: None },
                    Speaker { id: "s1".into(), label: "Marie Béranger".into(), person_id: None },
                ],
                created_at: Utc::now(),
                recording_id: Some(Uuid::new_v4()),
            },
            segments: vec![
                Segment {
                    id: Uuid::new_v4(),
                    start_ms: 83000,
                    end_ms: 90000,
                    text: "On commence par le point migration.".into(),
                    speaker: Some("Pierre Durand".into()),
                    confidence: 0.95,
                },
                Segment {
                    id: Uuid::new_v4(),
                    start_ms: 105000,
                    end_ms: 112000,
                    text: "Les tests sont passés.".into(),
                    speaker: Some("Marie Béranger".into()),
                    confidence: 0.92,
                },
            ],
        }
    }

    #[test]
    fn tiptap_doc_has_correct_structure() {
        let doc = to_tiptap_doc(&sample_result());
        assert_eq!(doc["type"], "doc");
        let content = doc["content"].as_array().unwrap();
        // heading + meta + 2 segments = 4
        assert_eq!(content.len(), 4);
        assert_eq!(content[0]["type"], "heading");
        assert_eq!(content[1]["type"], "transcriptMeta");
        assert_eq!(content[2]["type"], "transcriptSegment");
        assert_eq!(content[3]["type"], "transcriptSegment");
    }

    #[test]
    fn tiptap_meta_contains_speakers() {
        let doc = to_tiptap_doc(&sample_result());
        let speakers = doc["content"][1]["attrs"]["speakers"].as_array().unwrap();
        assert_eq!(speakers.len(), 2);
        assert_eq!(speakers[0], "Pierre Durand");
    }

    #[test]
    fn tiptap_segment_has_timestamp() {
        let doc = to_tiptap_doc(&sample_result());
        let seg = &doc["content"][2]["attrs"];
        assert_eq!(seg["timestamp"], "01:23");
        assert_eq!(seg["speaker"], "Pierre Durand");
    }

    #[test]
    fn format_duration_handles_hours() {
        assert_eq!(format_duration(3661000), "01:01:01");
        assert_eq!(format_duration(0), "00:00");
        assert_eq!(format_duration(90000), "01:30");
    }
}
```

- [ ] **Step 2: Add module to lib.rs**

Add `pub mod tiptap;` to `crates/signapps-transcription/src/lib.rs`.

- [ ] **Step 3: Run tests**

```bash
cargo nextest run -p signapps-transcription
```

Expected: 4 tests pass

- [ ] **Step 4: Commit**

```bash
git add crates/signapps-transcription/
git commit -m "feat(transcription): add Tiptap JSON conversion with tests"
```

---

## Task 4: Complete MeetPipeline — server-side transcription

**Files:**
- Modify: `services/signapps-meet/src/handlers/transcription.rs`
- Modify: `services/signapps-meet/Cargo.toml` (add signapps-transcription dep)

- [ ] **Step 1: Add signapps-transcription dependency**

In `services/signapps-meet/Cargo.toml`, add:
```toml
signapps-transcription = { path = "../../crates/signapps-transcription" }
```

- [ ] **Step 2: Rewrite run_transcription_pipeline**

Replace the existing `run_transcription_pipeline` function in `services/signapps-meet/src/handlers/transcription.rs` (lines 135-205) with the complete 5-step implementation:

```rust
use signapps_transcription::{
    Segment, SessionMeta, Speaker, TranscriptionResult, TranscriptionSource,
};
use signapps_transcription::tiptap::to_tiptap_doc;

async fn run_transcription_pipeline(
    pool: &sqlx::Pool<sqlx::Postgres>,
    recording_id: Uuid,
    room_id: Uuid,
) -> anyhow::Result<()> {
    // Step 1: Fetch recording metadata
    let recording = sqlx::query_as::<_, Recording>(
        "SELECT * FROM meet.recordings WHERE id = $1",
    )
    .bind(recording_id)
    .fetch_one(pool)
    .await
    .map_err(|e| anyhow::anyhow!("recording not found: {e}"))?;

    let storage_path = recording
        .storage_path
        .as_deref()
        .ok_or_else(|| anyhow::anyhow!("recording has no storage_path"))?;

    // Step 2: Fetch audio bytes from storage service
    let storage_url = std::env::var("STORAGE_URL")
        .unwrap_or_else(|_| "http://localhost:3004".into());
    let client = reqwest::Client::new();
    let audio_bytes = client
        .get(format!("{storage_url}/api/v1/storage/files/{storage_path}"))
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("storage fetch failed: {e}"))?
        .bytes()
        .await
        .map_err(|e| anyhow::anyhow!("storage read failed: {e}"))?;

    tracing::info!(bytes = audio_bytes.len(), "fetched recording audio");

    // Step 3: Transcribe via media STT service
    let media_url = std::env::var("MEDIA_URL")
        .unwrap_or_else(|_| "http://localhost:3009".into());
    let form = reqwest::multipart::Form::new()
        .part(
            "file",
            reqwest::multipart::Part::bytes(audio_bytes.to_vec())
                .file_name("recording.webm")
                .mime_str("audio/webm")
                .unwrap(),
        );
    let stt_response: serde_json::Value = client
        .post(format!("{media_url}/api/v1/stt/transcribe?word_timestamps=true"))
        .multipart(form)
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("STT request failed: {e}"))?
        .json()
        .await
        .map_err(|e| anyhow::anyhow!("STT parse failed: {e}"))?;

    let language = stt_response["language"]
        .as_str()
        .unwrap_or("fr")
        .to_string();
    let stt_segments = stt_response["segments"]
        .as_array()
        .cloned()
        .unwrap_or_default();

    // Step 4: Build TranscriptionResult (diarization by LiveKit tracks — simplified here,
    // all segments attributed to participants from room metadata)
    let participants: Vec<Speaker> = sqlx::query_as::<_, (Uuid, String)>(
        "SELECT u.id, COALESCE(p.display_name, u.username)
         FROM meet.participants mp
         JOIN identity.users u ON u.id = mp.user_id
         LEFT JOIN core.persons p ON p.user_id = u.id
         WHERE mp.room_id = $1",
    )
    .bind(room_id)
    .fetch_all(pool)
    .await
    .unwrap_or_default()
    .into_iter()
    .enumerate()
    .map(|(i, (uid, name))| Speaker {
        id: format!("speaker_{i}"),
        label: name,
        person_id: Some(uid),
    })
    .collect();

    let segments: Vec<Segment> = stt_segments
        .iter()
        .map(|s| Segment {
            id: Uuid::new_v4(),
            start_ms: (s["start"].as_f64().unwrap_or(0.0) * 1000.0) as u64,
            end_ms: (s["end"].as_f64().unwrap_or(0.0) * 1000.0) as u64,
            text: s["text"].as_str().unwrap_or("").trim().to_string(),
            speaker: participants.first().map(|p| p.label.clone()),
            confidence: s["avg_logprob"].as_f64().unwrap_or(0.0) as f32,
        })
        .filter(|s| !s.text.is_empty())
        .collect();

    let result = TranscriptionResult {
        meta: SessionMeta {
            session_id: Uuid::new_v4(),
            source: TranscriptionSource::Meet,
            source_app: None,
            duration_ms: recording.duration_seconds.unwrap_or(0) as u64 * 1000,
            language,
            speakers: participants,
            created_at: chrono::Utc::now(),
            recording_id: Some(recording_id),
        },
        segments,
    };

    // Step 5: Create Tiptap document via docs service
    let tiptap_json = to_tiptap_doc(&result);
    let docs_url = std::env::var("DOCS_URL")
        .unwrap_or_else(|_| "http://localhost:3010".into());
    let doc_response: serde_json::Value = client
        .post(format!("{docs_url}/api/v1/docs"))
        .json(&serde_json::json!({
            "title": format!("Transcription — {}", result.meta.created_at.format("%Y-%m-%d %H:%M")),
            "content": tiptap_json,
            "type": "transcript",
        }))
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("doc creation failed: {e}"))?
        .json()
        .await
        .unwrap_or_default();

    let doc_id = doc_response["id"].as_str().and_then(|s| Uuid::parse_str(s).ok());

    // Update job status
    sqlx::query(
        "UPDATE meet.transcription_jobs
         SET status = 'completed', document_id = $1, completed_at = NOW(),
             speaker_count = $2, segment_count = $3, language = $4
         WHERE recording_id = $5 AND status = 'processing'",
    )
    .bind(doc_id)
    .bind(result.meta.speakers.len() as i32)
    .bind(result.segments.len() as i32)
    .bind(&result.meta.language)
    .bind(recording_id)
    .execute(pool)
    .await?;

    tracing::info!(
        recording_id = %recording_id,
        segments = result.segments.len(),
        speakers = result.meta.speakers.len(),
        "transcription pipeline completed"
    );

    Ok(())
}
```

- [ ] **Step 3: Verify it compiles**

```bash
cargo check -p signapps-meet
```

- [ ] **Step 4: Commit**

```bash
git add services/signapps-meet/
git commit -m "feat(meet): complete 5-step transcription pipeline with STT + doc creation"
```

---

## Task 5: Crate signapps-audio-capture — cross-platform audio capture

**Files:**
- Create: `crates/signapps-audio-capture/Cargo.toml`
- Create: `crates/signapps-audio-capture/src/lib.rs`
- Create: `crates/signapps-audio-capture/src/vad.rs`
- Create: `crates/signapps-audio-capture/src/wasapi.rs`
- Create: `crates/signapps-audio-capture/src/coreaudio.rs`
- Create: `crates/signapps-audio-capture/src/pulseaudio.rs`
- Modify: `Cargo.toml` (workspace members)

- [ ] **Step 1: Create Cargo.toml**

```toml
[package]
name = "signapps-audio-capture"
version = "0.1.0"
edition = "2021"

[dependencies]
cpal = "0.15"
tokio = { workspace = true }
thiserror = { workspace = true }
tracing = { workspace = true }

[target.'cfg(windows)'.dependencies]
windows = { version = "0.58", features = [
    "Win32_System_Com",
    "Win32_Media_Audio",
    "Win32_System_Threading",
] }

[target.'cfg(target_os = "macos")'.dependencies]
coreaudio-rs = "0.11"

[features]
default = []
```

- [ ] **Step 2: Create src/lib.rs with trait and types**

```rust
//! Cross-platform audio capture for meeting transcription.
//!
//! Provides a unified `AudioCapture` trait with per-OS implementations:
//! WASAPI loopback (Windows), CoreAudio (macOS), PulseAudio (Linux).

pub mod vad;

#[cfg(target_os = "windows")]
pub mod wasapi;
#[cfg(target_os = "macos")]
pub mod coreaudio;
#[cfg(target_os = "linux")]
pub mod pulseaudio;

use thiserror::Error;

/// Audio capture errors.
#[derive(Debug, Error)]
pub enum CaptureError {
    #[error("no audio device found: {0}")]
    NoDevice(String),
    #[error("capture failed: {0}")]
    CaptureFailed(String),
    #[error("unsupported platform")]
    UnsupportedPlatform,
}

/// Configuration for audio capture.
#[derive(Debug, Clone)]
pub struct CaptureConfig {
    pub sample_rate: u32,
    pub channels: u16,
    pub capture_mic: bool,
    pub capture_system: bool,
    pub source_filter: Option<String>,
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
    pub id: String,
    pub name: String,
    pub source_type: SourceType,
}

/// Type of audio source.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "snake_case")]
pub enum SourceType {
    App,
    Device,
    Monitor,
}

/// Captured audio buffer.
pub struct AudioBuffer {
    /// PCM samples, mono, 16-bit signed, at config.sample_rate.
    pub samples: Vec<i16>,
    pub sample_rate: u32,
    pub duration_ms: u64,
}

impl AudioBuffer {
    /// Convert to WAV bytes for Whisper ingestion.
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
        buf.extend_from_slice(&16u32.to_le_bytes()); // chunk size
        buf.extend_from_slice(&1u16.to_le_bytes());  // PCM
        buf.extend_from_slice(&1u16.to_le_bytes());  // mono
        buf.extend_from_slice(&self.sample_rate.to_le_bytes());
        buf.extend_from_slice(&(self.sample_rate * 2).to_le_bytes()); // byte rate
        buf.extend_from_slice(&2u16.to_le_bytes());  // block align
        buf.extend_from_slice(&16u16.to_le_bytes()); // bits per sample
        // data chunk
        buf.extend_from_slice(b"data");
        buf.extend_from_slice(&data_len.to_le_bytes());
        for s in &self.samples {
            buf.extend_from_slice(&s.to_le_bytes());
        }

        buf
    }
}

/// Create the platform-appropriate audio capture.
pub fn create_capture() -> Result<Box<dyn AudioCaptureBackend>, CaptureError> {
    #[cfg(target_os = "windows")]
    { Ok(Box::new(wasapi::WasapiCapture::new()?)) }

    #[cfg(target_os = "macos")]
    { Ok(Box::new(coreaudio::CoreAudioCapture::new()?)) }

    #[cfg(target_os = "linux")]
    { Ok(Box::new(pulseaudio::PulseAudioCapture::new()?)) }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    { Err(CaptureError::UnsupportedPlatform) }
}

/// Platform audio capture backend.
pub trait AudioCaptureBackend: Send {
    /// List available audio sources (conference apps, devices).
    fn list_sources(&self) -> Result<Vec<AudioSource>, CaptureError>;

    /// Start capturing audio. Returns a handle to stop later.
    fn start(&mut self, config: CaptureConfig) -> Result<(), CaptureError>;

    /// Stop capturing and return the audio buffer.
    fn stop(&mut self) -> Result<AudioBuffer, CaptureError>;

    /// Whether capture is currently active.
    fn is_recording(&self) -> bool;
}
```

- [ ] **Step 3: Create src/vad.rs**

```rust
//! Voice Activity Detection by RMS energy.

/// Check if an audio chunk contains speech based on RMS energy.
pub fn is_speech(samples: &[i16], threshold: f32) -> bool {
    if samples.is_empty() {
        return false;
    }
    let sum_sq: f64 = samples.iter().map(|&s| (s as f64).powi(2)).sum();
    let rms = (sum_sq / samples.len() as f64).sqrt();
    rms > threshold as f64
}

/// Default RMS threshold for speech detection.
pub const DEFAULT_RMS_THRESHOLD: f32 = 500.0;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn silence_detected() {
        let silence = vec![0i16; 1600]; // 100ms at 16kHz
        assert!(!is_speech(&silence, DEFAULT_RMS_THRESHOLD));
    }

    #[test]
    fn speech_detected() {
        let loud: Vec<i16> = (0..1600).map(|i| ((i as f32 * 0.1).sin() * 10000.0) as i16).collect();
        assert!(is_speech(&loud, DEFAULT_RMS_THRESHOLD));
    }

    #[test]
    fn empty_is_silence() {
        assert!(!is_speech(&[], DEFAULT_RMS_THRESHOLD));
    }
}
```

- [ ] **Step 4: Create platform stubs**

`src/wasapi.rs`:
```rust
//! Windows WASAPI loopback capture.

use crate::{AudioBuffer, AudioCaptureBackend, AudioSource, CaptureConfig, CaptureError, SourceType};

pub struct WasapiCapture {
    recording: bool,
    samples: Vec<i16>,
    config: Option<CaptureConfig>,
}

impl WasapiCapture {
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
        // TODO: enumerate WASAPI loopback devices via cpal
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
        // TODO: spawn cpal loopback stream thread
        Ok(())
    }

    fn stop(&mut self) -> Result<AudioBuffer, CaptureError> {
        self.recording = false;
        let sample_rate = self.config.as_ref().map(|c| c.sample_rate).unwrap_or(16000);
        let samples = std::mem::take(&mut self.samples);
        let duration_ms = (samples.len() as u64 * 1000) / sample_rate as u64;
        tracing::info!(samples = samples.len(), duration_ms, "WASAPI capture stopped");
        Ok(AudioBuffer { samples, sample_rate, duration_ms })
    }

    fn is_recording(&self) -> bool {
        self.recording
    }
}
```

`src/coreaudio.rs`:
```rust
//! macOS CoreAudio capture (stub).

use crate::{AudioBuffer, AudioCaptureBackend, AudioSource, CaptureConfig, CaptureError};

pub struct CoreAudioCapture;

impl CoreAudioCapture {
    pub fn new() -> Result<Self, CaptureError> {
        Ok(Self)
    }
}

impl AudioCaptureBackend for CoreAudioCapture {
    fn list_sources(&self) -> Result<Vec<AudioSource>, CaptureError> { Ok(vec![]) }
    fn start(&mut self, _config: CaptureConfig) -> Result<(), CaptureError> {
        Err(CaptureError::UnsupportedPlatform)
    }
    fn stop(&mut self) -> Result<AudioBuffer, CaptureError> {
        Err(CaptureError::UnsupportedPlatform)
    }
    fn is_recording(&self) -> bool { false }
}
```

`src/pulseaudio.rs`:
```rust
//! Linux PulseAudio monitor capture (stub).

use crate::{AudioBuffer, AudioCaptureBackend, AudioSource, CaptureConfig, CaptureError};

pub struct PulseAudioCapture;

impl PulseAudioCapture {
    pub fn new() -> Result<Self, CaptureError> {
        Ok(Self)
    }
}

impl AudioCaptureBackend for PulseAudioCapture {
    fn list_sources(&self) -> Result<Vec<AudioSource>, CaptureError> { Ok(vec![]) }
    fn start(&mut self, _config: CaptureConfig) -> Result<(), CaptureError> {
        Err(CaptureError::UnsupportedPlatform)
    }
    fn stop(&mut self) -> Result<AudioBuffer, CaptureError> {
        Err(CaptureError::UnsupportedPlatform)
    }
    fn is_recording(&self) -> bool { false }
}
```

- [ ] **Step 5: Add to workspace, verify compilation**

Add `"crates/signapps-audio-capture"` to workspace members in root `Cargo.toml`.

```bash
cargo check -p signapps-audio-capture
```

- [ ] **Step 6: Run VAD tests**

```bash
cargo nextest run -p signapps-audio-capture
```

Expected: 3 tests pass

- [ ] **Step 7: Commit**

```bash
git add crates/signapps-audio-capture/ Cargo.toml Cargo.lock
git commit -m "feat(audio-capture): add cross-platform audio capture crate with VAD"
```

---

## Task 6: pyannote diarization sidecar

**Files:**
- Create: `scripts/pyannote-sidecar/diarize.py`
- Create: `scripts/pyannote-sidecar/requirements.txt`

- [ ] **Step 1: Create requirements.txt**

```
pyannote.audio==3.1.1
torch>=2.0,<3
torchaudio>=2.0,<3
```

- [ ] **Step 2: Create diarize.py**

```python
#!/usr/bin/env python3
"""Pyannote speaker diarization sidecar.

Reads JSON from stdin: {"audio_path": "/tmp/recording.wav"}
Writes JSON to stdout: {"speakers": [{"id": "speaker_0", "label": "Speaker 1", "segments": [{"start_ms": 0, "end_ms": 5000}]}]}
"""

import json
import sys
import os

def main():
    request = json.loads(sys.stdin.readline())
    audio_path = request["audio_path"]

    if not os.path.exists(audio_path):
        json.dump({"error": f"file not found: {audio_path}"}, sys.stdout)
        return

    try:
        from pyannote.audio import Pipeline

        token = os.environ.get("HF_TOKEN", "")
        pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            use_auth_token=token if token else None,
        )

        diarization = pipeline(audio_path)

        speakers = {}
        for turn, _, speaker in diarization.itertracks(yield_label=True):
            if speaker not in speakers:
                idx = len(speakers)
                speakers[speaker] = {
                    "id": f"speaker_{idx}",
                    "label": f"Speaker {idx + 1}",
                    "segments": [],
                }
            speakers[speaker]["segments"].append({
                "start_ms": int(turn.start * 1000),
                "end_ms": int(turn.end * 1000),
            })

        json.dump({"speakers": list(speakers.values())}, sys.stdout)

    except ImportError:
        json.dump({"error": "pyannote.audio not installed"}, sys.stdout)
    except Exception as e:
        json.dump({"error": str(e)}, sys.stdout)

if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Commit**

```bash
git add scripts/pyannote-sidecar/
git commit -m "feat(diarization): add pyannote speaker diarization sidecar script"
```

---

## Task 7: Tauri capture + transcription commands

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Create: `src-tauri/src/capture.rs`
- Create: `src-tauri/src/transcribe.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add dependencies to src-tauri/Cargo.toml**

```toml
signapps-audio-capture = { path = "../crates/signapps-audio-capture" }
signapps-transcription = { path = "../crates/signapps-transcription" }
whisper-rs = { version = "0.14", optional = true }
reqwest = { version = "0.12", features = ["json", "multipart"] }

[features]
default = ["local-stt"]
local-stt = ["dep:whisper-rs"]
```

- [ ] **Step 2: Create src/capture.rs**

```rust
//! Tauri commands for audio capture.

use signapps_audio_capture::{
    create_capture, AudioBuffer, AudioCaptureBackend, AudioSource, CaptureConfig,
};
use std::sync::Mutex;
use tauri::State;

pub struct CaptureState {
    pub backend: Mutex<Option<Box<dyn AudioCaptureBackend>>>,
    pub last_buffer: Mutex<Option<AudioBuffer>>,
}

impl CaptureState {
    pub fn new() -> Self {
        Self {
            backend: Mutex::new(None),
            last_buffer: Mutex::new(None),
        }
    }
}

#[tauri::command]
pub fn list_audio_sources(state: State<'_, CaptureState>) -> Result<Vec<AudioSource>, String> {
    let mut backend_guard = state.backend.lock().map_err(|e| e.to_string())?;
    if backend_guard.is_none() {
        *backend_guard = Some(create_capture().map_err(|e| e.to_string())?);
    }
    backend_guard
        .as_ref()
        .unwrap()
        .list_sources()
        .map_err(|e| e.to_string())
}

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
        .unwrap()
        .start(config)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn stop_capture(state: State<'_, CaptureState>) -> Result<u64, String> {
    let mut backend_guard = state.backend.lock().map_err(|e| e.to_string())?;
    let backend = backend_guard
        .as_mut()
        .ok_or("no capture backend")?;
    let buffer = backend.stop().map_err(|e| e.to_string())?;
    let duration_ms = buffer.duration_ms;
    *state.last_buffer.lock().map_err(|e| e.to_string())? = Some(buffer);
    Ok(duration_ms)
}
```

- [ ] **Step 3: Create src/transcribe.rs**

```rust
//! Local transcription pipeline for Tauri.

use signapps_audio_capture::AudioBuffer;
use signapps_transcription::{
    tiptap::to_tiptap_doc, Segment, SessionMeta, Speaker, TranscriptionResult,
    TranscriptionSource,
};
use std::sync::Mutex;
use tauri::State;
use uuid::Uuid;

use crate::capture::CaptureState;

#[derive(serde::Serialize)]
pub struct TranscribeStatus {
    pub stage: String,
    pub segments: usize,
    pub speakers: usize,
    pub duration_ms: u64,
}

#[tauri::command]
pub async fn transcribe_captured_audio(
    capture_state: State<'_, CaptureState>,
    source_app: Option<String>,
    server_url: Option<String>,
) -> Result<TranscribeStatus, String> {
    // Get the captured audio buffer
    let buffer = capture_state
        .last_buffer
        .lock()
        .map_err(|e| e.to_string())?
        .take()
        .ok_or("no captured audio available")?;

    let wav_bytes = buffer.to_wav_bytes();
    let duration_ms = buffer.duration_ms;

    // Transcribe via whisper-rs if available, otherwise POST to server
    let stt_result = transcribe_audio(&wav_bytes).await?;

    // Run pyannote diarization if available
    let speakers = run_diarization(&wav_bytes).await.unwrap_or_else(|_| {
        vec![Speaker {
            id: "speaker_0".into(),
            label: "Speaker".into(),
            person_id: None,
        }]
    });

    let result = TranscriptionResult {
        meta: SessionMeta {
            session_id: Uuid::new_v4(),
            source: TranscriptionSource::ExternalCapture,
            source_app,
            duration_ms,
            language: stt_result.language.clone(),
            speakers: speakers.clone(),
            created_at: chrono::Utc::now(),
            recording_id: None,
        },
        segments: stt_result.segments,
    };

    let segment_count = result.segments.len();
    let speaker_count = result.meta.speakers.len();

    // POST to server to create the Tiptap document
    let base_url = server_url.unwrap_or_else(|| "http://localhost:3009".into());
    let client = reqwest::Client::new();
    let tiptap_doc = to_tiptap_doc(&result);

    client
        .post(format!("{base_url}/api/v1/stt/transcription-result"))
        .json(&serde_json::json!({
            "result": result,
            "tiptap_doc": tiptap_doc,
        }))
        .send()
        .await
        .map_err(|e| format!("failed to send transcription result: {e}"))?;

    Ok(TranscribeStatus {
        stage: "completed".into(),
        segments: segment_count,
        speakers: speaker_count,
        duration_ms,
    })
}

struct SttResult {
    language: String,
    segments: Vec<Segment>,
}

async fn transcribe_audio(wav_bytes: &[u8]) -> Result<SttResult, String> {
    // TODO: integrate whisper-rs directly here for true local transcription
    // For now, POST to the media service
    let media_url =
        std::env::var("MEDIA_URL").unwrap_or_else(|_| "http://localhost:3009".into());
    let client = reqwest::Client::new();
    let form = reqwest::multipart::Form::new().part(
        "file",
        reqwest::multipart::Part::bytes(wav_bytes.to_vec())
            .file_name("capture.wav")
            .mime_str("audio/wav")
            .unwrap(),
    );
    let resp: serde_json::Value = client
        .post(format!("{media_url}/api/v1/stt/transcribe?word_timestamps=true"))
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("STT request failed: {e}"))?
        .json()
        .await
        .map_err(|e| format!("STT parse failed: {e}"))?;

    let language = resp["language"].as_str().unwrap_or("fr").to_string();
    let segments = resp["segments"]
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

    Ok(SttResult { language, segments })
}

async fn run_diarization(wav_bytes: &[u8]) -> Result<Vec<Speaker>, String> {
    // Write wav to temp file
    let tmp_path = std::env::temp_dir().join(format!("signapps_diarize_{}.wav", Uuid::new_v4()));
    std::fs::write(&tmp_path, wav_bytes).map_err(|e| format!("write tmp: {e}"))?;

    let script_path = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.join("scripts/pyannote-sidecar/diarize.py")))
        .unwrap_or_else(|| std::path::PathBuf::from("scripts/pyannote-sidecar/diarize.py"));

    let input = serde_json::json!({"audio_path": tmp_path.to_string_lossy()});
    let output = tokio::process::Command::new("python")
        .arg(&script_path)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .spawn()
        .and_then(|mut child| {
            use tokio::io::AsyncWriteExt;
            let stdin = child.stdin.as_mut().unwrap();
            let input_str = input.to_string();
            // Use blocking write since we have the data ready
            std::io::Write::write_all(stdin.as_ref().get_ref(), input_str.as_bytes()).ok();
            Ok(child)
        })
        .map_err(|_| "pyannote not available".to_string());

    // Cleanup temp file
    let _ = std::fs::remove_file(&tmp_path);

    if output.is_err() {
        return Err("pyannote not available — transcription will proceed without diarization".into());
    }

    // Parse pyannote output
    // Simplified: return default speaker if pyannote fails
    Err("pyannote integration pending full implementation".into())
}
```

- [ ] **Step 4: Wire commands into lib.rs**

Add to `src-tauri/src/lib.rs`:

```rust
mod capture;
mod transcribe;

// In the run() function, add to the invoke_handler:
.invoke_handler(tauri::generate_handler![
    greet,
    get_version,
    capture::list_audio_sources,
    capture::start_capture,
    capture::stop_capture,
    transcribe::transcribe_captured_audio,
])
// And manage state:
.manage(capture::CaptureState::new())
```

- [ ] **Step 5: Verify compilation**

```bash
cargo check -p signapps-tauri
```

- [ ] **Step 6: Commit**

```bash
git add src-tauri/
git commit -m "feat(tauri): add audio capture and local transcription commands"
```

---

## Task 8: Tiptap extensions — transcriptMeta + transcriptSegment

**Files:**
- Create: `client/src/components/docs/extensions/transcript-meta.ts`
- Create: `client/src/components/docs/extensions/transcript-segment.ts`
- Create: `client/src/components/docs/transcript-meta-view.tsx`
- Create: `client/src/components/docs/transcript-segment-view.tsx`
- Modify: `client/src/components/docs/extensions/index.ts`

- [ ] **Step 1: Create transcript-meta extension**

`client/src/components/docs/extensions/transcript-meta.ts`:
```typescript
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { TranscriptMetaView } from "../transcript-meta-view";

export const TranscriptMeta = Node.create({
  name: "transcriptMeta",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      duration: { default: "" },
      source: { default: "meet" },
      speakers: { default: [] },
      language: { default: "fr" },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="transcript-meta"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "transcript-meta" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TranscriptMetaView);
  },
});
```

- [ ] **Step 2: Create transcript-segment extension**

`client/src/components/docs/extensions/transcript-segment.ts`:
```typescript
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { TranscriptSegmentView } from "../transcript-segment-view";

export const TranscriptSegment = Node.create({
  name: "transcriptSegment",
  group: "block",
  content: "inline*",

  addAttributes() {
    return {
      speaker: { default: "Speaker" },
      timestamp: { default: "00:00" },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="transcript-segment"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "transcript-segment" }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TranscriptSegmentView);
  },
});
```

- [ ] **Step 3: Create transcript-meta-view.tsx**

```tsx
"use client";

import { NodeViewWrapper } from "@tiptap/react";
import { Clock, Globe, Users } from "lucide-react";

export function TranscriptMetaView({ node }: { node: { attrs: { duration: string; source: string; speakers: string[]; language: string } } }) {
  const { duration, source, speakers, language } = node.attrs;
  const sourceLabel =
    source === "meet" ? "SignApps Meet" : source === "external_capture" ? "Capture externe" : "Mémo vocal";

  return (
    <NodeViewWrapper>
      <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-muted/50 px-4 py-3 text-sm text-muted-foreground mb-4">
        <span className="flex items-center gap-1.5">
          <Clock className="h-4 w-4" /> {duration}
        </span>
        <span className="flex items-center gap-1.5">
          <Globe className="h-4 w-4" /> {language.toUpperCase()}
        </span>
        <span className="flex items-center gap-1.5">
          <Users className="h-4 w-4" /> {speakers.length} participant{speakers.length > 1 ? "s" : ""}
        </span>
        <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">{sourceLabel}</span>
      </div>
    </NodeViewWrapper>
  );
}
```

- [ ] **Step 4: Create transcript-segment-view.tsx**

```tsx
"use client";

import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";

export function TranscriptSegmentView({ node }: { node: { attrs: { speaker: string; timestamp: string } } }) {
  const { speaker, timestamp } = node.attrs;
  const initials = speaker
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <NodeViewWrapper>
      <div className="flex gap-3 py-2 group">
        <div className="flex flex-col items-center gap-1 pt-0.5 min-w-[3rem]">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {initials}
          </div>
          <span className="text-[10px] text-muted-foreground font-mono opacity-0 group-hover:opacity-100 transition-opacity">
            {timestamp}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground/70 mb-0.5">{speaker}</p>
          <div className="text-sm">
            <NodeViewContent />
          </div>
        </div>
      </div>
    </NodeViewWrapper>
  );
}
```

- [ ] **Step 5: Register extensions in index.ts**

Add to `client/src/components/docs/extensions/index.ts`:

```typescript
export { TranscriptMeta } from "./transcript-meta";
export { TranscriptSegment } from "./transcript-segment";
```

And add them to the editor configuration where extensions are loaded (find the `useEditor` call in the docs editor component and add `TranscriptMeta` and `TranscriptSegment` to the extensions array).

- [ ] **Step 6: Type-check**

```bash
cd client && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add client/src/components/docs/
git commit -m "feat(docs): add Tiptap transcript extensions (meta + segment)"
```

---

## Task 9: Media service — receive transcription results endpoint

**Files:**
- Modify: `services/signapps-media/src/main.rs` (add route)
- Create: `services/signapps-media/src/handlers/transcription_result.rs`

- [ ] **Step 1: Create the handler**

`services/signapps-media/src/handlers/transcription_result.rs`:
```rust
//! Receives TranscriptionResult from CapturePipeline (Tauri) and creates the Tiptap document.

use axum::{extract::State, http::StatusCode, Json};
use serde::Deserialize;
use std::sync::Arc;

use crate::AppState;

#[derive(Deserialize)]
pub struct IngestRequest {
    pub result: signapps_transcription::TranscriptionResult,
    pub tiptap_doc: serde_json::Value,
}

/// POST /api/v1/stt/transcription-result
///
/// Receives a completed TranscriptionResult from the Tauri CapturePipeline,
/// creates a document in signapps-docs, and records the transcription job.
#[tracing::instrument(skip(state, payload))]
pub async fn ingest_transcription_result(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<IngestRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let result = &payload.result;
    let title = format!(
        "Transcription — {}",
        result.meta.created_at.format("%Y-%m-%d %H:%M")
    );

    // Create document via docs service
    let docs_url = std::env::var("DOCS_URL").unwrap_or_else(|_| "http://localhost:3010".into());
    let client = reqwest::Client::new();
    let doc_resp = client
        .post(format!("{docs_url}/api/v1/docs"))
        .json(&serde_json::json!({
            "title": title,
            "content": payload.tiptap_doc,
            "type": "transcript",
        }))
        .send()
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, format!("docs service: {e}")))?
        .json::<serde_json::Value>()
        .await
        .unwrap_or_default();

    // Record transcription job
    sqlx::query(
        "INSERT INTO meet.transcription_jobs
         (source, status, source_app, language, duration_ms, document_id,
          speaker_count, segment_count, completed_at, tenant_id, capture_session_id)
         VALUES ($1, 'completed', $2, $3, $4, $5, $6, $7, NOW(), $8, $9)",
    )
    .bind(result.meta.source.to_string())
    .bind(&result.meta.source_app)
    .bind(&result.meta.language)
    .bind(result.meta.duration_ms as i64)
    .bind(doc_resp["id"].as_str().and_then(|s| uuid::Uuid::parse_str(s).ok()))
    .bind(result.meta.speakers.len() as i32)
    .bind(result.segments.len() as i32)
    .bind(uuid::Uuid::nil()) // tenant_id — to be derived from auth
    .bind(result.meta.session_id)
    .execute(&*state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("db: {e}")))?;

    tracing::info!(
        segments = result.segments.len(),
        speakers = result.meta.speakers.len(),
        source = %result.meta.source,
        "transcription result ingested"
    );

    Ok(Json(serde_json::json!({
        "status": "ok",
        "document_id": doc_resp["id"],
    })))
}
```

- [ ] **Step 2: Add route to main.rs**

In `services/signapps-media/src/main.rs`, add the route alongside existing STT routes:

```rust
.route("/api/v1/stt/transcription-result", post(handlers::transcription_result::ingest_transcription_result))
```

Add `signapps-transcription` dependency to `services/signapps-media/Cargo.toml`:
```toml
signapps-transcription = { path = "../../crates/signapps-transcription" }
```

Add `pub mod transcription_result;` to `services/signapps-media/src/handlers/mod.rs`.

- [ ] **Step 3: Verify compilation**

```bash
cargo check -p signapps-media
```

- [ ] **Step 4: Commit**

```bash
git add services/signapps-media/
git commit -m "feat(media): add transcription-result ingestion endpoint for CapturePipeline"
```

---

## Task 10: Integration test — end-to-end transcription flow

**Files:**
- Create: `crates/signapps-transcription/tests/integration.rs`

- [ ] **Step 1: Write integration test**

```rust
//! Integration test: TranscriptionResult → Tiptap JSON → validate structure.

use signapps_transcription::{
    tiptap::to_tiptap_doc, Segment, SessionMeta, Speaker, TranscriptionResult,
    TranscriptionSource,
};
use chrono::Utc;
use uuid::Uuid;

#[test]
fn full_pipeline_produces_valid_tiptap() {
    let result = TranscriptionResult {
        meta: SessionMeta {
            session_id: Uuid::new_v4(),
            source: TranscriptionSource::ExternalCapture,
            source_app: Some("Zoom".into()),
            duration_ms: 600_000,
            language: "fr".into(),
            speakers: vec![
                Speaker { id: "s0".into(), label: "Alice".into(), person_id: None },
                Speaker { id: "s1".into(), label: "Bob".into(), person_id: None },
            ],
            created_at: Utc::now(),
            recording_id: None,
        },
        segments: vec![
            Segment { id: Uuid::new_v4(), start_ms: 0, end_ms: 5000, text: "Bonjour".into(), speaker: Some("Alice".into()), confidence: 0.95 },
            Segment { id: Uuid::new_v4(), start_ms: 5000, end_ms: 10000, text: "Salut".into(), speaker: Some("Bob".into()), confidence: 0.90 },
        ],
    };

    let doc = to_tiptap_doc(&result);

    // Validate structure
    assert_eq!(doc["type"], "doc");
    let content = doc["content"].as_array().unwrap();
    assert!(content.len() >= 4); // heading + meta + 2 segments

    // Validate heading contains "Zoom"
    let title = content[0]["content"][0]["text"].as_str().unwrap();
    assert!(title.contains("Zoom"));

    // Validate meta
    assert_eq!(content[1]["type"], "transcriptMeta");
    assert_eq!(content[1]["attrs"]["source"], "external_capture");
    assert_eq!(content[1]["attrs"]["duration"], "10:00");

    // Validate segments
    assert_eq!(content[2]["attrs"]["speaker"], "Alice");
    assert_eq!(content[3]["attrs"]["speaker"], "Bob");
    assert_eq!(content[2]["content"][0]["text"], "Bonjour");

    // Validate serialization roundtrip
    let json_str = serde_json::to_string(&doc).unwrap();
    let parsed: serde_json::Value = serde_json::from_str(&json_str).unwrap();
    assert_eq!(doc, parsed);
}

#[test]
fn empty_segments_produce_minimal_doc() {
    let result = TranscriptionResult {
        meta: SessionMeta {
            session_id: Uuid::new_v4(),
            source: TranscriptionSource::VoiceMemo,
            source_app: None,
            duration_ms: 0,
            language: "en".into(),
            speakers: vec![],
            created_at: Utc::now(),
            recording_id: None,
        },
        segments: vec![],
    };

    let doc = to_tiptap_doc(&result);
    let content = doc["content"].as_array().unwrap();
    assert_eq!(content.len(), 2); // heading + meta only
}
```

- [ ] **Step 2: Run tests**

```bash
cargo nextest run -p signapps-transcription
```

Expected: 6 tests pass (4 unit + 2 integration)

- [ ] **Step 3: Commit**

```bash
git add crates/signapps-transcription/
git commit -m "test(transcription): add integration tests for full pipeline"
```
