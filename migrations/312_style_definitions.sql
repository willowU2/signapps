-- 312_style_definitions.sql
-- Style Inheritance: cascade chain for document, cell, and slide styles

CREATE TABLE IF NOT EXISTS core.style_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    style_type TEXT NOT NULL CHECK (style_type IN ('paragraph', 'character', 'cell', 'slide')),
    parent_id UUID REFERENCES core.style_definitions(id),
    properties JSONB NOT NULL DEFAULT '{}',
    is_builtin BOOLEAN NOT NULL DEFAULT false,
    scope TEXT NOT NULL DEFAULT 'global' CHECK (scope IN ('global', 'template', 'document')),
    document_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_style_definitions_tenant ON core.style_definitions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_style_definitions_parent ON core.style_definitions(parent_id);
CREATE INDEX IF NOT EXISTS idx_style_definitions_type ON core.style_definitions(tenant_id, style_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_style_definitions_name ON core.style_definitions(tenant_id, name, scope, document_id)
    WHERE document_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_style_definitions_name_global ON core.style_definitions(tenant_id, name, scope)
    WHERE document_id IS NULL;

-- Template-to-style association
CREATE TABLE IF NOT EXISTS core.template_styles (
    template_id UUID NOT NULL,
    style_id UUID NOT NULL REFERENCES core.style_definitions(id) ON DELETE CASCADE,
    PRIMARY KEY (template_id, style_id)
);

-- Seed built-in paragraph styles
INSERT INTO core.style_definitions (tenant_id, name, style_type, properties, is_builtin, scope)
SELECT t.id, s.name, 'paragraph', s.props::jsonb, true, 'global'
FROM identity.tenants t
CROSS JOIN (VALUES
    ('Heading 1', '{"fontSize": 32, "fontWeight": "bold", "marginBottom": 16}'),
    ('Heading 2', '{"fontSize": 24, "fontWeight": "bold", "marginBottom": 12}'),
    ('Heading 3', '{"fontSize": 20, "fontWeight": "bold", "marginBottom": 8}'),
    ('Body', '{"fontSize": 14, "lineHeight": 1.6}'),
    ('Quote', '{"fontSize": 14, "fontStyle": "italic", "borderLeft": "3px solid #d1d5db", "paddingLeft": 16}'),
    ('Code', '{"fontFamily": "JetBrains Mono, monospace", "fontSize": 13, "backgroundColor": "#f3f4f6", "padding": 8}'),
    ('Caption', '{"fontSize": 12, "color": "#6b7280"}')
) AS s(name, props)
ON CONFLICT DO NOTHING;

-- Seed built-in cell styles
INSERT INTO core.style_definitions (tenant_id, name, style_type, properties, is_builtin, scope)
SELECT t.id, s.name, 'cell', s.props::jsonb, true, 'global'
FROM identity.tenants t
CROSS JOIN (VALUES
    ('Number', '{"numberFormat": "#,##0.00"}'),
    ('Currency', '{"numberFormat": "#,##0.00 €", "textAlign": "right"}'),
    ('Percentage', '{"numberFormat": "0.00%", "textAlign": "right"}'),
    ('Date', '{"numberFormat": "DD/MM/YYYY"}'),
    ('Header Cell', '{"fontWeight": "bold", "backgroundColor": "#f3f4f6", "textAlign": "center"}')
) AS s(name, props)
ON CONFLICT DO NOTHING;
