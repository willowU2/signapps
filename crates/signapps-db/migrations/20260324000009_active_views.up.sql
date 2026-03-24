CREATE OR REPLACE VIEW platform.active_users AS SELECT * FROM identity.users WHERE deleted_at IS NULL;
CREATE OR REPLACE VIEW platform.active_drive_nodes AS SELECT * FROM drive.nodes WHERE deleted_at IS NULL;
CREATE OR REPLACE VIEW platform.active_envelopes AS SELECT * FROM signature.envelopes WHERE deleted_at IS NULL;
CREATE OR REPLACE VIEW platform.active_entity_refs AS SELECT * FROM platform.entity_references WHERE deleted_at IS NULL;
