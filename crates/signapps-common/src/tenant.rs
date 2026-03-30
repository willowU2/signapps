//! # Multi-Tenant Management
//!
//! Tenant administration with schema isolation and quota management.

use crate::{Error, Result};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

/// Represents a tenant in a multi-tenant system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tenant {
    /// Unique tenant identifier
    pub id: String,
    /// Display name
    pub name: String,
    /// Database schema name (isolated)
    pub schema: String,
    /// Maximum number of users allowed
    pub max_users: u32,
    /// Maximum storage in GB
    pub max_storage: u64,
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
    /// Suspension status
    pub suspended: bool,
}

/// Tenant manager for lifecycle operations
pub struct TenantManager {
    tenants: HashMap<String, Tenant>,
}

impl TenantManager {
    /// Create a new tenant manager
    pub fn new() -> Self {
        Self {
            tenants: HashMap::new(),
        }
    }

    /// Create a new tenant
    pub fn create(&mut self, name: &str, max_users: u32, max_storage: u64) -> Result<Tenant> {
        let id = Uuid::new_v4().to_string();
        let schema = format!("tenant_{}", id.replace('-', "_"));

        let tenant = Tenant {
            id: id.clone(),
            name: name.to_string(),
            schema,
            max_users,
            max_storage,
            created_at: Utc::now(),
            suspended: false,
        };

        self.tenants.insert(id, tenant.clone());
        Ok(tenant)
    }

    /// Suspend a tenant (access denied)
    pub fn suspend(&mut self, tenant_id: &str) -> Result<()> {
        if let Some(tenant) = self.tenants.get_mut(tenant_id) {
            tenant.suspended = true;
            Ok(())
        } else {
            Err(Error::NotFound(format!("Tenant {} not found", tenant_id)))
        }
    }

    /// Resume a suspended tenant
    pub fn resume(&mut self, tenant_id: &str) -> Result<()> {
        if let Some(tenant) = self.tenants.get_mut(tenant_id) {
            tenant.suspended = false;
            Ok(())
        } else {
            Err(Error::NotFound(format!("Tenant {} not found", tenant_id)))
        }
    }

    /// List all tenants
    pub fn list(&self) -> Vec<Tenant> {
        self.tenants.values().cloned().collect()
    }

    /// Get a specific tenant
    pub fn get(&self, tenant_id: &str) -> Result<Tenant> {
        self.tenants
            .get(tenant_id)
            .cloned()
            .ok_or_else(|| Error::NotFound(format!("Tenant {} not found", tenant_id)))
    }

    /// Check if tenant is active (not suspended)
    pub fn is_active(&self, tenant_id: &str) -> Result<bool> {
        let tenant = self.get(tenant_id)?;
        Ok(!tenant.suspended)
    }

    /// Update tenant quotas
    pub fn update_quotas(
        &mut self,
        tenant_id: &str,
        max_users: u32,
        max_storage: u64,
    ) -> Result<()> {
        if let Some(tenant) = self.tenants.get_mut(tenant_id) {
            tenant.max_users = max_users;
            tenant.max_storage = max_storage;
            Ok(())
        } else {
            Err(Error::NotFound(format!("Tenant {} not found", tenant_id)))
        }
    }
}

impl Default for TenantManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_tenant() {
        let mut manager = TenantManager::new();
        let tenant = manager.create("ACME Corp", 100, 500).expect("tenant creation should succeed");

        assert_eq!(tenant.name, "ACME Corp");
        assert_eq!(tenant.max_users, 100);
        assert_eq!(tenant.max_storage, 500);
        assert!(!tenant.suspended);
    }

    #[test]
    fn test_suspend_resume() {
        let mut manager = TenantManager::new();
        let tenant = manager.create("Test Corp", 50, 100).expect("tenant creation should succeed");

        manager.suspend(&tenant.id).expect("suspend should succeed");
        assert!(!manager.is_active(&tenant.id).expect("is_active should succeed"));

        manager.resume(&tenant.id).expect("resume should succeed");
        assert!(manager.is_active(&tenant.id).expect("is_active should succeed"));
    }

    #[test]
    fn test_list_tenants() {
        let mut manager = TenantManager::new();
        manager.create("Tenant 1", 50, 100).expect("tenant creation should succeed");
        manager.create("Tenant 2", 100, 500).expect("tenant creation should succeed");

        assert_eq!(manager.list().len(), 2);
    }

    #[test]
    fn test_get_nonexistent() {
        let manager = TenantManager::new();
        assert!(manager.get("nonexistent").is_err());
    }

    #[test]
    fn test_update_quotas() {
        let mut manager = TenantManager::new();
        let tenant = manager.create("Test", 50, 100).expect("tenant creation should succeed");

        manager.update_quotas(&tenant.id, 200, 1000).expect("quota update should succeed");
        let updated = manager.get(&tenant.id).expect("tenant should be retrievable");

        assert_eq!(updated.max_users, 200);
        assert_eq!(updated.max_storage, 1000);
    }
}
