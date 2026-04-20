//! SO8 — Resources catalog seeder.
//!
//! Two passes :
//!
//! 1. **Legacy IT migration** — copy `it.configuration_items` rows into
//!    `org_resources(kind='it_device')`, preserving the original id via
//!    `attributes.legacy_it_asset_id`. The `it.configuration_items` table
//!    is left untouched so the `signapps-it-assets` service keeps working.
//!
//! 2. **Fresh resources** — 10 véhicules, 25 clés physiques, 15 badges,
//!    8 équipements AV, 5 licences logiciels. Total ≈ 63 rows.
//!
//! Deterministic UUIDs via [`crate::uuid::acme_uuid`] — idempotent runs.

use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::uuid::acme_uuid;
use async_trait::async_trait;
use chrono::NaiveDate;

pub struct ResourcesSeeder;

/// (slug, kind, name, description, serial_or_ref_opt, person_slug_opt,
///  node_slug_opt, site_slug_opt, attributes_json, cost_cents_opt,
///  purchase_date_opt, amortization_months_opt, warranty_date_opt,
///  next_maintenance_date_opt)
#[allow(clippy::type_complexity)]
type ResSpec = (
    &'static str,
    &'static str,
    &'static str,
    Option<&'static str>,
    Option<&'static str>,
    Option<&'static str>,
    Option<&'static str>,
    Option<&'static str>,
    &'static str,
    Option<i64>,
    Option<&'static str>,
    Option<i32>,
    Option<&'static str>,
    Option<&'static str>,
);

/// 10 véhicules + 25 clés + 15 badges + 8 AV + 5 licences = 63 rows.
#[allow(clippy::too_many_lines)]
const FRESH_RESOURCES: &[ResSpec] = &[
    // ─── 10 véhicules ───────────────────────────────────────────────
    (
        "veh-tesla-y-01", "vehicle", "Tesla Model Y (Paris)",
        Some("Berline exec — attribuée CEO"),
        Some("VIN-T5Y-001"), Some("marie.dupont"), None, Some("paris-hq"),
        r#"{"plate":"AB-123-CD","brand":"Tesla","model":"Model Y","fuel_type":"electric","mileage_km":12500,"next_technical_inspection":"2027-06-15"}"#,
        Some(5_000_000), Some("2025-01-15"), Some(60), Some("2029-01-15"), Some("2026-07-15"),
    ),
    (
        "veh-tesla-3-01", "vehicle", "Tesla Model 3 (Paris)",
        Some("Berline exec — CFO"),
        Some("VIN-T3-002"), Some("paul.durand"), None, Some("paris-hq"),
        r#"{"plate":"CD-234-EF","brand":"Tesla","model":"Model 3","fuel_type":"electric","mileage_km":8500,"next_technical_inspection":"2027-09-20"}"#,
        Some(4_500_000), Some("2025-03-20"), Some(60), Some("2029-03-20"), Some("2026-09-20"),
    ),
    (
        "veh-peugeot-408-01", "vehicle", "Peugeot 408 GT (Paris)",
        Some("Berline exec — CTO"),
        Some("VIN-P408-003"), Some("jean.martin"), None, Some("paris-hq"),
        r#"{"plate":"EF-345-GH","brand":"Peugeot","model":"408 GT","fuel_type":"hybrid","mileage_km":15200,"next_technical_inspection":"2026-11-05"}"#,
        Some(4_200_000), Some("2024-11-05"), Some(60), Some("2028-11-05"), Some("2026-05-05"),
    ),
    (
        "veh-peugeot-5008-01", "vehicle", "Peugeot 5008 (Paris)",
        Some("Berline exec — COO"),
        Some("VIN-P5008-004"), Some("agnes.perrin"), None, Some("paris-hq"),
        r#"{"plate":"GH-456-IJ","brand":"Peugeot","model":"5008","fuel_type":"diesel","mileage_km":22000,"next_technical_inspection":"2026-08-10"}"#,
        Some(3_800_000), Some("2024-08-10"), Some(60), Some("2028-08-10"), Some("2026-02-10"),
    ),
    (
        "veh-renault-megane-01", "vehicle", "Renault Megane E-Tech (Paris)",
        Some("Berline exec — CMO"),
        Some("VIN-RM-005"), Some("victor.leblanc"), None, Some("paris-hq"),
        r#"{"plate":"IJ-567-KL","brand":"Renault","model":"Megane E-Tech","fuel_type":"electric","mileage_km":9800,"next_technical_inspection":"2027-04-22"}"#,
        Some(3_500_000), Some("2025-04-22"), Some(60), Some("2029-04-22"), Some("2026-10-22"),
    ),
    (
        "veh-utility-renault-kangoo-01", "vehicle", "Renault Kangoo ZE (Paris)",
        Some("Utilitaire opérations"),
        Some("VIN-RK-006"), None, Some("operations"), Some("paris-hq"),
        r#"{"plate":"KL-678-MN","brand":"Renault","model":"Kangoo ZE","fuel_type":"electric","mileage_km":32000,"next_technical_inspection":"2026-07-08"}"#,
        Some(2_800_000), Some("2023-07-08"), Some(48), Some("2027-07-08"), Some("2026-07-08"),
    ),
    (
        "veh-utility-peugeot-partner-01", "vehicle", "Peugeot Partner (Lyon)",
        Some("Utilitaire Lyon — opérations terrain"),
        Some("VIN-PP-007"), None, Some("operations"), Some("lyon-annex"),
        r#"{"plate":"MN-789-OP","brand":"Peugeot","model":"Partner","fuel_type":"diesel","mileage_km":45000,"next_technical_inspection":"2026-06-14"}"#,
        Some(2_500_000), Some("2022-06-14"), Some(48), Some("2026-06-14"), Some("2026-06-14"),
    ),
    (
        "veh-utility-citroen-jumpy-01", "vehicle", "Citroën Jumpy (Amsterdam)",
        Some("Utilitaire Amsterdam — logistique"),
        Some("VIN-CJ-008"), None, Some("operations"), Some("amsterdam-hub"),
        r#"{"plate":"NL-123-AB","brand":"Citroën","model":"Jumpy","fuel_type":"diesel","mileage_km":38000,"next_technical_inspection":"2026-10-12"}"#,
        Some(2_700_000), Some("2022-10-12"), Some(48), Some("2026-10-12"), Some("2026-04-12"),
    ),
    (
        "veh-service-renault-clio-01", "vehicle", "Renault Clio (Paris pool)",
        Some("Voiture service - pool Paris"),
        Some("VIN-RC-009"), None, Some("operations"), Some("paris-hq"),
        r#"{"plate":"OP-890-QR","brand":"Renault","model":"Clio","fuel_type":"gasoline","mileage_km":55000,"next_technical_inspection":"2026-05-05"}"#,
        Some(1_800_000), Some("2021-05-05"), Some(48), None, Some("2026-05-05"),
    ),
    (
        "veh-service-peugeot-208-01", "vehicle", "Peugeot 208 (Madrid pool)",
        Some("Voiture service - pool Madrid"),
        Some("VIN-P208-010"), None, Some("operations"), Some("madrid-office"),
        r#"{"plate":"ES-456-CD","brand":"Peugeot","model":"208","fuel_type":"gasoline","mileage_km":28000,"next_technical_inspection":"2026-12-18"}"#,
        Some(1_700_000), Some("2022-12-18"), Some(48), None, Some("2026-06-18"),
    ),
    // ─── 25 clés physiques ──────────────────────────────────────────
    // 6 bureaux direction
    (
        "key-bureau-marie", "key_physical", "Clé bureau CEO",
        Some("Clé du bureau direction Marie Dupont"),
        Some("K-CEO-01"), Some("marie.dupont"), None, Some("paris-bureau-marie"),
        r#"{"door_id":"paris-bureau-marie","copies":2,"holder":"marie.dupont"}"#,
        Some(2_000), Some("2023-01-10"), None, None, None,
    ),
    (
        "key-bureau-paul", "key_physical", "Clé bureau CFO",
        Some("Clé du bureau direction Paul Durand"),
        Some("K-CFO-02"), Some("paul.durand"), None, Some("paris-bureau-paul"),
        r#"{"door_id":"paris-bureau-paul","copies":2,"holder":"paul.durand"}"#,
        Some(2_000), Some("2023-01-10"), None, None, None,
    ),
    (
        "key-bureau-jean", "key_physical", "Clé bureau CTO",
        Some("Clé du bureau direction Jean Martin"),
        Some("K-CTO-03"), Some("jean.martin"), None, Some("paris-bureau-jean"),
        r#"{"door_id":"paris-bureau-jean","copies":2,"holder":"jean.martin"}"#,
        Some(2_000), Some("2023-01-10"), None, None, None,
    ),
    (
        "key-bureau-claire", "key_physical", "Clé bureau CHRO",
        Some("Clé du bureau direction Claire Moreau"),
        Some("K-CHRO-04"), Some("claire.moreau"), None, Some("paris-bureau-claire"),
        r#"{"door_id":"paris-bureau-claire","copies":2,"holder":"claire.moreau"}"#,
        Some(2_000), Some("2023-01-10"), None, None, None,
    ),
    (
        "key-bureau-agnes", "key_physical", "Clé bureau COO",
        Some("Clé du bureau direction Agnès Perrin"),
        Some("K-COO-05"), Some("agnes.perrin"), None, Some("paris-bureau-agnes"),
        r#"{"door_id":"paris-bureau-agnes","copies":2,"holder":"agnes.perrin"}"#,
        Some(2_000), Some("2023-01-10"), None, None, None,
    ),
    (
        "key-bureau-victor", "key_physical", "Clé bureau CMO",
        Some("Clé du bureau direction Victor Leblanc"),
        Some("K-CMO-06"), Some("victor.leblanc"), None, Some("paris-bureau-victor"),
        r#"{"door_id":"paris-bureau-victor","copies":2,"holder":"victor.leblanc"}"#,
        Some(2_000), Some("2023-01-10"), None, None, None,
    ),
    // 10 salles réunion Paris HQ
    (
        "key-phoenix", "key_physical", "Clé salle Phoenix",
        Some("Clé salle réunion Phoenix"),
        Some("K-PH-07"), None, Some("operations"), Some("paris-phoenix"),
        r#"{"door_id":"paris-phoenix","copies":5,"holder":"office-manager"}"#,
        Some(1_500), Some("2023-02-01"), None, None, None,
    ),
    (
        "key-alpha", "key_physical", "Clé salle Alpha",
        Some("Clé salle réunion Alpha"),
        Some("K-AL-08"), None, Some("operations"), Some("paris-alpha"),
        r#"{"door_id":"paris-alpha","copies":5,"holder":"office-manager"}"#,
        Some(1_500), Some("2023-02-01"), None, None, None,
    ),
    (
        "key-beta", "key_physical", "Clé salle Beta",
        Some("Clé salle réunion Beta"),
        Some("K-BE-09"), None, Some("operations"), Some("paris-beta"),
        r#"{"door_id":"paris-beta","copies":5,"holder":"office-manager"}"#,
        Some(1_500), Some("2023-02-01"), None, None, None,
    ),
    (
        "key-gamma", "key_physical", "Clé salle Gamma",
        Some("Clé salle réunion Gamma"),
        Some("K-GA-10"), None, Some("operations"), Some("paris-gamma"),
        r#"{"door_id":"paris-gamma","copies":5,"holder":"office-manager"}"#,
        Some(1_500), Some("2023-02-01"), None, None, None,
    ),
    (
        "key-delta", "key_physical", "Clé salle Delta",
        Some("Clé salle réunion Delta"),
        Some("K-DE-11"), None, Some("operations"), Some("paris-delta"),
        r#"{"door_id":"paris-delta","copies":5,"holder":"office-manager"}"#,
        Some(1_500), Some("2023-02-01"), None, None, None,
    ),
    (
        "key-epsilon", "key_physical", "Clé salle Epsilon",
        Some("Clé salle réunion Epsilon"),
        Some("K-EP-12"), None, Some("operations"), Some("paris-epsilon"),
        r#"{"door_id":"paris-epsilon","copies":5,"holder":"office-manager"}"#,
        Some(1_500), Some("2023-02-01"), None, None, None,
    ),
    (
        "key-board", "key_physical", "Clé salle Board",
        Some("Clé salle Board 3F — accès restreint"),
        Some("K-BO-13"), Some("agnes.perrin"), None, Some("paris-board"),
        r#"{"door_id":"paris-board","copies":3,"holder":"agnes.perrin"}"#,
        Some(2_500), Some("2023-02-01"), None, None, None,
    ),
    (
        "key-hr-room", "key_physical", "Clé salle HR",
        Some("Clé salle HR — accès restreint"),
        Some("K-HR-14"), Some("claire.moreau"), None, Some("paris-hr-room"),
        r#"{"door_id":"paris-hr-room","copies":3,"holder":"claire.moreau"}"#,
        Some(2_500), Some("2023-02-01"), None, None, None,
    ),
    (
        "key-finance-room", "key_physical", "Clé salle Finance",
        Some("Clé salle Finance — accès restreint"),
        Some("K-FI-15"), Some("paul.durand"), None, Some("paris-finance-room"),
        r#"{"door_id":"paris-finance-room","copies":3,"holder":"paul.durand"}"#,
        Some(2_500), Some("2023-02-01"), None, None, None,
    ),
    (
        "key-auditorium", "key_physical", "Clé auditorium",
        Some("Clé auditorium — accès facilities"),
        Some("K-AU-16"), None, Some("operations"), Some("paris-auditorium"),
        r#"{"door_id":"paris-auditorium","copies":4,"holder":"facilities-lead"}"#,
        Some(3_000), Some("2023-02-01"), None, None, None,
    ),
    // 4 coffres
    (
        "key-coffre-finance", "key_physical", "Clé coffre Finance",
        Some("Clé coffre finance — CFO + deputy"),
        Some("K-CF-17"), Some("paul.durand"), None, Some("paris-finance-room"),
        r#"{"door_id":"coffre-finance-01","copies":2,"holder":"paul.durand"}"#,
        Some(15_000), Some("2022-06-01"), None, None, None,
    ),
    (
        "key-coffre-hr", "key_physical", "Clé coffre HR",
        Some("Clé coffre HR — documents RH"),
        Some("K-CH-18"), Some("claire.moreau"), None, Some("paris-hr-room"),
        r#"{"door_id":"coffre-hr-01","copies":2,"holder":"claire.moreau"}"#,
        Some(15_000), Some("2022-06-01"), None, None, None,
    ),
    (
        "key-coffre-legal", "key_physical", "Clé coffre Legal",
        Some("Clé coffre Legal — contrats"),
        Some("K-CL-19"), Some("agnes.perrin"), None, Some("paris-board"),
        r#"{"door_id":"coffre-legal-01","copies":2,"holder":"agnes.perrin"}"#,
        Some(15_000), Some("2022-06-01"), None, None, None,
    ),
    (
        "key-coffre-it", "key_physical", "Clé coffre IT",
        Some("Clé coffre IT — clés API, secrets"),
        Some("K-CI-20"), Some("jean.martin"), None, Some("paris-hq-1"),
        r#"{"door_id":"coffre-it-01","copies":2,"holder":"jean.martin"}"#,
        Some(15_000), Some("2022-06-01"), None, None, None,
    ),
    // 5 véhicules
    (
        "key-veh-tesla-y", "key_physical", "Clé Tesla Model Y",
        Some("Clé (badge) Tesla Model Y"),
        Some("KV-01"), Some("marie.dupont"), None, Some("paris-hq"),
        r#"{"door_id":"veh-tesla-y-01","copies":2,"holder":"marie.dupont"}"#,
        Some(20_000), Some("2025-01-15"), None, None, None,
    ),
    (
        "key-veh-tesla-3", "key_physical", "Clé Tesla Model 3",
        Some("Clé (badge) Tesla Model 3"),
        Some("KV-02"), Some("paul.durand"), None, Some("paris-hq"),
        r#"{"door_id":"veh-tesla-3-01","copies":2,"holder":"paul.durand"}"#,
        Some(20_000), Some("2025-03-20"), None, None, None,
    ),
    (
        "key-veh-peugeot-408", "key_physical", "Clé Peugeot 408",
        Some("Clé Peugeot 408 GT"),
        Some("KV-03"), Some("jean.martin"), None, Some("paris-hq"),
        r#"{"door_id":"veh-peugeot-408-01","copies":2,"holder":"jean.martin"}"#,
        Some(8_000), Some("2024-11-05"), None, None, None,
    ),
    (
        "key-veh-renault-kangoo", "key_physical", "Clé Renault Kangoo",
        Some("Clé Renault Kangoo ZE — partagée"),
        Some("KV-04"), None, Some("operations"), Some("paris-hq"),
        r#"{"door_id":"veh-utility-renault-kangoo-01","copies":3,"holder":"operations-lead"}"#,
        Some(8_000), Some("2023-07-08"), None, None, None,
    ),
    (
        "key-veh-citroen-jumpy", "key_physical", "Clé Citroën Jumpy",
        Some("Clé Citroën Jumpy — partagée logistique"),
        Some("KV-05"), None, Some("operations"), Some("amsterdam-hub"),
        r#"{"door_id":"veh-utility-citroen-jumpy-01","copies":3,"holder":"logistics-lead"}"#,
        Some(8_000), Some("2022-10-12"), None, None, None,
    ),
    // ─── 15 badges ──────────────────────────────────────────────────
    (
        "badge-marie", "badge", "Badge Marie Dupont",
        Some("Badge nominatif CEO — accès all sites"),
        Some("B-001"), Some("marie.dupont"), None, Some("paris-hq"),
        r#"{"badge_number":"B-001","access_level":"all","validity_end":"2027-12-31"}"#,
        Some(1_500), Some("2024-01-01"), None, None, None,
    ),
    (
        "badge-paul", "badge", "Badge Paul Durand",
        Some("Badge nominatif CFO"),
        Some("B-002"), Some("paul.durand"), None, Some("paris-hq"),
        r#"{"badge_number":"B-002","access_level":"finance+direction","validity_end":"2027-12-31"}"#,
        Some(1_500), Some("2024-01-01"), None, None, None,
    ),
    (
        "badge-jean", "badge", "Badge Jean Martin",
        Some("Badge nominatif CTO"),
        Some("B-003"), Some("jean.martin"), None, Some("paris-hq"),
        r#"{"badge_number":"B-003","access_level":"engineering+direction","validity_end":"2027-12-31"}"#,
        Some(1_500), Some("2024-01-01"), None, None, None,
    ),
    (
        "badge-claire", "badge", "Badge Claire Moreau",
        Some("Badge nominatif CHRO"),
        Some("B-004"), Some("claire.moreau"), None, Some("paris-hq"),
        r#"{"badge_number":"B-004","access_level":"hr+direction","validity_end":"2027-12-31"}"#,
        Some(1_500), Some("2024-01-01"), None, None, None,
    ),
    (
        "badge-agnes", "badge", "Badge Agnès Perrin",
        Some("Badge nominatif COO"),
        Some("B-005"), Some("agnes.perrin"), None, Some("paris-hq"),
        r#"{"badge_number":"B-005","access_level":"all","validity_end":"2027-12-31"}"#,
        Some(1_500), Some("2024-01-01"), None, None, None,
    ),
    (
        "badge-victor", "badge", "Badge Victor Leblanc",
        Some("Badge nominatif CMO"),
        Some("B-006"), Some("victor.leblanc"), None, Some("paris-hq"),
        r#"{"badge_number":"B-006","access_level":"marketing+direction","validity_end":"2027-12-31"}"#,
        Some(1_500), Some("2024-01-01"), None, None, None,
    ),
    (
        "badge-sophie", "badge", "Badge Sophie Leroy",
        Some("Badge Platform Lead"),
        Some("B-007"), Some("sophie.leroy"), None, Some("paris-hq"),
        r#"{"badge_number":"B-007","access_level":"engineering","validity_end":"2027-12-31"}"#,
        Some(1_500), Some("2024-01-01"), None, None, None,
    ),
    (
        "badge-emma", "badge", "Badge Emma Rousseau",
        Some("Badge Frontend Lead"),
        Some("B-008"), Some("emma.rousseau"), None, Some("paris-hq"),
        r#"{"badge_number":"B-008","access_level":"engineering","validity_end":"2027-12-31"}"#,
        Some(1_500), Some("2024-01-01"), None, None, None,
    ),
    (
        "badge-raphael", "badge", "Badge Raphaël Benoît",
        Some("Badge AI Lead"),
        Some("B-009"), Some("raphael.benoit"), None, Some("amsterdam-hub"),
        r#"{"badge_number":"B-009","access_level":"engineering","validity_end":"2027-12-31"}"#,
        Some(1_500), Some("2024-01-01"), None, None, None,
    ),
    (
        "badge-nicolas", "badge", "Badge Nicolas Robert",
        Some("Badge Sales EMEA lead"),
        Some("B-010"), Some("nicolas.robert"), None, Some("paris-hq"),
        r#"{"badge_number":"B-010","access_level":"sales","validity_end":"2027-12-31"}"#,
        Some(1_500), Some("2024-01-01"), None, None, None,
    ),
    (
        "badge-visitor-01", "badge", "Badge visiteur #1",
        Some("Template badge visiteur 1j"),
        Some("V-001"), None, Some("operations"), Some("paris-hq"),
        r#"{"badge_number":"V-001","access_level":"visitor","validity_end":"2099-12-31"}"#,
        Some(500), Some("2024-01-01"), None, None, None,
    ),
    (
        "badge-visitor-02", "badge", "Badge visiteur #2",
        Some("Template badge visiteur 1j"),
        Some("V-002"), None, Some("operations"), Some("paris-hq"),
        r#"{"badge_number":"V-002","access_level":"visitor","validity_end":"2099-12-31"}"#,
        Some(500), Some("2024-01-01"), None, None, None,
    ),
    (
        "badge-visitor-03", "badge", "Badge visiteur #3",
        Some("Template badge visiteur 1j"),
        Some("V-003"), None, Some("operations"), Some("paris-hq"),
        r#"{"badge_number":"V-003","access_level":"visitor","validity_end":"2099-12-31"}"#,
        Some(500), Some("2024-01-01"), None, None, None,
    ),
    (
        "badge-contractor-01", "badge", "Badge prestataire nettoyage",
        Some("Badge récurrent prestataire nettoyage"),
        Some("C-001"), None, Some("operations"), Some("paris-hq"),
        r#"{"badge_number":"C-001","access_level":"facilities-night","validity_end":"2026-12-31"}"#,
        Some(1_000), Some("2024-01-01"), None, None, None,
    ),
    (
        "badge-contractor-02", "badge", "Badge prestataire IT",
        Some("Badge récurrent prestataire IT on-site"),
        Some("C-002"), None, Some("operations"), Some("paris-hq"),
        r#"{"badge_number":"C-002","access_level":"it-areas","validity_end":"2026-12-31"}"#,
        Some(1_000), Some("2024-01-01"), None, None, None,
    ),
    // ─── 8 équipements AV ────────────────────────────────────────────
    (
        "av-epson-1", "av_equipment", "Projecteur Epson Auditorium",
        Some("Projecteur 4K installé salle auditorium"),
        Some("EPS-4K-01"), None, Some("operations"), Some("paris-auditorium"),
        r#"{"type":"projector","portable":false,"bookable_slug":"projecteur-auditorium"}"#,
        Some(250_000), Some("2023-03-10"), Some(60), Some("2026-03-10"), Some("2026-09-10"),
    ),
    (
        "av-epson-2", "av_equipment", "Projecteur Epson Board",
        Some("Projecteur WUXGA salle Board"),
        Some("EPS-WU-02"), None, Some("operations"), Some("paris-board"),
        r#"{"type":"projector","portable":false,"bookable_slug":"projecteur-board"}"#,
        Some(200_000), Some("2023-03-10"), Some(60), Some("2026-03-10"), Some("2026-09-10"),
    ),
    (
        "av-screen-samsung-1", "av_equipment", "Écran portable Samsung 55",
        Some("Écran 55\" monté sur roulettes — pool Paris"),
        Some("SAM-55-01"), None, Some("operations"), Some("paris-hq"),
        r#"{"type":"screen","portable":true,"bookable_slug":"ecran-portable-1"}"#,
        Some(120_000), Some("2023-06-15"), Some(48), Some("2025-06-15"), Some("2026-06-15"),
    ),
    (
        "av-screen-samsung-2", "av_equipment", "Écran portable Samsung 65",
        Some("Écran 65\" monté sur roulettes — pool Paris"),
        Some("SAM-65-02"), None, Some("operations"), Some("paris-hq"),
        r#"{"type":"screen","portable":true,"bookable_slug":"ecran-portable-2"}"#,
        Some(180_000), Some("2023-06-15"), Some(48), Some("2025-06-15"), Some("2026-06-15"),
    ),
    (
        "av-screen-samsung-3", "av_equipment", "Écran portable Samsung 50 (Lyon)",
        Some("Écran 50\" Lyon"),
        Some("SAM-50-03"), None, Some("operations"), Some("lyon-annex"),
        r#"{"type":"screen","portable":true,"bookable_slug":"ecran-portable-lyon"}"#,
        Some(100_000), Some("2023-06-15"), Some(48), Some("2025-06-15"), Some("2026-06-15"),
    ),
    (
        "av-camera-sony-1", "av_equipment", "Caméra Sony Alpha (Paris)",
        Some("Caméra événementiel Paris"),
        Some("SONY-A-01"), None, Some("marketing"), Some("paris-hq"),
        r#"{"type":"camera","portable":true,"bookable_slug":"camera-sony-1"}"#,
        Some(350_000), Some("2024-04-01"), Some(60), Some("2026-04-01"), Some("2026-10-01"),
    ),
    (
        "av-camera-sony-2", "av_equipment", "Caméra Sony Alpha (Amsterdam)",
        Some("Caméra événementiel Amsterdam"),
        Some("SONY-A-02"), None, Some("marketing"), Some("amsterdam-hub"),
        r#"{"type":"camera","portable":true,"bookable_slug":"camera-sony-2"}"#,
        Some(350_000), Some("2024-04-01"), Some(60), Some("2026-04-01"), Some("2026-10-01"),
    ),
    (
        "av-mic-boom-1", "av_equipment", "Perche micro Rode",
        Some("Perche micro tournage événementiel"),
        Some("RODE-B-01"), None, Some("marketing"), Some("paris-hq"),
        r#"{"type":"microphone","portable":true,"bookable_slug":"perche-micro"}"#,
        Some(45_000), Some("2024-05-10"), Some(48), Some("2026-05-10"), None,
    ),
    // ─── 5 licences logiciels ─────────────────────────────────────────
    (
        "lic-figma", "license_software", "Figma Enterprise (20 seats)",
        Some("Abonnement Figma Enterprise — toute l'équipe design & eng"),
        Some("FIGMA-ENT-001"), None, Some("engineering"), None,
        r#"{"vendor":"Figma","edition":"Enterprise","seats_total":20,"seats_used":18,"renewal_date":"2026-12-31"}"#,
        Some(1_800_000), Some("2025-01-01"), Some(12), Some("2026-12-31"), None,
    ),
    (
        "lic-adobe-cc", "license_software", "Adobe Creative Cloud (15 seats)",
        Some("Abonnement Adobe CC — marketing + design"),
        Some("ADOBE-CC-001"), None, Some("marketing"), None,
        r#"{"vendor":"Adobe","edition":"Creative Cloud All Apps","seats_total":15,"seats_used":12,"renewal_date":"2026-12-31"}"#,
        Some(1_500_000), Some("2025-01-01"), Some(12), Some("2026-12-31"), None,
    ),
    (
        "lic-notion", "license_software", "Notion Enterprise (80 seats)",
        Some("Notion Enterprise — toute la boîte"),
        Some("NOTION-ENT-001"), None, None, None,
        r#"{"vendor":"Notion","edition":"Enterprise","seats_total":80,"seats_used":75,"renewal_date":"2026-12-31"}"#,
        Some(800_000), Some("2025-01-01"), Some(12), Some("2026-12-31"), None,
    ),
    (
        "lic-linear", "license_software", "Linear Business (40 seats)",
        Some("Linear — issue tracker product + eng"),
        Some("LINEAR-BIZ-001"), None, Some("engineering"), None,
        r#"{"vendor":"Linear","edition":"Business","seats_total":40,"seats_used":38,"renewal_date":"2026-12-31"}"#,
        Some(700_000), Some("2025-01-01"), Some(12), Some("2026-12-31"), None,
    ),
    (
        "lic-miro", "license_software", "Miro Enterprise (25 seats)",
        Some("Miro Enterprise — whiteboarding design + workshops"),
        Some("MIRO-ENT-001"), None, Some("operations"), None,
        r#"{"vendor":"Miro","edition":"Enterprise","seats_total":25,"seats_used":20,"renewal_date":"2026-12-31"}"#,
        Some(600_000), Some("2025-01-01"), Some(12), Some("2026-12-31"), None,
    ),
];

#[async_trait]
impl Seeder for ResourcesSeeder {
    fn name(&self) -> &'static str {
        "resources"
    }

    fn dependencies(&self) -> Vec<&'static str> {
        // Needs org (nodes + persons), sites, and it-assets (legacy to migrate).
        vec!["org", "sites", "it-assets"]
    }

    async fn run(&self, ctx: &SeedContext) -> anyhow::Result<SeedReport> {
        let mut report = SeedReport::default();
        let pool = ctx.db.inner();

        // ─── Pass 1 — legacy IT migration ────────────────────────────────
        // Pull rows from `it.configuration_items` and fan them out into
        // `org_resources` with kind='it_device'. Deterministic id derived
        // from the legacy uuid so reruns are stable.
        let legacy: Vec<(uuid::Uuid, String, String, String, Option<uuid::Uuid>, serde_json::Value)> = sqlx::query_as(
            "SELECT id, name, ci_type, status, owner_id, metadata
               FROM it.configuration_items",
        )
        .fetch_all(pool)
        .await?;

        for (legacy_id, name, ci_type, _status, owner_id, metadata) in legacy {
            let new_id = acme_uuid("org-resource-legacy", &legacy_id.to_string());
            let slug = format!("it-{ci_type}-{}", &legacy_id.to_string()[..8]);
            let model = metadata
                .get("model")
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown")
                .to_string();
            let serial = metadata
                .get("serial_number")
                .and_then(|v| v.as_str())
                .map(std::string::ToString::to_string);
            // Build the attributes payload carrying the legacy id.
            let attrs = serde_json::json!({
                "serial": serial.clone().unwrap_or_default(),
                "model": model,
                "os": metadata.get("os").and_then(|v| v.as_str()).unwrap_or(""),
                "ci_type": ci_type,
                "legacy_it_asset_id": legacy_id.to_string(),
            });
            // Only link to a person if the owner_id points to a known
            // person_id (user_id can match via join with org_persons).
            let person_row: Option<(uuid::Uuid,)> = if let Some(oid) = owner_id {
                sqlx::query_as(
                    "SELECT id FROM org_persons WHERE user_id = $1 AND tenant_id = $2 LIMIT 1",
                )
                .bind(oid)
                .bind(ctx.tenant_id)
                .fetch_optional(pool)
                .await?
            } else {
                None
            };
            let person_id = person_row.map(|r| r.0);

            let res = sqlx::query(
                r"
                INSERT INTO org_resources (
                    id, tenant_id, kind, slug, name, description,
                    serial_or_ref, attributes, status, assigned_to_person_id,
                    currency
                ) VALUES (
                    $1, $2, 'it_device', $3, $4, $5,
                    $6, $7::jsonb, 'active', $8, 'EUR'
                )
                ON CONFLICT (tenant_id, slug) DO UPDATE SET
                    name = EXCLUDED.name,
                    description = EXCLUDED.description,
                    serial_or_ref = EXCLUDED.serial_or_ref,
                    attributes = EXCLUDED.attributes,
                    assigned_to_person_id = EXCLUDED.assigned_to_person_id,
                    updated_at = now()
                ",
            )
            .bind(new_id)
            .bind(ctx.tenant_id)
            .bind(&slug)
            .bind(&name)
            .bind(format!("Legacy IT device migré depuis it.configuration_items ({ci_type})"))
            .bind(serial)
            .bind(&attrs)
            .bind(person_id)
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
                Err(e) => report.errors.push(format!("it-legacy {slug}: {e}")),
            }
        }

        // Initial status_log for the legacy IT (one-off) — skip if a row
        // already exists to keep re-runs idempotent.
        sqlx::query(
            r"
            INSERT INTO org_resource_status_log (resource_id, from_status, to_status, reason)
            SELECT r.id, NULL, 'active', 'migrated from it.configuration_items'
              FROM org_resources r
             WHERE r.tenant_id = $1 AND r.kind = 'it_device'
               AND NOT EXISTS (
                 SELECT 1 FROM org_resource_status_log l WHERE l.resource_id = r.id
               )
            ",
        )
        .bind(ctx.tenant_id)
        .execute(pool)
        .await?;

        // ─── Pass 2 — fresh resources (véhicules/clés/badges/AV/licences).
        for spec in FRESH_RESOURCES {
            let (
                slug,
                kind,
                name,
                description,
                serial_or_ref,
                person_slug_opt,
                node_slug_opt,
                site_slug_opt,
                attributes_json,
                cost_cents,
                purchase_date_str,
                amort_months,
                warranty_str,
                maint_str,
            ) = spec;
            let id = acme_uuid("org-resource", slug);

            let person_id = person_slug_opt.and_then(|s| {
                // person slug uses pattern shared with PRIMARY_LINKS seeder.
                Some(acme_uuid("person", s))
            });
            let node_id = node_slug_opt.map(|s| acme_uuid("org-node", s));
            // Sites use the same deterministic uuid as the sites seeder.
            let site_id = site_slug_opt.map(|s| acme_uuid("org-site", s));

            let attrs: serde_json::Value = serde_json::from_str(attributes_json)
                .unwrap_or_else(|_| serde_json::json!({}));
            let purchase_date = purchase_date_str
                .and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());
            let warranty_date = warranty_str
                .and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());
            let maint_date = maint_str
                .and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());

            // Verify that the person/node/site id actually exists, else
            // null them out to avoid FK violations.
            let person_exists = match person_id {
                Some(pid) => sqlx::query_scalar::<_, i64>(
                    "SELECT COUNT(*) FROM org_persons WHERE id = $1",
                )
                .bind(pid)
                .fetch_one(pool)
                .await
                .unwrap_or(0)
                    > 0,
                None => false,
            };
            let node_exists = match node_id {
                Some(nid) => sqlx::query_scalar::<_, i64>(
                    "SELECT COUNT(*) FROM org_nodes WHERE id = $1",
                )
                .bind(nid)
                .fetch_one(pool)
                .await
                .unwrap_or(0)
                    > 0,
                None => false,
            };
            let site_exists = match site_id {
                Some(sid) => sqlx::query_scalar::<_, i64>(
                    "SELECT COUNT(*) FROM org_sites WHERE id = $1",
                )
                .bind(sid)
                .fetch_one(pool)
                .await
                .unwrap_or(0)
                    > 0,
                None => false,
            };

            let final_person = if person_exists { person_id } else { None };
            let final_node = if node_exists { node_id } else { None };
            let final_site = if site_exists { site_id } else { None };

            let res = sqlx::query(
                r"
                INSERT INTO org_resources (
                    id, tenant_id, kind, slug, name, description,
                    serial_or_ref, attributes, status,
                    assigned_to_person_id, assigned_to_node_id, primary_site_id,
                    purchase_date, purchase_cost_cents, currency,
                    amortization_months, warranty_end_date, next_maintenance_date
                ) VALUES (
                    $1, $2, $3, $4, $5, $6,
                    $7, $8::jsonb, 'active',
                    $9, $10, $11,
                    $12, $13, 'EUR',
                    $14, $15, $16
                )
                ON CONFLICT (tenant_id, slug) DO UPDATE SET
                    name = EXCLUDED.name,
                    description = EXCLUDED.description,
                    serial_or_ref = EXCLUDED.serial_or_ref,
                    attributes = EXCLUDED.attributes,
                    assigned_to_person_id = EXCLUDED.assigned_to_person_id,
                    assigned_to_node_id = EXCLUDED.assigned_to_node_id,
                    primary_site_id = EXCLUDED.primary_site_id,
                    purchase_date = EXCLUDED.purchase_date,
                    purchase_cost_cents = EXCLUDED.purchase_cost_cents,
                    amortization_months = EXCLUDED.amortization_months,
                    warranty_end_date = EXCLUDED.warranty_end_date,
                    next_maintenance_date = EXCLUDED.next_maintenance_date,
                    updated_at = now()
                ",
            )
            .bind(id)
            .bind(ctx.tenant_id)
            .bind(kind)
            .bind(slug)
            .bind(name)
            .bind(description)
            .bind(serial_or_ref)
            .bind(&attrs)
            .bind(final_person)
            .bind(final_node)
            .bind(final_site)
            .bind(purchase_date)
            .bind(cost_cents)
            .bind(amort_months)
            .bind(warranty_date)
            .bind(maint_date)
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
                Err(e) => report.errors.push(format!("resource {slug}: {e}")),
            }
        }

        // Add initial status_log rows for all fresh resources (skip if already present).
        sqlx::query(
            r"
            INSERT INTO org_resource_status_log (resource_id, from_status, to_status, reason)
            SELECT r.id, NULL, r.status, 'initial seed'
              FROM org_resources r
             WHERE r.tenant_id = $1
               AND NOT EXISTS (
                 SELECT 1 FROM org_resource_status_log l WHERE l.resource_id = r.id
               )
            ",
        )
        .bind(ctx.tenant_id)
        .execute(pool)
        .await?;

        // ─── Pass 3 — QR tokens (SHA-256 truncated to 16 hex chars).
        // We need the same formula as the handler: hex(hmac_sha256(dek,
        // resource.id)[..8]). In the seeder we don't have access to the
        // keystore, but deterministic per-id tokens are good enough for
        // demo — we use the first 16 hex of sha256(id) as a stand-in.
        // The backend handler regenerates with the real keystore on the
        // first API hit via POST /:id/qr/rotate if needed.
        sqlx::query(
            r"
            UPDATE org_resources
               SET qr_token = substring(encode(digest(id::text, 'sha256'), 'hex') from 1 for 16),
                   updated_at = now()
             WHERE tenant_id = $1 AND qr_token IS NULL
            ",
        )
        .bind(ctx.tenant_id)
        .execute(pool)
        .await?;

        Ok(report)
    }
}
