const fs = require('fs');

// ============================
// FIX 1: gallery/page.js
// ============================
let g = fs.readFileSync('app/gallery/page.js', 'utf8');

// 1a. Default to 'foryou' on login
g = g.replace(
  "const [homeTab, setHomeTab] = useState('trending');",
  "const [homeTab, setHomeTab] = useState('foryou');"
);

// 1b. Change "For You" tab label to show it's the full collection
g = g.replace(
  "  { id: 'foryou', label: 'For You', icon: '👤' },",
  "  { id: 'foryou', label: '🎬 Full Collection', icon: '' },"
);

// 1c. Fix instaviralIds - remove .slice(0, 24) so ALL are stored for checking
g = g.replace(
  "  const instaviralIds = (curated.instaviral || []).map(Number).filter(Boolean).slice(0, 24);",
  "  const instaviralIds = (curated.instaviral || []).map(Number).filter(Boolean);"
);

// 1d. Fix trendingIds - allow all 50, no slice
g = g.replace(
  "  const trendingIds = (curated.trending || []).map(Number).filter(Boolean).slice(0, 24);",
  "  const trendingIds = (curated.trending || []).map(Number).filter(Boolean);"
);

// 1e. Exclude instaviral IDs from For You, Popular, Trending
g = g.replace(
  `  // Generate "For You" and "Popular" from allIds deterministically\r\n  // We use a simple hash sort to pseudo-randomize the feed for For You\r\n  const sortedForYou = [...allIds].sort((a, b) => (a * 7 + b * 3) % 17 - (b * 7 + a * 3) % 17);\r\n  const forYouIds = sortedForYou.slice(page * PER_PAGE, (page + 1) * PER_PAGE);\r\n\r\n  const popularIds = [...allIds].sort((a, b) => viewCount(b).localeCompare(viewCount(a))).slice(0, 24);`,
  `  // Exclude instaviral IDs from all normal tabs — Insta Viral is ALWAYS premium-only
  const safeAllIds = allIds.filter(id => !instaviralIds.includes(Number(id)));
  const sortedForYou = [...safeAllIds];
  const forYouIds = sortedForYou.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const popularIds = [...safeAllIds].sort((a, b) => Number(viewCount(b)) - Number(viewCount(a)));`
);

// 1f. Update totalPages to use safeAllIds for foryou
g = g.replace(
  "  const totalPages = Math.max(1, Math.ceil(allIds.length / PER_PAGE));\r\n  const pageIds = allIds.slice(page * PER_PAGE, (page + 1) * PER_PAGE);",
  "  const totalPages = Math.max(1, Math.ceil(allIds.length / PER_PAGE));\n  const safeTotalPages = Math.max(1, Math.ceil((allIds.length - instaviralIds.length) / PER_PAGE));\n  const pageIds = allIds.slice(page * PER_PAGE, (page + 1) * PER_PAGE);"
);

// 1g. Fix tabIds to use safeAllIds-based totals
g = g.replace(
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
  }`,
  `  function tabIds() {
    if (homeTab === 'instaviral') return curatedLoading ? [] : instaviralIds.slice(curatedPage * PER_PAGE, (curatedPage + 1) * PER_PAGE);
    if (homeTab === 'trending') {
      const base = trendingIds.filter(id => !instaviralIds.includes(id));
      const full = base.length ? base : safeAllIds.slice(0, 50);
      return curatedLoading ? [] : full.slice(curatedPage * PER_PAGE, (curatedPage + 1) * PER_PAGE);
    }
    if (homeTab === 'foryou') return forYouIds;
    if (homeTab === 'popular') {
      const base = popularCuratedIds.filter(id => !instaviralIds.includes(id));
      const full = base.length ? base : popularIds;
      return full.slice(curatedPage * PER_PAGE, (curatedPage + 1) * PER_PAGE);
    }
    if (homeTab === 'recent') return historyIds.filter(id => !instaviralIds.includes(Number(id))).slice(0, 24);
    return [];
  }
  function tabTotal() {
    if (homeTab === 'instaviral') return Math.max(1, Math.ceil(instaviralIds.length / PER_PAGE));
    if (homeTab === 'trending') {
      const base = trendingIds.filter(id => !instaviralIds.includes(id));
      return Math.max(1, Math.ceil((base.length || 50) / PER_PAGE));
    }
    if (homeTab === 'foryou') return safeTotalPages;
    if (homeTab === 'popular') {
      const base = popularCuratedIds.filter(id => !instaviralIds.includes(id));
      return Math.max(1, Math.ceil((base.length || safeAllIds.length) / PER_PAGE));
    }
    return 1;
  }`
);

// 1h. Fix instaviral openModal to show dedicated premium popup (not limit popup)
g = g.replace(
  `    if (isInstaViral && !isPrivileged) {
      setModal(null);
      setUpgradeInfo({ limit: 0, msg: '💎 This is an Insta Viral premium video. Upgrade to Premium to watch it instantly!' });
      setShowUpgrade(true);
      return;
    }`,
  `    if (isInstaViral && !isPrivileged) {
      setModal(null);
      setInstaViralBlock(true);
      return;
    }`
);

// 1i. Add instaViralBlock state variable
g = g.replace(
  "  const [deleteReason, setDeleteReason] = useState('duplicate');",
  "  const [deleteReason, setDeleteReason] = useState('duplicate');\n  const [instaViralBlock, setInstaViralBlock] = useState(false);"
);

// 1j. Add instaviral block modal right before the share confirmation modal section
// Find where upgradePop is rendered and add instaViralBlock modal near it
g = g.replace(
  `      {/* ── UPGRADE MODAL ── */}`,
  `      {/* ── INSTA VIRAL PREMIUM BLOCK ── */}
      {instaViralBlock && (
        <div style={{position:'fixed',inset:0,zIndex:9999,background:'rgba(0,0,0,.85)',backdropFilter:'blur(10px)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}
          onClick={() => setInstaViralBlock(false)}>
          <div style={{maxWidth:420,width:'100%',background:'linear-gradient(135deg,#1a0040,#2d0060)',border:'1px solid rgba(236,72,153,.4)',borderRadius:24,padding:'36px 28px',textAlign:'center'}}
            onClick={e => e.stopPropagation()}>
            <div style={{fontSize:56,marginBottom:12}}>💎</div>
            <h2 style={{fontSize:22,fontWeight:900,marginBottom:8,background:'linear-gradient(90deg,#ec4899,#a855f7)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>
              Insta Viral — Premium Only
            </h2>
            <p style={{color:'rgba(255,255,255,.65)',fontSize:14,marginBottom:6,lineHeight:1.6}}>
              This video is part of the exclusive <strong>Insta Viral</strong> collection.<br/>
              Only Premium members can watch these.
            </p>
            <p style={{color:'rgba(255,255,255,.35)',fontSize:12,marginBottom:28}}>
              Free daily views do <em>not</em> apply here.
            </p>
            <div style={{display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap'}}>
              <a href="/premium" style={{padding:'12px 28px',background:'linear-gradient(135deg,#7c3aed,#ec4899)',borderRadius:12,color:'#fff',fontWeight:800,textDecoration:'none',fontSize:15}}>
                🚀 Unlock Premium
              </a>
              <button onClick={() => setInstaViralBlock(false)}
                style={{padding:'12px 22px',background:'rgba(255,255,255,.07)',border:'1px solid rgba(255,255,255,.12)',borderRadius:12,color:'rgba(255,255,255,.7)',fontWeight:600,cursor:'pointer',fontSize:14}}>
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── UPGRADE MODAL ── */}`
);

// 1k. Fix Pagination to show numbers (verify it was applied)
const hasPgActive = g.includes('pgActive');
if (!hasPgActive) {
  g = g.replace(
    `function Pagination({ page, total, onPage }) {
  return (
    <div className={styles.pagination}>
      <button className={styles.pgBtn} onClick={() => onPage(page - 1)} disabled={page === 0}>← Prev</button>
      <button className={styles.pgBtn} onClick={() => onPage(page + 1)} disabled={page === total - 1}>Next →</button>
    </div>
  );
}`,
    `function Pagination({ page, total, onPage }) {
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
}

fs.writeFileSync('app/gallery/page.js', g);
console.log('gallery/page.js done, size:', fs.statSync('app/gallery/page.js').size);

// ============================
// FIX 2: admin/page.js — rename Latest → Popular in curated
// ============================
let a = fs.readFileSync('app/admin/page.js', 'utf8');

// Change the state
a = a.replace(
  "const [curated,   setCurated]   = useState({ trending: [], latest: [], instaviral: [] });",
  "const [curated,   setCurated]   = useState({ trending: [], popular: [], instaviral: [] });"
);
a = a.replace(
  "const [curInput,    setCurInput]    = useState({ trending:'', latest:'' });",
  "const [curInput,    setCurInput]    = useState({ trending:'', popular:'' });"
);
// Fix the subtitle
a = a.replace(
  "tab==='curated'   ? 'Manage Trending and Latest video sections' :",
  "tab==='curated'   ? 'Manage Trending and Popular video sections' :"
);
// Fix the map that renders cards - change 'latest' key and label
a = a.replace(
  "['trending','latest','instaviral'].map(type=>(",
  "['trending','popular','instaviral'].map(type=>("
);
a = a.replace(
  "{type==='trending'?'🔥':type==='latest'?'✨':'💎'}",
  "{type==='trending'?'🔥':type==='popular'?'✨':'💎'}"
);
a = a.replace(
  "{type==='trending'?'Trending':type==='latest'?'Latest':'Insta Viral (Premium Only)'}",
  "{type==='trending'?'Trending':type==='popular'?'Popular':'Insta Viral (Premium Only)'}"
);
// Any curated.latest references in admin
a = a.replace(/curated\.latest/g, 'curated.popular');
// setCurated for latest
a = a.replace(/setCurated\(c => \(\{\.\.\.c, latest:/g, 'setCurated(c => ({...c, popular:');
a = a.replace(/setCurated\(prev => \(\{\.\.\.prev, latest:/g, 'setCurated(prev => ({...prev, popular:');
// curInput.latest
a = a.replace(/curInput\.latest/g, 'curInput.popular');
// setCurInput for latest
a = a.replace(/setCurInput\(p => \(\{\.\.\.p, latest:/g, 'setCurInput(p => ({...p, popular:');
a = a.replace(/setCurInput\(p=>\(\{\.\.\.p, latest:/g, 'setCurInput(p=>({...p, popular:');

fs.writeFileSync('app/admin/page.js', a);
console.log('admin/page.js done');

// ============================
// FIX 3: curated route — return popular not latest
// ============================
let cu = fs.readFileSync('app/api/hwasi/curated/route.js', 'utf8');
cu = cu.replace(
  "export async function GET() {\n  const session = await getSession();\n  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });\n  return NextResponse.json(await getCurated());\n}",
  `export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const raw = await getCurated();
  // Normalize: support both 'latest' and 'popular' keys
  const normalized = { ...raw, popular: raw.popular || raw.latest || [] };
  return NextResponse.json(normalized);
}`
);
fs.writeFileSync('app/api/hwasi/curated/route.js', cu);
console.log('curated/route.js done');
