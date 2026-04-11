//! Drive VFS seeding — inserts folders, files, and ACLs.
//!
//! Tables: `drive.nodes` and `drive.permissions` (using user-level grants).
//! Note: The actual ACL schema uses `drive.permissions`, not `drive.acl`.

use rand::Rng;
use tracing::info;
use uuid::Uuid;

/// Seeds Acme Corp drive (5 root folders, subfolders, ~100 files, permissions).
///
/// Creates folders and files in `drive.nodes` and grants in `drive.permissions`.
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
    _tenant_id: Uuid,
    user_ids: &[(Uuid, Uuid, String)],
) -> Result<(), Box<dyn std::error::Error>> {
    info!(users = user_ids.len(), "seeding acme drive");

    if user_ids.is_empty() {
        info!("no users — skipping acme drive seed");
        return Ok(());
    }

    let mut rng = rand::thread_rng();

    // ── 5 root folders ─────────────────────────────────────────────────────
    let root_folder_defs: &[(&str, usize)] = &[
        ("Projets", 0),
        ("Ressources Humaines", 1),
        ("Finance", 2),
        ("Communication", 3),
        ("Technique", 4),
    ];

    let mut all_folder_ids: Vec<Uuid> = Vec::new();

    for &(folder_name, owner_idx) in root_folder_defs {
        let owner = crate::helpers::pick(user_ids, owner_idx).0;
        let folder_id = insert_folder(pool, None, folder_name, owner).await?;
        all_folder_ids.push(folder_id);

        // ── 2–3 subfolders per root folder ────────────────────────────────
        let subfolder_count = 2 + (owner_idx % 2);
        for sub_idx in 0..subfolder_count {
            let sub_name = format!("Sous-dossier {} — {}", folder_name, sub_idx + 1);
            let sub_owner = crate::helpers::pick(user_ids, rng.gen_range(0..user_ids.len())).0;
            let sub_id = insert_folder(pool, Some(folder_id), &sub_name, sub_owner).await?;
            all_folder_ids.push(sub_id);
        }
    }
    info!(count = all_folder_ids.len(), "folders created");

    // ── ~100 files distributed across folders ─────────────────────────────
    let file_names: &[&str] = &[
        "Rapport annuel 2025.pdf",
        "Budget prévisionnel Q1.xlsx",
        "Présentation direction.pptx",
        "Spécifications techniques v2.docx",
        "Contrat prestataire.pdf",
        "Manuel utilisateur.pdf",
        "Fiche de paie modèle.docx",
        "Plan projet détaillé.xlsx",
        "Procédure onboarding.docx",
        "Charte graphique.pdf",
        "Base de données contacts.csv",
        "Politique sécurité.docx",
        "Audit qualité.xlsx",
        "Roadmap produit 2026.pptx",
        "Compte rendu réunion.docx",
        "Grille tarifaire.xlsx",
        "Architecture système.pdf",
        "Guide déploiement.md",
        "Notes de version.txt",
        "Organigramme.png",
    ];

    let mime_types: &[&str] = &[
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
        "text/markdown",
        "image/png",
        "text/csv",
    ];

    let mut file_ids: Vec<(Uuid, Uuid)> = Vec::new(); // (file_id, owner_id)

    for i in 0..100usize {
        let parent_folder = *crate::helpers::pick(&all_folder_ids, i);
        let owner = crate::helpers::pick(user_ids, rng.gen_range(0..user_ids.len())).0;
        let file_name = format!(
            "{} ({})",
            crate::helpers::pick(file_names, i),
            i + 1
        );
        let mime = *crate::helpers::pick(mime_types, i);
        let size: i64 = rng.gen_range(1024i64..10_485_760); // 1 KB – 10 MB

        let file_id = insert_file(pool, Some(parent_folder), &file_name, owner, size, mime).await?;
        file_ids.push((file_id, owner));
    }
    info!(count = file_ids.len(), "files created");

    // ── ACLs: grant viewer/editor on ~40 files ────────────────────────────
    let roles = ["viewer", "editor", "manager"];
    for (i, &(file_id, granted_by)) in file_ids.iter().enumerate().take(40) {
        let grantee = crate::helpers::pick(user_ids, rng.gen_range(0..user_ids.len())).0;
        if grantee == granted_by {
            continue;
        }
        let role = crate::helpers::pick(&roles, i);
        insert_permission(pool, file_id, grantee, role, granted_by).await?;
    }

    // ── Folder permissions ─────────────────────────────────────────────────
    for (i, &folder_id) in all_folder_ids.iter().enumerate().take(5) {
        let grantee = crate::helpers::pick(user_ids, rng.gen_range(0..user_ids.len())).0;
        let granted_by = crate::helpers::pick(user_ids, 0).0;
        let role = crate::helpers::pick(&roles, i);
        insert_permission(pool, folder_id, grantee, role, granted_by).await?;
    }
    info!("drive ACLs created");

    Ok(())
}

/// Seeds Startup SAS drive (3 folders, 15 files).
///
/// # Errors
///
/// Returns an error if any database operation fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
pub async fn seed_startup(
    pool: &sqlx::PgPool,
    _tenant_id: Uuid,
    user_ids: &[(Uuid, Uuid, String)],
) -> Result<(), Box<dyn std::error::Error>> {
    info!(users = user_ids.len(), "seeding startup drive");

    if user_ids.is_empty() {
        info!("no users — skipping startup drive seed");
        return Ok(());
    }

    let mut rng = rand::thread_rng();

    let folder_defs: &[(&str, usize)] = &[
        ("Documents Startup", 0),
        ("Développement", 0),
        ("Administratif", 1),
    ];

    let mut folder_ids: Vec<Uuid> = Vec::new();
    for &(name, owner_idx) in folder_defs {
        let owner = crate::helpers::pick(user_ids, owner_idx).0;
        let fid = insert_folder(pool, None, name, owner).await?;
        folder_ids.push(fid);
    }

    let file_names = [
        "Business Plan.pdf",
        "Pitch Deck.pptx",
        "Statuts société.pdf",
        "Contrat fondateurs.pdf",
        "Roadmap technique.docx",
        "Architecture v1.pdf",
        "Design system.figma",
        "Budget annuel.xlsx",
        "Plan recrutement.docx",
        "Procès-verbal AG.pdf",
        "Conditions générales.pdf",
        "Convention de cession.pdf",
        "Charte équipe.docx",
        "Guide contribution.md",
        "Glossaire produit.docx",
    ];

    for (i, name) in file_names.iter().enumerate() {
        let parent = *crate::helpers::pick(&folder_ids, i);
        let owner = crate::helpers::pick(user_ids, rng.gen_range(0..user_ids.len())).0;
        let size: i64 = rng.gen_range(512i64..2_097_152);
        insert_file(pool, Some(parent), name, owner, size, "application/pdf").await?;
    }
    info!(count = file_names.len(), "startup drive files created");

    Ok(())
}

// ── Private helpers ───────────────────────────────────────────────────────────

async fn insert_folder(
    pool: &sqlx::PgPool,
    parent_id: Option<Uuid>,
    name: &str,
    owner_id: Uuid,
) -> Result<Uuid, Box<dyn std::error::Error>> {
    let id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO drive.nodes
            (id, parent_id, name, node_type, owner_id, size, created_at, updated_at)
        VALUES ($1, $2, $3, 'folder'::drive.node_type, $4, 0, NOW(), NOW())
        ON CONFLICT DO NOTHING
        "#,
    )
    .bind(id)
    .bind(parent_id)
    .bind(name)
    .bind(owner_id)
    .execute(pool)
    .await?;
    Ok(id)
}

async fn insert_file(
    pool: &sqlx::PgPool,
    parent_id: Option<Uuid>,
    name: &str,
    owner_id: Uuid,
    size: i64,
    mime_type: &str,
) -> Result<Uuid, Box<dyn std::error::Error>> {
    let id = Uuid::new_v4();
    // Files require a target_id (non-NULL constraint). We use a generated UUID
    // to represent the storage object reference.
    let target_id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO drive.nodes
            (id, parent_id, name, node_type, target_id, owner_id, size, mime_type, created_at, updated_at)
        VALUES ($1, $2, $3, 'file'::drive.node_type, $4, $5, $6, $7, NOW(), NOW())
        ON CONFLICT DO NOTHING
        "#,
    )
    .bind(id)
    .bind(parent_id)
    .bind(name)
    .bind(target_id)
    .bind(owner_id)
    .bind(size)
    .bind(mime_type)
    .execute(pool)
    .await?;
    Ok(id)
}

async fn insert_permission(
    pool: &sqlx::PgPool,
    node_id: Uuid,
    user_id: Uuid,
    role: &str,
    granted_by: Uuid,
) -> Result<(), Box<dyn std::error::Error>> {
    let id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO drive.permissions
            (id, node_id, user_id, role, granted_by, created_at, updated_at)
        VALUES ($1, $2, $3, $4::drive.permission_role, $5, NOW(), NOW())
        ON CONFLICT DO NOTHING
        "#,
    )
    .bind(id)
    .bind(node_id)
    .bind(user_id)
    .bind(role)
    .bind(granted_by)
    .execute(pool)
    .await?;
    Ok(())
}
