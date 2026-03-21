const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://signapps:signapps_dev@127.0.0.1:5432/signapps' });
async function run() {
  await client.connect();
  try {
    const tenants = await client.query('SELECT * FROM identity.tenants');
    console.log('Tenants:', tenants.rows);
    const users = await client.query('SELECT * FROM identity.users');
    
    let tenantId;
    if (tenants.rows.length > 0) { tenantId = tenants.rows[0].id; }
    else {
        const res = await client.query(`INSERT INTO identity.tenants (name, slug, plan, max_users, max_resources, max_workspaces, is_active) VALUES ('Default Tenant', 'default', 'enterprise', 100, 100, 100, true) RETURNING id`);
        tenantId = res.rows[0].id;
    }

    let adminUser = users.rows.find(u => u.username === 'admin' || u.email.includes('admin'));
    if (adminUser) {
        await client.query('UPDATE identity.users SET tenant_id = $1 WHERE id = $2', [tenantId, adminUser.id]);
        console.log('Fixed admin user tenant_id to', tenantId);
    }
  } catch(e) { console.error(e); } finally { await client.end(); }
}
run();
