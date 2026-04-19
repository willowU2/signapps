//! Contacts seeder — 30 external contacts via `crm.leads` (no dedicated
//! contacts table exists in the current schema).

use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::seeders::org::bump;
use crate::uuid::acme_uuid;
use async_trait::async_trait;

/// Seeds 30 external contacts (saved as `crm.leads` rows).
pub struct ContactsSeeder;

/// (name, email, phone, company, title, status)
const CONTACTS: &[(&str, &str, &str, &str, &str, &str)] = &[
    // Clients
    ("Sophie Lefevre", "sophie@acme-clients.fr", "+33611223344", "ACME Clients", "Dir Marketing", "customer"),
    ("Thomas Bernard", "thomas@techcorp.fr", "+33612345678", "TechCorp", "Dev Senior", "customer"),
    ("Isabelle Moreau", "isabelle@durand.fr", "+33613456789", "Durand SA", "Avocate", "customer"),
    ("Nicolas Petit", "nicolas@innovatech.fr", "+33614567890", "InnovaTech", "Chef Projet", "customer"),
    ("Camille Roux", "camille@mediaplus.fr", "+33615678901", "MediaPlus", "Comm", "customer"),
    ("Antoine Dubois", "antoine@construire.fr", "+33616789012", "Construire", "Architecte", "customer"),
    ("Emilie Laurent", "emilie@santeplus.fr", "+33617890123", "SantéPlus", "Médecin", "customer"),
    ("Pierre Girard", "pierre@logisys.fr", "+33618901234", "LogiSys", "Admin Sys", "customer"),
    ("Julie Bonnet", "julie@creativ.fr", "+33619012345", "Creativ", "Designer", "customer"),
    ("Francois Lemaire", "francois@financegroup.fr", "+33620123456", "FinanceGroup", "Analyste", "customer"),
    // Prospects (SQLs)
    ("Sabine Clerc", "sabine@biotech-fr.com", "+33621000001", "BioTech France", "DSI", "qualified"),
    ("Marc Levesque", "marc@retail-plus.com", "+33621000002", "Retail+", "COO", "qualified"),
    ("Anna Peres", "anna@energia.es", "+34911234567", "Energia SA", "IT Director", "qualified"),
    ("Stefan Huber", "stefan@helvet-fin.ch", "+41227777777", "Helvet Finance", "CFO", "qualified"),
    ("Lucia Rossi", "lucia@italia-design.it", "+390212345678", "Italia Design", "CTO", "qualified"),
    ("Klaus Becker", "klaus@deutsch-labs.de", "+4930333333", "Deutsch Labs", "Head of Eng", "qualified"),
    ("Maya Wright", "maya@bluesky-us.com", "+14155551234", "BlueSky Inc.", "VP Ops", "new"),
    ("Carlos Santos", "carlos@brasil-it.com.br", "+551133333333", "Brasil IT", "IT Manager", "new"),
    ("Hiroshi Tanaka", "hiroshi@nippon-tech.jp", "+81312341234", "Nippon Tech", "Director", "new"),
    ("Amir Hosseini", "amir@persia-soft.com", "+989121234567", "Persia Soft", "Founder", "new"),
    // Suppliers / partners
    ("Véronique Roy", "v.roy@hosting-pro.fr", "+33622000001", "HostingPro", "Commercial", "partner"),
    ("Xavier Leroy", "x.leroy@devops-agency.fr", "+33622000002", "DevOps Agency", "Partner", "partner"),
    ("Mohamed Traoré", "m.traore@cybersec.fr", "+33622000003", "CyberSec Group", "Expert", "partner"),
    ("Sonia Almeida", "sonia@cloudnative.pt", "+351210001001", "CloudNative Lisboa", "Consultant", "partner"),
    ("Oliver Smith", "oliver@london-legal.co.uk", "+442071234567", "London Legal", "Partner", "partner"),
    ("Jean-Luc Dupuy", "jl.dupuy@cabinet-audit.fr", "+33622000004", "Cabinet Audit", "Associé", "partner"),
    // Internal advisors
    ("Renaud Girard", "renaud@advisors.com", "+33622000005", "Advisors Network", "Mentor", "advisor"),
    ("Natasha Ivanov", "natasha@venture-eu.com", "+33622000006", "Venture EU", "VC", "advisor"),
    ("Brian O'Connell", "brian@scaleup.io", "+353111222333", "ScaleUp.io", "Operator", "advisor"),
    ("Mei Chen", "mei@asia-tech-advisors.sg", "+6591234567", "Asia Tech Advisors", "Advisor", "advisor"),
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

        // Sales VP EMEA owns the prospects; partners owned by COO; etc.
        let default_owner = ctx
            .user("nicolas.robert")
            .ok_or_else(|| anyhow::anyhow!("nicolas.robert not registered"))?;

        for (i, (name, email, phone, company, title, status)) in CONTACTS.iter().enumerate() {
            let cid = acme_uuid("contact", &format!("c{}", i));
            let notes = format!("Contact démo — {}", title);

            let res = sqlx::query(
                r#"
                INSERT INTO crm.leads (id, name, email, phone, company, source, status, owner_id, tenant_id, notes)
                VALUES ($1, $2, $3, $4, $5, 'seed', $6, $7, $8, $9)
                ON CONFLICT (id) DO NOTHING
                "#,
            )
            .bind(cid)
            .bind(name)
            .bind(email)
            .bind(phone)
            .bind(company)
            .bind(status)
            .bind(default_owner)
            .bind(ctx.tenant_id)
            .bind(&notes)
            .execute(pool)
            .await;
            bump(&mut report, res, "contact");
        }
        Ok(report)
    }
}
