//! Document seeding — inserts documents for the Acme Corp scenario.

use tracing::info;
use uuid::Uuid;

/// Seeds Acme Corp documents (wikis, shared files, templates).
///
/// Creates 50 documents in the `documents` table with varied titles, types,
/// and owners drawn from the user list.
///
/// # Errors
///
/// Returns an error if any database operation fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
pub async fn seed_acme(
    pool: &sqlx::PgPool,
    tenant_id: Uuid,
    user_ids: &[(Uuid, Uuid, String)],
) -> Result<(), Box<dyn std::error::Error>> {
    info!(%tenant_id, users = user_ids.len(), "seeding acme documents");

    if user_ids.is_empty() {
        info!("no users available — skipping document seed");
        return Ok(());
    }

    let doc_defs: &[(&str, &str)] = &[
        // (title, doc_type)
        ("Architecture Decision Records", "text"),
        ("Runbook Production", "text"),
        ("Charte Equipe Tech", "text"),
        ("Onboarding Guide", "text"),
        ("API Reference v2", "text"),
        ("Budget Previsionnel 2026", "sheet"),
        ("Suivi KPIs Marketing", "sheet"),
        ("Roadmap Produit Q2 2026", "sheet"),
        ("Analyse Concurrentielle", "sheet"),
        ("Pipeline Recrutement", "sheet"),
        ("Presentation Investisseurs", "slide"),
        ("Demo Produit Client", "slide"),
        ("Formation DevOps - Slides", "slide"),
        ("Bilan Q1 2026", "slide"),
        ("Vision Strategique 2027", "slide"),
        ("Sprint Board - Equipe Core", "board"),
        ("Kanban Support Client", "board"),
        ("Backlog Produit", "board"),
        ("OKRs Company 2026", "board"),
        ("Retrospective Board", "board"),
        ("Wiki Securite", "text"),
        ("Procedures Deploiement", "text"),
        ("Glossaire Metier", "text"),
        ("Politique de Confidentialite", "text"),
        ("Contrat Type Prestataire", "text"),
        ("Modele Facture", "sheet"),
        ("Tracker Bugs Critiques", "sheet"),
        ("Matrice RACI Projets", "sheet"),
        ("Plan de Capacite", "sheet"),
        ("Dashboard Metriques Dev", "sheet"),
        ("Pitch Deck 2026", "slide"),
        ("Formation Nouveaux Employes", "slide"),
        ("Presentation Architecture SI", "slide"),
        ("Revue Annuelle Equipe", "slide"),
        ("Roadshow Commercial", "slide"),
        ("Tableau de Bord Ops", "board"),
        ("Planning Releases", "board"),
        ("Suivi Formation", "board"),
        ("Gestion Incidents", "board"),
        ("Veille Technologique", "board"),
        ("Guide Contribution Open Source", "text"),
        ("Charte Graphique SignApps", "text"),
        ("Plan de Reprise Activite", "text"),
        ("Politique Qualite ISO", "text"),
        ("Regles Conventionnels Commits", "text"),
        ("Projection Croissance 2026-2028", "sheet"),
        ("Analyse Performances Serveurs", "sheet"),
        ("Inventaire Licences Logicielles", "sheet"),
        ("Rapport Audit Securite", "sheet"),
        ("Suivi SLA Clients", "sheet"),
    ];

    // `documents` table requires a non-null `doc_binary` (BYTEA).
    // We store a minimal empty Y.js document state — a single zero byte suffices
    // as a placeholder for seed data.
    let empty_binary: &[u8] = &[0u8];

    let mut doc_count = 0usize;

    for (idx, (title, doc_type)) in doc_defs.iter().enumerate() {
        let doc_id = Uuid::new_v4();
        let owner = user_ids[idx % user_ids.len()].0;

        sqlx::query(
            r#"
            INSERT INTO documents
                (id, name, doc_type, doc_binary, version, created_by, created_at, updated_at)
            VALUES
                ($1, $2, $3, $4, 0, $5, NOW(), NOW())
            ON CONFLICT DO NOTHING
            "#,
        )
        .bind(doc_id)
        .bind(*title)
        .bind(*doc_type)
        .bind(empty_binary)
        .bind(owner)
        .execute(pool)
        .await?;

        doc_count += 1;
    }

    info!(documents = doc_count, "documents created");

    Ok(())
}
