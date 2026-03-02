-- SignApps Platform - Infinite Tasks Positioning Migration
-- Version: 025
-- Date: 2026-03-02
-- Implements: Position tracking for drag & drop and recursive CTE logic basis

-- Add strictly-indexed position column for ordering among siblings
ALTER TABLE calendar.tasks ADD COLUMN position INT DEFAULT 0;

-- Optionally, add an index to speed up ordered retrieval per parent
CREATE INDEX IF NOT EXISTS idx_tasks_parent_position ON calendar.tasks(parent_task_id, position);
