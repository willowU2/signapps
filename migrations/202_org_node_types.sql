-- Migration 202: Extensible org node type definitions (schema-as-data pattern)
-- Enriches the existing workforce_org_node_types table with tree_type, label,
-- allowed_children as TEXT[], schema JSONB, is_active, and updated_at.
-- Seeds default types for internal, clients, and suppliers trees.

-- ─── Enrich existing table ────────────────────────────────────────────────────

-- Ensure system tenant exists (tenant_id = all-zeros) before inserting foreign keys
INSERT INTO identity.tenants (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000000', 'System', 'system')
ON CONFLICT DO NOTHING;

ALTER TABLE workforce_org_node_types
    ADD COLUMN IF NOT EXISTS tree_type   TEXT CHECK (tree_type IN ('internal', 'clients', 'suppliers')),
    ADD COLUMN IF NOT EXISTS label       TEXT,
    ADD COLUMN IF NOT EXISTS allowed_children_arr TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS schema      JSONB DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS is_active   BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ DEFAULT now();

-- Backfill label from name where null
UPDATE workforce_org_node_types SET label = name WHERE label IS NULL;

-- Backfill tree_type as 'internal' for existing rows (legacy default)
UPDATE workforce_org_node_types SET tree_type = 'internal' WHERE tree_type IS NULL;

-- ─── System default node types (tenant_id = all-zeros = system) ──────────────
-- Internal tree
INSERT INTO workforce_org_node_types
    (tenant_id, tree_type, code, name, label, color, icon, sort_order, allowed_children_arr, schema, is_active)
VALUES
    ('00000000-0000-0000-0000-000000000000', 'internal', 'group',      'group',      'Groupe',          '#6366f1', 'building-2',   0, ARRAY['subsidiary','bu','department','service','team','position'], '{}', true),
    ('00000000-0000-0000-0000-000000000000', 'internal', 'subsidiary', 'subsidiary', 'Filiale',         '#8b5cf6', 'building',     1, ARRAY['bu','department','service','team','position'],               '{}', true),
    ('00000000-0000-0000-0000-000000000000', 'internal', 'bu',         'bu',         'Business Unit',   '#a855f7', 'layers',       2, ARRAY['department','service','team','position'],                    '{}', true),
    ('00000000-0000-0000-0000-000000000000', 'internal', 'department', 'department', 'Département',     '#c026d3', 'briefcase',    3, ARRAY['service','team','position'],                                '{}', true),
    ('00000000-0000-0000-0000-000000000000', 'internal', 'service',    'service',    'Service',         '#db2777', 'folder',       4, ARRAY['team','position'],                                          '{}', true),
    ('00000000-0000-0000-0000-000000000000', 'internal', 'team',       'team',       'Équipe',          '#e11d48', 'users',        5, ARRAY['position'],                                                 '{}', true),
    ('00000000-0000-0000-0000-000000000000', 'internal', 'position',   'position',   'Poste',           '#f43f5e', 'user',         6, ARRAY[]::TEXT[],                                                   '{}', true),
-- Clients tree
    ('00000000-0000-0000-0000-000000000000', 'clients',  'client_group',  'client_group',  'Groupe client',  '#0ea5e9', 'building-2',  0, ARRAY['client','project'],                       '{}', true),
    ('00000000-0000-0000-0000-000000000000', 'clients',  'client',        'client',        'Client',         '#38bdf8', 'user',        1, ARRAY['project','workstream'],                   '{}', true),
    ('00000000-0000-0000-0000-000000000000', 'clients',  'project',       'project',       'Projet',         '#7dd3fc', 'folder',      2, ARRAY['workstream'],                             '{}', true),
    ('00000000-0000-0000-0000-000000000000', 'clients',  'workstream',    'workstream',    'Workstream',     '#bae6fd', 'git-branch',  3, ARRAY[]::TEXT[],                                 '{}', true),
-- Suppliers tree
    ('00000000-0000-0000-0000-000000000000', 'suppliers','supplier_group','supplier_group','Groupe fournisseur','#10b981','building-2',0, ARRAY['supplier','contract'],                    '{}', true),
    ('00000000-0000-0000-0000-000000000000', 'suppliers','supplier',      'supplier',      'Fournisseur',    '#34d399', 'building',    1, ARRAY['contract'],                               '{}', true),
    ('00000000-0000-0000-0000-000000000000', 'suppliers','contract',      'contract',      'Contrat',        '#6ee7b7', 'file-text',   2, ARRAY[]::TEXT[],                                 '{}', true)
ON CONFLICT DO NOTHING;

-- ─── Index ────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_node_types_tenant_tree
    ON workforce_org_node_types (tenant_id, tree_type);
