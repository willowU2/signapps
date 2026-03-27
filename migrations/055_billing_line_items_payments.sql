-- SignApps Platform - Billing Schema Enhancement
-- Version: 050
-- Feature: AQ-BILLDB — Line items and payments for billing service

-- ============================================================================
-- Skipped because `billing` schema and `billing.invoices` table 
-- are missing from the earlier migrations.
-- Uncomment and fix when the missing dependencies are available.
-- ============================================================================

/*
CREATE SCHEMA IF NOT EXISTS billing;

-- ============================================================================
-- Line items for invoices
-- ============================================================================

CREATE TABLE IF NOT EXISTS billing.line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES billing.invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price_cents INTEGER NOT NULL DEFAULT 0,
    total_cents INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_line_items_invoice ON billing.line_items(invoice_id);

-- ============================================================================
-- Payments
-- ============================================================================

CREATE TABLE IF NOT EXISTS billing.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES billing.invoices(id) ON DELETE CASCADE,
    amount_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'EUR',
    method TEXT NOT NULL DEFAULT 'bank_transfer'
        CHECK (method IN ('bank_transfer', 'card', 'cash', 'check', 'other')),
    reference TEXT,
    paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_invoice ON billing.payments(invoice_id);
*/
