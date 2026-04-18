-- 318_brand_kit.sql
-- Per-tenant brand kit for visual consistency

CREATE TABLE IF NOT EXISTS core.brand_kits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL UNIQUE,
    name TEXT NOT NULL DEFAULT 'Brand Kit',
    primary_color TEXT DEFAULT '#3b82f6',
    secondary_color TEXT DEFAULT '#64748b',
    accent_color TEXT DEFAULT '#f59e0b',
    danger_color TEXT DEFAULT '#ef4444',
    success_color TEXT DEFAULT '#22c55e',
    colors JSONB DEFAULT '[]',
    fonts JSONB DEFAULT '{"heading": "Inter", "body": "Inter", "mono": "JetBrains Mono"}',
    logos JSONB DEFAULT '{"primary": null, "secondary": null, "icon": null}',
    guidelines TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default brand kit for existing tenants
INSERT INTO core.brand_kits (tenant_id)
SELECT id FROM identity.tenants
ON CONFLICT (tenant_id) DO NOTHING;
