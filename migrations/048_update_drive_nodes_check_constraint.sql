-- Migration 048: Update chk_target_id_presence to include spreadsheet
-- Note: 'presentation' will be added in migration 234 after enum is created in 058
ALTER TABLE drive.nodes DROP CONSTRAINT chk_target_id_presence;

DO $$ BEGIN ALTER TABLE drive.nodes ADD CONSTRAINT chk_target_id_presence CHECK (
    (
        node_type = 'folder'
        AND target_id IS NULL
    )
    OR (
        node_type IN ('file', 'document', 'spreadsheet')
        AND target_id IS NOT NULL
    )
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
