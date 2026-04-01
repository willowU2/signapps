//! Tool definitions for the storage service (buckets, files, and drive/documents).

use serde_json::json;
use std::collections::HashMap;

use crate::tools::registry::ToolDefinition;

/// Register all storage and drive tools.
pub fn register(tools: &mut HashMap<String, ToolDefinition>) {
    let defs = [
        // ── Buckets / Files ──────────────────────────────────
        ToolDefinition {
            name: "list_buckets".into(),
            description: "List all storage buckets".into(),
            service: "storage".into(),
            method: "GET".into(),
            path_template: "/buckets".into(),
            parameters: json!({}),
            is_write: false,
            min_role: 0,
        },
        ToolDefinition {
            name: "list_files".into(),
            description: "List files in a bucket, optionally filtered by prefix".into(),
            service: "storage".into(),
            method: "GET".into(),
            path_template: "/buckets/{bucket}/files".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "bucket": {"type": "string", "description": "Bucket name"},
                    "prefix": {"type": "string", "description": "File path prefix filter"}
                },
                "required": ["bucket"]
            }),
            is_write: false,
            min_role: 0,
        },
        ToolDefinition {
            name: "get_file_info".into(),
            description: "Get metadata about a specific file".into(),
            service: "storage".into(),
            method: "GET".into(),
            path_template: "/buckets/{bucket}/files/{path}/info".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "bucket": {"type": "string", "description": "Bucket name"},
                    "path": {"type": "string", "description": "File path"}
                },
                "required": ["bucket", "path"]
            }),
            is_write: false,
            min_role: 0,
        },
        ToolDefinition {
            name: "search_files".into(),
            description: "Search for files by name or pattern".into(),
            service: "storage".into(),
            method: "GET".into(),
            path_template: "/search".into(),
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
        ToolDefinition {
            name: "create_bucket".into(),
            description: "Create a new storage bucket".into(),
            service: "storage".into(),
            method: "POST".into(),
            path_template: "/buckets".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Bucket name"}
                },
                "required": ["name"]
            }),
            is_write: true,
            min_role: 1,
        },
        ToolDefinition {
            name: "delete_file".into(),
            description: "Delete a file from a bucket".into(),
            service: "storage".into(),
            method: "DELETE".into(),
            path_template: "/buckets/{bucket}/files/{path}".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "bucket": {"type": "string", "description": "Bucket name"},
                    "path": {"type": "string", "description": "File path"}
                },
                "required": ["bucket", "path"]
            }),
            is_write: true,
            min_role: 0,
        },
        // ── Drive / Documents ────────────────────────────────
        ToolDefinition {
            name: "list_documents".into(),
            description: "List documents and folders in drive root or a specific folder".into(),
            service: "storage".into(),
            method: "GET".into(),
            path_template: "/drive/nodes/root".into(),
            parameters: json!({}),
            is_write: false,
            min_role: 0,
        },
        ToolDefinition {
            name: "create_document".into(),
            description: "Create a new document, spreadsheet, presentation, or folder in drive"
                .into(),
            service: "storage".into(),
            method: "POST".into(),
            path_template: "/drive/nodes".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Document or folder name"},
                    "node_type": {
                        "type": "string",
                        "description": "Type: document|folder|spreadsheet|presentation"
                    },
                    "parent_id": {"type": "string", "description": "Parent folder ID (omit for root)"}
                },
                "required": ["name", "node_type"]
            }),
            is_write: true,
            min_role: 0,
        },
        ToolDefinition {
            name: "search_documents".into(),
            description: "Search drive documents by name or content".into(),
            service: "storage".into(),
            method: "GET".into(),
            path_template: "/search".into(),
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
        ToolDefinition {
            name: "get_document".into(),
            description: "Get details and metadata of a drive document or folder".into(),
            service: "storage".into(),
            method: "GET".into(),
            path_template: "/drive/nodes/{id}".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "Node ID"}
                },
                "required": ["id"]
            }),
            is_write: false,
            min_role: 0,
        },
        ToolDefinition {
            name: "move_document".into(),
            description: "Move a drive document or folder to another folder".into(),
            service: "storage".into(),
            method: "PUT".into(),
            path_template: "/drive/nodes/{id}".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "Node ID"},
                    "parent_id": {"type": "string", "description": "Destination folder ID"}
                },
                "required": ["id", "parent_id"]
            }),
            is_write: true,
            min_role: 0,
        },
    ];

    for def in defs {
        tools.insert(def.name.clone(), def);
    }
}
