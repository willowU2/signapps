const { Client } = require('pg');
const client = new Client('postgres://signapps:signapps_dev@127.0.0.1:5432/signapps');

async function check() {
  await client.connect();
  let res = await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'identity' AND table_name = 'users'");
  console.log("COLUMNS IN identity.users: ", res.rows.map(r => r.column_name).join(', '));
  
  let res2 = await client.query("SELECT * FROM _sqlx_migrations ORDER BY version DESC LIMIT 5");
  console.log("LAST 5 MIGRATIONS:");
  res2.rows.forEach(r => console.log(r.version, r.description, r.success));
  
  await client.end();
}

check().catch(console.error);
