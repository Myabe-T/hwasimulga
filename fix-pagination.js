const fs = require('fs');
const path = 'app/gallery/page.js';
let content = fs.readFileSync(path, 'utf8');

// Restore Pagination for Guest
const guestEndRegex = /<\/div>\s*<\/main>\s*\{\/\* Guest auth modal \*\/\}/;
if (guestEndRegex.test(content)) {
  content = content.replace(guestEndRegex, 
        </div>
        {/* Pagination */}
        {totalPages > 1 && (
          <div className={styles.pagination}>
            <button className={styles.pgBtn} disabled={page === 0} onClick={() => goPage(page - 1)}>← Prev</button>
            <button className={styles.pgBtn} disabled={page >= totalPages - 1} onClick={() => goPage(page + 1)}>Next →</button>
          </div>
        )}
      </main>

      {/* Guest auth modal */});
}
fs.writeFileSync(path, content);
