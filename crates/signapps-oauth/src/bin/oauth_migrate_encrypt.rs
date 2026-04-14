//! Encrypt existing plaintext OAuth tokens into the new BYTEA columns.
//!
//! Reads `DATABASE_URL` and `KEYSTORE_MASTER_KEY` from env. Idempotent:
//! processes rows where `*_enc IS NULL AND <text> IS NOT NULL`.
//!
//! Run as: `cargo run --bin oauth-migrate-encrypt --release`

use anyhow::{Context, Result};
use signapps_keystore::{encrypt_string, DataEncryptionKey, Keystore, KeystoreBackend};
use sqlx::PgPool;
use std::sync::Arc;

/// One column pair to migrate: its TEXT source and BYTEA target.
struct ColumnMigration {
    table: &'static str,
    text_col: &'static str,
    enc_col: &'static str,
}

const MIGRATIONS: &[ColumnMigration] = &[
    // mail.accounts had only oauth_refresh_token; the new oauth_access_token_enc
    // has no plaintext source so we skip it here (no rows to migrate).
    ColumnMigration {
        table: "mail.accounts",
        text_col: "oauth_refresh_token",
        enc_col: "oauth_refresh_token_enc",
    },
    ColumnMigration {
        table: "calendar.provider_connections",
        text_col: "access_token",
        enc_col: "access_token_enc",
    },
    ColumnMigration {
        table: "calendar.provider_connections",
        text_col: "refresh_token",
        enc_col: "refresh_token_enc",
    },
    ColumnMigration {
        table: "social.accounts",
        text_col: "access_token",
        enc_col: "access_token_enc",
    },
    ColumnMigration {
        table: "social.accounts",
        text_col: "refresh_token",
        enc_col: "refresh_token_enc",
    },
];

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();

    let database_url = std::env::var("DATABASE_URL").context("DATABASE_URL not set")?;
    let pool = PgPool::connect(&database_url)
        .await
        .context("connect to Postgres")?;
    let keystore = Arc::new(
        Keystore::init(KeystoreBackend::EnvVar)
            .await
            .context("Keystore::init — is KEYSTORE_MASTER_KEY set?")?,
    );
    let dek = keystore.dek("oauth-tokens-v1");

    let mut total_migrated = 0;
    for col in MIGRATIONS {
        let n = migrate_column(&pool, col, &dek).await?;
        total_migrated += n;
        println!(
            "  ok {}.{} -> {}: {} rows migrated",
            col.table, col.text_col, col.enc_col, n
        );
    }
    println!("done -- {total_migrated} rows total");
    Ok(())
}

async fn migrate_column(
    pool: &PgPool,
    col: &ColumnMigration,
    dek: &Arc<DataEncryptionKey>,
) -> Result<usize> {
    // Fetch un-migrated rows: plaintext present, ciphertext absent.
    let select_sql = format!(
        "SELECT id, {text} FROM {table} \
         WHERE {text} IS NOT NULL AND {enc} IS NULL",
        table = col.table,
        text = col.text_col,
        enc = col.enc_col
    );
    let rows: Vec<(uuid::Uuid, String)> = sqlx::query_as(&select_sql)
        .fetch_all(pool)
        .await
        .with_context(|| format!("SELECT from {}.{}", col.table, col.text_col))?;

    if rows.is_empty() {
        return Ok(0);
    }

    let update_sql = format!(
        "UPDATE {table} SET {enc} = $1 WHERE id = $2",
        table = col.table,
        enc = col.enc_col
    );

    let mut count = 0;
    for (id, plaintext) in rows {
        let ct = encrypt_string(&plaintext, dek.as_ref())
            .with_context(|| format!("encrypt {}.{} id={id}", col.table, col.text_col))?;
        sqlx::query(&update_sql)
            .bind(&ct)
            .bind(id)
            .execute(pool)
            .await
            .with_context(|| format!("UPDATE {}.{} id={id}", col.table, col.enc_col))?;
        count += 1;
    }
    Ok(count)
}
