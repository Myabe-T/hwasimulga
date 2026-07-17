require('dotenv').config({ path: '.env.local' });
const { encryptPayload, decryptPayload } = require('./lib/crypto.js');

async function test() {
  try {
    console.log('Testing encryption...');
    const data = { maintenanceMode: true, upiId: 'test@upi', qrUrl: '' };
    const encrypted = await encryptPayload(data);
    console.log('Encrypted:', encrypted);
    
    const decrypted = await decryptPayload(encrypted.cipher, encrypted.iv);
    console.log('Decrypted:', decrypted);
  } catch(e) {
    console.error('Test Failed:', e);
  }
}

test();
