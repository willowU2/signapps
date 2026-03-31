//! Tool definitions and registry for all SignApps services.

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;

/// A single tool definition.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolDefinition {
    /// Unique tool name (e.g. "list_containers").
    pub name: String,
    /// Human-readable description.
    pub description: String,
    /// Target service (e.g. "containers").
    pub service: String,
    /// HTTP method.
    pub method: String,
    /// URL path template (e.g. "/containers/{id}").
    pub path_template: String,
    /// JSON Schema for parameters.
    pub parameters: Value,
    /// Whether this tool performs writes.
    pub is_write: bool,
    /// Minimum role required (0=user, 1=admin).
    pub min_role: i16,
}

/// Registry holding all available tools.
#[derive(Debug, Clone)]
pub struct ToolRegistry {
    tools: HashMap<String, ToolDefinition>,
}

impl ToolRegistry {
    /// Build the full registry with all service tools.
    pub fn new() -> Self {
        let mut tools = HashMap::new();

        // ── Containers ──────────────────────────────────────
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );

        // ── Metrics ─────────────────────────────────────────
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );

        // ── Storage ─────────────────────────────────────────
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );

        // ── Proxy ───────────────────────────────────────────
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );

        // ── Scheduler ───────────────────────────────────────
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );

        // ── Identity ────────────────────────────────────────
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );

        // ── SecureLink ──────────────────────────────────────
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );

        // ── Media ───────────────────────────────────────────
        Self::add(
            &mut tools,
            ToolDefinition {
                name: "list_tts_voices".into(),
                description: "List available text-to-speech voices".into(),
                service: "media".into(),
                method: "GET".into(),
                path_template: "/tts/voices".into(),
                parameters: json!({}),
                is_write: false,
                min_role: 0,
            },
        );
        Self::add(
            &mut tools,
            ToolDefinition {
                name: "list_stt_models".into(),
                description: "List available speech-to-text models".into(),
                service: "media".into(),
                method: "GET".into(),
                path_template: "/stt/models".into(),
                parameters: json!({}),
                is_write: false,
                min_role: 0,
            },
        );

        // ── Mail ────────────────────────────────────────────
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );

        // ── Calendar ─────────────────────────────────────────
        Self::add(
            &mut tools,
            ToolDefinition {
                name: "list_calendars".into(),
                description: "List all calendars accessible to the current user".into(),
                service: "calendar".into(),
                method: "GET".into(),
                path_template: "/calendars".into(),
                parameters: json!({}),
                is_write: false,
                min_role: 0,
            },
        );
        Self::add(
            &mut tools,
            ToolDefinition {
                name: "list_events".into(),
                description: "List calendar events in a date range".into(),
                service: "calendar".into(),
                method: "GET".into(),
                path_template: "/calendars/{calendar_id}/events".into(),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "calendar_id": {"type": "string", "description": "Calendar ID"},
                        "start": {"type": "string", "description": "Start date (ISO 8601)"},
                        "end": {"type": "string", "description": "End date (ISO 8601)"}
                    },
                    "required": ["calendar_id"]
                }),
                is_write: false,
                min_role: 0,
            },
        );
        Self::add(
            &mut tools,
            ToolDefinition {
                name: "create_event".into(),
                description: "Create a calendar event or meeting".into(),
                service: "calendar".into(),
                method: "POST".into(),
                path_template: "/calendars/{calendar_id}/events".into(),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "calendar_id": {"type": "string", "description": "Calendar ID"},
                        "title": {"type": "string", "description": "Event title"},
                        "start_time": {"type": "string", "description": "Start datetime (ISO 8601)"},
                        "end_time": {"type": "string", "description": "End datetime (ISO 8601)"},
                        "description": {"type": "string", "description": "Event description"},
                        "location": {"type": "string", "description": "Event location"},
                        "attendees": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Attendee email addresses"
                        }
                    },
                    "required": ["calendar_id", "title", "start_time", "end_time"]
                }),
                is_write: true,
                min_role: 0,
            },
        );
        Self::add(
            &mut tools,
            ToolDefinition {
                name: "update_event".into(),
                description: "Update an existing calendar event".into(),
                service: "calendar".into(),
                method: "PUT".into(),
                path_template: "/events/{id}".into(),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "id": {"type": "string", "description": "Event ID"},
                        "title": {"type": "string", "description": "New event title"},
                        "start_time": {"type": "string", "description": "New start datetime (ISO 8601)"},
                        "end_time": {"type": "string", "description": "New end datetime (ISO 8601)"},
                        "description": {"type": "string", "description": "New description"},
                        "location": {"type": "string", "description": "New location"}
                    },
                    "required": ["id"]
                }),
                is_write: true,
                min_role: 0,
            },
        );
        Self::add(
            &mut tools,
            ToolDefinition {
                name: "delete_event".into(),
                description: "Delete a calendar event".into(),
                service: "calendar".into(),
                method: "DELETE".into(),
                path_template: "/events/{id}".into(),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "id": {"type": "string", "description": "Event ID"}
                    },
                    "required": ["id"]
                }),
                is_write: true,
                min_role: 0,
            },
        );
        Self::add(
            &mut tools,
            ToolDefinition {
                name: "find_free_slots".into(),
                description: "Find available meeting time slots for a group of participants".into(),
                service: "calendar".into(),
                method: "POST".into(),
                path_template: "/calendar/meeting-suggestions".into(),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "participants": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "User IDs of participants"
                        },
                        "duration_minutes": {"type": "integer", "description": "Required meeting duration in minutes"},
                        "start_date": {"type": "string", "description": "Earliest date to consider (ISO 8601)"},
                        "end_date": {"type": "string", "description": "Latest date to consider (ISO 8601)"}
                    },
                    "required": ["participants", "duration_minutes"]
                }),
                is_write: false,
                min_role: 0,
            },
        );
        Self::add(
            &mut tools,
            ToolDefinition {
                name: "request_leave".into(),
                description: "Create a leave or absence request on the calendar".into(),
                service: "calendar".into(),
                method: "POST".into(),
                path_template: "/calendars/{calendar_id}/events".into(),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "calendar_id": {"type": "string", "description": "Calendar ID"},
                        "title": {"type": "string", "description": "Leave request title"},
                        "start_time": {"type": "string", "description": "Leave start datetime (ISO 8601)"},
                        "end_time": {"type": "string", "description": "Leave end datetime (ISO 8601)"},
                        "leave_type": {"type": "string", "description": "Type: cp|rtt|sick|unpaid|other"}
                    },
                    "required": ["calendar_id", "title", "start_time", "end_time"]
                }),
                is_write: true,
                min_role: 0,
            },
        );
        Self::add(
            &mut tools,
            ToolDefinition {
                name: "get_leave_balances".into(),
                description: "Get leave balances for the current user".into(),
                service: "calendar".into(),
                method: "GET".into(),
                path_template: "/leave/balances".into(),
                parameters: json!({}),
                is_write: false,
                min_role: 0,
            },
        );

        // ── Contacts ─────────────────────────────────────────
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );

        // ── Chat ─────────────────────────────────────────────
        Self::add(
            &mut tools,
            ToolDefinition {
                name: "list_channels".into(),
                description: "List all chat channels the current user has access to".into(),
                service: "chat".into(),
                method: "GET".into(),
                path_template: "/channels".into(),
                parameters: json!({}),
                is_write: false,
                min_role: 0,
            },
        );
        Self::add(
            &mut tools,
            ToolDefinition {
                name: "send_message".into(),
                description: "Send a message to a chat channel".into(),
                service: "chat".into(),
                method: "POST".into(),
                path_template: "/channels/{channel_id}/messages".into(),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "channel_id": {"type": "string", "description": "Channel ID"},
                        "content": {"type": "string", "description": "Message content"}
                    },
                    "required": ["channel_id", "content"]
                }),
                is_write: true,
                min_role: 0,
            },
        );
        Self::add(
            &mut tools,
            ToolDefinition {
                name: "list_messages".into(),
                description: "List recent messages in a chat channel".into(),
                service: "chat".into(),
                method: "GET".into(),
                path_template: "/channels/{channel_id}/messages".into(),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "channel_id": {"type": "string", "description": "Channel ID"},
                        "limit": {"type": "integer", "description": "Max messages to return"}
                    },
                    "required": ["channel_id"]
                }),
                is_write: false,
                min_role: 0,
            },
        );
        Self::add(
            &mut tools,
            ToolDefinition {
                name: "create_channel".into(),
                description: "Create a new chat channel".into(),
                service: "chat".into(),
                method: "POST".into(),
                path_template: "/channels".into(),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "name": {"type": "string", "description": "Channel name"},
                        "topic": {"type": "string", "description": "Channel topic"},
                        "is_private": {"type": "boolean", "description": "Whether the channel is private"}
                    },
                    "required": ["name"]
                }),
                is_write: true,
                min_role: 0,
            },
        );
        Self::add(
            &mut tools,
            ToolDefinition {
                name: "search_messages".into(),
                description: "Search messages across all chat channels".into(),
                service: "chat".into(),
                method: "GET".into(),
                path_template: "/messages/search".into(),
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
        );

        // ── Drive / Documents ────────────────────────────────
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
            ToolDefinition {
                name: "create_document".into(),
                description: "Create a new document, spreadsheet, presentation, or folder in drive".into(),
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
        );
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );

        // ── Social ───────────────────────────────────────────
        Self::add(
            &mut tools,
            ToolDefinition {
                name: "list_social_accounts".into(),
                description: "List connected social media accounts".into(),
                service: "social".into(),
                method: "GET".into(),
                path_template: "/social/accounts".into(),
                parameters: json!({}),
                is_write: false,
                min_role: 0,
            },
        );
        Self::add(
            &mut tools,
            ToolDefinition {
                name: "create_social_post".into(),
                description: "Create and publish (or schedule) a social media post".into(),
                service: "social".into(),
                method: "POST".into(),
                path_template: "/social/posts".into(),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "content": {"type": "string", "description": "Post content"},
                        "account_ids": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Account IDs to post to"
                        },
                        "scheduled_at": {"type": "string", "description": "Schedule datetime (ISO 8601), omit to post immediately"}
                    },
                    "required": ["content"]
                }),
                is_write: true,
                min_role: 0,
            },
        );
        Self::add(
            &mut tools,
            ToolDefinition {
                name: "list_social_posts".into(),
                description: "List social media posts by status".into(),
                service: "social".into(),
                method: "GET".into(),
                path_template: "/social/posts".into(),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "status": {"type": "string", "description": "Filter by status: draft|published|scheduled"}
                    }
                }),
                is_write: false,
                min_role: 0,
            },
        );
        Self::add(
            &mut tools,
            ToolDefinition {
                name: "get_social_analytics".into(),
                description: "Get social media analytics overview (reach, engagement, followers)".into(),
                service: "social".into(),
                method: "GET".into(),
                path_template: "/social/analytics/overview".into(),
                parameters: json!({}),
                is_write: false,
                min_role: 0,
            },
        );

        // ── Notifications ────────────────────────────────────
        Self::add(
            &mut tools,
            ToolDefinition {
                name: "send_notification".into(),
                description: "Send a push notification to a specific user".into(),
                service: "notifications".into(),
                method: "POST".into(),
                path_template: "/notifications/send".into(),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "user_id": {"type": "string", "description": "Target user ID"},
                        "title": {"type": "string", "description": "Notification title"},
                        "body": {"type": "string", "description": "Notification body text"}
                    },
                    "required": ["user_id", "title", "body"]
                }),
                is_write: true,
                min_role: 0,
            },
        );
        Self::add(
            &mut tools,
            ToolDefinition {
                name: "list_notifications".into(),
                description: "List recent notifications for the current user".into(),
                service: "notifications".into(),
                method: "GET".into(),
                path_template: "/notifications".into(),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "limit": {"type": "integer", "description": "Max notifications to return"}
                    }
                }),
                is_write: false,
                min_role: 0,
            },
        );
        Self::add(
            &mut tools,
            ToolDefinition {
                name: "mark_notification_read".into(),
                description: "Mark a notification as read".into(),
                service: "notifications".into(),
                method: "PUT".into(),
                path_template: "/notifications/{id}/read".into(),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "id": {"type": "string", "description": "Notification ID"}
                    },
                    "required": ["id"]
                }),
                is_write: true,
                min_role: 0,
            },
        );

        // ── Billing ──────────────────────────────────────────
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );

        // ── Org Structure ────────────────────────────────────
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );

        // ── Vault ────────────────────────────────────────────
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );
        Self::add(
            &mut tools,
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
        );

        Self { tools }
    }

    fn add(map: &mut HashMap<String, ToolDefinition>, tool: ToolDefinition) {
        map.insert(tool.name.clone(), tool);
    }

    /// Get a tool by name.
    pub fn get(&self, name: &str) -> Option<&ToolDefinition> {
        self.tools.get(name)
    }

    /// Get all tools accessible to a given role.
    pub fn tools_for_role(&self, role: i16) -> Vec<&ToolDefinition> {
        let mut tools: Vec<_> = self.tools.values().filter(|t| t.min_role <= role).collect();
        tools.sort_by(|a, b| a.name.cmp(&b.name));
        tools
    }

    /// Total number of tools.
    pub fn len(&self) -> usize {
        self.tools.len()
    }
}
