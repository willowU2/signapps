# Unified Person Model & Contextual Portals — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Treat every human entity (employee, client, supplier, partner) as a single `core.persons` record with multiple company affiliations and role-based contextual portal access.

**Architecture:** 4-layer implementation — (1) DB migration + Rust models, (2) auth flow with context picker, (3) company/affiliation CRUD handlers, (4) frontend context switcher + portal routing. Each layer builds on the previous.

**Tech Stack:** PostgreSQL, Rust (Axum, sqlx, jsonwebtoken), Next.js 16, React 19, Zustand, react-query, shadcn/ui

---

## File Structure

### Backend (Rust)

| File | Responsibility | Action |
|------|---------------|--------|
| `migrations/270_unified_person_model.sql` | Schema: companies, person_companies, login_contexts, alter persons + sharing | Create |
| `crates/signapps-db-shared/src/models/company.rs` | Company + PersonCompany + LoginContext structs | Create |
| `crates/signapps-db-shared/src/repositories/company_repository.rs` | CRUD for companies, affiliations, contexts | Create |
| `crates/signapps-common/src/auth.rs` | Add context fields to Claims struct | Modify (lines 16-42) |
| `services/signapps-identity/src/auth/jwt.rs` | Add context params to create_tokens | Modify (lines 44-102) |
| `services/signapps-identity/src/handlers/auth.rs` | Add select-context, switch-context, contexts endpoints | Modify |
| `services/signapps-identity/src/handlers/companies.rs` | Company CRUD + affiliation management | Create |
| `services/signapps-identity/src/handlers/mod.rs` | Register companies module | Modify |
| `services/signapps-identity/src/main.rs` | Register company + context routes | Modify |

### Frontend (TypeScript/React)

| File | Responsibility | Action |
|------|---------------|--------|
| `client/src/lib/api/companies.ts` | API client for companies + affiliations | Create |
| `client/src/lib/store.ts` | Add context state to auth store | Modify |
| `client/src/app/login/page.tsx` | Add context picker after login | Modify |
| `client/src/components/auth/context-picker.tsx` | Context selection card grid | Create |
| `client/src/components/layout/context-switcher.tsx` | Header dropdown for context switch | Create |
| `client/src/components/layout/app-layout.tsx` | Integrate context switcher in header | Modify |
| `client/src/components/layout/sidebar.tsx` | Adapt sidebar to context_type | Modify |
| `client/src/app/admin/companies/page.tsx` | Admin company management page | Create |
| `client/src/app/portal/client/layout.tsx` | Client portal layout (reduced sidebar) | Create |
| `client/src/app/portal/supplier/layout.tsx` | Supplier portal layout (reduced sidebar) | Create |

---

## Task 1: Database Migration

**Files:**
- Create: `migrations/270_unified_person_model.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- 270_unified_person_model.sql
-- Unified Person Model: companies, affiliations, login contexts

-- 1. Companies table
CREATE TABLE IF NOT EXISTS core.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    company_type TEXT NOT NULL CHECK (company_type IN ('internal', 'client', 'supplier', 'partner')),
    legal_name TEXT,
    siren TEXT,
    siret TEXT,
    vat_number TEXT,
    registration_number TEXT,
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    postal_code TEXT,
    country TEXT DEFAULT 'FR',
    website TEXT,
    logo_url TEXT,
    industry TEXT,
    employee_count_range TEXT,
    annual_revenue_range TEXT,
    default_currency TEXT DEFAULT 'EUR',
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_companies_tenant ON core.companies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_companies_type ON core.companies(tenant_id, company_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_siren ON core.companies(tenant_id, siren) WHERE siren IS NOT NULL;

-- 2. Person-Company affiliations (N:N)
CREATE TABLE IF NOT EXISTS core.person_companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES core.persons(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES core.companies(id) ON DELETE CASCADE,
    role_in_company TEXT NOT NULL CHECK (role_in_company IN (
        'employee', 'client_contact', 'supplier_contact', 'partner', 'board_member', 'freelancer'
    )),
    job_title TEXT,
    department TEXT,
    is_primary BOOLEAN DEFAULT false,
    start_date DATE,
    end_date DATE,
    portal_access BOOLEAN DEFAULT false,
    portal_modules TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(person_id, company_id, role_in_company)
);
CREATE INDEX IF NOT EXISTS idx_person_companies_person ON core.person_companies(person_id);
CREATE INDEX IF NOT EXISTS idx_person_companies_company ON core.person_companies(company_id);
CREATE INDEX IF NOT EXISTS idx_person_companies_role ON core.person_companies(role_in_company);

-- 3. Enrich core.persons
ALTER TABLE core.persons ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
ALTER TABLE core.persons ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE core.persons ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE core.persons ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'fr';
ALTER TABLE core.persons ADD COLUMN IF NOT EXISTS merged_into UUID REFERENCES core.persons(id);

-- 4. Add 'company' grantee type to sharing.grants
DO $$
BEGIN
    ALTER TABLE sharing.grants DROP CONSTRAINT IF EXISTS grants_grantee_type_check;
    ALTER TABLE sharing.grants ADD CONSTRAINT grants_grantee_type_check
        CHECK (grantee_type IN ('user', 'group', 'org_node', 'company', 'everyone'));
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'sharing.grants constraint update skipped: %', SQLERRM;
END $$;

-- 5. Login contexts
CREATE TABLE IF NOT EXISTS identity.login_contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    person_company_id UUID NOT NULL REFERENCES core.person_companies(id) ON DELETE CASCADE,
    context_type TEXT NOT NULL CHECK (context_type IN ('employee', 'client', 'supplier', 'partner')),
    company_id UUID NOT NULL REFERENCES core.companies(id),
    label TEXT NOT NULL,
    icon TEXT,
    color TEXT,
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, person_company_id)
);
CREATE INDEX IF NOT EXISTS idx_login_contexts_user ON identity.login_contexts(user_id);

-- 6. Seed internal company from first tenant (if exists)
INSERT INTO core.companies (tenant_id, name, company_type)
SELECT id, name, 'internal'
FROM identity.tenants
LIMIT 1
ON CONFLICT DO NOTHING;
```

- [ ] **Step 2: Apply migration**

Run: `sqlx migrate run` from project root (or `just db-migrate`).
Expected: Tables created, no errors.

- [ ] **Step 3: Verify tables exist**

Run: `psql -d signapps -c "\dt core.companies; \dt core.person_companies; \dt identity.login_contexts;"`
Expected: 3 tables listed.

- [ ] **Step 4: Commit**

```bash
git add migrations/270_unified_person_model.sql
git commit -m "feat(db): add companies, person_companies, login_contexts tables"
```

---

## Task 2: Rust Models & Repository

**Files:**
- Create: `crates/signapps-db-shared/src/models/company.rs`
- Create: `crates/signapps-db-shared/src/repositories/company_repository.rs`
- Modify: `crates/signapps-db-shared/src/models/mod.rs`
- Modify: `crates/signapps-db-shared/src/repositories/mod.rs`
- Modify: `crates/signapps-db/src/models/mod.rs`
- Modify: `crates/signapps-db/src/repositories/mod.rs`

- [ ] **Step 1: Create company models**

```rust
// crates/signapps-db-shared/src/models/company.rs

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// A company entity (internal org, client, supplier, partner).
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct Company {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub name: String,
    pub company_type: String,
    pub legal_name: Option<String>,
    pub siren: Option<String>,
    pub siret: Option<String>,
    pub vat_number: Option<String>,
    pub registration_number: Option<String>,
    pub address_line1: Option<String>,
    pub address_line2: Option<String>,
    pub city: Option<String>,
    pub postal_code: Option<String>,
    pub country: Option<String>,
    pub website: Option<String>,
    pub logo_url: Option<String>,
    pub industry: Option<String>,
    pub employee_count_range: Option<String>,
    pub annual_revenue_range: Option<String>,
    pub default_currency: Option<String>,
    pub is_active: Option<bool>,
    pub metadata: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Request to create a company.
#[derive(Debug, Clone, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CreateCompany {
    pub name: String,
    pub company_type: String,
    pub legal_name: Option<String>,
    pub siren: Option<String>,
    pub siret: Option<String>,
    pub vat_number: Option<String>,
    pub city: Option<String>,
    pub country: Option<String>,
    pub website: Option<String>,
    pub industry: Option<String>,
}

/// Request to update a company.
#[derive(Debug, Clone, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct UpdateCompany {
    pub name: Option<String>,
    pub legal_name: Option<String>,
    pub siren: Option<String>,
    pub siret: Option<String>,
    pub vat_number: Option<String>,
    pub address_line1: Option<String>,
    pub address_line2: Option<String>,
    pub city: Option<String>,
    pub postal_code: Option<String>,
    pub country: Option<String>,
    pub website: Option<String>,
    pub logo_url: Option<String>,
    pub industry: Option<String>,
    pub is_active: Option<bool>,
}

/// A person's affiliation with a company.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct PersonCompany {
    pub id: Uuid,
    pub person_id: Uuid,
    pub company_id: Uuid,
    pub role_in_company: String,
    pub job_title: Option<String>,
    pub department: Option<String>,
    pub is_primary: Option<bool>,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    pub portal_access: Option<bool>,
    pub portal_modules: Option<Vec<String>>,
    pub metadata: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Request to create a person-company affiliation.
#[derive(Debug, Clone, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CreatePersonCompany {
    pub person_id: Uuid,
    pub company_id: Uuid,
    pub role_in_company: String,
    pub job_title: Option<String>,
    pub department: Option<String>,
    pub is_primary: Option<bool>,
    pub start_date: Option<NaiveDate>,
    pub portal_access: Option<bool>,
    pub portal_modules: Option<Vec<String>>,
}

/// A login context for a user (maps to one person_company affiliation).
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct LoginContext {
    pub id: Uuid,
    pub user_id: Uuid,
    pub person_company_id: Uuid,
    pub context_type: String,
    pub company_id: Uuid,
    pub label: String,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub is_active: Option<bool>,
    pub last_used_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

/// Login context enriched with company name (for frontend display).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct LoginContextDisplay {
    pub id: Uuid,
    pub context_type: String,
    pub company_id: Uuid,
    pub company_name: String,
    pub company_logo: Option<String>,
    pub role_in_company: String,
    pub job_title: Option<String>,
    pub label: String,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub last_used_at: Option<DateTime<Utc>>,
}
```

- [ ] **Step 2: Create company repository**

```rust
// crates/signapps-db-shared/src/repositories/company_repository.rs

use sqlx::PgPool;
use uuid::Uuid;

use crate::models::company::*;
use signapps_common::{Error, Result};

/// Repository for company and affiliation CRUD.
pub struct CompanyRepository;

impl CompanyRepository {
    // --- Companies ---

    pub async fn list(pool: &PgPool, tenant_id: Uuid, company_type: Option<&str>) -> Result<Vec<Company>> {
        let rows = if let Some(ct) = company_type {
            sqlx::query_as::<_, Company>(
                "SELECT * FROM core.companies WHERE tenant_id = $1 AND company_type = $2 AND is_active = true ORDER BY name"
            )
            .bind(tenant_id).bind(ct)
            .fetch_all(pool).await
        } else {
            sqlx::query_as::<_, Company>(
                "SELECT * FROM core.companies WHERE tenant_id = $1 AND is_active = true ORDER BY name"
            )
            .bind(tenant_id)
            .fetch_all(pool).await
        };
        rows.map_err(|e| Error::Database(e.to_string()))
    }

    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Option<Company>> {
        sqlx::query_as::<_, Company>("SELECT * FROM core.companies WHERE id = $1")
            .bind(id)
            .fetch_optional(pool).await
            .map_err(|e| Error::Database(e.to_string()))
    }

    pub async fn create(pool: &PgPool, tenant_id: Uuid, input: CreateCompany) -> Result<Company> {
        sqlx::query_as::<_, Company>(
            "INSERT INTO core.companies (tenant_id, name, company_type, legal_name, siren, siret, vat_number, city, country, website, industry)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING *"
        )
        .bind(tenant_id).bind(&input.name).bind(&input.company_type)
        .bind(&input.legal_name).bind(&input.siren).bind(&input.siret)
        .bind(&input.vat_number).bind(&input.city).bind(&input.country)
        .bind(&input.website).bind(&input.industry)
        .fetch_one(pool).await
        .map_err(|e| Error::Database(e.to_string()))
    }

    pub async fn update(pool: &PgPool, id: Uuid, input: UpdateCompany) -> Result<Company> {
        sqlx::query_as::<_, Company>(
            "UPDATE core.companies SET
                name = COALESCE($2, name),
                legal_name = COALESCE($3, legal_name),
                siren = COALESCE($4, siren),
                siret = COALESCE($5, siret),
                vat_number = COALESCE($6, vat_number),
                address_line1 = COALESCE($7, address_line1),
                address_line2 = COALESCE($8, address_line2),
                city = COALESCE($9, city),
                postal_code = COALESCE($10, postal_code),
                country = COALESCE($11, country),
                website = COALESCE($12, website),
                logo_url = COALESCE($13, logo_url),
                industry = COALESCE($14, industry),
                is_active = COALESCE($15, is_active),
                updated_at = NOW()
             WHERE id = $1 RETURNING *"
        )
        .bind(id).bind(&input.name).bind(&input.legal_name)
        .bind(&input.siren).bind(&input.siret).bind(&input.vat_number)
        .bind(&input.address_line1).bind(&input.address_line2)
        .bind(&input.city).bind(&input.postal_code).bind(&input.country)
        .bind(&input.website).bind(&input.logo_url).bind(&input.industry)
        .bind(&input.is_active)
        .fetch_one(pool).await
        .map_err(|e| Error::Database(e.to_string()))
    }

    pub async fn deactivate(pool: &PgPool, id: Uuid) -> Result<()> {
        sqlx::query("UPDATE core.companies SET is_active = false, updated_at = NOW() WHERE id = $1")
            .bind(id).execute(pool).await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }

    // --- Person-Company Affiliations ---

    pub async fn list_persons_for_company(pool: &PgPool, company_id: Uuid) -> Result<Vec<PersonCompany>> {
        sqlx::query_as::<_, PersonCompany>(
            "SELECT * FROM core.person_companies WHERE company_id = $1 AND end_date IS NULL ORDER BY created_at"
        )
        .bind(company_id)
        .fetch_all(pool).await
        .map_err(|e| Error::Database(e.to_string()))
    }

    pub async fn list_companies_for_person(pool: &PgPool, person_id: Uuid) -> Result<Vec<PersonCompany>> {
        sqlx::query_as::<_, PersonCompany>(
            "SELECT * FROM core.person_companies WHERE person_id = $1 AND end_date IS NULL ORDER BY is_primary DESC, created_at"
        )
        .bind(person_id)
        .fetch_all(pool).await
        .map_err(|e| Error::Database(e.to_string()))
    }

    pub async fn create_affiliation(pool: &PgPool, input: CreatePersonCompany) -> Result<PersonCompany> {
        sqlx::query_as::<_, PersonCompany>(
            "INSERT INTO core.person_companies (person_id, company_id, role_in_company, job_title, department, is_primary, start_date, portal_access, portal_modules)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *"
        )
        .bind(input.person_id).bind(input.company_id).bind(&input.role_in_company)
        .bind(&input.job_title).bind(&input.department).bind(input.is_primary)
        .bind(input.start_date).bind(input.portal_access)
        .bind(&input.portal_modules)
        .fetch_one(pool).await
        .map_err(|e| Error::Database(e.to_string()))
    }

    pub async fn remove_affiliation(pool: &PgPool, id: Uuid) -> Result<()> {
        sqlx::query("UPDATE core.person_companies SET end_date = CURRENT_DATE WHERE id = $1")
            .bind(id).execute(pool).await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }

    // --- Login Contexts ---

    pub async fn list_contexts_for_user(pool: &PgPool, user_id: Uuid) -> Result<Vec<LoginContextDisplay>> {
        sqlx::query_as::<_, LoginContextDisplay>(
            "SELECT lc.id, lc.context_type, lc.company_id, c.name AS company_name,
                    c.logo_url AS company_logo, pc.role_in_company, pc.job_title,
                    lc.label, lc.icon, lc.color, lc.last_used_at
             FROM identity.login_contexts lc
             JOIN core.companies c ON c.id = lc.company_id
             JOIN core.person_companies pc ON pc.id = lc.person_company_id
             WHERE lc.user_id = $1 AND lc.is_active = true
             ORDER BY lc.last_used_at DESC NULLS LAST"
        )
        .bind(user_id)
        .fetch_all(pool).await
        .map_err(|e| Error::Database(e.to_string()))
    }

    pub async fn find_context(pool: &PgPool, context_id: Uuid, user_id: Uuid) -> Result<Option<LoginContextDisplay>> {
        sqlx::query_as::<_, LoginContextDisplay>(
            "SELECT lc.id, lc.context_type, lc.company_id, c.name AS company_name,
                    c.logo_url AS company_logo, pc.role_in_company, pc.job_title,
                    lc.label, lc.icon, lc.color, lc.last_used_at
             FROM identity.login_contexts lc
             JOIN core.companies c ON c.id = lc.company_id
             JOIN core.person_companies pc ON pc.id = lc.person_company_id
             WHERE lc.id = $1 AND lc.user_id = $2 AND lc.is_active = true"
        )
        .bind(context_id).bind(user_id)
        .fetch_optional(pool).await
        .map_err(|e| Error::Database(e.to_string()))
    }

    pub async fn touch_context(pool: &PgPool, context_id: Uuid) -> Result<()> {
        sqlx::query("UPDATE identity.login_contexts SET last_used_at = NOW() WHERE id = $1")
            .bind(context_id).execute(pool).await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }

    pub async fn create_context(pool: &PgPool, user_id: Uuid, person_company_id: Uuid, context_type: &str, company_id: Uuid, label: &str) -> Result<LoginContext> {
        sqlx::query_as::<_, LoginContext>(
            "INSERT INTO identity.login_contexts (user_id, person_company_id, context_type, company_id, label)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (user_id, person_company_id) DO UPDATE SET is_active = true, label = $5
             RETURNING *"
        )
        .bind(user_id).bind(person_company_id).bind(context_type).bind(company_id).bind(label)
        .fetch_one(pool).await
        .map_err(|e| Error::Database(e.to_string()))
    }
}
```

- [ ] **Step 3: Register models and repository in mod.rs files**

Add to `crates/signapps-db-shared/src/models/mod.rs`:
```rust
pub mod company;
pub use company::*;
```

Add to `crates/signapps-db-shared/src/repositories/mod.rs`:
```rust
pub mod company_repository;
pub use company_repository::CompanyRepository;
```

Add to `crates/signapps-db/src/models/mod.rs`:
```rust
pub mod company {
    pub use signapps_db_shared::models::company::*;
}
pub use company::*;
```

Add to `crates/signapps-db/src/repositories/mod.rs`:
```rust
pub use signapps_db_shared::repositories::CompanyRepository;
```

- [ ] **Step 4: Verify compilation**

Run: `cargo check -p signapps-db-shared -p signapps-db`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add crates/signapps-db-shared/src/models/company.rs \
       crates/signapps-db-shared/src/repositories/company_repository.rs \
       crates/signapps-db-shared/src/models/mod.rs \
       crates/signapps-db-shared/src/repositories/mod.rs \
       crates/signapps-db/src/models/mod.rs \
       crates/signapps-db/src/repositories/mod.rs
git commit -m "feat(db): add Company, PersonCompany, LoginContext models and repository"
```

---

## Task 3: Enrich JWT Claims with Context

**Files:**
- Modify: `crates/signapps-common/src/auth.rs` (lines 16-42)
- Modify: `services/signapps-identity/src/auth/jwt.rs` (lines 44-102)

- [ ] **Step 1: Add context fields to Claims struct**

In `crates/signapps-common/src/auth.rs`, add these fields to the `Claims` struct after `workspace_ids`:

```rust
    /// Person ID from core.persons (optional, set when context is selected)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub person_id: Option<Uuid>,
    /// Active login context ID
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub context_id: Option<Uuid>,
    /// Context type: "employee", "client", "supplier", "partner"
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub context_type: Option<String>,
    /// Company ID for the active context
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub company_id: Option<Uuid>,
    /// Company name (convenience, avoids extra DB lookup)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub company_name: Option<String>,
```

- [ ] **Step 2: Update create_tokens to accept context params**

In `services/signapps-identity/src/auth/jwt.rs`, add a new struct and update `create_tokens`:

```rust
/// Optional context information to embed in JWT.
#[derive(Debug, Clone, Default)]
pub struct TokenContext {
    pub person_id: Option<Uuid>,
    pub context_id: Option<Uuid>,
    pub context_type: Option<String>,
    pub company_id: Option<Uuid>,
    pub company_name: Option<String>,
}

pub fn create_tokens(
    user_id: Uuid,
    username: &str,
    role: i16,
    tenant_id: Option<Uuid>,
    workspace_ids: Option<Vec<Uuid>>,
    context: TokenContext, // NEW param
    config: &JwtConfig,
) -> Result<TokenPair> {
    // ... existing code, but add context fields to Claims:
    let access_claims = Claims {
        sub: user_id,
        username: username.to_string(),
        role,
        tenant_id,
        workspace_ids: workspace_ids.clone(),
        person_id: context.person_id,
        context_id: context.context_id,
        context_type: context.context_type.clone(),
        company_id: context.company_id,
        company_name: context.company_name.clone(),
        exp: access_exp.timestamp(),
        iat: now.timestamp(),
        token_type: "access".to_string(),
        aud: Some(config.audience.clone()),
        iss: Some(config.issuer.clone()),
    };
    // ... same for refresh_claims
```

- [ ] **Step 3: Update all callers of create_tokens to pass TokenContext::default()**

Search for all calls to `create_tokens` in `services/signapps-identity/src/handlers/auth.rs` and add `TokenContext::default()` as the new parameter. This keeps existing behavior (no context) while enabling context-aware tokens.

- [ ] **Step 4: Verify compilation**

Run: `cargo check -p signapps-common -p signapps-identity`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add crates/signapps-common/src/auth.rs services/signapps-identity/src/auth/jwt.rs \
       services/signapps-identity/src/handlers/auth.rs
git commit -m "feat(auth): add context fields to JWT Claims + TokenContext struct"
```

---

## Task 4: Auth Context Endpoints (Backend)

**Files:**
- Modify: `services/signapps-identity/src/handlers/auth.rs`
- Modify: `services/signapps-identity/src/main.rs`

- [ ] **Step 1: Add context endpoints to auth.rs**

Add these handlers at the end of `services/signapps-identity/src/handlers/auth.rs`:

```rust
/// List available login contexts for the authenticated user.
#[utoipa::path(get, path = "/api/v1/auth/contexts", tag = "auth",
    responses((status = 200, description = "Available contexts", body = Vec<LoginContextDisplay>))
)]
#[tracing::instrument(skip_all, fields(user_id = %claims.sub))]
pub async fn list_contexts(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<LoginContextDisplay>>> {
    let contexts = CompanyRepository::list_contexts_for_user(state.pool.inner(), claims.sub).await?;
    Ok(Json(contexts))
}

/// Select a context after login (returns new JWT with context claims).
#[derive(Debug, Deserialize)]
pub struct SelectContextRequest {
    pub context_id: Uuid,
}

#[utoipa::path(post, path = "/api/v1/auth/select-context", tag = "auth",
    request_body = SelectContextRequest,
    responses((status = 200, description = "JWT with context", body = LoginResponse))
)]
#[tracing::instrument(skip_all, fields(user_id = %claims.sub))]
pub async fn select_context(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<SelectContextRequest>,
) -> Result<(HeaderMap, Json<LoginResponse>)> {
    let ctx = CompanyRepository::find_context(state.pool.inner(), payload.context_id, claims.sub)
        .await?
        .ok_or(Error::NotFound("Context not found".into()))?;

    CompanyRepository::touch_context(state.pool.inner(), payload.context_id).await?;

    // Find person_id from the person_companies join
    let person_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT pc.person_id FROM identity.login_contexts lc
         JOIN core.person_companies pc ON pc.id = lc.person_company_id
         WHERE lc.id = $1"
    ).bind(payload.context_id)
    .fetch_one(state.pool.inner()).await
    .map_err(|e| Error::Database(e.to_string()))?;

    let token_context = TokenContext {
        person_id: Some(person_id),
        context_id: Some(ctx.id),
        context_type: Some(ctx.context_type.clone()),
        company_id: Some(ctx.company_id),
        company_name: Some(ctx.company_name.clone()),
    };

    let tokens = create_tokens(
        claims.sub, &claims.username, claims.role,
        claims.tenant_id, claims.workspace_ids.clone(),
        token_context, &state.jwt_config,
    )?;

    let mut headers = HeaderMap::new();
    set_auth_cookies(&mut headers, &tokens);

    Ok((headers, Json(LoginResponse {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        user: None, // already authenticated
    })))
}

/// Switch context in-session (same as select but for already-contexted users).
#[utoipa::path(post, path = "/api/v1/auth/switch-context", tag = "auth",
    request_body = SelectContextRequest,
    responses((status = 200, description = "New JWT with switched context", body = LoginResponse))
)]
#[tracing::instrument(skip_all, fields(user_id = %claims.sub))]
pub async fn switch_context(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<SelectContextRequest>,
) -> Result<(HeaderMap, Json<LoginResponse>)> {
    // Reuse select_context logic
    select_context(State(state), Extension(claims), Json(payload)).await
}

/// Get current context details.
#[utoipa::path(get, path = "/api/v1/auth/current-context", tag = "auth",
    responses((status = 200, description = "Current context"))
)]
#[tracing::instrument(skip_all, fields(user_id = %claims.sub))]
pub async fn current_context(
    Extension(claims): Extension<Claims>,
) -> Result<Json<serde_json::Value>> {
    Ok(Json(serde_json::json!({
        "context_id": claims.context_id,
        "context_type": claims.context_type,
        "company_id": claims.company_id,
        "company_name": claims.company_name,
        "person_id": claims.person_id,
    })))
}
```

- [ ] **Step 2: Register routes in main.rs**

Add to the protected auth routes section in `services/signapps-identity/src/main.rs`:

```rust
.route("/api/v1/auth/contexts", get(handlers::auth::list_contexts))
.route("/api/v1/auth/select-context", post(handlers::auth::select_context))
.route("/api/v1/auth/switch-context", post(handlers::auth::switch_context))
.route("/api/v1/auth/current-context", get(handlers::auth::current_context))
```

- [ ] **Step 3: Update login handler to return contexts when multiple exist**

In the existing `login` handler, after successful authentication, query login contexts. If count >= 2, return a `LoginResponse` with a new field `contexts` instead of `access_token`. The frontend will show the context picker.

Add to `LoginResponse`:
```rust
pub struct LoginResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: i64,
    pub user: Option<UserResponse>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub contexts: Option<Vec<LoginContextDisplay>>, // NEW
    #[serde(skip_serializing_if = "Option::is_none")]
    pub requires_context: Option<bool>, // NEW: true if context picker needed
}
```

- [ ] **Step 4: Verify compilation**

Run: `cargo check -p signapps-identity`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add services/signapps-identity/src/handlers/auth.rs services/signapps-identity/src/main.rs
git commit -m "feat(auth): add context selection, switch, and listing endpoints"
```

---

## Task 5: Company CRUD Handlers (Backend)

**Files:**
- Create: `services/signapps-identity/src/handlers/companies.rs`
- Modify: `services/signapps-identity/src/handlers/mod.rs`
- Modify: `services/signapps-identity/src/main.rs`

- [ ] **Step 1: Create companies handler**

Create `services/signapps-identity/src/handlers/companies.rs` with handlers for:
- `list_companies` — GET /api/v1/companies?type=client
- `create_company` — POST /api/v1/companies
- `get_company` — GET /api/v1/companies/:id
- `update_company` — PUT /api/v1/companies/:id
- `deactivate_company` — DELETE /api/v1/companies/:id
- `list_company_persons` — GET /api/v1/companies/:id/persons
- `add_company_person` — POST /api/v1/companies/:id/persons
- `remove_company_person` — DELETE /api/v1/companies/:company_id/persons/:person_id
- `list_person_companies` — GET /api/v1/persons/:id/companies
- `update_affiliation` — PUT /api/v1/person-companies/:id

Each handler follows the pattern: `#[instrument]`, `Claims` auth, `CompanyRepository` calls, `AppError` errors.

- [ ] **Step 2: Register module and routes**

Add `pub mod companies;` to `handlers/mod.rs`.
Add routes to `main.rs` in the protected routes section.

- [ ] **Step 3: Verify compilation**

Run: `cargo check -p signapps-identity`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add services/signapps-identity/src/handlers/companies.rs \
       services/signapps-identity/src/handlers/mod.rs \
       services/signapps-identity/src/main.rs
git commit -m "feat(companies): add company CRUD + affiliation management endpoints"
```

---

## Task 6: Frontend API Client + Auth Store

**Files:**
- Create: `client/src/lib/api/companies.ts`
- Modify: `client/src/lib/store.ts`

- [ ] **Step 1: Create companies API client**

```typescript
// client/src/lib/api/companies.ts
import { getClient, ServiceName } from "./factory";

const client = getClient(ServiceName.IDENTITY);

export interface Company { id: string; name: string; company_type: string; /* ... */ }
export interface PersonCompany { id: string; person_id: string; company_id: string; role_in_company: string; job_title?: string; portal_access?: boolean; portal_modules?: string[]; }
export interface LoginContextDisplay { id: string; context_type: string; company_id: string; company_name: string; company_logo?: string; role_in_company: string; job_title?: string; label: string; icon?: string; color?: string; last_used_at?: string; }

export const companiesApi = {
  list: (type?: string) => client.get<Company[]>("/companies", { params: { type } }),
  create: (data: Partial<Company>) => client.post<Company>("/companies", data),
  get: (id: string) => client.get<Company>(`/companies/${id}`),
  update: (id: string, data: Partial<Company>) => client.put<Company>(`/companies/${id}`, data),
  deactivate: (id: string) => client.delete(`/companies/${id}`),
  listPersons: (companyId: string) => client.get<PersonCompany[]>(`/companies/${companyId}/persons`),
  addPerson: (companyId: string, data: Partial<PersonCompany>) => client.post<PersonCompany>(`/companies/${companyId}/persons`, data),
  removePerson: (companyId: string, personId: string) => client.delete(`/companies/${companyId}/persons/${personId}`),
};

export const contextApi = {
  list: () => client.get<LoginContextDisplay[]>("/auth/contexts"),
  select: (contextId: string) => client.post<{ access_token: string; refresh_token: string }>("/auth/select-context", { context_id: contextId }),
  switch: (contextId: string) => client.post<{ access_token: string; refresh_token: string }>("/auth/switch-context", { context_id: contextId }),
  current: () => client.get("/auth/current-context"),
};
```

- [ ] **Step 2: Add context state to auth store**

In `client/src/lib/store.ts`, add to `AuthState`:

```typescript
interface AuthState {
  // ... existing fields
  activeContext: LoginContextDisplay | null;
  availableContexts: LoginContextDisplay[];
  setActiveContext: (ctx: LoginContextDisplay | null) => void;
  setAvailableContexts: (contexts: LoginContextDisplay[]) => void;
  switchContext: (contextId: string) => Promise<void>;
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/lib/api/companies.ts client/src/lib/store.ts
git commit -m "feat(frontend): add companies API client + context state in auth store"
```

---

## Task 7: Context Picker Component (Frontend)

**Files:**
- Create: `client/src/components/auth/context-picker.tsx`
- Modify: `client/src/app/login/page.tsx`

- [ ] **Step 1: Create context picker component**

A card grid showing available contexts. Each card has: company logo, company name, role badge, job title, last access time. Click selects the context.

- [ ] **Step 2: Integrate into login flow**

In `login/page.tsx`, after successful auth, if `response.requires_context === true`, show the ContextPicker instead of redirecting. User clicks a context → calls `contextApi.select(id)` → stores JWT → redirects to workspace or portal based on `context_type`.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/auth/context-picker.tsx client/src/app/login/page.tsx
git commit -m "feat(auth): add context picker post-login for multi-role users"
```

---

## Task 8: Context Switcher in Header (Frontend)

**Files:**
- Create: `client/src/components/layout/context-switcher.tsx`
- Modify: `client/src/components/layout/app-layout.tsx`

- [ ] **Step 1: Create context switcher dropdown**

A header button showing current context (company logo + name). Click opens a Popover with other available contexts. Selecting one calls `contextApi.switch(id)` and reloads.

- [ ] **Step 2: Integrate into app-layout header**

Add `<ContextSwitcher />` to the header bar in `app-layout.tsx`, between the breadcrumb and the notifications bell. Only renders if `availableContexts.length > 1`.

- [ ] **Step 3: Add keyboard shortcut Ctrl+Shift+W**

Register the shortcut in `useKeyboardShortcuts` to open the context switcher.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/layout/context-switcher.tsx \
       client/src/components/layout/app-layout.tsx
git commit -m "feat(ui): add context switcher dropdown in header with Ctrl+Shift+W"
```

---

## Task 9: Portal Layouts (Frontend)

**Files:**
- Create: `client/src/app/portal/client/layout.tsx`
- Create: `client/src/app/portal/client/page.tsx`
- Create: `client/src/app/portal/supplier/layout.tsx`
- Create: `client/src/app/portal/supplier/page.tsx`
- Modify: `client/src/components/layout/sidebar.tsx`

- [ ] **Step 1: Create client portal layout**

Reduced sidebar with: Dashboard, Factures, Tickets, Documents, Formulaires, Messages. Uses the same `AppLayout` but passes a `portalMode="client"` prop that filters sidebar items.

- [ ] **Step 2: Create supplier portal layout**

Reduced sidebar with: Dashboard, Commandes, Factures, Catalogue, Documents, Livraisons.

- [ ] **Step 3: Update sidebar to accept portalMode**

In `sidebar.tsx`, filter the navigation items based on `context_type` from the auth store. If `context_type === 'client'`, show only client portal items. If `context_type === 'supplier'`, show only supplier portal items. If `context_type === 'employee'` or undefined, show full sidebar.

- [ ] **Step 4: Commit**

```bash
git add client/src/app/portal/ client/src/components/layout/sidebar.tsx
git commit -m "feat(portal): add client and supplier portal layouts with reduced sidebars"
```

---

## Task 10: Admin Company Management Page

**Files:**
- Create: `client/src/app/admin/companies/page.tsx`

- [ ] **Step 1: Create company management page**

Admin page at `/admin/companies` with:
- Table listing all companies (name, type badge, SIREN, city, active status)
- Create company dialog (name, type, legal_name, siren, city, country)
- Edit company dialog
- Click company → detail view with affiliated persons list
- Add person affiliation dialog (search person, select role, set portal access)

Uses react-query + `companiesApi`. Follow existing admin page patterns.

- [ ] **Step 2: Commit**

```bash
git add client/src/app/admin/companies/page.tsx
git commit -m "feat(admin): add company management page with affiliations"
```

---

## Task 11: E2E Tests

**Files:**
- Create: `client/e2e/context-picker-smoke.spec.ts`

- [ ] **Step 1: Write E2E tests**

```typescript
// 10-12 tests covering:
// - Login shows context picker when user has 2+ roles
// - Login skips picker when user has 1 role
// - Context switch via header works
// - Employee context shows full sidebar
// - Client portal shows reduced sidebar
// - Admin company page loads
// - Company CRUD operations
// - Person affiliation management
```

- [ ] **Step 2: Run tests**

Run: `npx playwright test context-picker-smoke --reporter=list`

- [ ] **Step 3: Commit**

```bash
git add client/e2e/context-picker-smoke.spec.ts
git commit -m "test(e2e): add context picker and portal smoke tests"
```

---

## Summary

| Task | Description | Files | Est. |
|------|-------------|-------|------|
| 1 | Database migration | 1 SQL | 3 min |
| 2 | Rust models + repository | 4 files | 10 min |
| 3 | JWT Claims enrichment | 2 files | 5 min |
| 4 | Auth context endpoints | 2 files | 10 min |
| 5 | Company CRUD handlers | 3 files | 10 min |
| 6 | Frontend API + store | 2 files | 5 min |
| 7 | Context picker component | 2 files | 10 min |
| 8 | Header context switcher | 2 files | 8 min |
| 9 | Portal layouts + sidebar | 5 files | 10 min |
| 10 | Admin company page | 1 file | 8 min |
| 11 | E2E tests | 1 file | 5 min |
