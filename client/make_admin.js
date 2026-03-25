const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://signapps:signapps_dev@127.0.0.1:5432/signapps'
});

async function run() {
  await client.connect();
  console.log('Connected to DB...');

  try {
      const res = await client.query(`UPDATE identity.users SET tenant_id = '3cfd8a0b-e6cf-4fe7-8c30-2159c0d56cd3' WHERE username = 'admin' RETURNING *;`);
      console.log('User linked to tenant:', res.rows[0]);

      // In case role is string
      if(res.rowCount === 0) {
         console.log('Role 2 failed or user not found');
      }
  } catch (e) {
      console.log('Error setting role to integer:', e.message);
      try {
          const res2 = await client.query(`UPDATE identity.users SET role = 'super_admin' WHERE username = 'admin' RETURNING *;`);
          console.log('User role updated to super_admin:', res2.rows[0]);
      } catch(e2) {
          console.log('Error setting role to super_admin:', e2.message);
          // Try to just see the schema
          const user = await client.query(`SELECT * FROM identity.users WHERE username = 'admin'`);
          console.log('Current user:', user.rows[0]);
      }
  } finally {
      await client.end();
  }
}

run();
