//! Calendar seeder — 4 calendars (one per OU) + 20 events across current week.

use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::seeders::org::{bump, OUS};
use crate::uuid::acme_uuid;
use async_trait::async_trait;
use chrono::{DateTime, Datelike, Duration, TimeZone, Utc};

/// Seeds calendars + events for Acme Corp demo.
pub struct CalendarSeeder;

/// Return a `DateTime<Utc>` anchored on the current week's Monday + offset.
fn week_date(offset_days: i64, hour: u32) -> DateTime<Utc> {
    let today = Utc::now().date_naive();
    let monday_offset = today.weekday().num_days_from_monday() as i64;
    let monday = today - Duration::days(monday_offset);
    let d = monday + Duration::days(offset_days);
    Utc.from_utc_datetime(
        &d.and_hms_opt(hour, 0, 0)
            .unwrap_or_else(|| d.and_hms_opt(0, 0, 0).unwrap()),
    )
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

        // One calendar per OU, owned by the first person of that OU.
        let cals: &[(&str, &str, &str, &str)] = &[
            ("direction", "Calendrier Direction", "#4285f4", "marie.dupont"),
            ("engineering", "Calendrier Engineering", "#0b8043", "jean.martin"),
            ("sales", "Calendrier Sales", "#f4511e", "nicolas.robert"),
            ("support", "Calendrier Support", "#8e24aa", "antoine.bonnet"),
        ];

        for (ou, name, color, owner_username) in cals.iter() {
            let cal_id = acme_uuid("calendar", ou);
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
            .bind(format!("Démo calendrier {}", ou))
            .bind(color)
            .bind(ctx.tenant_id)
            .execute(pool)
            .await;
            bump(&mut report, res, "calendar");

            let _ = ou; // silence unused var lint
            let _ = OUS; // suppress dead code warning
        }

        // 20 events
        let eng_cal = acme_uuid("calendar", "engineering");
        let sales_cal = acme_uuid("calendar", "sales");
        let direction_cal = acme_uuid("calendar", "direction");
        let support_cal = acme_uuid("calendar", "support");

        let events: &[(uuid::Uuid, i64, u32, u32, &str, &str)] = &[
            (direction_cal, 0, 9, 10, "Réunion direction hebdo", "Point stratégique"),
            (direction_cal, 2, 14, 15, "Revue budget Q2", "Point finances"),
            (direction_cal, 4, 16, 17, "Board review", "Alignement mensuel"),
            (eng_cal, 0, 10, 11, "Sprint planning", "Planning sprint 14"),
            (eng_cal, 0, 14, 15, "Code review", "Review PRs ouvertes"),
            (eng_cal, 1, 9, 10, "Standup Engineering", "Daily"),
            (eng_cal, 1, 11, 12, "Architecture review", "Décision SSO"),
            (eng_cal, 2, 10, 11, "Pair programming", "Module auth"),
            (eng_cal, 3, 14, 16, "Formation IA", "RAG + OCR SignApps"),
            (eng_cal, 4, 15, 16, "Sprint retro", "Retro sprint 14"),
            (sales_cal, 0, 11, 12, "Pipeline review", "Stage deals"),
            (sales_cal, 1, 14, 15, "Client ACME Industries", "Démo produit"),
            (sales_cal, 2, 10, 11, "Call prospect", "Qualif Durand"),
            (sales_cal, 3, 16, 17, "Forecast meeting", "Q2 commit"),
            (sales_cal, 4, 9, 10, "Team sales", "Partage deals"),
            (support_cal, 0, 14, 15, "Tickets triage", "Backlog review"),
            (support_cal, 2, 11, 12, "Post-mortem incident", "Incident prod 04/17"),
            (support_cal, 4, 10, 11, "KB update", "Nouveaux articles"),
            (eng_cal, 2, 16, 17, "Demo interne", "Feature PXE live"),
            (direction_cal, 1, 15, 16, "RH one-on-one", "Entretiens"),
        ];

        for (i, (cal_id, day_offset, sh, eh, title, desc)) in events.iter().enumerate() {
            let ev_id = acme_uuid("event", &format!("e{}", i));
            let res = sqlx::query(
                r#"
                INSERT INTO calendar.events
                    (id, calendar_id, title, description, start_time, end_time, timezone, tenant_id, is_all_day)
                VALUES ($1, $2, $3, $4, $5, $6, 'Europe/Paris', $7, FALSE)
                ON CONFLICT (id) DO NOTHING
                "#,
            )
            .bind(ev_id)
            .bind(cal_id)
            .bind(title)
            .bind(desc)
            .bind(week_date(*day_offset, *sh))
            .bind(week_date(*day_offset, *eh))
            .bind(ctx.tenant_id)
            .execute(pool)
            .await;
            bump(&mut report, res, "event");
        }

        Ok(report)
    }
}
