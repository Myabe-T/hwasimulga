const fs = require('fs');

let gallery = fs.readFileSync('app/gallery/page.js', 'utf8');
gallery = gallery.replace(/<a href="\/premium"/g, '<Link href="/premium"');
// Note: we have to be careful with closing tags. The premium button is inside a conditional:
// {!hasPremium && ( <Link ...> ... </a> )} -> The </a> is on a line by itself usually.
// Let's just find and replace the closing </a> for those specific blocks.
gallery = gallery.replace(/Unlock VIP Access<\/a>/g, 'Unlock VIP Access</Link>');
gallery = gallery.replace(/Manage Premium<\/a>/g, 'Manage Premium</Link>');
fs.writeFileSync('app/gallery/page.js', gallery);

let premium = fs.readFileSync('app/premium/page.js', 'utf8');
if (!premium.includes("import Link from 'next/link'")) {
  premium = premium.replace(/'use client';/, "'use client';\nimport Link from 'next/link';");
}
premium = premium.replace(/<a href="\/gallery"/g, '<Link href="/gallery"');
premium = premium.replace(/← Gallery\s*<\/a>/g, '← Gallery\n        </Link>');
fs.writeFileSync('app/premium/page.js', premium);

console.log('Links updated');
