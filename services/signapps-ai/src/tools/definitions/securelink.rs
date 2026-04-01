//! Tool definitions for the securelink service (tunnels, DNS).

use serde_json::json;
use std::collections::HashMap;

use crate::tools::registry::ToolDefinition;

/// Register all securelink tools.
pub fn register(tools: &mut HashMap<String, ToolDefinition>) {
    let defs = [
        ToolDefinition {
            name: "list_tunnels".into(),
            description: "List all active tunnels".into(),
            service: "securelink".into(),
            method: "GET".into(),
            path_template: "/tunnels".into(),
            parameters: json!({}),
            is_write: false,
            min_role: 0,
        },
        ToolDefinition {
            name: "get_tunnel_status".into(),
            description: "Get status of a specific tunnel".into(),
            service: "securelink".into(),
            method: "GET".into(),
            path_template: "/tunnels/{id}".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "Tunnel ID"}
                },
                "required": ["id"]
            }),
            is_write: false,
            min_role: 0,
        },
        ToolDefinition {
            name: "get_dns_config".into(),
            description: "Get DNS configuration".into(),
            service: "securelink".into(),
            method: "GET".into(),
            path_template: "/dns/config".into(),
            parameters: json!({}),
            is_write: false,
            min_role: 0,
        },
        ToolDefinition {
            name: "get_dns_stats".into(),
            description: "Get DNS query statistics".into(),
            service: "securelink".into(),
            method: "GET".into(),
            path_template: "/dns/stats".into(),
            parameters: json!({}),
            is_write: false,
            min_role: 0,
        },
        ToolDefinition {
            name: "create_tunnel".into(),
            description: "Create a new tunnel".into(),
            service: "securelink".into(),
            method: "POST".into(),
            path_template: "/tunnels".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Tunnel name"},
                    "target": {"type": "string", "description": "Target address (host:port)"},
                    "protocol": {"type": "string", "description": "Protocol (tcp/http)"}
                },
                "required": ["name", "target"]
            }),
            is_write: true,
            min_role: 1,
        },
    ];

    for def in defs {
        tools.insert(def.name.clone(), def);
    }
}
