//! SO3 skills catalog + person-skills seeder.
//!
//! Seed 40 skills globaux (tenant_id NULL) et tag 30 persons Nexus
//! avec 3-5 skills chacune. Deterministic via `acme_uuid` →
//! idempotent multi-runs.

use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::uuid::acme_uuid;
use async_trait::async_trait;

/// (slug, name, category).
type SkillSpec = (&'static str, &'static str, &'static str);

/// 40 skills globaux (tech 18, soft 8, language 6, domain 8).
const SKILLS: &[SkillSpec] = &[
    // ── Tech (18) ─────────────────────────────────────────────────
    ("python", "Python", "tech"),
    ("rust", "Rust", "tech"),
    ("typescript", "TypeScript", "tech"),
    ("javascript", "JavaScript", "tech"),
    ("react", "React", "tech"),
    ("nextjs", "Next.js", "tech"),
    ("nodejs", "Node.js", "tech"),
    ("go", "Go", "tech"),
    ("java", "Java", "tech"),
    ("kubernetes", "Kubernetes", "tech"),
    ("docker", "Docker", "tech"),
    ("aws", "AWS", "tech"),
    ("gcp", "Google Cloud", "tech"),
    ("postgresql", "PostgreSQL", "tech"),
    ("redis", "Redis", "tech"),
    ("terraform", "Terraform", "tech"),
    ("ansible", "Ansible", "tech"),
    ("ci_cd", "CI/CD", "tech"),
    // ── Soft (8) ──────────────────────────────────────────────────
    ("leadership", "Leadership", "soft"),
    ("communication", "Communication", "soft"),
    ("mentoring", "Mentoring", "soft"),
    ("project_management", "Project Management", "soft"),
    ("public_speaking", "Public Speaking", "soft"),
    ("conflict_resolution", "Conflict Resolution", "soft"),
    ("strategic_thinking", "Strategic Thinking", "soft"),
    ("teamwork", "Teamwork", "soft"),
    // ── Language (6) ──────────────────────────────────────────────
    ("english", "English", "language"),
    ("french", "Français", "language"),
    ("german", "Deutsch", "language"),
    ("spanish", "Español", "language"),
    ("italian", "Italiano", "language"),
    ("mandarin", "中文", "language"),
    // ── Domain (8) ────────────────────────────────────────────────
    ("saas", "SaaS", "domain"),
    ("fintech", "FinTech", "domain"),
    ("healthcare", "Healthcare", "domain"),
    ("ecommerce", "E-commerce", "domain"),
    ("industrial", "Industrial", "domain"),
    ("edtech", "EdTech", "domain"),
    ("logistics", "Logistics", "domain"),
    ("cybersecurity", "Cybersecurity", "domain"),
];

/// Person-skill assignments for 30 Nexus persons — each has 3-5 skills.
/// Format: (username, skill_slug, level 1-5).
type PersonSkill = (&'static str, &'static str, i16);

const PERSON_SKILLS: &[PersonSkill] = &[
    // CEO Marie — leadership + strategy
    ("marie.dupont", "leadership", 5),
    ("marie.dupont", "strategic_thinking", 5),
    ("marie.dupont", "public_speaking", 5),
    ("marie.dupont", "english", 5),
    ("marie.dupont", "french", 5),
    // CTO Jean — tech + mentoring
    ("jean.martin", "rust", 5),
    ("jean.martin", "python", 4),
    ("jean.martin", "aws", 4),
    ("jean.martin", "leadership", 4),
    ("jean.martin", "mentoring", 5),
    // CFO Paul — domain + language
    ("paul.durand", "fintech", 5),
    ("paul.durand", "strategic_thinking", 4),
    ("paul.durand", "english", 4),
    ("paul.durand", "french", 5),
    // CHRO Claire
    ("claire.moreau", "communication", 5),
    ("claire.moreau", "conflict_resolution", 5),
    ("claire.moreau", "english", 4),
    ("claire.moreau", "french", 5),
    // CMO Victor
    ("victor.leblanc", "saas", 4),
    ("victor.leblanc", "strategic_thinking", 4),
    ("victor.leblanc", "english", 5),
    ("victor.leblanc", "public_speaking", 4),
    // Platform Lead Sophie
    ("sophie.leroy", "rust", 5),
    ("sophie.leroy", "kubernetes", 5),
    ("sophie.leroy", "aws", 4),
    ("sophie.leroy", "docker", 5),
    ("sophie.leroy", "leadership", 4),
    // Senior Platform Thomas
    ("thomas.petit", "rust", 4),
    ("thomas.petit", "postgresql", 5),
    ("thomas.petit", "kubernetes", 4),
    ("thomas.petit", "terraform", 4),
    // DevOps Julie
    ("julie.bernard", "docker", 5),
    ("julie.bernard", "kubernetes", 4),
    ("julie.bernard", "ci_cd", 5),
    ("julie.bernard", "ansible", 4),
    // SRE Marc
    ("marc.fontaine", "kubernetes", 5),
    ("marc.fontaine", "terraform", 5),
    ("marc.fontaine", "aws", 4),
    ("marc.fontaine", "ci_cd", 4),
    // Backend Leo
    ("leo.garnier", "rust", 4),
    ("leo.garnier", "go", 4),
    ("leo.garnier", "postgresql", 4),
    // Frontend Lead Emma
    ("emma.rousseau", "typescript", 5),
    ("emma.rousseau", "react", 5),
    ("emma.rousseau", "nextjs", 5),
    ("emma.rousseau", "leadership", 4),
    // Senior Frontend Lucas
    ("lucas.fournier", "typescript", 4),
    ("lucas.fournier", "react", 5),
    ("lucas.fournier", "nextjs", 4),
    // Frontend Chloe
    ("chloe.henry", "javascript", 4),
    ("chloe.henry", "react", 4),
    ("chloe.henry", "typescript", 3),
    // AI Lead Raphael
    ("raphael.benoit", "python", 5),
    ("raphael.benoit", "leadership", 4),
    ("raphael.benoit", "mentoring", 4),
    // ML Engineer Zoe
    ("zoe.marchand", "python", 5),
    ("zoe.marchand", "saas", 3),
    // ML Engineer Sacha
    ("sacha.riviere", "python", 4),
    ("sacha.riviere", "docker", 3),
    ("sacha.riviere", "aws", 3),
    // Data Scientist Ines
    ("ines.bourdon", "python", 4),
    ("ines.bourdon", "postgresql", 4),
    // Sales EMEA Nicolas
    ("nicolas.robert", "english", 5),
    ("nicolas.robert", "french", 5),
    ("nicolas.robert", "saas", 4),
    ("nicolas.robert", "leadership", 4),
    // Account Manager Anne
    ("anne.girard", "communication", 4),
    ("anne.girard", "english", 4),
    ("anne.girard", "french", 5),
    // Business Dev Pierre
    ("pierre.lefebvre", "communication", 4),
    ("pierre.lefebvre", "english", 4),
    ("pierre.lefebvre", "strategic_thinking", 3),
    // SDR Camille
    ("camille.mercier", "communication", 3),
    ("camille.mercier", "english", 3),
    ("camille.mercier", "french", 5),
    // Theo
    ("theo.brunet", "english", 3),
    ("theo.brunet", "french", 5),
    ("theo.brunet", "saas", 3),
    // Sarah
    ("sarah.lopez", "english", 4),
    ("sarah.lopez", "spanish", 5),
    ("sarah.lopez", "french", 4),
    // Sales Americas Michael
    ("michael.thompson", "english", 5),
    ("michael.thompson", "leadership", 4),
    ("michael.thompson", "saas", 4),
    // Jessica
    ("jessica.nguyen", "english", 5),
    ("jessica.nguyen", "communication", 4),
    // Support agents — generic
    ("emma.rousseau", "communication", 4),
    // COO Agnes
    ("agnes.perrin", "leadership", 5),
    ("agnes.perrin", "project_management", 5),
    ("agnes.perrin", "english", 4),
    ("agnes.perrin", "french", 5),
    // Olivia backend
    ("olivia.faure", "rust", 4),
    ("olivia.faure", "python", 3),
    ("olivia.faure", "postgresql", 3),
    // Noah ML
    ("noah.simon", "python", 4),
    ("noah.simon", "docker", 3),
    // Adam Research
    ("adam.bertrand", "python", 4),
    ("adam.bertrand", "english", 4),
    // Lea MLOps
    ("lea.perez", "python", 4),
    ("lea.perez", "ci_cd", 4),
    ("lea.perez", "docker", 4),
];

/// Seeds 40 skills + ~130 person-skill rows.
pub struct SkillsSeeder;

#[async_trait]
impl Seeder for SkillsSeeder {
    fn name(&self) -> &'static str {
        "skills"
    }

    fn dependencies(&self) -> Vec<&'static str> {
        vec!["org"]
    }

    async fn run(&self, ctx: &SeedContext) -> anyhow::Result<SeedReport> {
        let mut report = SeedReport::default();
        let pool = ctx.db.inner();

        // 1) Skills catalog — global skills (tenant_id NULL, deterministic UUIDs).
        for (slug, name, category) in SKILLS {
            let id = acme_uuid("org-skill", slug);
            let res = sqlx::query(
                r#"
                INSERT INTO org_skills (id, tenant_id, slug, name, category)
                VALUES ($1, NULL, $2, $3, $4)
                ON CONFLICT (tenant_id, slug) DO UPDATE SET
                    name     = EXCLUDED.name,
                    category = EXCLUDED.category
                "#,
            )
            .bind(id)
            .bind(slug)
            .bind(name)
            .bind(category)
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
                Err(e) => report.errors.push(format!("skill {slug}: {e}")),
            }
        }

        // 2) Person-skills tags.
        for (username, skill_slug, level) in PERSON_SKILLS {
            let person_id = acme_uuid("person", username);
            let skill_id = acme_uuid("org-skill", skill_slug);

            let res = sqlx::query(
                r#"
                INSERT INTO org_person_skills (person_id, skill_id, level)
                VALUES ($1, $2, $3)
                ON CONFLICT (person_id, skill_id) DO UPDATE SET
                    level = EXCLUDED.level
                "#,
            )
            .bind(person_id)
            .bind(skill_id)
            .bind(*level)
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
                Err(e) => report
                    .errors
                    .push(format!("person_skill {username}/{skill_slug}: {e}")),
            }
        }

        Ok(report)
    }
}
