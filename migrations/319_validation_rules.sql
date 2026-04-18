-- 319_validation_rules.sql
-- Configurable design validation rules per tenant

CREATE TABLE IF NOT EXISTS core.validation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    rule_type TEXT NOT NULL CHECK (rule_type IN (
        'min_font_size', 'max_font_size', 'allowed_fonts', 'allowed_colors',
        'min_image_dpi', 'max_text_length', 'required_element', 'bleed_safe_zone',
        'contrast_ratio', 'custom'
    )),
    config JSONB NOT NULL DEFAULT '{}',
    severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('error', 'warning', 'info')),
    is_active BOOLEAN DEFAULT true,
    applies_to TEXT[] DEFAULT '{document,spreadsheet,presentation}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_validation_rules_tenant ON core.validation_rules(tenant_id);

-- Seed sensible defaults
INSERT INTO core.validation_rules (tenant_id, name, rule_type, config, severity)
SELECT t.id, s.name, s.rule_type, s.config::jsonb, s.severity
FROM identity.tenants t
CROSS JOIN (VALUES
    ('Minimum font size', 'min_font_size', '{"min": 10}', 'warning'),
    ('Maximum text length', 'max_text_length', '{"max": 5000}', 'info'),
    ('Minimum image DPI', 'min_image_dpi', '{"min_dpi": 150}', 'warning')
) AS s(name, rule_type, config, severity)
ON CONFLICT DO NOTHING;
