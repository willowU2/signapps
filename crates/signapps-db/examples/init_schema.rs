/// Initialize the basic schema for identity
use sqlx::postgres::PgPoolOptions;
use std::time::Duration;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Connect to database
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://signapps:signapps_dev@localhost:5432/signapps".to_string());

    println!("📡 Connecting to: {}", database_url);

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .acquire_timeout(Duration::from_secs(10))
        .connect(&database_url)
        .await?;

    println!("✅ Connected to database");

    // Create schema
    println!("📋 Creating schema...");
    sqlx::query("CREATE SCHEMA IF NOT EXISTS identity")
        .execute(&pool)
        .await?;

    // Create users table
    println!("📋 Creating users table...");
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS identity.users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            username VARCHAR(64) UNIQUE NOT NULL,
            email VARCHAR(255) UNIQUE,
            password_hash TEXT,
            role SMALLINT NOT NULL DEFAULT 1,
            mfa_secret TEXT,
            mfa_enabled BOOLEAN DEFAULT FALSE,
            auth_provider VARCHAR(32) NOT NULL DEFAULT 'local',
            ldap_dn TEXT,
            ldap_groups TEXT[],
            display_name VARCHAR(255),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            last_login TIMESTAMPTZ
        )"
    )
    .execute(&pool)
    .await?;

    println!("✅ Schema and tables created");

    // Create admin user
    println!("👤 Creating admin user...");
    let password_hash = "$2b$12$kxKqv9HxI8i1R3N5Q8mZIu9I1R3N5Q8mZIu9I1R3N5Q8mZIu9I1R3";

    sqlx::query(
        "INSERT INTO identity.users (username, email, password_hash, role, auth_provider, display_name)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (username) DO UPDATE SET password_hash = $3"
    )
    .bind("admin")
    .bind("admin@signapps.local")
    .bind(password_hash)
    .bind(2i16) // admin role
    .bind("local")
    .bind("Administrator")
    .execute(&pool)
    .await?;

    println!("✅ Admin user created");
    println!("");
    println!("🎉 Database initialization complete!");
    println!("");
    println!("Login credentials:");
    println!("  📧 Username: admin");
    println!("  🔑 Password: admin123");
    println!("");

    Ok(())
}
