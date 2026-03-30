-- Migration 116: Extend existing IT tables with fields needed by new handlers

-- it.components: add name, details aliases (keep model/capacity for compatibility)
ALTER TABLE it.components ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE it.components ADD COLUMN IF NOT EXISTS details TEXT;
ALTER TABLE it.components ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
-- Backfill name from model
UPDATE it.components SET name = COALESCE(model, 'unknown') WHERE name IS NULL;
-- Unique constraint for ON CONFLICT in agent hardware inventory
ALTER TABLE it.components DROP CONSTRAINT IF EXISTS components_hw_type_unique;
ALTER TABLE it.components ADD CONSTRAINT components_hw_type_unique UNIQUE (hardware_id, type);

-- it.software_licenses: add vendor, license_type, purchase_date, expiry_date, notes, updated_at
ALTER TABLE it.software_licenses ADD COLUMN IF NOT EXISTS license_type VARCHAR(50);
ALTER TABLE it.software_licenses ADD COLUMN IF NOT EXISTS vendor VARCHAR(255);
ALTER TABLE it.software_licenses ADD COLUMN IF NOT EXISTS purchase_date DATE;
ALTER TABLE it.software_licenses ADD COLUMN IF NOT EXISTS expiry_date DATE;
ALTER TABLE it.software_licenses ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE it.software_licenses ADD COLUMN IF NOT EXISTS seats_total INTEGER;
-- Backfill seats_total from seats
UPDATE it.software_licenses SET seats_total = seats WHERE seats_total IS NULL;

-- it.network_interfaces: add name, interface_type, speed_mbps, is_active columns
ALTER TABLE it.network_interfaces ADD COLUMN IF NOT EXISTS name VARCHAR(100);
ALTER TABLE it.network_interfaces ADD COLUMN IF NOT EXISTS interface_type VARCHAR(30);
ALTER TABLE it.network_interfaces ADD COLUMN IF NOT EXISTS speed_mbps INTEGER;
ALTER TABLE it.network_interfaces ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
-- ip_address in new handlers is stored as text; add a text alias column
ALTER TABLE it.network_interfaces ADD COLUMN IF NOT EXISTS ip_text VARCHAR(50);
-- Backfill name
UPDATE it.network_interfaces SET name = 'eth0' WHERE name IS NULL;
-- Backfill ip_text from inet column
UPDATE it.network_interfaces SET ip_text = host(ip_address) WHERE ip_address IS NOT NULL AND ip_text IS NULL;
-- Remove NOT NULL on mac_address so agents without MAC can still register
ALTER TABLE it.network_interfaces ALTER COLUMN mac_address DROP NOT NULL;
