//! Tool definitions for the media service (TTS, STT).

use serde_json::json;
use std::collections::HashMap;

use crate::tools::registry::ToolDefinition;

/// Register all media tools.
pub fn register(tools: &mut HashMap<String, ToolDefinition>) {
    let defs = [
        ToolDefinition {
            name: "list_tts_voices".into(),
            description: "List available text-to-speech voices".into(),
            service: "media".into(),
            method: "GET".into(),
            path_template: "/tts/voices".into(),
            parameters: json!({}),
            is_write: false,
            min_role: 0,
        },
        ToolDefinition {
            name: "list_stt_models".into(),
            description: "List available speech-to-text models".into(),
            service: "media".into(),
            method: "GET".into(),
            path_template: "/stt/models".into(),
            parameters: json!({}),
            is_write: false,
            min_role: 0,
        },
    ];

    for def in defs {
        tools.insert(def.name.clone(), def);
    }
}
