//! Verify the post-migrate state: every plaintext token has an
//! encrypted twin AND the encryption is reversible.
//!
//! Exit code 0 on success. Non-zero on any inconsistency. Run before
//! flipping consumers to read from the encrypted columns.
//!
//! Run as: `cargo run --bin oauth-migrate-verify --release`

use anyhow::{bail, Context, Result};
use signapps_keystore::{decrypt_string, DataEncryptionKey, Keystore, KeystoreBackend};
use sqlx::PgPool;
use std::sync::Arc;

/// One column pair to verify: TEXT source and BYTEA target must be in sync.
struct ColumnCheck {
    table: &'static str,
    text_col: &'static str,
    enc_col: &'static str,
}

const CHECKS: &[ColumnCheck] = &[
    ColumnCheck {
        table: "mail.accounts",
        text_col: "oauth_refresh_token",
        enc_col: "oauth_refresh_token_enc",
    },
    ColumnCheck {
        table: "calendar.provider_connections",
        text_col: "access_token",
        enc_col: "access_token_enc",
    },
    ColumnCheck {
        table: "calendar.provider_connections",
        text_col: "refresh_token",
        enc_col: "refresh_token_enc",
    },
    ColumnCheck {
        table: "social.accounts",
        text_col: "access_token",
        enc_col: "access_token_enc",
    },
    ColumnCheck {
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

    let mut bad: i64 = 0;
    for c in CHECKS {
        bad += check_column(&pool, c, &dek).await?;
    }

    if bad > 0 {
        bail!("{bad} inconsistencies found");
    }
    println!("all checks passed");
    Ok(())
}

/// Returns the number of inconsistencies found for this column pair.
async fn check_column(pool: &PgPool, c: &ColumnCheck, dek: &Arc<DataEncryptionKey>) -> Result<i64> {
    // Count rows that still have plaintext but no ciphertext.
    let unmigrated: i64 = sqlx::query_scalar(&format!(
        "SELECT COUNT(*) FROM {} \
         WHERE {} IS NOT NULL AND {} IS NULL",
        c.table, c.text_col, c.enc_col
    ))
    .fetch_one(pool)
    .await
    .with_context(|| format!("COUNT unmigrated in {}.{}", c.table, c.text_col))?;

    if unmigrated > 0 {
        eprintln!(
            "  FAIL {}.{}: {unmigrated} rows still plaintext (no {})",
            c.table, c.text_col, c.enc_col
        );
        return Ok(unmigrated);
    }

    // Spot-check: decrypt a random sample row and verify it matches the plaintext.
    let sample: Option<(String, Vec<u8>)> = sqlx::query_as(&format!(
        "SELECT {text}, {enc} FROM {table} \
         WHERE {text} IS NOT NULL AND {enc} IS NOT NULL \
         ORDER BY random() LIMIT 1",
        text = c.text_col,
        enc = c.enc_col,
        table = c.table
    ))
    .fetch_optional(pool)
    .await
    .with_context(|| format!("sample query for {}.{}", c.table, c.enc_col))?;

    if let Some((pt, ct)) = sample {
        let decrypted = decrypt_string(&ct, dek.as_ref()).context("decrypt sample")?;
        if decrypted != pt {
            eprintln!(
                "  FAIL {}.{}: sample decrypt does not match plaintext",
                c.table, c.enc_col
            );
            return Ok(1);
        }
        println!(
            "  ok {}.{}: all migrated, sample decrypt matches",
            c.table, c.enc_col
        );
    } else {
        println!("  ok {}.{}: 0 rows (nothing to check)", c.table, c.enc_col);
    }

    Ok(0)
}
