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

    let schemas = vec![
        "identity", "containers", "proxy", "securelink", "storage",
        "ai", "calendar", "scheduler", "documents", "monitoring"
    ];

    for schema in schemas {
        print!("Dropping schema {}... ", schema);
        match sqlx::query(&format!("DROP SCHEMA IF EXISTS {} CASCADE", schema))
            .execute(&pool)
            .await {
                Ok(_) => println!("SUCCESS"),
                Err(e) => println!("FAILED: {}", e),
            }
    }

    println!("Dropping _sqlx_migrations table...");
    let _ = sqlx::query("DROP TABLE IF EXISTS _sqlx_migrations CASCADE").execute(&pool).await;
    
    println!("Dropping residual public tables...");
    let public_tables = vec!["devices", "calendar_events", "calendar_tasks"];
    for table in public_tables {
        let _ = sqlx::query(&format!("DROP TABLE IF EXISTS public.{} CASCADE", table)).execute(&pool).await;
    }

    println!("Cleanup completed!");
    Ok(())
}
