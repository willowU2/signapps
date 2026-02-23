const { Client } = require('pg');
const fs = require('fs');

async function run() {
    const client = new Client({ connectionString: 'postgres://signapps:signapps_dev@127.0.0.1:5433/signapps' });
    await client.connect();
    console.log('Connected to local PostgreSQL DB');

    const sql = fs.readFileSync('migrations/018_storage_tier3_schema.sql', 'utf8');
    await client.query(sql);
    console.log('Migration 018 executed successfully!');

    await client.end();
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
