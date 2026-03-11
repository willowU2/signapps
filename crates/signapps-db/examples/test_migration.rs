use sqlx::postgres::PgPoolOptions;
use std::fs;
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

    let migration_sql = fs::read_to_string("migrations/001_initial_schema.sql")?;
    println!("Read migration file ({} bytes)", migration_sql.len());

    println!("Executing migration...");
    match sqlx::query(&migration_sql).execute(&pool).await {
        Ok(_) => println!("Migration SUCCESS!"),
        Err(e) => {
            println!("Migration FAILED!");
            println!("Error: {:?}", e);
            if let Some(db_err) = e.as_database_error() {
                println!("Message: {}", db_err.message());
                println!("Code: {:?}", db_err.code());
                println!("Table: {:?}", db_err.table());
                println!("Constraint: {:?}", db_err.constraint());
            }
        },
    }

    Ok(())
}
