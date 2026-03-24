use sqlx::postgres::PgPoolOptions;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://signapps:signapps@localhost:5432/signapps".to_string());

    let pool = PgPoolOptions::new()
        .max_connections(2)
        .connect(&database_url)
        .await?;

    println!("Connected to DB. Forcefully terminating other connections to release locks...");

    // Kill all other connections to the database to release any stuck locks.
    let result = sqlx::query(
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'signapps' AND pid <> pg_backend_pid();"
    )
    .execute(&pool)
    .await;

    match result {
        Ok(_) => println!("Successfully sent terminate signals."),
        Err(e) => println!("Error terminating connections: {}", e),
    }

    Ok(())
}
