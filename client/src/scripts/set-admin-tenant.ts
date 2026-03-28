/**
 * Set Admin Tenant Script
 *
 * Directly updates the admin user's tenant_id in the database.
 */

import pg from 'pg';
const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://signapps:signapps_dev@127.0.0.1:5432/signapps';
const ADMIN_USER_ID = '7ba068cc-ddef-4e8e-8f32-f6e5ba3662f9';
const TENANT_ID = '1c1c220e-690e-40c0-965e-a8b7d83e01a4';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log('Connecté to database');

    // Update the admin user's tenant_id
    const result = await client.query(
      `UPDATE identity.users SET tenant_id = $1, updated_at = NOW() WHERE id = $2 RETURNING id, username, tenant_id`,
      [TENANT_ID, ADMIN_USER_ID]
    );

    if (result.rows.length > 0) {
      console.log('✓ Admin user updated:');
      console.log(result.rows[0]);
    } else {
      console.log('✗ Admin user not found');
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
