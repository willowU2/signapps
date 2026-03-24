//! # Plugin System Architecture
//!
//! Provides the foundational trait and registry for SignApps plugins.
//!
//! Plugins are self-contained extensions that can contribute HTTP routes,
//! perform initialization/shutdown logic, and declare their capabilities
//! via a [`PluginManifest`].
//!
//! ## Architecture
//!
//! - [`PluginManifest`] — Declarative metadata (id, name, version, permissions)
//! - [`Plugin`] — Trait every plugin must implement
//! - [`PluginRegistry`] — Manages plugin lifecycle (register, init, shutdown, route merging)
//!
//! ## Usage
//!
//! ```rust,ignore
//! use signapps_common::plugins::{Plugin, PluginManifest, PluginRegistry};
//!
//! let mut registry = PluginRegistry::new();
//! registry.register(Box::new(my_plugin))?;
//! registry.init_all().await?;
//!
//! // Merge plugin routes into the main router
//! let app = axum::Router::new().merge(registry.routes());
//! ```

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use tracing::{info, warn};

/// Plugin manifest describing a plugin's identity and capabilities.
///
/// Every plugin must provide a manifest so that the registry can identify
/// it, detect duplicates, and enforce permission-based access control in
/// the future.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginManifest {
    /// Unique identifier (e.g., `"signapps.calendar-sync"`).
    pub id: String,
    /// Human-readable display name.
    pub name: String,
    /// SemVer version string.
    pub version: String,
    /// Short description of what the plugin does.
    pub description: String,
    /// Author or organization.
    pub author: String,
    /// Permissions the plugin requires (e.g., `["storage:read", "users:list"]`).
    pub permissions: Vec<String>,
}

/// The core Plugin trait that all plugins must implement.
///
/// Plugins are loaded into a [`PluginRegistry`] and follow a lifecycle:
/// 1. **Register** — plugin is added to the registry
/// 2. **Init** — plugin performs setup (DB migrations, background tasks, etc.)
/// 3. **Routes** — plugin contributes optional HTTP routes
/// 4. **Shutdown** — plugin performs graceful cleanup
#[async_trait]
pub trait Plugin: Send + Sync {
    /// Returns the plugin's manifest.
    fn manifest(&self) -> &PluginManifest;

    /// Initialize the plugin. Called once after registration.
    ///
    /// Use this for database migrations, spawning background tasks,
    /// or any one-time setup.
    async fn init(&self) -> anyhow::Result<()>;

    /// Gracefully shut down the plugin.
    ///
    /// Called when the application is stopping. Use this to flush
    /// buffers, close connections, or cancel background tasks.
    async fn shutdown(&self) -> anyhow::Result<()>;

    /// Returns an optional [`axum::Router`] with the plugin's HTTP routes.
    ///
    /// The registry merges all plugin routers into a single router
    /// that can be nested under a common prefix (e.g., `/plugins/`).
    fn routes(&self) -> Option<axum::Router>;
}

/// Plugin registry that manages loaded plugins.
///
/// The registry owns all registered plugins, enforces unique IDs,
/// and provides batch lifecycle operations (`init_all`, `shutdown_all`).
pub struct PluginRegistry {
    plugins: Vec<Box<dyn Plugin>>,
}

impl PluginRegistry {
    /// Create a new, empty plugin registry.
    pub fn new() -> Self {
        Self {
            plugins: Vec::new(),
        }
    }

    /// Register a plugin with the registry.
    ///
    /// Returns an error if a plugin with the same `id` is already registered.
    pub fn register(&mut self, plugin: Box<dyn Plugin>) -> anyhow::Result<()> {
        let manifest = plugin.manifest();
        let id = &manifest.id;

        // Reject duplicate plugin IDs
        if self.plugins.iter().any(|p| p.manifest().id == *id) {
            anyhow::bail!("plugin with id '{}' is already registered", id);
        }

        info!(
            plugin_id = %id,
            plugin_name = %manifest.name,
            plugin_version = %manifest.version,
            "Plugin registered"
        );

        self.plugins.push(plugin);
        Ok(())
    }

    /// Initialize all registered plugins in registration order.
    ///
    /// Stops at the first plugin that fails and returns its error.
    pub async fn init_all(&self) -> anyhow::Result<()> {
        for plugin in &self.plugins {
            let manifest = plugin.manifest();
            info!(
                plugin_id = %manifest.id,
                "Initializing plugin"
            );
            plugin.init().await.map_err(|e| {
                anyhow::anyhow!("failed to initialize plugin '{}': {}", manifest.id, e)
            })?;
        }
        Ok(())
    }

    /// Shut down all registered plugins in reverse registration order.
    ///
    /// Continues even if individual plugins fail, logging warnings.
    /// Returns the first error encountered, if any.
    pub async fn shutdown_all(&self) -> anyhow::Result<()> {
        let mut first_error: Option<anyhow::Error> = None;

        for plugin in self.plugins.iter().rev() {
            let manifest = plugin.manifest();
            info!(
                plugin_id = %manifest.id,
                "Shutting down plugin"
            );
            if let Err(e) = plugin.shutdown().await {
                warn!(
                    plugin_id = %manifest.id,
                    error = %e,
                    "Plugin shutdown failed"
                );
                if first_error.is_none() {
                    first_error = Some(anyhow::anyhow!(
                        "plugin '{}' shutdown failed: {}",
                        manifest.id,
                        e
                    ));
                }
            }
        }

        match first_error {
            Some(e) => Err(e),
            None => Ok(()),
        }
    }

    /// Merge all plugin routes into a single [`axum::Router`].
    ///
    /// Plugins that return `None` from [`Plugin::routes`] are skipped.
    pub fn routes(&self) -> axum::Router {
        let mut router = axum::Router::new();
        for plugin in &self.plugins {
            if let Some(plugin_router) = plugin.routes() {
                router = router.merge(plugin_router);
            }
        }
        router
    }

    /// List manifests of all registered plugins.
    pub fn list(&self) -> Vec<&PluginManifest> {
        self.plugins.iter().map(|p| p.manifest()).collect()
    }

    /// Returns the number of registered plugins.
    pub fn count(&self) -> usize {
        self.plugins.len()
    }
}

impl Default for PluginRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Minimal test plugin for unit tests.
    struct TestPlugin {
        manifest: PluginManifest,
        fail_init: bool,
        fail_shutdown: bool,
    }

    impl TestPlugin {
        fn new(id: &str, name: &str) -> Self {
            Self {
                manifest: PluginManifest {
                    id: id.to_string(),
                    name: name.to_string(),
                    version: "0.1.0".to_string(),
                    description: format!("Test plugin: {}", name),
                    author: "SignApps Tests".to_string(),
                    permissions: vec![],
                },
                fail_init: false,
                fail_shutdown: false,
            }
        }

        fn with_fail_init(mut self) -> Self {
            self.fail_init = true;
            self
        }

        fn with_fail_shutdown(mut self) -> Self {
            self.fail_shutdown = true;
            self
        }
    }

    #[async_trait]
    impl Plugin for TestPlugin {
        fn manifest(&self) -> &PluginManifest {
            &self.manifest
        }

        async fn init(&self) -> anyhow::Result<()> {
            if self.fail_init {
                anyhow::bail!("init failed on purpose");
            }
            Ok(())
        }

        async fn shutdown(&self) -> anyhow::Result<()> {
            if self.fail_shutdown {
                anyhow::bail!("shutdown failed on purpose");
            }
            Ok(())
        }

        fn routes(&self) -> Option<axum::Router> {
            None
        }
    }

    #[test]
    fn registry_starts_empty() {
        let registry = PluginRegistry::new();
        assert_eq!(registry.count(), 0);
        assert!(registry.list().is_empty());
    }

    #[test]
    fn register_single_plugin() {
        let mut registry = PluginRegistry::new();
        let plugin = TestPlugin::new("test.hello", "Hello Plugin");

        registry
            .register(Box::new(plugin))
            .expect("should register");
        assert_eq!(registry.count(), 1);

        let manifests = registry.list();
        assert_eq!(manifests.len(), 1);
        assert_eq!(manifests[0].id, "test.hello");
        assert_eq!(manifests[0].name, "Hello Plugin");
    }

    #[test]
    fn register_multiple_plugins() {
        let mut registry = PluginRegistry::new();

        registry
            .register(Box::new(TestPlugin::new("plugin.a", "Plugin A")))
            .expect("register A");
        registry
            .register(Box::new(TestPlugin::new("plugin.b", "Plugin B")))
            .expect("register B");
        registry
            .register(Box::new(TestPlugin::new("plugin.c", "Plugin C")))
            .expect("register C");

        assert_eq!(registry.count(), 3);

        let ids: Vec<&str> = registry.list().iter().map(|m| m.id.as_str()).collect();
        assert_eq!(ids, vec!["plugin.a", "plugin.b", "plugin.c"]);
    }

    #[test]
    fn reject_duplicate_plugin_id() {
        let mut registry = PluginRegistry::new();

        registry
            .register(Box::new(TestPlugin::new("dup.id", "First")))
            .expect("first should succeed");

        let result = registry.register(Box::new(TestPlugin::new("dup.id", "Second")));
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("already registered"));

        // Only the first plugin should remain
        assert_eq!(registry.count(), 1);
    }

    #[tokio::test]
    async fn init_all_succeeds() {
        let mut registry = PluginRegistry::new();
        registry
            .register(Box::new(TestPlugin::new("a", "A")))
            .unwrap();
        registry
            .register(Box::new(TestPlugin::new("b", "B")))
            .unwrap();

        let result = registry.init_all().await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn init_all_stops_on_failure() {
        let mut registry = PluginRegistry::new();
        registry
            .register(Box::new(TestPlugin::new("ok", "OK")))
            .unwrap();
        registry
            .register(Box::new(TestPlugin::new("fail", "Fail").with_fail_init()))
            .unwrap();

        let result = registry.init_all().await;
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("fail"));
    }

    #[tokio::test]
    async fn shutdown_all_succeeds() {
        let mut registry = PluginRegistry::new();
        registry
            .register(Box::new(TestPlugin::new("a", "A")))
            .unwrap();
        registry
            .register(Box::new(TestPlugin::new("b", "B")))
            .unwrap();

        let result = registry.shutdown_all().await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn shutdown_all_continues_on_failure() {
        let mut registry = PluginRegistry::new();
        registry
            .register(Box::new(TestPlugin::new("ok", "OK")))
            .unwrap();
        registry
            .register(Box::new(
                TestPlugin::new("fail", "Fail").with_fail_shutdown(),
            ))
            .unwrap();

        // shutdown_all should return an error but still attempt all plugins
        let result = registry.shutdown_all().await;
        assert!(result.is_err());
    }

    #[test]
    fn routes_returns_empty_router_when_no_routes() {
        let mut registry = PluginRegistry::new();
        registry
            .register(Box::new(TestPlugin::new("a", "A")))
            .unwrap();

        // Should not panic — just returns an empty router
        let _router = registry.routes();
    }

    #[test]
    fn manifest_serialization_roundtrip() {
        let manifest = PluginManifest {
            id: "test.serialize".to_string(),
            name: "Serialization Test".to_string(),
            version: "1.2.3".to_string(),
            description: "Tests serde roundtrip".to_string(),
            author: "Test Author".to_string(),
            permissions: vec!["storage:read".to_string(), "users:list".to_string()],
        };

        let json = serde_json::to_string(&manifest).expect("serialize");
        let deserialized: PluginManifest = serde_json::from_str(&json).expect("deserialize");

        assert_eq!(deserialized.id, "test.serialize");
        assert_eq!(deserialized.version, "1.2.3");
        assert_eq!(deserialized.permissions.len(), 2);
    }

    #[test]
    fn default_registry_is_empty() {
        let registry = PluginRegistry::default();
        assert_eq!(registry.count(), 0);
    }
}
