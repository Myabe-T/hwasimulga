const fs = require('fs');
const path = 'app/gallery/page.js';
let c = fs.readFileSync(path, 'utf8');
// Fix the broken Pagination component
c = c.replace(
  /\/\* ── Pagination ── \*\/\nfunction Pagination\(\{ page, total, onPage \}\) \{[\s\S]*?\}/,
  `/* ── Pagination ── */
function Pagination({ page, total, onPage }) {
  return (
    <div className={styles.pagination}>
      <button className={styles.pgBtn} onClick={() => onPage(page - 1)} disabled={page === 0}>\u2190 Prev</button>
      <button className={styles.pgBtn} onClick={() => onPage(page + 1)} disabled={page === total - 1}>Next \u2192</button>
    </div>
  );
}`
);
fs.writeFileSync(path, c);
console.log('Done');
