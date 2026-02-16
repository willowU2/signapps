/// Update admin user password hash
use sqlx::postgres::PgPoolOptions;
use std::time::Duration;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://signapps:signapps_dev@localhost:5432/signapps".to_string());

    println!("📡 Connecting to: {}", database_url);

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .acquire_timeout(Duration::from_secs(10))
        .connect(&database_url)
        .await?;

    println!("✅ Connected to database");

    // Valid Argon2 hash for 'admin123'
    let password_hash = "$argon2id$v=19$m=19456,t=2,p=1$Bq60YiBLBu7o2GMdWtrEgA$hx1l42r8OvZcZuYzVZXSqvEhrF2QrSdepmC68QGhimQ";

    sqlx::query("UPDATE identity.users SET password_hash = $1 WHERE username = 'admin'")
        .bind(password_hash)
        .execute(&pool)
        .await?;

    println!("✅ Admin password hash updated");
    println!("");
    println!("🎉 Login credentials are now valid:");
    println!("   📧 Username: admin");
    println!("   🔑 Password: admin123");
    println!("");

    Ok(())
}
