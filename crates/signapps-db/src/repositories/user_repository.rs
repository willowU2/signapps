//! User repository for database operations.

use crate::models::{CreateUser, UpdateUser, User};
use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

/// Repository for user operations.
pub struct UserRepository;

impl UserRepository {
    /// Find user by ID.
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Option<User>> {
        let user = sqlx::query_as::<_, User>("SELECT * FROM identity.users WHERE id = $1")
            .bind(id)
            .fetch_optional(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;

        Ok(user)
    }

    /// Find user by username.
    pub async fn find_by_username(pool: &PgPool, username: &str) -> Result<Option<User>> {
        let user = sqlx::query_as::<_, User>("SELECT * FROM identity.users WHERE username = $1")
            .bind(username)
            .fetch_optional(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;

        Ok(user)
    }

    /// Find user by email.
    pub async fn find_by_email(pool: &PgPool, email: &str) -> Result<Option<User>> {
        let user = sqlx::query_as::<_, User>("SELECT * FROM identity.users WHERE email = $1")
            .bind(email)
            .fetch_optional(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;

        Ok(user)
    }

    /// List all users with pagination.
    pub async fn list(pool: &PgPool, limit: i64, offset: i64) -> Result<Vec<User>> {
        let users = sqlx::query_as::<_, User>(
            "SELECT * FROM identity.users ORDER BY created_at DESC LIMIT $1 OFFSET $2",
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(users)
    }

    /// Count all users.
    pub async fn count(pool: &PgPool) -> Result<i64> {
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM identity.users")
            .fetch_one(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;

        Ok(count.0)
    }

    /// Create a new user.
    pub async fn create(pool: &PgPool, user: CreateUser) -> Result<User> {
        let created = sqlx::query_as::<_, User>(
            r#"
            INSERT INTO identity.users (
                username, email, password_hash, display_name, role,
                auth_provider, ldap_dn, ldap_groups
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
            "#,
        )
        .bind(&user.username)
        .bind(&user.email)
        .bind(&user.password)
        .bind(&user.display_name)
        .bind(user.role)
        .bind(&user.auth_provider)
        .bind(&user.ldap_dn)
        .bind(&user.ldap_groups)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(created)
    }

    /// Create a new user with password hash.
    pub async fn create_with_hash(
        pool: &PgPool,
        user: CreateUser,
        password_hash: &str,
    ) -> Result<User> {
        let created = sqlx::query_as::<_, User>(
            r#"
            INSERT INTO identity.users (
                username, email, password_hash, display_name, role,
                auth_provider, ldap_dn, ldap_groups
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
            "#,
        )
        .bind(&user.username)
        .bind(&user.email)
        .bind(password_hash)
        .bind(&user.display_name)
        .bind(user.role)
        .bind(&user.auth_provider)
        .bind(&user.ldap_dn)
        .bind(&user.ldap_groups)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(created)
    }

    /// Update a user.
    pub async fn update(pool: &PgPool, id: Uuid, update: UpdateUser) -> Result<User> {
        let updated = sqlx::query_as::<_, User>(
            r#"
            UPDATE identity.users
            SET email = COALESCE($2, email),
                display_name = COALESCE($3, display_name),
                role = COALESCE($4, role),
                ldap_dn = COALESCE($5, ldap_dn),
                ldap_groups = COALESCE($6, ldap_groups),
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(&update.email)
        .bind(&update.display_name)
        .bind(update.role)
        .bind(&update.ldap_dn)
        .bind(&update.ldap_groups)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(updated)
    }

    /// Update password.
    pub async fn update_password(pool: &PgPool, id: Uuid, password_hash: &str) -> Result<()> {
        sqlx::query(
            "UPDATE identity.users SET password_hash = $2, updated_at = NOW() WHERE id = $1",
        )
        .bind(id)
        .bind(password_hash)
        .execute(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(())
    }

    /// Delete a user.
    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM identity.users WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;

        Ok(())
    }

    /// Update last login timestamp.
    pub async fn update_last_login(pool: &PgPool, id: Uuid) -> Result<()> {
        sqlx::query("UPDATE identity.users SET last_login = NOW() WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;

        Ok(())
    }

    /// Enable MFA for user.
    pub async fn enable_mfa(pool: &PgPool, id: Uuid, secret: &str) -> Result<()> {
        sqlx::query("UPDATE identity.users SET mfa_enabled = TRUE, mfa_secret = $2 WHERE id = $1")
            .bind(id)
            .bind(secret)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;

        Ok(())
    }

    /// Disable MFA for user.
    pub async fn disable_mfa(pool: &PgPool, id: Uuid) -> Result<()> {
        sqlx::query(
            "UPDATE identity.users SET mfa_enabled = FALSE, mfa_secret = NULL WHERE id = $1",
        )
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(())
    }

    /// List users by auth provider.
    pub async fn list_by_provider(pool: &PgPool, provider: &str) -> Result<Vec<User>> {
        let users = sqlx::query_as::<_, User>(
            "SELECT * FROM identity.users WHERE auth_provider = $1 ORDER BY username",
        )
        .bind(provider)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(users)
    }

    /// Set user's default tenant.
    pub async fn set_tenant(pool: &PgPool, user_id: Uuid, tenant_id: Uuid) -> Result<User> {
        let updated = sqlx::query_as::<_, User>(
            "UPDATE identity.users SET tenant_id = $2, updated_at = NOW() WHERE id = $1 RETURNING *",
        )
        .bind(user_id)
        .bind(tenant_id)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        Ok(updated)
    }
}
