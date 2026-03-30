use sqlx::postgres::PgPoolOptions;
use std::time::Duration;

#[tokio::main]
async fn main() {
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://signapps:signapps_dev@127.0.0.1:5432/signapps".to_string());
    println!(
        "Connecting to DB at {} to ANNIHILATE all schemas...",
        database_url
    );
    let pool = PgPoolOptions::new()
        .max_connections(2)
        .acquire_timeout(Duration::from_secs(10))
        .connect(&database_url)
        .await
        .expect("failed to connect to database");

    let schemas = vec![
        "identity",
        "containers",
        "proxy",
        "securelink",
        "storage",
        "documents",
        "scheduler",
        "calendar",
        "collab",
        "mail",
        "ai",
    ];

    for schema in schemas {
        println!("Dropping schema: {}", schema);
        let drop_stmt = format!("DROP SCHEMA IF EXISTS {} CASCADE;", schema);
        let _ = sqlx::query(&drop_stmt).execute(&pool).await;
    }

    println!("Dropping _sqlx_migrations");
    let _ = sqlx::query("DROP TABLE IF EXISTS public._sqlx_migrations CASCADE;")
        .execute(&pool)
        .await;

    println!("All SignApps schemas obliterated successfully!");
}
