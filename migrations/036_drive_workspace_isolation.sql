-- SignApps Platform - Workspace Isolation for Drive Nodes
-- Version: 036
-- Date: 2026-03-20

-- Add workspace_id column to strictly isolate documents and folders per workspace
ALTER TABLE drive.nodes ADD COLUMN workspace_id UUID REFERENCES identity.workspaces(id) ON DELETE CASCADE;

-- Index to optimize querying nodes by workspace
CREATE INDEX idx_drive_nodes_workspace_id ON drive.nodes(workspace_id);
