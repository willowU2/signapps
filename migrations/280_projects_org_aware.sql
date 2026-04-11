-- 280_projects_org_aware.sql
-- Projects org-aware: assignees, org anchoring, enriched members, portal access

-- 1. Add assignee + contributors to time_items (tasks)
ALTER TABLE scheduling.time_items ADD COLUMN IF NOT EXISTS assignee_id UUID;
ALTER TABLE scheduling.time_items ADD COLUMN IF NOT EXISTS contributor_ids UUID[] DEFAULT '{}';
ALTER TABLE scheduling.time_items ADD COLUMN IF NOT EXISTS external_visible BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_time_items_assignee ON scheduling.time_items(assignee_id) WHERE item_type = 'task';

-- 2. Enrich projects with org anchoring + portal visibility
ALTER TABLE calendar.projects ADD COLUMN IF NOT EXISTS org_node_id UUID;
ALTER TABLE calendar.projects ADD COLUMN IF NOT EXISTS portal_visible BOOLEAN DEFAULT false;
ALTER TABLE calendar.projects ADD COLUMN IF NOT EXISTS progress_percent INT DEFAULT 0;
ALTER TABLE calendar.projects ADD COLUMN IF NOT EXISTS budget_hours NUMERIC;

-- 3. Enrich project_members with person + context + external roles
ALTER TABLE calendar.project_members ADD COLUMN IF NOT EXISTS person_id UUID;
ALTER TABLE calendar.project_members ADD COLUMN IF NOT EXISTS context_type TEXT DEFAULT 'employee';
ALTER TABLE calendar.project_members ADD COLUMN IF NOT EXISTS invited_by UUID;

-- Update role constraint to include external roles
DO $$
BEGIN
    ALTER TABLE calendar.project_members DROP CONSTRAINT IF EXISTS project_members_role_check;
    ALTER TABLE calendar.project_members ADD CONSTRAINT project_members_role_check
        CHECK (role IN ('owner', 'admin', 'member', 'viewer', 'external_contributor', 'external_observer'));
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'project_members constraint update skipped: %', SQLERRM;
END $$;

-- Index for person-based lookups
CREATE INDEX IF NOT EXISTS idx_project_members_person ON calendar.project_members(person_id) WHERE person_id IS NOT NULL;
