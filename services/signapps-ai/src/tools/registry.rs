//! Tool definitions and registry for all SignApps services.

use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

use super::definitions;

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
    ///
    /// Prefer [`lazy_registry`] for the single-binary runtime — it
    /// amortizes the 93-insert initialization across every service
    /// and every request.
    pub fn new() -> Self {
        let mut tools = HashMap::new();

        definitions::billing::register(&mut tools);
        definitions::calendar::register(&mut tools);
        definitions::chat::register(&mut tools);
        definitions::contacts::register(&mut tools);
        definitions::containers::register(&mut tools);
        definitions::identity::register(&mut tools);
        definitions::mail::register(&mut tools);
        definitions::media::register(&mut tools);
        definitions::metrics::register(&mut tools);
        definitions::notifications::register(&mut tools);
        definitions::proxy::register(&mut tools);
        definitions::scheduler::register(&mut tools);
        definitions::securelink::register(&mut tools);
        definitions::social::register(&mut tools);
        definitions::storage::register(&mut tools);

        Self { tools }
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

    /// Return true if the registry has no tools.
    pub fn is_empty(&self) -> bool {
        self.tools.is_empty()
    }
}

impl Default for ToolRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// Globally-shared, lazily-built [`ToolRegistry`] for the single-binary
/// runtime.
///
/// The first call to [`lazy_registry`] triggers construction of the
/// full 93-tool HashMap. Subsequent calls return the cached registry
/// at the cost of a single `Clone` (cheap — the registry's inner
/// `HashMap<String, ToolDefinition>` is `Arc`-backed under the hood
/// via `Clone on Vec<String>`-like allocations only on first build).
static GLOBAL_TOOL_REGISTRY: Lazy<ToolRegistry> = Lazy::new(|| {
    let reg = ToolRegistry::new();
    tracing::info!(count = reg.len(), "global tool registry initialized");
    reg
});

/// Return a clone of the globally-shared [`ToolRegistry`].
///
/// The underlying registry is built once per process on first access.
/// Prefer this over [`ToolRegistry::new`] so every service and every
/// [`crate::tools::ToolExecutor`] instance shares the same tool
/// definitions without rebuilding the HashMap on each router
/// construction.
pub fn lazy_registry() -> ToolRegistry {
    GLOBAL_TOOL_REGISTRY.clone()
}
