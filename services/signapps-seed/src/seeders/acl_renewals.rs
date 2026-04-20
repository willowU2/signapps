//! SO9 — ACL explicites + renouvellements + multi-assign ré-ingestion.
//!
//! Crée :
//! - 25 ACL rows (rôles globaux, admins, groupes, resources-specific)
//! - 30 renewals répartis sur 12 mois (warranty/license/badge/inspection)
//! - ~10 multi-role assignments (primary_user + secondary_user +
//!   caretaker) en plus des owners déjà migrés par la migration 507.
//!
//! Idempotent via deterministic UUIDs + ON CONFLICT clauses.

use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::seeders::org::bump;
use crate::uuid::acme_uuid;
use async_trait::async_trait;
use chrono::{Duration, NaiveDate};

pub struct AclRenewalsSeeder;

// ─── ACL rows ─────────────────────────────────────────────────────────

/// `(slug, subject_type, subject_ref_or_person_slug, action, resource_type,
///  resource_slug_opt, effect, reason)`
type AclSpec = (
    &'static str,
    &'static str,
    &'static str,
    &'static str,
    &'static str,
    Option<&'static str>,
    &'static str,
    &'static str,
);

const ACLS: &[AclSpec] = &[
    // ── Role-based (3) ───────────────────────────────────────────────
    (
        "role-vehicle-mgr-all",
        "role",
        "vehicle_manager",
        "*",
        "resource",
        None,
        "allow",
        "vehicle_manager blanket on all vehicles",
    ),
    (
        "role-badge-mgr-all",
        "role",
        "badge_manager",
        "*",
        "resource",
        None,
        "allow",
        "badge_manager blanket",
    ),
    (
        "role-it-mgr-all",
        "role",
        "it_manager",
        "*",
        "resource",
        None,
        "allow",
        "it_manager blanket",
    ),
    // ── Person-based admins (5) ──────────────────────────────────────
    (
        "person-marie-all",
        "person",
        "marie.dupont",
        "*",
        "*",
        None,
        "allow",
        "CEO admin blanket",
    ),
    (
        "person-paul-all",
        "person",
        "paul.durand",
        "*",
        "*",
        None,
        "allow",
        "CFO admin blanket",
    ),
    (
        "person-jean-all",
        "person",
        "jean.martin",
        "*",
        "*",
        None,
        "allow",
        "CTO admin blanket",
    ),
    (
        "person-claire-read",
        "person",
        "claire.moreau",
        "read",
        "resource",
        None,
        "allow",
        "CHRO read-only on all resources",
    ),
    (
        "person-agnes-update",
        "person",
        "agnes.perrin",
        "update",
        "resource",
        None,
        "allow",
        "COO update on resources",
    ),
    // ── Resource-specific (12) — granular on Tesla Y, MacBooks, badges
    (
        "tesla-y-owner-marie",
        "person",
        "marie.dupont",
        "*",
        "resource",
        Some("veh-tesla-y-01"),
        "allow",
        "Marie owns Tesla Y",
    ),
    (
        "tesla-y-caretaker",
        "person",
        "paul.durand",
        "transition",
        "resource",
        Some("veh-tesla-y-01"),
        "allow",
        "Paul caretaker (CFO) transitions vehicle",
    ),
    (
        "tesla-y-secondary",
        "person",
        "sophie.leroy",
        "read",
        "resource",
        Some("veh-tesla-y-01"),
        "allow",
        "Sophie secondary user",
    ),
    (
        "macbook-marie-owner",
        "person",
        "marie.dupont",
        "*",
        "resource",
        Some("it-laptop-marie"),
        "allow",
        "Marie owns her MacBook",
    ),
    (
        "macbook-marie-caretaker",
        "person",
        "sophie.leroy",
        "update",
        "resource",
        Some("it-laptop-marie"),
        "allow",
        "Platform lead updates IT devices",
    ),
    (
        "badge-marie-self",
        "person",
        "marie.dupont",
        "read",
        "resource",
        Some("badge-marie"),
        "allow",
        "Marie reads her own badge",
    ),
    (
        "lic-figma-design-team",
        "person",
        "emma.rousseau",
        "read",
        "resource",
        Some("lic-figma"),
        "allow",
        "Emma reads Figma license",
    ),
    (
        "av-projector-auditorium-ops",
        "person",
        "agnes.perrin",
        "update",
        "resource",
        Some("av-epson-1"),
        "allow",
        "COO updates auditorium projector",
    ),
    (
        "av-projector-board-restricted",
        "everyone",
        "",
        "read",
        "resource",
        Some("av-epson-2"),
        "deny",
        "Board projector restricted",
    ),
    (
        "key-safe-paris-ceo",
        "person",
        "marie.dupont",
        "*",
        "resource",
        Some("key-safe-paris"),
        "allow",
        "CEO has key safe",
    ),
    (
        "badge-visitor-all-read",
        "auth_user",
        "",
        "read",
        "resource",
        Some("badge-visitor-01"),
        "allow",
        "Any auth user can look up visitor template",
    ),
    (
        "lic-adobe-marketing-read",
        "person",
        "victor.leblanc",
        "read",
        "resource",
        Some("lic-adobe-cc"),
        "allow",
        "CMO reads Adobe CC",
    ),
    // ── Auth_user everyone (5) ───────────────────────────────────────
    (
        "auth-user-read-own-inventory",
        "auth_user",
        "",
        "read",
        "resource",
        None,
        "allow",
        "Authenticated users read resource metadata",
    ),
    (
        "everyone-deny-delete-all",
        "everyone",
        "",
        "delete",
        "resource",
        None,
        "deny",
        "Nobody but admin deletes resources",
    ),
];

// ─── Renewals (30 rows) ──────────────────────────────────────────────

/// `(slug, resource_slug, kind, due_date, grace_days, status, notes)`
type RenewalSpec = (
    &'static str,
    &'static str,
    &'static str,
    &'static str,
    i32,
    &'static str,
    &'static str,
);

const RENEWALS: &[RenewalSpec] = &[
    // ── 5 licence expiries 2027 ──────────────────────────────────────
    (
        "ren-lic-figma",
        "lic-figma",
        "license_expiry",
        "2027-01-15",
        0,
        "pending",
        "Figma Enterprise 20 seats",
    ),
    (
        "ren-lic-adobe",
        "lic-adobe-cc",
        "license_expiry",
        "2027-01-15",
        0,
        "pending",
        "Adobe CC 15 seats",
    ),
    (
        "ren-lic-notion",
        "lic-notion",
        "license_expiry",
        "2027-01-15",
        0,
        "pending",
        "Notion Enterprise 80 seats",
    ),
    (
        "ren-lic-linear",
        "lic-linear",
        "license_expiry",
        "2027-01-15",
        0,
        "pending",
        "Linear Business 40 seats",
    ),
    (
        "ren-lic-miro",
        "lic-miro",
        "license_expiry",
        "2027-01-15",
        0,
        "pending",
        "Miro Enterprise 25 seats",
    ),
    // ── 10 garanties IT 2026-2027 ────────────────────────────────────
    (
        "ren-warr-laptop-marie",
        "it-laptop-marie",
        "warranty_end",
        "2026-10-01",
        0,
        "pending",
        "MacBook Pro Marie",
    ),
    (
        "ren-warr-laptop-paul",
        "it-laptop-paul",
        "warranty_end",
        "2026-11-01",
        0,
        "pending",
        "MacBook Pro Paul",
    ),
    (
        "ren-warr-laptop-jean",
        "it-laptop-jean",
        "warranty_end",
        "2027-02-01",
        0,
        "pending",
        "MacBook Pro Jean",
    ),
    (
        "ren-warr-laptop-claire",
        "it-laptop-claire",
        "warranty_end",
        "2027-03-15",
        0,
        "pending",
        "MacBook Pro Claire",
    ),
    (
        "ren-warr-laptop-sophie",
        "it-laptop-sophie",
        "warranty_end",
        "2027-05-01",
        0,
        "pending",
        "MacBook Pro Sophie",
    ),
    (
        "ren-warr-av-epson-1",
        "av-epson-1",
        "warranty_end",
        "2026-03-10",
        0,
        "escalated",
        "Projecteur auditorium — garantie dépassée, à renouveler",
    ),
    (
        "ren-warr-av-epson-2",
        "av-epson-2",
        "warranty_end",
        "2026-03-10",
        0,
        "escalated",
        "Projecteur Board — garantie dépassée",
    ),
    (
        "ren-warr-camera-sony-1",
        "av-camera-sony-1",
        "warranty_end",
        "2026-04-01",
        14,
        "pending",
        "Caméra Sony Paris",
    ),
    (
        "ren-warr-camera-sony-2",
        "av-camera-sony-2",
        "warranty_end",
        "2026-04-01",
        14,
        "pending",
        "Caméra Sony Amsterdam",
    ),
    (
        "ren-warr-screen-samsung-1",
        "av-screen-samsung-1",
        "warranty_end",
        "2025-06-15",
        0,
        "escalated",
        "Écran Samsung 55 — hors garantie",
    ),
    // ── 10 CT véhicules 12 mois ──────────────────────────────────────
    (
        "ren-ct-tesla-y",
        "veh-tesla-y-01",
        "technical_inspection",
        "2027-06-15",
        30,
        "pending",
        "CT Tesla Model Y",
    ),
    (
        "ren-ct-tesla-3",
        "veh-tesla-3-01",
        "technical_inspection",
        "2027-09-20",
        30,
        "pending",
        "CT Tesla Model 3",
    ),
    (
        "ren-ct-peugeot-408",
        "veh-peugeot-408-01",
        "technical_inspection",
        "2026-11-05",
        30,
        "pending",
        "CT Peugeot 408 GT",
    ),
    (
        "ren-ct-peugeot-5008",
        "veh-peugeot-5008-01",
        "technical_inspection",
        "2026-08-10",
        30,
        "pending",
        "CT Peugeot 5008",
    ),
    (
        "ren-ct-renault-megane",
        "veh-renault-megane-01",
        "technical_inspection",
        "2026-12-01",
        30,
        "pending",
        "CT Renault Megane",
    ),
    (
        "ren-ins-tesla-y",
        "veh-tesla-y-01",
        "insurance_expiry",
        "2026-12-31",
        7,
        "pending",
        "Assurance Tesla Y",
    ),
    (
        "ren-ins-tesla-3",
        "veh-tesla-3-01",
        "insurance_expiry",
        "2026-12-31",
        7,
        "pending",
        "Assurance Tesla 3",
    ),
    (
        "ren-maint-tesla-y",
        "veh-tesla-y-01",
        "maintenance_due",
        "2026-07-15",
        15,
        "pending",
        "Maintenance Tesla Y",
    ),
    (
        "ren-maint-tesla-3",
        "veh-tesla-3-01",
        "maintenance_due",
        "2026-09-20",
        15,
        "pending",
        "Maintenance Tesla 3",
    ),
    (
        "ren-bat-tesla-y",
        "veh-tesla-y-01",
        "battery_replacement",
        "2030-01-15",
        0,
        "pending",
        "Batterie Tesla Y (échéance longue)",
    ),
    // ── 5 validités badges 12 mois ───────────────────────────────────
    (
        "ren-bdg-marie",
        "badge-marie",
        "badge_validity",
        "2027-12-31",
        0,
        "pending",
        "Badge CEO",
    ),
    (
        "ren-bdg-paul",
        "badge-paul",
        "badge_validity",
        "2027-12-31",
        0,
        "pending",
        "Badge CFO",
    ),
    (
        "ren-bdg-jean",
        "badge-jean",
        "badge_validity",
        "2027-12-31",
        0,
        "pending",
        "Badge CTO",
    ),
    (
        "ren-bdg-contractor-01",
        "badge-contractor-01",
        "badge_validity",
        "2026-12-31",
        0,
        "pending",
        "Badge prestataire nettoyage",
    ),
    (
        "ren-bdg-contractor-02",
        "badge-contractor-02",
        "badge_validity",
        "2026-12-31",
        0,
        "pending",
        "Badge prestataire IT",
    ),
];

// ─── Multi-role assignments (10 rows) ─────────────────────────────────

/// `(slug, resource_slug, subject_type, subject_slug, role, is_primary, reason)`
type MultiAssignSpec = (
    &'static str,
    &'static str,
    &'static str,
    &'static str,
    &'static str,
    bool,
    &'static str,
);

const MULTI_ASSIGNMENTS: &[MultiAssignSpec] = &[
    // Tesla Y — Marie owns, Sophie secondary_user, Paul caretaker
    (
        "asg-tesla-y-sophie",
        "veh-tesla-y-01",
        "person",
        "sophie.leroy",
        "secondary_user",
        false,
        "Occasional weekend usage",
    ),
    (
        "asg-tesla-y-paul",
        "veh-tesla-y-01",
        "person",
        "paul.durand",
        "caretaker",
        false,
        "Fleet caretaker",
    ),
    // Tesla 3 — Paul owns, Marie primary_user
    (
        "asg-tesla-3-marie",
        "veh-tesla-3-01",
        "person",
        "marie.dupont",
        "primary_user",
        true,
        "CEO uses CFO's car",
    ),
    // MacBook Marie — Sophie maintainer
    (
        "asg-laptop-marie-sophie",
        "it-laptop-marie",
        "person",
        "sophie.leroy",
        "maintainer",
        false,
        "Platform lead maintains executives laptops",
    ),
    // Projecteur Epson auditorium — ops maintainer
    (
        "asg-av-epson-1-maintainer",
        "av-epson-1",
        "node",
        "operations",
        "maintainer",
        false,
        "Ops node maintains projector",
    ),
    // Peugeot 408 — Jean owns, Sophie secondary
    (
        "asg-peugeot-408-sophie",
        "veh-peugeot-408-01",
        "person",
        "sophie.leroy",
        "secondary_user",
        false,
        "Engineering trips",
    ),
    // Lic Figma — engineering node primary_user
    (
        "asg-lic-figma-eng",
        "lic-figma",
        "node",
        "engineering",
        "primary_user",
        true,
        "Engineering team primary",
    ),
    // Key veh-tesla-y-01 - Emma secondary
    (
        "asg-key-tesla-y-emma",
        "key-veh-tesla-y-01",
        "person",
        "emma.rousseau",
        "secondary_user",
        false,
        "Backup key holder",
    ),
    // Badge Marie — self primary_user
    (
        "asg-badge-marie-self-primary",
        "badge-marie",
        "person",
        "marie.dupont",
        "primary_user",
        true,
        "Self primary on own badge",
    ),
    // Camera Sony Paris — marketing group primary
    (
        "asg-camera-sony-1-marketing",
        "av-camera-sony-1",
        "node",
        "marketing",
        "caretaker",
        false,
        "Marketing caretakes cameras",
    ),
];

#[async_trait]
impl Seeder for AclRenewalsSeeder {
    fn name(&self) -> &'static str {
        "acl_renewals"
    }

    fn dependencies(&self) -> Vec<&'static str> {
        vec!["resources"]
    }

    async fn run(&self, ctx: &SeedContext) -> anyhow::Result<SeedReport> {
        let mut report = SeedReport::default();
        let pool = ctx.db.inner();

        // ── ACLs ──────────────────────────────────────────────────────
        for (slug, subject_type, subject_ref, action, resource_type, resource_slug, effect, reason) in
            ACLS
        {
            let id = acme_uuid("org-acl", slug);
            let subject_id: Option<uuid::Uuid> =
                match *subject_type {
                    "person" => Some(acme_uuid("person", subject_ref)),
                    "group" => Some(acme_uuid("org-group", subject_ref)),
                    _ => None,
                };
            let subject_ref_field: Option<&str> = if *subject_type == "role" {
                Some(*subject_ref)
            } else {
                None
            };
            let resource_id: Option<uuid::Uuid> = resource_slug.map(|s| acme_uuid("org-resource", s));
            let res = sqlx::query(
                r#"
                INSERT INTO org_acl
                  (id, tenant_id, subject_type, subject_id, subject_ref,
                   action, resource_type, resource_id, effect, reason)
                VALUES
                  ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (id) DO UPDATE SET
                    subject_type   = EXCLUDED.subject_type,
                    subject_id     = EXCLUDED.subject_id,
                    subject_ref    = EXCLUDED.subject_ref,
                    action         = EXCLUDED.action,
                    resource_type  = EXCLUDED.resource_type,
                    resource_id    = EXCLUDED.resource_id,
                    effect         = EXCLUDED.effect,
                    reason         = EXCLUDED.reason
                "#,
            )
            .bind(id)
            .bind(ctx.tenant_id)
            .bind(subject_type)
            .bind(subject_id)
            .bind(subject_ref_field)
            .bind(action)
            .bind(resource_type)
            .bind(resource_id)
            .bind(effect)
            .bind(reason)
            .execute(pool)
            .await;
            bump(&mut report, res, "acl");
        }

        // ── Renewals ──────────────────────────────────────────────────
        for (slug, resource_slug, kind, due_str, grace, status, notes) in RENEWALS {
            let id = acme_uuid("org-renewal", slug);
            let resource_id = acme_uuid("org-resource", resource_slug);
            let Some(due_date) = NaiveDate::parse_from_str(due_str, "%Y-%m-%d").ok() else {
                report.errors.push(format!("invalid date {due_str} for {slug}"));
                continue;
            };
            // Verify the resource exists before inserting the renewal to
            // avoid FK violations on seed re-runs targeting a subset of
            // resources.
            let exists: bool = sqlx::query_scalar(
                "SELECT EXISTS(SELECT 1 FROM org_resources WHERE id = $1)",
            )
            .bind(resource_id)
            .fetch_one(pool)
            .await
            .unwrap_or(false);
            if !exists {
                report.skipped += 1;
                continue;
            }
            let res = sqlx::query(
                r#"
                INSERT INTO org_resource_renewals
                  (id, tenant_id, resource_id, kind, due_date,
                   grace_period_days, status, renewal_notes)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (id) DO UPDATE SET
                    kind             = EXCLUDED.kind,
                    due_date         = EXCLUDED.due_date,
                    grace_period_days = EXCLUDED.grace_period_days,
                    status           = EXCLUDED.status,
                    renewal_notes    = EXCLUDED.renewal_notes,
                    updated_at       = now()
                "#,
            )
            .bind(id)
            .bind(ctx.tenant_id)
            .bind(resource_id)
            .bind(kind)
            .bind(due_date)
            .bind(grace)
            .bind(status)
            .bind(notes)
            .execute(pool)
            .await;
            bump(&mut report, res, "renewal");
        }

        // ── Multi-role assignments ────────────────────────────────────
        // Only insert if target resource exists + subject id exists, and
        // no active same (role, subject) already exists.
        let now = chrono::Utc::now();
        for (slug, resource_slug, subject_type, subject_slug, role, is_primary, reason) in
            MULTI_ASSIGNMENTS
        {
            let id = acme_uuid("org-resource-asg", slug);
            let resource_id = acme_uuid("org-resource", resource_slug);
            let subject_id = match *subject_type {
                "person" => acme_uuid("person", subject_slug),
                "node" => acme_uuid("org-node", subject_slug),
                "group" => acme_uuid("org-group", subject_slug),
                "site" => acme_uuid("org-site", subject_slug),
                _ => {
                    report.errors.push(format!("bad subject_type for {slug}"));
                    continue;
                }
            };
            let resource_exists: bool = sqlx::query_scalar(
                "SELECT EXISTS(SELECT 1 FROM org_resources WHERE id = $1)",
            )
            .bind(resource_id)
            .fetch_one(pool)
            .await
            .unwrap_or(false);
            if !resource_exists {
                report.skipped += 1;
                continue;
            }
            let subject_exists: bool = match *subject_type {
                "person" => sqlx::query_scalar(
                    "SELECT EXISTS(SELECT 1 FROM org_persons WHERE id = $1)",
                )
                .bind(subject_id)
                .fetch_one(pool)
                .await
                .unwrap_or(false),
                "node" => sqlx::query_scalar(
                    "SELECT EXISTS(SELECT 1 FROM org_nodes WHERE id = $1)",
                )
                .bind(subject_id)
                .fetch_one(pool)
                .await
                .unwrap_or(false),
                "group" => sqlx::query_scalar(
                    "SELECT EXISTS(SELECT 1 FROM org_groups WHERE id = $1)",
                )
                .bind(subject_id)
                .fetch_one(pool)
                .await
                .unwrap_or(false),
                "site" => sqlx::query_scalar(
                    "SELECT EXISTS(SELECT 1 FROM org_sites WHERE id = $1)",
                )
                .bind(subject_id)
                .fetch_one(pool)
                .await
                .unwrap_or(false),
                _ => false,
            };
            if !subject_exists {
                report.skipped += 1;
                continue;
            }

            // Skip if this deterministic id already exists (idempotent).
            let already: bool = sqlx::query_scalar(
                "SELECT EXISTS(SELECT 1 FROM org_resource_assignments WHERE id = $1)",
            )
            .bind(id)
            .fetch_one(pool)
            .await
            .unwrap_or(false);
            if already {
                report.skipped += 1;
                continue;
            }

            let start_at = now - Duration::days(30);
            let res = sqlx::query(
                r#"
                INSERT INTO org_resource_assignments
                  (id, tenant_id, resource_id, subject_type, subject_id,
                   role, is_primary, start_at, reason)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT DO NOTHING
                "#,
            )
            .bind(id)
            .bind(ctx.tenant_id)
            .bind(resource_id)
            .bind(subject_type)
            .bind(subject_id)
            .bind(role)
            .bind(is_primary)
            .bind(start_at)
            .bind(reason)
            .execute(pool)
            .await;
            bump(&mut report, res, "assignment");
        }

        Ok(report)
    }
}
