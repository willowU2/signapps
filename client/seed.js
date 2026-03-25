async function main() {
  const res = await fetch('http://localhost:3001/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const text1 = await res.text();
  console.log('Login:', text1);
  const data = JSON.parse(text1);
  const token = data.access_token;
  if (!token) throw new Error('No token');

  const headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };

  const calRes = await fetch('http://localhost:3011/api/v1/calendars', {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'Mon Calendrier Principal', color: 'blue', timezone: 'Europe/Paris' })
  });
  const text2 = await calRes.text();
  console.log('Calendar response:', text2);
  const calData = JSON.parse(text2);
  const calendarId = calData.id || calData.calendar?.id;

  if (calendarId) {
    const evtRes = await fetch(`http://localhost:3011/api/v1/calendars/${calendarId}/events`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: 'Réunion Importante (Test Agent)',
        start_time: '2026-03-25T14:00:00Z',
        end_time: '2026-03-25T15:00:00Z',
        is_all_day: false,
        timezone: 'Europe/Paris'
      })
    });
    console.log('Event:', await evtRes.text());

    const taskRes = await fetch(`http://localhost:3011/api/v1/calendars/${calendarId}/tasks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: 'Préparer les documents pour la réunion (Tâche Agent)',
        start_time: '2026-03-25T10:00:00Z',
        due_date: '2026-03-25',
        status: 'pending'
      })
    });
    console.log('Task:', await taskRes.text());
  }
}
main().catch(console.error);
