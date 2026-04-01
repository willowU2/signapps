//! Tool definitions for the identity service (users, groups, org, vault).

use serde_json::json;
use std::collections::HashMap;

use crate::tools::registry::ToolDefinition;

/// Register all identity tools (users, groups, org chart, persons, vault).
pub fn register(tools: &mut HashMap<String, ToolDefinition>) {
    let defs = [
        // ── Users / Groups ───────────────────────────────────
        ToolDefinition {
            name: "list_users".into(),
            description: "List all users (admin only)".into(),
            service: "identity".into(),
            method: "GET".into(),
            path_template: "/users".into(),
            parameters: json!({}),
            is_write: false,
            min_role: 1,
        },
        ToolDefinition {
            name: "get_user".into(),
            description: "Get details of a specific user (admin only)".into(),
            service: "identity".into(),
            method: "GET".into(),
            path_template: "/users/{id}".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "User ID (UUID)"}
                },
                "required": ["id"]
            }),
            is_write: false,
            min_role: 1,
        },
        ToolDefinition {
            name: "get_me".into(),
            description: "Get current user profile".into(),
            service: "identity".into(),
            method: "GET".into(),
            path_template: "/auth/me".into(),
            parameters: json!({}),
            is_write: false,
            min_role: 0,
        },
        ToolDefinition {
            name: "list_groups".into(),
            description: "List all user groups".into(),
            service: "identity".into(),
            method: "GET".into(),
            path_template: "/groups".into(),
            parameters: json!({}),
            is_write: false,
            min_role: 1,
        },
        // ── Org Structure ────────────────────────────────────
        ToolDefinition {
            name: "get_orgchart".into(),
            description: "Get the organizational chart structure".into(),
            service: "identity".into(),
            method: "GET".into(),
            path_template: "/org/orgchart".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "tree_id": {"type": "string", "description": "Org tree ID (omit for default)"},
                    "date": {"type": "string", "description": "Date to query the chart at (ISO 8601)"}
                }
            }),
            is_write: false,
            min_role: 0,
        },
        ToolDefinition {
            name: "list_persons".into(),
            description: "List persons in the organization (employees, contacts, suppliers)".into(),
            service: "identity".into(),
            method: "GET".into(),
            path_template: "/persons".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "role": {"type": "string", "description": "Filter by role: employee|client_contact|supplier_contact"},
                    "node_id": {"type": "string", "description": "Filter by org node ID"}
                }
            }),
            is_write: false,
            min_role: 0,
        },
        ToolDefinition {
            name: "get_person".into(),
            description: "Get person details including roles and org assignments".into(),
            service: "identity".into(),
            method: "GET".into(),
            path_template: "/persons/{id}".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "Person ID"}
                },
                "required": ["id"]
            }),
            is_write: false,
            min_role: 0,
        },
        ToolDefinition {
            name: "get_org_context".into(),
            description: "Get the current user's organizational context and assignments".into(),
            service: "identity".into(),
            method: "GET".into(),
            path_template: "/org/context".into(),
            parameters: json!({}),
            is_write: false,
            min_role: 0,
        },
        // ── Vault ────────────────────────────────────────────
        ToolDefinition {
            name: "search_vault".into(),
            description: "Search vault items by name (vault must be unlocked first)".into(),
            service: "identity".into(),
            method: "GET".into(),
            path_template: "/vault/items".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "search": {"type": "string", "description": "Search term to filter vault items"}
                }
            }),
            is_write: false,
            min_role: 0,
        },
        ToolDefinition {
            name: "generate_password".into(),
            description: "Generate a secure random password with configurable options".into(),
            service: "identity".into(),
            method: "GET".into(),
            path_template: "/vault/generate-password".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "length": {"type": "integer", "description": "Password length (8-128)"},
                    "uppercase": {"type": "boolean", "description": "Include uppercase letters"},
                    "lowercase": {"type": "boolean", "description": "Include lowercase letters"},
                    "digits": {"type": "boolean", "description": "Include digits"},
                    "symbols": {"type": "boolean", "description": "Include special symbols"}
                }
            }),
            is_write: false,
            min_role: 0,
        },
        ToolDefinition {
            name: "get_totp_code".into(),
            description: "Get the current TOTP 2FA code for a vault item".into(),
            service: "identity".into(),
            method: "POST".into(),
            path_template: "/vault/items/{item_id}/totp".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "item_id": {"type": "string", "description": "Vault item ID"}
                },
                "required": ["item_id"]
            }),
            is_write: false,
            min_role: 0,
        },
    ];

    for def in defs {
        tools.insert(def.name.clone(), def);
    }
}
