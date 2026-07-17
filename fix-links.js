const fs = require('fs');
const path = require('path');

const files = [
  'app/gallery/page.js',
  'app/admin/page.js',
  'app/premium/page.js',
  'app/login/page.js',
  'app/register/page.js',
  'app/watch/[id]/page.js',
  'app/landing/page.js'
];

for (const file of files) {
  const full = path.join(process.cwd(), file);
  if (!fs.existsSync(full)) continue;
  let content = fs.readFileSync(full, 'utf8');
  
  if (!content.includes("import Link from 'next/link'")) {
    content = "import Link from 'next/link';\n" + content;
  }

  // Replace <a with <Link
  content = content.replace(/<a(\s+[^>]+)>/g, "<Link>");
  // Replace </a> with </Link>
  content = content.replace(/<\/a>/g, "</Link>");

  fs.writeFileSync(full, content);
  console.log('Updated ' + file);
}
