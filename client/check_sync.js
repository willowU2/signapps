const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgres://signapps:signapps_dev@127.0.0.1:5432/signapps'
  });
  await client.connect();
  
  console.log('--- Time Items (Scheduler DB) ---');
  const res = await client.query('SELECT title, item_type, start_time FROM scheduling.time_items ORDER BY created_at DESC LIMIT 5');
  console.table(res.rows);

  console.log('\n--- Events (Calendar DB) ---');
  const res2 = await client.query('SELECT title, start_time FROM calendar.events ORDER BY created_at DESC LIMIT 5');
  console.table(res2.rows);

  await client.end();
}
main().catch(console.error);
