//! Identity seeder — creates 15 local users (pwd `Demo1234!`) aligned with OrgSeeder.

use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::seeders::org::{bump, PERSONS};
use crate::uuid::acme_uuid;
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHasher, SaltString},
    Argon2,
};
use async_trait::async_trait;

/// Seeds one `identity.users` row per person with Argon2-hashed password.
pub struct IdentitySeeder;

#[async_trait]
impl Seeder for IdentitySeeder {
    fn name(&self) -> &'static str {
        "identity"
    }

    fn dependencies(&self) -> Vec<&'static str> {
        vec!["org"]
    }

    async fn run(&self, ctx: &SeedContext) -> anyhow::Result<SeedReport> {
        let mut report = SeedReport::default();
        let pool = ctx.db.inner();

        // Hash the demo password once — all 15 users share it.
        let salt = SaltString::generate(&mut OsRng);
        let hash = Argon2::default()
            .hash_password(b"Demo1234!", &salt)
            .map_err(|e| anyhow::anyhow!("argon2: {e}"))?
            .to_string();

        for (username, first_name, last_name, email, _ou, title) in PERSONS.iter() {
            let user_id = acme_uuid("user", username);
            let display_name = format!("{} {}", first_name, last_name);

            // Upsert email + display_name + job_title so existing rows get
            // migrated to the Nexus Industries naming (legacy @acme.corp →
            // @nexus.corp). Password hash stays stable on conflict so
            // sessions don't break.
            let res = sqlx::query(
                r#"
                INSERT INTO identity.users
                    (id, username, email, password_hash, role, auth_provider, display_name, tenant_id, job_title)
                VALUES ($1, $2, $3, $4, 1, 'local', $5, $6, $7)
                ON CONFLICT (id) DO UPDATE SET
                    email = EXCLUDED.email,
                    display_name = EXCLUDED.display_name,
                    job_title = EXCLUDED.job_title,
                    tenant_id = EXCLUDED.tenant_id
                "#,
            )
            .bind(user_id)
            .bind(username)
            .bind(email)
            .bind(&hash)
            .bind(&display_name)
            .bind(ctx.tenant_id)
            .bind(title)
            .execute(pool)
            .await;
            bump(&mut report, res, "user");
            ctx.register_user(username, user_id);
        }

        Ok(report)
    }
}
