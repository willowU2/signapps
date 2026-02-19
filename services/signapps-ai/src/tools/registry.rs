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
        Self::add(&mut tools, ToolDefinition {
            name: "list_containers".into(),
            description: "List all Docker containers with their status"
                .into(),
            service: "containers".into(),
            method: "GET".into(),
            path_template: "/containers".into(),
            parameters: json!({}),
            is_write: false,
            min_role: 0,
        });
        Self::add(&mut tools, ToolDefinition {
            name: "get_container".into(),
            description: "Get details of a specific container by ID"
                .into(),
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
        });
        Self::add(&mut tools, ToolDefinition {
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
        });
        Self::add(&mut tools, ToolDefinition {
            name: "container_stats".into(),
            description: "Get resource usage stats of a container"
                .into(),
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
        });
        Self::add(&mut tools, ToolDefinition {
            name: "list_store_apps".into(),
            description: "List available apps from the app store"
                .into(),
            service: "containers".into(),
            method: "GET".into(),
            path_template: "/store/apps".into(),
            parameters: json!({}),
            is_write: false,
            min_role: 0,
        });
        Self::add(&mut tools, ToolDefinition {
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
        });
        Self::add(&mut tools, ToolDefinition {
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
        });
        Self::add(&mut tools, ToolDefinition {
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
        });
        Self::add(&mut tools, ToolDefinition {
            name: "delete_container".into(),
            description: "Delete a container (must be stopped first)"
                .into(),
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
        });
        Self::add(&mut tools, ToolDefinition {
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
        });

        // ── Metrics ─────────────────────────────────────────
        Self::add(&mut tools, ToolDefinition {
            name: "get_system_metrics".into(),
            description:
                "Get overall system metrics (CPU, memory, disk, network)"
                    .into(),
            service: "metrics".into(),
            method: "GET".into(),
            path_template: "/metrics/system".into(),
            parameters: json!({}),
            is_write: false,
            min_role: 0,
        });
        Self::add(&mut tools, ToolDefinition {
            name: "get_cpu".into(),
            description: "Get detailed CPU usage metrics".into(),
            service: "metrics".into(),
            method: "GET".into(),
            path_template: "/metrics/cpu".into(),
            parameters: json!({}),
            is_write: false,
            min_role: 0,
        });
        Self::add(&mut tools, ToolDefinition {
            name: "get_memory".into(),
            description: "Get memory usage metrics".into(),
            service: "metrics".into(),
            method: "GET".into(),
            path_template: "/metrics/memory".into(),
            parameters: json!({}),
            is_write: false,
            min_role: 0,
        });
        Self::add(&mut tools, ToolDefinition {
            name: "get_disk".into(),
            description: "Get disk usage metrics".into(),
            service: "metrics".into(),
            method: "GET".into(),
            path_template: "/metrics/disk".into(),
            parameters: json!({}),
            is_write: false,
            min_role: 0,
        });
        Self::add(&mut tools, ToolDefinition {
            name: "get_network".into(),
            description: "Get network I/O metrics".into(),
            service: "metrics".into(),
            method: "GET".into(),
            path_template: "/metrics/network".into(),
            parameters: json!({}),
            is_write: false,
            min_role: 0,
        });

        // ── Storage ─────────────────────────────────────────
        Self::add(&mut tools, ToolDefinition {
            name: "list_buckets".into(),
            description: "List all storage buckets".into(),
            service: "storage".into(),
            method: "GET".into(),
            path_template: "/buckets".into(),
            parameters: json!({}),
            is_write: false,
            min_role: 0,
        });
        Self::add(&mut tools, ToolDefinition {
            name: "list_files".into(),
            description:
                "List files in a bucket, optionally filtered by prefix"
                    .into(),
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
        });
        Self::add(&mut tools, ToolDefinition {
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
        });
        Self::add(&mut tools, ToolDefinition {
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
        });
        Self::add(&mut tools, ToolDefinition {
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
        });
        Self::add(&mut tools, ToolDefinition {
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
        });

        // ── Proxy ───────────────────────────────────────────
        Self::add(&mut tools, ToolDefinition {
            name: "list_routes".into(),
            description: "List all proxy routes".into(),
            service: "proxy".into(),
            method: "GET".into(),
            path_template: "/routes".into(),
            parameters: json!({}),
            is_write: false,
            min_role: 0,
        });
        Self::add(&mut tools, ToolDefinition {
            name: "get_proxy_status".into(),
            description: "Get proxy service status and statistics"
                .into(),
            service: "proxy".into(),
            method: "GET".into(),
            path_template: "/status".into(),
            parameters: json!({}),
            is_write: false,
            min_role: 0,
        });
        Self::add(&mut tools, ToolDefinition {
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
        });
        Self::add(&mut tools, ToolDefinition {
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
        });
        Self::add(&mut tools, ToolDefinition {
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
        });
        Self::add(&mut tools, ToolDefinition {
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
        });

        // ── Scheduler ───────────────────────────────────────
        Self::add(&mut tools, ToolDefinition {
            name: "list_jobs".into(),
            description: "List all scheduled jobs".into(),
            service: "scheduler".into(),
            method: "GET".into(),
            path_template: "/jobs".into(),
            parameters: json!({}),
            is_write: false,
            min_role: 0,
        });
        Self::add(&mut tools, ToolDefinition {
            name: "get_scheduler_stats".into(),
            description: "Get scheduler statistics and job summaries"
                .into(),
            service: "scheduler".into(),
            method: "GET".into(),
            path_template: "/stats".into(),
            parameters: json!({}),
            is_write: false,
            min_role: 0,
        });
        Self::add(&mut tools, ToolDefinition {
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
        });
        Self::add(&mut tools, ToolDefinition {
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
        });
        Self::add(&mut tools, ToolDefinition {
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
        });
        Self::add(&mut tools, ToolDefinition {
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
        });
        Self::add(&mut tools, ToolDefinition {
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
        });

        // ── Identity ────────────────────────────────────────
        Self::add(&mut tools, ToolDefinition {
            name: "list_users".into(),
            description: "List all users (admin only)".into(),
            service: "identity".into(),
            method: "GET".into(),
            path_template: "/users".into(),
            parameters: json!({}),
            is_write: false,
            min_role: 1,
        });
        Self::add(&mut tools, ToolDefinition {
            name: "get_user".into(),
            description: "Get details of a specific user (admin only)"
                .into(),
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
        });
        Self::add(&mut tools, ToolDefinition {
            name: "get_me".into(),
            description: "Get current user profile".into(),
            service: "identity".into(),
            method: "GET".into(),
            path_template: "/auth/me".into(),
            parameters: json!({}),
            is_write: false,
            min_role: 0,
        });
        Self::add(&mut tools, ToolDefinition {
            name: "list_groups".into(),
            description: "List all user groups".into(),
            service: "identity".into(),
            method: "GET".into(),
            path_template: "/groups".into(),
            parameters: json!({}),
            is_write: false,
            min_role: 1,
        });

        // ── SecureLink ──────────────────────────────────────
        Self::add(&mut tools, ToolDefinition {
            name: "list_tunnels".into(),
            description: "List all active tunnels".into(),
            service: "securelink".into(),
            method: "GET".into(),
            path_template: "/tunnels".into(),
            parameters: json!({}),
            is_write: false,
            min_role: 0,
        });
        Self::add(&mut tools, ToolDefinition {
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
        });
        Self::add(&mut tools, ToolDefinition {
            name: "get_dns_config".into(),
            description: "Get DNS configuration".into(),
            service: "securelink".into(),
            method: "GET".into(),
            path_template: "/dns/config".into(),
            parameters: json!({}),
            is_write: false,
            min_role: 0,
        });
        Self::add(&mut tools, ToolDefinition {
            name: "get_dns_stats".into(),
            description: "Get DNS query statistics".into(),
            service: "securelink".into(),
            method: "GET".into(),
            path_template: "/dns/stats".into(),
            parameters: json!({}),
            is_write: false,
            min_role: 0,
        });
        Self::add(&mut tools, ToolDefinition {
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
        });

        // ── Media ───────────────────────────────────────────
        Self::add(&mut tools, ToolDefinition {
            name: "list_tts_voices".into(),
            description: "List available text-to-speech voices".into(),
            service: "media".into(),
            method: "GET".into(),
            path_template: "/tts/voices".into(),
            parameters: json!({}),
            is_write: false,
            min_role: 0,
        });
        Self::add(&mut tools, ToolDefinition {
            name: "list_stt_models".into(),
            description: "List available speech-to-text models".into(),
            service: "media".into(),
            method: "GET".into(),
            path_template: "/stt/models".into(),
            parameters: json!({}),
            is_write: false,
            min_role: 0,
        });

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
        let mut tools: Vec<_> = self
            .tools
            .values()
            .filter(|t| t.min_role <= role)
            .collect();
        tools.sort_by(|a, b| a.name.cmp(&b.name));
        tools
    }

    /// Total number of tools.
    pub fn len(&self) -> usize {
        self.tools.len()
    }
}
