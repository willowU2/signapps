//! Tool definitions for the billing service.

use serde_json::json;
use std::collections::HashMap;

use crate::tools::registry::ToolDefinition;

/// Register all billing tools.
pub fn register(tools: &mut HashMap<String, ToolDefinition>) {
    let defs = [
        ToolDefinition {
            name: "list_invoices".into(),
            description: "List invoices, optionally filtered by status".into(),
            service: "billing".into(),
            method: "GET".into(),
            path_template: "/invoices".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "status": {"type": "string", "description": "Filter by status: draft|sent|paid|overdue"}
                }
            }),
            is_write: false,
            min_role: 0,
        },
        ToolDefinition {
            name: "create_invoice".into(),
            description: "Create a new invoice for a client".into(),
            service: "billing".into(),
            method: "POST".into(),
            path_template: "/invoices".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "client_name": {"type": "string", "description": "Client name"},
                    "items": {
                        "type": "array",
                        "description": "Line items",
                        "items": {
                            "type": "object",
                            "properties": {
                                "description": {"type": "string"},
                                "quantity": {"type": "number"},
                                "unit_price": {"type": "number"}
                            }
                        }
                    },
                    "due_date": {"type": "string", "description": "Due date (ISO 8601)"}
                },
                "required": ["client_name", "items"]
            }),
            is_write: true,
            min_role: 0,
        },
        ToolDefinition {
            name: "get_billing_stats".into(),
            description: "Get billing statistics and revenue overview".into(),
            service: "billing".into(),
            method: "GET".into(),
            path_template: "/billing/stats".into(),
            parameters: json!({}),
            is_write: false,
            min_role: 0,
        },
    ];

    for def in defs {
        tools.insert(def.name.clone(), def);
    }
}
