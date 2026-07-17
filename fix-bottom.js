const fs = require('fs');
let g = fs.readFileSync('app/gallery/page.js', 'utf8');

// Find the last clean occurrence of GradientPlaceholder and everything after
// Cut everything from the first GradientPlaceholder comment and rebuild cleanly
const cutPoint = g.indexOf('/* ── Gradient placeholder ── */');
if (cutPoint === -1) { console.error('Could not find cut point'); process.exit(1); }

// Everything before GradientPlaceholder
const before = g.substring(0, cutPoint);

// Clean ending
const cleanEnding = `/* ── Gradient placeholder ── */
function GradientPlaceholder({ seed }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: GRADIENT_PLACEHOLDER(seed), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Logo size={26} />
    </div>
  );
}

/* ── Pagination ── */
function Pagination({ page, total, onPage }) {
  const start = Math.max(0, Math.min(page - 2, total - 5));
  const pages = Array.from({ length: Math.min(5, total) }, (_, i) => start + i);
  return (
    <div className={styles.pagination}>
      <button className={styles.pgBtn} onClick={() => onPage(0)} disabled={page === 0}>«</button>
      <button className={styles.pgBtn} onClick={() => onPage(page - 1)} disabled={page === 0}>‹</button>
      {pages.map(p => (
        <button key={p} onClick={() => onPage(p)}
          className={\`\${styles.pgBtn} \${p === page ? styles.pgActive : ''}\`}>{p + 1}</button>
      ))}
      <button className={styles.pgBtn} onClick={() => onPage(page + 1)} disabled={page === total - 1}>›</button>
      <button className={styles.pgBtn} onClick={() => onPage(total - 1)} disabled={page === total - 1}>»</button>
    </div>
  );
}
`;

const final = before + cleanEnding;
fs.writeFileSync('app/gallery/page.js', final);
console.log('Fixed! Lines:', final.split('\n').length);
console.log('Has numbered pagination:', final.includes('pages.map(p =>'));
console.log('GradientPlaceholder count:', (final.match(/function GradientPlaceholder/g) || []).length);
console.log('Pagination count:', (final.match(/function Pagination/g) || []).length);
