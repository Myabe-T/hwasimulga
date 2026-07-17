const { secureFetch } = require('./lib/crypto.js');

async function run() {
  console.log('Fetching payment settings...');
  const res = await secureFetch('http://localhost:3001/api/hwasi/payment-settings');
  const data = await res.json();
  console.log('GET Result:', data);

  if (data.ok) {
     console.log('Attempting PUT...');
     const putRes = await secureFetch('http://localhost:3001/api/hwasi/payment-settings', {
       method: 'PUT',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ maintenanceMode: true })
     });
     console.log('PUT Status:', putRes.status);
     const putData = await putRes.json();
     console.log('PUT Result:', putData);
  }
}
run();
