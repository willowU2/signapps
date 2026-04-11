//! signapps-seed — database seeding CLI for the SignApps platform.
//!
//! Seeds realistic data for development and testing across all services.

mod calendar;
mod chaos;
mod companies;
mod documents;
mod mail;
mod org;
mod projects;
mod tenants;
mod users;
mod verify;

use clap::{Parser, ValueEnum};
use tracing::info;

#[derive(Debug, Clone, ValueEnum)]
enum SeedMode {
    /// Minimal seed: one tenant + admin user only
    Minimal,
    /// Acme Corp scenario: full company with teams, projects, calendar, mail
    Acme,
    /// Startup scenario: small team with lightweight data
    Startup,
    /// Chaos mode: large volume of randomized data for stress testing
    Chaos,
    /// Full: Acme + Startup + Chaos (all 3 tenants)
    Full,
}

#[derive(Debug, Parser)]
#[command(
    name = "signapps-seed",
    about = "Seed the SignApps database with realistic development data",
    version
)]
struct Cli {
    /// Seeding mode to run
    #[arg(short, long, default_value = "minimal")]
    mode: SeedMode,

    /// Drop and recreate all seed data before inserting
    #[arg(long, default_value_t = false)]
    reset: bool,

    /// Verify seed data integrity after seeding (or standalone)
    #[arg(long, default_value_t = false)]
    verify: bool,

    /// PostgreSQL connection URL
    #[arg(
        long,
        env = "DATABASE_URL",
        default_value = "postgres://signapps:password@localhost:5432/signapps"
    )]
    database_url: String,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "signapps_seed=info".parse().expect("valid filter")),
        )
        .init();

    let cli = Cli::parse();

    info!(mode = ?cli.mode, reset = cli.reset, "connecting to database");

    let pool = sqlx::PgPool::connect(&cli.database_url).await?;

    if cli.reset {
        info!("reset requested — truncating seed data");
        reset_seed_data(&pool).await?;
    }

    match cli.mode {
        SeedMode::Minimal => seed_minimal(&pool).await?,
        SeedMode::Acme => seed_acme(&pool).await?,
        SeedMode::Startup => seed_startup(&pool).await?,
        SeedMode::Chaos => seed_chaos(&pool).await?,
        SeedMode::Full => {
            info!("mode=full: seeding all 3 tenants (Acme + Startup + Chaos)");
            seed_acme(&pool).await?;
            seed_startup(&pool).await?;
            seed_chaos(&pool).await?;
        }
    }

    if cli.verify {
        info!("running post-seed verification");
        let mode_str = match cli.mode {
            SeedMode::Minimal => "minimal",
            SeedMode::Acme => "acme",
            SeedMode::Startup => "startup",
            SeedMode::Chaos => "chaos",
            SeedMode::Full => "full",
        };
        verify::run(&pool, mode_str).await?;
    }

    info!("seeding complete");
    Ok(())
}

async fn seed_minimal(pool: &sqlx::PgPool) -> Result<(), Box<dyn std::error::Error>> {
    info!("mode=minimal: seeding primary tenant + admin user");
    let tenant_id = tenants::seed_tenant(pool, "SignApps Dev", true).await?;
    let _users: Vec<(uuid::Uuid, uuid::Uuid, String)> =
        users::seed_minimal(pool, tenant_id).await?;
    Ok(())
}

async fn seed_acme(pool: &sqlx::PgPool) -> Result<(), Box<dyn std::error::Error>> {
    info!("mode=acme: seeding Acme Corp full scenario");
    let tenant_id = tenants::seed_tenant(pool, "Acme Corp", true).await?;
    let user_ids = users::seed_acme(pool, tenant_id).await?;
    companies::seed_acme(pool, tenant_id).await?;
    org::seed_acme(pool, tenant_id, &user_ids).await?;
    projects::seed_acme(pool, tenant_id, &user_ids).await?;
    calendar::seed_acme(pool, tenant_id, &user_ids).await?;
    mail::seed_acme(pool, tenant_id, &user_ids).await?;
    documents::seed_acme(pool, tenant_id, &user_ids).await?;
    Ok(())
}

async fn seed_startup(pool: &sqlx::PgPool) -> Result<(), Box<dyn std::error::Error>> {
    info!("mode=startup: seeding Startup scenario");
    let tenant_id = tenants::seed_tenant(pool, "Startup SAS", false).await?;
    let _users: Vec<(uuid::Uuid, uuid::Uuid, String)> =
        users::seed_startup(pool, tenant_id).await?;
    Ok(())
}

async fn seed_chaos(pool: &sqlx::PgPool) -> Result<(), Box<dyn std::error::Error>> {
    info!("mode=chaos: seeding high-volume randomized data");
    chaos::seed_chaos(pool).await?;
    Ok(())
}

/// Truncates all seed-generated data (identified by a seed marker or by schema).
///
/// # Errors
///
/// Returns an error if the database truncation query fails.
async fn reset_seed_data(pool: &sqlx::PgPool) -> Result<(), Box<dyn std::error::Error>> {
    info!("truncating seed tables");

    // Truncate in dependency order (CASCADE handles FK references).
    // We truncate only the tables that the seed populates.
    let tables = [
        // Calendar / scheduling (leaf tables first, but CASCADE handles it)
        "calendar.events",
        "calendar.event_attendees",
        "calendar.calendars",
        "calendar.projects",
        "calendar.project_members",
        "calendar.tasks",
        "scheduling.time_items",
        "scheduling.time_item_users",
        // Mail
        "mail.emails",
        "mail.attachments",
        "mail.accounts",
        "mail.folders",
        "mail.labels",
        // Documents
        "documents.files",
        // Org structure
        "core.org_closure",
        "core.assignments",
        "core.org_nodes",
        "core.org_trees",
        // Companies / persons
        "core.person_companies",
        "identity.login_contexts",
        "core.persons",
        "core.companies",
        // Users / tenants (last — everything depends on these)
        "identity.users",
        "identity.tenants",
    ];

    for table in &tables {
        let query = format!("TRUNCATE TABLE {table} CASCADE");
        match sqlx::query(&query).execute(pool).await {
            Ok(_) => info!(table, "truncated"),
            Err(e) => {
                // Table may not exist in some DB versions — warn and continue.
                tracing::warn!(table, error = %e, "skipping truncation");
            }
        }
    }

    Ok(())
}
