const fs = require('fs');

// 1. Re-apply secureFetch to client pages
const pages = [
  { path: 'app/login/page.js', fetchPath: '/api/login' },
  { path: 'app/register/page.js', fetchPath: '/api/register' },
  { path: 'app/admin/page.js', fetchPath: '/api/hwasi/payment-settings' },
  { path: 'app/premium/page.js', fetchPath: '/api/hwasi/utr' }
];

for (const p of pages) {
  let content = fs.readFileSync(p.path, 'utf8');
  if (!content.includes("import { secureFetch }")) {
    content = content.replace(/'use client';/, "'use client';\nimport { secureFetch } from '@/lib/crypto';");
  }
  content = content.replace(etch('', secureFetch('');
  fs.writeFileSync(p.path, content);
  console.log('Applied secureFetch to ' + p.path);
}

// 2. Fix Gallery -> Premium Link
let gallery = fs.readFileSync('app/gallery/page.js', 'utf8');
if (!gallery.includes("import Link from 'next/link'")) {
  gallery = gallery.replace(/'use client';/, "'use client';\nimport Link from 'next/link';");
}
gallery = gallery.replace(/<a href="\/premium"/g, '<Link href="/premium"');
gallery = gallery.replace(/<\/a>\s*\{!hasPremium/g, '</Link>\n            {!hasPremium');
gallery = gallery.replace(/<\/a>\s*\{hasPremium/g, '</Link>\n            {hasPremium');
fs.writeFileSync('app/gallery/page.js', gallery);
console.log('Fixed Gallery Link');

// 3. Fix Premium -> Gallery Link
let premium = fs.readFileSync('app/premium/page.js', 'utf8');
if (!premium.includes("import Link from 'next/link'")) {
  premium = premium.replace(/'use client';/, "'use client';\nimport Link from 'next/link';");
}
premium = premium.replace(/<a href="\/gallery"/g, '<Link href="/gallery"');
premium = premium.replace(/← Gallery\s*<\/a>/g, '← Gallery\n        </Link>');
fs.writeFileSync('app/premium/page.js', premium);
console.log('Fixed Premium Link');

