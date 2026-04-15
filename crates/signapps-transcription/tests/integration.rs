//! Integration test: TranscriptionResult -> Tiptap JSON -> validate structure.

use chrono::Utc;
use signapps_transcription::{
    tiptap::to_tiptap_doc, Segment, SessionMeta, Speaker, TranscriptionResult, TranscriptionSource,
};
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
                Speaker {
                    id: "s0".into(),
                    label: "Alice".into(),
                    person_id: None,
                },
                Speaker {
                    id: "s1".into(),
                    label: "Bob".into(),
                    person_id: None,
                },
            ],
            created_at: Utc::now(),
            recording_id: None,
        },
        segments: vec![
            Segment {
                id: Uuid::new_v4(),
                start_ms: 0,
                end_ms: 5000,
                text: "Bonjour".into(),
                speaker: Some("Alice".into()),
                confidence: 0.95,
            },
            Segment {
                id: Uuid::new_v4(),
                start_ms: 5000,
                end_ms: 10000,
                text: "Salut".into(),
                speaker: Some("Bob".into()),
                confidence: 0.90,
            },
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
