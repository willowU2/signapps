//! # App Marketplace
//!
//! Application store and marketplace management with install/uninstall capabilities.

use crate::{Error, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Represents an installable application in the marketplace
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppListing {
    /// Unique identifier for the app
    pub id: String,
    /// Display name
    pub name: String,
    /// Semantic version
    pub version: String,
    /// Long description
    pub description: String,
    /// Author/maintainer name
    pub author: String,
    /// Required permissions
    pub permissions: Vec<String>,
    /// Whether the app is installed for this user
    pub installed: bool,
    /// Total download count
    pub downloads: u64,
}

/// Application store management
pub struct AppStore {
    listings: HashMap<String, AppListing>,
    installations: HashMap<String, Vec<String>>, // user_id -> app_ids
}

impl AppStore {
    /// Create a new app store
    pub fn new() -> Self {
        Self {
            listings: HashMap::new(),
            installations: HashMap::new(),
        }
    }

    /// Register an app listing
    pub fn register(&mut self, listing: AppListing) -> Result<()> {
        self.listings.insert(listing.id.clone(), listing);
        Ok(())
    }

    /// Install an app for a user
    pub fn install(&mut self, user_id: &str, app_id: &str) -> Result<()> {
        if !self.listings.contains_key(app_id) {
            return Err(Error::NotFound(format!("App {} not found", app_id)));
        }

        self.installations
            .entry(user_id.to_string())
            .or_default()
            .push(app_id.to_string());

        if let Some(listing) = self.listings.get_mut(app_id) {
            listing.installed = true;
            listing.downloads += 1;
        }

        Ok(())
    }

    /// Uninstall an app for a user
    pub fn uninstall(&mut self, user_id: &str, app_id: &str) -> Result<()> {
        if let Some(apps) = self.installations.get_mut(user_id) {
            apps.retain(|id| id != app_id);
        }

        // Check if any user still has it installed
        let still_installed = self
            .installations
            .values()
            .any(|apps| apps.contains(&app_id.to_string()));

        if !still_installed {
            if let Some(listing) = self.listings.get_mut(app_id) {
                listing.installed = false;
            }
        }

        Ok(())
    }

    /// List all available apps
    pub fn list(&self) -> Vec<AppListing> {
        self.listings.values().cloned().collect()
    }

    /// Search apps by name or description
    pub fn search(&self, query: &str) -> Vec<AppListing> {
        let query_lower = query.to_lowercase();
        self.listings
            .values()
            .filter(|app| {
                app.name.to_lowercase().contains(&query_lower)
                    || app.description.to_lowercase().contains(&query_lower)
                    || app.author.to_lowercase().contains(&query_lower)
            })
            .cloned()
            .collect()
    }

    /// Get user's installed apps
    pub fn user_apps(&self, user_id: &str) -> Vec<AppListing> {
        let Some(app_ids) = self.installations.get(user_id) else {
            return Vec::new();
        };

        app_ids
            .iter()
            .filter_map(|id| self.listings.get(id).cloned())
            .collect()
    }
}

impl Default for AppStore {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_register_and_list() {
        let mut store = AppStore::new();
        let app = AppListing {
            id: "app1".to_string(),
            name: "Test App".to_string(),
            version: "1.0.0".to_string(),
            description: "A test application".to_string(),
            author: "Test Author".to_string(),
            permissions: vec!["read".to_string()],
            installed: false,
            downloads: 0,
        };

        assert!(store.register(app).is_ok());
        assert_eq!(store.list().len(), 1);
    }

    #[test]
    fn test_install_uninstall() {
        let mut store = AppStore::new();
        let app = AppListing {
            id: "app1".to_string(),
            name: "Test App".to_string(),
            version: "1.0.0".to_string(),
            description: "A test application".to_string(),
            author: "Test Author".to_string(),
            permissions: vec![],
            installed: false,
            downloads: 0,
        };

        store.register(app).unwrap();
        assert!(store.install("user1", "app1").is_ok());
        assert_eq!(store.user_apps("user1").len(), 1);

        assert!(store.uninstall("user1", "app1").is_ok());
        assert_eq!(store.user_apps("user1").len(), 0);
    }

    #[test]
    fn test_search() {
        let mut store = AppStore::new();
        store
            .register(AppListing {
                id: "app1".to_string(),
                name: "Mail Client".to_string(),
                version: "1.0.0".to_string(),
                description: "Email management".to_string(),
                author: "Author".to_string(),
                permissions: vec![],
                installed: false,
                downloads: 0,
            })
            .ok();

        let results = store.search("mail");
        assert_eq!(results.len(), 1);
    }
}
