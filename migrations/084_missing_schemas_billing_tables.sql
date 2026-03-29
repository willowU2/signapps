-- Migration 084: Create missing schemas + fix billing tables
-- Creates docs and workforce schemas, and adds the line_items and payments
-- tables that were commented out in migration 055.

-- Create missing schemas
CREATE SCHEMA IF NOT EXISTS docs;
CREATE SCHEMA IF NOT EXISTS workforce;

-- billing.line_items (billing schema + invoices table already exist from
-- crates/signapps-db/migrations/20260324000010_billing.up.sql)
CREATE TABLE IF NOT EXISTS billing.line_items (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id  UUID        NOT NULL REFERENCES billing.invoices(id) ON DELETE CASCADE,
    description TEXT        NOT NULL,
    quantity    INTEGER     NOT NULL DEFAULT 1,
    unit_price  BIGINT      NOT NULL DEFAULT 0,
    amount      BIGINT      NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS billing.payments (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id  UUID        NOT NULL REFERENCES billing.invoices(id) ON DELETE CASCADE,
    amount      BIGINT      NOT NULL,
    method      VARCHAR(50) NOT NULL DEFAULT 'card',
    status      VARCHAR(30) NOT NULL DEFAULT 'pending',
    reference   TEXT,
    paid_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_line_items_invoice ON billing.line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice   ON billing.payments(invoice_id);
