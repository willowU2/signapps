//! Tool definitions for the proxy service.

use serde_json::json;
use std::collections::HashMap;

use crate::tools::registry::ToolDefinition;

/// Register all proxy tools.
pub fn register(tools: &mut HashMap<String, ToolDefinition>) {
    let defs = [
        ToolDefinition {
            name: "list_routes".into(),
            description: "List all proxy routes".into(),
            service: "proxy".into(),
            method: "GET".into(),
            path_template: "/routes".into(),
            parameters: json!({}),
            is_write: false,
            min_role: 0,
        },
        ToolDefinition {
            name: "get_proxy_status".into(),
            description: "Get proxy service status and statistics".into(),
            service: "proxy".into(),
            method: "GET".into(),
            path_template: "/status".into(),
            parameters: json!({}),
            is_write: false,
            min_role: 0,
        },
        ToolDefinition {
            name: "create_route".into(),
            description: "Create a new proxy route".into(),
            service: "proxy".into(),
            method: "POST".into(),
            path_template: "/routes".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "hostname": {"type": "string", "description": "Domain hostname"},
                    "target_url": {"type": "string", "description": "Backend target URL"},
                    "tls": {"type": "boolean", "description": "Enable TLS"}
                },
                "required": ["hostname", "target_url"]
            }),
            is_write: true,
            min_role: 1,
        },
        ToolDefinition {
            name: "enable_route".into(),
            description: "Enable a proxy route".into(),
            service: "proxy".into(),
            method: "POST".into(),
            path_template: "/routes/{id}/enable".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "Route ID"}
                },
                "required": ["id"]
            }),
            is_write: true,
            min_role: 1,
        },
        ToolDefinition {
            name: "disable_route".into(),
            description: "Disable a proxy route".into(),
            service: "proxy".into(),
            method: "POST".into(),
            path_template: "/routes/{id}/disable".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "Route ID"}
                },
                "required": ["id"]
            }),
            is_write: true,
            min_role: 1,
        },
        ToolDefinition {
            name: "delete_route".into(),
            description: "Delete a proxy route".into(),
            service: "proxy".into(),
            method: "DELETE".into(),
            path_template: "/routes/{id}".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "Route ID"}
                },
                "required": ["id"]
            }),
            is_write: true,
            min_role: 1,
        },
    ];

    for def in defs {
        tools.insert(def.name.clone(), def);
    }
}
