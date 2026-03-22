const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://signapps:signapps_dev@127.0.0.1:5432/signapps',
});

async function main() {
  await client.connect();
  
  // Find all DMs and their participants
  const res = await client.query(`
    SELECT d.id, cm.user_id, d.created_at
    FROM documents d
    JOIN channel_members cm ON d.id = cm.channel_id
    WHERE d.doc_type = 'dm'
    ORDER BY d.created_at DESC
  `);
  
  const dms = res.rows;
  
  // Keep track of which users have a DM already
  const seenUsers = new Set();
  const dmsToDelete = [];
  const dmsToKeep = [];

  for (const dm of dms) {
    if (seenUsers.has(dm.user_id)) {
      dmsToDelete.push(dm.id);
    } else {
      seenUsers.add(dm.user_id);
      dmsToKeep.push(dm.id);
    }
  }

  // Filter out duplicates (multiple user_id rows with the same dm_id)
  const uniqueDmsToDelete = [...new Set(dmsToDelete)];

  console.log(`Found ${uniqueDmsToDelete.length} duplicate DMs to delete.`);
  
  if (uniqueDmsToDelete.length > 0) {
      const deleteRes = await client.query(`
        DELETE FROM documents 
        WHERE id = ANY($1::uuid[])
      `, [uniqueDmsToDelete]);
      console.log(`Deleted ${deleteRes.rowCount} duplicate DMs.`);
  }

  await client.end();
}

main().catch(console.error);
