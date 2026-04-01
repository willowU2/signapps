CREATE SCHEMA IF NOT EXISTS crm;
CREATE TABLE IF NOT EXISTS crm.deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(500) NOT NULL,
    stage VARCHAR(50) NOT NULL DEFAULT 'prospect',
    amount BIGINT DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'EUR',
    contact_id UUID,
    contact_name VARCHAR(200),
    contact_email VARCHAR(200),
    owner_id UUID NOT NULL,
    tenant_id UUID,
    close_date DATE,
    probability INTEGER DEFAULT 10,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_deals_owner ON crm.deals(owner_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON crm.deals(stage);

CREATE TABLE IF NOT EXISTS crm.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    email VARCHAR(200),
    phone VARCHAR(50),
    company VARCHAR(200),
    source VARCHAR(50),
    status VARCHAR(30) DEFAULT 'new',
    score INTEGER DEFAULT 0,
    owner_id UUID NOT NULL,
    tenant_id UUID,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_leads_owner ON crm.leads(owner_id);
