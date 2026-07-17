const fs = require('fs');
const loginPath = 'app/api/login/route.js';
let content = fs.readFileSync(loginPath, 'utf8');

// Replace error responses to encrypt them
content = content.replace(/NextResponse\.json\(\{\s*error: 'Invalid credentials. Check your username\/password.'\s*\}, \{ status: 401 \}\);/g, 
  "NextResponse.json(await encryptPayload({ error: 'Invalid credentials. Check your username/password.' }), { status: 401 });");

content = content.replace(/NextResponse\.json\(\{\s*error: 🚫 Your account has been blocked.\\n\\nReason: \\$\{reason\}\\\n\\nContact support to resolve this issue.,\s*code: 'ACCOUNT_BLOCKED',\s*reason,\s*\}, \{ status: 403 \}\);/g, 
  "NextResponse.json(await encryptPayload({ error: 🚫 Your account has been blocked.\\n\\nReason: \\\n\\nContact support to resolve this issue., code: 'ACCOUNT_BLOCKED', reason }), { status: 403 });");

// Replace success response
content = content.replace(/const res = NextResponse\.json\(\{ ok: true, username: user\.username, displayName: user\.displayName, role: user\.role, avatar: user\.avatar \}\);/g,
  "const payloadData = await encryptPayload({ ok: true, username: user.username, displayName: user.displayName, role: user.role, avatar: user.avatar });\n    const res = NextResponse.json(payloadData);");

fs.writeFileSync(loginPath, content);
console.log('Login API updated');
