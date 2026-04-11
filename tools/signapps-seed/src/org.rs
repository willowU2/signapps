//! Organisational structure seeding — inserts nodes into `core.org_trees`,
//! `core.org_nodes`, `core.org_closure`, and `core.assignments`.
//!
//! The closure table is auto-populated by the `trg_org_nodes_closure` trigger
//! defined in migration 122.  We therefore only insert `core.org_nodes` rows;
//! the trigger handles all ancestor/descendant pairs.  A defensive explicit
//! insert is included in `seed_closure_for_node` for environments where the
//! trigger may not yet be present.

use tracing::info;
use uuid::Uuid;

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Inserts a single `core.org_nodes` row and returns its UUID.
///
/// Uses `ON CONFLICT DO NOTHING` for idempotency.
async fn insert_node(
    pool: &sqlx::PgPool,
    tree_id: Uuid,
    parent_id: Option<Uuid>,
    node_type: &str,
    name: &str,
    code: &str,
    sort_order: i32,
) -> Result<Uuid, Box<dyn std::error::Error>> {
    let node_id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO core.org_nodes
            (id, tree_id, parent_id, node_type, name, code, sort_order,
             is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, NOW(), NOW())
        ON CONFLICT DO NOTHING
        "#,
    )
    .bind(node_id)
    .bind(tree_id)
    .bind(parent_id)
    .bind(node_type)
    .bind(name)
    .bind(code)
    .bind(sort_order)
    .execute(pool)
    .await?;

    Ok(node_id)
}

/// Mirrors a node into `workforce_org_nodes` using the same UUID.
///
/// The `trg_workforce_org_node_insert_closure` trigger automatically populates
/// `workforce_org_closure` on each INSERT, so no explicit closure insert is
/// needed here.
///
/// Uses `ON CONFLICT (id) DO NOTHING` for idempotency.
pub async fn mirror_to_workforce(
    pool: &sqlx::PgPool,
    node_id: Uuid,
    tenant_id: Uuid,
    parent_id: Option<Uuid>,
    node_type: &str,
    name: &str,
    sort_order: i32,
) -> Result<(), Box<dyn std::error::Error>> {
    sqlx::query(
        r#"INSERT INTO workforce_org_nodes
            (id, tenant_id, parent_id, node_type, name, sort_order, is_active,
             lifecycle_state, attributes, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, TRUE, 'live', '{}', NOW(), NOW())
           ON CONFLICT (id) DO NOTHING"#,
    )
    .bind(node_id)
    .bind(tenant_id)
    .bind(parent_id)
    .bind(node_type)
    .bind(name)
    .bind(sort_order)
    .execute(pool)
    .await?;
    Ok(())
}

/// Assigns a person to an org node.
///
/// Uses `ON CONFLICT DO NOTHING` — safe to call multiple times.
async fn assign_person(
    pool: &sqlx::PgPool,
    person_id: Uuid,
    node_id: Uuid,
    assignment_type: &str,
    responsibility_type: &str,
    is_primary: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    let assignment_id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO core.assignments
            (id, person_id, node_id, assignment_type, responsibility_type,
             start_date, is_primary, created_at, updated_at)
        VALUES ($1, $2, $3, $4::core.assignment_type, $5::core.responsibility_type,
                CURRENT_DATE, $6, NOW(), NOW())
        ON CONFLICT DO NOTHING
        "#,
    )
    .bind(assignment_id)
    .bind(person_id)
    .bind(node_id)
    .bind(assignment_type)
    .bind(responsibility_type)
    .bind(is_primary)
    .execute(pool)
    .await?;

    Ok(())
}

// ── Public API ────────────────────────────────────────────────────────────────

/// Seeds Acme Corp org structure (5-level hierarchy, 80 employees).
///
/// Hierarchy levels:
/// 1. **Company** — Acme Corp (root node)
/// 2. **Direction** — 4 directions (DGA, Ops, Finance, Tech)
/// 3. **Department** — 12 departments distributed across directions
/// 4. **Team** — sub-teams within departments
/// 5. **Positions** are represented by assignments on team nodes
///
/// `user_ids` is the slice returned by [`crate::users::seed_acme`], containing
/// `(user_id, person_id, role_name)` triples in the same order as the user
/// definitions in that module.
///
/// The closure table is populated automatically by the DB trigger.
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
    info!(%tenant_id, users = user_ids.len(), "seeding acme org structure");

    // ── 1. Org tree ───────────────────────────────────────────────────────────
    let tree_id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO core.org_trees
            (id, tenant_id, tree_type, name, created_at, updated_at)
        VALUES ($1, $2, 'internal', 'Acme Corp', NOW(), NOW())
        ON CONFLICT (tenant_id, tree_type) DO NOTHING
        "#,
    )
    .bind(tree_id)
    .bind(tenant_id)
    .execute(pool)
    .await?;
    info!(tree_id = %tree_id, "org tree created");

    // ── 2. Root node: Company ─────────────────────────────────────────────────
    let company_node = insert_node(pool, tree_id, None, "company", "Acme Corp", "ACME", 0).await?;
    mirror_to_workforce(pool, company_node, tenant_id, None, "company", "Acme Corp", 0).await?;

    // ── 3. Direction level ────────────────────────────────────────────────────
    let dir_dga =
        insert_node(pool, tree_id, Some(company_node), "department", "Direction Générale Adjointe", "DGA", 0).await?;
    mirror_to_workforce(pool, dir_dga, tenant_id, Some(company_node), "department", "Direction Générale Adjointe", 0).await?;
    let dir_ops =
        insert_node(pool, tree_id, Some(company_node), "department", "Direction des Opérations", "DIR-OPS", 1).await?;
    mirror_to_workforce(pool, dir_ops, tenant_id, Some(company_node), "department", "Direction des Opérations", 1).await?;
    let dir_fin =
        insert_node(pool, tree_id, Some(company_node), "department", "Direction Financière", "DIR-FIN", 2).await?;
    mirror_to_workforce(pool, dir_fin, tenant_id, Some(company_node), "department", "Direction Financière", 2).await?;
    let dir_tech =
        insert_node(pool, tree_id, Some(company_node), "department", "Direction Technique", "DIR-TECH", 3).await?;
    mirror_to_workforce(pool, dir_tech, tenant_id, Some(company_node), "department", "Direction Technique", 3).await?;

    // ── 4. Department level ───────────────────────────────────────────────────

    // Under DGA
    let dept_hr =
        insert_node(pool, tree_id, Some(dir_dga), "department", "Ressources Humaines", "DEPT-RH", 0).await?;
    mirror_to_workforce(pool, dept_hr, tenant_id, Some(dir_dga), "department", "Ressources Humaines", 0).await?;
    let dept_comm =
        insert_node(pool, tree_id, Some(dir_dga), "department", "Communication", "DEPT-COM", 1).await?;
    mirror_to_workforce(pool, dept_comm, tenant_id, Some(dir_dga), "department", "Communication", 1).await?;
    let dept_legal =
        insert_node(pool, tree_id, Some(dir_dga), "department", "Juridique", "DEPT-JUR", 2).await?;
    mirror_to_workforce(pool, dept_legal, tenant_id, Some(dir_dga), "department", "Juridique", 2).await?;

    // Under Ops
    let dept_logistic =
        insert_node(pool, tree_id, Some(dir_ops), "department", "Logistique", "DEPT-LOG", 0).await?;
    mirror_to_workforce(pool, dept_logistic, tenant_id, Some(dir_ops), "department", "Logistique", 0).await?;
    let dept_purchasing =
        insert_node(pool, tree_id, Some(dir_ops), "department", "Achats", "DEPT-ACH", 1).await?;
    mirror_to_workforce(pool, dept_purchasing, tenant_id, Some(dir_ops), "department", "Achats", 1).await?;
    let dept_quality =
        insert_node(pool, tree_id, Some(dir_ops), "department", "Qualité", "DEPT-QUA", 2).await?;
    mirror_to_workforce(pool, dept_quality, tenant_id, Some(dir_ops), "department", "Qualité", 2).await?;

    // Under Finance
    let dept_accounting =
        insert_node(pool, tree_id, Some(dir_fin), "department", "Comptabilité", "DEPT-CPT", 0).await?;
    mirror_to_workforce(pool, dept_accounting, tenant_id, Some(dir_fin), "department", "Comptabilité", 0).await?;
    let dept_sales =
        insert_node(pool, tree_id, Some(dir_fin), "department", "Commercial", "DEPT-COM-V", 1).await?;
    mirror_to_workforce(pool, dept_sales, tenant_id, Some(dir_fin), "department", "Commercial", 1).await?;
    let dept_marketing =
        insert_node(pool, tree_id, Some(dir_fin), "department", "Marketing", "DEPT-MKT", 2).await?;
    mirror_to_workforce(pool, dept_marketing, tenant_id, Some(dir_fin), "department", "Marketing", 2).await?;

    // Under Tech
    let dept_dev =
        insert_node(pool, tree_id, Some(dir_tech), "department", "Développement", "DEPT-DEV", 0).await?;
    mirror_to_workforce(pool, dept_dev, tenant_id, Some(dir_tech), "department", "Développement", 0).await?;
    let dept_it =
        insert_node(pool, tree_id, Some(dir_tech), "department", "Infrastructure IT", "DEPT-IT", 1).await?;
    mirror_to_workforce(pool, dept_it, tenant_id, Some(dir_tech), "department", "Infrastructure IT", 1).await?;
    let dept_security =
        insert_node(pool, tree_id, Some(dir_tech), "department", "Sécurité", "DEPT-SEC", 2).await?;
    mirror_to_workforce(pool, dept_security, tenant_id, Some(dir_tech), "department", "Sécurité", 2).await?;

    // ── 5. Team level ─────────────────────────────────────────────────────────

    // Dev teams
    let team_backend = insert_node(
        pool, tree_id, Some(dept_dev), "team", "Backend", "TEAM-BE", 0,
    ).await?;
    mirror_to_workforce(pool, team_backend, tenant_id, Some(dept_dev), "team", "Backend", 0).await?;
    let team_frontend = insert_node(
        pool, tree_id, Some(dept_dev), "team", "Frontend", "TEAM-FE", 1,
    ).await?;
    mirror_to_workforce(pool, team_frontend, tenant_id, Some(dept_dev), "team", "Frontend", 1).await?;
    let team_devops = insert_node(
        pool, tree_id, Some(dept_dev), "team", "DevOps & Cloud", "TEAM-DO", 2,
    ).await?;
    mirror_to_workforce(pool, team_devops, tenant_id, Some(dept_dev), "team", "DevOps & Cloud", 2).await?;
    let team_qa = insert_node(
        pool, tree_id, Some(dept_dev), "team", "Qualité Logicielle", "TEAM-QA", 3,
    ).await?;
    mirror_to_workforce(pool, team_qa, tenant_id, Some(dept_dev), "team", "Qualité Logicielle", 3).await?;
    let team_data = insert_node(
        pool, tree_id, Some(dept_dev), "team", "Data & IA", "TEAM-DATA", 4,
    ).await?;
    mirror_to_workforce(pool, team_data, tenant_id, Some(dept_dev), "team", "Data & IA", 4).await?;

    // IT teams
    let team_sysadmin = insert_node(
        pool, tree_id, Some(dept_it), "team", "Systèmes & Réseaux", "TEAM-SYS", 0,
    ).await?;
    mirror_to_workforce(pool, team_sysadmin, tenant_id, Some(dept_it), "team", "Systèmes & Réseaux", 0).await?;
    let team_support = insert_node(
        pool, tree_id, Some(dept_it), "team", "Support Utilisateurs", "TEAM-SUP", 1,
    ).await?;
    mirror_to_workforce(pool, team_support, tenant_id, Some(dept_it), "team", "Support Utilisateurs", 1).await?;

    // HR teams
    let team_recruitment = insert_node(
        pool, tree_id, Some(dept_hr), "team", "Recrutement", "TEAM-REC", 0,
    ).await?;
    mirror_to_workforce(pool, team_recruitment, tenant_id, Some(dept_hr), "team", "Recrutement", 0).await?;
    let team_payroll = insert_node(
        pool, tree_id, Some(dept_hr), "team", "Paie & Administration", "TEAM-PAY", 1,
    ).await?;
    mirror_to_workforce(pool, team_payroll, tenant_id, Some(dept_hr), "team", "Paie & Administration", 1).await?;

    // Sales teams
    let team_sales_fr = insert_node(
        pool, tree_id, Some(dept_sales), "team", "Commercial France", "TEAM-COM-FR", 0,
    ).await?;
    mirror_to_workforce(pool, team_sales_fr, tenant_id, Some(dept_sales), "team", "Commercial France", 0).await?;
    let team_sales_export = insert_node(
        pool, tree_id, Some(dept_sales), "team", "Commercial Export", "TEAM-COM-EX", 1,
    ).await?;
    mirror_to_workforce(pool, team_sales_export, tenant_id, Some(dept_sales), "team", "Commercial Export", 1).await?;

    info!("org nodes created — assigning persons");

    // ── 6. Assignments ────────────────────────────────────────────────────────
    // user_ids slice order matches the users definition in users.rs:
    // [0]=CEO, [1..4]=directors, [5..16]=managers, [17..79]=employees

    // Helper: safely get person_id at index
    let person_at = |idx: usize| -> Option<Uuid> {
        user_ids.get(idx).map(|(_, person_id, _)| *person_id)
    };

    // CEO → company node
    if let Some(p) = person_at(0) {
        assign_person(pool, p, company_node, "holder", "hierarchical", true).await?;
    }

    // Directors → direction nodes
    let directors = [
        (1, dir_dga),
        (2, dir_ops),
        (3, dir_fin),
        (4, dir_tech),
    ];
    for (idx, node) in directors {
        if let Some(p) = person_at(idx) {
            assign_person(pool, p, node, "holder", "hierarchical", true).await?;
        }
    }

    // Managers → department nodes
    let manager_nodes = [
        (5, dept_hr),       // François Müller → RH
        (6, dept_dev),      // Jean-Baptiste Lefèvre → Dev
        (7, dept_it),       // Rachid Ben-Saïd → IT
        (8, dept_marketing),// Aurélie Desprès → Marketing
        (9, dept_sales),    // Thomas Le Gall → Commercial
        (10, dept_accounting), // Isabelle Faye → Comptabilité
        (11, team_backend), // Olivier Nguyễn → Lead Backend
        (12, dept_quality), // Céline Moreira → Qualité
        (13, dept_logistic),// Marc Okonkwo → Logistique
        (14, dept_purchasing), // Sylvie D'Ambrosio → Achats
        (15, dept_security),// Rémi Fontaine → Sécurité
        (16, dept_comm),    // Véronique Saint-Exupéry → Communication
    ];
    for (idx, node) in manager_nodes {
        if let Some(p) = person_at(idx) {
            assign_person(pool, p, node, "holder", "hierarchical", true).await?;
        }
    }

    // Employees — distribute across teams
    // Each team gets a fair slice of the remaining 63 employees (indices 17..79)
    let employee_team_map: &[(usize, Uuid)] = &[
        (17, team_backend),
        (18, team_backend),
        (19, team_frontend),
        (20, team_frontend),
        (21, dept_accounting),
        (22, dept_it),
        (23, team_sales_fr),
        (24, team_backend),
        (25, team_recruitment),
        (26, team_devops),
        (27, dept_comm),
        (28, team_backend),
        (29, dept_accounting),
        (30, team_support),
        (31, team_frontend),
        (32, team_qa),
        (33, team_sales_fr),
        (34, dept_legal),
        (35, team_backend),
        (36, team_data),
        (37, dept_purchasing),
        (38, team_frontend),
        (39, team_payroll),
        (40, dept_comm),
        (41, team_sysadmin),
        (42, team_support),
        (43, team_backend),
        (44, dept_accounting),
        (45, team_sysadmin),
        (46, team_recruitment),
        (47, team_backend),
        (48, team_data),
        (49, team_backend),
        (50, dept_legal),
        (51, team_backend),
        (52, team_sysadmin),
        (53, team_frontend),
        (54, team_support),
        (55, dept_accounting),
        (56, team_backend),
        (57, dept_comm),
        (58, team_qa),
        (59, team_backend),
        (60, team_devops),
        (61, team_sales_export),
        (62, team_data),
        (63, team_sales_fr),
        (64, dept_quality),
        (65, team_backend),
        (66, team_devops),
        (67, team_sales_export),
        (68, team_frontend),
        (69, team_qa),
        (70, dept_legal),
        (71, team_backend),
        (72, team_sysadmin),
        (73, team_frontend),
        (74, team_devops),
        (75, team_data),
        (76, dept_comm),
        (77, team_sales_fr),
        (78, team_frontend),
        (79, team_backend),
    ];

    for &(idx, node) in employee_team_map {
        if let Some(p) = person_at(idx) {
            assign_person(pool, p, node, "holder", "hierarchical", true).await?;
        }
    }

    info!("acme org seeding complete");
    Ok(())
}

/// Seeds Startup SAS org structure — flat hierarchy (1 tree, 1 root node).
///
/// All users are assigned directly to the root company node.
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
    tenant_id: Uuid,
    user_ids: &[(Uuid, Uuid, String)],
) -> Result<(), Box<dyn std::error::Error>> {
    info!(%tenant_id, users = user_ids.len(), "seeding startup org structure");

    // ── Org tree ──────────────────────────────────────────────────────────
    let tree_id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO core.org_trees
            (id, tenant_id, tree_type, name, created_at, updated_at)
        VALUES ($1, $2, 'internal', 'Startup SAS', NOW(), NOW())
        ON CONFLICT (tenant_id, tree_type) DO NOTHING
        "#,
    )
    .bind(tree_id)
    .bind(tenant_id)
    .execute(pool)
    .await?;

    // ── Root node ─────────────────────────────────────────────────────────
    let root_id = insert_node(pool, tree_id, None, "company", "Startup SAS", "STARTUP", 0).await?;
    mirror_to_workforce(pool, root_id, tenant_id, None, "company", "Startup SAS", 0).await?;

    // Self-reference in closure table (defensive insert for envs without trigger)
    sqlx::query(
        r#"
        INSERT INTO core.org_closure (ancestor_id, descendant_id, depth)
        VALUES ($1, $1, 0)
        ON CONFLICT DO NOTHING
        "#,
    )
    .bind(root_id)
    .execute(pool)
    .await?;

    // ── Assign all users to root ───────────────────────────────────────────
    for (_, person_id, _) in user_ids.iter() {
        assign_person(pool, *person_id, root_id, "holder", "hierarchical", true).await?;
    }

    info!("startup org seeding complete");
    Ok(())
}
