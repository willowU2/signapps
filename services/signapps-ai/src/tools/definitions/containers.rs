//! Tool definitions for the containers service.

use serde_json::json;
use std::collections::HashMap;

use crate::tools::registry::ToolDefinition;

/// Register all container tools.
pub fn register(tools: &mut HashMap<String, ToolDefinition>) {
    let defs = [
        ToolDefinition {
            name: "list_containers".into(),
            description: "List all Docker containers with their status".into(),
            service: "containers".into(),
            method: "GET".into(),
            path_template: "/containers".into(),
            parameters: json!({}),
            is_write: false,
            min_role: 0,
        },
        ToolDefinition {
            name: "get_container".into(),
            description: "Get details of a specific container by ID".into(),
            service: "containers".into(),
            method: "GET".into(),
            path_template: "/containers/{id}".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "Container ID"}
                },
                "required": ["id"]
            }),
            is_write: false,
            min_role: 0,
        },
        ToolDefinition {
            name: "container_logs".into(),
            description: "Get logs of a container".into(),
            service: "containers".into(),
            method: "GET".into(),
            path_template: "/containers/{id}/logs".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "Container ID"},
                    "tail": {"type": "integer", "description": "Number of log lines (default 50)"}
                },
                "required": ["id"]
            }),
            is_write: false,
            min_role: 0,
        },
        ToolDefinition {
            name: "container_stats".into(),
            description: "Get resource usage stats of a container".into(),
            service: "containers".into(),
            method: "GET".into(),
            path_template: "/containers/{id}/stats".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "Container ID"}
                },
                "required": ["id"]
            }),
            is_write: false,
            min_role: 0,
        },
        ToolDefinition {
            name: "list_store_apps".into(),
            description: "List available apps from the app store".into(),
            service: "containers".into(),
            method: "GET".into(),
            path_template: "/store/apps".into(),
            parameters: json!({}),
            is_write: false,
            min_role: 0,
        },
        ToolDefinition {
            name: "start_container".into(),
            description: "Start a stopped container".into(),
            service: "containers".into(),
            method: "POST".into(),
            path_template: "/containers/{id}/start".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "Container ID"}
                },
                "required": ["id"]
            }),
            is_write: true,
            min_role: 0,
        },
        ToolDefinition {
            name: "stop_container".into(),
            description: "Stop a running container".into(),
            service: "containers".into(),
            method: "POST".into(),
            path_template: "/containers/{id}/stop".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "Container ID"}
                },
                "required": ["id"]
            }),
            is_write: true,
            min_role: 0,
        },
        ToolDefinition {
            name: "restart_container".into(),
            description: "Restart a container".into(),
            service: "containers".into(),
            method: "POST".into(),
            path_template: "/containers/{id}/restart".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "Container ID"}
                },
                "required": ["id"]
            }),
            is_write: true,
            min_role: 0,
        },
        ToolDefinition {
            name: "delete_container".into(),
            description: "Delete a container (must be stopped first)".into(),
            service: "containers".into(),
            method: "DELETE".into(),
            path_template: "/containers/{id}".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "Container ID"}
                },
                "required": ["id"]
            }),
            is_write: true,
            min_role: 1,
        },
        ToolDefinition {
            name: "install_app".into(),
            description: "Install an app from the app store".into(),
            service: "containers".into(),
            method: "POST".into(),
            path_template: "/store/install".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "app_id": {"type": "string", "description": "App ID from the store"}
                },
                "required": ["app_id"]
            }),
            is_write: true,
            min_role: 1,
        },
    ];

    for def in defs {
        tools.insert(def.name.clone(), def);
    }
}
