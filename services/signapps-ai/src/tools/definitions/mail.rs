//! Tool definitions for the mail service.

use serde_json::json;
use std::collections::HashMap;

use crate::tools::registry::ToolDefinition;

/// Register all mail tools.
pub fn register(tools: &mut HashMap<String, ToolDefinition>) {
    let defs = [
        ToolDefinition {
            name: "list_emails".into(),
            description: "List emails in inbox, sent, or a specific folder".into(),
            service: "mail".into(),
            method: "GET".into(),
            path_template: "/emails".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "folder": {"type": "string", "description": "Folder name: inbox|sent|drafts|trash"},
                    "limit": {"type": "integer", "description": "Max emails to return"},
                    "search": {"type": "string", "description": "Search query to filter emails"}
                }
            }),
            is_write: false,
            min_role: 0,
        },
        ToolDefinition {
            name: "read_email".into(),
            description: "Read a specific email by ID".into(),
            service: "mail".into(),
            method: "GET".into(),
            path_template: "/emails/{id}".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "Email ID"}
                },
                "required": ["id"]
            }),
            is_write: false,
            min_role: 0,
        },
        ToolDefinition {
            name: "send_email".into(),
            description: "Send an email to one or more recipients".into(),
            service: "mail".into(),
            method: "POST".into(),
            path_template: "/emails/send".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "to": {"type": "array", "items": {"type": "string"}, "description": "Recipient email addresses"},
                    "subject": {"type": "string", "description": "Email subject"},
                    "body": {"type": "string", "description": "Email body (plain text or HTML)"},
                    "cc": {"type": "array", "items": {"type": "string"}, "description": "CC addresses"},
                    "bcc": {"type": "array", "items": {"type": "string"}, "description": "BCC addresses"}
                },
                "required": ["to", "subject", "body"]
            }),
            is_write: true,
            min_role: 0,
        },
        ToolDefinition {
            name: "reply_email".into(),
            description: "Reply to an existing email".into(),
            service: "mail".into(),
            method: "POST".into(),
            path_template: "/emails/{id}/reply".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "Email ID to reply to"},
                    "body": {"type": "string", "description": "Reply body"}
                },
                "required": ["id", "body"]
            }),
            is_write: true,
            min_role: 0,
        },
        ToolDefinition {
            name: "forward_email".into(),
            description: "Forward an email to other recipients".into(),
            service: "mail".into(),
            method: "POST".into(),
            path_template: "/emails/{id}/forward".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "Email ID to forward"},
                    "to": {"type": "array", "items": {"type": "string"}, "description": "Recipient email addresses"},
                    "body": {"type": "string", "description": "Additional message to prepend"}
                },
                "required": ["id", "to"]
            }),
            is_write: true,
            min_role: 0,
        },
        ToolDefinition {
            name: "delete_email".into(),
            description: "Move an email to trash".into(),
            service: "mail".into(),
            method: "DELETE".into(),
            path_template: "/emails/{id}".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "Email ID"}
                },
                "required": ["id"]
            }),
            is_write: true,
            min_role: 0,
        },
        ToolDefinition {
            name: "search_emails".into(),
            description: "Full-text search across all emails".into(),
            service: "mail".into(),
            method: "GET".into(),
            path_template: "/emails/search".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query"},
                    "limit": {"type": "integer", "description": "Max results to return"}
                },
                "required": ["query"]
            }),
            is_write: false,
            min_role: 0,
        },
        ToolDefinition {
            name: "list_mail_accounts".into(),
            description: "List configured email accounts".into(),
            service: "mail".into(),
            method: "GET".into(),
            path_template: "/accounts".into(),
            parameters: json!({}),
            is_write: false,
            min_role: 0,
        },
    ];

    for def in defs {
        tools.insert(def.name.clone(), def);
    }
}
