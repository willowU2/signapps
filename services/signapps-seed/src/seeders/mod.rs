//! Registry of demo data seeders.
//!
//! Order matters — earlier seeders register users/nodes that later
//! ones reference via `ctx.user(name)` / `ctx.node(slug)`.

use crate::seeder::Seeder;

pub mod org;

/// Return the list of seeders in dependency order.
pub fn all() -> Vec<Box<dyn Seeder>> {
    vec![Box::new(org::OrgSeeder)]
}
