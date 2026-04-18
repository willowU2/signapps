-- SignApps Platform - Drive VFS (Virtual File System) and Permissions
-- Version: 029
-- Date: 2026-03-05
-- ============================================================================
-- Schema: Drive (Virtual File System for unified documents & storage)
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS drive;
-- Node types
-- 'folder': A directory
-- 'file': A binary file stored in storage.files
-- 'document': A collaborative document stored in public.documents
DO $$ BEGIN CREATE TYPE drive.node_type AS ENUM ('folder', 'file', 'document'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- ============================================================================
-- Table: drive.nodes
-- ============================================================================
CREATE TABLE IF NOT EXISTS drive.nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id UUID REFERENCES drive.nodes(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    node_type drive.node_type NOT NULL,
    target_id UUID,
    -- UUID of the target depending on node_type (NULL for folder)
    owner_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    size BIGINT DEFAULT 0,
    -- Cache size for folders, actual size for files
    mime_type VARCHAR(255),
    -- Specific MIME for files, document type for documents
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    -- Soft delete (Trash)
    -- Constraints
    -- A file or document must have a target_id
    CONSTRAINT chk_target_id_presence CHECK (
        (
            node_type = 'folder'
            AND target_id IS NULL
        )
        OR (
            node_type IN ('file', 'document')
            AND target_id IS NOT NULL
        )
    ),
    -- Sibling names must be unique for active nodes (excluding trash)
    UNIQUE NULLS NOT DISTINCT (parent_id, name, deleted_at)
);
CREATE INDEX IF NOT EXISTS idx_drive_nodes_parent_id ON drive.nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_drive_nodes_owner_id ON drive.nodes(owner_id);
CREATE INDEX IF NOT EXISTS idx_drive_nodes_target_id ON drive.nodes(target_id);
-- Trigger to update updated_at
DROP TRIGGER IF EXISTS update_drive_nodes_updated_at ON drive.nodes;
CREATE TRIGGER update_drive_nodes_updated_at BEFORE
UPDATE ON drive.nodes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- ============================================================================
-- Table: drive.permissions
-- ============================================================================
-- Define roles: 'viewer', 'editor', 'manager'
DO $$ BEGIN CREATE TYPE drive.permission_role AS ENUM ('viewer', 'editor', 'manager'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS drive.permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id UUID NOT NULL REFERENCES drive.nodes(id) ON DELETE CASCADE,
    user_id UUID REFERENCES identity.users(id) ON DELETE CASCADE,
    group_id UUID REFERENCES identity.groups(id) ON DELETE CASCADE,
    role drive.permission_role NOT NULL DEFAULT 'viewer',
    granted_by UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Must grant either to a user or a group, but not both
    CONSTRAINT chk_user_or_group CHECK (
        (
            user_id IS NOT NULL
            AND group_id IS NULL
        )
        OR (
            user_id IS NULL
            AND group_id IS NOT NULL
        )
    ),
    -- Prevent duplicate permission for the same user/group on the same node
    UNIQUE NULLS NOT DISTINCT (node_id, user_id, group_id)
);
CREATE INDEX IF NOT EXISTS idx_drive_permissions_node_id ON drive.permissions(node_id);
CREATE INDEX IF NOT EXISTS idx_drive_permissions_user_id ON drive.permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_drive_permissions_group_id ON drive.permissions(group_id);
-- Trigger to update updated_at
DROP TRIGGER IF EXISTS update_drive_permissions_updated_at ON drive.permissions;
CREATE TRIGGER update_drive_permissions_updated_at BEFORE
UPDATE ON drive.permissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- Function to handle moving target when target_id matches in identity schemas
-- This is a soft link mapping, so we don't enforce foreign keys across schema directly on target_id due to its polymorphic nature.