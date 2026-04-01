//! Tool definitions for the notifications service.

use serde_json::json;
use std::collections::HashMap;

use crate::tools::registry::ToolDefinition;

/// Register all notifications tools.
pub fn register(tools: &mut HashMap<String, ToolDefinition>) {
    let defs = [
        ToolDefinition {
            name: "send_notification".into(),
            description: "Send a push notification to a specific user".into(),
            service: "notifications".into(),
            method: "POST".into(),
            path_template: "/notifications/send".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "user_id": {"type": "string", "description": "Target user ID"},
                    "title": {"type": "string", "description": "Notification title"},
                    "body": {"type": "string", "description": "Notification body text"}
                },
                "required": ["user_id", "title", "body"]
            }),
            is_write: true,
            min_role: 0,
        },
        ToolDefinition {
            name: "list_notifications".into(),
            description: "List recent notifications for the current user".into(),
            service: "notifications".into(),
            method: "GET".into(),
            path_template: "/notifications".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "description": "Max notifications to return"}
                }
            }),
            is_write: false,
            min_role: 0,
        },
        ToolDefinition {
            name: "mark_notification_read".into(),
            description: "Mark a notification as read".into(),
            service: "notifications".into(),
            method: "PUT".into(),
            path_template: "/notifications/{id}/read".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "Notification ID"}
                },
                "required": ["id"]
            }),
            is_write: true,
            min_role: 0,
        },
    ];

    for def in defs {
        tools.insert(def.name.clone(), def);
    }
}
