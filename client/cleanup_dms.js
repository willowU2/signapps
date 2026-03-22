const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://signapps:signapps_dev@127.0.0.1:5432/signapps',
});

async function main() {
  await client.connect();
  
  // Find all DMs with bin_len = 2 (empty Yjs documents)
  console.log("Deleting empty DMs...");
  const res = await client.query(`
    DELETE FROM documents 
    WHERE doc_type = 'dm' AND length(doc_binary) <= 2
    RETURNING id;
  `);
  
  console.log(`Deleted ${res.rowCount} empty DMs.`);
  
  await client.end();
}

main().catch(console.error);
