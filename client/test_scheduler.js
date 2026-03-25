async function main() {
  const authRes = await fetch('http://localhost:3001/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const authData = await authRes.json();
  const token = authData.access_token;

  const wsRes = await fetch('http://localhost:3001/api/v1/workspaces', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  const wsData = await wsRes.json();
  const workspaceId = wsData[0]?.id;

  console.log('Fetching time-items...');
  const itemsRes = await fetch('http://localhost:3007/api/v1/time-items?start=2026-03-01T00:00:00Z&end=2026-03-31T23:59:59Z', {
    headers: {
      'Authorization': 'Bearer ' + token,
      'x-tenant-id': workspaceId
    }
  });
  console.log('Status:', itemsRes.status);
  console.log('Response:', await itemsRes.text());
}
main().catch(console.error);
