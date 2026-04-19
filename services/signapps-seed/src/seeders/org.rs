//! Org structure seeder — Nexus Industries tenant + 14 OUs + 80 persons.
//!
//! Real schema notes:
//! - `public.org_nodes` (not `org.org_nodes`)
//! - columns: `id, tenant_id, kind, parent_id, path, name, slug, attributes, active`
//! - `public.org_persons`: `id, tenant_id, user_id, email, first_name, last_name, dn, attributes, active`
//! - `public.org_assignments`: `id, tenant_id, person_id, node_id, axis, role, is_primary, ...`
//!
//! Layout (Nexus Industries — 80 persons):
//! - Direction (5): CEO, CFO, CTO, CMO, COO
//! - Engineering (20, 3 sub-teams): Platform (6), Frontend (7), AI (7)
//! - Sales (12, 2 regions): EMEA (6), Americas (6)
//! - Marketing (8)
//! - Support (10)
//! - Finance (6)
//! - HR (5)
//! - Operations (14)

use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::uuid::acme_uuid;
use async_trait::async_trait;

/// Seeds the Nexus Industries tenant row, org tree, and persons with assignments.
pub struct OrgSeeder;

/// Tuple layout: (username, first_name, last_name, email, ou_slug, title).
pub type Person = (
    &'static str,
    &'static str,
    &'static str,
    &'static str,
    &'static str,
    &'static str,
);

/// Flat OUs list (slug, display name, parent_slug_or_root, kind).
/// Root is "nexus". kind is always "unit" except root ("root").
pub const OUS: &[(&str, &str, &str, &str)] = &[
    // Top-level units (parent = root)
    ("direction", "Direction", "root", "unit"),
    ("engineering", "Engineering", "root", "unit"),
    ("sales", "Sales", "root", "unit"),
    ("marketing", "Marketing", "root", "unit"),
    ("support", "Support", "root", "unit"),
    ("finance", "Finance", "root", "unit"),
    ("hr", "HR", "root", "unit"),
    ("operations", "Operations", "root", "unit"),
    // Engineering sub-units
    ("eng-platform", "Platform Team", "engineering", "unit"),
    ("eng-frontend", "Frontend Team", "engineering", "unit"),
    ("eng-ai", "AI Team", "engineering", "unit"),
    // Sales sub-units
    ("sales-emea", "Sales EMEA", "sales", "unit"),
    ("sales-americas", "Sales Americas", "sales", "unit"),
];

/// Flat list of all 80 Nexus Industries persons. Shared with other seeders.
/// The first 15 are kept stable vs. the original Acme Corp seed so existing IDs stay valid.
pub const PERSONS: &[Person] = &[
    // ── Direction (5) — includes the legacy top 3 ────────────────────────────
    ("marie.dupont", "Marie", "Dupont", "marie.dupont@nexus.corp", "direction", "CEO"),
    ("paul.durand", "Paul", "Durand", "paul.durand@nexus.corp", "direction", "CFO"),
    ("claire.moreau", "Claire", "Moreau", "claire.moreau@nexus.corp", "hr", "CHRO"),
    ("jean.martin", "Jean", "Martin", "jean.martin@nexus.corp", "direction", "CTO"),
    ("victor.leblanc", "Victor", "Leblanc", "victor.leblanc@nexus.corp", "direction", "CMO"),
    ("agnes.perrin", "Agnès", "Perrin", "agnes.perrin@nexus.corp", "direction", "COO"),
    // ── Engineering Platform (6) — reuses legacy sophie + thomas ─────────────
    ("sophie.leroy", "Sophie", "Leroy", "sophie.leroy@nexus.corp", "eng-platform", "Platform Lead"),
    ("thomas.petit", "Thomas", "Petit", "thomas.petit@nexus.corp", "eng-platform", "Senior Platform Eng"),
    ("julie.bernard", "Julie", "Bernard", "julie.bernard@nexus.corp", "eng-platform", "DevOps"),
    ("marc.fontaine", "Marc", "Fontaine", "marc.fontaine@nexus.corp", "eng-platform", "SRE"),
    ("leo.garnier", "Léo", "Garnier", "leo.garnier@nexus.corp", "eng-platform", "Backend Eng"),
    ("olivia.faure", "Olivia", "Faure", "olivia.faure@nexus.corp", "eng-platform", "Backend Eng"),
    // ── Engineering Frontend (7) — reuses legacy emma + lucas ────────────────
    ("emma.rousseau", "Emma", "Rousseau", "emma.rousseau@nexus.corp", "eng-frontend", "Frontend Lead"),
    ("lucas.fournier", "Lucas", "Fournier", "lucas.fournier@nexus.corp", "eng-frontend", "Senior Frontend"),
    ("chloe.henry", "Chloé", "Henry", "chloe.henry@nexus.corp", "eng-frontend", "Frontend Eng"),
    ("axel.morin", "Axel", "Morin", "axel.morin@nexus.corp", "eng-frontend", "Frontend Eng"),
    ("lina.carpentier", "Lina", "Carpentier", "lina.carpentier@nexus.corp", "eng-frontend", "Design Eng"),
    ("hugo.dumont", "Hugo", "Dumont", "hugo.dumont@nexus.corp", "eng-frontend", "Junior Frontend"),
    ("alice.roche", "Alice", "Roche", "alice.roche@nexus.corp", "eng-frontend", "Junior Frontend"),
    // ── Engineering AI (7) ───────────────────────────────────────────────────
    ("raphael.benoit", "Raphaël", "Benoît", "raphael.benoit@nexus.corp", "eng-ai", "AI Lead"),
    ("zoe.marchand", "Zoé", "Marchand", "zoe.marchand@nexus.corp", "eng-ai", "ML Engineer"),
    ("sacha.riviere", "Sacha", "Rivière", "sacha.riviere@nexus.corp", "eng-ai", "ML Engineer"),
    ("ines.bourdon", "Inès", "Bourdon", "ines.bourdon@nexus.corp", "eng-ai", "Data Scientist"),
    ("noah.simon", "Noah", "Simon", "noah.simon@nexus.corp", "eng-ai", "ML Eng"),
    ("lea.perez", "Léa", "Perez", "lea.perez@nexus.corp", "eng-ai", "MLOps"),
    ("adam.bertrand", "Adam", "Bertrand", "adam.bertrand@nexus.corp", "eng-ai", "Research Eng"),
    // ── Sales EMEA (6) — reuses legacy nicolas + anne + pierre + camille ─────
    ("nicolas.robert", "Nicolas", "Robert", "nicolas.robert@nexus.corp", "sales-emea", "VP Sales EMEA"),
    ("anne.girard", "Anne", "Girard", "anne.girard@nexus.corp", "sales-emea", "Account Manager"),
    ("pierre.lefebvre", "Pierre", "Lefebvre", "pierre.lefebvre@nexus.corp", "sales-emea", "Business Dev"),
    ("camille.mercier", "Camille", "Mercier", "camille.mercier@nexus.corp", "sales-emea", "SDR"),
    ("theo.brunet", "Théo", "Brunet", "theo.brunet@nexus.corp", "sales-emea", "Account Exec"),
    ("sarah.lopez", "Sarah", "Lopez", "sarah.lopez@nexus.corp", "sales-emea", "Account Exec"),
    // ── Sales Americas (6) ───────────────────────────────────────────────────
    ("michael.thompson", "Michael", "Thompson", "michael.thompson@nexus.corp", "sales-americas", "VP Sales Americas"),
    ("jessica.nguyen", "Jessica", "Nguyen", "jessica.nguyen@nexus.corp", "sales-americas", "Account Manager"),
    ("david.clark", "David", "Clark", "david.clark@nexus.corp", "sales-americas", "Account Exec"),
    ("amanda.white", "Amanda", "White", "amanda.white@nexus.corp", "sales-americas", "SDR"),
    ("ryan.patel", "Ryan", "Patel", "ryan.patel@nexus.corp", "sales-americas", "Account Exec"),
    ("olivia.garcia", "Olivia", "Garcia", "olivia.garcia@nexus.corp", "sales-americas", "BDR"),
    // ── Marketing (8) ────────────────────────────────────────────────────────
    ("elise.vincent", "Élise", "Vincent", "elise.vincent@nexus.corp", "marketing", "Marketing Director"),
    ("mathis.muller", "Mathis", "Muller", "mathis.muller@nexus.corp", "marketing", "Content Manager"),
    ("nora.baron", "Nora", "Baron", "nora.baron@nexus.corp", "marketing", "Growth Manager"),
    ("jules.duval", "Jules", "Duval", "jules.duval@nexus.corp", "marketing", "SEO Specialist"),
    ("ambre.boyer", "Ambre", "Boyer", "ambre.boyer@nexus.corp", "marketing", "Community Manager"),
    ("gabriel.lemoine", "Gabriel", "Lemoine", "gabriel.lemoine@nexus.corp", "marketing", "Designer"),
    ("rose.charrier", "Rose", "Charrier", "rose.charrier@nexus.corp", "marketing", "Events Manager"),
    ("elliot.olivier", "Elliot", "Olivier", "elliot.olivier@nexus.corp", "marketing", "PMM"),
    // ── Support (10) — reuses legacy antoine + isabelle ─────────────────────
    ("antoine.bonnet", "Antoine", "Bonnet", "antoine.bonnet@nexus.corp", "support", "Support Director"),
    ("isabelle.noel", "Isabelle", "Noel", "isabelle.noel@nexus.corp", "support", "Senior Support Agent"),
    ("maxime.rey", "Maxime", "Rey", "maxime.rey@nexus.corp", "support", "Support Agent"),
    ("lucie.sanchez", "Lucie", "Sanchez", "lucie.sanchez@nexus.corp", "support", "Support Agent"),
    ("baptiste.leroux", "Baptiste", "Leroux", "baptiste.leroux@nexus.corp", "support", "Support Agent"),
    ("maya.prevost", "Maya", "Prévost", "maya.prevost@nexus.corp", "support", "Support Agent"),
    ("clement.faure", "Clément", "Faure", "clement.faure@nexus.corp", "support", "Tier 2"),
    ("alba.renaud", "Alba", "Renaud", "alba.renaud@nexus.corp", "support", "Tier 2"),
    ("noa.barre", "Noa", "Barre", "noa.barre@nexus.corp", "support", "Tier 3"),
    ("naomi.gros", "Naomi", "Gros", "naomi.gros@nexus.corp", "support", "KB Writer"),
    // ── Finance (6) ──────────────────────────────────────────────────────────
    ("benjamin.blanc", "Benjamin", "Blanc", "benjamin.blanc@nexus.corp", "finance", "Finance Director"),
    ("aline.gautier", "Aline", "Gautier", "aline.gautier@nexus.corp", "finance", "Controller"),
    ("hector.boulanger", "Hector", "Boulanger", "hector.boulanger@nexus.corp", "finance", "Accountant"),
    ("vera.blanchard", "Vera", "Blanchard", "vera.blanchard@nexus.corp", "finance", "Accountant"),
    ("louis.michel", "Louis", "Michel", "louis.michel@nexus.corp", "finance", "Treasury"),
    ("jade.caron", "Jade", "Caron", "jade.caron@nexus.corp", "finance", "Financial Analyst"),
    // ── HR (5, excluding Claire who sits in direction axis) ──────────────────
    ("mia.lecomte", "Mia", "Lecomte", "mia.lecomte@nexus.corp", "hr", "HR Business Partner"),
    ("theodore.fabre", "Théodore", "Fabre", "theodore.fabre@nexus.corp", "hr", "Recruiter"),
    ("eva.noel", "Eva", "Noël", "eva.noel@nexus.corp", "hr", "Recruiter"),
    ("malo.picard", "Malo", "Picard", "malo.picard@nexus.corp", "hr", "L&D"),
    ("alma.vidal", "Alma", "Vidal", "alma.vidal@nexus.corp", "hr", "Payroll"),
    // ── Operations (14) ──────────────────────────────────────────────────────
    ("boris.lambert", "Boris", "Lambert", "boris.lambert@nexus.corp", "operations", "COO Deputy"),
    ("celine.pasquier", "Céline", "Pasquier", "celine.pasquier@nexus.corp", "operations", "Ops Manager"),
    ("dorian.gauthier", "Dorian", "Gauthier", "dorian.gauthier@nexus.corp", "operations", "Supply Chain"),
    ("elena.barthelemy", "Elena", "Barthélémy", "elena.barthelemy@nexus.corp", "operations", "Logistics"),
    ("florian.adam", "Florian", "Adam", "florian.adam@nexus.corp", "operations", "Logistics"),
    ("gemma.nicolas", "Gemma", "Nicolas", "gemma.nicolas@nexus.corp", "operations", "Procurement"),
    ("hadrien.morel", "Hadrien", "Morel", "hadrien.morel@nexus.corp", "operations", "Procurement"),
    ("iris.delmas", "Iris", "Delmas", "iris.delmas@nexus.corp", "operations", "Facilities"),
    ("joachim.poirier", "Joachim", "Poirier", "joachim.poirier@nexus.corp", "operations", "Facilities"),
    ("karina.teixeira", "Karina", "Teixeira", "karina.teixeira@nexus.corp", "operations", "Legal"),
    ("louane.renard", "Louane", "Renard", "louane.renard@nexus.corp", "operations", "Legal"),
    ("manu.brun", "Manu", "Brun", "manu.brun@nexus.corp", "operations", "Compliance"),
    ("nina.jacquet", "Nina", "Jacquet", "nina.jacquet@nexus.corp", "operations", "Compliance"),
    ("otto.costa", "Otto", "Costa", "otto.costa@nexus.corp", "operations", "IT Ops"),
];

#[async_trait]
impl Seeder for OrgSeeder {
    fn name(&self) -> &'static str {
        "org"
    }

    async fn run(&self, ctx: &SeedContext) -> anyhow::Result<SeedReport> {
        let mut report = SeedReport::default();
        let pool = ctx.db.inner();

        // Tenant row is created in lib::resolve_or_create_tenant before this
        // seeder runs, so ctx.tenant_id is always valid. Rename to Nexus Industries.
        let res = sqlx::query(
            r#"
            UPDATE identity.tenants SET name = 'Nexus Industries', domain = 'nexus.corp'
            WHERE id = $1 AND (name <> 'Nexus Industries' OR domain <> 'nexus.corp')
            "#,
        )
        .bind(ctx.tenant_id)
        .execute(pool)
        .await;
        bump(&mut report, res, "tenant-rename");

        // Root org node — reuse the same deterministic UUID as the legacy
        // "acme-corp" key so pre-existing references stay valid.
        let root_id = acme_uuid("org-node", "acme-corp");
        ctx.register_node("root", root_id);
        let res = sqlx::query(
            r#"
            INSERT INTO org_nodes (id, tenant_id, kind, parent_id, path, name, slug, active)
            VALUES ($1, $2, 'root', NULL, 'nexus_industries'::ltree, 'Nexus Industries', 'nexus', TRUE)
            ON CONFLICT (id) DO UPDATE SET
                kind = 'root',
                name = 'Nexus Industries',
                slug = 'nexus',
                path = 'nexus_industries'::ltree
            "#,
        )
        .bind(root_id)
        .bind(ctx.tenant_id)
        .execute(pool)
        .await;
        bump(&mut report, res, "root-node");

        // 13 OUs — first top-level, then sub-units (after parents exist)
        for (slug, name, parent_slug, kind) in OUS.iter() {
            let id = acme_uuid("org-node", slug);
            ctx.register_node(slug, id);

            // Resolve parent
            let parent_id = if *parent_slug == "root" {
                root_id
            } else {
                acme_uuid("org-node", parent_slug)
            };

            // Compute ltree path: nexus_industries[.parent_slug].slug
            let slug_norm = slug.replace('-', "_");
            let path = if *parent_slug == "root" {
                format!("nexus_industries.{}", slug_norm)
            } else {
                let ps = parent_slug.replace('-', "_");
                format!("nexus_industries.{}.{}", ps, slug_norm)
            };

            let res = sqlx::query(
                r#"
                INSERT INTO org_nodes (id, tenant_id, kind, parent_id, path, name, slug, active)
                VALUES ($1, $2, $3, $4, $5::ltree, $6, $7, TRUE)
                ON CONFLICT (id) DO UPDATE SET
                    kind = EXCLUDED.kind,
                    parent_id = EXCLUDED.parent_id,
                    path = EXCLUDED.path,
                    name = EXCLUDED.name,
                    slug = EXCLUDED.slug
                "#,
            )
            .bind(id)
            .bind(ctx.tenant_id)
            .bind(kind)
            .bind(parent_id)
            .bind(&path)
            .bind(name)
            .bind(slug)
            .execute(pool)
            .await;
            bump(&mut report, res, "ou");
        }

        // 80 persons + primary assignments
        for (username, first_name, last_name, email, ou, title) in PERSONS.iter() {
            let person_id = acme_uuid("person", username);
            let user_id = acme_uuid("user", username);
            let node_id = ctx
                .node(ou)
                .ok_or_else(|| anyhow::anyhow!("OU not registered: {}", ou))?;

            let attributes = serde_json::json!({
                "title": title,
                "username": username,
            });

            // Upsert email + attributes so legacy @acme.corp rows get migrated.
            let res = sqlx::query(
                r#"
                INSERT INTO org_persons (id, tenant_id, user_id, email, first_name, last_name, attributes, active)
                VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, TRUE)
                ON CONFLICT (id) DO UPDATE SET
                    email = EXCLUDED.email,
                    first_name = EXCLUDED.first_name,
                    last_name = EXCLUDED.last_name,
                    attributes = EXCLUDED.attributes,
                    tenant_id = EXCLUDED.tenant_id
                "#,
            )
            .bind(person_id)
            .bind(ctx.tenant_id)
            .bind(user_id)
            .bind(email)
            .bind(first_name)
            .bind(last_name)
            .bind(&attributes)
            .execute(pool)
            .await;
            bump(&mut report, res, "person");

            // Upsert assignment so legacy persons get re-tagged to their new OU
            // (e.g. claire.moreau: direction → hr, jean.martin: engineering → direction).
            let assignment_id = acme_uuid("org-assignment", username);
            let res = sqlx::query(
                r#"
                INSERT INTO org_assignments (id, tenant_id, person_id, node_id, axis, role, is_primary)
                VALUES ($1, $2, $3, $4, 'hierarchy', 'member', TRUE)
                ON CONFLICT (id) DO UPDATE SET
                    node_id = EXCLUDED.node_id,
                    tenant_id = EXCLUDED.tenant_id
                "#,
            )
            .bind(assignment_id)
            .bind(ctx.tenant_id)
            .bind(person_id)
            .bind(node_id)
            .execute(pool)
            .await;
            bump(&mut report, res, "assignment");

            ctx.register_user(username, user_id);
        }

        Ok(report)
    }
}

/// Helper: bump the report counters based on a SQLx query result.
pub(crate) fn bump(
    report: &mut SeedReport,
    res: Result<sqlx::postgres::PgQueryResult, sqlx::Error>,
    kind: &str,
) {
    match res {
        Ok(r) => {
            if r.rows_affected() > 0 {
                report.created += r.rows_affected() as usize;
            } else {
                report.skipped += 1;
            }
        }
        Err(e) => report.errors.push(format!("{kind}: {e}")),
    }
}
