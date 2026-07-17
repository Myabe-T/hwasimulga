const fs = require('fs');
const path = 'app/api/hwasi/views/route.js';
let content = fs.readFileSync(path, 'utf8');

// Replace the problematic functions
content = content.replace(
  /async function getWatchLimit\(\) \{[\s\S]*?return 5; \}\n\}/m,
  "async function getWatchLimit() {\n  try {\n    const v = await redis.get('hwasi:watch_limit');\n    return v ? Number(v) : 5;\n  } catch { return 5; }\n}"
);

content = content.replace(
  /async function getWatchLimitMsg\(\) \{[\s\S]*?return null; \}\n\}/m,
  "async function getWatchLimitMsg() {\n  try {\n    const v = await redis.get('hwasi:watch_limit_msg');\n    return v || null;\n  } catch { return null; }\n}"
);

// Add import for redis
if (!content.includes("import { getPremium, getViewCount, incrementViewCount, redis }")) {
  content = content.replace(
    "import { getPremium, getViewCount, incrementViewCount } from '@/lib/redis';",
    "import { getPremium, getViewCount, incrementViewCount, redis } from '@/lib/redis';"
  );
}

fs.writeFileSync(path, content);
console.log('Fixed slow Redis SDK imports in views API');
