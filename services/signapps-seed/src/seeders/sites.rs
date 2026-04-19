//! SO7 S1 — Sites seeder (Paris HQ / Lyon Annex / Remote).
//!
//! Creates a 3-building hierarchy with floors, rooms and desks
//! + 30 site-person links + 10 upcoming bookings. Deterministic UUIDs
//! via [`crate::uuid::acme_uuid`] so runs are idempotent.

use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::uuid::acme_uuid;
use async_trait::async_trait;
use chrono::{Duration, Utc};

/// Layout of the 3 buildings — (slug, parent_slug_or_root, kind,
/// display_name, address?, gps?, capacity?, bookable, equipment_json).
type SiteSpec = (
    &'static str,
    Option<&'static str>,
    &'static str,
    &'static str,
    Option<&'static str>,
    Option<&'static str>,
    Option<i32>,
    bool,
    &'static str,
);

/// Canonical SO7 site layout.
const SITES: &[SiteSpec] = &[
    // Paris HQ
    (
        "paris-hq",
        None,
        "building",
        "Paris HQ",
        Some("18 rue de la Paix, 75002 Paris"),
        Some(r#"{"lat":48.869,"lng":2.331}"#),
        None,
        false,
        r#"{}"#,
    ),
    ("paris-hq-rdc", Some("paris-hq"), "floor", "Rez-de-chaussée", None, None, None, false, r#"{}"#),
    (
        "paris-accueil",
        Some("paris-hq-rdc"),
        "room",
        "Accueil",
        None,
        None,
        Some(5),
        false,
        r#"{}"#,
    ),
    (
        "paris-phoenix",
        Some("paris-hq-rdc"),
        "room",
        "Salle Phoenix",
        None,
        None,
        Some(10),
        true,
        r#"{"videoconf":"Poly G7500","screen":true,"whiteboard":1}"#,
    ),
    ("paris-hq-1", Some("paris-hq"), "floor", "1er étage", None, None, None, false, r#"{}"#),
    (
        "paris-openspace-eng",
        Some("paris-hq-1"),
        "room",
        "Open space Engineering",
        None,
        None,
        Some(30),
        false,
        r#"{"screen":true}"#,
    ),
    (
        "paris-alpha",
        Some("paris-hq-1"),
        "room",
        "Salle Alpha",
        None,
        None,
        Some(6),
        true,
        r#"{"videoconf":"Poly Studio","whiteboard":1}"#,
    ),
    ("paris-hq-2", Some("paris-hq"), "floor", "2e étage", None, None, None, false, r#"{}"#),
    (
        "paris-bureau-marie",
        Some("paris-hq-2"),
        "room",
        "Bureau Marie",
        None,
        None,
        Some(2),
        false,
        r#"{}"#,
    ),
    ("paris-desk-2-1", Some("paris-hq-2"), "desk", "Desk 2-1", None, None, Some(1), false, r#"{}"#),
    ("paris-desk-2-2", Some("paris-hq-2"), "desk", "Desk 2-2", None, None, Some(1), true, r#"{}"#),
    ("paris-desk-2-3", Some("paris-hq-2"), "desk", "Desk 2-3", None, None, Some(1), true, r#"{}"#),
    ("paris-desk-2-4", Some("paris-hq-2"), "desk", "Desk 2-4", None, None, Some(1), true, r#"{}"#),
    ("paris-desk-2-5", Some("paris-hq-2"), "desk", "Desk 2-5", None, None, Some(1), true, r#"{}"#),
    ("paris-desk-2-6", Some("paris-hq-2"), "desk", "Desk 2-6", None, None, Some(1), true, r#"{}"#),
    ("paris-desk-2-7", Some("paris-hq-2"), "desk", "Desk 2-7", None, None, Some(1), true, r#"{}"#),
    ("paris-desk-2-8", Some("paris-hq-2"), "desk", "Desk 2-8", None, None, Some(1), true, r#"{}"#),
    // Lyon Annex
    (
        "lyon-annex",
        None,
        "building",
        "Lyon Annex",
        Some("5 place Bellecour, 69002 Lyon"),
        Some(r#"{"lat":45.757,"lng":4.832}"#),
        None,
        false,
        r#"{}"#,
    ),
    ("lyon-annex-rdc", Some("lyon-annex"), "floor", "Rez-de-chaussée", None, None, None, false, r#"{}"#),
    (
        "lyon-salle",
        Some("lyon-annex-rdc"),
        "room",
        "Salle Lyon",
        None,
        None,
        Some(6),
        true,
        r#"{"videoconf":"Logitech Rally"}"#,
    ),
    // Remote
    (
        "remote",
        None,
        "building",
        "Remote",
        None,
        None,
        None,
        false,
        r#"{"virtual":true}"#,
    ),
    ("remote-home", Some("remote"), "floor", "Home", None, None, None, false, r#"{}"#),
    ("remote-desk", Some("remote-home"), "desk", "Desk remote", None, None, Some(1), false, r#"{}"#),
];

/// Mapping person-slug → site-slug for site-person links (primary).
const PRIMARY_LINKS: &[(&str, &str)] = &[
    ("marie.dupont", "paris-bureau-marie"),
    ("paul.durand", "paris-bureau-marie"),
    ("claire.moreau", "paris-hq-2"),
    ("jean.martin", "paris-hq-2"),
    ("victor.leblanc", "paris-hq-2"),
    ("agnes.perrin", "paris-hq-2"),
    ("sophie.leroy", "paris-openspace-eng"),
    ("thomas.petit", "paris-openspace-eng"),
    ("julie.bernard", "paris-openspace-eng"),
    ("marc.fontaine", "paris-openspace-eng"),
    ("leo.garnier", "paris-openspace-eng"),
    ("olivia.faure", "paris-openspace-eng"),
    ("emma.rousseau", "paris-openspace-eng"),
    ("lucas.fournier", "paris-openspace-eng"),
    ("chloe.henry", "paris-openspace-eng"),
    ("axel.morin", "paris-openspace-eng"),
    ("lina.carpentier", "paris-openspace-eng"),
    ("hugo.dumont", "paris-openspace-eng"),
    ("alice.roche", "paris-openspace-eng"),
    ("raphael.benoit", "paris-openspace-eng"),
    // Lyon (8)
    ("nicolas.robert", "lyon-salle"),
    ("anne.girard", "lyon-salle"),
    ("pierre.lefebvre", "lyon-salle"),
    ("camille.mercier", "lyon-salle"),
    ("theo.brunet", "lyon-salle"),
    ("sarah.lopez", "lyon-salle"),
    ("elise.vincent", "lyon-salle"),
    ("mathis.muller", "lyon-salle"),
    // Remote (2)
    ("michael.thompson", "remote-desk"),
    ("jessica.nguyen", "remote-desk"),
];

/// Bookings for Alpha / Phoenix / Lyon-salle — days ahead from today.
const BOOKINGS: &[(&str, &str, i64, i64, i64, &str)] = &[
    // (owner_person, site_slug, days_ahead, start_hour, duration_min, purpose)
    ("marie.dupont", "paris-alpha", 1, 10, 60, "Comité direction"),
    ("jean.martin", "paris-phoenix", 1, 14, 90, "Point produit"),
    ("sophie.leroy", "paris-alpha", 2, 9, 30, "Stand-up Platform"),
    ("emma.rousseau", "paris-alpha", 2, 11, 60, "Retro Frontend"),
    ("raphael.benoit", "paris-phoenix", 3, 15, 120, "Review modèles"),
    ("nicolas.robert", "lyon-salle", 3, 10, 60, "Démo client"),
    ("elise.vincent", "lyon-salle", 4, 14, 60, "Atelier brand"),
    ("thomas.petit", "paris-alpha", 5, 10, 45, "Pair programming"),
    ("julie.bernard", "paris-phoenix", 6, 9, 60, "Postmortem incident"),
    ("sophie.leroy", "paris-phoenix", 7, 16, 90, "Architecture review"),
];

/// Seeder implementation.
pub struct SitesSeeder;

#[async_trait]
impl Seeder for SitesSeeder {
    fn name(&self) -> &'static str {
        "sites"
    }

    fn dependencies(&self) -> Vec<&'static str> {
        vec!["org"]
    }

    async fn run(&self, ctx: &SeedContext) -> anyhow::Result<SeedReport> {
        let mut report = SeedReport::default();
        let pool = ctx.db.inner();

        // Pass 1 — sites (parents first via the order of SITES; safe because
        // children always follow their parent in the list).
        for (slug, parent_slug, kind, name, address, gps, capacity, bookable, equipment) in SITES {
            let id = acme_uuid("org-site", slug);
            let parent_id = parent_slug.map(|s| acme_uuid("org-site", s));
            let equipment_json: serde_json::Value =
                serde_json::from_str(equipment).unwrap_or_else(|_| serde_json::json!({}));
            let gps_json: Option<serde_json::Value> =
                gps.and_then(|g| serde_json::from_str(g).ok());

            let res = sqlx::query(
                r#"INSERT INTO org_sites
                    (id, tenant_id, parent_id, slug, name, kind, address, gps,
                     timezone, capacity, equipment, bookable)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Europe/Paris',
                           $9, $10, $11)
                   ON CONFLICT (tenant_id, slug) DO UPDATE SET
                     parent_id  = EXCLUDED.parent_id,
                     name       = EXCLUDED.name,
                     kind       = EXCLUDED.kind,
                     address    = EXCLUDED.address,
                     gps        = EXCLUDED.gps,
                     capacity   = EXCLUDED.capacity,
                     equipment  = EXCLUDED.equipment,
                     bookable   = EXCLUDED.bookable,
                     updated_at = now()"#,
            )
            .bind(id)
            .bind(ctx.tenant_id)
            .bind(parent_id)
            .bind(slug)
            .bind(name)
            .bind(kind)
            .bind(address)
            .bind(gps_json)
            .bind(capacity)
            .bind(equipment_json)
            .bind(bookable)
            .execute(pool)
            .await;
            match res {
                Ok(r) => {
                    if r.rows_affected() > 0 {
                        report.created += 1;
                    } else {
                        report.skipped += 1;
                    }
                },
                Err(e) => report.errors.push(format!("site {slug}: {e}")),
            }
        }

        // Pass 2 — primary site-person links.
        for (person_slug, site_slug) in PRIMARY_LINKS {
            let person_id = acme_uuid("person", person_slug);
            let site_id = acme_uuid("org-site", site_slug);
            let link_id = acme_uuid(
                "org-site-person",
                &format!("{person_slug}-{site_slug}-primary"),
            );

            // Clear existing primary rows for the person (handles idempotency
            // against the unique partial index) then insert the deterministic
            // row. ON CONFLICT (id) keeps the same UUID across re-runs.
            let _ = sqlx::query(
                "DELETE FROM org_site_persons
                   WHERE person_id = $1 AND role = 'primary' AND id <> $2",
            )
            .bind(person_id)
            .bind(link_id)
            .execute(pool)
            .await;

            let res = sqlx::query(
                r#"INSERT INTO org_site_persons (id, person_id, site_id, role)
                   VALUES ($1, $2, $3, 'primary')
                   ON CONFLICT (id) DO UPDATE SET
                     site_id = EXCLUDED.site_id"#,
            )
            .bind(link_id)
            .bind(person_id)
            .bind(site_id)
            .execute(pool)
            .await;
            match res {
                Ok(r) => {
                    if r.rows_affected() > 0 {
                        report.created += 1;
                    } else {
                        report.skipped += 1;
                    }
                },
                Err(e) => {
                    report
                        .errors
                        .push(format!("site-person {person_slug}: {e}"));
                },
            }
        }

        // Pass 3 — 10 bookings (confirmed, future).
        let now = Utc::now();
        for (person_slug, site_slug, days_ahead, hour, duration_min, purpose) in BOOKINGS {
            let person_id = acme_uuid("person", person_slug);
            let site_id = acme_uuid("org-site", site_slug);
            let booking_id = acme_uuid(
                "org-site-booking",
                &format!("{site_slug}-{person_slug}-{days_ahead}-{hour}"),
            );
            let start_at = (now + Duration::days(*days_ahead))
                .date_naive()
                .and_hms_opt(u32::try_from(*hour).unwrap_or(9), 0, 0)
                .unwrap_or_else(|| now.naive_utc())
                .and_utc();
            let end_at = start_at + Duration::minutes(*duration_min);

            let res = sqlx::query(
                r#"INSERT INTO org_site_bookings
                    (id, site_id, person_id, start_at, end_at, purpose, status)
                   VALUES ($1, $2, $3, $4, $5, $6, 'confirmed')
                   ON CONFLICT (id) DO UPDATE SET
                     start_at   = EXCLUDED.start_at,
                     end_at     = EXCLUDED.end_at,
                     purpose    = EXCLUDED.purpose,
                     updated_at = now()"#,
            )
            .bind(booking_id)
            .bind(site_id)
            .bind(person_id)
            .bind(start_at)
            .bind(end_at)
            .bind(purpose)
            .execute(pool)
            .await;
            match res {
                Ok(r) => {
                    if r.rows_affected() > 0 {
                        report.created += 1;
                    } else {
                        report.skipped += 1;
                    }
                },
                Err(e) => {
                    report
                        .errors
                        .push(format!("booking {site_slug}/{person_slug}: {e}"));
                },
            }
        }

        Ok(report)
    }
}
