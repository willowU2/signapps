//! Registry of demo data seeders.
//!
//! Order matters — earlier seeders register users/nodes that later
//! ones reference via `ctx.user(name)` / `ctx.node(slug)`.

use crate::seeder::Seeder;

pub mod ad;
pub mod calendar;
pub mod chat;
pub mod contacts;
pub mod docs;
pub mod drive;
pub mod forms;
pub mod identity;
pub mod it_assets;
pub mod mail;
pub mod meet;
pub mod org;
pub mod pxe;
pub mod tasks;
pub mod vault;

/// Return the list of seeders in dependency order.
pub fn all() -> Vec<Box<dyn Seeder>> {
    vec![
        Box::new(org::OrgSeeder),
        Box::new(identity::IdentitySeeder),
        Box::new(ad::AdSeeder),
        Box::new(calendar::CalendarSeeder),
        Box::new(mail::MailSeeder),
        Box::new(chat::ChatSeeder),
        Box::new(docs::DocsSeeder),
        Box::new(drive::DriveSeeder),
        Box::new(forms::FormsSeeder),
        Box::new(contacts::ContactsSeeder),
        Box::new(meet::MeetSeeder),
        Box::new(tasks::TasksSeeder),
        Box::new(it_assets::ItAssetsSeeder),
        Box::new(vault::VaultSeeder),
        Box::new(pxe::PxeSeeder),
    ]
}
