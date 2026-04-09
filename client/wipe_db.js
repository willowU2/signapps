const { Client } = require("pg");

const client = new Client({
  connectionString: "postgres://signapps:signapps_dev@127.0.0.1:5432/signapps",
});

async function run() {
  await client.connect();
  console.log("Connected to DB. Wiping ALL schemas dynamically...");

  try {
    const res = await client.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast');");
    const schemas = res.rows.map(r => r.schema_name);

    for (const schema of schemas) {
      console.log(`Dropping schema: ${schema}`);
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE;`);
    }

    await client.query("CREATE SCHEMA public;");
    console.log("Complete database wipe successful! All user namespaces purged!");
  } catch (e) {
    console.error("Error wiping DB:", e);
  } finally {
    await client.end();
  }
}

run();
