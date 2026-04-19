//! Shared seeding context — DB pool + tenant + user/node mapping.

use signapps_db_shared::pool::DatabasePool;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use uuid::Uuid;

/// Shared mutable context passed to every seeder.
///
/// Holds the `users` / `nodes` lookup maps so downstream seeders can
/// resolve UUIDs by logical name (e.g. `"marie.dupont"`).
pub struct SeedContext {
    pub db: DatabasePool,
    pub tenant_id: Uuid,
    pub force: bool,
    pub dry_run: bool,
    /// Shared map of logical name -> UUID (e.g. `"marie.dupont"` -> Uuid)
    pub users: Arc<Mutex<HashMap<String, Uuid>>>,
    pub nodes: Arc<Mutex<HashMap<String, Uuid>>>,
}

impl SeedContext {
    /// Register a user's UUID under a logical name.
    pub fn register_user(&self, name: &str, id: Uuid) {
        if let Ok(mut guard) = self.users.lock() {
            guard.insert(name.to_string(), id);
        }
    }

    /// Look up a user's UUID by logical name.
    pub fn user(&self, name: &str) -> Option<Uuid> {
        self.users.lock().ok()?.get(name).copied()
    }

    /// Register an org node's UUID under a logical slug.
    pub fn register_node(&self, slug: &str, id: Uuid) {
        if let Ok(mut guard) = self.nodes.lock() {
            guard.insert(slug.to_string(), id);
        }
    }

    /// Look up an org node's UUID by slug.
    pub fn node(&self, slug: &str) -> Option<Uuid> {
        self.nodes.lock().ok()?.get(slug).copied()
    }
}
