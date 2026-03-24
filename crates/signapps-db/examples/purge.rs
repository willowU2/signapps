use sqlx::postgres::PgPoolOptions;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://signapps:signapps_dev@127.0.0.1:5432/signapps".to_string());

    let pool = PgPoolOptions::new()
        .max_connections(2)
        .connect(&database_url)
        .await?;

    println!("Connected to DB. Purging all schemas...");

    // Drop all schemas except pg_* and information_schema
    let schemas = vec!["identity", "drive", "chat", "scheduling", "ai", "workforce"];

    for schema in &schemas {
        let query = format!("DROP SCHEMA IF EXISTS {} CASCADE", schema);
        match sqlx::query(&query).execute(&pool).await {
            Ok(_) => println!("Dropped schema: {}", schema),
            Err(e) => println!("Could not drop schema {}: {}", schema, e),
        }
    }

    // Reset public schema
    sqlx::query("DROP SCHEMA IF EXISTS public CASCADE")
        .execute(&pool)
        .await?;
    sqlx::query("CREATE SCHEMA public").execute(&pool).await?;
    sqlx::query("GRANT ALL ON SCHEMA public TO signapps")
        .execute(&pool)
        .await?;
    println!("Reset public schema");

    // Clear sqlx migrations table
    sqlx::query("DROP TABLE IF EXISTS _sqlx_migrations")
        .execute(&pool)
        .await?;
    println!("Cleared migrations table");

    println!("\n✅ Database purged successfully! Restart services to run migrations.");

    Ok(())
}
