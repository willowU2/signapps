//! Registry of demo data seeders.
//!
//! Order matters — earlier seeders register users/nodes that later
//! ones reference via `ctx.user(name)` / `ctx.node(slug)`.

use crate::seeder::Seeder;

pub mod ad;
pub mod calendar;
pub mod chat;
pub mod contacts;
pub mod decisions;
pub mod delegations;
pub mod docs;
pub mod drive;
pub mod focus_nodes;
pub mod forms;
pub mod headcount;
pub mod identity;
pub mod it_assets;
pub mod mail;
pub mod meet;
pub mod org;
pub mod photos;
pub mod positions;
pub mod public_links;
pub mod pxe;
pub mod raci;
pub mod skills;
pub mod tasks;
pub mod templates;
pub mod vault;
pub mod webhooks;

/// Return the list of seeders in dependency order.
pub fn all() -> Vec<Box<dyn Seeder>> {
    vec![
        Box::new(org::OrgSeeder),
        // SO1 foundations — focus + positions + delegations (run right
        // after OrgSeeder so later seeders can reference focus nodes).
        Box::new(focus_nodes::FocusNodesSeeder),
        Box::new(positions::PositionsSeeder),
        Box::new(delegations::DelegationsSeeder),
        // SO2 governance — RACI matrix + board decisions (depend on
        // focus nodes for projects + org root for board).
        Box::new(raci::RaciSeeder),
        Box::new(decisions::DecisionsSeeder),
        // SO3 scale & power — templates (no dep) + skills + headcount (depend on org).
        Box::new(templates::TemplatesSeeder),
        Box::new(skills::SkillsSeeder),
        Box::new(headcount::HeadcountSeeder),
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
        // SO4 integrations — public links + webhooks + person photos.
        // Depend on org for tenant_id + root_node + persons.
        Box::new(public_links::PublicLinksSeeder),
        Box::new(webhooks::WebhooksSeeder),
        Box::new(photos::PhotosSeeder),
    ]
}
