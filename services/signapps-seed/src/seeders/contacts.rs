//! Contacts seeder — 10 external contacts via `crm.leads` (no dedicated
//! contacts table exists in the current schema).

use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::seeders::org::bump;
use crate::uuid::acme_uuid;
use async_trait::async_trait;

/// Seeds 10 external contacts (saved as `crm.leads` rows owned by sales team).
pub struct ContactsSeeder;

const CONTACTS: &[(&str, &str, &str, &str, &str)] = &[
    ("Sophie Lefevre", "sophie@acme-clients.fr", "+33611223344", "ACME Clients", "Dir Marketing"),
    ("Thomas Bernard", "thomas@techcorp.fr", "+33612345678", "TechCorp", "Dev Senior"),
    ("Isabelle Moreau", "isabelle@durand.fr", "+33613456789", "Durand SA", "Avocate"),
    ("Nicolas Petit", "nicolas@innovatech.fr", "+33614567890", "InnovaTech", "Chef Projet"),
    ("Camille Roux", "camille@mediaplus.fr", "+33615678901", "MediaPlus", "Comm"),
    ("Antoine Dubois", "antoine@construire.fr", "+33616789012", "Construire", "Architecte"),
    ("Emilie Laurent", "emilie@santeplus.fr", "+33617890123", "SantéPlus", "Médecin"),
    ("Pierre Girard", "pierre@logisys.fr", "+33618901234", "LogiSys", "Admin Sys"),
    ("Julie Bonnet", "julie@creativ.fr", "+33619012345", "Creativ", "Designer"),
    ("Francois Lemaire", "francois@financegroup.fr", "+33620123456", "FinanceGroup", "Analyste"),
];

#[async_trait]
impl Seeder for ContactsSeeder {
    fn name(&self) -> &'static str {
        "contacts"
    }

    fn dependencies(&self) -> Vec<&'static str> {
        vec!["identity"]
    }

    async fn run(&self, ctx: &SeedContext) -> anyhow::Result<SeedReport> {
        let mut report = SeedReport::default();
        let pool = ctx.db.inner();

        let owner = ctx
            .user("nicolas.robert")
            .ok_or_else(|| anyhow::anyhow!("nicolas.robert not registered"))?;

        for (i, (name, email, phone, company, title)) in CONTACTS.iter().enumerate() {
            let cid = acme_uuid("contact", &format!("c{}", i));
            let notes = format!("Contact démo — {}", title);

            let res = sqlx::query(
                r#"
                INSERT INTO crm.leads (id, name, email, phone, company, source, status, owner_id, tenant_id, notes)
                VALUES ($1, $2, $3, $4, $5, 'seed', 'new', $6, $7, $8)
                ON CONFLICT (id) DO NOTHING
                "#,
            )
            .bind(cid)
            .bind(name)
            .bind(email)
            .bind(phone)
            .bind(company)
            .bind(owner)
            .bind(ctx.tenant_id)
            .bind(&notes)
            .execute(pool)
            .await;
            bump(&mut report, res, "contact");
        }
        Ok(report)
    }
}
