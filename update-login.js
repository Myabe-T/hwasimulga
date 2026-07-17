const fs = require('fs');

const loginPath = 'app/login/page.js';
let content = fs.readFileSync(loginPath, 'utf8');

// 1. Add Next.js Link replacement (re-doing what got lost)
if (!content.includes("import Link from 'next/link'")) {
  content = "import Link from 'next/link';\n" + content;
}
content = content.replace(/<a(\s+[^>]+)>/g, "<Link>");
content = content.replace(/<\/a>/g, "</Link>");

// 2. Add secureFetch import
if (!content.includes("import { secureFetch }")) {
  content = content.replace("import styles from './login.module.css';", "import styles from './login.module.css';\nimport { secureFetch } from '@/lib/crypto';");
}

// 3. Replace fetch with secureFetch for the POST
content = content.replace("const res = await fetch('/api/login', {", "const res = await secureFetch('/api/login', {");

fs.writeFileSync(loginPath, content);
console.log('Login page updated');
