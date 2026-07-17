const { secureFetch } = require('./lib/crypto.js');

async function run() {
  console.log('Testing UTR POST...');
  try {
     const putRes = await secureFetch('http://localhost:3001/api/hwasi/utr', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ utrId: '123456789', plan: 'basic' })
     });
     console.log('UTR POST Status:', putRes.status);
     const text = await putRes.text();
     console.log('UTR POST Result:', text);
  } catch (e) {
     console.error('Error in secureFetch:', e);
  }
}
run();
