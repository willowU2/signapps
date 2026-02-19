use sqlx::postgres::PgPoolOptions;
use std::time::Duration;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let database_url = "postgres://signapps:signapps_dev@localhost:5432/signapps";
    let pool = PgPoolOptions::new()
        .max_connections(1)
        .acquire_timeout(Duration::from_secs(5))
        .connect(database_url)
        .await?;

    println!("Connected to database");

    let rows: Vec<(String, String)> = sqlx::query_as(
        "SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema NOT IN ('information_schema', 'pg_catalog')"
    )
    .fetch_all(&pool)
    .await?;

    println!("Found {} tables:", rows.len());
    for (schema, table) in rows {
        println!(" - {}.{}", schema, table);
    }

    Ok(())
}
