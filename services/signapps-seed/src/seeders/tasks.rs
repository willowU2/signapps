//! Tasks seeder — 12 demo tasks attached to the engineering calendar.

use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::seeders::org::bump;
use crate::uuid::acme_uuid;
use async_trait::async_trait;

/// Seeds 12 demo tasks linked to the engineering calendar.
pub struct TasksSeeder;

#[async_trait]
impl Seeder for TasksSeeder {
    fn name(&self) -> &'static str {
        "tasks"
    }

    fn dependencies(&self) -> Vec<&'static str> {
        vec!["calendar", "identity"]
    }

    async fn run(&self, ctx: &SeedContext) -> anyhow::Result<SeedReport> {
        let mut report = SeedReport::default();
        let pool = ctx.db.inner();

        let calendar_id = acme_uuid("calendar", "engineering");
        let owner = ctx
            .user("jean.martin")
            .ok_or_else(|| anyhow::anyhow!("jean.martin not registered"))?;

        let tasks: &[(&str, &str, i32)] = &[
            ("Setup CI pipeline", "open", 3),
            ("Refactor auth module", "in_progress", 2),
            ("Write API docs", "done", 4),
            ("Fix bug #1234", "open", 2),
            ("Deploy staging", "in_progress", 1),
            ("Benchmark DB queries", "open", 3),
            ("Onboard new dev", "done", 2),
            ("Review PR #456", "in_progress", 1),
            ("Plan S3 sprint", "open", 3),
            ("Write postmortem", "done", 2),
            ("Update dependencies", "open", 2),
            ("Client demo prep", "in_progress", 1),
        ];

        for (i, (title, status, priority)) in tasks.iter().enumerate() {
            let tid = acme_uuid("task", &format!("t{}", i));
            let res = sqlx::query(
                r#"
                INSERT INTO calendar.tasks
                    (id, calendar_id, title, description, status, priority, created_by, assigned_to, tenant_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8)
                ON CONFLICT (id) DO NOTHING
                "#,
            )
            .bind(tid)
            .bind(calendar_id)
            .bind(title)
            .bind(format!("Tâche démo: {}", title))
            .bind(status)
            .bind(*priority)
            .bind(owner)
            .bind(ctx.tenant_id)
            .execute(pool)
            .await;
            bump(&mut report, res, "task");
        }
        Ok(report)
    }
}
