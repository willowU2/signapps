async function test() {
  try {
    console.log('Logging in...');
    const loginRes = await fetch('http://localhost:3001/api/v1/auth/login', { 
        method: 'POST', 
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ username: 'admin', password: 'admin' }) 
    });
    const loginData = await loginRes.json();
    const token = loginData.access_token;
    console.log('Got token:', token ? token.substring(0, 20) + '...' : 'NONE');
    
    console.log('Fetching notifications...');
    const notifRes = await fetch('http://localhost:8095/api/v1/notifications', {
      headers: { Authorization: 'Bearer ' + token }
    });
    console.log('Status:', notifRes.status);
    const notifData = await notifRes.json();
    console.log('Data:', notifData);
  } catch (err) {
    console.error('Error:', err.message);
  }
}
test();
