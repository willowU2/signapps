use argon2::{
    password_hash::{rand_core::OsRng, PasswordHasher, SaltString},
    Argon2,
};
use sqlx::postgres::PgPoolOptions;
use std::time::Duration;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let password = "password123";
    let salt = SaltString::generate(&mut OsRng);

    // Explicitly using signapps_identity configuration logic if needed,
    // otherwise the standard Argon2id default.
    let hash = Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| e.to_string())?
        .to_string();

    println!("Generated hash for password123: {}", hash);

    let database_url = "postgres://signapps:signapps_dev@localhost:5432/signapps";
    let pool = PgPoolOptions::new()
        .max_connections(2)
        .acquire_timeout(Duration::from_secs(5))
        .connect(database_url)
        .await?;

    sqlx::query(
        r#"
        INSERT INTO identity.users (username, email, password_hash, role, auth_provider)
        VALUES ('admin', 'admin@signapps.local', $1, 1, 'local')
        ON CONFLICT (username) 
        DO UPDATE SET password_hash = EXCLUDED.password_hash
        "#,
    )
    .bind(&hash)
    .execute(&pool)
    .await?;

    println!("Database updated for admin.");

    Ok(())
}
