const fs = require('fs');
const files = [
  'app/gallery/page.js',
  'app/admin/page.js',
  'app/watch/WatchClient.js',
  'app/register/page.js',
  'app/login/page.js',
  'app/premium/page.js',
  'app/landing/page.js'
];

const targets = [
  '/api/verify',
  '/api/hwasi/settings',
  '/api/register',
  '/api/login',
  '/api/hwasi/users',
  '/api/hwasi/premium'
];

for (const f of files) {
  if (!fs.existsSync(f)) continue;
  let content = fs.readFileSync(f, 'utf8');
  let changed = false;

  for (const t of targets) {
    // Replace fetch('/api/...') and fetch(\/api/...)
    // We use a regex to catch fetch(target...
    const regex = new RegExp(\etch\\\\(['"\]\ + t + \['"\\\\\]\, 'g');
    if (regex.test(content)) {
      content = content.replace(regex, \secureFetch('\'\);
      changed = true;
    }
    
    const regex2 = new RegExp(\etch\\\\(['"\]\ + t + \\\\\?\, 'g');
    if (regex2.test(content)) {
      content = content.replace(regex2, \secureFetch('\?\);
      changed = true;
    }
  }

  if (changed) {
    if (!content.includes('import { secureFetch }')) {
      content = "import { secureFetch } from '@/lib/crypto';\n" + content;
    }
    fs.writeFileSync(f, content);
    console.log('Updated', f);
  }
}
