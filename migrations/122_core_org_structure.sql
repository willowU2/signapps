-- Migration 122: Enterprise Org Structure (Party Model + Entity Trees + Assignments)
-- Introduces core schema with persons, org trees, closure table, assignments, sites.

CREATE SCHEMA IF NOT EXISTS core;

-- Person role type
DO $$ BEGIN CREATE TYPE core.person_role_type AS ENUM ('employee', 'client_contact', 'supplier_contact', 'partner'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tree type
DO $$ BEGIN CREATE TYPE core.tree_type AS ENUM ('internal', 'clients', 'suppliers'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Assignment types
DO $$ BEGIN CREATE TYPE core.assignment_type AS ENUM ('holder', 'interim', 'deputy', 'intern', 'contractor'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE core.responsibility_type AS ENUM ('hierarchical', 'functional', 'matrix'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE core.assignment_action AS ENUM ('created', 'modified', 'ended', 'transferred'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Site types
DO $$ BEGIN CREATE TYPE core.site_type AS ENUM ('campus', 'building', 'floor', 'room'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Persons (Party Model)
CREATE TABLE IF NOT EXISTS core.persons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    avatar_url TEXT,
    user_id UUID REFERENCES identity.users(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_persons_tenant ON core.persons(tenant_id);
CREATE INDEX IF NOT EXISTS idx_persons_user ON core.persons(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_persons_email ON core.persons(email) WHERE email IS NOT NULL;

-- Person roles (employee, client_contact, supplier_contact, partner)
CREATE TABLE IF NOT EXISTS core.person_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES core.persons(id) ON DELETE CASCADE,
    role_type core.person_role_type NOT NULL,
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(person_id, role_type)
);

-- Org trees (internal, clients, suppliers)
CREATE TABLE IF NOT EXISTS core.org_trees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    tree_type core.tree_type NOT NULL,
    name TEXT NOT NULL,
    root_node_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, tree_type)
);

-- Org nodes (generic tree nodes)
CREATE TABLE IF NOT EXISTS core.org_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tree_id UUID NOT NULL REFERENCES core.org_trees(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES core.org_nodes(id) ON DELETE SET NULL,
    node_type TEXT NOT NULL,
    name TEXT NOT NULL,
    code TEXT,
    description TEXT,
    config JSONB DEFAULT '{}',
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_org_nodes_tree ON core.org_nodes(tree_id);
CREATE INDEX IF NOT EXISTS idx_org_nodes_parent ON core.org_nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_org_nodes_type ON core.org_nodes(node_type);

-- Closure table for O(1) ancestor/descendant queries
CREATE TABLE IF NOT EXISTS core.org_closure (
    ancestor_id UUID NOT NULL REFERENCES core.org_nodes(id) ON DELETE CASCADE,
    descendant_id UUID NOT NULL REFERENCES core.org_nodes(id) ON DELETE CASCADE,
    depth INT NOT NULL DEFAULT 0,
    PRIMARY KEY (ancestor_id, descendant_id)
);

-- Assignments (person <-> node, temporal)
CREATE TABLE IF NOT EXISTS core.assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES core.persons(id) ON DELETE CASCADE,
    node_id UUID NOT NULL REFERENCES core.org_nodes(id) ON DELETE CASCADE,
    assignment_type core.assignment_type DEFAULT 'holder',
    responsibility_type core.responsibility_type DEFAULT 'hierarchical',
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    fte_ratio DECIMAL(3,2) DEFAULT 1.00,
    is_primary BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_assignments_person ON core.assignments(person_id);
CREATE INDEX IF NOT EXISTS idx_assignments_node ON core.assignments(node_id);
CREATE INDEX IF NOT EXISTS idx_assignments_active ON core.assignments(end_date) WHERE end_date IS NULL;

-- Assignment history (forensic)
CREATE TABLE IF NOT EXISTS core.assignment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL REFERENCES core.assignments(id) ON DELETE CASCADE,
    action core.assignment_action NOT NULL,
    changed_by UUID REFERENCES identity.users(id),
    changes JSONB DEFAULT '{}',
    reason TEXT,
    effective_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_assignment_history_assignment ON core.assignment_history(assignment_id);

-- Sites (geographic)
CREATE TABLE IF NOT EXISTS core.sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    parent_id UUID REFERENCES core.sites(id) ON DELETE SET NULL,
    site_type core.site_type NOT NULL,
    name TEXT NOT NULL,
    address TEXT,
    city TEXT,
    country TEXT,
    geo_lat DOUBLE PRECISION,
    geo_lng DOUBLE PRECISION,
    timezone TEXT DEFAULT 'Europe/Paris',
    capacity INT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sites_tenant ON core.sites(tenant_id);

-- Node <-> Site (N:N)
CREATE TABLE IF NOT EXISTS core.node_sites (
    node_id UUID NOT NULL REFERENCES core.org_nodes(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES core.sites(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (node_id, site_id)
);

-- Person <-> Site (temporal)
CREATE TABLE IF NOT EXISTS core.person_sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES core.persons(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES core.sites(id) ON DELETE CASCADE,
    start_date DATE DEFAULT CURRENT_DATE,
    end_date DATE,
    is_primary BOOLEAN DEFAULT TRUE
);

-- Permission profiles on nodes
CREATE TABLE IF NOT EXISTS core.permission_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id UUID NOT NULL REFERENCES core.org_nodes(id) ON DELETE CASCADE,
    inherit BOOLEAN DEFAULT TRUE,
    modules JSONB DEFAULT '{}',
    max_role TEXT DEFAULT 'user',
    custom_permissions JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(node_id)
);

-- Closure table trigger (auto-populate on node insert)
CREATE OR REPLACE FUNCTION core.maintain_closure() RETURNS TRIGGER AS $$
BEGIN
    -- Self-reference
    INSERT INTO core.org_closure (ancestor_id, descendant_id, depth) VALUES (NEW.id, NEW.id, 0) ON CONFLICT DO NOTHING;
    -- Copy parent's ancestors
    IF NEW.parent_id IS NOT NULL THEN
        INSERT INTO core.org_closure (ancestor_id, descendant_id, depth)
        SELECT ancestor_id, NEW.id, depth + 1
        FROM core.org_closure WHERE descendant_id = NEW.parent_id
        ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_org_nodes_closure ON core.org_nodes;
CREATE TRIGGER trg_org_nodes_closure AFTER INSERT ON core.org_nodes
FOR EACH ROW EXECUTE FUNCTION core.maintain_closure();

-- Updated_at triggers
CREATE OR REPLACE FUNCTION core.update_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
    FOR t IN SELECT unnest(ARRAY['persons','org_trees','org_nodes','assignments','sites','permission_profiles'])
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_core_%s_updated ON core.%s', t, t);
        EXECUTE format('CREATE TRIGGER trg_core_%s_updated BEFORE UPDATE ON core.%s FOR EACH ROW EXECUTE FUNCTION core.update_updated_at()', t, t);
    END LOOP;
END $$;
