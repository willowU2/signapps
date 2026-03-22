const fs = require('fs');
const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://signapps:signapps_dev@127.0.0.1:5432/signapps',
});

async function main() {
  await client.connect();
  const res = await client.query("SELECT * FROM identity.users LIMIT 2;");
  fs.writeFileSync('users.json', JSON.stringify(res.rows, null, 2));
  await client.end();
}

main().catch(console.error);
