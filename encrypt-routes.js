const fs = require('fs');
const files = [
  'app/api/hwasi/users/route.js',
  'app/api/hwasi/premium/route.js'
];
for (const f of files) {
  let content = fs.readFileSync(f, 'utf8');
  if (!content.includes('encryptPayload')) {
    content = content.replace(/import \{ NextResponse \} from 'next\/server';/, "import { NextResponse } from 'next/server';\nimport { encryptPayload } from '@/lib/crypto';");
    content = content.replace(/return NextResponse\.json\((.*?)\);/g, "return NextResponse.json(await encryptPayload());");
    fs.writeFileSync(f, content);
  }
}
