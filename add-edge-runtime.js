const fs = require('fs');
const path = require('path');

const RUNTIME_EXPORT = "export const runtime = 'edge';\n";
const API_DIR = path.join(__dirname, 'app', 'api');

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (entry.name === 'route.js') files.push(full);
  }
  return files;
}

const routeFiles = walk(API_DIR);
let count = 0;

for (const file of routeFiles) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/^export const runtime = 'edge';\n?/gm, '').trim();
  const newContent = RUNTIME_EXPORT + '\n' + content + '\n';
  fs.writeFileSync(file, newContent, 'utf8');
  count++;
  console.log('✓ Added Edge Runtime:', path.relative(__dirname, file));
}

console.log(`\nDone! Added to ${count} route files.`);
