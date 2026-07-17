'use client';
import { secureFetch } from '@/lib/crypto';
import Link from 'next/link';
import { useState, useEffect, useCallback, useRef } from 'react';
import styles from './gallery.module.css';

const PER_PAGE = 24;
const thumbSrc = (id) => `/api/hwasi/thumbnail/${id}`;

// Deterministic video title from ID
const WORDS_A = ['Midnight', 'Golden', 'Silver', 'Crystal', 'Storm', 'Crimson', 'Azure', 'Ember', 'Neon', 'Velvet', 'Cosmic', 'Mystic', 'Shadow', 'Solar', 'Lunar', 'Twilight', 'Prism', 'Thunder', 'Winter', 'Summer'];
const WORDS_B = ['Bloom', 'Wave', 'Echo', 'Peak', 'Drift', 'Flare', 'Rush', 'Glow', 'Pulse', 'Trail', 'Dream', 'Spark', 'Surge', 'Rise', 'Flow', 'Blaze', 'Haze', 'Fade', 'Clash', 'Drift'];
function videoTitle(id) {
  const n = Number(id);
  return `${WORDS_A[n % WORDS_A.length]} ${WORDS_B[Math.floor(n / WORDS_A.length) % WORDS_B.length]}`;
}

// Deterministic quality badge from ID
function videoQuality(id) { const n = Number(id); return n % 3 === 0 ? '1440P' : n % 2 === 0 ? '1080P' : '720P'; }
function qualityColor(q) { return q === '1440P' ? '#06b6d4' : q === '1080P' ? '#3b82f6' : '#10b981'; }

// Deterministic view count from ID
function viewCount(id) {
  const n = Number(id);
  const base = ((n * 1103515245 + 12345) & 0x7fffffff) % 50000;
  if (base > 10000) return (base / 1000).toFixed(1) + 'k';
  return String(base);
}

// Browser fingerprint for free tier
function getFingerprint() {
  try {
    const raw = [screen.width, screen.height, screen.colorDepth, Intl.DateTimeFormat().resolvedOptions().timeZone, navigator.language, navigator.hardwareConcurrency || ''].join('|');
    let hash = 0;
    for (let i = 0; i < raw.length; i++) { hash = ((hash << 5) - hash) + raw.charCodeAt(i); hash |= 0; }
    return 'fp_' + Math.abs(hash).toString(36);
  } catch { return 'fp_unknown'; }
}

const REPORT_REASONS = ['inappropriate', 'duplicate', 'broken', 'spam', 'other'];
const GRADIENT_PLACEHOLDER = (id) => {
  const grads = ['linear-gradient(135deg,#1a0533,#2d1b69)', 'linear-gradient(135deg,#0d1b2a,#1b3a4b)', 'linear-gradient(135deg,#0f0f1a,#2a1040)', 'linear-gradient(135deg,#1a1a2e,#16213e)', 'linear-gradient(135deg,#0a0015,#1a0030)', 'linear-gradient(135deg,#0d0d1a,#1a2040)'];
  return grads[Number(id) % grads.length];
};

// ── TABS definition
const HOME_TABS = [
  { id: 'instaviral', label: 'Insta Viral Videos', icon: '💎' },
  { id: 'trending', label: 'Trending', icon: '🔥' },
  { id: 'foryou', label: 'For You', icon: '👤' },
  { id: 'popular', label: 'Popular', icon: '📈' },
  { id: 'recent', label: 'Recent', icon: '🕐' },
];

export default function GalleryPage() {
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState({ start: 1, end: 730 });
  const [curated, setCurated] = useState({ trending: [], latest: [], instaviral: [] });
  const [curatedLoading, setCuratedLoading] = useState(true);
  const [myHistory, setMyHistory] = useState([]);
  const [allIds, setAllIds] = useState([]);
  const [thumbIds, setThumbIds] = useState(new Set());
  const [page, setPage] = useState(0);
  const [modal, setModal] = useState(null);
  const [view, setView] = useState('gallery'); // gallery | bookmarks | history
  const [homeTab, setHomeTab] = useState('trending');
  const [viewStatus, setViewStatus] = useState(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgradeInfo, setUpgradeInfo] = useState(null);
  const [bookmarks, setBookmarks] = useState(new Set());
  const [reportModal, setReportModal] = useState(null); // videoId
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [premiumInfo, setPremiumInfo] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null); // { id }
  const [deleteReason, setDeleteReason] = useState('duplicate');
  const [changePwdModal, setChangePwdModal] = useState(false);
  const [pwdForm, setPwdForm] = useState({ old: '', new: '', confirm: '' });
  const [pwdMsg, setPwdMsg] = useState('');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [guestAuthModal, setGuestAuthModal] = useState(false);
  const [videoTitles, setVideoTitles] = useState({});
  const [editTitleModal, setEditTitleModal] = useState(null); // { id }
  const [editTitleInput, setEditTitleInput] = useState('');
  const [editTitleSaving, setEditTitleSaving] = useState(false);
  const [plans, setPlans] = useState(null);
  const [shareCopied, setShareCopied] = useState(null); // videoId that was copied
  const [downloadUpgradeModal, setDownloadUpgradeModal] = useState(false);
  const [bookmarkLimitModal, setBookmarkLimitModal] = useState(false);
  const [premiumWelcomePopup, setPremiumWelcomePopup] = useState(false);
  const [adminMessage, setAdminMessage] = useState(null); // { message, from, timestamp }
  const FREE_BOOKMARK_LIMIT = 8;

  // Global epoch-based countdown (same for everyone)
  const EPOCH_START = 1704067200;
  const PERIOD_SECS = 34 * 3600;
  const calcSecs = () => { const n = Math.floor(Date.now() / 1000); const e = (n - EPOCH_START) % PERIOD_SECS; return PERIOD_SECS - e; };
  const [globalSecs, setGlobalSecs] = useState(calcSecs);
  useEffect(() => { const id = setInterval(() => setGlobalSecs(calcSecs()), 1000); return () => clearInterval(id); }, []);
  const gH = Math.floor(globalSecs / 3600), gM = Math.floor((globalSecs % 3600) / 60), gS = globalSecs % 60;
  const globalTimer = `${String(gH).padStart(2, '0')}:${String(gM).padStart(2, '0')}:${String(gS).padStart(2, '0')}`;

  useEffect(() => {
    async function init() {
      const r = await secureFetch('/api/verify');
      const d = await r.json();

      // ── PHASE 1: load settings + thumbnails immediately so video grid shows ──
      const [s, t] = await Promise.all([
        secureFetch('/api/hwasi/settings').then(x => x.json()).catch(() => ({ start:1, end:730 })),
        fetch('/api/hwasi/thumbnails').then(x => x.json()).catch(() => ({})),
      ]);
      const st = s.error ? { start:1, end:730, deletedIds:[] } : s;
      const delSet = new Set(st.deletedIds || []);
      setSettings(st);
      setThumbIds(new Set((t.ids || []).map(Number)));
      setAllIds(Array.from({ length: Math.max(0, st.end - st.start + 1) }, (_, i) => i + st.start).filter(id => !delSet.has(id)));
      // Always load titles (for guests too)
      fetch('/api/hwasi/titles').then(x=>x.json()).then(d=>setVideoTitles(d.titles||{})).catch(()=>{});

      // Guest mode stops here — no auth-gated data
      if (!d.auth) return;

      setUser(d);

      // ── PHASE 2: load auth-gated data in background (don't block grid) ──
      fetch('/api/hwasi/plans').then(x=>x.json()).then(d=>setPlans(d.plans||null)).catch(()=>{});

      Promise.all([
        fetch('/api/hwasi/curated').then(x=>x.json()).catch(()=>({ trending:[], latest:[] })),
        fetch('/api/hwasi/history/me').then(x=>x.json()).catch(()=>[]),
        secureFetch('/api/hwasi/views').then(x=>x.json()).catch(()=>({ allowed:true })),
        fetch('/api/hwasi/bookmarks').then(x=>x.json()).catch(()=>({ ids:[] })),
      ]).then(([c, h, vs, bm]) => {
        setCurated(c.error ? { trending:[], latest:[] } : c);
        setCuratedLoading(false);
        setMyHistory(Array.isArray(h) ? h : []);
        setViewStatus(vs);
        setBookmarks(new Set((bm.ids || []).map(Number)));
        // Premium welcome popup — show ONCE per account lifetime (localStorage, not sessionStorage)
        if (vs?.isPremium) {
          const KEY = `dh_premwelcome_${d.sub}`;
          if (!localStorage.getItem(KEY)) {
            localStorage.setItem(KEY, '1');
            setPremiumWelcomePopup(true);
          }
        }
        // Admin warning message
        fetch('/api/hwasi/device-message').then(r=>r.json()).then(m=>{ if(m.message) setAdminMessage(m.message); }).catch(()=>{});
      });
    }
    init();
  }, []);

  // ── Heartbeat + 15-min idle auto-logout ──────────────────────────────────────
  useEffect(() => {
    if (!user) return; // guests don't need heartbeat
    const IDLE_LIMIT = 15 * 60 * 1000; // 15 min
    const HEARTBEAT = 2 * 60 * 1000; //  2 min
    let lastActivity = Date.now();

    const resetIdle = () => { lastActivity = Date.now(); };
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(e => window.addEventListener(e, resetIdle, { passive: true }));

    async function beat() {
      const idle = Date.now() - lastActivity;
      if (idle >= IDLE_LIMIT) {
        // Auto-logout for idle
        await fetch('/api/logout', { method: 'POST' });
        window.location.href = '/login';
        return;
      }
      // ── Hardware-level fingerprint (same across all browsers on same device) ──
      // Uses: WebGL GPU renderer + screen size + platform + CPU cores + device memory
      // These DON'T change between Chrome / Brave / Firefox / Opera on same device
      let fingerprint = 'unknown';
      let deviceLabel = 'Unknown Device';
      try {
        // 1. WebGL GPU (most unique — Adreno 740 = Pixel 8, Apple GPU = iPhone, etc.)
        let gpu = '';
        try {
          const gl = document.createElement('canvas').getContext('webgl') || document.createElement('canvas').getContext('experimental-webgl');
          if (gl) {
            const ext = gl.getExtension('WEBGL_debug_renderer_info');
            if (ext) gpu = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '';
          }
        } catch { }

        // 2. Platform (iPhone / Linux armv8l / Win32 / MacIntel)
        const platform = navigator.platform || navigator.userAgentData?.platform || '';

        // 3. Screen hardware (device-specific, not browser-specific)
        const sw = window.screen.width;
        const sh = window.screen.height;
        const dpr = Math.round((window.devicePixelRatio || 1) * 100); // e.g. 300 = DPR 3.0

        // 4. Hardware specs
        const cores = navigator.hardwareConcurrency || 0;
        const mem = navigator.deviceMemory || 0;

        // Combine into a stable hardware ID
        const raw = `${platform}|${sw}x${sh}|dpr${dpr}|gpu:${gpu}|cores${cores}|mem${mem}`;
        // Simple 32-char hash (djb2)
        let hash = 5381;
        for (let i = 0; i < raw.length; i++) hash = ((hash << 5) + hash) ^ raw.charCodeAt(i);
        fingerprint = Math.abs(hash).toString(36).padStart(8, '0') + `-${sw}x${sh}-${platform.slice(0, 8)}`;

        // Human-readable device label for admin panel
        const ua = navigator.userAgent;
        if (/iPhone/.test(ua)) {
          const v = ua.match(/iPhone OS (\d+_\d+)/); deviceLabel = `iPhone (iOS ${v ? v[1].replace('_', '.') : '?'})`;
        } else if (/iPad/.test(ua)) {
          deviceLabel = 'iPad';
        } else if (/Android/.test(ua)) {
          const brand = gpu.split(' ')[0] || 'Android'; deviceLabel = `${brand} Android`;
        } else if (/Win/.test(platform)) {
          deviceLabel = `Windows PC`;
        } else if (/Mac/.test(platform)) {
          deviceLabel = `Mac`;
        } else if (/Linux/.test(platform)) {
          deviceLabel = `Linux`;
        }
      } catch { fingerprint = navigator.userAgent.slice(0, 32); }

      // Active — ping server
      const hbRes = await fetch('/api/hwasi/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email || null, fingerprint, deviceLabel }),
      }).catch(() => null);

      // If server says we're blocked, force logout
      if (hbRes?.status === 403) {
        await fetch('/api/logout', { method: 'POST' });
        window.location.href = '/login?blocked=1';
        return;
      }
    }

    beat(); // immediate first beat
    const timer = setInterval(beat, HEARTBEAT);

    return () => {
      clearInterval(timer);
      events.forEach(e => window.removeEventListener(e, resetIdle));
    };
  }, [user]);

  const totalPages = Math.max(1, Math.ceil(allIds.length / PER_PAGE));
  const pageIds = allIds.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  const trendingIds = (curated.trending || []).map(Number).filter(Boolean).slice(0, 24);
  const instaviralIds = (curated.instaviral || []).map(Number).filter(Boolean).slice(0, 24);
  const latestIds = (curated.latest || []).map(Number).filter(Boolean).slice(0, 24);
  const historyIds = [...new Set(myHistory.map(h => +h.videoId))].slice(0, 48);
  const bookmarkIds = [...bookmarks].slice(0, 48);

  // Generate "For You" and "Popular" from allIds deterministically
  // We use a simple hash sort to pseudo-randomize the feed for For You
  const sortedForYou = [...allIds].sort((a, b) => (a * 7 + b * 3) % 17 - (b * 7 + a * 3) % 17);
  const forYouIds = sortedForYou.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  const popularIds = [...allIds].sort((a, b) => viewCount(b).localeCompare(viewCount(a))).slice(0, 24);

  function tabIds() {
    if (homeTab === 'instaviral') return curatedLoading ? [] : instaviralIds;
    if (homeTab === 'trending') return curatedLoading ? [] : (trendingIds.length ? trendingIds : allIds.slice(0, 24));
    if (homeTab === 'foryou') return forYouIds;
    if (homeTab === 'popular') return popularIds;
    if (homeTab === 'recent') return historyIds.length ? historyIds : [...allIds].reverse().slice(0, 24);
    return [];
  }

  const openModal = useCallback(async (id) => {
    const idx = allIds.indexOf(id);

    // Guest (not logged in) → show auth modal with pricing
    if (!user) {
      setGuestAuthModal(true);
      return;
    }

    // Immediately show loading modal so user gets instant feedback
    setModal({ id, index: idx >= 0 ? idx : 0, src: null, loading: true });

    const isInstaViral = instaviralIds.includes(Number(id));
    const isPrivileged = viewStatus?.isPremium || user?.role === 'admin' || user?.role === 'advisor';

    if (isInstaViral && !isPrivileged) {
      setModal(null);
      setUpgradeInfo({ limit: 0, msg: '💎 This is an Insta Viral premium video. Upgrade to Premium to watch it instantly!' });
      setShowUpgrade(true);
      return;
    }

    // Call views to authorize AND get token
    let videoSrc = '';
    try {
      const fp = getFingerprint();
      const checkRes = await secureFetch('/api/hwasi/views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: id, fingerprint: fp }),
      });
      const check = await checkRes.json();
      setViewStatus(check);
      
      if (!check.allowed) {
        setModal(null);
        setUpgradeInfo(check);
        setShowUpgrade(true);
        return;
      }
      
      if (check.token) {
        videoSrc = '/api/v/' + check.token;
      }
    } catch (e) {
      console.error('Error fetching view token', e);
    }

    fetch('/api/hwasi/history', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId: id }),
    }).catch(() => { });
    
    setModal(prev => prev?.id === id ? { ...prev, src: videoSrc, loading: false } : prev);
  }, [allIds, viewStatus, user]);

  const closeModal = useCallback(() => setModal(null), []);
  const prevVideo = useCallback(() => { if (!modal || modal.index <= 0) return; openModal(allIds[modal.index - 1]); }, [modal, allIds, openModal]);
  const nextVideo = useCallback(() => { if (!modal || modal.index >= allIds.length - 1) return; openModal(allIds[modal.index + 1]); }, [modal, allIds, openModal]);

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

  async function saveVideoTitle() {
    if (!editTitleModal) return;
    setEditTitleSaving(true);
    try {
      const r = await fetch('/api/hwasi/titles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editTitleModal.id, title: editTitleInput }),
      });
      const d = await r.json();
      if (d.ok) setVideoTitles(d.titles || {});
      setEditTitleModal(null);
      setEditTitleInput('');
    } catch (e) { /* silent */ }
    setEditTitleSaving(false);
  }

  async function changePassword() {
    setPwdMsg('');
    if (pwdForm.new !== pwdForm.confirm) { setPwdMsg('New passwords do not match'); return; }
    if (pwdForm.new.length < 6) { setPwdMsg('New password must be at least 6 characters'); return; }
    try {
      const r = await fetch('/api/hwasi/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword: pwdForm.old, newPassword: pwdForm.new }),
      });
      const d = await r.json();
      if (!r.ok) { setPwdMsg(d.error || 'Failed'); return; }
      setPwdMsg('✓ Password changed successfully!');
      setPwdForm({ old: '', new: '', confirm: '' });
      setTimeout(() => setChangePwdModal(false), 1500);
    } catch { setPwdMsg('Network error. Try again.'); }
  }

  async function handleDownload(e, id) {
    e && e.stopPropagation();
    // Gate: only premium, admin, advisor can download
    if (!viewStatus?.isPremium && user?.role === 'viewer') {
      setDownloadUpgradeModal(true);
      return;
    }
    try {
      const sr = await fetch(`/api/hwasi/sign/${id}`);
      const sd = await sr.json();
      if (sd.src) {
        const a = document.createElement('a');
        a.href = sd.src + '?dl=1';
        a.download = `DesiHawas-${id}.mp4`;
        a.style.display = 'none';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      }
    } catch { }
  }

  async function toggleBookmark(e, id) {
    e && e.stopPropagation();
    const isBookmarked = bookmarks.has(id);
    // Gate: free users limited to 8 bookmarks
    if (!isBookmarked && !viewStatus?.isPremium && user?.role === 'viewer') {
      if (bookmarks.size >= FREE_BOOKMARK_LIMIT) {
        setBookmarkLimitModal(true);
        return;
      }
    }
    setBookmarks(prev => { const n = new Set(prev); isBookmarked ? n.delete(id) : n.add(id); return n; });
    await fetch('/api/hwasi/bookmarks', {
      method: isBookmarked ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => { });
  }

  async function submitReport(reason) {
    if (!reportModal) return;
    await fetch('/api/hwasi/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId: reportModal, reason }),
    }).catch(() => { });
    setReportModal(null);
    alert('✓ Report submitted. Thank you!');
  }

  async function handleDelete(id) {
    await fetch(`/api/hwasi/video/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: deleteReason }),
    });
    setDeleteModal(null);
    setAllIds(prev => prev.filter(x => x !== id));
    if (modal?.id === id) closeModal();
  }

  const isAdminOrAdvisor = user?.role === 'admin' || user?.role === 'advisor';

  // Show spinner only while loading (allIds empty AND no user yet determined)
  if (allIds.length === 0 && user === null) return (
    <div className={styles.splash}>
      <img src="/logo.png" alt="" style={{ width: 44, height: 44, borderRadius: 10, marginBottom: 8 }} />
      <div className={styles.splashSpinner} />
    </div>
  );

  // GUEST view — not logged in but show gallery
  if (!user) return (
    <div className={styles.page}>
      {/* Guest header */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brand}>
            <img src="/logo.png" alt="" className={styles.brandLogo} />
            <span className={styles.brandName}>DesiHawas</span>
          </div>
          <nav className={styles.desktopNav}>
            <span className={styles.navBtn} style={{ color: 'rgba(255,255,255,.45)', cursor: 'default' }}>🎬 Gallery</span>
          </nav>
          <div className={styles.headerRight}>
            <a href="/login" className={styles.guestLoginBtn}>Login</a>
            <a href="/register" className={styles.guestRegBtn}>Register Free 🚀</a>
          </div>
        </div>
        {/* Sale timer */}
        <div className={styles.guestSaleBanner}>
          🔥 Flash Sale —
          <span style={{ fontFamily: 'Courier New', fontWeight: 900, color: '#f59e0b', margin: '0 6px' }}>{globalTimer}</span>
          left · <s style={{ opacity: .4 }}>₹{plans?.basic?.originalPrice || 200}/₹{plans?.plus?.originalPrice || 500}/₹{plans?.pro?.originalPrice || 999}</s> → <strong style={{ color: '#34d399' }}>₹{plans?.basic?.price || 100}/₹{plans?.plus?.price || 300}/₹{plans?.pro?.price || 599}</strong>
          <a href="/register" style={{ marginLeft: 10, color: '#f59e0b', fontWeight: 700, textDecoration: 'none' }}>Unlock →</a>
        </div>
      </header>

      {/* Guest video grid */}
      <main className={styles.main}>
        <div className={styles.sectionHead}>
          <div className={styles.sectionAccent} />
          <h2 className={styles.sectionTitle}>Browse All Videos</h2>
        </div>
        <div className={styles.grid}>
          {pageIds.map(id => (
            <div key={id} className={styles.card} onClick={() => openModal(id)}>
              <div className={styles.thumb}>
                {thumbIds.has(id) ? (
                  <img src={thumbSrc(id)} alt="" className={styles.thumbImg} loading="lazy" />
                ) : (
                  <div className={styles.thumbPlaceholder} style={{ background: GRADIENT_PLACEHOLDER(id) }} />
                )}
                <div className={styles.cardOverlay}>
                  <button className={styles.playBtn}>▶</button>
                </div>
                {/* Lock icon for guests */}
                <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(6px)', padding: '3px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, color: '#fbbf24' }}>
                  🔒 Login
                </div>
                <div className={styles.qualityBadge} style={{ background: qualityColor(videoQuality(id)), color: '#fff' }}>{videoQuality(id)}</div>
              </div>
              <div className={styles.cardInfo}>
                <div className={styles.cardTitle}>{videoTitles[String(id)] || videoTitle(id)}</div>
                <div className={styles.cardMeta}>
                  <span>👁 {viewCount(id)}</span>
                </div>
              </div>
            </div>
          ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button className={styles.pgBtn} disabled={page === 0} onClick={() => goPage(page - 1)}>← Prev</button>
              <button className={styles.pgBtn} disabled={page >= totalPages - 1} onClick={() => goPage(page + 1)}>Next →</button>
            </div>
          )}
        </main>

      {/* Guest auth modal */}
      {guestAuthModal && (
        <div className={styles.modalBg} onClick={e => { if (e.target === e.currentTarget) setGuestAuthModal(false); }}>
          <div className={styles.smallModal} style={{ textAlign: 'center' }}>
            <img src="/logo.png" alt="" style={{ width: 50, height: 50, borderRadius: 10, marginBottom: 12 }} />
            <h3 style={{ fontWeight: 800, fontSize: 18, marginBottom: 6 }}>🔒 Login to Watch</h3>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', marginBottom: 14, lineHeight: 1.5 }}>
              Create a free account to watch videos.<br />Get premium for unlimited access!
            </p>
            <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.25)', borderRadius: 12, marginBottom: 16, fontSize: 13 }}>
              🔥 Sale ends in <strong style={{ fontFamily: 'Courier New', color: '#f59e0b' }}>{globalTimer}</strong>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              <a href="/login" style={{ padding: '12px', borderRadius: 12, background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.12)', color: '#fff', textDecoration: 'none', fontSize: 14, fontWeight: 700, display: 'block' }}>🔑 Login</a>
              <a href="/register" style={{ padding: '12px', borderRadius: 12, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', textDecoration: 'none', fontSize: 14, fontWeight: 700, display: 'block' }}>🚀 Register</a>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {[
                ['⚡ Basic', `₹${plans?.basic?.price || 100}`, `${plans?.basic?.days || 14}d`],
                ['🚀 Plus', `₹${plans?.plus?.price || 300}`, `${plans?.plus?.days || 60}d`],
                ['👑 Pro', `₹${plans?.pro?.price || 599}`, '3yr'],
              ].map(([label, price, period]) => (
                <div key={label} style={{ padding: '10px 6px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)' }}>{label}</div>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{price}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)' }}>{period}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ── LOGGED IN VIEW ──
  return (
    <div className={styles.page}>

      {/* ── HEADER ── */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          {/* Left: Logo */}
          <div className={styles.brand}>
            <img src="/logo.png" alt="" className={styles.brandLogo} />
            <span className={styles.brandName}>DesiHawas</span>
          </div>

          {/* Center: Nav (desktop only) */}
          <nav className={styles.desktopNav}>
            <button onClick={() => setView('gallery')} className={`${styles.navBtn} ${view === 'gallery' ? styles.navActive : ''}`}>🏠 Home</button>
            <button onClick={() => setView('bookmarks')} className={`${styles.navBtn} ${view === 'bookmarks' ? styles.navActive : ''}`}>🔖 Bookmarks</button>
            {isAdminOrAdvisor && <a href={user?.role === 'advisor' ? '/advisor' : '/admin'} className={styles.navBtn}>🛡 {user?.role === 'advisor' ? 'Advisor' : 'Admin'}</a>}
          </nav>

          {/* Right: chips + user */}
          <div className={styles.headerRight}>
            {viewStatus && !viewStatus.isPremium && user.role === 'viewer' && (
              <div className={styles.freeChip} onClick={() => window.location.href = '/premium'}
                title="Upgrade to Premium for unlimited access">
                🆓 Free Account — Upgrade
              </div>
            )}
            {viewStatus?.isPremium && (
              <button className={styles.premiumBadge} onClick={() => setPremiumInfo(viewStatus)}>
                👑 Premium
              </button>
            )}

            {/* User avatar — click to show dropdown */}
            <div className={styles.userChipWrap}>
              <div className={styles.userChip} onClick={() => setUserMenuOpen(o => !o)}>
                <div className={styles.avatar}>{(user.avatar || user.username?.slice(0, 2) || 'U').toUpperCase()}</div>
                <span className={styles.userName}>{user.displayName || user.username}</span>
                <span style={{ fontSize: 10, opacity: .5, marginLeft: 2 }}>▾</span>
              </div>
              {userMenuOpen && (
                <div className={styles.userDropdown}>
                  <div className={styles.userDropdownHeader}>
                    <div className={styles.userDropdownAvatar}>{(user.avatar || user.username?.slice(0, 2) || 'U').toUpperCase()}</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{user.displayName || user.username}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', textTransform: 'capitalize' }}>{user.role}</div>
                    </div>
                  </div>
                  <div className={styles.userDropdownDivider} />
                  <button className={styles.userDropdownItem} onClick={() => { setChangePwdModal(true); setUserMenuOpen(false); }}>
                    🔑 Change Password
                  </button>
                  <button className={styles.userDropdownItem} onClick={() => { logout(); }}>
                    🚪 Sign Out
                  </button>
                </div>
              )}
            </div>

            <button className={styles.hamburger} onClick={() => setMobileMenuOpen(o => !o)}>
              {mobileMenuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className={styles.mobileMenu}>
            <button onClick={() => { setView('gallery'); setMobileMenuOpen(false); }}>🏠 Home</button>
            <button onClick={() => { setView('bookmarks'); setMobileMenuOpen(false); }}>🔖 Bookmarks</button>
            {isAdminOrAdvisor && <a href={user?.role === 'advisor' ? '/advisor' : '/admin'}>🛡 {user?.role === 'advisor' ? 'Advisor' : 'Admin'}</a>}
            <button onClick={() => { setChangePwdModal(true); setMobileMenuOpen(false); }}>🔑 Change Password</button>
            <button onClick={logout} style={{ color: '#f87171' }}>🚪 Sign Out</button>
          </div>
        )}
      </header>

      {/* ── GALLERY (home + tabs) ── */}
      {view === 'gallery' && (
        <main className={styles.main}>
          {/* Tab pills */}
          <div className={styles.tabBar}>
            {HOME_TABS.map(t => (
              <button key={t.id} onClick={() => setHomeTab(t.id)}
                className={`${styles.tab} ${homeTab === t.id ? styles.tabActive : ''}`}>
                <span>{t.icon}</span><span>{t.label}</span>
              </button>
            ))}
          </div>

          {/* Section title */}
          <div className={styles.sectionHead}>
            <div className={styles.sectionAccent} />
            <h2 className={styles.sectionTitle}>
              {HOME_TABS.find(t => t.id === homeTab)?.icon} All {HOME_TABS.find(t => t.id === homeTab)?.label}
            </h2>
          </div>

          {/* Video grid */}
          {curatedLoading && homeTab === 'trending' ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '20vh' }}>
              <div className={styles.splashSpinner} style={{ width: 40, height: 40, borderWidth: 3 }} />
            </div>
          ) : (
          <div className={styles.grid}>
            {tabIds().map((id, i) => (
              <VideoCard key={id} id={id} index={i}
                hasThumb={thumbIds.has(id)}
                isBookmarked={bookmarks.has(id)}
                isAdmin={isAdminOrAdvisor}
                showHash={isAdminOrAdvisor}
                onPlay={() => openModal(id)}
                onDownload={(e) => handleDownload(e, id)}
                onBookmark={(e) => toggleBookmark(e, id)}
                onReport={(e) => { e.stopPropagation(); setReportModal(id); }}
                onDelete={isAdminOrAdvisor ? (e) => { e.stopPropagation(); setDeleteModal({ id }); setDeleteReason('duplicate'); } : null}
              />
            ))}
          </div>
          )}
          {/* Pagination for all-videos tab */}
          {homeTab === 'foryou' && totalPages > 1 && (
            <Pagination page={page} total={totalPages} onPage={goPage} />
          )}
        </main>
      )}

      {/* ── BOOKMARKS ── */}
      {view === 'bookmarks' && (
        <main className={styles.main}>
          <div className={styles.sectionHead}>
            <div className={styles.sectionAccent} />
            <h2 className={styles.sectionTitle}>🔖 Your Bookmarks</h2>
          </div>
          {bookmarkIds.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>🔖</div>
              <h3>No bookmarks yet</h3>
              <p>Tap the bookmark icon on any video to save it here</p>
              <button className={styles.btnPrimary} onClick={() => setView('gallery')}>Browse Videos</button>
            </div>
          ) : (
            <div className={styles.grid}>
              {bookmarkIds.map((id, i) => (
                <VideoCard key={id} id={id} index={i}
                  hasThumb={thumbIds.has(id)} isBookmarked={true}
                  isAdmin={isAdminOrAdvisor} showHash={isAdminOrAdvisor}
                  onPlay={() => openModal(id)}
                  onDownload={(e) => handleDownload(e, id)}
                  onBookmark={(e) => toggleBookmark(e, id)}
                  onReport={(e) => { e.stopPropagation(); setReportModal(id); }}
                  onDelete={isAdminOrAdvisor ? (e) => { e.stopPropagation(); setDeleteModal({ id }); } : null}
                />
              ))}
            </div>
          )}
        </main>
      )}

      {/* ── VIDEO MODAL ── */}
      {modal && (
        <div className={styles.modalBg} onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className={styles.modalBox}>
            <div className={styles.modalHeader}>
              <div className={styles.modalMeta}>
                <span className={styles.modalBadge}>▶ Now Playing</span>
                <span className={styles.modalTitle}>
                  {videoTitles[String(modal.id)] || videoTitle(modal.id)}
                  {(user?.role === 'admin' || user?.role === 'advisor') && (
                    <button
                      title="Edit title"
                      onClick={() => { setEditTitleModal({ id: modal.id }); setEditTitleInput(videoTitles[String(modal.id)] || ''); }}
                      style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: '2px 4px', borderRadius: 6, transition: 'all 0.2s', verticalAlign: 'middle' }}
                      onMouseOver={e => e.currentTarget.style.color = '#f472b6'}
                      onMouseOut={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
                    >
                      ✏️
                    </button>
                  )}
                </span>
              </div>
              <div className={styles.modalActions}>
                <button
                  className={styles.btnGhost}
                  style={{ color: shareCopied === modal.id ? '#4ade80' : undefined }}
                  onClick={() => {
                    const shareUrl = `${window.location.origin}/watch/${modal.id}`;
                    if (navigator.share) {
                      navigator.share({ title: videoTitles[String(modal.id)] || videoTitle(modal.id), url: shareUrl });
                    } else {
                      navigator.clipboard.writeText(shareUrl);
                    }
                    setShareCopied(modal.id);
                    setTimeout(() => setShareCopied(null), 2000);
                  }}
                >
                  {shareCopied === modal.id ? '✓ Copied!' : '🔗 Share'}
                </button>
                <button className={styles.btnGhost} onClick={(e) => handleDownload(e, modal.id)}>⬇ Download</button>
                <button className={styles.closeBtn} onClick={closeModal}>✕</button>
              </div>
            </div>
            <div className={styles.videoWrap}>
              {modal.loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '220px' }}>
                  <div className={styles.splashSpinner} />
                </div>
              ) : modal.src ? (
                <video key={modal.src} className={styles.modalVideo}
                  src={modal.src} controls autoPlay playsInline
                  controlsList="nodownload"
                  onContextMenu={e => e.preventDefault()}
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: '#a78bfa' }}>
                  Failed to load. Please try again.
                </div>
              )}
            </div>
            <div className={styles.modalNav}>
              <button className={styles.navBtn2} onClick={prevVideo} disabled={modal.index === 0}>← Prev</button>
              <div className={styles.navDot} />
              <button className={styles.navBtn2} onClick={nextVideo} disabled={modal.index >= allIds.length - 1}>Next →</button>
            </div>
          </div>
        </div>
      )}

      {/* ── REPORT MODAL ── */}
      {reportModal && (
        <div className={styles.modalBg} onClick={e => { if (e.target === e.currentTarget) setReportModal(null); }}>
          <div className={styles.smallModal}>
            <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 700 }}>🚩 Report Video #{reportModal}</h3>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', marginBottom: 16 }}>Why are you reporting this video?</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {REPORT_REASONS.map(r => (
                <button key={r} className={styles.reportBtn} onClick={() => submitReport(r)}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
            <button className={styles.cancelBtn} onClick={() => setReportModal(null)} style={{ marginTop: 12 }}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── DELETE MODAL (admin/advisor) ── */}
      {deleteModal && (
        <div className={styles.modalBg} onClick={e => { if (e.target === e.currentTarget) setDeleteModal(null); }}>
          <div className={styles.smallModal}>
            <h3 style={{ marginBottom: 8, fontSize: 16, fontWeight: 700, color: '#f87171' }}>🗑 Delete Video #{deleteModal.id}?</h3>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', marginBottom: 16 }}>Select a reason. This will be logged in the audit trail.</p>
            <select className="input" value={deleteReason} onChange={e => setDeleteReason(e.target.value)} style={{ marginBottom: 16, width: '100%' }}>
              {['duplicate', 'fake', 'nothing', 'broken', 'restricted'].map(r => (
                <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: 'rgba(239,68,68,.15)', color: '#f87171', fontWeight: 700, cursor: 'pointer' }}
                onClick={() => handleDelete(deleteModal.id)}>🗑 Delete</button>
              <button style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid rgba(255,255,255,.1)', background: 'transparent', color: 'rgba(255,255,255,.6)', cursor: 'pointer' }}
                onClick={() => setDeleteModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT TITLE MODAL (admin/advisor) ── */}
      {editTitleModal && (
        <div className={styles.modalBg} onClick={e => { if (e.target === e.currentTarget) { setEditTitleModal(null); } }}>
          <div className={styles.smallModal}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 22 }}>✏️</span>
              <div>
                <h3 style={{ fontWeight: 800, fontSize: 16, margin: 0 }}>Set Video Title</h3>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', margin: 0 }}>Video #{editTitleModal.id} · visible to all users</p>
              </div>
            </div>
            <input
              className="input"
              style={{ width: '100%', marginTop: 16, marginBottom: 16 }}
              placeholder={`e.g. ${videoTitle(editTitleModal.id)}`}
              value={editTitleInput}
              maxLength={80}
              autoFocus
              onChange={e => setEditTitleInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveVideoTitle(); if (e.key === 'Escape') { setEditTitleModal(null); } }}
            />
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', marginBottom: 14, textAlign: 'right' }}>{editTitleInput.length}/80</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                style={{ flex: 1, padding: '11px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#ec4899,#8b5cf6)', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: editTitleSaving ? 0.6 : 1 }}
                onClick={saveVideoTitle}
                disabled={editTitleSaving}
              >
                {editTitleSaving ? 'Saving...' : '✓ Save Title'}
              </button>
              {videoTitles[String(editTitleModal.id)] && (
                <button
                  style={{ padding: '11px 16px', borderRadius: 12, border: '1px solid rgba(239,68,68,.3)', background: 'rgba(239,68,68,.1)', color: '#f87171', fontWeight: 600, cursor: 'pointer' }}
                  onClick={() => { setEditTitleInput(''); saveVideoTitle(); }}
                  title="Remove custom title"
                >🗑</button>
              )}
              <button
                style={{ padding: '11px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,.1)', background: 'transparent', color: 'rgba(255,255,255,.6)', cursor: 'pointer' }}
                onClick={() => setEditTitleModal(null)}
              >Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── UPGRADE MODAL (PREMIUM FOMO) ── */}
      {showUpgrade && (
        <div className={styles.modalBg} onClick={e => { if (e.target === e.currentTarget) setShowUpgrade(false); }}>
          <div className={styles.upgradeBox} style={{ maxWidth: 520, background: 'linear-gradient(145deg,rgba(20,15,30,.95),rgba(10,5,15,.98))', border: '1px solid rgba(236,72,153,.3)', backdropFilter: 'blur(20px)', boxShadow: '0 30px 100px rgba(236,72,153,.2)', overflow: 'visible', padding: '32px 24px 24px' }}>

            {/* Timer badge */}
            <div style={{ position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(90deg,#ec4899,#8b5cf6)', padding: '6px 18px', borderRadius: 20, fontSize: 12, fontWeight: 800, color: '#fff', boxShadow: '0 10px 20px rgba(236,72,153,.4)', letterSpacing: '.05em', whiteSpace: 'nowrap', zIndex: 10 }}>
              ⏰ LIMITED TIME OFFER: {globalTimer}
            </div>

            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 44 }}>💎</div>
              <h2 style={{ margin: '8px 0 6px', fontSize: 22, fontWeight: 900, background: 'linear-gradient(to right,#fbcfe8,#ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Premium Access</h2>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', margin: 0 }}>
                {upgradeInfo?.limitMsg
                  ? upgradeInfo.limitMsg
                  : upgradeInfo?.hoursLeft
                    ? `You've watched all ${upgradeInfo?.limit ?? 5} free videos. Come back in ${upgradeInfo.hoursLeft}h or upgrade now.`
                    : `You've used all your free videos today. Upgrade for unlimited access.`}
              </p>
            </div>

            {/* Plan cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
              {(plans ? Object.values(plans) : [
                { id: 'basic', label: 'Basic', price: 100, originalPrice: 200, days: 14, icon: '⚡', color: '#7c3aed' },
                { id: 'plus', label: 'Plus', price: 300, originalPrice: 500, days: 60, icon: '🚀', color: '#0ea5e9', popular: true },
                { id: 'pro', label: 'Pro', price: 599, originalPrice: 999, days: 1095, icon: '👑', color: '#f59e0b' },
              ]).map(p => {
                const save = (p.originalPrice || 0) - (p.price || 0);
                return (
                  <div key={p.id} onClick={() => window.location.href = '/premium'}
                    style={{ position: 'relative', padding: '14px 10px', borderRadius: 14, border: `1px solid ${p.popular ? p.color : 'rgba(255,255,255,.1)'}`, background: p.popular ? `${p.color}18` : 'rgba(255,255,255,.04)', cursor: 'pointer', textAlign: 'center', transition: 'transform .2s' }}
                    onMouseOver={e => e.currentTarget.style.transform = 'scale(1.04)'}
                    onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    {p.popular && <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: p.color, color: '#fff', fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap' }}>POPULAR</div>}
                    <div style={{ fontSize: 22, marginBottom: 4 }}>{p.icon}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.5)', textTransform: 'uppercase', marginBottom: 4 }}>{p.label}</div>
                    {p.originalPrice && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', textDecoration: 'line-through' }}>₹{p.originalPrice}</div>}
                    <div style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>₹{p.price}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)' }}>{p.days} days</div>
                    {save > 0 && <div style={{ fontSize: 10, color: '#4ade80', fontWeight: 700, marginTop: 4 }}>Save ₹{save}</div>}
                  </div>
                );
              })}
            </div>

            <button style={{ width: '100%', padding: 16, background: 'linear-gradient(45deg,#ec4899,#8b5cf6)', borderRadius: 14, border: 'none', color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer', boxShadow: '0 10px 30px rgba(236,72,153,.4)' }} onClick={() => window.location.href = '/premium'}>
              View All Plans →
            </button>
            <button className={styles.upgradeSkip} style={{ marginTop: 12 }} onClick={() => setShowUpgrade(false)}>Maybe Later</button>
          </div>
        </div>
      )}

      {/* ── PREMIUM INFO MODAL ── */}

      {premiumInfo && (
        <div className={styles.modalBg} onClick={e => { if (e.target === e.currentTarget) setPremiumInfo(null); }}>
          <div className={styles.smallModal} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>👑</div>
            <h3 style={{ marginBottom: 8, fontWeight: 800 }}>You're Premium!</h3>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', marginBottom: 16 }}>
              Unlimited access to all videos. Enjoy!
            </p>
            {premiumInfo.expiresAt && (
              <p style={{ fontSize: 12, color: '#f59e0b', marginBottom: 16 }}>
                Expires: {new Date(premiumInfo.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            )}
            <button className={styles.btnPrimary} onClick={() => window.location.href = '/premium'}>Extend Plan →</button>
            <button className={styles.cancelBtn} onClick={() => setPremiumInfo(null)} style={{ marginTop: 8 }}>Close</button>
          </div>
        </div>
      )}
      {/* ── CHANGE PASSWORD MODAL ── */}
      {changePwdModal && (
        <div className={styles.modalBg} onClick={e => { if (e.target === e.currentTarget) setChangePwdModal(false); }}>
          <div className={styles.smallModal}>
            <h3 style={{ marginBottom: 4, fontWeight: 800, fontSize: 16 }}>🔑 Change Password</h3>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', marginBottom: 18 }}>Update your account password</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input className="input" type="password" placeholder="Current password"
                value={pwdForm.old} onChange={e => setPwdForm(p => ({ ...p, old: e.target.value }))} />
              <input className="input" type="password" placeholder="New password (min 6 chars)"
                value={pwdForm.new} onChange={e => setPwdForm(p => ({ ...p, new: e.target.value }))} />
              <input className="input" type="password" placeholder="Confirm new password"
                value={pwdForm.confirm} onChange={e => setPwdForm(p => ({ ...p, confirm: e.target.value }))} />
            </div>
            {pwdMsg && (
              <div style={{
                marginTop: 10, padding: '8px 12px', borderRadius: 10, fontSize: 13,
                background: pwdMsg.startsWith('\u2713') ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.12)',
                border: `1px solid ${pwdMsg.startsWith('\u2713') ? 'rgba(16,185,129,.3)' : 'rgba(239,68,68,.25)'}`,
                color: pwdMsg.startsWith('\u2713') ? '#34d399' : '#f87171'
              }}>
                {pwdMsg}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button style={{ flex: 1, padding: '11px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                onClick={changePassword}>Save Password</button>
              <button className={styles.cancelBtn} style={{ flex: 1 }} onClick={() => { setChangePwdModal(false); setPwdMsg(''); setPwdForm({ old: '', new: '', confirm: '' }); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── DOWNLOAD: PREMIUM ONLY MODAL ── */}
      {downloadUpgradeModal && (
        <div className={styles.modalBg} onClick={e => { if (e.target === e.currentTarget) setDownloadUpgradeModal(false); }}>
          <div className={styles.smallModal} style={{ textAlign: 'center', maxWidth: 400, position: 'relative' }}>
            <div style={{ fontSize: 44, marginBottom: 10 }}>⬇️</div>
            <h3 style={{ fontWeight: 900, fontSize: 19, marginBottom: 6, background: 'linear-gradient(to right,#a78bfa,#ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Downloads are Premium Only
            </h3>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', marginBottom: 16, lineHeight: 1.6 }}>
              Upgrade to Premium to download videos and watch them offline anytime.
            </p>
            <div style={{ padding: '8px 14px', background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.25)', borderRadius: 12, marginBottom: 16, fontSize: 12, fontWeight: 600 }}>
              🔥 Flash Sale ends in <strong style={{ fontFamily: 'Courier New', color: '#f59e0b' }}>{globalTimer}</strong>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 18 }}>
              {[
                { label: 'Basic', icon: '⚡', price: plans?.basic?.price || 100, color: '#7c3aed' },
                { label: 'Plus', icon: '🚀', price: plans?.plus?.price || 300, color: '#0ea5e9', popular: true },
                { label: 'Pro', icon: '👑', price: plans?.pro?.price || 599, color: '#f59e0b' },
              ].map(p => (
                <div key={p.label} style={{ padding: '12px 6px', background: p.popular ? `${p.color}20` : 'rgba(255,255,255,.04)', border: `1px solid ${p.popular ? p.color : 'rgba(255,255,255,.1)'}`, borderRadius: 12, cursor: 'pointer' }}
                  onClick={() => window.location.href = '/premium'}>
                  <div style={{ fontSize: 18 }}>{p.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: 12, marginTop: 4 }}>{p.label}</div>
                  <div style={{ fontWeight: 900, fontSize: 16, color: p.color }}>₹{p.price}</div>
                </div>
              ))}
            </div>
            <Link href="/premium" style={{ display: 'block', padding: '13px', borderRadius: 12, background: 'linear-gradient(135deg,#7c3aed,#ec4899)', color: '#fff', fontWeight: 800, fontSize: 14, textDecoration: 'none', marginBottom: 8, boxShadow: '0 6px 20px rgba(124,58,237,.4)' }}>
              👑 Upgrade to Premium →
            </Link>
            <button className={styles.cancelBtn} onClick={() => setDownloadUpgradeModal(false)}>Maybe later</button>
          </div>
        </div>
      )}

      {/* ── BOOKMARK LIMIT MODAL (free users: max 8) ── */}
      {bookmarkLimitModal && (
        <div className={styles.modalBg} onClick={e => { if (e.target === e.currentTarget) setBookmarkLimitModal(false); }}>
          <div className={styles.smallModal} style={{ textAlign: 'center', maxWidth: 380 }}>
            <div style={{ fontSize: 44, marginBottom: 10 }}>🔖</div>
            <h3 style={{ fontWeight: 900, fontSize: 18, marginBottom: 6 }}>Bookmark Limit Reached</h3>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', marginBottom: 6, lineHeight: 1.6 }}>
              Free accounts can save up to <strong style={{ color: '#f59e0b' }}>8 bookmarks</strong>.
            </p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', marginBottom: 16, lineHeight: 1.6 }}>
              Upgrade to Premium for <strong style={{ color: '#4ade80' }}>unlimited bookmarks</strong> + downloads + unlimited watches!
            </p>
            <div style={{ padding: '8px 14px', background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.25)', borderRadius: 12, marginBottom: 16, fontSize: 12, fontWeight: 600 }}>
              🔥 Sale ends in <strong style={{ fontFamily: 'Courier New', color: '#f59e0b' }}>{globalTimer}</strong>
            </div>
            <Link href="/premium" style={{ display: 'block', padding: '13px', borderRadius: 12, background: 'linear-gradient(135deg,#7c3aed,#ec4899)', color: '#fff', fontWeight: 800, fontSize: 14, textDecoration: 'none', marginBottom: 8, boxShadow: '0 6px 20px rgba(124,58,237,.4)' }}>
              👑 Upgrade Now →
            </Link>
            <button className={styles.cancelBtn} onClick={() => setBookmarkLimitModal(false)}>Stay Free</button>
          </div>
        </div>
      )}

      {/* ── PREMIUM WELCOME POPUP ── */}
      {premiumWelcomePopup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', backdropFilter: 'blur(12px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ position: 'relative', background: 'linear-gradient(135deg,#0f0518,#1a0533)', border: '1px solid rgba(245,158,11,.4)', borderRadius: 24, padding: 36, width: '100%', maxWidth: 460, textAlign: 'center', boxShadow: '0 40px 100px rgba(245,158,11,.2),0 0 0 1px rgba(255,255,255,.05)', overflow: 'hidden' }}>
            {/* Glow effects */}
            <div style={{ position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)', width: 300, height: 200, background: 'radial-gradient(ellipse,rgba(245,158,11,.25),transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ fontSize: 72, marginBottom: 4, animation: 'bounce 1s ease infinite', display: 'inline-block' }}>👑</div>
            <style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}} @keyframes shine{0%{opacity:.5}50%{opacity:1}100%{opacity:.5}}`}</style>
            <h2 style={{ fontSize: 26, fontWeight: 900, margin: '12px 0 6px', background: 'linear-gradient(to right,#fbbf24,#f59e0b,#fbbf24)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundSize: '200%', animation: 'shine 2s ease infinite' }}>
              You're Premium Now! 🎉
            </h2>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,.6)', lineHeight: 1.8, marginBottom: 6 }}>
              Welcome to the premium experience. You now have <strong style={{ color: '#fbbf24' }}>unlimited access</strong> to all videos!
            </p>
            {viewStatus?.expiresAt && (
              <div style={{ display: 'inline-block', padding: '8px 18px', background: 'rgba(245,158,11,.12)', border: '1px solid rgba(245,158,11,.3)', borderRadius: 50, fontSize: 13, color: '#fbbf24', fontWeight: 700, marginBottom: 16 }}>
                ✅ Active until {new Date(viewStatus.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button
                style={{ flex: 1, padding: '14px', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff', fontWeight: 900, fontSize: 15, cursor: 'pointer', boxShadow: '0 8px 24px rgba(245,158,11,.35)' }}
                onClick={() => setPremiumWelcomePopup(false)}
              >🎬 Start Watching</button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADMIN WARNING MESSAGE POPUP ── */}
      {adminMessage && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(8px)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'linear-gradient(135deg,#130a20,#1a0d2e)', border: '1px solid rgba(251,191,36,.4)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 400, textAlign: 'center', boxShadow: '0 30px 80px rgba(0,0,0,.7)' }}>
            <div style={{ fontSize: 48, marginBottom: 10 }}>⚠️</div>
            <h3 style={{ fontWeight: 900, fontSize: 18, color: '#fbbf24', marginBottom: 8 }}>Admin Warning</h3>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,.7)', lineHeight: 1.7, marginBottom: 20, whiteSpace: 'pre-wrap' }}>{adminMessage.message}</p>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', marginBottom: 16 }}>From: {adminMessage.from} · {new Date(adminMessage.timestamp).toLocaleString('en-IN')}</div>
            <button
              style={{ padding: '12px 28px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}
              onClick={() => setAdminMessage(null)}
            >✓ I Understand</button>
          </div>
        </div>
      )}

    </div>
  );
}

/* ── Logo ── */
function Logo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M14 2L26 8.5V19.5L14 26L2 19.5V8.5L14 2Z" fill="url(#glog)" />
      <path d="M10 10l8 4-8 4V10z" fill="white" opacity="0.9" />
      <defs><linearGradient id="glog" x1="2" y1="2" x2="26" y2="26">
        <stop offset="0%" stopColor="#7c3aed" /><stop offset="100%" stopColor="#ec4899" />
      </linearGradient></defs>
    </svg>
  );
}

/* ── VideoCard — iTeraPlay/TeraViralHub style ── */
function VideoCard({ id, index, hasThumb, isBookmarked, isAdmin, showHash, onPlay, onDownload, onBookmark, onReport, onDelete }) {
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState(false);
  const quality = videoQuality(id);
  const qColor = qualityColor(quality);
  const views = viewCount(id);

  return (
    <div className={styles.vcard} style={{ animationDelay: `${Math.min(index, 15) * 20}ms` }}>
      {/* Thumbnail */}
      <div className={styles.vthumb} onClick={onPlay}>
        <div className={styles.vthumbInner}>
          {hasThumb && !err ? (
            <>
              <img src={`/api/hwasi/thumbnail/${id}`} alt="" className={styles.vthumbImg}
                style={{ opacity: loaded ? 1 : 0, transition: 'opacity .3s' }}
                onLoad={() => setLoaded(true)} onError={() => setErr(true)} />
              {!loaded && <div className={styles.shimmer} />}
            </>
          ) : (
            <div style={{ position: 'absolute', inset: 0, background: GRADIENT_PLACEHOLDER(id), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Logo size={28} />
            </div>
          )}

          {/* Quality badge */}
          <div className={styles.qualityBadge} style={{ background: qColor }}>{quality}</div>

          {/* Views */}
          <div className={styles.viewsBadge}>👁 {views}</div>

          {/* Play overlay */}
          <div className={styles.vOverlay}>
            <div className={styles.vPlayBtn}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z" /></svg>
            </div>
          </div>
        </div>
      </div>

      {/* Info row */}
      <div className={styles.vinfo}>
        <div className={styles.vinfoAvatar}><Logo size={18} /></div>
        <div className={styles.vinfoMeta}>
          <p className={styles.vtitle}>{videoTitle(id)}</p>
          <p className={styles.vsub}>
            DesiHawas
            {showHash && <span style={{ color: 'rgba(255,255,255,.3)', marginLeft: 6 }}>#{id}</span>}
          </p>
        </div>
      </div>

      {/* Action buttons row */}
      <div className={styles.vactions}>
        <ActionBtn icon="🔖" label="Save" active={isBookmarked} activeColor="#f59e0b" onClick={(e) => onBookmark(e)} />
        <ActionBtn icon="⬇" label="Download" color="#10b981" onClick={(e) => onDownload(e)} />
        <ActionBtn icon="↗" label="Share" color="#3b82f6" onClick={(e) => {
          e.stopPropagation();
          const shareUrl = `${window.location.origin}/watch/${id}`;
          if (navigator.share) navigator.share({ title: videoTitle(id), url: shareUrl });
          else { navigator.clipboard?.writeText(shareUrl); }
        }} />
        <ActionBtn icon="🚩" label="Report" color="#ef4444" onClick={(e) => onReport(e)} />
        {isAdmin && onDelete && (
          <ActionBtn icon="🗑" label="Delete" color="#dc2626" onClick={(e) => onDelete(e)} />
        )}
      </div>
    </div>
  );
}

/* ── Small action button ── */
function ActionBtn({ icon, label, color = 'rgba(255,255,255,.12)', activeColor, active, onClick }) {
  return (
    <button className={styles.actionBtn}
      style={{ background: active && activeColor ? activeColor + '33' : 'rgba(255,255,255,.06)', color: active && activeColor ? activeColor : 'rgba(255,255,255,.7)' }}
      onClick={onClick} title={label}>
      <span style={{ fontSize: 13 }}>{icon}</span>
      <span style={{ fontSize: 10, fontWeight: 700 }}>{label}</span>
    </button>
  );
}

/* ── Gradient placeholder ── */
function GradientPlaceholder({ seed }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: GRADIENT_PLACEHOLDER(seed), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Logo size={26} />
    </div>
  );
}

/* ── Pagination ── */
function Pagination({ page, total, onPage }) {
  return (
    <div className={styles.pagination}>
      <button className={styles.pgBtn} onClick={() => onPage(total - 1)} disabled={page === total - 1}>»</button>
    </div>
  );
}
