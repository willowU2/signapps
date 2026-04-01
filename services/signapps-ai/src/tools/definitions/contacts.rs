//! Tool definitions for the contacts service.

use serde_json::json;
use std::collections::HashMap;

use crate::tools::registry::ToolDefinition;

/// Register all contacts tools.
pub fn register(tools: &mut HashMap<String, ToolDefinition>) {
    let defs = [
        ToolDefinition {
            name: "list_contacts".into(),
            description: "List contacts, optionally filtered by search query".into(),
            service: "contacts".into(),
            method: "GET".into(),
            path_template: "/contacts".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "search": {"type": "string", "description": "Search query to filter contacts"},
                    "limit": {"type": "integer", "description": "Max contacts to return"}
                }
            }),
            is_write: false,
            min_role: 0,
        },
        ToolDefinition {
            name: "get_contact".into(),
            description: "Get full details of a contact by ID".into(),
            service: "contacts".into(),
            method: "GET".into(),
            path_template: "/contacts/{id}".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "Contact ID"}
                },
                "required": ["id"]
            }),
            is_write: false,
            min_role: 0,
        },
        ToolDefinition {
            name: "create_contact".into(),
            description: "Create a new contact".into(),
            service: "contacts".into(),
            method: "POST".into(),
            path_template: "/contacts".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "first_name": {"type": "string", "description": "First name"},
                    "last_name": {"type": "string", "description": "Last name"},
                    "email": {"type": "string", "description": "Email address"},
                    "phone": {"type": "string", "description": "Phone number"},
                    "company": {"type": "string", "description": "Company name"}
                },
                "required": ["first_name", "last_name"]
            }),
            is_write: true,
            min_role: 0,
        },
        ToolDefinition {
            name: "update_contact".into(),
            description: "Update an existing contact".into(),
            service: "contacts".into(),
            method: "PUT".into(),
            path_template: "/contacts/{id}".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "Contact ID"},
                    "first_name": {"type": "string", "description": "First name"},
                    "last_name": {"type": "string", "description": "Last name"},
                    "email": {"type": "string", "description": "Email address"},
                    "phone": {"type": "string", "description": "Phone number"},
                    "company": {"type": "string", "description": "Company name"}
                },
                "required": ["id"]
            }),
            is_write: true,
            min_role: 0,
        },
        ToolDefinition {
            name: "search_contacts".into(),
            description: "Search contacts by name, email, or company".into(),
            service: "contacts".into(),
            method: "GET".into(),
            path_template: "/contacts/search".into(),
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
