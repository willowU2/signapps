//! Tool definitions for the scheduler service.

use serde_json::json;
use std::collections::HashMap;

use crate::tools::registry::ToolDefinition;

/// Register all scheduler tools.
pub fn register(tools: &mut HashMap<String, ToolDefinition>) {
    let defs = [
        ToolDefinition {
            name: "list_jobs".into(),
            description: "List all scheduled jobs".into(),
            service: "scheduler".into(),
            method: "GET".into(),
            path_template: "/jobs".into(),
            parameters: json!({}),
            is_write: false,
            min_role: 0,
        },
        ToolDefinition {
            name: "get_scheduler_stats".into(),
            description: "Get scheduler statistics and job summaries".into(),
            service: "scheduler".into(),
            method: "GET".into(),
            path_template: "/stats".into(),
            parameters: json!({}),
            is_write: false,
            min_role: 0,
        },
        ToolDefinition {
            name: "create_job".into(),
            description: "Create a new scheduled job".into(),
            service: "scheduler".into(),
            method: "POST".into(),
            path_template: "/jobs".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Job name"},
                    "cron": {"type": "string", "description": "Cron expression"},
                    "command": {"type": "string", "description": "Command to execute"},
                    "enabled": {"type": "boolean", "description": "Whether job is active"}
                },
                "required": ["name", "cron", "command"]
            }),
            is_write: true,
            min_role: 1,
        },
        ToolDefinition {
            name: "run_job".into(),
            description: "Trigger a job to run immediately".into(),
            service: "scheduler".into(),
            method: "POST".into(),
            path_template: "/jobs/{id}/run".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "Job ID"}
                },
                "required": ["id"]
            }),
            is_write: true,
            min_role: 1,
        },
        ToolDefinition {
            name: "enable_job".into(),
            description: "Enable a scheduled job".into(),
            service: "scheduler".into(),
            method: "POST".into(),
            path_template: "/jobs/{id}/enable".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "Job ID"}
                },
                "required": ["id"]
            }),
            is_write: true,
            min_role: 1,
        },
        ToolDefinition {
            name: "disable_job".into(),
            description: "Disable a scheduled job".into(),
            service: "scheduler".into(),
            method: "POST".into(),
            path_template: "/jobs/{id}/disable".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "Job ID"}
                },
                "required": ["id"]
            }),
            is_write: true,
            min_role: 1,
        },
        ToolDefinition {
            name: "delete_job".into(),
            description: "Delete a scheduled job".into(),
            service: "scheduler".into(),
            method: "DELETE".into(),
            path_template: "/jobs/{id}".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "Job ID"}
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
