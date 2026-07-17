const fs = require('fs');
let g = fs.readFileSync('app/gallery/page.js', 'utf8');

// === FIX 1: Replace the broken single-button Pagination component ===
const OLD_PAGINATION = `/* ── Pagination ── */\r\nfunction Pagination({ page, total, onPage }) {\r\n  return (\r\n    <div className={styles.pagination}>\r\n      <button className={styles.pgBtn} onClick={() => onPage(total - 1)} disabled={page === total - 1}>»</button>\r\n    </div>\r\n  );\r\n}\r\n`;

const NEW_PAGINATION = `/* ── Pagination ── */\r\nfunction Pagination({ page, total, onPage }) {\r\n  const start = Math.max(0, Math.min(page - 2, total - 5));\r\n  const pages = Array.from({ length: Math.min(5, total) }, (_, i) => start + i);\r\n  return (\r\n    <div className={styles.pagination}>\r\n      <button className={styles.pgBtn} onClick={() => onPage(0)} disabled={page === 0}>«</button>\r\n      <button className={styles.pgBtn} onClick={() => onPage(page - 1)} disabled={page === 0}>‹</button>\r\n      {pages.map(p => (\r\n        <button key={p} onClick={() => onPage(p)}\r\n          className={\`\${styles.pgBtn} \${p === page ? styles.pgActive : ''}\`}>{p + 1}</button>\r\n      ))}\r\n      <button className={styles.pgBtn} onClick={() => onPage(page + 1)} disabled={page === total - 1}>›</button>\r\n      <button className={styles.pgBtn} onClick={() => onPage(total - 1)} disabled={page === total - 1}>»</button>\r\n    </div>\r\n  );\r\n}\r\n`;

if (!g.includes(OLD_PAGINATION)) {
  console.error('Could not find old Pagination! Searching...');
  const idx = g.indexOf('function Pagination');
  console.log('Pagination found at:', idx, 'context:', g.substring(idx, idx+200));
  process.exit(1);
}
g = g.replace(OLD_PAGINATION, NEW_PAGINATION);

// === FIX 2: Replace foryou-only pagination with unified tabTotal() pagination ===
const OLD_PAG_RENDER = `          {/* Pagination for all-videos tab */}\r\n          {homeTab === 'foryou' && totalPages > 1 && (\r\n            <Pagination page={page} total={totalPages} onPage={goPage} />\r\n          )}`;

const NEW_PAG_RENDER = `          {/* Pagination — unified for all tabs */}\r\n          {(() => {\r\n            const t = tabTotal();\r\n            if (t <= 1) return null;\r\n            const isForYou = homeTab === 'foryou';\r\n            const p = isForYou ? page : curatedPage;\r\n            const setter = isForYou\r\n              ? (np) => { setPage(Math.max(0, Math.min(np, t - 1))); window.scrollTo({ top: 0, behavior: 'smooth' }); }\r\n              : (np) => { setCuratedPage(Math.max(0, Math.min(np, t - 1))); window.scrollTo({ top: 0, behavior: 'smooth' }); };\r\n            return <Pagination page={p} total={t} onPage={setter} />;\r\n          })()}`;

if (!g.includes(OLD_PAG_RENDER)) {
  console.error('Could not find old pagination render!');
  // Try to find it
  const idx = g.indexOf('Pagination for all-videos tab');
  console.log('Context:', g.substring(idx - 10, idx + 300));
  process.exit(1);
}
g = g.replace(OLD_PAG_RENDER, NEW_PAG_RENDER);

// === FIX 3: Replace old guest Prev/Next with Pagination component ===
const OLD_GUEST_PAG = `          {/* Pagination */}\r\n          <div className={styles.pagination}>\r\n            <button className={styles.pgBtn} disabled={page === 0} onClick={() => goPage(page - 1)}>← Prev</button>\r\n            <button className={styles.pgBtn} disabled={page >= totalPages - 1} onClick={() => goPage(page + 1)}>Next →</button>\r\n          </div>`;
const NEW_GUEST_PAG = `          {/* Pagination */}\r\n          <Pagination page={page} total={totalPages} onPage={goPage} />`;
if (g.includes(OLD_GUEST_PAG)) {
  g = g.replace(OLD_GUEST_PAG, NEW_GUEST_PAG);
  console.log('Fixed guest pagination too');
}

fs.writeFileSync('app/gallery/page.js', g);
console.log('All done! Size:', fs.statSync('app/gallery/page.js').size);
console.log('Has numbered pagination:', g.includes('pages.map(p =>'));
console.log('Has tabTotal unified:', g.includes('tabTotal()'));
console.log('Has curatedPage in pagination:', g.includes('curatedPage'));
