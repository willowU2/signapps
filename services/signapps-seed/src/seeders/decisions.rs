//! SO2 board decisions + votes seeder.
//!
//! Crée 4 décisions démo sur le board du root Nexus Industries
//! (2 approved, 1 rejected, 1 deferred) avec 3 votes chacun (12 au
//! total) répartis entre les personnes direction.
//!
//! Si aucun board n'existe encore sur le root, il en crée un via
//! `INSERT INTO org_boards (node_id) VALUES (...)` (idempotent).
//!
//! Dépend de `OrgSeeder` (persons) + `FocusNodesSeeder` pour avoir les
//! slugs root correctement enregistrés.

use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::seeders::org::bump;
use crate::uuid::acme_uuid;
use async_trait::async_trait;
use chrono::Duration;
use uuid::Uuid;

/// (slug, title, description, status).
type DecisionSpec = (&'static str, &'static str, &'static str, &'static str);

const DECISIONS: &[DecisionSpec] = &[
    (
        "hire-3-sre-q2",
        "Recrutement de 3 SRE pour Q2 2026",
        "Validation du plan de recrutement SRE pour absorber la charge liée à Project Titan. Budget 240k€/an.",
        "approved",
    ),
    (
        "adopt-pgvector",
        "Adoption de pgvector comme moteur vectoriel unique",
        "Remplacer Qdrant par pgvector pour simplifier l'infra. Validation par l'équipe AI.",
        "approved",
    ),
    (
        "reject-saas-crm",
        "Passage à un CRM SaaS externe",
        "Refus — le CRM interne répond aux besoins et évite la dépendance à un fournisseur tiers.",
        "rejected",
    ),
    (
        "defer-office-move",
        "Déménagement siège Q3 2026",
        "Décision reportée à Q4 pour finaliser l'étude d'impact avec la CSR committee.",
        "deferred",
    ),
];

/// (decision_slug, voter_username, vote, rationale).
type VoteSpec = (&'static str, &'static str, &'static str, &'static str);

const VOTES: &[VoteSpec] = &[
    // ── hire-3-sre-q2 (approved) ─────────────────────────────────────
    ("hire-3-sre-q2", "marie.dupont", "for", "Critique pour Titan"),
    ("hire-3-sre-q2", "jean.martin", "for", "Alignement engineering"),
    ("hire-3-sre-q2", "paul.durand", "for", "Budget approuvé"),
    // ── adopt-pgvector (approved) ────────────────────────────────────
    ("adopt-pgvector", "jean.martin", "for", "Simplification infra"),
    ("adopt-pgvector", "agnes.perrin", "for", "Moins de vendors"),
    ("adopt-pgvector", "marie.dupont", "abstain", "Neutre technique"),
    // ── reject-saas-crm (rejected) ───────────────────────────────────
    (
        "reject-saas-crm",
        "victor.leblanc",
        "against",
        "Le CRM interne suffit",
    ),
    (
        "reject-saas-crm",
        "paul.durand",
        "against",
        "Coût annuel prohibitif",
    ),
    (
        "reject-saas-crm",
        "marie.dupont",
        "against",
        "Dépendance fournisseur",
    ),
    // ── defer-office-move (deferred) ─────────────────────────────────
    (
        "defer-office-move",
        "agnes.perrin",
        "abstain",
        "Besoin données CSR",
    ),
    (
        "defer-office-move",
        "paul.durand",
        "abstain",
        "Budget non verrouillé",
    ),
    (
        "defer-office-move",
        "claire.moreau",
        "for",
        "Pour si étude favorable",
    ),
];

/// Seeds 4 demo decisions + 12 votes on the root Nexus board.
pub struct DecisionsSeeder;

#[async_trait]
impl Seeder for DecisionsSeeder {
    fn name(&self) -> &'static str {
        "decisions"
    }

    fn dependencies(&self) -> Vec<&'static str> {
        vec!["org"]
    }

    async fn run(&self, ctx: &SeedContext) -> anyhow::Result<SeedReport> {
        let mut report = SeedReport::default();
        let pool = ctx.db.inner();

        // 1. Resolve root node. Falls back to a DB lookup when the
        //    seeder is invoked with `--only decisions` (context empty).
        let root_id = match resolve_root_id(ctx).await {
            Some(id) => id,
            None => {
                report
                    .errors
                    .push("root node not found for tenant".into());
                return Ok(report);
            },
        };

        // 2. Ensure a board exists for the root node (idempotent).
        let board_id = acme_uuid("org-board", "nexus-root");
        let res = sqlx::query(
            r#"
            INSERT INTO org_boards (id, node_id)
            VALUES ($1, $2)
            ON CONFLICT (node_id) DO UPDATE SET node_id = EXCLUDED.node_id
            RETURNING id
            "#,
        )
        .bind(board_id)
        .bind(root_id)
        .execute(pool)
        .await;
        bump(&mut report, res, "board-nexus-root");

        // The board may have an id different from `acme_uuid` if a
        // previous run created it with a random UUID — re-read it.
        let board_id: Uuid = match sqlx::query_scalar("SELECT id FROM org_boards WHERE node_id = $1")
            .bind(root_id)
            .fetch_one(pool)
            .await
        {
            Ok(id) => id,
            Err(e) => {
                report
                    .errors
                    .push(format!("read board id for root: {e}"));
                return Ok(report);
            },
        };

        let now = chrono::Utc::now();

        // 3. Insert 4 decisions — `decided_at` stamped for closed ones.
        for (slug, title, description, status) in DECISIONS {
            let id = acme_uuid("org-decision", slug);
            // Deterministic decider: the first voter for the decision.
            let decided_by_username = VOTES
                .iter()
                .find(|(s, _, _, _)| *s == *slug)
                .map(|(_, u, _, _)| *u);
            let decided_by = decided_by_username.map(|u| acme_uuid("person", u));
            let (decided_at, decided_at_is_some) = match *status {
                "proposed" => (None, false),
                _ => (Some(now - Duration::days(3)), true),
            };
            let decided_by_for_db = if decided_at_is_some { decided_by } else { None };

            let res = sqlx::query(
                r#"
                INSERT INTO org_board_decisions
                    (id, tenant_id, board_id, title, description, status, decided_at,
                     decided_by_person_id, attributes)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '{}'::jsonb)
                ON CONFLICT (id) DO UPDATE SET
                    title = EXCLUDED.title,
                    description = EXCLUDED.description,
                    status = EXCLUDED.status,
                    decided_at = EXCLUDED.decided_at,
                    decided_by_person_id = EXCLUDED.decided_by_person_id,
                    updated_at = now()
                "#,
            )
            .bind(id)
            .bind(ctx.tenant_id)
            .bind(board_id)
            .bind(title)
            .bind(description)
            .bind(status)
            .bind(decided_at)
            .bind(decided_by_for_db)
            .execute(pool)
            .await;
            bump(&mut report, res, "decision");
        }

        // 4. Insert 12 votes (upsert on unique (decision_id, person_id)).
        for (decision_slug, username, vote, rationale) in VOTES {
            let decision_id = acme_uuid("org-decision", decision_slug);
            let person_id = acme_uuid("person", username);
            let vote_id = acme_uuid("org-vote", &format!("{decision_slug}-{username}"));
            let res = sqlx::query(
                r#"
                INSERT INTO org_board_votes
                    (id, tenant_id, decision_id, person_id, vote, rationale)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (decision_id, person_id) DO UPDATE SET
                    vote = EXCLUDED.vote,
                    rationale = EXCLUDED.rationale,
                    voted_at = now()
                "#,
            )
            .bind(vote_id)
            .bind(ctx.tenant_id)
            .bind(decision_id)
            .bind(person_id)
            .bind(vote)
            .bind(rationale)
            .execute(pool)
            .await;
            bump(&mut report, res, "board-vote");
        }

        Ok(report)
    }
}

/// Look up the root node for a tenant (parent_id IS NULL). Used as a
/// fallback when the seeder runs alone and `SeedContext::node("root")`
/// is empty.
async fn resolve_root_id(ctx: &SeedContext) -> Option<Uuid> {
    if let Some(id) = ctx.node("root") {
        return Some(id);
    }
    let pool = ctx.db.inner();
    sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM org_nodes
         WHERE tenant_id = $1 AND parent_id IS NULL
         ORDER BY created_at
         LIMIT 1",
    )
    .bind(ctx.tenant_id)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()
}
