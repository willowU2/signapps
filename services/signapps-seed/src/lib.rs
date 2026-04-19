//! signapps-seed — idempotent, deterministic demo data seeder for SignApps.
//!
//! Seeds an "Acme Corp" tenant with ~200 cross-service demo items
//! (org tree, users, calendars, mail, chat, docs, files, PXE assets...)
//! in under 15 seconds. Safe to re-run — all UUIDs are derived via
//! [`uuid::acme_uuid`] namespace v5, so second invocation creates zero
//! new rows.
//!
//! # Safety
//!
//! Refuses to run against a non-localhost `DATABASE_URL` unless the
//! environment variable `SEED_ALLOW_PROD=1` is set.

pub mod context;
pub mod seeder;
pub mod seeders;
pub mod uuid;

use clap::Parser;
use context::SeedContext;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

/// Command-line arguments for the seed binary.
/// Command-line arguments for the seed binary.
#[derive(Parser, Debug, Clone)]
#[command(name = "signapps-seed", about = "Seed SignApps demo data (Acme Corp)")]
pub struct SeedArgs {
    /// PostgreSQL connection string.
    #[arg(long, env = "DATABASE_URL")]
    pub database_url: String,

    /// Force reseed (currently informational).
    #[arg(long)]
    pub force: bool,

    /// Drop Acme Corp data before seeding.
    #[arg(long)]
    pub reset: bool,

    /// Print what would be done without writing.
    #[arg(long)]
    pub dry_run: bool,

    /// Run only the seeder with this name (e.g. `calendar`).
    #[arg(long)]
    pub only: Option<String>,
}

/// Run the full seeding pipeline.
///
/// # Errors
///
/// Returns an error when the DB is unreachable or, if the target URL
/// is not localhost, when `SEED_ALLOW_PROD=1` is not set.
pub async fn run_seed(args: SeedArgs) -> anyhow::Result<()> {
    // Safety gate — never seed a remote/prod DB by accident
    if !is_local_url(&args.database_url)
        && std::env::var("SEED_ALLOW_PROD").ok().as_deref() != Some("1")
    {
        anyhow::bail!(
            "Refusing to seed non-local DB ({}). Set SEED_ALLOW_PROD=1 to override.",
            redact(&args.database_url)
        );
    }

    let pool = signapps_db_shared::create_pool(&args.database_url).await?;

    if args.reset {
        tracing::warn!("--reset: dropping Acme Corp data");
        reset_acme_data(&pool).await?;
    }

    let tenant_id = uuid::acme_uuid("tenant", "acme-corp");
    let ctx = SeedContext {
        db: pool,
        tenant_id,
        force: args.force,
        dry_run: args.dry_run,
        users: Arc::new(Mutex::new(HashMap::new())),
        nodes: Arc::new(Mutex::new(HashMap::new())),
    };

    let seeders = seeders::all();
    let mut total_created = 0usize;
    let mut total_skipped = 0usize;
    let mut total_errors = 0usize;

    for s in seeders {
        if let Some(only) = &args.only {
            if s.name() != *only {
                continue;
            }
        }
        tracing::info!(seeder = s.name(), "running seeder");
        match s.run(&ctx).await {
            Ok(report) => {
                tracing::info!(
                    seeder = s.name(),
                    created = report.created,
                    skipped = report.skipped,
                    errors = report.errors.len(),
                    "seeder complete"
                );
                total_created += report.created;
                total_skipped += report.skipped;
                total_errors += report.errors.len();
                for e in &report.errors {
                    tracing::warn!(seeder = s.name(), error = %e, "seeder warning");
                }
            }
            Err(e) => {
                // Best-effort: log and continue to next seeder
                tracing::error!(seeder = s.name(), error = %e, "seeder failed — skipping");
                total_errors += 1;
            }
        }
    }

    tracing::info!(
        created = total_created,
        skipped = total_skipped,
        errors = total_errors,
        "seed complete"
    );

    Ok(())
}

fn is_local_url(url: &str) -> bool {
    url.contains("localhost") || url.contains("127.0.0.1") || url.contains("@postgres")
}

fn redact(url: &str) -> String {
    // Scrub password segment before logging
    if let Some(at) = url.find('@') {
        if let Some(scheme_end) = url.find("://") {
            let head = &url[..scheme_end + 3];
            let tail = &url[at..];
            return format!("{}***{}", head, tail);
        }
    }
    url.to_string()
}

async fn reset_acme_data(pool: &signapps_db_shared::pool::DatabasePool) -> anyhow::Result<()> {
    let tenant_id = uuid::acme_uuid("tenant", "acme-corp");
    // Cascade-delete starting from tenant — best effort, missing tables are ok
    let tables = [
        "DELETE FROM org_assignments WHERE tenant_id = $1",
        "DELETE FROM org_persons WHERE tenant_id = $1",
        "DELETE FROM org_nodes WHERE tenant_id = $1",
        "DELETE FROM identity.users WHERE tenant_id = $1 AND username != 'admin'",
    ];
    for sql in tables.iter() {
        if let Err(e) = sqlx::query(sql).bind(tenant_id).execute(pool.inner()).await {
            tracing::warn!(error = %e, sql = sql, "reset: ignoring non-fatal error");
        }
    }
    Ok(())
}
