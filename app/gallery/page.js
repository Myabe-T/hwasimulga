'use client';
import { secureFetch } from '@/lib/crypto';
import Link from 'next/link';
import { useState, useEffect, useCallback, useRef } from 'react';
import styles from './gallery.module.css';

const PER_PAGE = 24;
const thumbSrc = (id) => `/api/hwasi/thumbnail/${id}`;

// Fallback title — shows something honest instead of fake wordplay
function videoTitle(id) { return `Video #${id}`; }

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
  { id: 'instaviral', label: 'Insta Viral', icon: '💎' },
  { id: 'trending', label: 'Trending', icon: '🔥' },
  { id: 'foryou', label: 'Full Collection', icon: '🎬' },
  { id: 'popular', label: 'Popular', icon: '📈' },
  { id: 'recent', label: 'Recent', icon: '🕐' },
];

export default function GalleryPage() {
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState({ start: 1, end: 730 });
  const [curated, setCurated] = useState({ trending: [], popular: [], instaviral: [] });
  const [curatedLoading, setCuratedLoading] = useState(true);
  const [myHistory, setMyHistory] = useState([]);
  const [allIds, setAllIds] = useState([]);
  const [thumbIds, setThumbIds] = useState(new Set());
  const [page, setPage] = useState(0);
  const [curatedPage, setCuratedPage] = useState(0);
  const [modal, setModal] = useState(null);
  const [view, setView] = useState('gallery'); // gallery | bookmarks | history
  const [homeTab, setHomeTab] = useState('foryou');
  const [viewStatus, setViewStatus] = useState(null);
  const [isPremium, setIsPremium] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgradeInfo, setUpgradeInfo] = useState(null);
  const [bookmarks, setBookmarks] = useState(new Set());
  const [reportModal, setReportModal] = useState(null); // videoId
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [premiumInfo, setPremiumInfo] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null); // { id }
  const [deleteReason, setDeleteReason] = useState('duplicate');
  const [instaViralBlock, setInstaViralBlock] = useState(false);
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
  const [theme, setTheme] = useState('dark');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false); // mobile search overlay
  const [sidebarOpen, setSidebarOpen] = useState(false); // always-drawer pattern
  const [ageVerified, setAgeVerified] = useState(true); // 18+ gate
  const [cookieConsent, setCookieConsent] = useState(true); // cookie banner
  const [mobileGridCols, setMobileGridCols] = useState(1); // 1 or 2 columns on mobile

  // Global epoch-based countdown (same for everyone)
  const EPOCH_START = 1704067200;
  const PERIOD_SECS = 34 * 3600;
  const calcSecs = () => { const n = Math.floor(Date.now() / 1000); const e = (n - EPOCH_START) % PERIOD_SECS; return PERIOD_SECS - e; };
  const [globalSecs, setGlobalSecs] = useState(calcSecs);
  useEffect(() => { const id = setInterval(() => setGlobalSecs(calcSecs()), 1000); return () => clearInterval(id); }, []);

  // Theme + age gate + cookie on mount
  useEffect(() => {
    try {
      const s = localStorage.getItem('dh_theme');
      if (s) setTheme(s);
      if (!localStorage.getItem('dh_age_ok')) setAgeVerified(false);
      if (!localStorage.getItem('dh_cookie')) setCookieConsent(false);
      const g = localStorage.getItem('dh_grid');
      if (g) setMobileGridCols(Number(g) || 1);
    } catch {}
  }, []);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('dh_theme', theme); } catch {}
  }, [theme]);
  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');
  function toggleMobileGrid(cols) {
    setMobileGridCols(cols);
    try { localStorage.setItem('dh_grid', String(cols)); } catch {}
  }
  function acceptAge() {
    try { localStorage.setItem('dh_age_ok', '1'); } catch {}
    setAgeVerified(true);
  }
  function acceptCookie() {
    try { localStorage.setItem('dh_cookie', '1'); } catch {}
    setCookieConsent(true);
  }
  const gH = Math.floor(globalSecs / 3600), gM = Math.floor((globalSecs % 3600) / 60), gS = globalSecs % 60;
  const globalTimer = `${String(gH).padStart(2, '0')}:${String(gM).padStart(2, '0')}:${String(gS).padStart(2, '0')}`;

  useEffect(() => {
    async function init() {
      const r = await secureFetch('/api/verify');
      const d = await r.json();

      // ── PHASE 1: load settings + thumbnails + titles immediately ──
      const [s, t, tr] = await Promise.all([
        secureFetch('/api/hwasi/settings').then(x => x.json()).catch(() => ({ start:1, end:730 })),
        fetch(`/api/hwasi/thumbnails?v=${Date.now()}`).then(x => x.json()).catch(() => ({})),
        fetch(`/api/hwasi/titles?v=${Date.now()}&_=${Math.random()}`).then(x => x.json()).catch(() => ({ titles: {} })),
      ]);
      const st = s.error ? { start:1, end:730, deletedIds:[], extraRanges:[] } : s;
      const delSet = new Set(st.deletedIds || []);
      setSettings(st);
      setThumbIds(new Set((t.ids || []).map(Number)));
      setVideoTitles(tr.titles || {});

      // Build video ID list: primary range + any extra ranges (e.g. 2500-2560)
      const primaryIds = Array.from({ length: Math.max(0, st.end - st.start + 1) }, (_, i) => i + st.start);
      const extraIds = (st.extraRanges || []).flatMap(r =>
        Array.from({ length: Math.max(0, r.end - r.start + 1) }, (_, i) => i + r.start)
      );
      setAllIds([...new Set([...primaryIds, ...extraIds])].filter(id => !delSet.has(id)));

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
        setCurated(c.error ? { trending:[], popular:[], instaviral:[], fullCollection:[] } : c);
        setCuratedLoading(false);
        setMyHistory(Array.isArray(h) ? h : []);
        setViewStatus(vs);
        if (vs?.isPremium || ['admin','advisor'].includes(d.role)) setIsPremium(true);
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

  const trendingIds = (curated.trending || []).map(Number).filter(Boolean);
  const instaviralIds = (curated.instaviral || []).map(Number).filter(Boolean);
  const popularCuratedIds = (curated.popular || curated.latest || []).map(Number).filter(Boolean);
  const historyIds = [...new Set(myHistory.map(h => +h.videoId))].slice(0, 48);
  const bookmarkIds = [...bookmarks].slice(0, 48);

  // Exclude instaviral IDs from all normal tabs — Insta Viral is ALWAYS premium-only
  const safeAllIds = allIds.filter(id => !instaviralIds.includes(Number(id)));
  const safeTotalPages = Math.max(1, Math.ceil(safeAllIds.length / PER_PAGE));
  // Full Collection: use admin-shuffled order when set, else sequential
  const fullCollectionPriority = (curated.fullCollection || []).map(Number).filter(id => safeAllIds.includes(id));
  const fullCollectionRemainder = safeAllIds.filter(id => !fullCollectionPriority.includes(id));
  const sortedForYou = fullCollectionPriority.length > 0
    ? [...fullCollectionPriority, ...fullCollectionRemainder]
    : [...safeAllIds];
  const forYouIds = sortedForYou.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const popularIds = [...safeAllIds].sort((a, b) => Number(viewCount(b)) - Number(viewCount(a)));

  function tabIds() {
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
    const isPrivileged = isPremium || viewStatus?.isPremium || user?.role === 'admin' || user?.role === 'advisor';

    if (isInstaViral && !isPrivileged) {
      setModal(null);
      setInstaViralBlock(true);
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
        if (check.code === 'INSTAVIRAL_PREMIUM_ONLY') {
          setInstaViralBlock(true);
          return;
        }
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
  }, [allIds, viewStatus, user, instaviralIds, isPremium]);

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

  // GUEST view
  if (!user) return (
    <div className={styles.page}>
      {/* Age gate */}
      {!ageVerified && (
        <div className={styles.ageGate}>
          <div style={{ textAlign:'center', maxWidth:440, padding:'40px 28px', background:'linear-gradient(145deg,#0f0518,#1a0533)', border:'1px solid rgba(124,58,237,.35)', borderRadius:24, boxShadow:'0 40px 100px rgba(0,0,0,.7)' }}>
            <div style={{ fontSize:60, marginBottom:12 }}>🔞</div>
            <h2 style={{ fontSize:24, fontWeight:900, color:'#f1f5f9', marginBottom:8 }}>Adult Content Warning</h2>
            <p style={{ fontSize:14, color:'rgba(255,255,255,.6)', lineHeight:1.7, marginBottom:24 }}>
              This website contains content intended for <strong style={{ color:'#f59e0b' }}>adults only</strong>. You must be at least <strong>18 years old</strong> to proceed.
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:16 }}>
              <button onClick={acceptAge} style={{ padding:'15px', borderRadius:14, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#7c3aed,#4f46e5)', color:'#fff', fontWeight:800, fontSize:16 }}>✅ I am 18+ — Enter</button>
              <a href="https://google.com" style={{ padding:'12px', borderRadius:12, border:'1px solid rgba(255,255,255,.15)', color:'rgba(255,255,255,.5)', textDecoration:'none', fontSize:13, fontWeight:600, display:'block' }}>🚫 I am Under 18 — Exit</a>
            </div>
            <p style={{ fontSize:11, color:'rgba(255,255,255,.3)' }}>By entering, you agree to our <a href="/terms" style={{ color:'#a78bfa', textDecoration:'none' }}>Terms of Service</a>.</p>
          </div>
        </div>
      )}

      {/* Guest header */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brand}>
            <img src="/logo.png" alt="" className={styles.brandLogo} />
            <span className={styles.brandName}>DesiHawas</span>
          </div>
          <nav className={styles.desktopNav}>
            <span className={styles.navBtn} style={{ cursor:'default' }}>🎬 Gallery</span>
          </nav>
          <div className={styles.headerRight}>
            <a href="/login" className={styles.guestLoginBtn}>Login</a>
            <a href="/register" className={styles.guestRegBtn}>Register Free 🚀</a>
          </div>
        </div>
        <div className={styles.guestSaleBanner}>
          🔥 Flash Sale —
          <span style={{ fontFamily:'Courier New', fontWeight:900, color:'#f59e0b', margin:'0 6px' }}>{globalTimer}</span>
          left · <s style={{ opacity:.4 }}>₹{plans?.basic?.originalPrice || 200}/₹{plans?.plus?.originalPrice || 500}/₹{plans?.pro?.originalPrice || 999}</s> → <strong style={{ color:'#34d399' }}>₹{plans?.basic?.price || 100}/₹{plans?.plus?.price || 300}/₹{plans?.pro?.price || 599}</strong>
          <a href="/register" style={{ marginLeft:10, color:'#f59e0b', fontWeight:700, textDecoration:'none' }}>Unlock →</a>
        </div>
      </header>

      {/* Guest video grid */}
      <main className={styles.main}>
        <div className={styles.sectionHead}>
          <div className={styles.sectionAccent} />
          <h2 className={styles.sectionTitle}>Browse All Videos</h2>
        </div>
        <div className={`${styles.grid} ${mobileGridCols === 2 ? styles.gridCols2 : ''}`}>
          {pageIds.map((id, i) => (
            <VideoCard key={id} id={id} index={i}
              title={videoTitles[String(id)] || null}
              hasThumb={thumbIds.has(id)}
              isBookmarked={false} isAdmin={false} showHash={false}
              onPlay={() => setGuestAuthModal(true)}
              onDownload={null}
              onBookmark={() => setGuestAuthModal(true)}
              onReport={() => setGuestAuthModal(true)}
              onDelete={null}
            />
          ))}
        </div>
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
          <div className={styles.smallModal} style={{ textAlign:'center' }}>
            <img src="/logo.png" alt="" style={{ width:50, height:50, borderRadius:10, marginBottom:12 }} />
            <h3 style={{ fontWeight:800, fontSize:18, marginBottom:6, color:'var(--text1)' }}>🔒 Login to Watch</h3>
            <p style={{ fontSize:13, color:'var(--text3)', marginBottom:14, lineHeight:1.5 }}>Create a free account to watch videos.<br />Get premium for unlimited access!</p>
            <div style={{ padding:'10px 14px', background:'rgba(245,158,11,.1)', border:'1px solid rgba(245,158,11,.25)', borderRadius:12, marginBottom:16, fontSize:13 }}>
              🔥 Sale ends in <strong style={{ fontFamily:'Courier New', color:'#f59e0b' }}>{globalTimer}</strong>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:16 }}>
              <a href="/login" style={{ padding:'12px', borderRadius:12, background:'var(--inp)', border:'1px solid var(--inp-brd)', color:'var(--text1)', textDecoration:'none', fontSize:14, fontWeight:700, display:'block' }}>🔑 Login</a>
              <a href="/register" style={{ padding:'12px', borderRadius:12, background:'linear-gradient(135deg,#7c3aed,#4f46e5)', color:'#fff', textDecoration:'none', fontSize:14, fontWeight:700, display:'block' }}>🚀 Register</a>
            </div>
            <button className={styles.cancelBtn} onClick={() => setGuestAuthModal(false)}>Close</button>
          </div>
        </div>
      )}

      {/* Cookie consent */}
      {!cookieConsent && (
        <div className={styles.cookieBanner}>
          <p style={{ fontSize:13, color:'var(--text2)', margin:0, flex:1 }}>🍪 We use cookies to enhance your experience. <a href="/terms" style={{ color:'var(--accent)' }}>Learn more</a></p>
          <button onClick={acceptCookie} style={{ padding:'8px 20px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#7c3aed,#4f46e5)', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer', whiteSpace:'nowrap' }}>Accept</button>
        </div>
      )}
    </div>
  );


  // ── Search filter ──
  const searchedTabIds = () => {
    const base = tabIds();
    if (!searchQuery.trim()) return base;
    const q = searchQuery.toLowerCase().trim();
    return base.filter(id => (videoTitles[String(id)] || '').toLowerCase().includes(q));
  };

  const initials = (user.avatar || user.username?.slice(0, 2) || 'U').toUpperCase();
  const planLabel = viewStatus?.isPremium ? 'PREMIUM' : (user.role === 'admin' ? 'ADMIN' : user.role === 'advisor' ? 'ADVISOR' : 'FREE PLAN');
  const isPrem = viewStatus?.isPremium || false;

  // ── LOGGED IN VIEW ──
  return (
    <div className={styles.shell} onClick={e => { if (userMenuOpen && !e.target.closest('[data-usermenu]')) setUserMenuOpen(false); }}>

      {/* Age gate (on first visit, even logged in) */}
      {!ageVerified && (
        <div className={styles.ageGate}>
          <div style={{ textAlign:'center', maxWidth:440, padding:'40px 28px', background:'linear-gradient(145deg,#0f0518,#1a0533)', border:'1px solid rgba(124,58,237,.35)', borderRadius:24, boxShadow:'0 40px 100px rgba(0,0,0,.7)' }}>
            <div style={{ fontSize:60, marginBottom:12 }}>🔞</div>
            <h2 style={{ fontSize:24, fontWeight:900, color:'#f1f5f9', marginBottom:8 }}>Adult Content Warning</h2>
            <p style={{ fontSize:14, color:'rgba(255,255,255,.6)', lineHeight:1.7, marginBottom:24 }}>
              This website contains content intended for <strong style={{ color:'#f59e0b' }}>adults only</strong>. You must be at least <strong>18 years old</strong> to proceed.
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:16 }}>
              <button onClick={acceptAge} style={{ padding:'15px', borderRadius:14, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#7c3aed,#4f46e5)', color:'#fff', fontWeight:800, fontSize:16 }}>✅ I am 18+ — Enter</button>
              <a href="https://google.com" style={{ padding:'12px', borderRadius:12, border:'1px solid rgba(255,255,255,.15)', color:'rgba(255,255,255,.5)', textDecoration:'none', fontSize:13, fontWeight:600, display:'block' }}>🚫 I am Under 18 — Exit</a>
            </div>
            <p style={{ fontSize:11, color:'rgba(255,255,255,.3)' }}>By entering, you agree to our <a href="/terms" style={{ color:'#a78bfa', textDecoration:'none' }}>Terms of Service</a>.</p>
          </div>
        </div>
      )}

      {/* Mobile search overlay */}
      {searchOpen && (
        <div className={styles.searchOverlay}>
          <div className={styles.searchOverlayRow}>
            <input
              autoFocus
              className={styles.searchOverlayInput}
              placeholder="Search videos by title..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setPage(0); setCuratedPage(0); }}
            />
            <button className={styles.searchOverlayClose} onClick={() => { setSearchOpen(false); setSearchQuery(''); }}>✕</button>
          </div>
          {searchQuery.trim() ? (
            <p style={{ fontSize:13, color:'var(--text3)', padding:'0 4px' }}>
              Showing results for &ldquo;<strong style={{ color:'var(--text1)' }}>{searchQuery}</strong>&rdquo;
            </p>
          ) : (
            <p className={styles.searchOverlayHint}>🔍 Type to search titles…</p>
          )}
        </div>
      )}

      {/* ══ SIDEBAR ══ */}
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
        {/* Brand */}
        <div className={styles.sidebarBrand}>
          <img src="/logo.png" alt="" className={styles.sidebarLogo} />
          <span className={styles.sidebarBrandName}>DesiHawas</span>
          <button className={styles.sidebarClose} onClick={() => setSidebarOpen(false)}>✕</button>
        </div>

        {/* Appearance toggle */}
        <div className={styles.sidebarApp}>
          <span className={styles.sidebarAppLabel}>Appearance</span>
          <button className={styles.themeToggle} onClick={toggleTheme}>
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>

        {/* Mobile grid toggle (visible only on ≤900px) */}
        <div className={styles.sidebarGridToggle} style={{ display:'block' }}>
          <div className={styles.sidebarGridLabel}>📱 Video Layout</div>
          <div className={styles.sidebarGridBtns}>
            <button className={`${styles.gridToggleBtn} ${mobileGridCols === 1 ? styles.gridToggleActive : ''}`} onClick={() => toggleMobileGrid(1)}>
              <span>▬</span> Single
            </button>
            <button className={`${styles.gridToggleBtn} ${mobileGridCols === 2 ? styles.gridToggleActive : ''}`} onClick={() => toggleMobileGrid(2)}>
              <span>⊞</span> 2 per row
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav className={styles.sidebarNav}>
          <button className={`${styles.sidebarItem} ${view === 'gallery' ? styles.sidebarActive : ''}`}
            onClick={() => { setView('gallery'); setHomeTab('full'); setSidebarOpen(false); }}>
            <span className={styles.sidebarIcon}>🏠</span>Home
          </button>

          <button className={`${styles.sidebarItem} ${view === 'bookmarks' ? styles.sidebarActive : ''}`}
            onClick={() => { setView('bookmarks'); setSidebarOpen(false); }}>
            <span className={styles.sidebarIcon}>🔖</span>Bookmarks
          </button>

          <button className={`${styles.sidebarItem}`}
            onClick={() => { setView('gallery'); setHomeTab('recent'); setSidebarOpen(false); }}>
            <span className={styles.sidebarIcon}>🕐</span>History
          </button>

          {isAdminOrAdvisor && (
            <a href={user.role === 'advisor' ? '/advisor' : '/admin'} className={styles.sidebarItem}>
              <span className={styles.sidebarIcon}>🛡️</span>
              {user.role === 'advisor' ? 'Advisor Panel' : 'Admin Panel'}
            </a>
          )}

          <div className={styles.sidebarDivider} />

          {/* Premium/Free label */}
          {isPrem ? (
            <a href="/premium" className={`${styles.sidebarItem} ${styles.sidebarExtend}`}>
              <span className={styles.sidebarIcon}>⚡</span>Extend Premium
            </a>
          ) : (
            <a href="/premium" className={`${styles.sidebarItem} ${styles.sidebarPremium}`}>
              <span className={styles.sidebarIcon}>👑</span>Buy Premium
            </a>
          )}

          <button className={`${styles.sidebarItem} ${view === 'profile' ? styles.sidebarActive : ''}`}
            onClick={() => { setView('profile'); setSidebarOpen(false); }}>
            <span className={styles.sidebarIcon}>👤</span>My Profile
          </button>

          <a href="/terms" className={styles.sidebarItem} style={{ fontSize:12 }}>
            <span className={styles.sidebarIcon}>📋</span>Terms of Service
          </a>
        </nav>

        {/* Footer with logout text */}
        <div className={styles.sidebarFooter}>
          <div className={styles.sidebarAvatar}>{initials}</div>
          <div className={styles.sidebarUserInfo}>
            <div className={styles.sidebarUserName}>{user.displayName || user.username}</div>
            <div className={styles.sidebarUserPlan}>{planLabel}</div>
          </div>
          <button className={styles.sidebarLogoutBtn} onClick={logout} title="Logout">
            ⏏ Logout
          </button>
        </div>
      </aside>

      {/* Sidebar overlay — click to close */}
      {sidebarOpen && <div className={styles.sidebarOverlay} onClick={() => setSidebarOpen(false)} />}

      {/* ══ MAIN ══ */}
      <div className={styles.mainWrap}>

        {/* ── HEADER ── */}
        <header className={styles.header}>
          {/* Hamburger — always visible */}
          <button className={styles.hamburger} onClick={() => setSidebarOpen(o => !o)} aria-label="Menu">
            ☰
          </button>

          {/* Brand — always visible */}
          <a href="/gallery" className={styles.headerBrand}>
            <img src="/logo.png" alt="" className={styles.headerBrandLogo} />
            <span className={styles.headerBrandName}>DesiHawas</span>
          </a>

          {/* Search (desktop) */}
          <div className={styles.searchWrap}>
            <input
              className={styles.searchInput}
              placeholder="Search videos..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setPage(0); setCuratedPage(0); }}
            />
            {searchQuery && (
              <button className={styles.searchClearBtn} onClick={() => setSearchQuery('')}>✕</button>
            )}
            <span className={styles.searchIcon}>🔍</span>
          </div>

          {/* Right side */}
          <div className={styles.headerRight}>
            {/* Mobile search icon */}
            <button className={styles.searchMobileBtn} onClick={() => setSearchOpen(true)} aria-label="Search">🔍</button>

            {/* Theme toggle */}
            <button className={styles.themeBtn} onClick={toggleTheme} title="Toggle theme">
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>

            {/* User chip */}
            <div className={styles.userChipWrap} data-usermenu="true">
              <div className={styles.userChip} onClick={() => setUserMenuOpen(o => !o)} data-usermenu="true">
                <div className={styles.avatar}>{initials}</div>
                <span className={styles.userName}>{user.displayName || user.username}</span>
                <span className={`${styles.userPlanBadge} ${isPrem ? styles.userPlanBadgePrem : ''}`}>{planLabel}</span>
                <span style={{ fontSize:10, color:'var(--text3)', marginLeft:2 }}>▾</span>
              </div>

              {userMenuOpen && (
                <div className={styles.userDropdown} data-usermenu="true">
                  <div className={styles.udHeader}>
                    <div className={styles.udAvatar}>{initials}</div>
                    <div>
                      <div className={styles.udName}>{user.displayName || user.username}</div>
                      <div className={styles.udPlan}>{planLabel}</div>
                    </div>
                  </div>
                  <div className={styles.udAppRow}>
                    APPEARANCE
                    <button className={styles.themeToggle} onClick={toggleTheme}>
                      {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
                    </button>
                  </div>
                  <button className={styles.udItem} onClick={() => { setView('profile'); setUserMenuOpen(false); }}>
                    👤 My Profile
                  </button>
                  <button className={styles.udItem} onClick={() => { setView('bookmarks'); setUserMenuOpen(false); }}>
                    🔖 My Bookmarks
                  </button>
                  {!isPrem && user.role === 'viewer' && (
                    <a href="/premium" className={styles.udItem} style={{ color:'#f59e0b' }}>
                      👑 Buy Premium
                    </a>
                  )}
                  <div className={styles.udDivider} />
                  <button className={`${styles.udItem} ${styles.udItemDanger}`} onClick={logout}>
                    🚪 Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Cookie consent banner */}
        {!cookieConsent && (
          <div className={styles.cookieBanner}>
            <p style={{ fontSize:13, color:'var(--text2)', margin:0, flex:1 }}>🍪 We use cookies to enhance your experience. <a href="/terms" style={{ color:'var(--accent)' }}>Learn more</a></p>
            <button onClick={acceptCookie} style={{ padding:'8px 20px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#7c3aed,#4f46e5)', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer', whiteSpace:'nowrap' }}>Accept</button>
          </div>
        )}

        {/* ── GALLERY ── */}
        {(view === 'gallery' || view === 'history') && (
          <main className={styles.main}>
            {/* Dynamic Island Tabs */}
            <div className={styles.tabContainer}>
              <div className={styles.tabPill}>
                {HOME_TABS.map(t => (
                  <button key={t.id} onClick={() => { setHomeTab(t.id); setPage(0); setCuratedPage(0); }}
                    className={`${styles.tab} ${homeTab === t.id ? styles.tabActive : ''}`}>
                    <span>{t.icon}</span><span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Section title */}
            <div className={styles.sectionHead}>
              <div className={styles.sectionAccent} />
              <h2 className={styles.sectionTitle}>
                {searchQuery ? `🔍 "${searchQuery}"` : homeTab === 'foryou' ? '🎦 Entire Collection' : `${HOME_TABS.find(t => t.id === homeTab)?.icon} All ${HOME_TABS.find(t => t.id === homeTab)?.label}`}
              </h2>
              {searchQuery && <span className={styles.sectionCount}>{searchedTabIds().length} results</span>}
            </div>

            {/* Grid */}
            {curatedLoading && homeTab !== 'foryou' ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '20vh' }}>
                <div className={styles.splashSpinner} style={{ width: 40, height: 40 }} />
              </div>
            ) : (
              <div className={`${styles.grid} ${mobileGridCols === 2 ? styles.gridCols2 : ''}`}>
                {searchedTabIds().map((id, i) => (
                  <div key={id} style={{ position: 'relative' }}>
                    {homeTab === 'instaviral' && !isPremium && (
                      <div style={{ position:'absolute',inset:0,zIndex:10,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,.5)',borderRadius:12,cursor:'pointer' }}
                        onClick={e => { e.stopPropagation(); setInstaViralBlock(true); }}>
                        <div style={{ fontSize:30 }}>💎</div>
                        <div style={{ fontSize:10, fontWeight:800, color:'#f59e0b', letterSpacing:1, textTransform:'uppercase', marginTop:4 }}>Premium Only</div>
                      </div>
                    )}
                    <VideoCard id={id} index={i}
                      title={videoTitles[String(id)] || null}
                      hasThumb={thumbIds.has(id)}
                      isBookmarked={bookmarks.has(id)}
                      isAdmin={isAdminOrAdvisor}
                      showHash={isAdminOrAdvisor}
                      onPlay={() => openModal(id)}
                      onDownload={instaviralIds.includes(Number(id)) ? null : e => handleDownload(e, id)}
                      onBookmark={e => toggleBookmark(e, id)}
                      onReport={e => { e.stopPropagation(); setReportModal(id); }}
                      onDelete={isAdminOrAdvisor ? e => { e.stopPropagation(); setDeleteModal({ id }); setDeleteReason('duplicate'); } : null}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {!searchQuery && (() => {
              const t = tabTotal();
              if (t <= 1) return null;
              const isForYou = homeTab === 'foryou';
              const p = isForYou ? page : curatedPage;
              const setter = isForYou
                ? np => { setPage(Math.max(0, Math.min(np, t-1))); window.scrollTo({ top: 0, behavior: 'smooth' }); }
                : np => { setCuratedPage(Math.max(0, Math.min(np, t-1))); window.scrollTo({ top: 0, behavior: 'smooth' }); };
              return <Pagination page={p} total={t} onPage={setter} />;
            })()}
          </main>
        )}

        {/* ── BOOKMARKS ── */}
        {view === 'bookmarks' && (
          <main className={styles.main}>
            <div className={styles.sectionHead}>
              <div className={styles.sectionAccent} />
              <h2 className={styles.sectionTitle}>🔖 Your Bookmarks</h2>
              <span className={styles.sectionCount}>{bookmarkIds.length} saved</span>
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
                    title={videoTitles[String(id)] || null}
                    hasThumb={thumbIds.has(id)} isBookmarked={true}
                    isAdmin={isAdminOrAdvisor} showHash={isAdminOrAdvisor}
                    onPlay={() => openModal(id)}
                    onDownload={instaviralIds.includes(Number(id)) ? null : e => handleDownload(e, id)}
                    onBookmark={e => toggleBookmark(e, id)}
                    onReport={e => { e.stopPropagation(); setReportModal(id); }}
                    onDelete={isAdminOrAdvisor ? e => { e.stopPropagation(); setDeleteModal({ id }); } : null}
                  />
                ))}
              </div>
            )}
          </main>
        )}

        {/* ── PROFILE VIEW ── */}
        {view === 'profile' && (
          <ProfileView user={user} viewStatus={viewStatus} plans={plans} myHistory={myHistory} bookmarkIds={bookmarkIds} onClose={() => setView('gallery')} onChangePwd={() => setChangePwdModal(true)} onLogout={logout} />
        )}


      {modal && (
        <div className={styles.modalBg} onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className={styles.modalBox}>
            <div className={styles.modalHeader}>
              <div className={styles.modalMeta}>
                <span className={styles.modalBadge}>▶ Now Playing</span>
                <span className={styles.modalTitle}>
                  {videoTitles[String(modal.id)] || `Video #${modal.id}`}
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
                  onClick={async () => {
                    try {
                      const res = await fetch(`/api/hwasi/share/${modal.id}`);
                      const d = await res.json();
                      const shareUrl = `${window.location.origin}/watch?v=${encodeURIComponent(d.token || '')}`;
                      if (navigator.share) {
                        navigator.share({ title: videoTitles[String(modal.id)] || `Video #${modal.id}`, url: shareUrl });
                      } else {
                        navigator.clipboard.writeText(shareUrl);
                      }
                    } catch(err) {}
                    setShareCopied(modal.id);
                    setTimeout(() => setShareCopied(null), 2000);
                  }}
                >
                  {shareCopied === modal.id ? '✓ Copied!' : '🔗 Share'}
                </button>
                {!instaviralIds.includes(Number(modal.id)) && (
                  <button className={styles.btnGhost} onClick={(e) => handleDownload(e, modal.id)}>⬇ Download</button>
                )}
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
            {/* Thumbnail preview below video player */}
            {thumbIds.has(modal.id) && (
              <div style={{ padding: '12px 16px 0', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <img
                  src={`/api/hwasi/thumbnail/${modal.id}`}
                  alt="thumbnail"
                  style={{ width: 120, height: 72, objectFit: 'cover', borderRadius: 10, flexShrink: 0, border: '1px solid rgba(255,255,255,.1)' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#e2e8f0', marginBottom: 4, lineHeight: 1.4 }}>
                    {videoTitles[String(modal.id)] || `Video #${modal.id}`}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)' }}>DesiHawas · #{modal.id}</div>
                </div>
              </div>
            )}
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
      {/* ── Insta Viral Premium Block ── */}
      {instaViralBlock && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.88)', backdropFilter:'blur(14px)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
          onClick={() => setInstaViralBlock(false)}>
          <div style={{ background:'linear-gradient(135deg,#1a0030,#2d0050)', border:'1px solid rgba(236,72,153,.35)', borderRadius:24, padding:'44px 36px', maxWidth:400, width:'100%', textAlign:'center', boxShadow:'0 0 80px rgba(124,58,237,.5)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:68, marginBottom:12, lineHeight:1 }}>💎</div>
            <h2 style={{ fontSize:22, fontWeight:800, margin:'0 0 10px', background:'linear-gradient(135deg,#ec4899,#a855f7)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>Premium Only Content</h2>
            <p style={{ color:'rgba(255,255,255,.65)', marginBottom:28, lineHeight:1.7, fontSize:14 }}>
              Insta Viral videos are exclusive to <strong style={{color:'#f59e0b'}}>Premium members</strong>.<br/>
              Upgrade now to unlock the full collection instantly!
            </p>
            <button onClick={() => window.location.href='/premium'}
              style={{ width:'100%', padding:'15px 0', borderRadius:12, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#7c3aed,#ec4899)', color:'#fff', fontWeight:800, fontSize:16, marginBottom:12, letterSpacing:.3 }}>
              🚀 Upgrade to Premium
            </button>
            <button onClick={() => setInstaViralBlock(false)}
              style={{ background:'none', border:'1px solid rgba(255,255,255,.12)', color:'rgba(255,255,255,.5)', padding:'10px 0', width:'100%', borderRadius:10, cursor:'pointer', fontSize:13 }}>
              Maybe Later
            </button>
          </div>
        </div>
      )}

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

      {/* Admin message */}
      {adminMessage && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(8px)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: adminMessage.type === 'utr_rejected' ? 'linear-gradient(135deg,#1a0505,#2d0a0a)' : 'linear-gradient(135deg,#130a20,#1a0d2e)', border: `1px solid ${adminMessage.type === 'utr_rejected' ? 'rgba(248,113,113,.4)' : 'rgba(251,191,36,.4)'}`, borderRadius: 20, padding: 28, width: '100%', maxWidth: 420, textAlign: 'center', boxShadow: '0 30px 80px rgba(0,0,0,.7)' }}>
            <div style={{ fontSize: 48, marginBottom: 10 }}>{adminMessage.type === 'utr_rejected' ? '❌' : '⚠️'}</div>
            <h3 style={{ fontWeight: 900, fontSize: 18, color: adminMessage.type === 'utr_rejected' ? '#f87171' : '#fbbf24', marginBottom: 8 }}>
              {adminMessage.type === 'utr_rejected' ? 'Payment Verification Failed' : 'Admin Notice'}
            </h3>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,.75)', lineHeight: 1.7, marginBottom: 20, whiteSpace: 'pre-wrap' }}>{adminMessage.message}</p>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', marginBottom: 16 }}>From: {adminMessage.from} · {new Date(adminMessage.timestamp).toLocaleString('en-IN')}</div>
            {adminMessage.type === 'utr_rejected' && (
              <button style={{ padding: '11px 24px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#7c3aed,#ec4899)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', marginBottom: 8, width: '100%' }}
                onClick={() => { setAdminMessage(null); window.location.href = '/premium'; }}>
                🔄 Resubmit Payment
              </button>
            )}
            <button
              style={{ padding: '11px 28px', borderRadius: 12, border: 'none', background: adminMessage.type === 'utr_rejected' ? 'rgba(255,255,255,.1)' : 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', width: '100%' }}
              onClick={() => setAdminMessage(null)}
            >✓ I Understand</button>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}

/* ════════════════════════════════════
   ProfileView — iTeraPlay style tabs
   ════════════════════════════════════ */
function ProfileView({ user, viewStatus, plans, myHistory, bookmarkIds, onClose, onChangePwd, onLogout }) {
  const [tab, setTab] = useState('account');
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [email, setEmail] = useState(user.email || '');
  const [saveMsg, setSaveMsg] = useState('');
  const [sessions, setSessions] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pwdForm, setPwdForm] = useState({ old: '', new: '', confirm: '' });
  const [pwdMsg, setPwdMsg] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const tabs = ['account', 'stats', 'sessions', 'subscriptions', 'transactions'];

  useEffect(() => {
    if (tab === 'sessions') {
      setLoading(true);
      fetch('/api/hwasi/sessions/me').then(r => r.json()).then(d => setSessions(d.sessions || [])).catch(() => {}).finally(() => setLoading(false));
    }
    if (tab === 'transactions') {
      setLoading(true);
      fetch('/api/hwasi/utr').then(r => r.json()).then(d => setTransactions(d.transactions || d.requests || [])).catch(() => {}).finally(() => setLoading(false));
    }
  }, [tab]);


  async function saveAccount() {
    setSaveMsg('');
    try {
      const r = await fetch('/api/hwasi/users/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ displayName, email }) });
      const d = await r.json();
      if (d.ok) setSaveMsg('✓ Saved!');
      else setSaveMsg(d.error || 'Failed');
    } catch { setSaveMsg('Network error'); }
  }

  async function changePassword() {
    setPwdMsg('');
    if (pwdForm.new !== pwdForm.confirm) { setPwdMsg('New passwords do not match'); return; }
    if (pwdForm.new.length < 6) { setPwdMsg('Password must be at least 6 characters'); return; }
    try {
      const r = await fetch('/api/hwasi/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ oldPassword: pwdForm.old, newPassword: pwdForm.new }) });
      const d = await r.json();
      if (!r.ok) { setPwdMsg(d.error || 'Failed'); return; }
      setPwdMsg('✓ Password changed!');
      setPwdForm({ old: '', new: '', confirm: '' });
    } catch { setPwdMsg('Network error'); }
  }

  async function revokeSession(sessionId) {
    await fetch('/api/hwasi/sessions', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId }) }).catch(() => {});
    setSessions(p => p.filter(s => s.id !== sessionId));
  }

  const initials = (user.displayName || user.username || 'U').slice(0, 2).toUpperCase();
  const planLabel = viewStatus?.isPremium ? 'PREMIUM' : user.role === 'admin' ? 'ADMIN' : user.role === 'advisor' ? 'ADVISOR' : 'FREE PLAN';
  const watchCount = myHistory?.length || 0;

  const inp = { background: 'var(--inp)', border: '1px solid var(--inp-brd)', borderRadius: 10, padding: '10px 14px', fontSize: 14, color: 'var(--text1)', width: '100%', outline: 'none', fontFamily: 'inherit' };

  return (
    <main style={{ flex: 1, padding: '24px 20px 60px', maxWidth: 720, width: '100%', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 13, fontFamily: 'inherit', padding: '4px 8px', borderRadius: 8, transition: 'background .15s' }}
            onMouseOver={e => e.currentTarget.style.background = 'var(--shi)'} onMouseOut={e => e.currentTarget.style.background = 'none'}>
            ← Back
          </button>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text1)', margin: '0 0 4px' }}>Profile Settings</h1>
        <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0 }}>Manage your account information and preferences</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 24, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '10px 16px', background: 'none', border: 'none', borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent', color: tab === t ? 'var(--accent)' : 'var(--text3)', fontWeight: 700, fontSize: 13, cursor: 'pointer', textTransform: 'capitalize', whiteSpace: 'nowrap', fontFamily: 'inherit', transition: 'color .15s', marginBottom: -1 }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Account Tab */}
      {tab === 'account' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Account Info */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text1)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>👤 Account Info</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: 'linear-gradient(135deg,#7c3aed,#ec4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{initials}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text1)' }}>{user.displayName || user.username}</div>
                <div style={{ fontSize: 11, fontWeight: 800, color: viewStatus?.isPremium ? '#a78bfa' : '#f59e0b', textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 2 }}>{planLabel}</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>Full Name</label>
                <input style={inp} value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name" />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>Email Address</label>
                <input style={inp} value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" type="email" />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={saveAccount}
                style={{ padding: '10px 22px', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                Save Changes
              </button>
              {saveMsg && <span style={{ fontSize: 13, color: saveMsg.startsWith('✓') ? '#4ade80' : '#f87171' }}>{saveMsg}</span>}
            </div>
          </div>

          {/* Change Password */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text1)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>🔒 Change Password</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>Current Password</label>
                <div style={{ position: 'relative' }}>
                  <input style={inp} type={showOld ? 'text' : 'password'} placeholder="Enter current password" value={pwdForm.old} onChange={e => setPwdForm(p => ({ ...p, old: e.target.value }))} />
                  <button onClick={() => setShowOld(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 14 }}>{showOld ? '🚵' : '👁'}</button>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>New Password</label>
                <div style={{ position: 'relative' }}>
                  <input style={inp} type={showNew ? 'text' : 'password'} placeholder="Min 6 characters" value={pwdForm.new} onChange={e => setPwdForm(p => ({ ...p, new: e.target.value }))} />
                  <button onClick={() => setShowNew(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 14 }}>{showNew ? '🚵' : '👁'}</button>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>Confirm New Password</label>
                <input style={inp} type="password" placeholder="Repeat new password" value={pwdForm.confirm} onChange={e => setPwdForm(p => ({ ...p, confirm: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button onClick={changePassword}
                  style={{ padding: '10px 22px', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Update Password
                </button>
                {pwdMsg && <span style={{ fontSize: 13, color: pwdMsg.startsWith('✓') ? '#4ade80' : '#f87171' }}>{pwdMsg}</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Tab */}
      {tab === 'stats' && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text1)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>📊 Activity Stats</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[
              { icon: '▶️', label: 'Watched Videos', value: watchCount, color: '#7c3aed' },
              { icon: '🔖', label: 'Saved Bookmarks', value: bookmarkIds.length, color: '#10b981' },
              { icon: '⬇️', label: 'Total Downloads', value: 0, color: '#ec4899' },
              { icon: '💎', label: planLabel, value: '', sub: viewStatus?.isPremium ? 'Premium Access' : 'Free Plan', color: '#f59e0b' },
              { icon: '📅', label: 'Joined On', value: '', sub: user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A', color: '#3b82f6' },
            ].map((s, i) => (
              <div key={i} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 28 }}>{s.icon}</div>
                {s.value !== '' && <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text1)' }}>{s.value}</div>}
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>{s.label}</div>
                {s.sub && <div style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.sub}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sessions Tab */}
      {tab === 'sessions' && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text1)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>📱 Active Sessions</h2>
          <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 20 }}>Your current login sessions across devices.</p>
          {loading ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Loading...</div> :
            sessions.length === 0 ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>No active sessions found.</div> :
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {sessions.map((s, i) => (
                <div key={i} style={{ background: s.current ? 'rgba(16,185,129,.07)' : 'var(--surface2)', border: `1px solid ${s.current ? 'rgba(16,185,129,.3)' : 'var(--border)'}`, borderRadius: 14, padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 24 }}>{s.deviceIcon || '💻'}</span>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text1)' }}>{s.device || 'Unknown Device'}</span>
                          {s.current && <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 100, background: 'rgba(16,185,129,.2)', color: '#34d399', letterSpacing: '.04em' }}>✓ CURRENT</span>}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text3)' }}>{s.browser || 'Browser'} · {s.ip || '—'}</div>
                      </div>
                    </div>
                    {s.loginAt && <div style={{ fontSize: 11, color: 'var(--text3)' }}>🕐 Logged in: {new Date(s.loginAt).toLocaleString('en-IN', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}</div>}
                    {s.expiresAt && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>⏳ Expires: {new Date(s.expiresAt).toLocaleString('en-IN', { day:'numeric', month:'short', year:'numeric' })}</div>}
                  </div>
                  {!s.current && (
                    <button onClick={() => {}}
                      style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: 'rgba(239,68,68,.12)', color: '#f87171', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                      Revoke
                    </button>
                  )}
                </div>
              ))}
            </div>
          }
        </div>
      )}


      {/* Subscriptions Tab */}
      {tab === 'subscriptions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text1)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>👑 Subscription</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16, background: viewStatus?.isPremium ? 'rgba(124,58,237,.1)' : 'rgba(245,158,11,.08)', border: `1px solid ${viewStatus?.isPremium ? 'rgba(124,58,237,.3)' : 'rgba(245,158,11,.25)'}`, borderRadius: 14, marginBottom: 20 }}>
              <div style={{ fontSize: 32 }}>{viewStatus?.isPremium ? '👑' : '🔒'}</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: viewStatus?.isPremium ? '#a78bfa' : '#f59e0b' }}>{viewStatus?.isPremium ? 'Premium Active' : 'Free Plan'}</div>
                {viewStatus?.isPremium && viewStatus.expiresAt && (
                  <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>Expires: {new Date(viewStatus.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                )}
                {!viewStatus?.isPremium && <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>Upgrade for unlimited access</div>}
              </div>
            </div>
            {!viewStatus?.isPremium && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
                {(plans ? Object.values(plans) : [{ id: 'basic', label: 'Basic', price: 100, days: 14, icon: '⚡' }, { id: 'plus', label: 'Plus', price: 300, days: 60, icon: '🚀', popular: true }, { id: 'pro', label: 'Pro', price: 599, days: 1095, icon: '👑' }]).map(p => (
                  <a key={p.id} href="/premium"
                    style={{ display: 'block', padding: '14px 8px', borderRadius: 14, border: p.popular ? '1px solid var(--accent)' : '1px solid var(--border)', background: p.popular ? 'var(--accent-s)' : 'var(--surface2)', textAlign: 'center', textDecoration: 'none', transition: 'transform .2s' }}
                    onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseOut={e => e.currentTarget.style.transform = 'none'}>
                    <div style={{ fontSize: 22 }}>{p.icon}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', margin: '4px 0 2px' }}>{p.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text1)' }}>₹{p.price}</div>
                    <div style={{ fontSize: 10, color: 'var(--text3)' }}>{p.days} days</div>
                  </a>
                ))}
              </div>
            )}
            <a href="/premium"
              style={{ display: 'block', padding: '12px', borderRadius: 12, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', fontWeight: 800, fontSize: 14, textDecoration: 'none', textAlign: 'center' }}>
              {viewStatus?.isPremium ? 'Extend Plan →' : '👑 Upgrade to Premium →'}
            </a>
          </div>
        </div>
      )}

      {/* Transactions Tab */}
      {tab === 'transactions' && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text1)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>💳 Transactions</h2>
          {loading ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Loading...</div> :
            transactions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>💳</div>
                <div style={{ color: 'var(--text3)', fontSize: 14 }}>No transactions yet</div>
                <a href="/premium" style={{ display: 'inline-block', marginTop: 12, padding: '10px 22px', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', borderRadius: 10, textDecoration: 'none', fontWeight: 700, fontSize: 13 }}>Get Premium</a>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {transactions.map((t, i) => (
                  <div key={i} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text1)', marginBottom: 2 }}>UTR: {t.utr}</div>
                      <div style={{ fontSize: 12, color: 'var(--text3)' }}>{t.plan} · ₹{t.amount}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{t.submittedAt ? new Date(t.submittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 100, textTransform: 'uppercase', letterSpacing: '.05em', background: t.status === 'approved' ? 'rgba(16,185,129,.15)' : t.status === 'rejected' ? 'rgba(239,68,68,.15)' : 'rgba(245,158,11,.15)', color: t.status === 'approved' ? '#34d399' : t.status === 'rejected' ? '#f87171' : '#fbbf24' }}>
                      {t.status || 'Pending'}
                    </span>
                  </div>
                ))}
              </div>
            )
          }
        </div>
      )}
    </main>
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
function VideoCard({ id, index, title, hasThumb, isBookmarked, isAdmin, showHash, onPlay, onDownload, onBookmark, onReport, onDelete }) {
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState(false);
  const quality = videoQuality(id);
  const qColor = qualityColor(quality);
  const views = viewCount(id);
  // Use passed title prop, fall back to Video #ID (honest fallback, no fake wordplay)
  const displayTitle = title || `Video #${id}`;

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
          <p className={styles.vtitle}>{displayTitle}</p>
          {/* Only show DesiHawas brand + hash for admin/advisor */}
          {showHash && (
            <p className={styles.vsub}>
              DesiHawas
              <span style={{ color: 'rgba(255,255,255,.3)', marginLeft: 6 }}>#{id}</span>
            </p>
          )}
        </div>
      </div>

      {/* Action buttons row */}
      <div className={styles.vactions}>
        <ActionBtn icon="🔖" label="Save" active={isBookmarked} activeColor="#f59e0b" onClick={(e) => onBookmark(e)} />
        {onDownload && <ActionBtn icon="⬇" label="Download" color="#10b981" onClick={(e) => onDownload(e)} />}
        <ActionBtn icon="↗" label="Share" color="#3b82f6" onClick={async (e) => {
          e.stopPropagation();
          try {
            const res = await fetch(`/api/hwasi/share/${id}`);
            const d = await res.json();
            const shareUrl = `${window.location.origin}/watch?v=${encodeURIComponent(d.token || '')}`;
            if (navigator.share) navigator.share({ title: videoTitle(id), url: shareUrl });
            else { navigator.clipboard?.writeText(shareUrl); }
          } catch(err) {}
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
  const start = Math.max(0, Math.min(page - 2, total - 5));
  const pages = Array.from({ length: Math.min(5, total) }, (_, i) => start + i);
  return (
    <div className={styles.pagination}>
      <button className={styles.pgBtn} onClick={() => onPage(0)} disabled={page === 0}>«</button>
      <button className={styles.pgBtn} onClick={() => onPage(page - 1)} disabled={page === 0}>‹</button>
      {pages.map(p => (
        <button key={p} onClick={() => onPage(p)}
          className={`${styles.pgBtn} ${p === page ? styles.pgActive : ''}`}>{p + 1}</button>
      ))}
      <button className={styles.pgBtn} onClick={() => onPage(page + 1)} disabled={page === total - 1}>›</button>
      <button className={styles.pgBtn} onClick={() => onPage(total - 1)} disabled={page === total - 1}>»</button>
    </div>
  );
}
