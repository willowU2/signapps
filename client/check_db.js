const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://signapps:signapps_dev@127.0.0.1:5432/signapps',
});

async function main() {
  await client.connect();
  const res = await client.query(`
    SELECT id, name, doc_type, length(doc_binary) as bin_len, created_at 
    FROM documents 
    ORDER BY created_at DESC 
    LIMIT 10;
  `);
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
}

main().catch(console.error);
