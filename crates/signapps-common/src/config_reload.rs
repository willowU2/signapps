//! Configuration hot-reload via file polling.
//!
//! Monitors `.env` or config files for changes and reloads values at runtime
//! without requiring a service restart.
//!
//! ## Usage
//!
//! ```rust,ignore
//! use signapps_common::config_reload::{ConfigWatcher, ReloadableConfig};
//! use std::sync::Arc;
//!
//! let config = ReloadableConfig::new();
//! config.load_from_env(".env");
//!
//! // Start background watcher (checks every 5 seconds)
//! let watcher = ConfigWatcher::new(config.clone());
//! watcher.watch(".env", std::time::Duration::from_secs(5));
//!
//! // Read config values (always up-to-date)
//! let val = config.get("MY_KEY").unwrap_or_default();
//! ```

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, SystemTime};
use tokio::sync::RwLock;
use tracing::{info, warn};

/// Thread-safe reloadable configuration store.
///
/// Values are stored in-memory and can be refreshed when the underlying
/// config file changes on disk.
#[derive(Debug, Clone)]
pub struct ReloadableConfig {
    values: Arc<RwLock<HashMap<String, String>>>,
}

impl Default for ReloadableConfig {
    fn default() -> Self {
        Self::new()
    }
}

impl ReloadableConfig {
    /// Create a new empty config store.
    pub fn new() -> Self {
        Self {
            values: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Load key-value pairs from a `.env`-style file.
    ///
    /// Lines starting with `#` or empty lines are ignored.
    /// Format: `KEY=VALUE` (quotes around values are stripped).
    pub async fn load_from_file(&self, path: &Path) -> std::io::Result<usize> {
        let content = tokio::fs::read_to_string(path).await?;
        let mut values = self.values.write().await;
        let mut count = 0;

        for line in content.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            if let Some((key, val)) = line.split_once('=') {
                let key = key.trim().to_string();
                let val = val.trim().trim_matches('"').trim_matches('\'').to_string();
                values.insert(key, val);
                count += 1;
            }
        }

        Ok(count)
    }

    /// Get a configuration value by key.
    pub async fn get(&self, key: &str) -> Option<String> {
        self.values.read().await.get(key).cloned()
    }

    /// Get a configuration value or return a default.
    pub async fn get_or(&self, key: &str, default: &str) -> String {
        self.values
            .read()
            .await
            .get(key)
            .cloned()
            .unwrap_or_else(|| default.to_string())
    }

    /// Set a configuration value.
    pub async fn set(&self, key: &str, value: &str) {
        self.values
            .write()
            .await
            .insert(key.to_string(), value.to_string());
    }

    /// Get a snapshot of all current values.
    pub async fn snapshot(&self) -> HashMap<String, String> {
        self.values.read().await.clone()
    }
}

/// File-polling configuration watcher.
///
/// Periodically checks the modification time of a config file and reloads
/// when it detects changes. Uses simple polling (no external dependencies).
#[derive(Clone)]
pub struct ConfigWatcher {
    config: ReloadableConfig,
}

impl ConfigWatcher {
    /// Create a new watcher attached to the given config store.
    pub fn new(config: ReloadableConfig) -> Self {
        Self { config }
    }

    /// Start watching a file for changes in a background task.
    ///
    /// Checks the file modification time at the given interval.
    /// When a change is detected, reloads all values into the config store.
    ///
    /// Returns a `tokio::task::JoinHandle` that can be used to abort the watcher.
    pub fn watch(&self, path: impl Into<PathBuf>, interval: Duration) -> tokio::task::JoinHandle<()> {
        let config = self.config.clone();
        let path = path.into();

        tokio::spawn(async move {
            let mut last_modified: Option<SystemTime> = None;

            // Initial load
            match config.load_from_file(&path).await {
                Ok(count) => {
                    info!(
                        path = %path.display(),
                        keys = count,
                        "Config loaded initially"
                    );
                    last_modified = file_modified(&path).await;
                }
                Err(e) => {
                    warn!(
                        path = %path.display(),
                        error = %e,
                        "Failed to load config file initially"
                    );
                }
            }

            loop {
                tokio::time::sleep(interval).await;

                let current_modified = file_modified(&path).await;

                // Reload only when the file has been modified
                let should_reload = match (last_modified, current_modified) {
                    (Some(prev), Some(curr)) => curr > prev,
                    (None, Some(_)) => true,
                    _ => false,
                };

                if should_reload {
                    match config.load_from_file(&path).await {
                        Ok(count) => {
                            info!(
                                path = %path.display(),
                                keys = count,
                                "Config reloaded (file changed)"
                            );
                            last_modified = current_modified;
                        }
                        Err(e) => {
                            warn!(
                                path = %path.display(),
                                error = %e,
                                "Failed to reload config file"
                            );
                        }
                    }
                }
            }
        })
    }
}

/// Get the modification time of a file, returning `None` on error.
async fn file_modified(path: &Path) -> Option<SystemTime> {
    tokio::fs::metadata(path)
        .await
        .ok()
        .and_then(|m| m.modified().ok())
}
