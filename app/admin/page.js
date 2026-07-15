'use client';
import { useState, useEffect } from 'react';
import styles from './admin.module.css';

const NAV = [
  { id: 'dashboard',     icon: IconDash,    label: 'Dashboard'      },
  { id: 'curated',       icon: IconCurated, label: 'Curated'        },
  { id: 'thumbnails',    icon: IconThumb,   label: 'Thumbnails'     },
  { id: 'users',         icon: IconUsers,   label: 'Users'          },
  { id: 'subscriptions', icon: IconPremium, label: 'Subscriptions'  },
  { id: 'analytics',     icon: IconChart,   label: 'Analytics'      },
  { id: 'settings',      icon: IconSettings,label: 'Settings'       },
];

export default function AdminPage() {
  const [user, setUser]   = useState(null);
  const [tab, setTab]     = useState('dashboard');
  const [collapsed, setCollapsed] = useState(false);

  // Data
  const [settings,  setSettings]  = useState({ start: 51, end: 730, cdnId: 'desimms' });
  const [curated,   setCurated]   = useState({ trending: [], latest: [] });
  const [users,     setUsers]     = useState([]);
  const [history,   setHistory]   = useState([]);

  // UI states
  const [msg,         setMsg]         = useState({ text: '', type: '' });
  const [savingSet,   setSavingSet]   = useState(false);
  const [newUser,     setNewUser]     = useState({ username:'', password:'', displayName:'', role:'viewer' });
  const [editUser,    setEditUser]    = useState(null);
  const [curInput,    setCurInput]    = useState({ trending:'', latest:'' });
  const [histFilter,  setHistFilter]  = useState('');

  // Thumbnail generator state
  const [thumbCount,   setThumbCount]   = useState(0);
  const [allThumbIds,  setAllThumbIds]  = useState(new Set());  // IDs that have thumbnails
  const [genRunning,   setGenRunning]   = useState(false);
  const [genProgress,  setGenProgress]  = useState(0);
  const [genTotal,     setGenTotal]     = useState(0);
  const [genStatus,    setGenStatus]    = useState('');
  const [captureAt,    setCaptureAt]    = useState(1.5);
  const [regenIds,     setRegenIds]     = useState('');
  const [showThumbGrid, setShowThumbGrid] = useState(false);
  const genStopRef = { current: false };
  const [showPass,    setShowPass]    = useState(false);

  // Subscription state
  const [premiumUsers, setPremiumUsers] = useState([]);
  const [grantForm,    setGrantForm]    = useState({ userId: '', plan: 'basic', days: '' });

  useEffect(() => {
    async function init() {
      const r = await fetch('/api/verify');
      const d = await r.json();
      if (!d.auth || d.role !== 'admin') { window.location.href = '/gallery'; return; }
      setUser(d);
      loadAll();
    }
    init();
  }, []);

  async function loadAll() {
    const [s, c, u, h, t, p] = await Promise.all([
      fetch('/api/hwasi/settings').then(x=>x.json()),
      fetch('/api/hwasi/curated').then(x=>x.json()),
      fetch('/api/hwasi/users').then(x=>x.json()),
      fetch('/api/hwasi/history').then(x=>x.json()),
      fetch('/api/hwasi/thumbnails').then(x=>x.json()),
      fetch('/api/hwasi/premium').then(x=>x.json()).catch(()=>({})),
    ]);
    if (!s.error) setSettings(s);
    if (!c.error) setCurated(c);
    setUsers(Array.isArray(u) ? u : []);
    setHistory(Array.isArray(h) ? h : []);
    const ids = (t.ids || []).map(Number);
    setThumbCount(ids.length);
    setAllThumbIds(new Set(ids));
    if (p.users) setPremiumUsers(p.users);
  }

  function flash(text, type='ok') { setMsg({ text, type }); setTimeout(() => setMsg({ text:'', type:'' }), 3500); }

  async function saveSettings() {
    setSavingSet(true);
    const r = await fetch('/api/hwasi/settings', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(settings) });
    const d = await r.json();
    setSavingSet(false);
    if (r.ok) flash(`✅ Range saved — viewers see #${d.start}–#${d.end}`);
    else flash('❌ ' + d.error, 'err');
  }

  async function saveCurated(type) {
    const ids = curInput[type].split(',').map(s=>s.trim()).filter(s=>/^\d+$/.test(s)).map(Number);
    if (!ids.length) { flash('❌ Enter valid video IDs (e.g. 51, 72, 88)', 'err'); return; }
    const existing = curated[type] || [];
    const merged = [...new Set([...existing, ...ids])];
    const r = await fetch('/api/hwasi/curated', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({...curated, [type]: merged}) });
    const d = await r.json();
    if (r.ok) { setCurated(d); setCurInput(p=>({...p,[type]:''})); flash(`✅ ${type} updated — ${merged.length} videos`); }
    else flash('❌ ' + d.error, 'err');
  }

  async function removeCurated(type, id) {
    const updated = {...curated, [type]: (curated[type]||[]).filter(x=>+x!==+id)};
    const r = await fetch('/api/hwasi/curated', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(updated) });
    if (r.ok) { const d=await r.json(); setCurated(d); }
  }

  async function clearCurated(type) {
    const updated = {...curated, [type]: []};
    const r = await fetch('/api/hwasi/curated', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(updated) });
    if (r.ok) { const d=await r.json(); setCurated(d); flash(`🗑 ${type} cleared`); }
  }

  async function pickRandom50(type) {
    // Fetch current settings for range, then pick 50 random IDs
    const s = await fetch('/api/hwasi/settings').then(x=>x.json()).catch(()=>({start:51,end:730}));
    const start = s.start || 51;
    const end   = s.end   || 730;
    const all   = Array.from({length: end - start + 1}, (_, i) => i + start);
    // Fisher-Yates shuffle, take 50
    const shuffled = [...all];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const picked = shuffled.slice(0, 50);
    const r = await fetch('/api/hwasi/curated', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({...curated, [type]: picked}) });
    const d = await r.json();
    if (r.ok) { setCurated(d); flash(`🎲 ${type}: 50 random videos picked!`); }
    else flash('❌ '+d.error, 'err');
  }

  async function createUser() {
    if (!newUser.username||!newUser.password||!newUser.displayName) { flash('❌ All fields required','err'); return; }
    const r = await fetch('/api/hwasi/users', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(newUser) });
    const d = await r.json();
    if (r.ok) { setUsers(p=>[...p,d]); setNewUser({username:'',password:'',displayName:'',role:'viewer'}); flash(`✅ User "${d.username}" created!`); }
    else flash('❌ '+d.error,'err');
  }

  async function deleteUser(id, username) {
    if (!confirm(`Delete user "${username}"?`)) return;
    const r = await fetch('/api/hwasi/users/'+id, { method:'DELETE' });
    if (r.ok) { setUsers(p=>p.filter(u=>u.id!==id)); flash(`🗑 User "${username}" deleted`); }
    else { const d=await r.json(); flash('❌ '+d.error,'err'); }
  }

  async function saveEditUser() {
    if (!editUser.password) delete editUser.password; // keep old if blank
    const r = await fetch('/api/hwasi/users/'+editUser.id, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(editUser) });
    const d = await r.json();
    if (r.ok) { setUsers(p=>p.map(u=>u.id===d.id?d:u)); setEditUser(null); flash('✅ User updated!'); }
    else flash('❌ '+d.error,'err');
  }

  // ── Thumbnail generator (Blob URL trick — no CORS taint!) ──────────────────
  async function runGenerator(start, end, specificIds = null) {
    genStopRef.current = false;

    // 1. Test connectivity first
    setGenStatus('Testing connection…');
    setGenRunning(true);
    const testR = await fetch('/api/hwasi/thumbnails').catch(() => null);
    if (!testR || !testR.ok) {
      setGenRunning(false);
      setGenStatus('❌ Redis connection failed!');
      flash('❌ Redis unreachable — check your Secrets in Cloudflare Pages settings', 'err');
      return;
    }

    const ids = specificIds ? specificIds : Array.from({ length: end - start + 1 }, (_, i) => i + start);
    setGenTotal(ids.length);
    setGenProgress(0);
    let saved = 0;
    let done  = 0;
    const CONCURRENT = 3;

    async function captureViaServerBlob(id) {
      // PUT /api/hwasi/thumbnail/[id] fetches the video SERVER-SIDE from CDN (no CORS issue),
      // returns the first 512KB as raw bytes. We turn that into a same-origin blob URL
      // so canvas.toDataURL() works without any CORS taint.
      let blobUrl = null;
      try {
        const resp = await fetch(`/api/hwasi/thumbnail/${id}`, { method: 'PUT' });
        if (!resp.ok) return null;
        const blob = await resp.blob();
        if (!blob || blob.size < 1000) return null;
        blobUrl = URL.createObjectURL(new Blob([blob], { type: 'video/mp4' }));
      } catch { return null; }

      return await new Promise((resolve) => {
        const vid = document.createElement('video');
        vid.muted = true; vid.playsInline = true; vid.preload = 'metadata';
        // No crossOrigin needed — blob URLs are same-origin, canvas capture is safe ✅
        let settled = false;

        const cleanup = () => {
          vid.src = '';
          vid.load();
          if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = null; }
        };

        const capture = () => {
          try {
            const canvas = document.createElement('canvas');
            const vw = vid.videoWidth  || 320;
            const vh = vid.videoHeight || 180;
            canvas.width  = 320;
            canvas.height = 180;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#0a0010';
            ctx.fillRect(0, 0, 320, 180);
            const scale = Math.min(320 / vw, 180 / vh);
            const drawW = Math.round(vw * scale);
            const drawH = Math.round(vh * scale);
            const ox    = Math.round((320 - drawW) / 2);
            const oy    = Math.round((180 - drawH) / 2);
            ctx.drawImage(vid, ox, oy, drawW, drawH);
            resolve(canvas.toDataURL('image/jpeg', 0.75));
          } catch { resolve(null); }
          finally { cleanup(); }
        };

        const finish = (ok) => {
          if (settled) return; settled = true;
          if (ok) capture(); else { cleanup(); resolve(null); }
        };

        vid.addEventListener('loadedmetadata', () => {
          // Seek to admin-configured captureAt time
          const seekTo = Math.min(captureAt, vid.duration || captureAt);
          vid.currentTime = isFinite(seekTo) && seekTo >= 0 ? seekTo : 0.5;
        }, { once: true });
        vid.addEventListener('seeked',  () => finish(true),  { once: true });
        vid.addEventListener('error',   () => finish(false), { once: true });
        // The 512KB partial blob may not have the full moov atom for long videos —
        // fall back to frame 0 if seeking fails
        vid.addEventListener('stalled', () => {
          if (!settled) { settled = true; capture(); }
        }, { once: true });
        setTimeout(() => finish(false), 20000); // 20s timeout per video

        vid.src = blobUrl;
        vid.load();
      });
    }


    async function processOne(id) {
      if (genStopRef.current) return;
      setGenStatus(`Generating ${id}… (${saved} saved)`);
      try {
        const dataUrl = await captureViaServerBlob(id);
        if (dataUrl) {
          const saveResp = await fetch(`/api/hwasi/thumbnail/${id}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dataUrl }),
          });
          if (saveResp.ok) { saved++; setThumbCount(c => c + 1); }
        }
      } catch { /* skip */ }
      done++;
      setGenProgress(done);
    }

    for (let i = 0; i < ids.length; i += CONCURRENT) {
      if (genStopRef.current) break;
      await Promise.all(ids.slice(i, i + CONCURRENT).map(id => processOne(id)));
    }

    setGenRunning(false);
    const msg = genStopRef.current ? `Stopped. ${saved} thumbnails saved.` : `✅ Done! ${saved}/${done} thumbnails saved to Redis.`;
    setGenStatus(msg);
    flash(`✅ Generated ${saved} thumbnails!`);
    loadAll();
  }

  async function clearAllThumbs() {
    // Clear all: iterate over all IDs and delete
    const t = await fetch('/api/hwasi/thumbnails').then(x=>x.json());
    const ids = t.ids || [];
    await Promise.all(ids.map(id =>
      fetch(`/api/hwasi/thumbnail/${id}`, { method: 'DELETE' }).catch(()=>{})
    ));
    setThumbCount(0);
    flash('🗑 All thumbnails cleared');
  }

  async function logout() {
    await fetch('/api/logout', { method:'POST' });


    window.location.href = '/login';
  }

  const filteredHistory = history.filter(h =>
    !histFilter || h.username?.includes(histFilter) || String(h.videoId)?.includes(histFilter) || h.displayName?.toLowerCase().includes(histFilter.toLowerCase())
  );

  // Stats for dashboard
  const totalVideos = settings.end - settings.start + 1;
  const totalWatched = history.length;
  const uniqueViewers = new Set(history.map(h=>h.userId)).size;
  const topVideo = history.length ? (() => {
    const counts = {}; history.forEach(h => { counts[h.videoId] = (counts[h.videoId]||0)+1; });
    const top = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
    return top ? `#${top[0]} (${top[1]}x)` : '—';
  })() : '—';

  if (!user) return <div className={styles.loading}><div className={styles.spinner}/></div>;

  return (
    <div className={styles.root}>
      {/* ── Sidebar ── */}
      <aside className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''}`}>
        {/* Logo */}
        <div className={styles.sidebarLogo}>
          <div className={styles.logoIcon}>
            <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
              <path d="M14 2L26 8.5V19.5L14 26L2 19.5V8.5L14 2Z" fill="url(#admg)"/>
              <path d="M10 10l8 4-8 4V10z" fill="white" opacity="0.9"/>
              <defs><linearGradient id="admg" x1="2" y1="2" x2="26" y2="26"><stop offset="0%" stopColor="#7c3aed"/><stop offset="100%" stopColor="#ec4899"/></linearGradient></defs>
            </svg>
          </div>
          {!collapsed && (
            <div>
              <div className={styles.logoTitle}>Hwasimulga</div>
              <div className={styles.logoSub}>ADMIN</div>
            </div>
          )}
        </div>

        {/* Section label */}
        {!collapsed && <div className={styles.navSection}>NAVIGATION</div>}

        {/* Nav items */}
        {NAV.map(({ id, icon: Icon, label }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`${styles.navItem} ${tab===id ? styles.navItemActive : ''}`}
            title={collapsed ? label : undefined}>
            <span className={styles.navIcon}><Icon /></span>
            {!collapsed && <span className={styles.navLabel}>{label}</span>}
            {!collapsed && tab===id && <div className={styles.navIndicator}/>}
          </button>
        ))}

        {!collapsed && <div className={styles.navSection} style={{marginTop:16}}>QUICK ACTIONS</div>}
        <a href="/gallery" className={`${styles.navItem} ${styles.navGallery}`} title={collapsed?'Gallery':undefined}>
          <span className={styles.navIcon}><IconGallery/></span>
          {!collapsed && <span className={styles.navLabel}>Gallery</span>}
        </a>

        {/* User at bottom */}
        <div className={styles.sidebarUser}>
          <div className={styles.sidebarAvatar}>{user.avatar||'AD'}</div>
          {!collapsed && (
            <div className={styles.sidebarUserInfo}>
              <div className={styles.sidebarUserName}>{user.displayName||user.username}</div>
              <div className={styles.sidebarUserRole}>Administrator</div>
            </div>
          )}
          {!collapsed && (
            <button className={styles.logoutBtn} onClick={logout} title="Sign out">
              <IconLogout/>
            </button>
          )}
        </div>

        {/* Collapse toggle */}
        <button className={styles.collapseBtn} onClick={() => setCollapsed(c=>!c)} title={collapsed?'Expand':'Collapse'}>
          {collapsed ? '›' : '‹ Collapse'}
        </button>
      </aside>

      {/* ── Main ── */}
      <div className={styles.main}>
        {/* Top bar */}
        <header className={styles.topbar}>
          <div>
            <h1 className={styles.pageTitle}>{NAV.find(n=>n.id===tab)?.label || tab}</h1>
            <p className={styles.pageSub}>{
              tab==='dashboard' ? 'Overview of your Hwasimulga platform' :
              tab==='curated'   ? 'Manage Trending and Latest video sections' :
              tab==='users'     ? 'Create and manage viewer accounts' :
              tab==='analytics' ? 'See who watched which videos' :
              'Configure video range and CDN source'
            }</p>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            {msg.text && (
              <div className={`${styles.flashMsg} ${msg.type==='err' ? styles.flashErr : styles.flashOk}`}>
                {msg.text}
              </div>
            )}
          </div>
        </header>

        <div className={styles.content}>

          {/* ══ DASHBOARD ══ */}
          {tab==='dashboard' && (
            <div className={styles.fadeIn}>
              <div className={styles.statsGrid}>
                <StatCard icon="🎬" label="Total Videos" value={totalVideos.toLocaleString()} sub={`#${settings.start}–#${settings.end}`} color="purple"/>
                <StatCard icon="👁" label="Total Watches" value={totalWatched.toLocaleString()} sub="all time" color="pink"/>
                <StatCard icon="👥" label="Active Viewers" value={uniqueViewers} sub="unique users" color="blue"/>
                <StatCard icon="🏆" label="Top Video" value={topVideo} sub="most watched" color="green"/>
              </div>
              <div className={styles.dashRow}>
                {/* Recent watches */}
                <div className={styles.dashCard} style={{flex:2}}>
                  <div className={styles.dashCardHeader}>
                    <span className={styles.dashCardTitle}>Recent Activity</span>
                    <button className="btn btn-ghost btn-sm" onClick={()=>setTab('analytics')}>View all</button>
                  </div>
                  {history.length===0 ? (
                    <div className={styles.emptyState}>No watch activity yet</div>
                  ) : (
                    <div className={styles.actList}>
                      {history.slice(0,8).map((h,i)=>(
                        <div key={i} className={styles.actRow}>
                          <div className={styles.actAvatar}>{h.displayName?.slice(0,2)||h.username?.slice(0,2)||'??'}</div>
                          <div className={styles.actInfo}>
                            <span className={styles.actName}>{h.displayName||h.username}</span>
                            <span className={styles.actMeta}>watched <strong style={{color:'var(--accent2)'}}>#{h.videoId}</strong></span>
                          </div>
                          <span className={styles.actTime}>{timeAgo(h.watchedAt)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* Users summary */}
                <div className={styles.dashCard} style={{flex:1}}>
                  <div className={styles.dashCardHeader}>
                    <span className={styles.dashCardTitle}>Users ({users.length})</span>
                    <button className="btn btn-ghost btn-sm" onClick={()=>setTab('users')}>Manage</button>
                  </div>
                  <div className={styles.usersMini}>
                    {users.map(u=>(
                      <div key={u.id} className={styles.userMiniRow}>
                        <div className={styles.userMiniAvatar} style={{background:u.role==='admin'?'linear-gradient(135deg,#7c3aed,#9333ea)':'linear-gradient(135deg,#0f766e,#0d9488)'}}>
                          {u.avatar||u.displayName?.slice(0,2)||'??'}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div className={styles.userMiniName}>{u.displayName}</div>
                          <div className={styles.userMiniRole}>@{u.username}</div>
                        </div>
                        <span className={`${styles.rolePill} ${u.role==='admin'?styles.roleAdmin:styles.roleViewer}`}>{u.role}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ CURATED ══ */}
          {tab==='curated' && (
            <div className={styles.fadeIn}>
              {['trending','latest'].map(type=>(
                <div key={type} className={styles.card} style={{marginBottom:20}}>
                  <div className={styles.cardHeader}>
                    <span style={{fontSize:24}}>{type==='trending'?'🔥':'✨'}</span>
                    <div style={{flex:1}}>
                      <h3 className={styles.cardTitle}>{type==='trending'?'Trending':'Latest'}</h3>
                      <p className={styles.cardSub}>{(curated[type]||[]).length} videos in this section</p>
                    </div>
                    {/* Quick action buttons */}
                    <div style={{display:'flex',gap:8,flexShrink:0,flexWrap:'wrap'}}>
                      <button className={styles.randomBtn} onClick={()=>pickRandom50(type)} title="Replace with 50 random videos from current range">
                        🎲 Random 50
                      </button>
                      {(curated[type]||[]).length > 0 && (
                        <button className={styles.clearBtn} onClick={()=>{if(confirm(`Clear all ${type} videos?`))clearCurated(type)}} title="Clear all">
                          🗑 Clear
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Chips */}
                  <div className={styles.chipRow}>
                    {(curated[type]||[]).length===0 && <span className={styles.emptyHint}>No videos added yet — use Random 50 or enter IDs below</span>}
                    {(curated[type]||[]).map(id=>(
                      <div key={id} className={styles.chip}>
                        <span>#{id}</span>
                        <button className={styles.chipRemove} onClick={()=>removeCurated(type,id)}>×</button>
                      </div>
                    ))}
                  </div>
                  {/* Manual add */}
                  <div style={{display:'flex',gap:10,marginTop:14,flexWrap:'wrap'}}>
                    <input className="input" style={{flex:1,minWidth:180}} placeholder="Add video IDs: 51, 72, 88…"
                      value={curInput[type]} onChange={e=>setCurInput(p=>({...p,[type]:e.target.value}))}
                      onKeyDown={e=>e.key==='Enter'&&saveCurated(type)}/>
                    <button className="btn btn-primary" onClick={()=>saveCurated(type)}>Add Videos</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ══ THUMBNAILS ══ */}
          {tab==='thumbnails' && (
            <div className={styles.fadeIn}>
              <div className={styles.card} style={{marginBottom:20}}>
                <div className={styles.cardHeader}>
                  <span style={{fontSize:24}}>🖼</span>
                  <div style={{flex:1}}>
                    <h3 className={styles.cardTitle}>Thumbnail Generator</h3>
                    <p className={styles.cardSub}>
                      {thumbCount}/{settings.end - settings.start + 1} thumbnails generated
                      {thumbCount > 0 && ` · ~${Math.round(thumbCount * 15 / 1024)}MB in Redis`}
                    </p>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={loadAll}>↻ Refresh</button>
                </div>

                {/* Info box */}
                <div className={styles.infoBox}>
                  <strong>How this works:</strong> Click "Generate All" — your browser loads each video, captures frame at 0.5s, compresses to a tiny JPEG (~10-20KB), and stores it in Upstash Redis. After generation, all viewers see instant image thumbnails with <strong>zero video loading</strong> — works fast even on mobile!
                </div>

                {/* Progress bar */}
                {genTotal > 0 && (
                  <div style={{margin:'16px 0'}}>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'var(--text3)',marginBottom:6}}>
                      <span>{genStatus}</span>
                      <span>{genProgress}/{genTotal} ({Math.round(genProgress/genTotal*100)}%)</span>
                    </div>
                    <div style={{height:8,background:'rgba(255,255,255,.06)',borderRadius:4,overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${Math.round(genProgress/genTotal*100)}%`,background:'linear-gradient(90deg,#7c3aed,#ec4899)',borderRadius:4,transition:'width .3s'}} />
                    </div>
                  </div>
                )}

                {/* Buttons */}
                <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:16}}>
                  {!genRunning ? (
                    <>
                      <button className="btn btn-primary" onClick={() => runGenerator(settings.start, settings.end)}>
                        ⚡ Generate All ({settings.end - settings.start + 1} videos)
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => runGenerator(settings.start, Math.min(settings.start + 9, settings.end))}>
                        🧪 Test First 10
                      </button>
                      {thumbCount > 0 && (
                        <button className="btn btn-ghost btn-sm" style={{color:'#f87171'}}
                          onClick={() => { if(confirm('Clear ALL stored thumbnails?')) clearAllThumbs(); }}>
                          🗑 Clear All Thumbnails
                        </button>
                      )}
                    </>
                  ) : (
                    <button className="btn btn-ghost" onClick={() => { genStopRef.current = true; setGenRunning(false); setGenStatus('Stopped by user'); }}>
                      ⏹ Stop Generation
                    </button>
                  )}
                </div>

                {/* Specific ID regen + timer */}
                <div className={styles.card} style={{marginTop:20}}>
                  <h4 className={styles.cardTitle} style={{marginBottom:14}}>Advanced Options</h4>

                  {/* Capture timestamp */}
                  <div style={{marginBottom:20}}>
                    <label className={styles.fieldLabel}>
                      Capture Timestamp: <strong>{captureAt}s</strong>
                    </label>
                    <div style={{display:'flex',gap:10,alignItems:'center',marginTop:8,flexWrap:'wrap'}}>
                      <input type="range" min="0" max="30" step="0.5"
                        value={captureAt} onChange={e => setCaptureAt(Number(e.target.value))}
                        style={{flex:1,minWidth:160,accentColor:'#7c3aed'}}/>
                      <input type="number" min="0" max="60" step="0.5"
                        value={captureAt} onChange={e => setCaptureAt(Number(e.target.value))}
                        className="input" style={{width:80}}/>
                      <span style={{fontSize:12,color:'var(--text3)'}}>seconds</span>
                    </div>
                    <div style={{display:'flex',gap:8,marginTop:10,flexWrap:'wrap'}}>
                      {[0.5, 1, 2, 3, 5, 10].map(t => (
                        <button key={t} className="btn btn-ghost btn-sm"
                          style={captureAt===t?{borderColor:'#7c3aed',color:'#a78bfa'}:{}}
                          onClick={() => setCaptureAt(t)}>{t}s</button>
                      ))}
                    </div>
                  </div>

                  {/* Specific IDs regen */}
                  <label className={styles.fieldLabel}>Re-generate Specific Video IDs</label>
                  <p style={{fontSize:12,color:'var(--text3)',margin:'4px 0 10px'}}>Enter comma-separated IDs (e.g. 72, 130, 245) to re-capture only those thumbnails</p>
                  <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
                    <input className="input" style={{flex:1,minWidth:180}}
                      placeholder="e.g. 72, 130, 245, 388"
                      value={regenIds} onChange={e => setRegenIds(e.target.value)}
                      disabled={genRunning}/>
                    <button className="btn btn-primary"
                      disabled={genRunning || !regenIds.trim()}
                      onClick={() => {
                        const ids = regenIds.split(',').map(s=>s.trim()).filter(s=>/^\d+$/.test(s)).map(Number);
                        if (!ids.length) { flash('❌ Enter valid IDs', 'err'); return; }
                        const min = Math.min(...ids);
                        const max = Math.max(...ids);
                        runGenerator(min, max, ids);
                      }}>⚡ Regen Selected</button>
                  </div>
                </div>
              </div>

              {/* ── Thumbnail Review Grid ─────────────────────────────── */}
              <div className={styles.card} style={{marginTop:20}}>
                <div className={styles.cardHeader}>
                  <span style={{fontSize:22}}>🔍</span>
                  <div>
                    <h3 className={styles.cardTitle}>Thumbnail Review</h3>
                    <p className={styles.cardSub}>See all videos — ID overlaid so you can spot black thumbnails</p>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowThumbGrid(g => !g)}>
                    {showThumbGrid ? '▲ Hide' : '▼ Show Grid'}
                  </button>
                </div>
                {showThumbGrid && (
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))',gap:8,marginTop:12}}>
                    {Array.from({ length: Math.max(0, settings.end - settings.start + 1) }, (_, i) => i + settings.start).map(id => (
                      <div key={id} style={{position:'relative',borderRadius:8,overflow:'hidden',background:'#0a0010',
                        border: allThumbIds.has(id) ? '1px solid rgba(124,58,237,.3)' : '1px solid rgba(239,68,68,.3)',
                        cursor:'pointer'}} onClick={() => setRegenIds(String(id))}>
                        {allThumbIds.has(id) ? (
                          <img src={`/api/hwasi/thumbnail/${id}`}
                            style={{width:'100%',aspectRatio:'16/9',objectFit:'cover',display:'block'}}
                            loading="lazy" alt={`#${id}`}
                            onError={e => { e.target.style.display='none'; }}/>
                        ) : (
                          <div style={{width:'100%',aspectRatio:'16/9',display:'flex',alignItems:'center',justifyContent:'center',
                            background:'rgba(239,68,68,.1)',fontSize:18}}>❌</div>
                        )}
                        {/* Video ID overlay */}
                        <div style={{position:'absolute',bottom:0,left:0,right:0,
                          background:'linear-gradient(transparent,rgba(0,0,0,.85))',
                          padding:'12px 4px 4px',textAlign:'center',
                          fontSize:11,fontWeight:700,color:allThumbIds.has(id)?'#a78bfa':'#f87171'}}>
                          #{id}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {showThumbGrid && (
                  <p style={{fontSize:11,color:'var(--text3)',marginTop:10,textAlign:'center'}}>
                    Click any thumbnail to prefill its ID in the "Re-generate" field above
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ══ SUBSCRIPTIONS ══ */}
          {tab==='subscriptions' && (
            <div className={styles.fadeIn}>
              {/* Grant subscription */}
              <div className={styles.card} style={{marginBottom:20}}>
                <div className={styles.cardHeader}>
                  <span style={{fontSize:22}}>✨</span>
                  <div><h3 className={styles.cardTitle}>Grant Subscription</h3><p className={styles.cardSub}>Manually activate premium for a user after payment</p></div>
                </div>
                <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'flex-end'}}>
                  <div style={{flex:1,minWidth:160}}>
                    <label className={styles.fieldLabel}>User</label>
                    <select className="input" value={grantForm.userId} onChange={e=>setGrantForm(p=>({...p,userId:e.target.value}))}>
                      <option value="">Select user...</option>
                      {users.map(u=><option key={u.id} value={u.id}>{u.displayName} ({u.username})</option>)}
                    </select>
                  </div>
                  <div style={{minWidth:130}}>
                    <label className={styles.fieldLabel}>Plan</label>
                    <select className="input" value={grantForm.plan} onChange={e=>setGrantForm(p=>({...p,plan:e.target.value}))}>
                      <option value="basic">₹100 — Basic (14 days)</option>
                      <option value="plus">₹300 — Plus (60 days)</option>
                      <option value="pro">₹599 — Pro (3 years)</option>
                    </select>
                  </div>
                  <div style={{minWidth:100}}>
                    <label className={styles.fieldLabel}>Custom Days (opt)</label>
                    <input className="input" type="number" placeholder="auto" value={grantForm.days}
                      onChange={e=>setGrantForm(p=>({...p,days:e.target.value}))}/>
                  </div>
                  <button className="btn btn-primary" disabled={!grantForm.userId} onClick={async () => {
                    const r = await fetch('/api/hwasi/premium', {
                      method:'POST', headers:{'Content-Type':'application/json'},
                      body: JSON.stringify({ userId:grantForm.userId, plan:grantForm.plan, days:grantForm.days ? Number(grantForm.days) : undefined })
                    });
                    if (r.ok) { flash('✅ Premium granted!'); loadAll(); setGrantForm({userId:'',plan:'basic',days:''}); }
                    else flash('❌ Failed to grant', 'err');
                  }}>✨ Grant</button>
                </div>
              </div>

              {/* Users list with premium status */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <span style={{fontSize:22}}>👥</span>
                  <div><h3 className={styles.cardTitle}>All Users</h3><p className={styles.cardSub}>Manage subscription status</p></div>
                </div>
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                    <thead>
                      <tr style={{borderBottom:'1px solid rgba(255,255,255,.08)'}}>
                        {['User','Role','Plan','Expires','Actions'].map(h=>(
                          <th key={h} style={{textAlign:'left',padding:'10px 12px',color:'var(--text3)',fontWeight:600,whiteSpace:'nowrap'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {premiumUsers.map(u => {
                        const planColors = {basic:'#7c3aed',plus:'#0ea5e9',pro:'#f59e0b'};
                        const pc = planColors[u.premium?.plan] || 'transparent';
                        return (
                          <tr key={u.id} style={{borderBottom:'1px solid rgba(255,255,255,.04)'}}>
                            <td style={{padding:'12px'}}>
                              <div style={{fontWeight:600,color:'#f1f5f9'}}>{u.displayName}</div>
                              <div style={{fontSize:11,color:'var(--text3)'}}>@{u.username}</div>
                            </td>
                            <td style={{padding:'12px'}}>
                              <span style={{background:u.role==='admin'?'rgba(236,72,153,.15)':'rgba(255,255,255,.06)',color:u.role==='admin'?'#ec4899':'var(--text2)',padding:'2px 8px',borderRadius:6,fontSize:11,fontWeight:600}}>{u.role}</span>
                            </td>
                            <td style={{padding:'12px'}}>
                              {u.premium ? (
                                <span style={{background:`${pc}22`,color:pc,border:`1px solid ${pc}44`,padding:'3px 10px',borderRadius:999,fontSize:11,fontWeight:700,textTransform:'uppercase'}}>{u.premium.plan}</span>
                              ) : (
                                <span style={{color:'var(--text3)',fontSize:12}}>Free</span>
                              )}
                            </td>
                            <td style={{padding:'12px',fontSize:12,color:'var(--text2)'}}>
                              {u.premium ? new Date(u.premium.expiresAt).toLocaleDateString('en-IN') : '—'}
                            </td>
                            <td style={{padding:'12px'}}>
                              {u.premium && (
                                <button className="btn btn-ghost btn-sm" style={{color:'#f87171'}} onClick={async () => {
                                  await fetch(`/api/hwasi/premium?userId=${u.id}`, {method:'DELETE'});
                                  flash('🗑 Subscription revoked'); loadAll();
                                }}>Revoke</button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══ USERS ══ */}
          {tab==='users' && (

            <div className={styles.fadeIn}>
              {/* Create form */}
              <div className={styles.card} style={{marginBottom:20}}>
                <div className={styles.cardHeader}>
                  <span style={{fontSize:22}}>➕</span>
                  <div><h3 className={styles.cardTitle}>Create New User</h3><p className={styles.cardSub}>Add a new viewer or admin account</p></div>
                </div>
                <div className={styles.createGrid}>
                  <div>
                    <label className={styles.fieldLabel}>Display Name</label>
                    <input className="input" placeholder="e.g. John Doe" value={newUser.displayName} onChange={e=>setNewUser(p=>({...p,displayName:e.target.value}))}/>
                  </div>
                  <div>
                    <label className={styles.fieldLabel}>Username</label>
                    <input className="input" placeholder="e.g. johndoe" value={newUser.username} onChange={e=>setNewUser(p=>({...p,username:e.target.value}))}/>
                  </div>
                  <div>
                    <label className={styles.fieldLabel}>Password</label>
                    <input className="input" type="password" placeholder="Strong password" value={newUser.password} onChange={e=>setNewUser(p=>({...p,password:e.target.value}))}/>
                  </div>
                  <div>
                    <label className={styles.fieldLabel}>Role</label>
                    <select className="input" value={newUser.role} onChange={e=>setNewUser(p=>({...p,role:e.target.value}))}>
                      <option value="viewer">Viewer</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
                <button className="btn btn-primary" style={{marginTop:14}} onClick={createUser}>Create User</button>
              </div>

              {/* Users grid — EMS style cards */}
              <div className={styles.usersGrid}>
                {users.map(u=>(
                  <div key={u.id} className={styles.userCard}>
                    <div className={styles.userCardTop}>
                      <div className={styles.userCardAvatar} style={{background:u.role==='admin'?'linear-gradient(135deg,#7c3aed,#ec4899)':'linear-gradient(135deg,#0f766e,#0d9488)'}}>
                        {u.avatar||u.displayName?.slice(0,2)||'??'}
                      </div>
                      <div className={`${styles.statusDot} ${styles.statusActive}`}>● active</div>
                    </div>
                    <div className={styles.userCardName}>{u.displayName}</div>
                    <div className={styles.userCardEmail}>@{u.username}</div>
                    <div className={`${styles.userCardRole} ${u.role==='admin'?styles.roleAdmin:styles.roleViewer}`}>{u.role==='admin'?'Administrator':'Viewer'}</div>
                    <div className={styles.userCardJoined}>Joined {new Date(u.createdAt).toLocaleDateString()}</div>
                    <div className={styles.userCardActions}>
                      <button className="btn btn-ghost btn-sm" style={{flex:1}} onClick={()=>setEditUser({...u,password:''})}>
                        <IconEdit/> Edit
                      </button>
                      <button className="btn btn-ghost btn-sm" style={{flex:1,color:'#f87171'}} onClick={()=>deleteUser(u.id,u.username)}>
                        <IconTrash/> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══ ANALYTICS ══ */}
          {tab==='analytics' && (
            <div className={styles.fadeIn}>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <span style={{fontSize:22}}>📊</span>
                  <div><h3 className={styles.cardTitle}>Watch Analytics</h3><p className={styles.cardSub}>{filteredHistory.length} entries</p></div>
                  <div style={{marginLeft:'auto'}}>
                    <input className="input" style={{width:240}} placeholder="Filter by user or video ID…"
                      value={histFilter} onChange={e=>setHistFilter(e.target.value)}/>
                  </div>
                </div>
                <div className={styles.table}>
                  <div className={styles.tableHead}>
                    <span>User</span><span>Video</span><span>Watched At</span>
                  </div>
                  {filteredHistory.length===0 && <div className={styles.emptyState}>No watch history yet.</div>}
                  {filteredHistory.slice(0,200).map((h,i)=>(
                    <div key={i} className={styles.tableRow}>
                      <div className={styles.tableUser}>
                        <div className={styles.tableAvatar}>{h.displayName?.slice(0,2)||h.username?.slice(0,2)||'??'}</div>
                        <div>
                          <div className={styles.tableName}>{h.displayName||h.username}</div>
                          <div className={styles.tableSub}>@{h.username}</div>
                        </div>
                      </div>
                      <div><span className="badge badge-purple">#{h.videoId}</span></div>
                      <div className={styles.tableTime}>{new Date(h.watchedAt).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ══ SETTINGS ══ */}
          {tab==='settings' && (
            <div className={styles.fadeIn}>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <span style={{fontSize:22}}>⚙️</span>
                  <div><h3 className={styles.cardTitle}>Video Range</h3><p className={styles.cardSub}>Control which video IDs are visible to all viewers</p></div>
                </div>
                <div className={styles.settingsRow}>
                  <div style={{flex:1}}>
                    <label className={styles.fieldLabel}>Start ID</label>
                    <input className="input" type="number" min="1" value={settings.start}
                      onChange={e=>setSettings(s=>({...s,start:+e.target.value}))}/>
                  </div>
                  <div className={styles.settingsDash}>—</div>
                  <div style={{flex:1}}>
                    <label className={styles.fieldLabel}>End ID</label>
                    <input className="input" type="number" min="1" value={settings.end}
                      onChange={e=>setSettings(s=>({...s,end:+e.target.value}))}/>
                  </div>
                  <div style={{flex:1}}>
                    <label className={styles.fieldLabel}>Total Videos</label>
                    <div className={styles.totalBox}>{(settings.end-settings.start+1).toLocaleString()} videos</div>
                  </div>
                </div>
                <button className="btn btn-primary" style={{marginTop:16}} onClick={saveSettings} disabled={savingSet}>
                  {savingSet ? 'Saving…' : 'Save Range'}
                </button>
                <div className={styles.infoGrid}>
                  <InfoRow label="Current Range" value={`#${settings.start} – #${settings.end}`}/>
                  <InfoRow label="CDN Source" value={settings.cdnId}/>
                  <InfoRow label="Videos in Range" value={(settings.end-settings.start+1).toLocaleString()}/>
                  <InfoRow label="Missing / Hidden" value="Auto-detected at load time"/>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── Edit User Modal ── */}
      {editUser && (
        <div className={styles.modalOverlay} onClick={e=>{if(e.target===e.currentTarget)setEditUser(null)}}>
          <div className={styles.modalBox}>
            <div className={styles.modalHead}>
              <h3>Edit @{editUser.username}</h3>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={()=>setEditUser(null)}>✕</button>
            </div>
            <div className={styles.editForm}>
              <div><label className={styles.fieldLabel}>Display Name</label>
                <input className="input" value={editUser.displayName} onChange={e=>setEditUser(p=>({...p,displayName:e.target.value}))}/></div>
              <div><label className={styles.fieldLabel}>New Password (blank = keep current)</label>
                <input className="input" type={showPass?'text':'password'} value={editUser.password||''} placeholder="Leave blank to keep…"
                  onChange={e=>setEditUser(p=>({...p,password:e.target.value}))}/></div>
              <div><label className={styles.fieldLabel}>Role</label>
                <select className="input" value={editUser.role} onChange={e=>setEditUser(p=>({...p,role:e.target.value}))}>
                  <option value="viewer">Viewer</option>
                  <option value="admin">Admin</option>
                </select></div>
            </div>
            <div style={{display:'flex',gap:10,marginTop:20}}>
              <button className="btn btn-primary" style={{flex:1}} onClick={saveEditUser}>Save Changes</button>
              <button className="btn btn-ghost" onClick={()=>setEditUser(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(iso) {
  const secs = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return Math.floor(secs/60) + 'm ago';
  if (secs < 86400) return Math.floor(secs/3600) + 'h ago';
  return Math.floor(secs/86400) + 'd ago';
}

function StatCard({ icon, label, value, sub, color }) {
  const colors = { purple:'rgba(124,58,237,.15)', pink:'rgba(236,72,153,.12)', blue:'rgba(59,130,246,.12)', green:'rgba(34,197,94,.1)' };
  const borders = { purple:'rgba(124,58,237,.25)', pink:'rgba(236,72,153,.2)', blue:'rgba(59,130,246,.2)', green:'rgba(34,197,94,.18)' };
  return (
    <div style={{background:colors[color],border:`1px solid ${borders[color]}`,borderRadius:14,padding:'20px 22px',display:'flex',flexDirection:'column',gap:8,transition:'transform .2s,box-shadow .2s'}}
      onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-3px)';e.currentTarget.style.boxShadow='0 12px 40px rgba(0,0,0,.4)'}}
      onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow=''}}>
      <div style={{fontSize:28}}>{icon}</div>
      <div style={{fontSize:28,fontWeight:800,color:'var(--text)',fontFamily:"'Space Grotesk',sans-serif",letterSpacing:'-0.02em'}}>{value}</div>
      <div style={{fontSize:13,fontWeight:600,color:'var(--text2)'}}>{label}</div>
      <div style={{fontSize:11,color:'var(--text3)'}}>{sub}</div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',padding:'11px 16px',borderBottom:'1px solid rgba(255,255,255,.04)',fontSize:13}}>
      <span style={{color:'var(--text3)'}}>{label}</span>
      <strong style={{color:'var(--text2)'}}>{value}</strong>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function IconDash()     { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>; }
function IconCurated()  { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>; }
function IconUsers()    { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }
function IconChart()    { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>; }
function IconSettings() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>; }
function IconGallery()  { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>; }
function IconLogout()   { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>; }
function IconEdit()     { return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>; }
function IconTrash()    { return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>; }
function IconThumb()    { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>; }
function IconPremium()  { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>; }
