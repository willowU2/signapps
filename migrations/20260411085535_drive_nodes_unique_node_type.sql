DO $$
DECLARE
    con_name text;
BEGIN
    SELECT conname INTO con_name
    FROM pg_constraint
    WHERE conrelid = 'drive.nodes'::regclass AND contype = 'u'
      AND pg_get_constraintdef(oid) NOT LIKE '%node_type%';

    IF con_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE drive.nodes DROP CONSTRAINT ' || quote_ident(con_name);
    END IF;
END $$;

ALTER TABLE drive.nodes ADD CONSTRAINT "nodes_parent_id_name_node_type_deleted_at_key" UNIQUE NULLS NOT DISTINCT (parent_id, name, node_type, deleted_at);
