//! Company seeding — inserts rows into `core.companies`, `core.person_companies`,
//! and `identity.login_contexts`.

use tracing::info;
use uuid::Uuid;

/// Seeds Acme Corp company data for a given tenant.
///
/// Creates four companies:
/// - **Acme Corp** (internal) — the tenant's own legal entity
/// - **TechSupply SARL** (supplier) — IT hardware/software supplier
/// - **ClientCo SAS** (client) — example client company
/// - **PartnerDesign** (partner) — design/UX partner studio
///
/// Also inserts `core.person_companies` affiliations and
/// `identity.login_contexts` for any users that belong to multiple companies.
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
) -> Result<(), Box<dyn std::error::Error>> {
    info!(%tenant_id, "seeding acme companies");

    // ── 1. Companies ──────────────────────────────────────────────────────────

    let acme_id = Uuid::new_v4();
    let techsupply_id = Uuid::new_v4();
    let clientco_id = Uuid::new_v4();
    let partnerdesign_id = Uuid::new_v4();

    let companies: &[(Uuid, &str, &str, Option<&str>, Option<&str>, Option<&str>)] = &[
        (
            acme_id,
            "Acme Corp",
            "internal",
            Some("Acme Corporation SAS"),
            Some("123456789"),
            Some("IT & Services"),
        ),
        (
            techsupply_id,
            "TechSupply SARL",
            "supplier",
            Some("TechSupply SARL"),
            Some("987654321"),
            Some("Hardware & Software Distribution"),
        ),
        (
            clientco_id,
            "ClientCo SAS",
            "client",
            Some("ClientCo SAS"),
            Some("456789123"),
            Some("Retail"),
        ),
        (
            partnerdesign_id,
            "PartnerDesign",
            "partner",
            Some("PartnerDesign Studio EURL"),
            None,
            Some("Design & UX"),
        ),
    ];

    for &(company_id, name, company_type, legal_name, siren, industry) in companies {
        sqlx::query(
            r#"
            INSERT INTO core.companies
                (id, tenant_id, name, company_type, legal_name, siren, industry,
                 country, default_currency, is_active, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'FR', 'EUR', TRUE, NOW(), NOW())
            ON CONFLICT DO NOTHING
            "#,
        )
        .bind(company_id)
        .bind(tenant_id)
        .bind(name)
        .bind(company_type)
        .bind(legal_name)
        .bind(siren)
        .bind(industry)
        .execute(pool)
        .await?;
        info!(company_id = %company_id, %name, "seeded company");
    }

    // ── 2. Affiliate internal employees to Acme Corp ──────────────────────────
    // Find all persons in this tenant that are linked to internal users
    // (role <= 2 means admin/manager, role = 1 = employee, role = 3 = superadmin)
    let internal_persons: Vec<(Uuid, Uuid, String, String)> = sqlx::query_as(
        r#"
        SELECT p.id, p.user_id, u.display_name, u.job_title
        FROM core.persons p
        INNER JOIN identity.users u ON u.id = p.user_id
        WHERE p.tenant_id = $1
          AND u.tenant_id = $1
          AND u.auth_provider = 'local'
        ORDER BY u.role DESC, u.created_at
        "#,
    )
    .bind(tenant_id)
    .fetch_all(pool)
    .await?;

    for (person_id, _user_id, display_name, job_title) in &internal_persons {
        let affil_id = Uuid::new_v4();
        sqlx::query(
            r#"
            INSERT INTO core.person_companies
                (id, person_id, company_id, role_in_company, job_title, is_primary,
                 start_date, portal_access, created_at, updated_at)
            VALUES ($1, $2, $3, 'employee', $4, TRUE, CURRENT_DATE, FALSE, NOW(), NOW())
            ON CONFLICT (person_id, company_id, role_in_company) DO NOTHING
            "#,
        )
        .bind(affil_id)
        .bind(person_id)
        .bind(acme_id)
        .bind(job_title)
        .execute(pool)
        .await?;

        info!(
            person_id = %person_id,
            display_name = display_name.as_str(),
            "affiliated person to Acme Corp"
        );
    }

    // ── 3. Create 2 supplier contacts linked to TechSupply ────────────────────
    let supplier_contacts: &[(&str, &str, &str, &str)] = &[
        (
            "supplier_contact_1",
            "contact1@techsupply.fr",
            "Jean",
            "Fournisseur",
        ),
        (
            "supplier_contact_2",
            "contact2@techsupply.fr",
            "Marie",
            "Vendeur",
        ),
    ];

    for &(username, email, first, last) in supplier_contacts {
        let person_id = Uuid::new_v4();
        sqlx::query(
            r#"
            INSERT INTO core.persons
                (id, tenant_id, first_name, last_name, email, is_active, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, TRUE, NOW(), NOW())
            ON CONFLICT DO NOTHING
            "#,
        )
        .bind(person_id)
        .bind(tenant_id)
        .bind(first)
        .bind(last)
        .bind(email)
        .execute(pool)
        .await?;

        let affil_id = Uuid::new_v4();
        sqlx::query(
            r#"
            INSERT INTO core.person_companies
                (id, person_id, company_id, role_in_company, job_title, is_primary,
                 portal_access, portal_modules, created_at, updated_at)
            VALUES ($1, $2, $3, 'supplier_contact', 'Account Manager', TRUE,
                    TRUE, ARRAY['orders','invoices'], NOW(), NOW())
            ON CONFLICT (person_id, company_id, role_in_company) DO NOTHING
            "#,
        )
        .bind(affil_id)
        .bind(person_id)
        .bind(techsupply_id)
        .execute(pool)
        .await?;

        info!(%username, "seeded supplier contact");
    }

    // ── 4. Create 2 client contacts linked to ClientCo ────────────────────────
    let client_contacts: &[(&str, &str, &str, &str)] = &[
        ("client_contact_1", "contact1@clientco.fr", "Sophie", "Client"),
        ("client_contact_2", "contact2@clientco.fr", "Pierre", "Acheteur"),
    ];

    for &(username, email, first, last) in client_contacts {
        let person_id = Uuid::new_v4();
        sqlx::query(
            r#"
            INSERT INTO core.persons
                (id, tenant_id, first_name, last_name, email, is_active, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, TRUE, NOW(), NOW())
            ON CONFLICT DO NOTHING
            "#,
        )
        .bind(person_id)
        .bind(tenant_id)
        .bind(first)
        .bind(last)
        .bind(email)
        .execute(pool)
        .await?;

        let affil_id = Uuid::new_v4();
        sqlx::query(
            r#"
            INSERT INTO core.person_companies
                (id, person_id, company_id, role_in_company, job_title, is_primary,
                 portal_access, portal_modules, created_at, updated_at)
            VALUES ($1, $2, $3, 'client_contact', 'Responsable Achats', TRUE,
                    TRUE, ARRAY['catalog','orders'], NOW(), NOW())
            ON CONFLICT (person_id, company_id, role_in_company) DO NOTHING
            "#,
        )
        .bind(affil_id)
        .bind(person_id)
        .bind(clientco_id)
        .execute(pool)
        .await?;

        info!(%username, "seeded client contact");
    }

    // ── 5. Login contexts for multi-role users ────────────────────────────────
    // Find employees who also have a client or supplier affiliation via their
    // person_company rows (covers future expansions). For now we wire up the
    // supplier_user and client_user minimal accounts if they exist in this tenant.
    let multi_role_users: Vec<(Uuid, Uuid)> = sqlx::query_as(
        r#"
        SELECT u.id AS user_id, pc.id AS person_company_id
        FROM identity.users u
        INNER JOIN core.persons p ON p.user_id = u.id
        INNER JOIN core.person_companies pc ON pc.person_id = p.id
        WHERE u.tenant_id = $1
          AND pc.company_id != $2
          AND pc.portal_access = TRUE
        "#,
    )
    .bind(tenant_id)
    .bind(acme_id)
    .fetch_all(pool)
    .await?;

    for (user_id, person_company_id) in multi_role_users {
        // Determine company and context type from person_companies
        let row: Option<(Uuid, String, String)> = sqlx::query_as(
            r#"
            SELECT pc.company_id, pc.role_in_company, c.name
            FROM core.person_companies pc
            INNER JOIN core.companies c ON c.id = pc.company_id
            WHERE pc.id = $1
            "#,
        )
        .bind(person_company_id)
        .fetch_optional(pool)
        .await?;

        if let Some((company_id, role_in_company, company_name)) = row {
            let context_type = match role_in_company.as_str() {
                "client_contact" => "client",
                "supplier_contact" => "supplier",
                "partner" => "partner",
                _ => "employee",
            };
            let label = format!("{} — {}", context_type, company_name);
            let login_ctx_id = Uuid::new_v4();
            sqlx::query(
                r#"
                INSERT INTO identity.login_contexts
                    (id, user_id, person_company_id, context_type, company_id,
                     label, is_active, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW())
                ON CONFLICT (user_id, person_company_id) DO NOTHING
                "#,
            )
            .bind(login_ctx_id)
            .bind(user_id)
            .bind(person_company_id)
            .bind(context_type)
            .bind(company_id)
            .bind(&label)
            .execute(pool)
            .await?;

            info!(%user_id, %label, "seeded login context");
        }
    }

    info!("acme company seeding complete");
    Ok(())
}
