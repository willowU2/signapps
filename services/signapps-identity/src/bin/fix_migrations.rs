use sqlx::postgres::PgPoolOptions;
use std::time::Duration;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://signapps:signapps_dev@localhost:5432/signapps".to_string());

    println!("Connecting to database...");
    let pool = PgPoolOptions::new()
        .max_connections(2)
        .acquire_timeout(Duration::from_secs(5))
        .connect(&database_url)
        .await?;

    // Add missing ENUM values
    println!("Adding 'spreadsheet' to drive.node_type...");
    sqlx::query("ALTER TYPE drive.node_type ADD VALUE IF NOT EXISTS 'spreadsheet'")
        .execute(&pool).await?;

    println!("Adding 'presentation' to drive.node_type...");
    sqlx::query("ALTER TYPE drive.node_type ADD VALUE IF NOT EXISTS 'presentation'")
        .execute(&pool).await?;

    // Update check constraint
    println!("Updating check constraint...");
    let _ = sqlx::query("ALTER TABLE drive.nodes DROP CONSTRAINT IF EXISTS chk_target_id_presence")
        .execute(&pool).await;
    sqlx::query(
        "ALTER TABLE drive.nodes ADD CONSTRAINT chk_target_id_presence CHECK (\
            (node_type = 'folder' AND target_id IS NULL) OR \
            (node_type IN ('file', 'document', 'spreadsheet', 'presentation') AND target_id IS NOT NULL)\
        )"
    ).execute(&pool).await?;

    // Add workspace_id column if missing
    println!("Ensuring workspace_id column exists...");
    sqlx::query("ALTER TABLE drive.nodes ADD COLUMN IF NOT EXISTS workspace_id UUID")
        .execute(&pool).await?;

    println!("✅ All drive migrations applied successfully!");
    Ok(())
}
