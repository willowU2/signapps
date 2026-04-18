-- Migration 084: Create missing schemas + fix billing tables
-- Creates docs and workforce schemas, and adds/reconciles the line_items and
-- payments tables to exactly match the Rust structs in
-- services/signapps-billing/src/main.rs (LineItem, Payment).

-- Create missing schemas
CREATE SCHEMA IF NOT EXISTS docs;
CREATE SCHEMA IF NOT EXISTS workforce;
CREATE SCHEMA IF NOT EXISTS billing;

CREATE TABLE IF NOT EXISTS billing.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);

-- Drop and recreate billing.line_items to match Rust LineItem struct exactly:
-- id, invoice_id, description, quantity, unit_price_cents, total_cents,
-- sort_order, created_at
DROP TABLE IF EXISTS billing.line_items CASCADE;
CREATE TABLE IF NOT EXISTS billing.line_items (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id       UUID        NOT NULL REFERENCES billing.invoices(id) ON DELETE CASCADE,
    description      TEXT        NOT NULL,
    quantity         INTEGER     NOT NULL DEFAULT 1,
    unit_price_cents INTEGER     NOT NULL DEFAULT 0,
    total_cents      INTEGER     NOT NULL DEFAULT 0,
    sort_order       INTEGER     NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Drop and recreate billing.payments to match Rust Payment struct exactly:
-- id, invoice_id, amount_cents, currency, method, reference, paid_at,
-- created_at
DROP TABLE IF EXISTS billing.payments CASCADE;
CREATE TABLE IF NOT EXISTS billing.payments (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id   UUID        NOT NULL REFERENCES billing.invoices(id) ON DELETE CASCADE,
    amount_cents INTEGER     NOT NULL,
    currency     VARCHAR(10) NOT NULL DEFAULT 'EUR',
    method       VARCHAR(50) NOT NULL DEFAULT 'bank_transfer',
    reference    TEXT,
    paid_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_line_items_invoice ON billing.line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice   ON billing.payments(invoice_id);
