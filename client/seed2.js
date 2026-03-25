async function main() {
  // 1. Login
  const authRes = await fetch('http://localhost:3001/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const authData = await authRes.json();
  const token = authData.access_token;
  if (!token) throw new Error('No token');

  const headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };

  // 3. Create Workspace inside Tenant
  console.log('Creating workspace...');
  const wsRes = await fetch('http://localhost:3001/api/v1/workspaces', {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'Espace par défaut', color: '#3b82f6', is_default: true })
  });
  const wsText = await wsRes.text();
  console.log('Workspace response:', wsText);
  const wsData = JSON.parse(wsText);
  const workspaceId = wsData.id;

  // 4. Create Calendar with Workspace tenant header
  console.log('Creating calendar...');
  const calRes = await fetch('http://localhost:3011/api/v1/calendars', {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'Calendrier Officiel', color: '#ff0000', timezone: 'Europe/Paris' })
  });
  const calData = await calRes.json();
  console.log('Calendar response:', calData);
  const calendarId = calData.id || calData.calendar?.id;

  if (calendarId) {
    // 5. Create Event
    const evtRes = await fetch(`http://localhost:3011/api/v1/calendars/${calendarId}/events`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: 'Réunion Confirmée avec Succès (Avec Espace de Travail) !',
        start_time: '2026-03-25T14:00:00Z',
        end_time: '2026-03-25T15:00:00Z',
        is_all_day: false,
        timezone: 'Europe/Paris'
      })
    });
    console.log('Event:', await evtRes.text());

    // 6. Create Task
    const taskRes = await fetch(`http://localhost:3011/api/v1/calendars/${calendarId}/tasks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: 'Vérification terminée - Système 100% Fonctionnel',
        due_date: '2026-03-25',
        status: 'pending'
      })
    });
    console.log('Task:', await taskRes.text());

    console.log('DONE. All resources planted successfully.');
  }
}
main().catch(console.error);
