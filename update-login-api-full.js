const fs = require('fs');
const loginPath = 'app/api/login/route.js';
let content = fs.readFileSync(loginPath, 'utf8');

content = content.replace(/return NextResponse\.json\(\{[\s\S]*?error: '⏳ Your account is pending admin approval[^}]*?\}, \{ status: 403 \}\);/g, 
  "return NextResponse.json(await encryptPayload({ error: '⏳ Your account is pending admin approval. Please wait — you will be notified once approved.', code: 'PENDING_APPROVAL' }), { status: 403 });");

content = content.replace(/return NextResponse\.json\(\{[\s\S]*?error: 🚫 Your account has been blocked[^}]*?\}, \{ status: 403 \}\);/g, 
  "return NextResponse.json(await encryptPayload({ error: \🚫 Your account has been blocked.\\n\\nReason: \\\n\\nContact support to resolve this issue.\, code: 'ACCOUNT_BLOCKED', reason }), { status: 403 });");

content = content.replace(/return NextResponse\.json\(\{ error: e\.message \|\| 'Server error' \}, \{ status: 500 \}\);/g, 
  "return NextResponse.json(await encryptPayload({ error: e.message || 'Server error' }), { status: 500 });");

fs.writeFileSync(loginPath, content);
console.log('Login API fully updated');
