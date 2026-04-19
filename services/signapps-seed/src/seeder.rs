//! Seeder trait + report types.

use crate::context::SeedContext;
use async_trait::async_trait;

/// Result of one seeder run — counts only, best-effort.
#[derive(Debug, Default)]
pub struct SeedReport {
    pub created: usize,
    pub skipped: usize,
    pub errors: Vec<String>,
}

/// A self-contained demo data seeder.
///
/// Implementers should be **idempotent** — every INSERT must be
/// `ON CONFLICT DO NOTHING` or `ON CONFLICT ... DO UPDATE`. UUIDs must
/// come from [`crate::uuid::acme_uuid`] so they stay stable across runs.
#[async_trait]
pub trait Seeder: Send + Sync {
    /// Stable name used for `--only <name>` filtering.
    fn name(&self) -> &'static str;

    /// Names of seeders that must run before this one (informational).
    fn dependencies(&self) -> Vec<&'static str> {
        Vec::new()
    }

    /// Run the seeder. Implementations should tolerate missing tables /
    /// columns by returning a `SeedReport` with errors rather than
    /// bubbling up — individual seeders must not block the whole seed.
    async fn run(&self, ctx: &SeedContext) -> anyhow::Result<SeedReport>;
}
