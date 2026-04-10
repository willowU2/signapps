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
