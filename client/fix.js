const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://signapps:signapps_dev@127.0.0.1:5432/signapps'
});

async function run() {
  await client.connect();
  console.log('Connected');

  try {
    const res = await client.query(`
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
    `);
    console.log('Dropped old constraint if existed', res.command);
    
    await client.query(`
      ALTER TABLE drive.nodes ADD CONSTRAINT "nodes_parent_id_name_node_type_deleted_at_key" UNIQUE NULLS NOT DISTINCT (parent_id, name, node_type, deleted_at);
    `);
    console.log('Added new constraint');
  } catch(e) {
    console.error('Error:', e);
  } finally {
    await client.end();
  }
}

run();
