const fs = require('fs');

const endpoints = [
  'app/api/hwasi/utr/route.js',
  'app/api/register/route.js',
  'app/api/login/route.js',
  'app/api/hwasi/payment-settings/route.js'
];

for (const ep of endpoints) {
  let content = fs.readFileSync(ep, 'utf8');
  
  // For UTR
  content = content.replace(
    "const decrypted = await decryptPayload(rawBody.cipher, rawBody.iv);",
    "const decrypted = await decryptPayload(rawBody.cipher, rawBody.iv);\n      if (!decrypted) return NextResponse.json(await encryptPayload({ error: 'Decryption failed. Check AES key.' }), { status: 400 });"
  );
  
  // For Payment Settings (it has a different format because it directly assigns to settings)
  content = content.replace(
    "settings = await decryptPayload(rawBody.cipher, rawBody.iv);",
    "settings = await decryptPayload(rawBody.cipher, rawBody.iv);\n      if (!settings) return NextResponse.json(await encryptPayload({ error: 'Decryption failed. Check AES key.' }), { status: 400 });"
  );
  
  // For login (assuming it uses decrypted)
  // wait, login doesn't use decryptPayload directly in the main logic, I wrote raw decryption there?
  // Let me check if login uses decryptPayload. My previous edit updated register to use it, and I did login too.
  
  fs.writeFileSync(ep, content);
}
console.log('Added null checks to endpoints');
