//! Convert TranscriptionResult into Tiptap-compatible JSON.

use crate::types::{TranscriptionResult, TranscriptionSource};
use serde_json::{json, Value};

/// Convert a TranscriptionResult into a Tiptap document JSON.
///
/// Produces a document with a heading (title based on source type and date),
/// a `transcriptMeta` node with duration/source/speakers/language,
/// and one `transcriptSegment` node per segment.
///
/// # Examples
///
/// ```
/// use signapps_transcription::types::*;
/// use signapps_transcription::tiptap::to_tiptap_doc;
/// use chrono::Utc;
/// use uuid::Uuid;
///
/// let result = TranscriptionResult {
///     meta: SessionMeta {
///         session_id: Uuid::new_v4(),
///         source: TranscriptionSource::Meet,
///         source_app: None,
///         duration_ms: 60000,
///         language: "fr".into(),
///         speakers: vec![],
///         created_at: Utc::now(),
///         recording_id: None,
///     },
///     segments: vec![],
/// };
/// let doc = to_tiptap_doc(&result);
/// assert_eq!(doc["type"], "doc");
/// ```
///
/// # Errors
///
/// This function is infallible — it always returns a valid JSON value.
///
/// # Panics
///
/// None — all branches are covered.
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
            let app = result.meta.source_app.as_deref().unwrap_or("External");
            format!("{app} — {date}")
        },
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
                duration_ms: 2_535_000,
                language: "fr".into(),
                speakers: vec![
                    Speaker {
                        id: "s0".into(),
                        label: "Pierre Durand".into(),
                        person_id: None,
                    },
                    Speaker {
                        id: "s1".into(),
                        label: "Marie Béranger".into(),
                        person_id: None,
                    },
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
                    start_ms: 105_000,
                    end_ms: 112_000,
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
        assert_eq!(format_duration(3_661_000), "01:01:01");
        assert_eq!(format_duration(0), "00:00");
        assert_eq!(format_duration(90000), "01:30");
    }
}
