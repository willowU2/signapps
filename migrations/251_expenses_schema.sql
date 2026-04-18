-- Expenses schema: expense reports with approval workflow
CREATE SCHEMA IF NOT EXISTS expenses;

CREATE TABLE IF NOT EXISTS expenses.expense_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    amount BIGINT DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'EUR',
    category VARCHAR(50),
    status VARCHAR(20) DEFAULT 'draft',
    receipt_url TEXT,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    owner_id UUID NOT NULL,
    approver_id UUID,
    tenant_id UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_expenses_owner ON expenses.expense_reports(owner_id);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses.expense_reports(status);
