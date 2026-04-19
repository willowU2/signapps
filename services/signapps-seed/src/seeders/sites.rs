//! SO7 S1 — Sites seeder (Paris / Lyon / Madrid / Amsterdam / Remote).
//!
//! Creates a 5-building hierarchy with ~100 nodes (floors, rooms, desks,
//! open-spaces, phone booths), ~95 site-person links (primary + secondary)
//! and ~60 bookings around `now()` spanning -7d → +21d. Deterministic UUIDs
//! via [`crate::uuid::acme_uuid`] so runs are idempotent.
//!
//! Layout summary :
//! - Paris HQ        : ~50 sites (5 floors + rooftop, 20+ rooms, 8 phone booths, desks)
//! - Lyon Annex      : ~12 sites
//! - Madrid Office   : ~6  sites
//! - Amsterdam Hub   : ~10 sites
//! - Remote          : ~30 virtual desks (EU/US/APAC)

use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::uuid::acme_uuid;
use async_trait::async_trait;
use chrono::{Duration, Utc};

/// Layout of one site node.
///
/// Tuple fields :
/// 1. `slug`              — stable slug (UNIQUE with tenant_id)
/// 2. `parent_slug`       — None for a building, else the parent slug
/// 3. `kind`              — one of `building | floor | room | desk`
/// 4. `name`              — human-readable label
/// 5. `address`           — building-level only
/// 6. `gps`               — building-level only (`{"lat":..,"lng":..}`)
/// 7. `capacity`          — `None` for floors, `Some(n)` otherwise
/// 8. `bookable`          — `true` for bookable rooms / phone booths / desks
/// 9. `equipment_json`    — JSON-encoded equipment (videoconf, whiteboard…)
/// 10. `timezone`         — override (defaults to `Europe/Paris` when `None`)
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
    Option<&'static str>,
);

const EMPTY: &str = r#"{}"#;
const SCREEN: &str = r#"{"screen":true}"#;
const POLY_WB: &str = r#"{"videoconf":"Poly Studio","whiteboard":1}"#;
const POLY_SCREEN: &str = r#"{"videoconf":"Poly G7500","screen":true,"whiteboard":1}"#;
const VC_RALLY: &str = r#"{"videoconf":"Logitech Rally"}"#;
const VC_MEETUP: &str = r#"{"videoconf":"Logitech MeetUp"}"#;
const VC_POLY_CLIENT: &str = r#"{"videoconf":"Poly X70","screen":true}"#;
const VC_ENTERPRISE: &str = r#"{"videoconf":"Neat Bar Pro","screen":true,"whiteboard":1}"#;
const AI_LAB: &str = r#"{"gpu":"RTX A6000 x4","whiteboard":2,"screen":true}"#;
const ROOFTOP: &str = r#"{"outdoor":true,"sound":true}"#;
const CAFETERIA: &str = r#"{"coffee":true,"microwave":true}"#;
const VIRTUAL: &str = r#"{"virtual":true}"#;

/// Canonical SO7 site layout (~100 nodes).
#[allow(clippy::too_many_lines)]
const SITES: &[SiteSpec] = &[
    // ─── Paris HQ ──────────────────────────────────────────────────────
    (
        "paris-hq",
        None,
        "building",
        "Paris HQ",
        Some("18 rue de la Paix, 75002 Paris"),
        Some(r#"{"lat":48.869,"lng":2.331}"#),
        None,
        false,
        EMPTY,
        None,
    ),
    // Paris — RdC
    ("paris-hq-rdc", Some("paris-hq"), "floor", "Rez-de-chaussée", None, None, None, false, EMPTY, None),
    ("paris-accueil", Some("paris-hq-rdc"), "room", "Accueil", None, None, Some(5), false, EMPTY, None),
    ("paris-auditorium", Some("paris-hq-rdc"), "room", "Auditorium", None, None, Some(80), true, VC_ENTERPRISE, None),
    ("paris-phoenix", Some("paris-hq-rdc"), "room", "Salle Phoenix", None, None, Some(10), true, POLY_SCREEN, None),
    ("paris-cafeteria", Some("paris-hq-rdc"), "room", "Cafétéria", None, None, Some(40), false, CAFETERIA, None),
    ("paris-terrasse-jardin", Some("paris-hq-rdc"), "room", "Terrasse jardin", None, None, Some(30), false, ROOFTOP, None),
    // Paris — 1er étage (Engineering)
    ("paris-hq-1", Some("paris-hq"), "floor", "1er étage — Engineering", None, None, None, false, EMPTY, None),
    ("paris-openspace-platform", Some("paris-hq-1"), "room", "Open-space Platform", None, None, Some(20), false, SCREEN, None),
    ("paris-openspace-frontend", Some("paris-hq-1"), "room", "Open-space Frontend", None, None, Some(20), false, SCREEN, None),
    ("paris-openspace-ai", Some("paris-hq-1"), "room", "Open-space AI", None, None, Some(20), false, SCREEN, None),
    ("paris-alpha", Some("paris-hq-1"), "room", "Salle Alpha", None, None, Some(6), true, POLY_WB, None),
    ("paris-beta", Some("paris-hq-1"), "room", "Salle Beta", None, None, Some(8), true, VC_RALLY, None),
    ("paris-gamma", Some("paris-hq-1"), "room", "Salle Gamma", None, None, Some(6), true, POLY_WB, None),
    ("paris-booth-1-1", Some("paris-hq-1"), "room", "Phone booth 1-1", None, None, Some(1), true, EMPTY, None),
    ("paris-booth-1-2", Some("paris-hq-1"), "room", "Phone booth 1-2", None, None, Some(1), true, EMPTY, None),
    ("paris-booth-1-3", Some("paris-hq-1"), "room", "Phone booth 1-3", None, None, Some(1), true, EMPTY, None),
    ("paris-booth-1-4", Some("paris-hq-1"), "room", "Phone booth 1-4", None, None, Some(1), true, EMPTY, None),
    // Paris — 2e étage (Sales + Marketing)
    ("paris-hq-2", Some("paris-hq"), "floor", "2e étage — Sales & Marketing", None, None, None, false, EMPTY, None),
    ("paris-openspace-sales-emea", Some("paris-hq-2"), "room", "Open-space Sales EMEA", None, None, Some(15), false, SCREEN, None),
    ("paris-openspace-marketing", Some("paris-hq-2"), "room", "Open-space Marketing", None, None, Some(10), false, SCREEN, None),
    ("paris-arc-de-triomphe", Some("paris-hq-2"), "room", "Salle Arc de Triomphe", None, None, Some(12), true, VC_POLY_CLIENT, None),
    ("paris-delta", Some("paris-hq-2"), "room", "Salle Delta", None, None, Some(6), true, VC_RALLY, None),
    ("paris-epsilon", Some("paris-hq-2"), "room", "Salle Epsilon", None, None, Some(8), true, POLY_WB, None),
    ("paris-booth-2-1", Some("paris-hq-2"), "room", "Phone booth 2-1", None, None, Some(1), true, EMPTY, None),
    ("paris-booth-2-2", Some("paris-hq-2"), "room", "Phone booth 2-2", None, None, Some(1), true, EMPTY, None),
    ("paris-booth-2-3", Some("paris-hq-2"), "room", "Phone booth 2-3", None, None, Some(1), true, EMPTY, None),
    ("paris-booth-2-4", Some("paris-hq-2"), "room", "Phone booth 2-4", None, None, Some(1), true, EMPTY, None),
    // Paris — 3e étage (Direction + HR)
    ("paris-hq-3", Some("paris-hq"), "floor", "3e étage — Direction & HR", None, None, None, false, EMPTY, None),
    ("paris-bureau-marie", Some("paris-hq-3"), "room", "Bureau CEO Marie", None, None, Some(2), false, EMPTY, None),
    ("paris-bureau-paul", Some("paris-hq-3"), "room", "Bureau CFO Paul", None, None, Some(2), false, EMPTY, None),
    ("paris-bureau-jean", Some("paris-hq-3"), "room", "Bureau CTO Jean", None, None, Some(2), false, EMPTY, None),
    ("paris-bureau-claire", Some("paris-hq-3"), "room", "Bureau CHRO Claire", None, None, Some(2), false, EMPTY, None),
    ("paris-bureau-agnes", Some("paris-hq-3"), "room", "Bureau COO Agnès", None, None, Some(2), false, EMPTY, None),
    ("paris-bureau-victor", Some("paris-hq-3"), "room", "Bureau CMO Victor", None, None, Some(2), false, EMPTY, None),
    ("paris-board", Some("paris-hq-3"), "room", "Salle Board", None, None, Some(15), true, VC_ENTERPRISE, None),
    ("paris-hr-room", Some("paris-hq-3"), "room", "Salle HR", None, None, Some(6), true, VC_RALLY, None),
    // Paris — 4e étage (Finance + Operations)
    ("paris-hq-4", Some("paris-hq"), "floor", "4e étage — Finance & Operations", None, None, None, false, EMPTY, None),
    ("paris-openspace-finance", Some("paris-hq-4"), "room", "Open-space Finance", None, None, Some(8), false, SCREEN, None),
    ("paris-openspace-operations", Some("paris-hq-4"), "room", "Open-space Operations", None, None, Some(14), false, SCREEN, None),
    ("paris-finance-room", Some("paris-hq-4"), "room", "Salle Finance", None, None, Some(6), true, POLY_WB, None),
    ("paris-ops-room", Some("paris-hq-4"), "room", "Salle Ops", None, None, Some(8), true, POLY_WB, None),
    // Paris — Rooftop
    ("paris-rooftop", Some("paris-hq"), "floor", "Rooftop", None, None, None, false, EMPTY, None),
    ("paris-rooftop-event", Some("paris-rooftop"), "room", "Terrasse événementielle", None, None, Some(25), true, ROOFTOP, None),
    // Paris — attributed desks on 3rd floor (offices are desks of the 3F).
    ("paris-desk-marie", Some("paris-hq-3"), "desk", "Desk Marie (CEO)", None, None, Some(1), false, EMPTY, None),
    ("paris-desk-paul", Some("paris-hq-3"), "desk", "Desk Paul (CFO)", None, None, Some(1), false, EMPTY, None),
    ("paris-desk-jean", Some("paris-hq-3"), "desk", "Desk Jean (CTO)", None, None, Some(1), false, EMPTY, None),
    ("paris-desk-claire", Some("paris-hq-3"), "desk", "Desk Claire (CHRO)", None, None, Some(1), false, EMPTY, None),
    ("paris-desk-agnes", Some("paris-hq-3"), "desk", "Desk Agnès (COO)", None, None, Some(1), false, EMPTY, None),
    ("paris-desk-victor", Some("paris-hq-3"), "desk", "Desk Victor (CMO)", None, None, Some(1), false, EMPTY, None),
    // Paris — legacy flex desks on 2nd floor (kept for continuity).
    ("paris-desk-2-1", Some("paris-hq-2"), "desk", "Desk 2-1", None, None, Some(1), false, EMPTY, None),
    ("paris-desk-2-2", Some("paris-hq-2"), "desk", "Desk 2-2", None, None, Some(1), true, EMPTY, None),
    ("paris-desk-2-3", Some("paris-hq-2"), "desk", "Desk 2-3", None, None, Some(1), true, EMPTY, None),
    ("paris-desk-2-4", Some("paris-hq-2"), "desk", "Desk 2-4", None, None, Some(1), true, EMPTY, None),
    ("paris-desk-2-5", Some("paris-hq-2"), "desk", "Desk 2-5", None, None, Some(1), true, EMPTY, None),
    ("paris-desk-2-6", Some("paris-hq-2"), "desk", "Desk 2-6", None, None, Some(1), true, EMPTY, None),
    ("paris-desk-2-7", Some("paris-hq-2"), "desk", "Desk 2-7", None, None, Some(1), true, EMPTY, None),
    ("paris-desk-2-8", Some("paris-hq-2"), "desk", "Desk 2-8", None, None, Some(1), true, EMPTY, None),
    // Paris — legacy "Open space Engineering" room preserved (alias to avoid breaking fixtures).
    ("paris-openspace-eng", Some("paris-hq-1"), "room", "Open space Engineering (alias)", None, None, Some(30), false, SCREEN, None),
    // ─── Lyon Annex ───────────────────────────────────────────────────
    (
        "lyon-annex",
        None,
        "building",
        "Lyon Annex",
        Some("5 place Bellecour, 69002 Lyon"),
        Some(r#"{"lat":45.764,"lng":4.8357}"#),
        None,
        false,
        EMPTY,
        None,
    ),
    ("lyon-annex-rdc", Some("lyon-annex"), "floor", "Rez-de-chaussée", None, None, None, false, EMPTY, None),
    ("lyon-accueil", Some("lyon-annex-rdc"), "room", "Accueil", None, None, Some(3), false, EMPTY, None),
    ("lyon-salle", Some("lyon-annex-rdc"), "room", "Salle Lyon", None, None, Some(10), true, VC_RALLY, None),
    ("lyon-openspace-sales", Some("lyon-annex-rdc"), "room", "Open-space Sales EMEA Lyon", None, None, Some(10), false, SCREEN, None),
    ("lyon-cafeteria", Some("lyon-annex-rdc"), "room", "Cafétéria Lyon", None, None, Some(15), false, CAFETERIA, None),
    ("lyon-annex-1", Some("lyon-annex"), "floor", "1er étage", None, None, None, false, EMPTY, None),
    ("lyon-openspace-dev", Some("lyon-annex-1"), "room", "Open-space Dev & Support", None, None, Some(12), false, SCREEN, None),
    ("lyon-rhone", Some("lyon-annex-1"), "room", "Salle Rhône", None, None, Some(8), true, VC_MEETUP, None),
    ("lyon-booth-1-1", Some("lyon-annex-1"), "room", "Phone booth Lyon 1-1", None, None, Some(1), true, EMPTY, None),
    ("lyon-booth-1-2", Some("lyon-annex-1"), "room", "Phone booth Lyon 1-2", None, None, Some(1), true, EMPTY, None),
    // ─── Madrid Office ────────────────────────────────────────────────
    (
        "madrid-office",
        None,
        "building",
        "Madrid Office",
        Some("Calle de Alcalá 45, 28014 Madrid"),
        Some(r#"{"lat":40.4168,"lng":-3.7038}"#),
        None,
        false,
        EMPTY,
        Some("Europe/Madrid"),
    ),
    ("madrid-rdc", Some("madrid-office"), "floor", "Rez-de-chaussée", None, None, None, false, EMPTY, None),
    ("madrid-openspace-sales", Some("madrid-rdc"), "room", "Open-space Sales Americas Madrid", None, None, Some(12), false, SCREEN, None),
    ("madrid-salle", Some("madrid-rdc"), "room", "Salle Madrid", None, None, Some(8), true, VC_POLY_CLIENT, None),
    ("madrid-booth-m-1", Some("madrid-rdc"), "room", "Phone booth Madrid M-1", None, None, Some(1), true, EMPTY, None),
    ("madrid-booth-m-2", Some("madrid-rdc"), "room", "Phone booth Madrid M-2", None, None, Some(1), true, EMPTY, None),
    // ─── Amsterdam Tech Hub ───────────────────────────────────────────
    (
        "amsterdam-hub",
        None,
        "building",
        "Amsterdam Tech Hub",
        Some("Herengracht 502, 1017CB Amsterdam"),
        Some(r#"{"lat":52.3676,"lng":4.9041}"#),
        None,
        false,
        EMPTY,
        Some("Europe/Amsterdam"),
    ),
    ("amsterdam-rdc", Some("amsterdam-hub"), "floor", "Rez-de-chaussée", None, None, None, false, EMPTY, None),
    ("amsterdam-openspace-eng", Some("amsterdam-rdc"), "room", "Open-space Engineering Ams", None, None, Some(15), false, SCREEN, None),
    ("amsterdam-ai-lab", Some("amsterdam-rdc"), "room", "Lab AI", None, None, Some(5), true, AI_LAB, None),
    ("amsterdam-salle", Some("amsterdam-rdc"), "room", "Salle Amsterdam", None, None, Some(10), true, VC_POLY_CLIENT, None),
    ("amsterdam-booth-a-1", Some("amsterdam-rdc"), "room", "Phone booth A-1", None, None, Some(1), true, EMPTY, None),
    ("amsterdam-booth-a-2", Some("amsterdam-rdc"), "room", "Phone booth A-2", None, None, Some(1), true, EMPTY, None),
    ("amsterdam-booth-a-3", Some("amsterdam-rdc"), "room", "Phone booth A-3", None, None, Some(1), true, EMPTY, None),
    // ─── Remote (virtual) ─────────────────────────────────────────────
    (
        "remote",
        None,
        "building",
        "Remote",
        None,
        None,
        None,
        false,
        VIRTUAL,
        Some("UTC"),
    ),
    // Remote EU
    ("remote-eu", Some("remote"), "floor", "Remote EU", None, None, None, false, VIRTUAL, Some("UTC")),
    ("remote-eu-1", Some("remote-eu"), "desk", "Desk remote-eu-1", None, None, Some(1), false, VIRTUAL, Some("UTC")),
    ("remote-eu-2", Some("remote-eu"), "desk", "Desk remote-eu-2", None, None, Some(1), false, VIRTUAL, Some("UTC")),
    ("remote-eu-3", Some("remote-eu"), "desk", "Desk remote-eu-3", None, None, Some(1), false, VIRTUAL, Some("UTC")),
    ("remote-eu-4", Some("remote-eu"), "desk", "Desk remote-eu-4", None, None, Some(1), false, VIRTUAL, Some("UTC")),
    ("remote-eu-5", Some("remote-eu"), "desk", "Desk remote-eu-5", None, None, Some(1), false, VIRTUAL, Some("UTC")),
    ("remote-eu-6", Some("remote-eu"), "desk", "Desk remote-eu-6", None, None, Some(1), false, VIRTUAL, Some("UTC")),
    ("remote-eu-7", Some("remote-eu"), "desk", "Desk remote-eu-7", None, None, Some(1), false, VIRTUAL, Some("UTC")),
    ("remote-eu-8", Some("remote-eu"), "desk", "Desk remote-eu-8", None, None, Some(1), false, VIRTUAL, Some("UTC")),
    ("remote-eu-9", Some("remote-eu"), "desk", "Desk remote-eu-9", None, None, Some(1), false, VIRTUAL, Some("UTC")),
    ("remote-eu-10", Some("remote-eu"), "desk", "Desk remote-eu-10", None, None, Some(1), false, VIRTUAL, Some("UTC")),
    ("remote-eu-11", Some("remote-eu"), "desk", "Desk remote-eu-11", None, None, Some(1), false, VIRTUAL, Some("UTC")),
    ("remote-eu-12", Some("remote-eu"), "desk", "Desk remote-eu-12", None, None, Some(1), false, VIRTUAL, Some("UTC")),
    ("remote-eu-13", Some("remote-eu"), "desk", "Desk remote-eu-13", None, None, Some(1), false, VIRTUAL, Some("UTC")),
    ("remote-eu-14", Some("remote-eu"), "desk", "Desk remote-eu-14", None, None, Some(1), false, VIRTUAL, Some("UTC")),
    ("remote-eu-15", Some("remote-eu"), "desk", "Desk remote-eu-15", None, None, Some(1), false, VIRTUAL, Some("UTC")),
    // Remote US
    ("remote-us", Some("remote"), "floor", "Remote US", None, None, None, false, VIRTUAL, Some("UTC")),
    ("remote-us-1", Some("remote-us"), "desk", "Desk remote-us-1", None, None, Some(1), false, VIRTUAL, Some("UTC")),
    ("remote-us-2", Some("remote-us"), "desk", "Desk remote-us-2", None, None, Some(1), false, VIRTUAL, Some("UTC")),
    ("remote-us-3", Some("remote-us"), "desk", "Desk remote-us-3", None, None, Some(1), false, VIRTUAL, Some("UTC")),
    ("remote-us-4", Some("remote-us"), "desk", "Desk remote-us-4", None, None, Some(1), false, VIRTUAL, Some("UTC")),
    ("remote-us-5", Some("remote-us"), "desk", "Desk remote-us-5", None, None, Some(1), false, VIRTUAL, Some("UTC")),
    ("remote-us-6", Some("remote-us"), "desk", "Desk remote-us-6", None, None, Some(1), false, VIRTUAL, Some("UTC")),
    ("remote-us-7", Some("remote-us"), "desk", "Desk remote-us-7", None, None, Some(1), false, VIRTUAL, Some("UTC")),
    ("remote-us-8", Some("remote-us"), "desk", "Desk remote-us-8", None, None, Some(1), false, VIRTUAL, Some("UTC")),
    ("remote-us-9", Some("remote-us"), "desk", "Desk remote-us-9", None, None, Some(1), false, VIRTUAL, Some("UTC")),
    ("remote-us-10", Some("remote-us"), "desk", "Desk remote-us-10", None, None, Some(1), false, VIRTUAL, Some("UTC")),
    // Remote APAC
    ("remote-apac", Some("remote"), "floor", "Remote APAC", None, None, None, false, VIRTUAL, Some("UTC")),
    ("remote-apac-1", Some("remote-apac"), "desk", "Desk remote-apac-1", None, None, Some(1), false, VIRTUAL, Some("UTC")),
    ("remote-apac-2", Some("remote-apac"), "desk", "Desk remote-apac-2", None, None, Some(1), false, VIRTUAL, Some("UTC")),
    ("remote-apac-3", Some("remote-apac"), "desk", "Desk remote-apac-3", None, None, Some(1), false, VIRTUAL, Some("UTC")),
    ("remote-apac-4", Some("remote-apac"), "desk", "Desk remote-apac-4", None, None, Some(1), false, VIRTUAL, Some("UTC")),
    ("remote-apac-5", Some("remote-apac"), "desk", "Desk remote-apac-5", None, None, Some(1), false, VIRTUAL, Some("UTC")),
    // Remote — legacy alias preserved for older fixtures.
    ("remote-home", Some("remote"), "floor", "Home", None, None, None, false, VIRTUAL, Some("UTC")),
    ("remote-desk", Some("remote-home"), "desk", "Desk remote (legacy)", None, None, Some(1), false, VIRTUAL, Some("UTC")),
];

/// (person_slug, site_slug, desk_slug_opt) — primary assignment.
///
/// When `desk_slug_opt` is `Some`, the link also fills `desk_id` so the
/// person has an attributed desk inside the room/floor.
type PrimaryLink = (&'static str, &'static str, Option<&'static str>);

const PRIMARY_LINKS: &[PrimaryLink] = &[
    // ─── Direction (6) — 3F Paris avec desk attribué ─────────────
    ("marie.dupont", "paris-bureau-marie", Some("paris-desk-marie")),
    ("paul.durand", "paris-bureau-paul", Some("paris-desk-paul")),
    ("jean.martin", "paris-bureau-jean", Some("paris-desk-jean")),
    ("claire.moreau", "paris-bureau-claire", Some("paris-desk-claire")),
    ("agnes.perrin", "paris-bureau-agnes", Some("paris-desk-agnes")),
    ("victor.leblanc", "paris-bureau-victor", Some("paris-desk-victor")),
    // ─── Engineering Platform (6) — Open-space Platform Paris ─────
    ("sophie.leroy", "paris-openspace-platform", None),
    ("thomas.petit", "paris-openspace-platform", None),
    ("julie.bernard", "paris-openspace-platform", None),
    ("marc.fontaine", "paris-openspace-platform", None),
    ("leo.garnier", "paris-openspace-platform", None),
    ("olivia.faure", "paris-openspace-platform", None),
    // ─── Engineering Frontend (7) — Open-space Frontend Paris ─────
    ("emma.rousseau", "paris-openspace-frontend", None),
    ("lucas.fournier", "paris-openspace-frontend", None),
    ("chloe.henry", "paris-openspace-frontend", None),
    ("axel.morin", "paris-openspace-frontend", None),
    ("lina.carpentier", "paris-openspace-frontend", None),
    ("hugo.dumont", "paris-openspace-frontend", None),
    ("alice.roche", "paris-openspace-frontend", None),
    // ─── Engineering AI (7) — split Amsterdam (4) + Paris AI (3) ───
    ("raphael.benoit", "amsterdam-openspace-eng", None),
    ("zoe.marchand", "amsterdam-openspace-eng", None),
    ("sacha.riviere", "amsterdam-openspace-eng", None),
    ("noah.simon", "amsterdam-openspace-eng", None),
    ("ines.bourdon", "paris-openspace-ai", None),
    ("lea.perez", "paris-openspace-ai", None),
    ("adam.bertrand", "paris-openspace-ai", None),
    // ─── Sales EMEA (6) — 4 Paris + 2 Lyon ────────────────────────
    ("nicolas.robert", "paris-openspace-sales-emea", None),
    ("anne.girard", "paris-openspace-sales-emea", None),
    ("pierre.lefebvre", "paris-openspace-sales-emea", None),
    ("camille.mercier", "paris-openspace-sales-emea", None),
    ("theo.brunet", "lyon-openspace-sales", None),
    ("sarah.lopez", "lyon-openspace-sales", None),
    // ─── Sales Americas (6) — 3 Madrid + 2 Remote US + 1 NYC via Remote US
    ("michael.thompson", "madrid-openspace-sales", None),
    ("jessica.nguyen", "madrid-openspace-sales", None),
    ("david.clark", "madrid-openspace-sales", None),
    ("amanda.white", "remote-us", Some("remote-us-1")),
    ("ryan.patel", "remote-us", Some("remote-us-2")),
    ("olivia.garcia", "remote-us", Some("remote-us-3")),
    // ─── Marketing (8) — Open-space marketing Paris ───────────────
    ("elise.vincent", "paris-openspace-marketing", None),
    ("mathis.muller", "paris-openspace-marketing", None),
    ("nora.baron", "paris-openspace-marketing", None),
    ("jules.duval", "paris-openspace-marketing", None),
    ("ambre.boyer", "paris-openspace-marketing", None),
    ("gabriel.lemoine", "paris-openspace-marketing", None),
    ("rose.charrier", "paris-openspace-marketing", None),
    ("elliot.olivier", "paris-openspace-marketing", None),
    // ─── Support (10) — 3 Paris + 4 Lyon + 3 Remote EU ────────────
    ("antoine.bonnet", "paris-openspace-operations", None),
    ("isabelle.noel", "paris-openspace-operations", None),
    ("maxime.rey", "paris-openspace-operations", None),
    ("lucie.sanchez", "lyon-openspace-dev", None),
    ("baptiste.leroux", "lyon-openspace-dev", None),
    ("maya.prevost", "lyon-openspace-dev", None),
    ("clement.faure", "lyon-openspace-dev", None),
    ("alba.renaud", "remote-eu", Some("remote-eu-1")),
    ("noa.barre", "remote-eu", Some("remote-eu-2")),
    ("naomi.gros", "remote-eu", Some("remote-eu-3")),
    // ─── Finance (6) — open-space finance Paris ──────────────────
    ("benjamin.blanc", "paris-openspace-finance", None),
    ("aline.gautier", "paris-openspace-finance", None),
    ("hector.boulanger", "paris-openspace-finance", None),
    ("vera.blanchard", "paris-openspace-finance", None),
    ("louis.michel", "paris-openspace-finance", None),
    ("jade.caron", "paris-openspace-finance", None),
    // ─── HR (5) — 3F Paris (bureau Claire) ────────────────────────
    ("mia.lecomte", "paris-hr-room", None),
    ("theodore.fabre", "paris-hr-room", None),
    ("eva.noel", "paris-hr-room", None),
    ("malo.picard", "paris-hr-room", None),
    ("alma.vidal", "paris-hr-room", None),
    // ─── Operations (14) — Paris operations + 2 Remote APAC ────────
    ("boris.lambert", "paris-openspace-operations", None),
    ("celine.pasquier", "paris-openspace-operations", None),
    ("dorian.gauthier", "paris-openspace-operations", None),
    ("elena.barthelemy", "paris-openspace-operations", None),
    ("florian.adam", "paris-openspace-operations", None),
    ("gemma.nicolas", "paris-openspace-operations", None),
    ("hadrien.morel", "paris-openspace-operations", None),
    ("iris.delmas", "paris-openspace-operations", None),
    ("joachim.poirier", "paris-openspace-operations", None),
    ("karina.teixeira", "paris-openspace-operations", None),
    ("louane.renard", "paris-openspace-operations", None),
    ("manu.brun", "paris-openspace-operations", None),
    ("nina.jacquet", "remote-apac", Some("remote-apac-1")),
    ("otto.costa", "remote-apac", Some("remote-apac-2")),
];

/// Secondary (multi-site) links.
const SECONDARY_LINKS: &[(&str, &str)] = &[
    // CEO / CTO travel between Paris and Lyon/Amsterdam regularly.
    ("marie.dupont", "lyon-salle"),
    ("marie.dupont", "amsterdam-salle"),
    ("jean.martin", "amsterdam-openspace-eng"),
    ("jean.martin", "lyon-annex-rdc"),
    ("agnes.perrin", "lyon-annex-rdc"),
    // VP Sales EMEA covers Paris, Lyon and Madrid.
    ("nicolas.robert", "lyon-openspace-sales"),
    ("nicolas.robert", "madrid-openspace-sales"),
    // VP Sales Americas also covers remote US + Madrid.
    ("michael.thompson", "paris-openspace-sales-emea"),
    ("michael.thompson", "remote-us"),
    // Platform Lead spends 1 day / week in Amsterdam with AI team.
    ("sophie.leroy", "amsterdam-openspace-eng"),
    // AI Lead anchors Amsterdam + Paris AI.
    ("raphael.benoit", "paris-openspace-ai"),
    // Marketing director regularly in Lyon.
    ("elise.vincent", "lyon-openspace-dev"),
    // Support Director covers Lyon.
    ("antoine.bonnet", "lyon-openspace-dev"),
    // COO Deputy travels Lyon/Amsterdam.
    ("boris.lambert", "amsterdam-salle"),
];

/// Bookings — realistic enterprise pattern spanning -7d → +21d.
///
/// Tuple : `(owner_person, site_slug, days_offset, start_hour, duration_min, purpose, status)`.
///
/// `days_offset` is signed relative to today: negative = past, positive = future.
type BookingSpec = (&'static str, &'static str, i64, i64, i64, &'static str, &'static str);

#[allow(clippy::too_many_lines)]
const BOOKINGS: &[BookingSpec] = &[
    // ─── All-hands mensuel (Auditorium Paris) — recurrent lundi 9h30-10h30.
    ("marie.dupont", "paris-auditorium", -7, 9, 60, "All-hands hebdo", "confirmed"),
    ("marie.dupont", "paris-auditorium", 0, 9, 60, "All-hands hebdo", "confirmed"),
    ("marie.dupont", "paris-auditorium", 7, 9, 60, "All-hands hebdo", "confirmed"),
    ("marie.dupont", "paris-auditorium", 14, 9, 60, "All-hands hebdo", "confirmed"),
    // ─── Comité direction / Board (Salle Board) — mardi 14h-16h.
    ("marie.dupont", "paris-board", -6, 14, 120, "Comité direction", "confirmed"),
    ("marie.dupont", "paris-board", 1, 14, 120, "Comité direction", "confirmed"),
    ("marie.dupont", "paris-board", 8, 14, 120, "Comité direction", "confirmed"),
    ("paul.durand", "paris-board", 15, 14, 180, "Conseil d'administration mensuel", "confirmed"),
    // ─── Sprint planning Engineering (Alpha) — vendredi 10h-12h.
    ("sophie.leroy", "paris-alpha", -4, 10, 120, "Sprint planning Platform", "confirmed"),
    ("sophie.leroy", "paris-alpha", 3, 10, 120, "Sprint planning Platform", "confirmed"),
    ("sophie.leroy", "paris-alpha", 10, 10, 120, "Sprint planning Platform", "confirmed"),
    ("emma.rousseau", "paris-beta", -4, 10, 120, "Sprint planning Frontend", "confirmed"),
    ("emma.rousseau", "paris-beta", 3, 10, 120, "Sprint planning Frontend", "confirmed"),
    ("emma.rousseau", "paris-beta", 10, 10, 120, "Sprint planning Frontend", "confirmed"),
    // ─── Démos produit (Phoenix) — jeudi 15h-17h.
    ("jean.martin", "paris-phoenix", -3, 15, 120, "Démo produit clients", "confirmed"),
    ("jean.martin", "paris-phoenix", 4, 15, 120, "Démo produit clients", "confirmed"),
    ("jean.martin", "paris-phoenix", 11, 15, 120, "Démo produit clients", "confirmed"),
    // ─── 1-on-1 — phone booths courts (30 min).
    ("claire.moreau", "paris-booth-1-1", 1, 11, 30, "1-on-1 Claire & Mia", "confirmed"),
    ("claire.moreau", "paris-booth-1-2", 2, 14, 30, "1-on-1 Claire & Théodore", "confirmed"),
    ("jean.martin", "paris-booth-1-3", 2, 15, 30, "1-on-1 Jean & Sophie", "confirmed"),
    ("jean.martin", "paris-booth-1-4", 3, 16, 30, "1-on-1 Jean & Raphaël", "confirmed"),
    ("nicolas.robert", "paris-booth-2-1", 1, 10, 30, "1-on-1 Nicolas & Anne", "confirmed"),
    ("nicolas.robert", "paris-booth-2-2", 1, 11, 30, "1-on-1 Nicolas & Pierre", "confirmed"),
    ("elise.vincent", "paris-booth-2-3", 2, 9, 30, "1-on-1 Elise & Nora", "confirmed"),
    ("elise.vincent", "paris-booth-2-4", 2, 14, 30, "1-on-1 Elise & Gabriel", "confirmed"),
    // ─── Interviews candidats (Salle Gamma) — créneaux 1h sur 3 jours.
    ("theodore.fabre", "paris-gamma", 5, 10, 60, "Interview Backend senior", "confirmed"),
    ("theodore.fabre", "paris-gamma", 5, 14, 60, "Interview Backend senior", "confirmed"),
    ("theodore.fabre", "paris-gamma", 6, 10, 60, "Interview Frontend", "confirmed"),
    ("theodore.fabre", "paris-gamma", 7, 14, 60, "Interview Data Scientist", "confirmed"),
    // ─── Formations (Salle Delta).
    ("malo.picard", "paris-delta", 12, 9, 480, "Formation sécurité OWASP", "confirmed"),
    ("malo.picard", "paris-delta", 19, 9, 480, "Formation Design System", "confirmed"),
    // ─── Réunions client (Arc de Triomphe) — 3-4 bookings.
    ("nicolas.robert", "paris-arc-de-triomphe", 1, 15, 90, "Client XYZ — revue trimestrielle", "confirmed"),
    ("nicolas.robert", "paris-arc-de-triomphe", 4, 10, 60, "Client Banque Privée — démo", "confirmed"),
    ("nicolas.robert", "paris-arc-de-triomphe", 8, 14, 120, "Client Assurance — kick-off", "confirmed"),
    ("pierre.lefebvre", "paris-arc-de-triomphe", 15, 10, 90, "Client retail — négociation", "tentative"),
    // ─── Tech meetups (Auditorium) — soirée 18h-20h.
    ("sophie.leroy", "paris-auditorium", 13, 18, 120, "Rust meetup externe", "confirmed"),
    ("raphael.benoit", "paris-auditorium", 20, 18, 120, "AI / LLM meetup externe", "tentative"),
    // ─── Salle Amsterdam (5-8).
    ("raphael.benoit", "amsterdam-salle", -5, 10, 90, "AI design review", "confirmed"),
    ("raphael.benoit", "amsterdam-salle", 2, 10, 90, "AI design review", "confirmed"),
    ("raphael.benoit", "amsterdam-salle", 9, 10, 90, "AI design review", "confirmed"),
    ("sophie.leroy", "amsterdam-salle", 3, 14, 60, "Platform + AI sync", "confirmed"),
    ("jean.martin", "amsterdam-salle", 8, 10, 120, "Strategic tech review", "confirmed"),
    ("zoe.marchand", "amsterdam-ai-lab", 1, 9, 240, "Expérimentation modèle", "confirmed"),
    ("zoe.marchand", "amsterdam-ai-lab", 8, 9, 240, "Expérimentation modèle", "confirmed"),
    ("noah.simon", "amsterdam-ai-lab", 15, 9, 180, "Benchmark GPU", "confirmed"),
    // ─── Salle Madrid (5-8).
    ("michael.thompson", "madrid-salle", -3, 14, 60, "Revue pipeline Americas", "confirmed"),
    ("michael.thompson", "madrid-salle", 4, 14, 60, "Revue pipeline Americas", "confirmed"),
    ("michael.thompson", "madrid-salle", 11, 14, 60, "Revue pipeline Americas", "confirmed"),
    ("jessica.nguyen", "madrid-salle", 2, 10, 90, "Client Iberia — démo", "confirmed"),
    ("jessica.nguyen", "madrid-salle", 9, 10, 90, "Client LatAm — revue", "confirmed"),
    ("david.clark", "madrid-salle", 16, 15, 60, "Call client Brésil", "tentative"),
    // ─── Salle Lyon (5-8).
    ("theo.brunet", "lyon-salle", -2, 10, 60, "Démo client Rhône-Alpes", "confirmed"),
    ("theo.brunet", "lyon-salle", 5, 10, 60, "Démo client Rhône-Alpes", "confirmed"),
    ("sarah.lopez", "lyon-salle", 2, 14, 90, "Pitch prospect Espagne", "confirmed"),
    ("sarah.lopez", "lyon-salle", 9, 14, 90, "Pitch prospect Mexique", "confirmed"),
    ("lucie.sanchez", "lyon-rhone", 3, 10, 60, "Retro Support Lyon", "confirmed"),
    ("baptiste.leroux", "lyon-rhone", 10, 10, 60, "Retro Support Lyon", "confirmed"),
    ("elise.vincent", "lyon-openspace-dev", 17, 9, 60, "Atelier brand Lyon", "cancelled"),
    // ─── Rooftop — 1-2 events.
    ("victor.leblanc", "paris-rooftop-event", 6, 18, 180, "Afterwork marketing", "confirmed"),
    ("claire.moreau", "paris-rooftop-event", 20, 18, 180, "Célébration D&I", "tentative"),
    // ─── Rétro + postmortem (Phoenix / Alpha).
    ("julie.bernard", "paris-phoenix", -1, 9, 60, "Postmortem incident DB", "confirmed"),
    ("thomas.petit", "paris-alpha", 6, 14, 45, "Pair programming", "confirmed"),
    // ─── Cancellations additionnelles.
    ("lucas.fournier", "paris-beta", 12, 10, 60, "Design review — reporté", "cancelled"),
    ("leo.garnier", "paris-alpha", 14, 11, 60, "Architecture — reporté", "cancelled"),
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

        // ── Pass 1 — sites (parents first via SITES ordering).
        for (slug, parent_slug, kind, name, address, gps, capacity, bookable, equipment, tz) in SITES {
            let id = acme_uuid("org-site", slug);
            let parent_id = parent_slug.map(|s| acme_uuid("org-site", s));
            let equipment_json: serde_json::Value =
                serde_json::from_str(equipment).unwrap_or_else(|_| serde_json::json!({}));
            let gps_json: Option<serde_json::Value> =
                gps.and_then(|g| serde_json::from_str(g).ok());
            let timezone = tz.unwrap_or("Europe/Paris");

            let res = sqlx::query(
                r#"INSERT INTO org_sites
                    (id, tenant_id, parent_id, slug, name, kind, address, gps,
                     timezone, capacity, equipment, bookable)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,
                           $10, $11, $12)
                   ON CONFLICT (tenant_id, slug) DO UPDATE SET
                     parent_id  = EXCLUDED.parent_id,
                     name       = EXCLUDED.name,
                     kind       = EXCLUDED.kind,
                     address    = EXCLUDED.address,
                     gps        = EXCLUDED.gps,
                     timezone   = EXCLUDED.timezone,
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
            .bind(timezone)
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

        // ── Pass 2a — primary site-person links (with optional desk_id).
        for (person_slug, site_slug, desk_slug_opt) in PRIMARY_LINKS {
            let person_id = acme_uuid("person", person_slug);
            let site_id = acme_uuid("org-site", site_slug);
            let desk_id = desk_slug_opt.map(|s| acme_uuid("org-site", s));
            let link_id = acme_uuid(
                "org-site-person",
                &format!("{person_slug}-{site_slug}-primary"),
            );

            // Clean up any stray primary rows for the person so the unique
            // partial index on (person_id) WHERE role='primary' stays valid
            // when the layout changes (e.g. a person moved buildings).
            let _ = sqlx::query(
                "DELETE FROM org_site_persons
                   WHERE person_id = $1 AND role = 'primary' AND id <> $2",
            )
            .bind(person_id)
            .bind(link_id)
            .execute(pool)
            .await;

            let res = sqlx::query(
                r#"INSERT INTO org_site_persons (id, person_id, site_id, desk_id, role)
                   VALUES ($1, $2, $3, $4, 'primary')
                   ON CONFLICT (id) DO UPDATE SET
                     site_id = EXCLUDED.site_id,
                     desk_id = EXCLUDED.desk_id"#,
            )
            .bind(link_id)
            .bind(person_id)
            .bind(site_id)
            .bind(desk_id)
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
                        .push(format!("site-person primary {person_slug}: {e}"));
                },
            }
        }

        // ── Pass 2b — secondary site-person links (multi-site travellers).
        for (person_slug, site_slug) in SECONDARY_LINKS {
            let person_id = acme_uuid("person", person_slug);
            let site_id = acme_uuid("org-site", site_slug);
            let link_id = acme_uuid(
                "org-site-person",
                &format!("{person_slug}-{site_slug}-secondary"),
            );
            let res = sqlx::query(
                r#"INSERT INTO org_site_persons (id, person_id, site_id, role)
                   VALUES ($1, $2, $3, 'secondary')
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
                        .push(format!("site-person secondary {person_slug}: {e}"));
                },
            }
        }

        // ── Pass 3 — bookings across -7d → +21d.
        let now = Utc::now();
        for (i, (person_slug, site_slug, days_offset, hour, duration_min, purpose, status)) in
            BOOKINGS.iter().enumerate()
        {
            let person_id = acme_uuid("person", person_slug);
            let site_id = acme_uuid("org-site", site_slug);
            // Include `i` in the key so multiple bookings on the same (site, person, day, hour)
            // stay unique — avoids UNIQUE collisions on idempotent replay.
            let booking_id = acme_uuid(
                "org-site-booking",
                &format!("{site_slug}-{person_slug}-{days_offset}-{hour}-{i}"),
            );
            let start_at = (now + Duration::days(*days_offset))
                .date_naive()
                .and_hms_opt(u32::try_from(*hour).unwrap_or(9), 0, 0)
                .unwrap_or_else(|| now.naive_utc())
                .and_utc();
            let end_at = start_at + Duration::minutes(*duration_min);

            let res = sqlx::query(
                r#"INSERT INTO org_site_bookings
                    (id, site_id, person_id, start_at, end_at, purpose, status)
                   VALUES ($1, $2, $3, $4, $5, $6, $7)
                   ON CONFLICT (id) DO UPDATE SET
                     start_at   = EXCLUDED.start_at,
                     end_at     = EXCLUDED.end_at,
                     purpose    = EXCLUDED.purpose,
                     status     = EXCLUDED.status,
                     updated_at = now()"#,
            )
            .bind(booking_id)
            .bind(site_id)
            .bind(person_id)
            .bind(start_at)
            .bind(end_at)
            .bind(purpose)
            .bind(status)
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
