//! Tool definitions for the metrics service.

use serde_json::json;
use std::collections::HashMap;

use crate::tools::registry::ToolDefinition;

/// Register all metrics tools.
pub fn register(tools: &mut HashMap<String, ToolDefinition>) {
    let defs = [
        ToolDefinition {
            name: "get_system_metrics".into(),
            description: "Get overall system metrics (CPU, memory, disk, network)".into(),
            service: "metrics".into(),
            method: "GET".into(),
            path_template: "/metrics/system".into(),
            parameters: json!({}),
            is_write: false,
            min_role: 0,
        },
        ToolDefinition {
            name: "get_cpu".into(),
            description: "Get detailed CPU usage metrics".into(),
            service: "metrics".into(),
            method: "GET".into(),
            path_template: "/metrics/cpu".into(),
            parameters: json!({}),
            is_write: false,
            min_role: 0,
        },
        ToolDefinition {
            name: "get_memory".into(),
            description: "Get memory usage metrics".into(),
            service: "metrics".into(),
            method: "GET".into(),
            path_template: "/metrics/memory".into(),
            parameters: json!({}),
            is_write: false,
            min_role: 0,
        },
        ToolDefinition {
            name: "get_disk".into(),
            description: "Get disk usage metrics".into(),
            service: "metrics".into(),
            method: "GET".into(),
            path_template: "/metrics/disk".into(),
            parameters: json!({}),
            is_write: false,
            min_role: 0,
        },
        ToolDefinition {
            name: "get_network".into(),
            description: "Get network I/O metrics".into(),
            service: "metrics".into(),
            method: "GET".into(),
            path_template: "/metrics/network".into(),
            parameters: json!({}),
            is_write: false,
            min_role: 0,
        },
    ];

    for def in defs {
        tools.insert(def.name.clone(), def);
    }
}
