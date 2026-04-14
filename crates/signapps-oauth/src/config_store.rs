//! Tenant-level provider config storage (Postgres-backed).

/// Placeholder trait — implemented in Task 13.
#[async_trait::async_trait]
#[allow(dead_code)]
pub trait ConfigStore: Send + Sync {}

/// Placeholder impl — Task 13.
#[allow(dead_code)]
pub struct PgConfigStore;
