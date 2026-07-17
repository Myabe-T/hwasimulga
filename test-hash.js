require('dotenv').config({ path: '.env.local' });
const { hashPassword } = require('./test-crypto-hash.js') || {}; 
// Actually let's just write the hash function directly to test it
async function hashPass(password) {
  const data = new TextEncoder().encode(password + 'hwasi_salt_2024');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function run() {
  console.log('Hash for "password123":', await hashPass('password123'));
}
run();
