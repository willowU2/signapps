//! PersonRepository — person (Party Model) operations.

use crate::models::core_org::{CreatePerson, CreatePersonRole, Person, PersonRole, UpdatePerson};
use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

/// Repository for person (Party Model) operations.
pub struct PersonRepository;

impl PersonRepository {
    /// List all active persons for a tenant with pagination.
    pub async fn list(
        pool: &PgPool,
        tenant_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<Person>> {
        let persons = sqlx::query_as::<_, Person>(
            r#"
            SELECT * FROM core.persons
            WHERE tenant_id = $1 AND is_active = TRUE
            ORDER BY last_name, first_name
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(tenant_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(persons)
    }

    /// Create a new person record.
    pub async fn create(pool: &PgPool, input: CreatePerson) -> Result<Person> {
        let person = sqlx::query_as::<_, Person>(
            r#"
            INSERT INTO core.persons
                (tenant_id, first_name, last_name, email, phone, avatar_url, user_id, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, '{}'))
            RETURNING *
            "#,
        )
        .bind(input.tenant_id)
        .bind(&input.first_name)
        .bind(&input.last_name)
        .bind(&input.email)
        .bind(&input.phone)
        .bind(&input.avatar_url)
        .bind(input.user_id)
        .bind(&input.metadata)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(person)
    }

    /// Update an existing person record using COALESCE patching.
    pub async fn update(pool: &PgPool, id: Uuid, input: UpdatePerson) -> Result<Person> {
        let person = sqlx::query_as::<_, Person>(
            r#"
            UPDATE core.persons SET
                first_name  = COALESCE($2, first_name),
                last_name   = COALESCE($3, last_name),
                email       = COALESCE($4, email),
                phone       = COALESCE($5, phone),
                avatar_url  = COALESCE($6, avatar_url),
                is_active   = COALESCE($7, is_active),
                metadata    = COALESCE($8, metadata),
                updated_at  = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(&input.first_name)
        .bind(&input.last_name)
        .bind(&input.email)
        .bind(&input.phone)
        .bind(&input.avatar_url)
        .bind(input.is_active)
        .bind(&input.metadata)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(person)
    }

    /// Find a person by primary key.
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Option<Person>> {
        let person = sqlx::query_as::<_, Person>("SELECT * FROM core.persons WHERE id = $1")
            .bind(id)
            .fetch_optional(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(person)
    }

    /// Find a person by their linked platform user account.
    pub async fn find_by_user_id(pool: &PgPool, user_id: Uuid) -> Result<Option<Person>> {
        let person = sqlx::query_as::<_, Person>("SELECT * FROM core.persons WHERE user_id = $1")
            .bind(user_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(person)
    }

    /// Full-text search over first name, last name and email (case-insensitive).
    pub async fn search(
        pool: &PgPool,
        tenant_id: Uuid,
        query: &str,
        limit: i64,
    ) -> Result<Vec<Person>> {
        let pattern = format!("%{}%", query.to_lowercase());
        let persons = sqlx::query_as::<_, Person>(
            r#"
            SELECT * FROM core.persons
            WHERE tenant_id = $1
              AND is_active = TRUE
              AND (
                  lower(first_name) LIKE $2
                  OR lower(last_name) LIKE $2
                  OR lower(COALESCE(email, '')) LIKE $2
              )
            ORDER BY last_name, first_name
            LIMIT $3
            "#,
        )
        .bind(tenant_id)
        .bind(&pattern)
        .bind(limit)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(persons)
    }

    /// Add a role to a person (idempotent — unique constraint handles duplicates gracefully).
    pub async fn add_role(pool: &PgPool, input: CreatePersonRole) -> Result<PersonRole> {
        let role = sqlx::query_as::<_, PersonRole>(
            r#"
            INSERT INTO core.person_roles (person_id, role_type, metadata)
            VALUES ($1, $2::core.person_role_type, COALESCE($3, '{}'))
            ON CONFLICT (person_id, role_type) DO UPDATE SET is_active = TRUE
            RETURNING *
            "#,
        )
        .bind(input.person_id)
        .bind(&input.role_type)
        .bind(&input.metadata)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(role)
    }

    /// Soft-remove a role from a person (sets is_active = FALSE).
    pub async fn remove_role(pool: &PgPool, person_id: Uuid, role_type: &str) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE core.person_roles SET is_active = FALSE
            WHERE person_id = $1 AND role_type = $2::core.person_role_type
            "#,
        )
        .bind(person_id)
        .bind(role_type)
        .execute(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }

    /// Link a person record to a platform user account.
    pub async fn link_user(pool: &PgPool, person_id: Uuid, user_id: Uuid) -> Result<Person> {
        let person = sqlx::query_as::<_, Person>(
            "UPDATE core.persons SET user_id = $2, updated_at = NOW() WHERE id = $1 RETURNING *",
        )
        .bind(person_id)
        .bind(user_id)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(person)
    }

    /// Unlink a person record from its platform user account.
    pub async fn unlink_user(pool: &PgPool, person_id: Uuid) -> Result<Person> {
        let person = sqlx::query_as::<_, Person>(
            "UPDATE core.persons SET user_id = NULL, updated_at = NOW() WHERE id = $1 RETURNING *",
        )
        .bind(person_id)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(person)
    }

    /// List all active roles for a person.
    pub async fn list_roles(pool: &PgPool, person_id: Uuid) -> Result<Vec<PersonRole>> {
        let roles = sqlx::query_as::<_, PersonRole>(
            "SELECT * FROM core.person_roles WHERE person_id = $1 AND is_active = TRUE",
        )
        .bind(person_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(roles)
    }
}
