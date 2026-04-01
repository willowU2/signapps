//! Tool definitions for the chat service.

use serde_json::json;
use std::collections::HashMap;

use crate::tools::registry::ToolDefinition;

/// Register all chat tools.
pub fn register(tools: &mut HashMap<String, ToolDefinition>) {
    let defs = [
        ToolDefinition {
            name: "list_channels".into(),
            description: "List all chat channels the current user has access to".into(),
            service: "chat".into(),
            method: "GET".into(),
            path_template: "/channels".into(),
            parameters: json!({}),
            is_write: false,
            min_role: 0,
        },
        ToolDefinition {
            name: "send_message".into(),
            description: "Send a message to a chat channel".into(),
            service: "chat".into(),
            method: "POST".into(),
            path_template: "/channels/{channel_id}/messages".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "channel_id": {"type": "string", "description": "Channel ID"},
                    "content": {"type": "string", "description": "Message content"}
                },
                "required": ["channel_id", "content"]
            }),
            is_write: true,
            min_role: 0,
        },
        ToolDefinition {
            name: "list_messages".into(),
            description: "List recent messages in a chat channel".into(),
            service: "chat".into(),
            method: "GET".into(),
            path_template: "/channels/{channel_id}/messages".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "channel_id": {"type": "string", "description": "Channel ID"},
                    "limit": {"type": "integer", "description": "Max messages to return"}
                },
                "required": ["channel_id"]
            }),
            is_write: false,
            min_role: 0,
        },
        ToolDefinition {
            name: "create_channel".into(),
            description: "Create a new chat channel".into(),
            service: "chat".into(),
            method: "POST".into(),
            path_template: "/channels".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Channel name"},
                    "topic": {"type": "string", "description": "Channel topic"},
                    "is_private": {"type": "boolean", "description": "Whether the channel is private"}
                },
                "required": ["name"]
            }),
            is_write: true,
            min_role: 0,
        },
        ToolDefinition {
            name: "search_messages".into(),
            description: "Search messages across all chat channels".into(),
            service: "chat".into(),
            method: "GET".into(),
            path_template: "/messages/search".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query"}
                },
                "required": ["query"]
            }),
            is_write: false,
            min_role: 0,
        },
    ];

    for def in defs {
        tools.insert(def.name.clone(), def);
    }
}
