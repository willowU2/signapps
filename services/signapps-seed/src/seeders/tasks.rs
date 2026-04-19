//! Tasks seeder — 10 projects + 50 demo tasks spread across them.
//!
//! Projects are rows in `calendar.projects`. Tasks live in `calendar.tasks`
//! and reference a `project_id`. Owners/assignees rotate across Nexus
//! employees for realistic UI variety.

use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::seeders::org::{bump, PERSONS};
use crate::uuid::acme_uuid;
use async_trait::async_trait;

/// Seeds 10 projects + 50 tasks distributed across them.
pub struct TasksSeeder;

/// (slug, name, status, owner_username, calendar_slug)
const PROJECTS: &[(&str, &str, &str, &str, &str)] = &[
    ("q2-roadmap", "Q2 Roadmap", "active", "marie.dupont", "direction"),
    ("customer-portal-v2", "Customer Portal v2", "active", "emma.rousseau", "engineering"),
    ("ai-assistant-launch", "AI Assistant Launch", "active", "raphael.benoit", "engineering"),
    ("sales-pipeline-optim", "Sales Pipeline Optim", "active", "nicolas.robert", "sales"),
    ("hiring-push-h1", "Hiring Push H1", "active", "claire.moreau", "hr"),
    ("compliance-audit", "Compliance Audit SOC2", "planning", "manu.brun", "operations"),
    ("performance-review-q2", "Performance Review Q2", "active", "mia.lecomte", "hr"),
    ("office-move", "Office Move", "planning", "iris.delmas", "operations"),
    ("brand-refresh", "Brand Refresh", "active", "gabriel.lemoine", "marketing"),
    ("api-v3", "API v3", "active", "sophie.leroy", "engineering"),
];

/// (project_slug, title, status, priority_0_to_5)
const TASKS: &[(&str, &str, &str, i32)] = &[
    // Q2 Roadmap
    ("q2-roadmap", "Valider OKRs par équipe", "done", 3),
    ("q2-roadmap", "Aligner budget Q2", "in_progress", 3),
    ("q2-roadmap", "Réviser KPIs board", "open", 2),
    ("q2-roadmap", "Communiquer roadmap", "open", 2),
    ("q2-roadmap", "Post All-Hands follow-up", "open", 1),
    // Customer Portal v2
    ("customer-portal-v2", "Design system v2", "done", 2),
    ("customer-portal-v2", "Migrate auth to OAuth2", "in_progress", 3),
    ("customer-portal-v2", "Billing history page", "in_progress", 2),
    ("customer-portal-v2", "SLA dashboard", "open", 2),
    ("customer-portal-v2", "Tests E2E Playwright", "open", 3),
    ("customer-portal-v2", "Docs publiques", "open", 1),
    // AI Assistant Launch
    ("ai-assistant-launch", "RAG pipeline", "done", 3),
    ("ai-assistant-launch", "Embedding model eval", "done", 2),
    ("ai-assistant-launch", "Guardrails safety", "in_progress", 3),
    ("ai-assistant-launch", "UI chat widget", "in_progress", 2),
    ("ai-assistant-launch", "Beta testers onboarding", "open", 2),
    ("ai-assistant-launch", "Monitoring LLM costs", "open", 2),
    // Sales Pipeline Optim
    ("sales-pipeline-optim", "CRM lead scoring v2", "in_progress", 3),
    ("sales-pipeline-optim", "Cadence séquences email", "open", 2),
    ("sales-pipeline-optim", "Dashboard forecast", "done", 2),
    ("sales-pipeline-optim", "Training SDR", "in_progress", 2),
    ("sales-pipeline-optim", "A/B test landing page", "open", 1),
    // Hiring Push H1
    ("hiring-push-h1", "Job descriptions", "done", 2),
    ("hiring-push-h1", "Sourcing LinkedIn", "in_progress", 3),
    ("hiring-push-h1", "Interviews Backend Sr", "open", 3),
    ("hiring-push-h1", "Interviews Support L2", "in_progress", 2),
    ("hiring-push-h1", "Offres candidats top 3", "open", 2),
    // Compliance Audit
    ("compliance-audit", "Gap analysis SOC2", "in_progress", 3),
    ("compliance-audit", "Policies vs. controls mapping", "open", 2),
    ("compliance-audit", "Prép. auditeur externe", "open", 3),
    ("compliance-audit", "Inventaire CIs", "done", 2),
    // Performance Review Q2
    ("performance-review-q2", "Template auto-éval", "done", 1),
    ("performance-review-q2", "Planning 1-on-1s", "in_progress", 2),
    ("performance-review-q2", "Calibration managers", "open", 2),
    ("performance-review-q2", "Retours équipes", "open", 2),
    // Office Move
    ("office-move", "Shortlist bureaux", "in_progress", 2),
    ("office-move", "Négocier bail", "open", 3),
    ("office-move", "Plan de câblage", "open", 2),
    ("office-move", "Communication interne", "open", 1),
    // Brand Refresh
    ("brand-refresh", "Moodboard nouveau logo", "done", 2),
    ("brand-refresh", "Brief agence externe", "in_progress", 2),
    ("brand-refresh", "Revue exec", "open", 2),
    ("brand-refresh", "Rollout templates", "open", 2),
    // API v3
    ("api-v3", "Spec OpenAPI 3.1", "in_progress", 3),
    ("api-v3", "Breaking changes doc", "in_progress", 2),
    ("api-v3", "Versioned router", "open", 3),
    ("api-v3", "Migration SDK clients", "open", 3),
    ("api-v3", "Beta tests partenaires", "open", 2),
    ("api-v3", "Deprecation plan v2", "open", 1),
    ("api-v3", "Security review", "open", 3),
    ("api-v3", "Post-launch retro", "open", 1),
];

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

        // 1) Projects ─────────────────────────────────────────────────
        for (slug, name, status, owner_username, cal_slug) in PROJECTS.iter() {
            let pid = acme_uuid("project", slug);
            let owner = ctx
                .user(owner_username)
                .ok_or_else(|| anyhow::anyhow!("owner not registered: {}", owner_username))?;
            let calendar_id = acme_uuid("calendar", cal_slug);

            let res = sqlx::query(
                r#"
                INSERT INTO calendar.projects
                    (id, tenant_id, name, description, status, calendar_id, owner_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (id) DO NOTHING
                "#,
            )
            .bind(pid)
            .bind(ctx.tenant_id)
            .bind(name)
            .bind(format!("Projet démo: {}", name))
            .bind(status)
            .bind(calendar_id)
            .bind(owner)
            .execute(pool)
            .await;
            bump(&mut report, res, "project");
        }

        // 2) Tasks ────────────────────────────────────────────────────
        let n_persons = PERSONS.len();
        for (i, (project_slug, title, status, priority)) in TASKS.iter().enumerate() {
            let tid = acme_uuid("task", &format!("t{}", i));
            let project_id = acme_uuid("project", project_slug);

            // Pick deterministic assignee + creator that differ
            let assigned_to_username = PERSONS[(i * 3 + 1) % n_persons].0;
            let created_by_username = PERSONS[(i * 5) % n_persons].0;
            let assigned_to = ctx
                .user(assigned_to_username)
                .ok_or_else(|| anyhow::anyhow!("assignee not registered: {}", assigned_to_username))?;
            let created_by = ctx
                .user(created_by_username)
                .ok_or_else(|| anyhow::anyhow!("creator not registered: {}", created_by_username))?;

            // Find calendar_id from project
            let project = PROJECTS
                .iter()
                .find(|p| p.0 == *project_slug)
                .ok_or_else(|| anyhow::anyhow!("project not found: {}", project_slug))?;
            let calendar_id = acme_uuid("calendar", project.4);

            let res = sqlx::query(
                r#"
                INSERT INTO calendar.tasks
                    (id, calendar_id, project_id, title, description, status, priority, created_by, assigned_to, tenant_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (id) DO NOTHING
                "#,
            )
            .bind(tid)
            .bind(calendar_id)
            .bind(project_id)
            .bind(title)
            .bind(format!("Tâche démo: {}", title))
            .bind(status)
            .bind(*priority)
            .bind(created_by)
            .bind(assigned_to)
            .bind(ctx.tenant_id)
            .execute(pool)
            .await;
            bump(&mut report, res, "task");
        }

        Ok(report)
    }
}
