const fs = require('fs');
const path = 'app/gallery/page.js';
let c = fs.readFileSync(path, 'utf8');

// 1. Change "latest" to "popular" in curated state
c = c.replace(
  "const [curated, setCurated] = useState({ trending: [], latest: [], instaviral: [] });",
  "const [curated, setCurated] = useState({ trending: [], popular: [], instaviral: [] });"
);

// 2. Fix latestIds to use popular
c = c.replace(
  "  const latestIds = (curated.latest || []).map(Number).filter(Boolean).slice(0, 24);",
  "  const popularCuratedIds = (curated.popular || curated.latest || []).map(Number).filter(Boolean);"
);

// 3. Fix tabIds for trending/popular to not slice - allow all, add curated page state
// Remove the instaviral, trending, popular limited slices and make them paginated
c = c.replace(
  "  const trendingIds = (curated.trending || []).map(Number).filter(Boolean).slice(0, 24);\n  const instaviralIds = (curated.instaviral || []).map(Number).filter(Boolean).slice(0, 24);\n",
  "  const trendingIds = (curated.trending || []).map(Number).filter(Boolean);\n  const instaviralIds = (curated.instaviral || []).map(Number).filter(Boolean);\n"
);

// 4. Add curatedPage state for curated sections pagination after existing page state
c = c.replace(
  "  const [page, setPage] = useState(0);",
  "  const [page, setPage] = useState(0);\n  const [curatedPage, setCuratedPage] = useState(0);"
);

// 5. Fix tabIds to support pagination for trending/popular/instaviral
c = c.replace(
  `  function tabIds() {
    if (homeTab === 'instaviral') return curatedLoading ? [] : instaviralIds;
    if (homeTab === 'trending') return curatedLoading ? [] : (trendingIds.length ? trendingIds : allIds.slice(0, 24));
    if (homeTab === 'foryou') return forYouIds;
    if (homeTab === 'popular') return popularIds;
    if (homeTab === 'recent') return historyIds.length ? historyIds : [...allIds].reverse().slice(0, 24);
    return [];
  }`,
  `  function tabIds() {
    if (homeTab === 'instaviral') return curatedLoading ? [] : instaviralIds.slice(curatedPage * PER_PAGE, (curatedPage + 1) * PER_PAGE);
    if (homeTab === 'trending') {
      const base = trendingIds.length ? trendingIds : allIds.slice(0, 50);
      return curatedLoading ? [] : base.slice(curatedPage * PER_PAGE, (curatedPage + 1) * PER_PAGE);
    }
    if (homeTab === 'foryou') return forYouIds;
    if (homeTab === 'popular') {
      const base = popularCuratedIds.length ? popularCuratedIds : [...allIds].sort((a, b) => Number(viewCount(b)) - Number(viewCount(a)));
      return base.slice(curatedPage * PER_PAGE, (curatedPage + 1) * PER_PAGE);
    }
    if (homeTab === 'recent') return historyIds.length ? historyIds : [...allIds].reverse().slice(0, 24);
    return [];
  }
  function tabTotal() {
    if (homeTab === 'instaviral') return Math.max(1, Math.ceil(instaviralIds.length / PER_PAGE));
    if (homeTab === 'trending') return Math.max(1, Math.ceil((trendingIds.length || 50) / PER_PAGE));
    if (homeTab === 'foryou') return totalPages;
    if (homeTab === 'popular') return Math.max(1, Math.ceil((popularCuratedIds.length || allIds.length) / PER_PAGE));
    return 1;
  }`
);

// 6. Reset curatedPage when tab changes
c = c.replace(
  `              <button key={t.id} onClick={() => setHomeTab(t.id)}
                className={\`\${styles.tab} \${homeTab === t.id ? styles.tabActive : ''}\`}>
                <span>{t.icon}</span><span>{t.label}</span>
              </button>`,
  `              <button key={t.id} onClick={() => { setHomeTab(t.id); setCuratedPage(0); setPage(0); }}
                className={\`\${styles.tab} \${homeTab === t.id ? styles.tabActive : ''}\`}>
                <span>{t.icon}</span><span>{t.label}</span>
              </button>`
);

// 7. Replace the single pagination at the bottom of gallery tabs section
// Change foryou-only pagination to work for all tabs
c = c.replace(
  `          {/* Pagination for all-videos tab */}
          {homeTab === 'foryou' && totalPages > 1 && (
            <Pagination page={page} total={totalPages} onPage={goPage} />
          )}`,
  `          {/* Pagination for all tabs */}
          {(() => {
            const t = tabTotal();
            const p = homeTab === 'foryou' ? page : curatedPage;
            const setter = homeTab === 'foryou'
              ? (np) => { setPage(Math.max(0, Math.min(np, totalPages - 1))); window.scrollTo({top:0,behavior:'smooth'}); }
              : (np) => { setCuratedPage(Math.max(0, Math.min(np, t - 1))); window.scrollTo({top:0,behavior:'smooth'}); };
            return t > 1 ? <Pagination page={p} total={t} onPage={setter} /> : null;
          })()}`
);

// 8. Fix Pagination component to show numbered pages (restore for logged-in)
c = c.replace(
  `/* ── Pagination ── */
function Pagination({ page, total, onPage }) {
  return (
    <div className={styles.pagination}>
      <button className={styles.pgBtn} onClick={() => onPage(page - 1)} disabled={page === 0}>← Prev</button>
      <button className={styles.pgBtn} onClick={() => onPage(page + 1)} disabled={page === total - 1}>Next →</button>
    </div>
  );
}`,
  `/* ── Pagination ── */
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
}`
);

// 9. Fix Insta Viral tab label to show "Insta Viral" not "Videos" 
// and change Popular tab icon / label as needed
c = c.replace(
  "  { id: 'instaviral', label: 'Insta Viral Videos', icon: '💎' },",
  "  { id: 'instaviral', label: 'Insta Viral', icon: '💎' },"
);

// 10. Rename "Popular" tab label for the tabIds popular section - rename "latest" to "popular" in curated API response mapping
c = c.replace(
  "if (c && !c.error) setCurated(c);",
  "if (c && !c.error) setCurated({ ...c, popular: c.popular || c.latest || [] });"
);

fs.writeFileSync(path, c);
console.log('Gallery fixes done, file size:', fs.statSync(path).size);
