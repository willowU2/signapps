-- ============================================================================
-- Workforce Planning Schema
--
-- Tables for organizational structure, employee management, and coverage rules.
-- Uses closure table pattern for efficient hierarchical queries.
-- ============================================================================

-- ============================================================================
-- Organization Node Types (customizable per tenant)
-- ============================================================================

CREATE TABLE IF NOT EXISTS workforce_org_node_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES identity.tenants(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    icon VARCHAR(50),
    color VARCHAR(20),
    allowed_children JSONB DEFAULT '[]'::jsonb,
    config_schema JSONB,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(tenant_id, code)
);

CREATE INDEX idx_org_node_types_tenant ON workforce_org_node_types(tenant_id);

-- Insert default node types for each tenant
INSERT INTO workforce_org_node_types (tenant_id, code, name, icon, color, allowed_children, sort_order)
SELECT
    t.id,
    types.code,
    types.name,
    types.icon,
    types.color,
    types.allowed_children,
    types.sort_order
FROM identity.tenants t
CROSS JOIN (VALUES
    ('company', 'Entreprise', 'building-2', '#6366f1', '["region", "department", "team"]'::jsonb, 0),
    ('region', 'Région', 'map-pin', '#8b5cf6', '["department", "team"]'::jsonb, 1),
    ('department', 'Département', 'briefcase', '#a855f7', '["team", "position"]'::jsonb, 2),
    ('team', 'Équipe', 'users', '#d946ef', '["position"]'::jsonb, 3),
    ('position', 'Poste', 'user', '#ec4899', '[]'::jsonb, 4)
) AS types(code, name, icon, color, allowed_children, sort_order)
ON CONFLICT (tenant_id, code) DO NOTHING;

-- ============================================================================
-- Organization Nodes (TreeList structure)
-- ============================================================================

CREATE TABLE IF NOT EXISTS workforce_org_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES identity.tenants(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES workforce_org_nodes(id) ON DELETE CASCADE,
    node_type VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    description TEXT,
    config JSONB DEFAULT '{}'::jsonb,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_org_nodes_tenant ON workforce_org_nodes(tenant_id);
CREATE INDEX idx_org_nodes_parent ON workforce_org_nodes(parent_id);
CREATE INDEX idx_org_nodes_type ON workforce_org_nodes(node_type);
CREATE INDEX idx_org_nodes_active ON workforce_org_nodes(tenant_id, is_active);
CREATE UNIQUE INDEX idx_org_nodes_code ON workforce_org_nodes(tenant_id, code) WHERE code IS NOT NULL;

-- ============================================================================
-- Organization Closure Table (for efficient ancestor/descendant queries)
-- ============================================================================

CREATE TABLE IF NOT EXISTS workforce_org_closure (
    ancestor_id UUID NOT NULL REFERENCES workforce_org_nodes(id) ON DELETE CASCADE,
    descendant_id UUID NOT NULL REFERENCES workforce_org_nodes(id) ON DELETE CASCADE,
    depth INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (ancestor_id, descendant_id)
);

CREATE INDEX idx_org_closure_ancestor ON workforce_org_closure(ancestor_id);
CREATE INDEX idx_org_closure_descendant ON workforce_org_closure(descendant_id);
CREATE INDEX idx_org_closure_depth ON workforce_org_closure(depth);

-- ============================================================================
-- Function Definitions (job roles/positions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS workforce_function_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES identity.tenants(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(20),
    icon VARCHAR(50),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(tenant_id, code)
);

CREATE INDEX idx_function_defs_tenant ON workforce_function_definitions(tenant_id);
CREATE INDEX idx_function_defs_active ON workforce_function_definitions(tenant_id, is_active);

-- ============================================================================
-- Employees (distinct from system users)
-- ============================================================================

CREATE TABLE IF NOT EXISTS workforce_employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES identity.tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES identity.users(id) ON DELETE SET NULL,
    org_node_id UUID NOT NULL REFERENCES workforce_org_nodes(id) ON DELETE RESTRICT,
    employee_number VARCHAR(50),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    functions JSONB DEFAULT '[]'::jsonb,
    contract_type VARCHAR(50) DEFAULT 'full-time',
    fte_ratio DECIMAL(3,2) DEFAULT 1.00 CHECK (fte_ratio >= 0 AND fte_ratio <= 1),
    hire_date DATE,
    termination_date DATE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'on_leave', 'suspended', 'terminated')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_employees_tenant ON workforce_employees(tenant_id);
CREATE INDEX idx_employees_org_node ON workforce_employees(org_node_id);
CREATE INDEX idx_employees_user ON workforce_employees(user_id);
CREATE INDEX idx_employees_status ON workforce_employees(tenant_id, status);
CREATE INDEX idx_employees_functions ON workforce_employees USING gin(functions);
CREATE UNIQUE INDEX idx_employees_number ON workforce_employees(tenant_id, employee_number) WHERE employee_number IS NOT NULL;

-- ============================================================================
-- Coverage Templates (reusable weekly patterns)
-- ============================================================================

CREATE TABLE IF NOT EXISTS workforce_coverage_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES identity.tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    weekly_pattern JSONB NOT NULL DEFAULT '{
        "monday": [],
        "tuesday": [],
        "wednesday": [],
        "thursday": [],
        "friday": [],
        "saturday": [],
        "sunday": []
    }'::jsonb,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_coverage_templates_tenant ON workforce_coverage_templates(tenant_id);
CREATE INDEX idx_coverage_templates_default ON workforce_coverage_templates(tenant_id, is_default);

-- ============================================================================
-- Coverage Rules (applied to org nodes)
-- ============================================================================

CREATE TABLE IF NOT EXISTS workforce_coverage_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES identity.tenants(id) ON DELETE CASCADE,
    org_node_id UUID NOT NULL REFERENCES workforce_org_nodes(id) ON DELETE CASCADE,
    template_id UUID REFERENCES workforce_coverage_templates(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    valid_from DATE NOT NULL,
    valid_to DATE,
    custom_slots JSONB,
    inherit_from_parent BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_date_range CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE INDEX idx_coverage_rules_tenant ON workforce_coverage_rules(tenant_id);
CREATE INDEX idx_coverage_rules_org_node ON workforce_coverage_rules(org_node_id);
CREATE INDEX idx_coverage_rules_template ON workforce_coverage_rules(template_id);
CREATE INDEX idx_coverage_rules_active ON workforce_coverage_rules(tenant_id, is_active);
CREATE INDEX idx_coverage_rules_validity ON workforce_coverage_rules(valid_from, valid_to);

-- ============================================================================
-- Triggers
-- ============================================================================

-- Auto-insert self-reference in closure table when node is created
CREATE OR REPLACE FUNCTION workforce_org_node_insert_closure()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert self-reference
    INSERT INTO workforce_org_closure (ancestor_id, descendant_id, depth)
    VALUES (NEW.id, NEW.id, 0);

    -- Insert parent's ancestors with depth + 1
    IF NEW.parent_id IS NOT NULL THEN
        INSERT INTO workforce_org_closure (ancestor_id, descendant_id, depth)
        SELECT ancestor_id, NEW.id, depth + 1
        FROM workforce_org_closure
        WHERE descendant_id = NEW.parent_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_workforce_org_node_insert_closure
    AFTER INSERT ON workforce_org_nodes
    FOR EACH ROW
    EXECUTE FUNCTION workforce_org_node_insert_closure();

-- Update timestamps
CREATE OR REPLACE FUNCTION workforce_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_workforce_org_nodes_updated
    BEFORE UPDATE ON workforce_org_nodes
    FOR EACH ROW
    EXECUTE FUNCTION workforce_update_timestamp();

CREATE TRIGGER trg_workforce_employees_updated
    BEFORE UPDATE ON workforce_employees
    FOR EACH ROW
    EXECUTE FUNCTION workforce_update_timestamp();

CREATE TRIGGER trg_workforce_coverage_templates_updated
    BEFORE UPDATE ON workforce_coverage_templates
    FOR EACH ROW
    EXECUTE FUNCTION workforce_update_timestamp();

CREATE TRIGGER trg_workforce_coverage_rules_updated
    BEFORE UPDATE ON workforce_coverage_rules
    FOR EACH ROW
    EXECUTE FUNCTION workforce_update_timestamp();

-- ============================================================================
-- Views
-- ============================================================================

-- View: Organization tree with employee counts
CREATE OR REPLACE VIEW workforce_org_tree_view AS
SELECT
    n.id,
    n.tenant_id,
    n.parent_id,
    n.node_type,
    n.name,
    n.code,
    n.is_active,
    n.sort_order,
    (SELECT COUNT(*) FROM workforce_org_closure c WHERE c.ancestor_id = n.id AND c.depth > 0) AS descendant_count,
    (SELECT COUNT(*) FROM workforce_employees e
     INNER JOIN workforce_org_closure c ON c.descendant_id = e.org_node_id
     WHERE c.ancestor_id = n.id AND e.status = 'active') AS employee_count,
    COALESCE(
        (SELECT array_agg(ancestor_id ORDER BY depth DESC)
         FROM workforce_org_closure
         WHERE descendant_id = n.id AND depth > 0),
        ARRAY[]::uuid[]
    ) AS ancestor_path
FROM workforce_org_nodes n;

-- View: Coverage gaps (current)
CREATE OR REPLACE VIEW workforce_coverage_gaps_view AS
SELECT
    r.id AS rule_id,
    r.org_node_id,
    n.name AS org_node_name,
    r.name AS rule_name,
    r.valid_from,
    r.valid_to,
    CASE
        WHEN r.custom_slots IS NOT NULL THEN r.custom_slots
        WHEN t.weekly_pattern IS NOT NULL THEN t.weekly_pattern
        ELSE '{}'::jsonb
    END AS effective_pattern
FROM workforce_coverage_rules r
LEFT JOIN workforce_coverage_templates t ON t.id = r.template_id
INNER JOIN workforce_org_nodes n ON n.id = r.org_node_id
WHERE r.is_active = true
AND r.valid_from <= CURRENT_DATE
AND (r.valid_to IS NULL OR r.valid_to >= CURRENT_DATE);

-- ============================================================================
-- Seed Data for Demo (optional - can be removed in production)
-- ============================================================================

-- Note: Actual seed data would be inserted per-tenant during onboarding
