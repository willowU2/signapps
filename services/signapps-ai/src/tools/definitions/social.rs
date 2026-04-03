//! Tool definitions for the social service.

use serde_json::json;
use std::collections::HashMap;

use crate::tools::registry::ToolDefinition;

/// Register all social tools.
pub fn register(tools: &mut HashMap<String, ToolDefinition>) {
    let defs = [
        ToolDefinition {
            name: "list_social_accounts".into(),
            description: "List connected social media accounts".into(),
            service: "social".into(),
            method: "GET".into(),
            path_template: "/social/accounts".into(),
            parameters: json!({}),
            is_write: false,
            min_role: 0,
        },
        ToolDefinition {
            name: "create_social_post".into(),
            description: "Create and publish (or schedule) a social media post".into(),
            service: "social".into(),
            method: "POST".into(),
            path_template: "/social/posts".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "content": {"type": "string", "description": "Post content"},
                    "account_ids": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Account IDs to post to"
                    },
                    "scheduled_at": {"type": "string", "description": "Schedule datetime (ISO 8601), omit to post immediately"}
                },
                "required": ["content"]
            }),
            is_write: true,
            min_role: 0,
        },
        ToolDefinition {
            name: "list_social_posts".into(),
            description: "List social media posts by status".into(),
            service: "social".into(),
            method: "GET".into(),
            path_template: "/social/posts".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "status": {"type": "string", "description": "Filter by status: draft|published|scheduled"}
                }
            }),
            is_write: false,
            min_role: 0,
        },
        ToolDefinition {
            name: "get_social_analytics".into(),
            description: "Get social media analytics overview (reach, engagement, followers)"
                .into(),
            service: "social".into(),
            method: "GET".into(),
            path_template: "/social/analytics/overview".into(),
            parameters: json!({}),
            is_write: false,
            min_role: 0,
        },
    ];

    for def in defs {
        tools.insert(def.name.clone(), def);
    }
}
