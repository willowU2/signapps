use argon2::{
    password_hash::{rand_core::OsRng, PasswordHasher, SaltString},
    Argon2,
};
use sqlx::postgres::PgPoolOptions;
use std::time::Duration;
use uuid::Uuid;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://signapps:signapps_dev@localhost:5432/signapps".to_string());

    let is_local = database_url.contains("localhost") || database_url.contains("127.0.0.1");

    let password = match std::env::var("SEED_ADMIN_PASSWORD") {
        Ok(p) if !p.is_empty() => p,
        _ => {
            if !is_local {
                eprintln!(
                    "ERROR: SEED_ADMIN_PASSWORD must be set when connecting to a non-local database.\n\
                     Refusing to seed a remote database with the default 'admin' password.\n\
                     Set SEED_ADMIN_PASSWORD=<your_secure_password> and try again."
                );
                std::process::exit(1);
            }
            "admin".to_string()
        },
    };

    let salt = SaltString::generate(&mut OsRng);

    let hash = Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| e.to_string())?
        .to_string();

    println!("Connecting to database for seeding...");
    let pool = PgPoolOptions::new()
        .max_connections(2)
        .acquire_timeout(Duration::from_secs(5))
        .connect(&database_url)
        .await?;

    println!("Seeding users...");

    // Default tenant for signapps
    let _tenant_id = Uuid::nil();

    // 1. Admin
    sqlx::query(
        r#"
        INSERT INTO identity.users (username, email, password_hash, role, auth_provider)
        VALUES ('admin', 'admin@signapps.local', $1, 2, 'local')
        ON CONFLICT (username)
        DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 2
        "#,
    )
    .bind(&hash)
    .execute(&pool)
    .await?;

    // 2. Test User 1
    sqlx::query(
        r#"
        INSERT INTO identity.users (username, email, password_hash, role, auth_provider)
        VALUES ('user1', 'user1@signapps.local', $1, 0, 'local')
        ON CONFLICT (username) DO NOTHING
        "#,
    )
    .bind(&hash)
    .execute(&pool)
    .await?;

    // 3. Test User 2
    sqlx::query(
        r#"
        INSERT INTO identity.users (username, email, password_hash, role, auth_provider)
        VALUES ('user2', 'user2@signapps.local', $1, 0, 'local')
        ON CONFLICT (username) DO NOTHING
        "#,
    )
    .bind(&hash)
    .execute(&pool)
    .await?;

    println!("✅ Database seeded with default E2E users (admin, user1, user2). Password: admin");

    Ok(())
}
