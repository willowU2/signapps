const fs = require('fs');
const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://signapps:signapps_dev@127.0.0.1:5432/signapps',
});

async function main() {
  await client.connect();
  const res = await client.query("SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'documents';");
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
}

main().catch(console.error);
