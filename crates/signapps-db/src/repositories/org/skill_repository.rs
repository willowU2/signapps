//! CRUD for `org_skills` and `org_person_skills` — SO3 scale & power.

use anyhow::Result;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::org::{PersonSkill, PersonSkillWithName, Skill, SkillCategory};

/// Repository for the canonical skills + person-skills tables.
pub struct SkillRepository<'a> {
    pool: &'a PgPool,
}

impl<'a> SkillRepository<'a> {
    /// Construct a new repository bound to the given pool.
    pub fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    // ─── Skills catalog ─────────────────────────────────────────────

    /// List skills : global (tenant_id NULL) + those of the tenant, optionally
    /// filtered by category.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn list(
        &self,
        tenant_id: Option<Uuid>,
        category: Option<SkillCategory>,
    ) -> Result<Vec<Skill>> {
        let rows = match (tenant_id, category) {
            (Some(t), Some(cat)) => sqlx::query_as::<_, Skill>(
                "SELECT * FROM org_skills
                 WHERE (tenant_id IS NULL OR tenant_id = $1)
                   AND category = $2
                 ORDER BY category, name",
            )
            .bind(t)
            .bind(cat)
            .fetch_all(self.pool)
            .await?,
            (Some(t), None) => sqlx::query_as::<_, Skill>(
                "SELECT * FROM org_skills
                 WHERE (tenant_id IS NULL OR tenant_id = $1)
                 ORDER BY category, name",
            )
            .bind(t)
            .fetch_all(self.pool)
            .await?,
            (None, Some(cat)) => sqlx::query_as::<_, Skill>(
                "SELECT * FROM org_skills
                 WHERE tenant_id IS NULL AND category = $1
                 ORDER BY category, name",
            )
            .bind(cat)
            .fetch_all(self.pool)
            .await?,
            (None, None) => sqlx::query_as::<_, Skill>(
                "SELECT * FROM org_skills
                 WHERE tenant_id IS NULL
                 ORDER BY category, name",
            )
            .fetch_all(self.pool)
            .await?,
        };
        Ok(rows)
    }

    /// Fetch one skill by primary key.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn get(&self, id: Uuid) -> Result<Option<Skill>> {
        let row = sqlx::query_as::<_, Skill>("SELECT * FROM org_skills WHERE id = $1")
            .bind(id)
            .fetch_optional(self.pool)
            .await?;
        Ok(row)
    }

    /// Create or update (by `(tenant_id, slug)`) a skill — used by seed.
    ///
    /// `tenant_id = None` creates a global skill.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn upsert(
        &self,
        tenant_id: Option<Uuid>,
        slug: &str,
        name: &str,
        category: SkillCategory,
        description: Option<&str>,
    ) -> Result<Skill> {
        // Tenant_id NULL a un comportement particulier côté ON CONFLICT :
        // UNIQUE(tenant_id, slug) avec NULL est traité comme deux rows
        // distincts en Postgres par défaut (NULL != NULL). On émule donc
        // un upsert manuel via SELECT + INSERT/UPDATE.
        if let Some(existing) = self
            .get_by_slug_and_tenant(tenant_id, slug)
            .await?
        {
            let row = sqlx::query_as::<_, Skill>(
                "UPDATE org_skills
                    SET name = $2, category = $3, description = $4
                  WHERE id = $1
                  RETURNING *",
            )
            .bind(existing.id)
            .bind(name)
            .bind(category)
            .bind(description)
            .fetch_one(self.pool)
            .await?;
            return Ok(row);
        }

        let row = sqlx::query_as::<_, Skill>(
            "INSERT INTO org_skills (tenant_id, slug, name, category, description)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *",
        )
        .bind(tenant_id)
        .bind(slug)
        .bind(name)
        .bind(category)
        .bind(description)
        .fetch_one(self.pool)
        .await?;
        Ok(row)
    }

    /// Fetch by `(tenant_id, slug)` — helper for the upsert above.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn get_by_slug_and_tenant(
        &self,
        tenant_id: Option<Uuid>,
        slug: &str,
    ) -> Result<Option<Skill>> {
        let row = match tenant_id {
            Some(t) => sqlx::query_as::<_, Skill>(
                "SELECT * FROM org_skills WHERE tenant_id = $1 AND slug = $2",
            )
            .bind(t)
            .bind(slug)
            .fetch_optional(self.pool)
            .await?,
            None => sqlx::query_as::<_, Skill>(
                "SELECT * FROM org_skills WHERE tenant_id IS NULL AND slug = $1",
            )
            .bind(slug)
            .fetch_optional(self.pool)
            .await?,
        };
        Ok(row)
    }

    // ─── Person skills ─────────────────────────────────────────────

    /// List every skill of a person (joined with the skill catalog).
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn list_by_person(&self, person_id: Uuid) -> Result<Vec<PersonSkillWithName>> {
        let rows = sqlx::query_as::<_, PersonSkillWithName>(
            "SELECT s.id AS skill_id, s.slug, s.name, s.category::text AS category,
                    ps.level, ps.endorsed_by_person_id
             FROM org_person_skills ps
             JOIN org_skills s ON s.id = ps.skill_id
             WHERE ps.person_id = $1
             ORDER BY s.category, s.name",
        )
        .bind(person_id)
        .fetch_all(self.pool)
        .await?;
        Ok(rows)
    }

    /// Upsert a (person, skill, level) tag.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error (FK, level CHECK).
    pub async fn tag(
        &self,
        person_id: Uuid,
        skill_id: Uuid,
        level: i16,
    ) -> Result<PersonSkill> {
        let row = sqlx::query_as::<_, PersonSkill>(
            "INSERT INTO org_person_skills (person_id, skill_id, level)
             VALUES ($1, $2, $3)
             ON CONFLICT (person_id, skill_id) DO UPDATE SET level = EXCLUDED.level
             RETURNING *",
        )
        .bind(person_id)
        .bind(skill_id)
        .bind(level)
        .fetch_one(self.pool)
        .await?;
        Ok(row)
    }

    /// Remove a (person, skill) tag.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn untag(&self, person_id: Uuid, skill_id: Uuid) -> Result<()> {
        sqlx::query(
            "DELETE FROM org_person_skills WHERE person_id = $1 AND skill_id = $2",
        )
        .bind(person_id)
        .bind(skill_id)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    /// Record an endorsement (someone attests of the level).
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn endorse(
        &self,
        person_id: Uuid,
        skill_id: Uuid,
        endorser_person_id: Uuid,
    ) -> Result<Option<PersonSkill>> {
        let row = sqlx::query_as::<_, PersonSkill>(
            "UPDATE org_person_skills
                SET endorsed_by_person_id = $3
              WHERE person_id = $1 AND skill_id = $2
              RETURNING *",
        )
        .bind(person_id)
        .bind(skill_id)
        .bind(endorser_person_id)
        .fetch_optional(self.pool)
        .await?;
        Ok(row)
    }
}
