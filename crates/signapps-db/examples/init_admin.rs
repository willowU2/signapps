use argon2::{
    password_hash::{rand_core::OsRng, PasswordHasher, SaltString},
    Argon2,
};
use sqlx::postgres::PgPoolOptions;
use std::time::Duration;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://signapps:signapps_dev@localhost:5432/signapps".to_string());

    let pool = PgPoolOptions::new()
        .max_connections(1)
        .acquire_timeout(Duration::from_secs(5))
        .connect(&database_url)
        .await?;

    println!("Connected to database");

    // Check existing admin users
    let count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM identity.users WHERE username = 'admin'"
    )
    .fetch_one(&pool)
    .await?;
    println!("Found {} admin user(s)", count.0);

    // Generate Argon2 hash for TestPass123
    let password = "TestPass123";
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| format!("Hash failed: {}", e))?
        .to_string();

    println!("Generated Argon2 hash: {}...", &hash[..30]);

    if count.0 == 0 {
        // Insert new admin
        sqlx::query(
            "INSERT INTO identity.users (username, email, password_hash, role, auth_provider, display_name)
             VALUES ('admin', 'admin@signapps.local', $1, 2, 'local', 'Administrator')"
        )
        .bind(&hash)
        .execute(&pool)
        .await?;
        println!("Created new admin user");
    } else {
        // Force update ALL admin users with new hash
        let result = sqlx::query(
            "UPDATE identity.users SET password_hash = $1 WHERE username = 'admin'"
        )
        .bind(&hash)
        .execute(&pool)
        .await?;
        println!("Updated {} admin user(s) with new Argon2 hash", result.rows_affected());
    }

    // Verify
    let verify: (Option<String>,) = sqlx::query_as(
        "SELECT LEFT(password_hash, 10) FROM identity.users WHERE username = 'admin' LIMIT 1"
    )
    .fetch_one(&pool)
    .await?;
    println!("Verification - hash starts with: {}", verify.0.unwrap_or_default());
    println!("Admin password set to: {}", password);
    
    Ok(())
}
