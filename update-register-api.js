const fs = require('fs');
const path = 'app/api/register/route.js';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes("import { decryptPayload, encryptPayload }")) {
  content = content.replace("import { NextResponse } from 'next/server';", "import { NextResponse } from 'next/server';\nimport { decryptPayload, encryptPayload } from '@/lib/crypto';");
}

// Replace all NextResponse.json(...) to wrap in encryptPayload
content = content.replace(/NextResponse\.json\((.*?)(,\s*\{\s*status:\s*\d+\s*\})\)/g, (match, body, statusOptions) => {
  return NextResponse.json(await encryptPayload());
});

content = content.replace(/const res = NextResponse\.json\((.*?)\);/g, (match, body) => {
  return const payloadData = await encryptPayload();\n    const res = NextResponse.json(payloadData);;
});

fs.writeFileSync(path, content);
console.log('Register API updated');
