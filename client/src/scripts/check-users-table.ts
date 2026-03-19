import pg from 'pg';

interface ColumnInfo {
  column_name: string;
  data_type: string;
}

async function main() {
  const client = new pg.Client('postgres://signapps:signapps_dev@127.0.0.1:5432/signapps');
  await client.connect();
  const res = await client.query<ColumnInfo>(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'identity' AND table_name = 'users' ORDER BY ordinal_position`);
  console.log('Columns in identity.users:');
  res.rows.forEach((r) => console.log(`  ${r.column_name}: ${r.data_type}`));
  await client.end();
}

main();
