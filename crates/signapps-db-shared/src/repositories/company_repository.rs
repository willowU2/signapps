//! CompanyRepository -- CRUD for `core.companies`, `core.person_companies`,
//! and `identity.login_contexts`.

use crate::models::{
    Company, CreateCompany, CreatePersonCompany, LoginContext, LoginContextDisplay, PersonCompany,
    UpdateCompany, UpdatePersonCompany,
};
use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

/// Repository for the unified person-model schemas (`core.*` and `identity.login_contexts`).
pub struct CompanyRepository;

impl CompanyRepository {
    // ========================================================================
    // Companies
    // ========================================================================

    /// List companies for a tenant, optionally filtered by `company_type`.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure.
    ///
    /// # Panics
    ///
    /// No panics possible -- all errors are propagated via `Result`.
    pub async fn list(
        pool: &PgPool,
        tenant_id: Uuid,
        company_type: Option<&str>,
    ) -> Result<Vec<Company>> {
        let rows = if let Some(ct) = company_type {
            sqlx::query_as::<_, Company>(
                r#"SELECT * FROM core.companies
                   WHERE tenant_id = $1 AND company_type = $2 AND is_active = TRUE
                   ORDER BY name"#,
            )
            .bind(tenant_id)
            .bind(ct)
            .fetch_all(pool)
            .await
        } else {
            sqlx::query_as::<_, Company>(
                r#"SELECT * FROM core.companies
                   WHERE tenant_id = $1 AND is_active = TRUE
                   ORDER BY name"#,
            )
            .bind(tenant_id)
            .fetch_all(pool)
            .await
        }
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(rows)
    }

    /// Find a company by its ID.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure.
    ///
    /// # Panics
    ///
    /// No panics possible -- all errors are propagated via `Result`.
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Option<Company>> {
        let row = sqlx::query_as::<_, Company>("SELECT * FROM core.companies WHERE id = $1")
            .bind(id)
            .fetch_optional(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(row)
    }

    /// Create a new company.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on constraint violations.
    ///
    /// # Panics
    ///
    /// No panics possible -- all errors are propagated via `Result`.
    pub async fn create(pool: &PgPool, tenant_id: Uuid, input: CreateCompany) -> Result<Company> {
        let row = sqlx::query_as::<_, Company>(
            r#"INSERT INTO core.companies (
                tenant_id, name, company_type, legal_name, siren, siret, vat_number,
                registration_number, address_line1, address_line2, city, postal_code,
                country, website, logo_url, industry, employee_count_range,
                annual_revenue_range, default_currency, metadata
               ) VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                $8, $9, $10, $11, $12,
                COALESCE($13, 'FR'), $14, $15, $16, $17,
                $18, COALESCE($19, 'EUR'), COALESCE($20, '{}')
               )
               RETURNING *"#,
        )
        .bind(tenant_id)
        .bind(&input.name)
        .bind(&input.company_type)
        .bind(&input.legal_name)
        .bind(&input.siren)
        .bind(&input.siret)
        .bind(&input.vat_number)
        .bind(&input.registration_number)
        .bind(&input.address_line1)
        .bind(&input.address_line2)
        .bind(&input.city)
        .bind(&input.postal_code)
        .bind(&input.country)
        .bind(&input.website)
        .bind(&input.logo_url)
        .bind(&input.industry)
        .bind(&input.employee_count_range)
        .bind(&input.annual_revenue_range)
        .bind(&input.default_currency)
        .bind(&input.metadata)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(row)
    }

    /// Update an existing company.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure.
    /// Returns `Error::NotFound` if no row was updated.
    ///
    /// # Panics
    ///
    /// No panics possible -- all errors are propagated via `Result`.
    pub async fn update(pool: &PgPool, id: Uuid, input: UpdateCompany) -> Result<Company> {
        let row = sqlx::query_as::<_, Company>(
            r#"UPDATE core.companies SET
                name                 = COALESCE($2,  name),
                company_type         = COALESCE($3,  company_type),
                legal_name           = COALESCE($4,  legal_name),
                siren                = COALESCE($5,  siren),
                siret                = COALESCE($6,  siret),
                vat_number           = COALESCE($7,  vat_number),
                registration_number  = COALESCE($8,  registration_number),
                address_line1        = COALESCE($9,  address_line1),
                address_line2        = COALESCE($10, address_line2),
                city                 = COALESCE($11, city),
                postal_code          = COALESCE($12, postal_code),
                country              = COALESCE($13, country),
                website              = COALESCE($14, website),
                logo_url             = COALESCE($15, logo_url),
                industry             = COALESCE($16, industry),
                employee_count_range = COALESCE($17, employee_count_range),
                annual_revenue_range = COALESCE($18, annual_revenue_range),
                default_currency     = COALESCE($19, default_currency),
                is_active            = COALESCE($20, is_active),
                metadata             = COALESCE($21, metadata),
                updated_at           = NOW()
               WHERE id = $1
               RETURNING *"#,
        )
        .bind(id)
        .bind(&input.name)
        .bind(&input.company_type)
        .bind(&input.legal_name)
        .bind(&input.siren)
        .bind(&input.siret)
        .bind(&input.vat_number)
        .bind(&input.registration_number)
        .bind(&input.address_line1)
        .bind(&input.address_line2)
        .bind(&input.city)
        .bind(&input.postal_code)
        .bind(&input.country)
        .bind(&input.website)
        .bind(&input.logo_url)
        .bind(&input.industry)
        .bind(&input.employee_count_range)
        .bind(&input.annual_revenue_range)
        .bind(&input.default_currency)
        .bind(input.is_active)
        .bind(&input.metadata)
        .fetch_one(pool)
        .await
        .map_err(|e| {
            if e.to_string().contains("no rows returned") {
                Error::NotFound(format!("Company {id}"))
            } else {
                Error::Database(e.to_string())
            }
        })?;
        Ok(row)
    }

    /// Soft-deactivate a company (`is_active = FALSE`).
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure.
    /// Returns `Error::NotFound` if no matching row exists.
    ///
    /// # Panics
    ///
    /// No panics possible -- all errors are propagated via `Result`.
    pub async fn deactivate(pool: &PgPool, id: Uuid) -> Result<()> {
        let result = sqlx::query(
            "UPDATE core.companies SET is_active = FALSE, updated_at = NOW() WHERE id = $1",
        )
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        if result.rows_affected() == 0 {
            return Err(Error::NotFound(format!("Company {id}")));
        }
        Ok(())
    }

    // ========================================================================
    // Person-Company affiliations
    // ========================================================================

    /// List all person affiliations for a given company.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure.
    ///
    /// # Panics
    ///
    /// No panics possible -- all errors are propagated via `Result`.
    pub async fn list_persons_for_company(
        pool: &PgPool,
        company_id: Uuid,
    ) -> Result<Vec<PersonCompany>> {
        let rows = sqlx::query_as::<_, PersonCompany>(
            r#"SELECT * FROM core.person_companies
               WHERE company_id = $1
               ORDER BY is_primary DESC, created_at ASC"#,
        )
        .bind(company_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(rows)
    }

    /// List all company affiliations for a given person.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure.
    ///
    /// # Panics
    ///
    /// No panics possible -- all errors are propagated via `Result`.
    pub async fn list_companies_for_person(
        pool: &PgPool,
        person_id: Uuid,
    ) -> Result<Vec<PersonCompany>> {
        let rows = sqlx::query_as::<_, PersonCompany>(
            r#"SELECT * FROM core.person_companies
               WHERE person_id = $1
               ORDER BY is_primary DESC, created_at ASC"#,
        )
        .bind(person_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(rows)
    }

    /// Create a person-company affiliation.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on constraint violations (including the
    /// unique `(person_id, company_id, role_in_company)` constraint).
    ///
    /// # Panics
    ///
    /// No panics possible -- all errors are propagated via `Result`.
    pub async fn create_affiliation(
        pool: &PgPool,
        input: CreatePersonCompany,
    ) -> Result<PersonCompany> {
        let row = sqlx::query_as::<_, PersonCompany>(
            r#"INSERT INTO core.person_companies (
                person_id, company_id, role_in_company, job_title, department,
                is_primary, start_date, end_date, portal_access, portal_modules, metadata
               ) VALUES (
                $1, $2, $3, $4, $5,
                COALESCE($6, FALSE), $7, $8, COALESCE($9, FALSE),
                COALESCE($10, '{}'), COALESCE($11, '{}')
               )
               RETURNING *"#,
        )
        .bind(input.person_id)
        .bind(input.company_id)
        .bind(&input.role_in_company)
        .bind(&input.job_title)
        .bind(&input.department)
        .bind(input.is_primary)
        .bind(input.start_date)
        .bind(input.end_date)
        .bind(input.portal_access)
        .bind(&input.portal_modules)
        .bind(&input.metadata)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(row)
    }

    /// Update an existing person-company affiliation.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure.
    /// Returns `Error::NotFound` if no matching row exists.
    ///
    /// # Panics
    ///
    /// No panics possible -- all errors are propagated via `Result`.
    pub async fn update_affiliation(
        pool: &PgPool,
        id: Uuid,
        input: UpdatePersonCompany,
    ) -> Result<PersonCompany> {
        let row = sqlx::query_as::<_, PersonCompany>(
            r#"UPDATE core.person_companies SET
                role_in_company = COALESCE($2, role_in_company),
                job_title       = COALESCE($3, job_title),
                department      = COALESCE($4, department),
                is_primary      = COALESCE($5, is_primary),
                start_date      = COALESCE($6, start_date),
                end_date        = COALESCE($7, end_date),
                portal_access   = COALESCE($8, portal_access),
                portal_modules  = COALESCE($9, portal_modules),
                metadata        = COALESCE($10, metadata),
                updated_at      = NOW()
               WHERE id = $1
               RETURNING *"#,
        )
        .bind(id)
        .bind(&input.role_in_company)
        .bind(&input.job_title)
        .bind(&input.department)
        .bind(input.is_primary)
        .bind(input.start_date)
        .bind(input.end_date)
        .bind(input.portal_access)
        .bind(&input.portal_modules)
        .bind(&input.metadata)
        .fetch_one(pool)
        .await
        .map_err(|e| {
            if e.to_string().contains("no rows returned") {
                Error::NotFound(format!("PersonCompany {id}"))
            } else {
                Error::Database(e.to_string())
            }
        })?;
        Ok(row)
    }

    /// Remove a person-company affiliation by its ID.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure.
    /// Returns `Error::NotFound` if no matching row exists.
    ///
    /// # Panics
    ///
    /// No panics possible -- all errors are propagated via `Result`.
    pub async fn remove_affiliation(pool: &PgPool, id: Uuid) -> Result<()> {
        let result = sqlx::query("DELETE FROM core.person_companies WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        if result.rows_affected() == 0 {
            return Err(Error::NotFound(format!("PersonCompany {id}")));
        }
        Ok(())
    }

    // ========================================================================
    // Login contexts
    // ========================================================================

    /// List all active login contexts for a user, enriched with company data.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure.
    ///
    /// # Panics
    ///
    /// No panics possible -- all errors are propagated via `Result`.
    pub async fn list_contexts_for_user(
        pool: &PgPool,
        user_id: Uuid,
    ) -> Result<Vec<LoginContextDisplay>> {
        let rows = sqlx::query_as::<_, LoginContextDisplay>(
            r#"SELECT
                lc.id,
                lc.user_id,
                lc.person_company_id,
                lc.context_type,
                lc.company_id,
                lc.label,
                lc.icon,
                lc.color,
                lc.is_active,
                lc.last_used_at,
                lc.created_at,
                c.name  AS company_name,
                c.logo_url AS company_logo,
                pc.role_in_company,
                pc.job_title
               FROM identity.login_contexts lc
               JOIN core.companies c ON c.id = lc.company_id
               JOIN core.person_companies pc ON pc.id = lc.person_company_id
               WHERE lc.user_id = $1 AND lc.is_active = TRUE
               ORDER BY lc.last_used_at DESC NULLS LAST, lc.created_at ASC"#,
        )
        .bind(user_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(rows)
    }

    /// Find a single login context by ID, verified to belong to the given user.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure.
    ///
    /// # Panics
    ///
    /// No panics possible -- all errors are propagated via `Result`.
    pub async fn find_context(
        pool: &PgPool,
        context_id: Uuid,
        user_id: Uuid,
    ) -> Result<Option<LoginContextDisplay>> {
        let row = sqlx::query_as::<_, LoginContextDisplay>(
            r#"SELECT
                lc.id,
                lc.user_id,
                lc.person_company_id,
                lc.context_type,
                lc.company_id,
                lc.label,
                lc.icon,
                lc.color,
                lc.is_active,
                lc.last_used_at,
                lc.created_at,
                c.name  AS company_name,
                c.logo_url AS company_logo,
                pc.role_in_company,
                pc.job_title
               FROM identity.login_contexts lc
               JOIN core.companies c ON c.id = lc.company_id
               JOIN core.person_companies pc ON pc.id = lc.person_company_id
               WHERE lc.id = $1 AND lc.user_id = $2"#,
        )
        .bind(context_id)
        .bind(user_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(row)
    }

    /// Update `last_used_at` for a login context (called on context switch).
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure.
    ///
    /// # Panics
    ///
    /// No panics possible -- all errors are propagated via `Result`.
    pub async fn touch_context(pool: &PgPool, context_id: Uuid) -> Result<()> {
        sqlx::query("UPDATE identity.login_contexts SET last_used_at = NOW() WHERE id = $1")
            .bind(context_id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }

    /// Create a new login context for a user.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on constraint violations (including the
    /// unique `(user_id, person_company_id)` constraint).
    ///
    /// # Panics
    ///
    /// No panics possible -- all errors are propagated via `Result`.
    pub async fn create_context(
        pool: &PgPool,
        user_id: Uuid,
        person_company_id: Uuid,
        context_type: &str,
        company_id: Uuid,
        label: &str,
    ) -> Result<LoginContext> {
        let row = sqlx::query_as::<_, LoginContext>(
            r#"INSERT INTO identity.login_contexts
                (user_id, person_company_id, context_type, company_id, label)
               VALUES ($1, $2, $3, $4, $5)
               RETURNING *"#,
        )
        .bind(user_id)
        .bind(person_company_id)
        .bind(context_type)
        .bind(company_id)
        .bind(label)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(row)
    }
}
