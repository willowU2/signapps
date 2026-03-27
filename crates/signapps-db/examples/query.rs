use signapps_db::DatabasePool;
use sqlx::postgres::PgPoolOptions;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let database_url = "postgres://signapps:signapps_dev@localhost:5432/signapps";
    let pool = PgPoolOptions::new().max_connections(1).connect(database_url).await?;

    let count: (i64,) = sqlx::query_as("SELECT count(*) FROM pg_tables WHERE tablename = 'contacts'")
        .fetch_one(&pool)
        .await?;
    
    println!("contacts table count: {}", count.0);
    Ok(())
}
