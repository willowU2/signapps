//! User seeding — inserts rows into `identity.users` and `core.persons`.
//!
//! All password hashes are a fixed argon2id hash of the literal string
//! `"password"` so that seed accounts share a well-known credential in dev.
//! **Never use these hashes in production.**

use tracing::info;
use uuid::Uuid;

/// Pre-computed argon2id hash of `"password"`.
///
/// Generated with `argon2id` default parameters (m=65536, t=3, p=4).
/// All seed users share this hash for convenience in development.
const PASSWORD_HASH: &str =
    "$argon2id$v=19$m=65536,t=3,p=4$c2lnbmFwcHNkZXZzZWVk$\
     6W5XfZLvlvTjDJpBGjgqyNkBe1rPnkVfRBM2Z5QFxGE";

// ─── Fixed UUIDs for minimal scenario ────────────────────────────────────────

const ADMIN_ID: Uuid = uuid::uuid!("00000000-0000-0000-0000-000000000001");
const MANAGER_ID: Uuid = uuid::uuid!("00000000-0000-0000-0000-000000000002");
const EMPLOYEE_ID: Uuid = uuid::uuid!("00000000-0000-0000-0000-000000000003");
const CLIENT_USER_ID: Uuid = uuid::uuid!("00000000-0000-0000-0000-000000000004");
const SUPPLIER_USER_ID: Uuid = uuid::uuid!("00000000-0000-0000-0000-000000000005");

// ─── Helpers ──────────────────────────────────────────────────────────────────

/// Inserts one user into `identity.users` and one matching person into
/// `core.persons`, returning `(user_id, person_id)`.
///
/// Both inserts use `ON CONFLICT DO NOTHING` so the function is idempotent
/// when the same fixed UUID is used across runs.
async fn insert_user_and_person(
    pool: &sqlx::PgPool,
    user_id: Uuid,
    tenant_id: Uuid,
    username: &str,
    email: &str,
    display_name: &str,
    first_name: &str,
    last_name: &str,
    role: i16,
    job_title: &str,
) -> Result<(Uuid, Uuid), Box<dyn std::error::Error>> {
    // identity.users
    sqlx::query(
        r#"
        INSERT INTO identity.users
            (id, username, email, password_hash, role, display_name,
             tenant_id, job_title, auth_provider, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'local', NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
        "#,
    )
    .bind(user_id)
    .bind(username)
    .bind(email)
    .bind(PASSWORD_HASH)
    .bind(role)
    .bind(display_name)
    .bind(tenant_id)
    .bind(job_title)
    .execute(pool)
    .await?;

    // core.persons
    let person_id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO core.persons
            (id, tenant_id, first_name, last_name, email, user_id,
             is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW(), NOW())
        ON CONFLICT DO NOTHING
        "#,
    )
    .bind(person_id)
    .bind(tenant_id)
    .bind(first_name)
    .bind(last_name)
    .bind(email)
    .bind(user_id)
    .execute(pool)
    .await?;

    Ok((user_id, person_id))
}

// ─── Public API ───────────────────────────────────────────────────────────────

/// Seeds the minimal set of users (5 fixed-UUID accounts) for a tenant.
///
/// Creates:
/// - `admin` (role=3 superadmin)
/// - `manager` (role=2 admin)
/// - `employee`, `client_user`, `supplier_user` (role=1 user)
///
/// Returns a list of `(user_id, person_id, role_name)` triples.
///
/// # Errors
///
/// Returns an error if any database operation fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
pub async fn seed_minimal(
    pool: &sqlx::PgPool,
    tenant_id: Uuid,
) -> Result<Vec<(Uuid, Uuid, String)>, Box<dyn std::error::Error>> {
    info!(%tenant_id, "seeding minimal users");

    let entries: &[(Uuid, &str, &str, &str, &str, i16, &str)] = &[
        (
            ADMIN_ID,
            "admin",
            "admin@signapps.dev",
            "Admin SignApps",
            "Admin",
            3,
            "System Administrator",
        ),
        (
            MANAGER_ID,
            "manager",
            "manager@signapps.dev",
            "Manager SignApps",
            "Manager",
            2,
            "Manager",
        ),
        (
            EMPLOYEE_ID,
            "employee",
            "employee@signapps.dev",
            "Employee SignApps",
            "Employee",
            1,
            "Employee",
        ),
        (
            CLIENT_USER_ID,
            "client_user",
            "client@signapps.dev",
            "Client User",
            "Client",
            1,
            "Client Contact",
        ),
        (
            SUPPLIER_USER_ID,
            "supplier_user",
            "supplier@signapps.dev",
            "Supplier User",
            "Supplier",
            1,
            "Supplier Contact",
        ),
    ];

    let mut results = Vec::with_capacity(entries.len());

    for &(uid, username, email, display, first, role, title) in entries {
        // Split display name for first/last — use display as last fallback
        let last = username;
        let (user_id, person_id) = insert_user_and_person(
            pool, uid, tenant_id, username, email, display, first, last, role, title,
        )
        .await?;
        let role_name = match role {
            3 => "superadmin",
            2 => "admin",
            _ => "user",
        };
        results.push((user_id, person_id, role_name.to_string()));
        info!(user_id = %uid, %username, "seeded minimal user");
    }

    Ok(results)
}

/// Seeds the Acme Corp user set: 80 users across all levels.
///
/// Hierarchy:
/// - 1 CEO (role=3)
/// - 4 directors (role=2)
/// - 12 managers (role=2)
/// - 63 employees (role=1)
///
/// Returns a list of `(user_id, person_id, role_name)` triples.
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
) -> Result<Vec<(Uuid, Uuid, String)>, Box<dyn std::error::Error>> {
    info!(%tenant_id, "seeding acme users (80 total)");

    // (username, email_local, display_name, first_name, last_name, role, job_title)
    // Usernames are ASCII-safe; display names use full Unicode.
    let users: &[(&str, &str, &str, &str, &str, i16, &str)] = &[
        // ── CEO ──────────────────────────────────────────────────────────────
        (
            "pierre.durand",
            "pierre.durand",
            "Pierre Durand",
            "Pierre",
            "Durand",
            3,
            "CEO",
        ),
        // ── Directors ────────────────────────────────────────────────────────
        (
            "marie-claire.beranger",
            "marie-claire.beranger",
            "Marie-Claire Béranger",
            "Marie-Claire",
            "Béranger",
            2,
            "Directrice Générale Adjointe",
        ),
        (
            "nathalie.strasse",
            "nathalie.strasse",
            "Nathalie Straße",
            "Nathalie",
            "Straße",
            2,
            "Directrice des Opérations",
        ),
        (
            "eve.saint-andre",
            "eve.saint-andre",
            "Ève Saint-André",
            "Ève",
            "Saint-André",
            2,
            "Directrice Financière",
        ),
        (
            "andre.noel",
            "andre.noel",
            "André Noël",
            "André",
            "Noël",
            2,
            "Directeur Technique",
        ),
        // ── Managers ─────────────────────────────────────────────────────────
        (
            "francois.muller",
            "francois.muller",
            "François Müller",
            "François",
            "Müller",
            2,
            "Responsable RH",
        ),
        (
            "jean-baptiste.lefevre",
            "jean-baptiste.lefevre",
            "Jean-Baptiste Lefèvre",
            "Jean-Baptiste",
            "Lefèvre",
            2,
            "Chef de Projet",
        ),
        (
            "rachid.ben-said",
            "rachid.ben-said",
            "Rachid Ben-Saïd",
            "Rachid",
            "Ben-Saïd",
            2,
            "Responsable IT",
        ),
        (
            "aurelie.despres",
            "aurelie.despres",
            "Aurélie Desprès",
            "Aurélie",
            "Desprès",
            2,
            "Responsable Marketing",
        ),
        (
            "thomas.le-gall",
            "thomas.le-gall",
            "Thomas Le Gall",
            "Thomas",
            "Le Gall",
            2,
            "Responsable Commercial",
        ),
        (
            "isabelle.faye",
            "isabelle.faye",
            "Isabelle Faye",
            "Isabelle",
            "Faye",
            2,
            "Chef Comptable",
        ),
        (
            "olivier.nguyen",
            "olivier.nguyen",
            "Olivier Nguyễn",
            "Olivier",
            "Nguyễn",
            2,
            "Lead Développeur",
        ),
        (
            "celine.moreira",
            "celine.moreira",
            "Céline Moreira",
            "Céline",
            "Moreira",
            2,
            "Responsable Qualité",
        ),
        (
            "marc.okonkwo",
            "marc.okonkwo",
            "Marc Okonkwo",
            "Marc",
            "Okonkwo",
            2,
            "Responsable Logistique",
        ),
        (
            "sylvie.d-ambrosio",
            "sylvie.d-ambrosio",
            "Sylvie D'Ambrosio",
            "Sylvie",
            "D'Ambrosio",
            2,
            "Responsable Achats",
        ),
        (
            "remi.fontaine",
            "remi.fontaine",
            "Rémi Fontaine",
            "Rémi",
            "Fontaine",
            2,
            "Responsable Sécurité",
        ),
        (
            "veronique.saint-exupery",
            "veronique.saint-exupery",
            "Véronique Saint-Exupéry",
            "Véronique",
            "Saint-Exupéry",
            2,
            "Responsable Communication",
        ),
        // ── Employees ────────────────────────────────────────────────────────
        (
            "alice.martin",
            "alice.martin",
            "Alice Martin",
            "Alice",
            "Martin",
            1,
            "Développeuse",
        ),
        (
            "benoit.larue",
            "benoit.larue",
            "Benoît Larue",
            "Benoît",
            "Larue",
            1,
            "Développeur",
        ),
        (
            "camille.tran",
            "camille.tran",
            "Camille Trần",
            "Camille",
            "Trần",
            1,
            "Designer UX",
        ),
        (
            "david.cohen",
            "david.cohen",
            "David Cohen",
            "David",
            "Cohen",
            1,
            "Analyste",
        ),
        (
            "elise.girard",
            "elise.girard",
            "Élise Girard",
            "Élise",
            "Girard",
            1,
            "Comptable",
        ),
        (
            "fabien.rousseau",
            "fabien.rousseau",
            "Fabien Rousseau",
            "Fabien",
            "Rousseau",
            1,
            "Technicien IT",
        ),
        (
            "gaelle.perrot",
            "gaelle.perrot",
            "Gaëlle Perrot",
            "Gaëlle",
            "Perrot",
            1,
            "Commerciale",
        ),
        (
            "hugo.bellamy",
            "hugo.bellamy",
            "Hugo Bellamy",
            "Hugo",
            "Bellamy",
            1,
            "Développeur",
        ),
        (
            "ines.cherif",
            "ines.cherif",
            "Inès Chérif",
            "Inès",
            "Chérif",
            1,
            "Assistante RH",
        ),
        (
            "julien.costa",
            "julien.costa",
            "Julien Costa",
            "Julien",
            "Costa",
            1,
            "DevOps",
        ),
        (
            "karine.bouchard",
            "karine.bouchard",
            "Karine Bouchard",
            "Karine",
            "Bouchard",
            1,
            "Chargée de Communication",
        ),
        (
            "louis.henrot",
            "louis.henrot",
            "Louis Henrot",
            "Louis",
            "Henrot",
            1,
            "Architecte Logiciel",
        ),
        (
            "manon.le-brun",
            "manon.le-brun",
            "Manon Le Brun",
            "Manon",
            "Le Brun",
            1,
            "Analyste Financière",
        ),
        (
            "nicolas.petit",
            "nicolas.petit",
            "Nicolas Petit",
            "Nicolas",
            "Petit",
            1,
            "Responsable Support",
        ),
        (
            "ophelia.garcia",
            "ophelia.garcia",
            "Ophélia Garcia",
            "Ophélia",
            "Garcia",
            1,
            "Développeuse",
        ),
        (
            "paul.zimmermann",
            "paul.zimmermann",
            "Paul Zimmermann",
            "Paul",
            "Zimmermann",
            1,
            "Ingénieur QA",
        ),
        (
            "quentin.renard",
            "quentin.renard",
            "Quentin Renard",
            "Quentin",
            "Renard",
            1,
            "Commercial",
        ),
        (
            "rachel.dubois",
            "rachel.dubois",
            "Rachel Dubois",
            "Rachel",
            "Dubois",
            1,
            "Juriste",
        ),
        (
            "sebastien.hamdi",
            "sebastien.hamdi",
            "Sébastien Hamdi",
            "Sébastien",
            "Hamdi",
            1,
            "Développeur Backend",
        ),
        (
            "thibault.richard",
            "thibault.richard",
            "Thibault Richard",
            "Thibault",
            "Richard",
            1,
            "Data Scientist",
        ),
        (
            "ursula.meylan",
            "ursula.meylan",
            "Ursula Meylan",
            "Ursula",
            "Meylan",
            1,
            "Acheteuse",
        ),
        (
            "victoria.blanc",
            "victoria.blanc",
            "Victoria Blanc",
            "Victoria",
            "Blanc",
            1,
            "Graphiste",
        ),
        (
            "william.jourdain",
            "william.jourdain",
            "William Jourdain",
            "William",
            "Jourdain",
            1,
            "Administrateur Système",
        ),
        (
            "xavier.lemaire",
            "xavier.lemaire",
            "Xavier Lemaire",
            "Xavier",
            "Lemaire",
            1,
            "Technicien Support",
        ),
        (
            "yann.ozier-lafontaine",
            "yann.ozier-lafontaine",
            "Yann Ozier-Lafontaine",
            "Yann",
            "Ozier-Lafontaine",
            1,
            "Développeur Mobile",
        ),
        (
            "zoe.pernet",
            "zoe.pernet",
            "Zoé Pernet",
            "Zoé",
            "Pernet",
            1,
            "Développeuse Frontend",
        ),
        (
            "adrien.leclercq",
            "adrien.leclercq",
            "Adrien Leclercq",
            "Adrien",
            "Leclercq",
            1,
            "Ingénieur Cloud",
        ),
        (
            "beatrice.auger",
            "beatrice.auger",
            "Béatrice Auger",
            "Béatrice",
            "Auger",
            1,
            "Comptable",
        ),
        (
            "christophe.vidal",
            "christophe.vidal",
            "Christophe Vidal",
            "Christophe",
            "Vidal",
            1,
            "Technicien Réseau",
        ),
        (
            "delphine.toussaint",
            "delphine.toussaint",
            "Delphine Toussaint",
            "Delphine",
            "Toussaint",
            1,
            "Chargée Recrutement",
        ),
        (
            "etienne.marchal",
            "etienne.marchal",
            "Étienne Marchal",
            "Étienne",
            "Marchal",
            1,
            "Développeur",
        ),
        (
            "florence.nguyen",
            "florence.nguyen",
            "Florence Nguyen",
            "Florence",
            "Nguyen",
            1,
            "Product Owner",
        ),
        (
            "guillaume.andre",
            "guillaume.andre",
            "Guillaume André",
            "Guillaume",
            "André",
            1,
            "Scrum Master",
        ),
        (
            "helene.bazin",
            "helene.bazin",
            "Hélène Bazin",
            "Hélène",
            "Bazin",
            1,
            "Chargée de Projet",
        ),
        (
            "ivan.sokolov",
            "ivan.sokolov",
            "Ivan Sokolov",
            "Ivan",
            "Sokolov",
            1,
            "Développeur Backend",
        ),
        (
            "justine.peretz",
            "justine.peretz",
            "Justine Peretz",
            "Justine",
            "Peretz",
            1,
            "Analyste Données",
        ),
        (
            "kevin.el-khoury",
            "kevin.el-khoury",
            "Kevin El-Khoury",
            "Kevin",
            "El-Khoury",
            1,
            "Ingénieur Sécurité",
        ),
        (
            "laura.vanderberg",
            "laura.vanderberg",
            "Laura Vanderberg",
            "Laura",
            "Vanderberg",
            1,
            "Responsable Export",
        ),
        (
            "mathieu.ferrara",
            "mathieu.ferrara",
            "Mathieu Ferrara",
            "Mathieu",
            "Ferrara",
            1,
            "Développeur",
        ),
        (
            "nora.hadji",
            "nora.hadji",
            "Nora Hadji",
            "Nora",
            "Hadji",
            1,
            "Assistante Juridique",
        ),
        (
            "omar.diallo",
            "omar.diallo",
            "Omar Diallo",
            "Omar",
            "Diallo",
            1,
            "Commercial",
        ),
        (
            "patricia.lamy",
            "patricia.lamy",
            "Patricia Lamy",
            "Patricia",
            "Lamy",
            1,
            "Secrétaire de Direction",
        ),
        (
            "quentin.sauvage",
            "quentin.sauvage",
            "Quentin Sauvage",
            "Quentin",
            "Sauvage",
            1,
            "Développeur",
        ),
        (
            "romain.carre",
            "romain.carre",
            "Romain Carré",
            "Romain",
            "Carré",
            1,
            "Ingénieur Systèmes",
        ),
        (
            "sophie.becker",
            "sophie.becker",
            "Sophie Becker",
            "Sophie",
            "Becker",
            1,
            "Développeuse",
        ),
        (
            "thibaut.le-guen",
            "thibaut.le-guen",
            "Thibaut Le Guen",
            "Thibaut",
            "Le Guen",
            1,
            "Technicien Support",
        ),
        (
            "ulrike.hoffmann",
            "ulrike.hoffmann",
            "Ulrike Hoffmann",
            "Ulrike",
            "Hoffmann",
            1,
            "Comptable",
        ),
        (
            "vincent.labbe",
            "vincent.labbe",
            "Vincent Labbé",
            "Vincent",
            "Labbé",
            1,
            "Développeur Full-Stack",
        ),
        (
            "wendy.saint-martin",
            "wendy.saint-martin",
            "Wendy Saint-Martin",
            "Wendy",
            "Saint-Martin",
            1,
            "Chargée Marketing",
        ),
        (
            "xavier.barre",
            "xavier.barre",
            "Xavier Barré",
            "Xavier",
            "Barré",
            1,
            "Ingénieur QA",
        ),
        (
            "yasmine.allaoui",
            "yasmine.allaoui",
            "Yasmine Allaoui",
            "Yasmine",
            "Allaoui",
            1,
            "Développeuse",
        ),
        (
            "zacharie.le-meur",
            "zacharie.le-meur",
            "Zacharie Le Meur",
            "Zacharie",
            "Le Meur",
            1,
            "DevOps",
        ),
    ];

    let mut results = Vec::with_capacity(users.len());

    for &(username, email_local, display, first, last, role, title) in users {
        let email = format!("{}@acme.signapps.dev", email_local);
        let user_id = Uuid::new_v4();
        let (uid, person_id) = insert_user_and_person(
            pool, user_id, tenant_id, username, &email, display, first, last, role, title,
        )
        .await?;
        let role_name = match role {
            3 => "ceo",
            2 => {
                if title.contains("Directeur") || title.contains("Directrice") {
                    "director"
                } else {
                    "manager"
                }
            }
            _ => "employee",
        };
        results.push((uid, person_id, role_name.to_string()));
        info!(user_id = %uid, %username, "seeded acme user");
    }

    info!(count = results.len(), "acme users seeded");
    Ok(results)
}

/// Seeds the Startup user set — 15 users, small team.
///
/// One founder (role=3), 14 contributors (role=1).
///
/// Returns a list of `(user_id, person_id, role_name)` triples.
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
) -> Result<Vec<(Uuid, Uuid, String)>, Box<dyn std::error::Error>> {
    info!(%tenant_id, "seeding startup users (15 total)");

    let users: &[(&str, &str, &str, &str, i16, &str)] = &[
        ("lea.bernard", "Léa Bernard", "Léa", "Bernard", 3, "Founder & CEO"),
        ("alex.chen", "Alex Chen", "Alex", "Chen", 1, "CTO"),
        ("sofia.russo", "Sofia Russo", "Sofia", "Russo", 1, "Lead Designer"),
        ("noah.muller", "Noah Müller", "Noah", "Müller", 1, "Backend Dev"),
        ("emma.dupont", "Emma Dupont", "Emma", "Dupont", 1, "Frontend Dev"),
        ("lucas.smith", "Lucas Smith", "Lucas", "Smith", 1, "DevOps"),
        ("jade.martin", "Jade Martin", "Jade", "Martin", 1, "Product Manager"),
        ("ethan.kim", "Ethan Kim", "Ethan", "Kim", 1, "Full-Stack Dev"),
        ("chloe.dubois", "Chloé Dubois", "Chloé", "Dubois", 1, "QA Engineer"),
        ("liam.torres", "Liam Torres", "Liam", "Torres", 1, "Data Engineer"),
        ("maya.patel", "Maya Patel", "Maya", "Patel", 1, "Growth Hacker"),
        ("hugo.roux", "Hugo Roux", "Hugo", "Roux", 1, "Backend Dev"),
        ("amelia.blanc", "Amelia Blanc", "Amelia", "Blanc", 1, "UX Researcher"),
        ("leo.garcia", "Léo Garcia", "Léo", "Garcia", 1, "Mobile Dev"),
        ("zoe.wilson", "Zoé Wilson", "Zoé", "Wilson", 1, "Operations"),
    ];

    let mut results = Vec::with_capacity(users.len());

    for &(username, display, first, last, role, title) in users {
        let email = format!("{}@startup.signapps.dev", username);
        let user_id = Uuid::new_v4();
        let (uid, person_id) = insert_user_and_person(
            pool, user_id, tenant_id, username, &email, display, first, last, role, title,
        )
        .await?;
        let role_name = if role == 3 { "founder" } else { "employee" };
        results.push((uid, person_id, role_name.to_string()));
        info!(user_id = %uid, %username, "seeded startup user");
    }

    Ok(results)
}
