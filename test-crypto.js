const crypto = require('crypto');
async function webCryptoHash(password) {
  const data = new TextEncoder().encode(password + 'hwasi_salt_2024');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}
webCryptoHash('Watch@2024').then(console.log);
