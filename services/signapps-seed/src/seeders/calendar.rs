//! Calendar seeder — 8 calendars (1 per unit + CEO personal) + ~180 events
//! spread over 2 months (now-30 days → now+30 days).

use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::seeders::org::bump;
use crate::uuid::acme_uuid;
use async_trait::async_trait;
use chrono::{DateTime, Datelike, Duration, TimeZone, Utc};
use uuid::Uuid;

/// Seeds calendars + events for Nexus Industries demo.
pub struct CalendarSeeder;

/// Return a `DateTime<Utc>` anchored on today + offset_days at given hour/min.
fn now_date(offset_days: i64, hour: u32, minute: u32) -> DateTime<Utc> {
    let today = Utc::now().date_naive();
    let d = today + Duration::days(offset_days);
    Utc.from_utc_datetime(
        &d.and_hms_opt(hour, minute, 0)
            .unwrap_or_else(|| d.and_hms_opt(0, 0, 0).unwrap_or_default()),
    )
}

/// Catalog of calendars (slug, name, color, owner_username).
const CALENDARS: &[(&str, &str, &str, &str)] = &[
    ("direction", "Calendrier Direction", "#4285f4", "marie.dupont"),
    ("engineering", "Calendrier Engineering", "#0b8043", "jean.martin"),
    ("sales", "Calendrier Sales", "#f4511e", "nicolas.robert"),
    ("marketing", "Calendrier Marketing", "#e91e63", "elise.vincent"),
    ("support", "Calendrier Support", "#8e24aa", "antoine.bonnet"),
    ("finance", "Calendrier Finance", "#039be5", "benjamin.blanc"),
    ("hr", "Calendrier HR", "#fbbc04", "claire.moreau"),
    ("operations", "Calendrier Operations", "#616161", "boris.lambert"),
    ("ceo-personal", "Agenda CEO", "#d50000", "marie.dupont"),
];

/// Payload for one event insert. Bundling fields keeps the helper under
/// clippy's `too-many-arguments-threshold` (8).
struct EventSpec {
    cal_id: Uuid,
    day: i64,
    start_h: u32,
    start_m: u32,
    dur_min: i64,
    title: &'static str,
    desc: &'static str,
}

/// Inserts an event row into `calendar.events` and bumps the report.
async fn insert_event(
    pool: &sqlx::PgPool,
    report: &mut SeedReport,
    tenant_id: Uuid,
    event_idx: &mut usize,
    spec: &EventSpec,
) {
    insert_event_with_title(pool, report, tenant_id, event_idx, spec, spec.title).await;
}

/// Same as `insert_event` but with an owned title (for formatted strings).
async fn insert_event_with_title(
    pool: &sqlx::PgPool,
    report: &mut SeedReport,
    tenant_id: Uuid,
    event_idx: &mut usize,
    spec: &EventSpec,
    title: &str,
) {
    let ev_id = acme_uuid("event", &format!("e{}", *event_idx));
    *event_idx += 1;
    let start = now_date(spec.day, spec.start_h, spec.start_m);
    let end = start + Duration::minutes(spec.dur_min);
    let res = sqlx::query(
        r#"
        INSERT INTO calendar.events
            (id, calendar_id, title, description, start_time, end_time, timezone, tenant_id, is_all_day)
        VALUES ($1, $2, $3, $4, $5, $6, 'Europe/Paris', $7, FALSE)
        ON CONFLICT (id) DO NOTHING
        "#,
    )
    .bind(ev_id)
    .bind(spec.cal_id)
    .bind(title)
    .bind(spec.desc)
    .bind(start)
    .bind(end)
    .bind(tenant_id)
    .execute(pool)
    .await;
    bump(report, res, "event");
}

#[async_trait]
impl Seeder for CalendarSeeder {
    fn name(&self) -> &'static str {
        "calendar"
    }

    fn dependencies(&self) -> Vec<&'static str> {
        vec!["org", "identity"]
    }

    async fn run(&self, ctx: &SeedContext) -> anyhow::Result<SeedReport> {
        let mut report = SeedReport::default();
        let pool = ctx.db.inner();

        // 1) Calendars ───────────────────────────────────────────────
        for (slug, name, color, owner_username) in CALENDARS.iter() {
            let cal_id = acme_uuid("calendar", slug);
            let owner_id = ctx
                .user(owner_username)
                .ok_or_else(|| anyhow::anyhow!("owner not registered: {}", owner_username))?;
            let res = sqlx::query(
                r#"
                INSERT INTO calendar.calendars
                    (id, owner_id, name, description, color, calendar_type, tenant_id, is_shared)
                VALUES ($1, $2, $3, $4, $5, 'shared', $6, TRUE)
                ON CONFLICT (id) DO NOTHING
                "#,
            )
            .bind(cal_id)
            .bind(owner_id)
            .bind(name)
            .bind(format!("Démo calendrier {}", slug))
            .bind(color)
            .bind(ctx.tenant_id)
            .execute(pool)
            .await;
            bump(&mut report, res, "calendar");
        }

        // 2) Events over 2 months (now-30 → now+30) ──────────────────
        let eng_cal = acme_uuid("calendar", "engineering");
        let sales_cal = acme_uuid("calendar", "sales");
        let direction_cal = acme_uuid("calendar", "direction");
        let marketing_cal = acme_uuid("calendar", "marketing");
        let support_cal = acme_uuid("calendar", "support");
        let finance_cal = acme_uuid("calendar", "finance");
        let hr_cal = acme_uuid("calendar", "hr");
        let ops_cal = acme_uuid("calendar", "operations");
        let ceo_cal = acme_uuid("calendar", "ceo-personal");

        let mut event_idx = 0usize;

        // 2a) Daily stand-ups (weekdays) for 6 teams, [-14, +14] = ~20 weekdays * 6 = ~120
        let standup_specs: &[(Uuid, u32, u32, &str, &str)] = &[
            (eng_cal, 9, 30, "Standup Platform", "Daily Platform team"),
            (eng_cal, 10, 0, "Standup Frontend", "Daily Frontend team"),
            (eng_cal, 10, 30, "Standup AI", "Daily AI team"),
            (sales_cal, 9, 0, "Sales Pipeline Review", "Deals du jour"),
            (support_cal, 9, 15, "Tickets Triage", "Support daily"),
            (marketing_cal, 11, 0, "Marketing Sync", "Campaigns + content"),
        ];
        for day in -14i64..=14 {
            let weekday = {
                let d = Utc::now().date_naive() + Duration::days(day);
                d.weekday().num_days_from_monday()
            };
            if weekday >= 5 {
                continue;
            }
            for (cal, h, m, title, desc) in standup_specs.iter() {
                let spec = EventSpec {
                    cal_id: *cal,
                    day,
                    start_h: *h,
                    start_m: *m,
                    dur_min: 15,
                    title,
                    desc,
                };
                insert_event(pool, &mut report, ctx.tenant_id, &mut event_idx, &spec).await;
            }
        }

        // 2b) 1-on-1s hebdomadaires (Manager / Direct report)
        let ones: &[(&str, &str, Uuid)] = &[
            ("jean.martin", "sophie.leroy", eng_cal),
            ("jean.martin", "emma.rousseau", eng_cal),
            ("jean.martin", "raphael.benoit", eng_cal),
            ("marie.dupont", "paul.durand", direction_cal),
            ("marie.dupont", "jean.martin", direction_cal),
            ("marie.dupont", "victor.leblanc", direction_cal),
            ("nicolas.robert", "anne.girard", sales_cal),
            ("antoine.bonnet", "isabelle.noel", support_cal),
            ("elise.vincent", "mathis.muller", marketing_cal),
            ("benjamin.blanc", "aline.gautier", finance_cal),
            ("claire.moreau", "mia.lecomte", hr_cal),
            ("boris.lambert", "celine.pasquier", ops_cal),
        ];
        for (wk, (mgr, rep_to, cal)) in ones.iter().enumerate() {
            for offset in [-14i64, -7, 7, 14] {
                let day = offset + (wk as i64 % 5);
                let title = format!("1-on-1 {} / {}", mgr, rep_to);
                let spec = EventSpec {
                    cal_id: *cal,
                    day,
                    start_h: 14,
                    start_m: ((wk as u32) % 4) * 15,
                    dur_min: 30,
                    title: "",
                    desc: "Point individuel",
                };
                insert_event_with_title(
                    pool,
                    &mut report,
                    ctx.tenant_id,
                    &mut event_idx,
                    &spec,
                    &title,
                )
                .await;
            }
        }

        // 2c) All-hands mensuels
        for offset in [-28i64, 0, 28] {
            let spec = EventSpec {
                cal_id: direction_cal,
                day: offset,
                start_h: 16,
                start_m: 0,
                dur_min: 60,
                title: "All-Hands Nexus",
                desc: "Plénière mensuelle",
            };
            insert_event(pool, &mut report, ctx.tenant_id, &mut event_idx, &spec).await;
        }

        // 2d) Sprint plannings + reviews (toutes les 2 semaines)
        for offset in [-28i64, -14, 0, 14, 28] {
            let planning = EventSpec {
                cal_id: eng_cal,
                day: offset,
                start_h: 10,
                start_m: 0,
                dur_min: 120,
                title: "Sprint Planning",
                desc: "Planning du sprint",
            };
            insert_event(pool, &mut report, ctx.tenant_id, &mut event_idx, &planning).await;
            let review = EventSpec {
                cal_id: eng_cal,
                day: offset + 12,
                start_h: 15,
                start_m: 0,
                dur_min: 60,
                title: "Sprint Review",
                desc: "Démo + rétro",
            };
            insert_event(pool, &mut report, ctx.tenant_id, &mut event_idx, &review).await;
        }

        // 2e) Client meetings
        let clients = [
            "ACME Industries",
            "TechCorp",
            "Durand SA",
            "InnovaTech",
            "MediaPlus",
            "Construire",
            "SantéPlus",
            "LogiSys",
            "Creativ",
            "FinanceGroup",
        ];
        for (i, client) in clients.iter().enumerate() {
            let offset = (i as i64) * 3 - 15;
            let title = format!("Rendez-vous {}", client);
            let spec = EventSpec {
                cal_id: sales_cal,
                day: offset,
                start_h: 11,
                start_m: 0,
                dur_min: 45,
                title: "",
                desc: "Meeting client",
            };
            insert_event_with_title(
                pool,
                &mut report,
                ctx.tenant_id,
                &mut event_idx,
                &spec,
                &title,
            )
            .await;
        }

        // 2f) Candidate interviews
        let candidates = [
            "Candidat Backend Sr",
            "Candidate Frontend",
            "Candidat ML Eng",
            "Candidat Support L2",
            "Candidate Sales EMEA",
            "Candidat Finance",
        ];
        for (i, cand) in candidates.iter().enumerate() {
            let offset = (i as i64) * 4 - 10;
            let title = format!("Interview — {}", cand);
            let spec = EventSpec {
                cal_id: hr_cal,
                day: offset,
                start_h: 14,
                start_m: 30,
                dur_min: 60,
                title: "",
                desc: "RH + tech",
            };
            insert_event_with_title(
                pool,
                &mut report,
                ctx.tenant_id,
                &mut event_idx,
                &spec,
                &title,
            )
            .await;
        }

        // 2g) Finance close, Marketing launches, Ops audits, Board meetings
        let misc: &[(Uuid, i64, u32, i64, &str, &str)] = &[
            (finance_cal, -25, 9, 180, "Clôture mensuelle Mars", "Month-end"),
            (finance_cal, 5, 9, 180, "Clôture mensuelle Avril", "Month-end"),
            (finance_cal, 10, 14, 90, "Revue Budget Q2", "Finance"),
            (marketing_cal, -20, 10, 60, "Launch Campaign Spring", "Go-live"),
            (marketing_cal, 7, 10, 60, "Launch Campaign Q2", "Go-live"),
            (marketing_cal, 20, 11, 90, "Webinaire produit", "Public"),
            (ops_cal, -22, 9, 120, "Audit SOC 2", "Compliance"),
            (ops_cal, 3, 9, 120, "Audit RGPD", "Compliance"),
            (ops_cal, 15, 15, 60, "Fournisseurs review", "Procurement"),
            (direction_cal, -10, 9, 120, "Board Meeting Q1", "Board trimestriel"),
            (direction_cal, 21, 9, 120, "Board Meeting Q2", "Board trimestriel"),
            (ceo_cal, -7, 19, 120, "Dîner investisseurs", "Off-site"),
            (ceo_cal, 6, 8, 60, "Petit-déjeuner presse", "Media"),
            (ceo_cal, 18, 17, 60, "Call investisseur US", "Fundraising"),
            (support_cal, -12, 14, 60, "Post-mortem incident P0", "RCA"),
            (support_cal, 9, 14, 60, "KB Update Sprint", "Knowledge base"),
            (eng_cal, -18, 14, 120, "Architecture review SSO", "Decision"),
            (eng_cal, 11, 14, 120, "Architecture review IA", "Decision"),
            (eng_cal, 23, 14, 120, "Tech Talk RAG", "Formation"),
            (hr_cal, -15, 10, 120, "Onboarding Nouveaux", "Semaine d'intégration"),
            (hr_cal, 15, 10, 120, "Onboarding Nouveaux", "Semaine d'intégration"),
        ];
        for (cal, d, h, dur, title, desc) in misc.iter() {
            let spec = EventSpec {
                cal_id: *cal,
                day: *d,
                start_h: *h,
                start_m: 0,
                dur_min: *dur,
                title,
                desc,
            };
            insert_event(pool, &mut report, ctx.tenant_id, &mut event_idx, &spec).await;
        }

        Ok(report)
    }
}
