'use client';
import { useState, useEffect, useCallback } from 'react';
import styles from './gallery.module.css';

const PER_PAGE = 24;
const thumbSrc    = (id) => `/api/hwasi/thumbnail/${id}`;

// Creative video names — deterministic from ID so same video = same title always
const WORDS_A = ['Midnight','Golden','Silver','Crystal','Storm','Crimson','Azure','Ember','Neon','Velvet','Cosmic','Mystic','Shadow','Solar','Lunar','Twilight','Prism','Thunder','Winter','Summer'];
const WORDS_B = ['Bloom','Wave','Echo','Peak','Drift','Flare','Rush','Glow','Pulse','Trail','Dream','Spark','Surge','Rise','Flow','Blaze','Haze','Fade','Clash','Drift'];
function videoTitle(id) {
  const n = Number(id);
  return `${WORDS_A[n % WORDS_A.length]} ${WORDS_B[Math.floor(n / WORDS_A.length) % WORDS_B.length]}`;
}

// Browser fingerprint — screen + timezone + UA hash for free tier anti-bypass
function getFingerprint() {
  try {
    const raw = [
      screen.width, screen.height, screen.colorDepth,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      navigator.language,
      navigator.hardwareConcurrency || '',
    ].join('|');
    let hash = 0;
    for (let i = 0; i < raw.length; i++) { hash = ((hash << 5) - hash) + raw.charCodeAt(i); hash |= 0; }
    return 'fp_' + Math.abs(hash).toString(36);
  } catch { return 'fp_unknown'; }
}

export default function GalleryPage() {
  const [user, setUser]           = useState(null);
  const [settings, setSettings]   = useState({ start: 1, end: 730 });
  const [curated, setCurated]     = useState({ trending: [], latest: [] });
  const [myHistory, setMyHistory] = useState([]);
  const [allIds, setAllIds]       = useState([]);
  const [thumbIds, setThumbIds]   = useState(new Set());
  const [page, setPage]           = useState(0);
  const [modal, setModal]         = useState(null);
  const [view, setView]           = useState('home');
  const [viewStatus, setViewStatus] = useState(null);   // { allowed, isPremium, remaining, hoursLeft }
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgradeInfo, setUpgradeInfo] = useState(null); // { hoursLeft, remaining }

  useEffect(() => {
    async function init() {
      const r = await fetch('/api/verify');
      const d = await r.json();
      if (!d.auth) { window.location.href = '/login'; return; }
      setUser(d);
      const [s, c, h, t, vs] = await Promise.all([
        fetch('/api/hwasi/settings').then(x => x.json()),
        fetch('/api/hwasi/curated').then(x => x.json()),
        fetch('/api/hwasi/history/me').then(x => x.json()),
        fetch('/api/hwasi/thumbnails').then(x => x.json()),
        fetch('/api/hwasi/views').then(x => x.json()).catch(() => ({ allowed: true })),
      ]);
      const st = s.error ? { start:1, end:730 } : s;
      setSettings(st);
      setCurated(c.error ? { trending:[], latest:[] } : c);
      setMyHistory(Array.isArray(h) ? h : []);
      setThumbIds(new Set((t.ids || []).map(Number)));
      setAllIds(Array.from({ length: Math.max(0, st.end - st.start + 1) }, (_, i) => i + st.start));
      setViewStatus(vs);
    }
    init();
  }, []);

  const totalPages = Math.max(1, Math.ceil(allIds.length / PER_PAGE));
  const pageIds    = allIds.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  // Open modal — always fetch a signed 30-min URL (CDN URL never exposed)
  const openModal = useCallback(async (id) => {
    const idx = allIds.indexOf(id);

    // Check free tier limit before playing (skip for admin/premium)
    if (!viewStatus?.isPremium) {
      const fp = getFingerprint();
      const checkRes = await fetch('/api/hwasi/views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: id, fingerprint: fp }),
      }).catch(() => ({ json: () => ({ allowed: true }) }));
      const check = await checkRes.json();
      setViewStatus(check);
      if (!check.allowed) {
        setUpgradeInfo(check);
        setShowUpgrade(true);
        return;
      }
    }

    setModal({ id, index: idx >= 0 ? idx : 0, src: null, loading: true });
    // Record history in background
    fetch('/api/hwasi/history', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId: id }),
    }).catch(() => {});
    // Get signed URL — CDN link stays hidden from browser source/devtools network
    try {
      const sr = await fetch(`/api/hwasi/sign/${id}`);
      const sd = await sr.json();
      if (sd.src) setModal(prev => prev?.id === id ? { ...prev, src: sd.src, loading: false } : prev);
      else setModal(prev => prev?.id === id ? { ...prev, src: '', loading: false } : prev);
    } catch {
      setModal(prev => prev?.id === id ? { ...prev, src: '', loading: false } : prev);
    }
  }, [allIds, viewStatus]);

  const closeModal = useCallback(() => setModal(null), []);
  const prevVideo  = useCallback(() => {
    if (!modal || modal.index <= 0) return;
    openModal(allIds[modal.index - 1]);
  }, [modal, allIds, openModal]);
  const nextVideo  = useCallback(() => {
    if (!modal || modal.index >= allIds.length - 1) return;
    openModal(allIds[modal.index + 1]);
  }, [modal, allIds, openModal]);

  useEffect(() => {
    const h = (e) => {
      if (!modal) return;
      if (e.key === 'Escape') closeModal();
      if (e.key === 'ArrowLeft') prevVideo();
      if (e.key === 'ArrowRight') nextVideo();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [modal, prevVideo, nextVideo, closeModal]);

  function goPage(p) {
    setPage(Math.max(0, Math.min(p, totalPages - 1)));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  async function handleDownload(e, id) {
    e.stopPropagation();
    // Get a fresh signed token then open with ?dl=1 for Content-Disposition download
    try {
      const sr = await fetch(`/api/hwasi/sign/${id}`);
      const sd = await sr.json();
      if (sd.src) {
        const a = document.createElement('a');
        a.href = sd.src + '?dl=1';
        a.download = `hwasimulga-${id}.mp4`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch { /* ignore */ }
  }

  const trendingIds = (curated.trending || []).map(Number).slice(0, 20);
  const latestIds   = (curated.latest   || []).map(Number).slice(0, 20);
  const historyIds  = [...new Set(myHistory.map(h => +h.videoId))].slice(0, 24);
  const thumbCount  = thumbIds.size;

  if (!user) return (
    <div className={styles.splash}>
      <Logo size={44} /><div className={styles.splashSpinner} />
    </div>
  );

  return (
    <div className={styles.page}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brand}>
            <Logo size={20} /><span className={styles.brandName}>Hwasimulga</span>
          </div>
          <nav className={styles.nav}>
            {[['home','🏠','Home'],['all','🎬','Videos'],['history','🕐','History']].map(([v,ic,lb]) => (
              <button key={v} onClick={() => { setView(v); if(v==='all') setPage(0); }}
                className={`${styles.navBtn} ${view===v ? styles.navActive : ''}`}>
                <span>{ic}</span><span className={styles.navLbl}>{lb}</span>
              </button>
            ))}
            {user.role === 'admin' && (
              <a href="/admin" className={`${styles.navBtn} ${styles.navAdmin}`}>
                <span>🛡</span><span className={styles.navLbl}>Admin</span>
              </a>
            )}
          </nav>
          <div className={styles.headerRight}>
            {thumbCount > 0 && thumbCount < allIds.length && user.role === 'admin' && (
              <a href="/admin" className={styles.genBanner}>🖼 {thumbCount}/{allIds.length}</a>
            )}
            {/* Free-videos counter for non-premium */}
            {viewStatus && !viewStatus.isPremium && user.role !== 'admin' && (
              <div className={styles.freeChip} onClick={() => window.location.href='/premium'}>
                <span>{viewStatus.remaining ?? (5 - (viewStatus.count || 0))}/5 free</span>
              </div>
            )}
            {/* Premium badge */}
            {viewStatus?.isPremium && user.role !== 'admin' && (
              <div className={styles.premiumBadge}>✨ Premium</div>
            )}
            <div className={styles.userChip}>
              <div className={styles.avatar}>{user.username?.slice(0,2).toUpperCase()}</div>
              <span className={styles.userName}>{user.displayName || user.username}</span>
            </div>
            <button className={styles.signOutBtn} onClick={logout}>Sign out</button>
          </div>
        </div>
      </header>

      {/* ── HOME ───────────────────────────────────────────────────────── */}
      {view === 'home' && (
        <main className={styles.homeMain}>
          {trendingIds.length === 0 && latestIds.length === 0 ? (
            <div className={styles.emptyHome}>
              <div className={styles.emptyIcon}>🎬</div>
              <h2>Welcome to Hwasimulga</h2>
              <p>Explore the video collection below.</p>
              <button className={styles.btnPrimary} onClick={() => setView('all')}>Browse Videos</button>
            </div>
          ) : (
            <>
              {trendingIds.length > 0 && (
                <HScroll title="Trending" icon="🔥">
                  {trendingIds.map(id => <MiniCard key={id} id={id} hasThumb={thumbIds.has(id)} onClick={() => openModal(id)} />)}
                </HScroll>
              )}
              {latestIds.length > 0 && (
                <HScroll title="Latest" icon="✨">
                  {latestIds.map(id => <MiniCard key={id} id={id} hasThumb={thumbIds.has(id)} onClick={() => openModal(id)} />)}
                </HScroll>
              )}
            </>
          )}
          {historyIds.length > 0 && (
            <HScroll title="Continue Watching" icon="🕐" onMore={() => setView('history')}>
              {historyIds.slice(0,12).map(id => <MiniCard key={id} id={id} hasThumb={thumbIds.has(id)} onClick={() => openModal(id)} />)}
            </HScroll>
          )}
        </main>
      )}

      {/* ── ALL VIDEOS ─────────────────────────────────────────────────── */}
      {view === 'all' && (
        <main className={styles.gridWrap}>
          <div className={styles.gridHeader}>
            <h2 className={styles.gridTitle}>Videos</h2>
            <span className={styles.pageLabel}>Page {page + 1} / {totalPages}</span>
          </div>
          <div className={styles.grid}>
            {pageIds.map((id, i) => (
              <VideoCard key={id} id={id} index={i} hasThumb={thumbIds.has(id)}
                onPlay={() => openModal(id)} onDownload={(e) => handleDownload(e, id)} />
            ))}
          </div>
          {totalPages > 1 && <Pagination page={page} total={totalPages} onPage={goPage} />}
        </main>
      )}

      {/* ── HISTORY ────────────────────────────────────────────────────── */}
      {view === 'history' && (
        <main className={styles.gridWrap}>
          <div className={styles.gridHeader}><h2 className={styles.gridTitle}>Watch History</h2></div>
          {historyIds.length === 0 ? (
            <div className={styles.emptyHome}>
              <div className={styles.emptyIcon}>🕐</div><h2>Nothing watched yet</h2>
            </div>
          ) : (
            <div className={styles.grid}>
              {historyIds.map((id, i) => (
                <VideoCard key={id} id={id} index={i} hasThumb={thumbIds.has(id)}
                  onPlay={() => openModal(id)} onDownload={(e) => handleDownload(e, id)} />
              ))}
            </div>
          )}
        </main>
      )}

      {/* ── MODAL ──────────────────────────────────────────────────────── */}
      {modal && (
        <div className={styles.modalBg} onClick={e => { if(e.target===e.currentTarget) closeModal(); }}>
          <div className={styles.modalBox}>
            <div className={styles.modalHeader}>
              <div className={styles.modalMeta}>
                <span className={styles.modalBadge}>▶ Now Playing</span>
                <span className={styles.modalCount}>{modal.index + 1} / {allIds.length}</span>
              </div>
              <div className={styles.modalActions}>
                <button className={styles.btnGhost} onClick={(e) => handleDownload(e, modal.id)}>⬇ Download</button>
                <button className={styles.closeBtn} onClick={closeModal}>✕</button>
              </div>
            </div>
            <div className={styles.videoWrap}>
              {modal.loading ? (
                <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',minHeight:'200px'}}>
                  <div className={styles.splashSpinner} />
                </div>
              ) : modal.src ? (
                <video key={modal.src} className={styles.modalVideo}
                  src={modal.src} controls autoPlay playsInline
                  controlsList="nodownload nofullscreen"
                  onContextMenu={e => e.preventDefault()}
                />
              ) : (
                <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'200px',color:'#a78bfa'}}>
                  Failed to load video. Please try again.
                </div>
              )}
            </div>
            <div className={styles.modalNav}>
              <button className={styles.navBtn2} onClick={prevVideo} disabled={modal.index===0}>← Prev</button>
              <div className={styles.navDot} />
              <button className={styles.navBtn2} onClick={nextVideo} disabled={modal.index>=allIds.length-1}>Next →</button>
            </div>
          </div>
        </div>
      )}

      {/* ── UPGRADE MODAL ────────────────────────────────────────────────── */}
      {showUpgrade && (
        <div className={styles.modalBg} onClick={e => { if(e.target===e.currentTarget) setShowUpgrade(false); }}>
          <div className={styles.upgradeBox}>
            <div className={styles.upgradeLock}>🔒</div>
            <h2 className={styles.upgradeTitle}>Daily Limit Reached</h2>
            <p className={styles.upgradeSub}>
              {upgradeInfo?.hoursLeft
                ? `You've watched all 5 free videos today. Come back in ${upgradeInfo.hoursLeft} hour${upgradeInfo.hoursLeft === 1 ? '' : 's'}, or upgrade to watch unlimited.`
                : 'You\'ve used all your free videos for today. Upgrade to Premium for unlimited access.'}
            </p>
            <div className={styles.upgradeCards}>
              {[{id:'basic',icon:'⚡',label:'Basic',price:100,period:'14 Days',color:'#7c3aed'},
                {id:'plus',icon:'🚀',label:'Plus',price:300,period:'2 Months',color:'#0ea5e9',popular:true},
                {id:'pro',icon:'👑',label:'Pro',price:599,period:'3 Years',color:'#f59e0b'}]
                .map(p => (
                <div key={p.id} className={styles.upgradeCard} style={{'--c': p.color}}
                  onClick={() => window.location.href='/premium'}>
                  {p.popular && <div className={styles.upgradeBest}>Best</div>}
                  <div style={{fontSize:24}}>{p.icon}</div>
                  <div className={styles.upgradeCardLabel}>{p.label}</div>
                  <div className={styles.upgradeCardPrice}>₹{p.price}</div>
                  <div className={styles.upgradeCardPeriod}>{p.period}</div>
                </div>
              ))}
            </div>
            <button className={styles.upgradeBtn} onClick={() => window.location.href='/premium'}>
              ✨ Get Premium
            </button>
            <button className={styles.upgradeSkip} onClick={() => setShowUpgrade(false)}>
              Watch later
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Logo ─────────────────────────────────────────────────────────────────── */
function Logo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M14 2L26 8.5V19.5L14 26L2 19.5V8.5L14 2Z" fill="url(#glog)"/>
      <path d="M10 10l8 4-8 4V10z" fill="white" opacity="0.9"/>
      <defs><linearGradient id="glog" x1="2" y1="2" x2="26" y2="26">
        <stop offset="0%" stopColor="#7c3aed"/><stop offset="100%" stopColor="#ec4899"/>
      </linearGradient></defs>
    </svg>
  );
}

/* ── HScroll ──────────────────────────────────────────────────────────────── */
function HScroll({ title, icon, onMore, children }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <span className={styles.sectionIcon}>{icon}</span>
        <h2 className={styles.sectionTitle}>{title}</h2>
        {onMore && <button className={styles.seeMore} onClick={onMore}>See all</button>}
      </div>
      <div className={styles.hscroll}>{children}</div>
    </section>
  );
}

/* ── MiniCard (horizontal scroll) ────────────────────────────────────────── */
function MiniCard({ id, hasThumb, onClick }) {
  const [loaded, setLoaded] = useState(false);
  const [err, setErr]       = useState(false);
  return (
    <div className={styles.miniCard} onClick={onClick}>
      <div className={styles.miniThumb}>
        {hasThumb && !err ? (
          <>
            <img src={thumbSrc(id)} alt="" className={styles.miniImg}
              style={{ opacity: loaded ? 1 : 0, transition: 'opacity .25s' }}
              onLoad={() => setLoaded(true)} onError={() => setErr(true)} />
            {!loaded && <div className={styles.pulse} />}
          </>
        ) : <GradientPlaceholder seed={id} />}
        <div className={styles.miniOverlay}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
        </div>
      </div>
    </div>
  );
}

/* ── VideoCard — auto-responsive (PC grid / Mobile YouTube) ───────────────── */
function VideoCard({ id, index, hasThumb, onPlay, onDownload }) {
  const [loaded, setLoaded] = useState(false);
  const [err, setErr]       = useState(false);
  return (
    <div className={styles.card} style={{ animationDelay: `${Math.min(index,15)*25}ms` }} onClick={onPlay}>
      {/* Thumbnail */}
      <div className={styles.thumb}>
        {hasThumb && !err ? (
          <>
            <img src={thumbSrc(id)} alt="" className={styles.thumbImg}
              style={{ opacity: loaded ? 1 : 0, transition: 'opacity .3s' }}
              onLoad={() => setLoaded(true)} onError={() => setErr(true)} />
            {!loaded && <div className={styles.shimmer} />}
          </>
        ) : <GradientPlaceholder seed={id} />}

        {/* Play overlay — desktop hover + always on mobile */}
        <div className={styles.overlay}>
          <div className={styles.playBtn}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
          </div>
        </div>

        {/* Download — inside thumb, desktop only hover reveal */}
        <button className={styles.dlBtn} onClick={onDownload} aria-label="Download">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </button>
      </div>

      {/* YouTube-style info row — visible on mobile only */}
      <div className={styles.ytRow}>
        <div className={styles.ytAvatar}><Logo size={20} /></div>
        <div className={styles.ytMeta}>
          <p className={styles.ytTitle}>{videoTitle(id)}</p>
          <p className={styles.ytSub}>Hwasimulga</p>
        </div>
        <button className={styles.ytDl} onClick={onDownload} aria-label="Download">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

/* ── Gradient placeholder ─────────────────────────────────────────────────── */
const GRADS = [
  'linear-gradient(135deg,#1a0533,#2d1b69)',
  'linear-gradient(135deg,#0d1b2a,#1b3a4b)',
  'linear-gradient(135deg,#0f0f1a,#2a1040)',
  'linear-gradient(135deg,#1a1a2e,#16213e)',
  'linear-gradient(135deg,#0a0015,#1a0030)',
  'linear-gradient(135deg,#0d0d1a,#1a2040)',
];
function GradientPlaceholder({ seed }) {
  return (
    <div style={{ position:'absolute',inset:0,background:GRADS[seed%GRADS.length],display:'flex',alignItems:'center',justifyContent:'center' }}>
      <svg width="26" height="26" viewBox="0 0 28 28" fill="none" opacity="0.18">
        <path d="M14 2L26 8.5V19.5L14 26L2 19.5V8.5L14 2Z" fill="#7c3aed"/>
        <path d="M10 10l8 4-8 4V10z" fill="white"/>
      </svg>
    </div>
  );
}

/* ── Pagination ───────────────────────────────────────────────────────────── */
function Pagination({ page, total, onPage }) {
  const start = Math.max(0, Math.min(page - 2, total - 5));
  const pages = Array.from({ length: Math.min(5, total) }, (_, i) => start + i);
  return (
    <div className={styles.pagination}>
      <button className={styles.pgBtn} onClick={() => onPage(0)} disabled={page===0}>«</button>
      <button className={styles.pgBtn} onClick={() => onPage(page-1)} disabled={page===0}>‹</button>
      {pages.map(p => (
        <button key={p} onClick={() => onPage(p)}
          className={`${styles.pgBtn} ${p===page ? styles.pgActive : ''}`}>{p+1}</button>
      ))}
      <button className={styles.pgBtn} onClick={() => onPage(page+1)} disabled={page===total-1}>›</button>
      <button className={styles.pgBtn} onClick={() => onPage(total-1)} disabled={page===total-1}>»</button>
    </div>
  );
}
