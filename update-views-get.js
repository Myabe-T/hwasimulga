const fs = require('fs');
const path = 'app/gallery/page.js';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(
  "fetch('/api/hwasi/views')",
  "secureFetch('/api/hwasi/views')"
);
fs.writeFileSync(path, content);
