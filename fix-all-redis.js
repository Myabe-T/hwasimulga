const fs = require('fs');

function replaceRedis(path) {
  let content = fs.readFileSync(path, 'utf8');
  if (content.includes('@upstash/redis/cloudflare')) {
    // Replace the getRedis function or import
    content = content.replace(
      /async function getRedis\(\) \{[\s\S]*?return new Redis\(\{[\s\S]*?\}\);\n\}/m,
      "import { redis } from '@/lib/redis';\nasync function getRedis() { return redis; }"
    );
    // If there's a direct import (not inside getRedis)
    content = content.replace(
      "const { Redis } = await import('@upstash/redis/cloudflare');",
      "import { redis } from '@/lib/redis';"
    );
    fs.writeFileSync(path, content);
    console.log('Fixed', path);
  }
}

replaceRedis('app/api/hwasi/device-message/route.js');
replaceRedis('app/api/hwasi/payment-settings/route.js');
replaceRedis('app/api/hwasi/restore-video/route.js');
replaceRedis('app/api/hwasi/utr/route.js');
replaceRedis('app/api/hwasi/watch-limit/route.js');
