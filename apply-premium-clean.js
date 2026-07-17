const fs = require('fs');
let content = fs.readFileSync('app/premium/page.js', 'utf8');

if (!content.includes("import { secureFetch }")) {
  content = content.replace(/'use client';/, "'use client';\nimport Link from 'next/link';\nimport { secureFetch } from '@/lib/crypto';");
}

content = content.replace("fetch('/api/hwasi/utr'", "secureFetch('/api/hwasi/utr'");
content = content.replace(/<a href="\/gallery" style=\{\{display:'inline-block',marginTop:24,color:'rgba\(255,255,255,\.4\)',fontSize:13,textDecoration:'none'\}\}>← Back to Gallery<\/a>/g, "<Link href=\"/gallery\" style={{display:'inline-block',marginTop:24,color:'rgba(255,255,255,.4)',fontSize:13,textDecoration:'none'}}>← Back to Gallery</Link>");

content = content.replace(/<a href="\/gallery" style=\{\{padding:'14px 32px',borderRadius:16,background:'linear-gradient\(135deg,#7c3aed,#ec4899\)',color:'#fff',fontWeight:800,textDecoration:'none',fontSize:15,boxShadow:'0 12px 32px rgba\(236,72,153,\.35\)'\}\}>\s*🎬 Watch Videos Now\s*<\/a>/g, "<Link href=\"/gallery\" style={{padding:'14px 32px',borderRadius:16,background:'linear-gradient(135deg,#7c3aed,#ec4899)',color:'#fff',fontWeight:800,textDecoration:'none',fontSize:15,boxShadow:'0 12px 32px rgba(236,72,153,.35)'}}>\n        🎬 Watch Videos Now\n      </Link>");

content = content.replace(/<a href="\/gallery" style=\{\{display:'flex',alignItems:'center',gap:8,color:'rgba\(255,255,255,\.5\)',textDecoration:'none',fontWeight:600,transition:'all 0\.2s'\}\} onMouseOver=\{e=>e\.currentTarget\.style\.color='#fff'\} onMouseOut=\{e=>e\.currentTarget\.style\.color='rgba\(255,255,255,\.5\)'\}>\s*← Gallery\s*<\/a>/g, "<Link href=\"/gallery\" style={{display:'flex',alignItems:'center',gap:8,color:'rgba(255,255,255,.5)',textDecoration:'none',fontWeight:600,transition:'all 0.2s'}} onMouseOver={e=>e.currentTarget.style.color='#fff'} onMouseOut={e=>e.currentTarget.style.color='rgba(255,255,255,.5)'}>\n          ← Gallery\n        </Link>");

fs.writeFileSync('app/premium/page.js', content);
console.log('Fixed premium page cleanly');
