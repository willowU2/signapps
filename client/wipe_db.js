const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://signapps:signapps_dev@127.0.0.1:5432/signapps'
});

async function run() {
  await client.connect();
  console.log('Connected to DB. Wiping ALL schemas...');

  try {
      const schemas = [
          'scheduling', 'drive', 'meet', 'mail', 'it', 'remote', 'pxe', 
          'calendar', 'ai', 'identity', 'containers', 'proxy', 'securelink', 
          'storage', 'documents', 'scheduler', 'public', 'auth', 'core', 'config'
      ];
      
      for (const schema of schemas) {
        await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE;`);
      }
      
      await client.query('CREATE SCHEMA public;');
      console.log('Complete database wipe successful! All 20 namespaces purged!');
  } catch (e) {
      console.error('Error wiping DB:', e);
  } finally {
      await client.end();
  }
}

run();
