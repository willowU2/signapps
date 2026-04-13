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

/// Unified transcription output -- contract shared by all pipelines.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptionResult {
    pub meta: SessionMeta,
    pub segments: Vec<Segment>,
}
