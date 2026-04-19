//! Org structure seeder — placeholder filled out in T14.

use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use async_trait::async_trait;

/// Seeds the Acme Corp org tree (root + 4 OUs + 15 persons + assignments).
pub struct OrgSeeder;

#[async_trait]
impl Seeder for OrgSeeder {
    fn name(&self) -> &'static str {
        "org"
    }

    async fn run(&self, _ctx: &SeedContext) -> anyhow::Result<SeedReport> {
        Ok(SeedReport::default())
    }
}
