-- Migration 038: Update chk_target_id_presence to include spreadsheet and presentation
ALTER TABLE drive.nodes DROP CONSTRAINT chk_target_id_presence;

ALTER TABLE drive.nodes ADD CONSTRAINT chk_target_id_presence CHECK (
    (
        node_type = 'folder'
        AND target_id IS NULL
    )
    OR (
        node_type IN ('file', 'document', 'spreadsheet', 'presentation')
        AND target_id IS NOT NULL
    )
);
