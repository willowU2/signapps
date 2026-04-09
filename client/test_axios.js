const axios = require('axios');
const client = axios.create({ baseURL: 'http://localhost:3001/api/v1' });
console.log(client.getUri({ url: '/auth/login' }));
console.log(client.getUri({ config: { baseURL: 'http://localhost:3001/api/v1', url: '/auth/login' }}));
console.log(axios.getUri({ baseURL: 'http://localhost:3001/api/v1', url: '/auth/login' }));
console.log(axios.getUri({ baseURL: 'http://localhost:3001', url: '/auth/login' }));
