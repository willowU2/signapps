-- Drop the globally restrictive constraint that prevented different users from having root files with the same name
ALTER TABLE drive.nodes DROP CONSTRAINT IF EXISTS nodes_parent_id_name_deleted_at_key;

-- Add the proper scoped constraint (unique per owner)
ALTER TABLE drive.nodes ADD CONSTRAINT nodes_owner_parent_name_del_key UNIQUE NULLS NOT DISTINCT (owner_id, parent_id, name, deleted_at);
