CREATE SCHEMA IF NOT EXISTS billing;

CREATE TABLE billing.plans (
    id UUID PRIMARY KEY DEFAULT gen_uuid_v7(),
    name VARCHAR(64) NOT NULL,
    description TEXT,
    price_cents INTEGER NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    features JSONB DEFAULT '[]',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE billing.invoices (
    id UUID PRIMARY KEY DEFAULT gen_uuid_v7(),
    tenant_id UUID,
    plan_id UUID REFERENCES billing.plans(id),
    number VARCHAR(32) NOT NULL,
    amount_cents INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
    issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    due_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoices_tenant ON billing.invoices(tenant_id, created_at DESC);
CREATE INDEX idx_invoices_status ON billing.invoices(status);

-- Seed free plan
INSERT INTO billing.plans (name, description, price_cents, features)
VALUES ('Free', 'Plan gratuit — toutes fonctionnalités', 0, '["unlimited_users","unlimited_storage","all_services"]');
