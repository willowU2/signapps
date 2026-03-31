-- Migration 134: IT Vendors management
-- Adds vendor table and links hardware assets to vendors

CREATE TABLE IF NOT EXISTS it.vendors (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name           VARCHAR(200) NOT NULL,
    contact_name   VARCHAR(200),
    contact_email  VARCHAR(200),
    contact_phone  VARCHAR(50),
    contract_start DATE,
    contract_end   DATE,
    support_level  VARCHAR(50),
    notes          TEXT,
    created_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE it.hardware ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES it.vendors(id);

CREATE INDEX IF NOT EXISTS idx_vendors_name ON it.vendors (name);
CREATE INDEX IF NOT EXISTS idx_hardware_vendor_id ON it.hardware (vendor_id) WHERE vendor_id IS NOT NULL;
