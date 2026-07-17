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
    const search1 = "fetch('" + t + "'";
    if (content.includes(search1)) {
      content = content.split(search1).join("secureFetch('" + t + "'");
      changed = true;
    }
    const search2 = "fetch('" + t + "?";
    if (content.includes(search2)) {
      content = content.split(search2).join("secureFetch('" + t + "?");
      changed = true;
    }
    const search3 = 'fetch(' + t + '?';
    if (content.includes(search3)) {
      content = content.split(search3).join('secureFetch(' + t + '?');
      changed = true;
    }
  }

  if (changed) {
    if (!content.includes('import { secureFetch }')) {
      content = "import { secureFetch } from '@/lib/crypto';\n" + content;
    }
    fs.writeFileSync(f, content);
    console.log('Updated ' + f);
  }
}
