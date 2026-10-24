'use client';
import { useState, useEffect } from 'react';
import { secureFetch } from '@/lib/crypto';
import styles from './admin.module.css';

const BOTH = ['admin', 'advisor'];
const NAV = [
  { id: 'dashboard', icon: IconDash, label: 'Dashboard', roles: BOTH },
  { id: 'curated', icon: IconCurated, label: 'Curated', roles: BOTH },
  { id: 'thumbnails', icon: IconThumb, label: 'Thumbnails', roles: ['admin'] },
  { id: 'scraper', icon: IconScraper, label: 'Auto Scraper', roles: ['admin'] },
  { id: 'users', icon: IconUsers, label: 'Users', roles: BOTH },
  { id: 'subscriptions', icon: IconPremium, label: 'Subscriptions', roles: BOTH },
  { id: 'pricing', icon: IconSettings, label: 'Pricing Mgmt', roles: ['admin'] },
  { id: 'tickets', icon: IconTicket, label: 'Support Tickets', roles: BOTH },
  { id: 'devices', icon: IconFlag, label: 'Device Security', roles: BOTH },
  { id: 'reports', icon: IconFlag, label: 'Reports', roles: BOTH },
  { id: 'deleted', icon: IconTrash, label: 'Deleted', roles: BOTH },
  { id: 'analytics', icon: IconChart, label: 'Analytics', roles: BOTH },
  { id: 'settings', icon: IconSettings, label: 'Settings', roles: ['admin'] },
];

export default function AdminPage() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('dashboard');
  const [collapsed, setCollapsed] = useState(false);

  // Data
  const [settings, setSettings] = useState({ start: 51, end: 730, cdnId: 'desimms' });
  const [curated, setCurated] = useState({ trending: [], latest: [] });
  const [users, setUsers] = useState([]);
  const [history, setHistory] = useState([]);

  // UI states
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [savingSet, setSavingSet] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', displayName: '', role: 'viewer' });
  const [editUser, setEditUser] = useState(null);
  const [curInput, setCurInput] = useState({ trending: '', latest: '' });
  const [histFilter, setHistFilter] = useState('');

  // Thumbnail generator state
  const [thumbCount, setThumbCount] = useState(0);
  const [allThumbIds, setAllThumbIds] = useState(new Set());  // IDs that have thumbnails
  const [genRunning, setGenRunning] = useState(false);
  const [genProgress, setGenProgress] = useState(0);
  const [genTotal, setGenTotal] = useState(0);
  const [genStatus, setGenStatus] = useState('');
  const [captureAt, setCaptureAt] = useState(1.5);
  const [regenIds, setRegenIds] = useState('');
  const [showThumbGrid, setShowThumbGrid] = useState(false);
  const [selectedGridIds, setSelectedGridIds] = useState(new Set()); // multi-select in grid

  // Auto Scraper & Manual Add State
  const [scrapeSite, setScrapeSite] = useState('desimms');
  const [scrapePages, setScrapePages] = useState(3);
  const [scrapeDeep, setScrapeDeep] = useState(false);
  const [scrapeScanning, setScrapeScanning] = useState(false);
  const [scrapeResults, setScrapeResults] = useState(null);
  const [scrapeSelected, setScrapeSelected] = useState(new Set());
  const [scrapeImporting, setScrapeImporting] = useState(false);
  const [scrapeProgress, setScrapeProgress] = useState({ current: 0, total: 0, status: '' });
  const [scrapeLogs, setScrapeLogs] = useState([]);

  // Manual Add state
  const [manualSite, setManualSite] = useState('desimms');
  const [manualCdnId, setManualCdnId] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [manualThumbUrl, setManualThumbUrl] = useState('');
  const [manualDataUrl, setManualDataUrl] = useState('');
  const [manualSaving, setManualSaving] = useState(false);
  const genStopRef = { current: false };
  const [showPass, setShowPass] = useState(false);

  // Subscription state
  const [premiumUsers, setPremiumUsers] = useState([]);
  const [grantForm, setGrantForm] = useState({ userId: '', plan: 'basic', days: '' });
  const [subRequests, setSubRequests] = useState([]); // advisor → admin requests

  // Registration approval state (admin only)
  const [regApproval, setRegApproval] = useState(false); // toggle
  const [pendingUsers, setPendingUsers] = useState([]);    // pending registrations

  // Reports + Deleted state (advisor + admin)
  const [reportsList, setReportsList] = useState([]);
  const [deletedList, setDeletedList] = useState([]);
  const [directDelForm, setDirectDelForm] = useState({ id: '', reason: 'duplicate' });
  const [previewVideo, setPreviewVideo] = useState(null);
  const [watchId, setWatchId] = useState('');
  const [videoTitles, setVideoTitles] = useState({});
  const [editTitleModal, setEditTitleModal] = useState(null);
  const [editTitleInput, setEditTitleInput] = useState('');
  const [editTitleSaving, setEditTitleSaving] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [showOnlineModal, setShowOnlineModal] = useState(false);
  const [plansConfig, setPlansConfig] = useState(null);
  const [plansMsg, setPlansMsg] = useState('');
  const [plansSaving, setPlansSaving] = useState(false);
  const [deviceData, setDeviceData] = useState({});
  const [deviceSearch, setDeviceSearch] = useState('');
  const [deviceFilter, setDeviceFilter] = useState('all'); // 'all' | '1' | '2' | '3plus' | '5plus'
  const [blockModal, setBlockModal] = useState(null);
  const [blockReason, setBlockReason] = useState('');
  // ── Auto Scraper & Manual Video Handlers ──────────────────────────────
  async function runScraperScan() {
    setScrapeScanning(true);
    setScrapeResults(null);
    setScrapeSelected(new Set());
    setScrapeLogs(['🔍 Initializing scan for ' + (scrapeSite === 'desimms' ? 'DesiMMS' : 'HindiBF') + '...']);

    const aggregatedVideos = [];
    const seenIds = new Set();
    let totalScanned = 0;
    let totalKnown = 0;

    try {
      for (let p = 1; p <= scrapePages; p++) {
        setScrapeLogs(prev => [...prev, '⏳ Scanning page ' + p + ' of ' + scrapePages + '...']);
        const res = await secureFetch('/api/hwasi/scraper?site=' + scrapeSite + '&page=' + p + '&perPage=10&deep=' + scrapeDeep);
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || 'Failed to scan page ' + p);

        totalScanned += data.scannedPosts || 0;
        totalKnown += data.knownCount || 0;

        let pageNew = 0;
        for (const v of data.newVideos || []) {
          if (!seenIds.has(v.systemId)) {
            seenIds.add(v.systemId);
            aggregatedVideos.push(v);
            pageNew++;
          }
        }

        setScrapeLogs(prev => [
          ...prev,
          '  ✓ Page ' + p + ': Scanned ' + data.scannedPosts + ' posts (' + pageNew + ' new, ' + data.knownCount + ' existing)'
        ]);

        setScrapeResults({
          site: data.site,
          siteName: data.siteName,
          scannedPosts: totalScanned,
          newCount: aggregatedVideos.length,
          knownCount: totalKnown,
          newVideos: [...aggregatedVideos],
        });

        if (aggregatedVideos.length > 0) {
          setScrapeSelected(new Set(aggregatedVideos.map(v => v.systemId)));
        }

        if (data.stopEarly) {
          setScrapeLogs(prev => [...prev, '🛑 Reached known videos on page ' + p + '. Stopping scan early.']);
          break;
        }

        if (!data.hasMore) {
          setScrapeLogs(prev => [...prev, '🏁 Reached end of site posts.']);
          break;
        }
      }

      if (aggregatedVideos.length > 0) {
        flash('🎉 Found ' + aggregatedVideos.length + ' new videos! (Skipped ' + totalKnown + ' existing)');
      } else {
        flash('✅ Everything up to date! Scanned ' + totalScanned + ' posts, 0 new videos.');
      }
    } catch (err) {
      flash('❌ Scrape error: ' + err.message, 'err');
      setScrapeLogs(prev => [...prev, '❌ Error: ' + err.message]);
    } finally {
      setScrapeScanning(false);
    }
  }

  function toggleScrapeSelect(systemId) {
    setScrapeSelected(prev => {
      const next = new Set(prev);
      if (next.has(systemId)) next.delete(systemId);
      else next.add(systemId);
      return next;
    });
  }

  function toggleScrapeSelectAll() {
    if (!scrapeResults?.newVideos) return;
    if (scrapeSelected.size === scrapeResults.newVideos.length) {
      setScrapeSelected(new Set());
    } else {
      setScrapeSelected(new Set(scrapeResults.newVideos.map(v => v.systemId)));
    }
  }

  function updateScrapeTitle(systemId, newTitle) {
    setScrapeResults(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        newVideos: prev.newVideos.map(v => v.systemId === systemId ? { ...v, title: newTitle } : v),
      };
    });
  }

  async function importScrapedVideos() {
    if (!scrapeResults?.newVideos) return;
    const toImport = scrapeResults.newVideos.filter(v => scrapeSelected.has(v.systemId));
    if (toImport.length === 0) {
      alert('Please select at least one video to import.');
      return;
    }

    setScrapeImporting(true);
    setScrapeLogs(['Starting import of ' + toImport.length + ' videos...']);
    setScrapeProgress({ current: 0, total: toImport.length, status: 'Initializing import...' });

    let successCount = 0;
    const BATCH_SIZE = 3;

    try {
      for (let i = 0; i < toImport.length; i += BATCH_SIZE) {
        const batch = toImport.slice(i, i + BATCH_SIZE);
        setScrapeProgress({
          current: i,
          total: toImport.length,
          status: 'Saving batch ' + (Math.floor(i / BATCH_SIZE) + 1) + ' of ' + Math.ceil(toImport.length / BATCH_SIZE) + '...',
        });

        const res = await secureFetch('/api/hwasi/scraper', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'import', videos: batch }),
        });
        const resData = await res.json();
        if (!res.ok || resData.error) throw new Error(resData.error || 'Import batch failed');

        successCount += batch.length;
        setScrapeLogs(prev => [
          ...prev,
          ...batch.map(b => '✓ Saved #' + b.systemId + ' (' + b.site + '): "' + b.title.slice(0, 40) + '" [Thumb + Title + Range]')
        ]);

        if (resData.updatedSettings) {
          setSettings(resData.updatedSettings);
        }
      }

      setScrapeProgress({ current: toImport.length, total: toImport.length, status: 'Done! ' + successCount + ' videos imported.' });
      flash('🚀 Successfully imported ' + successCount + ' videos! Range and thumbnails updated.');

      const importedIds = new Set(toImport.map(v => v.systemId));
      setScrapeResults(prev => ({
        ...prev,
        newVideos: prev.newVideos.filter(v => !importedIds.has(v.systemId)),
        newCount: prev.newVideos.filter(v => !importedIds.has(v.systemId)).length,
      }));
      setScrapeSelected(new Set());

      loadAll();
    } catch (err) {
      flash('❌ Import failed: ' + err.message, 'err');
      setScrapeLogs(prev => [...prev, 'ERROR: ' + err.message]);
    } finally {
      setScrapeImporting(false);
    }
  }

  function handleManualFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (.jpg, .jpeg, .png, .webp)');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxW = 400;
        const scale = img.width > maxW ? (maxW / img.width) : 1;
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
        setManualDataUrl(dataUrl);
        setManualThumbUrl('');
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  async function handleManualSave() {
    const cid = parseInt(manualCdnId, 10);
    if (isNaN(cid) || cid <= 0) {
      alert('Please enter a valid numeric Video ID / CDN ID');
      return;
    }
    if (!manualTitle.trim()) {
      alert('Please enter a video title');
      return;
    }

    const isExtra = manualSite === 'hindibf';
    const systemId = isExtra ? (10000 + cid) : cid;

    setManualSaving(true);
    try {
      const res = await secureFetch('/api/hwasi/scraper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'manual',
          video: {
            site: manualSite,
            cdnId: cid,
            systemId,
            title: manualTitle.trim(),
            thumbnail: manualThumbUrl.trim(),
            dataUrl: manualDataUrl,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to save video');

      if (data.updatedSettings) setSettings(data.updatedSettings);
      flash('✅ Video #' + systemId + ' added! Thumbnail, title, and range updated.');

      setManualCdnId('');
      setManualTitle('');
      setManualThumbUrl('');
      setManualDataUrl('');

      loadAll();
    } catch (err) {
      flash('❌ Error: ' + err.message, 'err');
    } finally {
      setManualSaving(false);
    }
  }

  // Payment settings state
  const [paySettings, setPaySettings] = useState({ maintenanceMode: false, upiId: '', qrUrl: '' });
  const [paySettingsSaving, setPaySettingsSaving] = useState(false);
  const [paySettingsMsg, setPaySettingsMsg] = useState('');
  // Support Tickets
  const [adminTickets, setAdminTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketSearch, setTicketSearch] = useState('');
  const [adminTicketFilter, setAdminTicketFilter] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [adminReplyText, setAdminReplyText] = useState('');
  const [adminReplyStatus, setAdminReplyStatus] = useState('replied');
  const [adminReplying, setAdminReplying] = useState(false);
  const [adminReplyMsg, setAdminReplyMsg] = useState(null);
  // UTR submissions
  const [utrList, setUtrList] = useState([]);
  const [utrFilter, setUtrFilter] = useState('pending'); // pending | approved | rejected
  // Device message modal
  const [deviceMsgModal, setDeviceMsgModal] = useState(null);
  const [deviceMsgText, setDeviceMsgText] = useState('');
  const [deviceMsgSending, setDeviceMsgSending] = useState(false);
  // Watch limit
  const [watchLimit, setWatchLimit] = useState({ limit: 5, msg: '' });
  const [watchLimitSaving, setWatchLimitSaving] = useState(false);
  const [watchLimitMsg, setWatchLimitMsg] = useState('');
  // Extra CDN Sources
  const [extraCdnSources, setExtraCdnSources] = useState([]);
  const [extraCdnForm, setExtraCdnForm] = useState({ name: 'HindiBF', cdnId: 'hindibf', cdnBase: 'https://cdn.hindibf.com.co' });
  const [extraCdnJson, setExtraCdnJson] = useState('');
  const [extraCdnMsg, setExtraCdnMsg] = useState('');
  const [extraCdnSaving, setExtraCdnSaving] = useState(false);

  useEffect(() => {
    async function init() {
      // Use secureFetch so the encrypted {cipher,iv} response is properly decrypted
      const r = await secureFetch('/api/verify');
      const d = await r.json();
      if (!d.auth || !['admin', 'advisor'].includes(d.role)) { window.location.href = '/gallery'; return; }
      setUser(d);
      loadAll(d.role);
    }
    init();
  }, []);

  // Poll online sessions every 30 sec
  useEffect(() => {
    async function fetchSessions() {
      const r = await fetch('/api/hwasi/sessions').catch(() => null);
      if (r?.ok) { const d = await r.json(); setOnlineUsers(d.online || []); }
    }
    fetchSessions();
    const t = setInterval(fetchSessions, 30000);
    return () => clearInterval(t);
  }, []);

  async function loadAll(role) {
    const fetches = [
      secureFetch('/api/hwasi/settings').then(x => x.json()).catch(() => ({ start:51, end:730, cdnId:'desimms', extraRanges:[] })),
      fetch('/api/hwasi/curated').then(x => x.json()).catch(() => ({})),
      secureFetch('/api/hwasi/users').then(x => x.json()).catch(() => ([])),
      secureFetch('/api/hwasi/history').then(x => x.json()).catch(() => ([])),
      fetch(`/api/hwasi/thumbnails?v=${Date.now()}`).then(x => x.json()).catch(() => ({})),
      secureFetch('/api/hwasi/premium').then(x => x.json()).catch(() => ({})),
      secureFetch('/api/hwasi/reports').then(x => x.json()).catch(() => ({ reports: [] })),
      secureFetch('/api/hwasi/deleted').then(x => x.json()).catch(() => ({ deleted: [] })),
      secureFetch('/api/hwasi/pending-users').then(x => x.json()).catch(() => ({ users: [] })),
      secureFetch('/api/hwasi/reg-approval').then(x => x.json()).catch(() => ({ required: false })),
      secureFetch('/api/hwasi/sub-requests').then(x => x.json()).catch(() => ({ requests: [] })),
    ];
    const [s, c, u, h, t, p, rep, del, pu, ra, sr] = await Promise.all(fetches);
    if (s && !s.error) setSettings(s);
    if (c && !c.error) setCurated(c);
    setUsers(Array.isArray(u) ? u : []);
    setHistory(Array.isArray(h) ? h : []);
    const ids = (t.ids || []).map(Number);
    setThumbCount(ids.length);
    setAllThumbIds(new Set(ids));
    if (p.users) setPremiumUsers(p.users);
    setReportsList(rep.reports || []);
    setDeletedList(del.deleted || []);
    setPendingUsers(pu.users || []);
    setRegApproval(ra.required || false);
    setSubRequests(sr.requests || []);
    // Load custom video titles, plans, device data
    fetch(`/api/hwasi/titles?v=${Date.now()}`).then(x => x.json()).then(d => {
      setVideoTitles(d.titles || {});
      // Extra CDN videos (hindibf, id >= 10000) that have titles also have thumbnails in extra_thumbs
      const extraCdnIds = Object.keys(d.titles || {}).map(Number).filter(id => id >= 10000);
      if (extraCdnIds.length > 0) {
        setAllThumbIds(prev => new Set([...prev, ...extraCdnIds]));
        setThumbCount(prev => prev + extraCdnIds.length);
      }
    }).catch(() => { });
    secureFetch('/api/hwasi/plans').then(x => x.json()).then(d => setPlansConfig(d.plans || null)).catch(() => { });
    secureFetch('/api/hwasi/devices').then(x => x.json()).then(d => setDeviceData(d.devices || {})).catch(() => { });
    secureFetch('/api/hwasi/payment-settings').then(x => x.json()).then(d => { if (d.settings) setPaySettings(d.settings); }).catch(() => { });
    secureFetch('/api/hwasi/utr').then(x => x.json()).then(d => setUtrList(d.submissions || [])).catch(() => { });
    fetch('/api/hwasi/tickets').then(x => x.json()).then(d => { if (d.ok) setAdminTickets(d.tickets || []); }).catch(() => { });
    secureFetch('/api/hwasi/watch-limit').then(x => x.json()).then(d => { if (d.ok) setWatchLimit({ limit: d.limit, msg: d.msg || '' }); }).catch(() => { });
    fetch('/api/hwasi/extra-cdn').then(x => x.json()).then(d => setExtraCdnSources(d.sources || [])).catch(() => { });
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

  async function fetchAdminTickets() {
    setTicketsLoading(true);
    try {
      const res = await fetch('/api/hwasi/tickets');
      const d = await res.json();
      if (d.ok) {
        setAdminTickets(d.tickets || []);
        if (selectedTicket) {
          const fresh = (d.tickets || []).find(t => t.id === selectedTicket.id);
          if (fresh) setSelectedTicket(fresh);
        }
      }
    } catch {}
    setTicketsLoading(false);
  }

  async function sendAdminTicketReply() {
    if (!selectedTicket || !adminReplyText.trim()) return;
    setAdminReplying(true);
    setAdminReplyMsg(null);
    try {
      const res = await fetch('/api/hwasi/tickets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: selectedTicket.id,
          reply: adminReplyText.trim(),
          status: adminReplyStatus,
        }),
      });
      const d = await res.json();
      if (res.ok && d.ok) {
        setAdminReplyMsg({ ok: true, text: '✓ Reply sent to user! User will be notified on login.' });
        setSelectedTicket(d.ticket);
        setAdminTickets(prev => prev.map(t => t.id === d.ticket.id ? d.ticket : t));
        setAdminReplyText('');
        setTimeout(() => setAdminReplyMsg(null), 3000);
      } else {
        setAdminReplyMsg({ ok: false, text: d.error || 'Failed to send reply' });
      }
    } catch {
      setAdminReplyMsg({ ok: false, text: 'Network error sending reply' });
    } finally {
      setAdminReplying(false);
    }
  }

  function flash(text, type = 'ok') { setMsg({ text, type }); setTimeout(() => setMsg({ text: '', type: '' }), 3500); }

  async function saveSettings() {
    setSavingSet(true);
    const r = await secureFetch('/api/hwasi/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    const d = await r.json();
    setSavingSet(false);
    if (r.ok && !d.error) {
      // Update local state from saved response
      setSettings(s => ({ ...s, ...d }));
      const primary = `#${d.start || settings.start}–#${d.end || settings.end}`;
      const extra = (d.extraRanges || settings.extraRanges || []).map(x => `#${x.start}–#${x.end}`).join(', ');
      flash(`✅ Range saved — viewers see ${primary}${extra ? ' + ' + extra : ''}`);
    } else flash('❌ ' + (d.error || 'Save failed'), 'err');
  }

  async function saveCurated(type) {
    const ids = curInput[type].split(',').map(s => s.trim()).filter(s => /^\d+$/.test(s)).map(Number);
    if (!ids.length) { flash('❌ Enter valid video IDs (e.g. 51, 72, 88)', 'err'); return; }
    const existing = curated[type] || [];
    const merged = [...new Set([...existing, ...ids])];
    const r = await fetch('/api/hwasi/curated', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...curated, [type]: merged }) });
    const d = await r.json();
    if (r.ok) { setCurated(d); setCurInput(p => ({ ...p, [type]: '' })); flash(`✅ ${type} updated — ${merged.length} videos`); }
    else flash('❌ ' + d.error, 'err');
  }

  async function removeCurated(type, id) {
    const updated = { ...curated, [type]: (curated[type] || []).filter(x => +x !== +id) };
    const r = await fetch('/api/hwasi/curated', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
    if (r.ok) { const d = await r.json(); setCurated(d); }
  }

  async function clearCurated(type) {
    const updated = { ...curated, [type]: [] };
    const r = await fetch('/api/hwasi/curated', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
    if (r.ok) { const d = await r.json(); setCurated(d); flash(`🗑 ${type} cleared`); }
  }

  async function pickRandom50(type) {
    // Fetch current settings for ALL ranges (primary + extra CDN sources like hindibf)
    const s = await fetch('/api/hwasi/settings').then(x => x.json()).catch(() => ({ start: 1, end: 775 }));
    const start = s.start || 1; const end = s.end || 775;
    const primaryAll = Array.from({ length: end - start + 1 }, (_, i) => i + start);
    const extraAll = (s.extraRanges || []).flatMap(r =>
      Array.from({ length: Math.max(0, r.end - r.start + 1) }, (_, i) => i + r.start)
    );
    const all = [...new Set([...primaryAll, ...extraAll])];
    // Full Collection: 100 videos with 60% bias toward latest (highest IDs = newest)
    const count = (type === 'full') ? 100 : 50;
    const sorted = [...all].sort((a, b) => b - a);
    const topThird = sorted.slice(0, Math.ceil(sorted.length / 3));
    const rest = sorted.slice(Math.ceil(sorted.length / 3));
    function shuffle(arr, n) {
      const s = [...arr];
      for (let i = s.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [s[i], s[j]] = [s[j], s[i]]; }
      return s.slice(0, n);
    }
    const latestPick = shuffle(topThird, Math.ceil(count * 0.6));
    const restPick = shuffle(rest, count - latestPick.length);
    const picked = [...new Set([...latestPick, ...restPick])].sort(() => Math.random() - 0.5);
    const r = await fetch('/api/hwasi/curated', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...curated, [type]: picked }) });
    const d = await r.json();
    if (r.ok) { setCurated(d); flash(`🎲 ${type}: ${picked.length} videos (60% latest + all CDNs)!`); }
    else flash('❌ ' + d.error, 'err');
  }

  async function createUser() {
    if (!newUser.username || !newUser.password || !newUser.displayName) { flash('❌ All fields required', 'err'); return; }
    const r = await fetch('/api/hwasi/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newUser) });
    const d = await r.json();
    if (r.ok) { setUsers(p => [...p, d]); setNewUser({ username: '', password: '', displayName: '', role: 'viewer' }); flash(`✅ User "${d.username}" created!`); }
    else flash('❌ ' + d.error, 'err');
  }

  async function deleteUser(id, username) {
    if (!confirm(`Delete user "${username}"?`)) return;
    const r = await fetch('/api/hwasi/users/' + id, { method: 'DELETE' });
    if (r.ok) { setUsers(p => p.filter(u => u.id !== id)); flash(`🗑 User "${username}" deleted`); }
    else { const d = await r.json(); flash('❌ ' + d.error, 'err'); }
  }

  async function saveEditUser() {
    if (!editUser.password) delete editUser.password; // keep old if blank
    const r = await fetch('/api/hwasi/users/' + editUser.id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editUser) });
    const d = await r.json();
    if (r.ok) { setUsers(p => p.map(u => u.id === d.id ? d : u)); setEditUser(null); flash('✅ User updated!'); }
    else flash('❌ ' + d.error, 'err');
  }

  // ── Thumbnail generator (CORS streaming proxy — correct approach!) ─────────
  async function runGenerator(start, end, specificIds = null) {
    genStopRef.current = false;

    // 1. Test connectivity
    setGenStatus('Testing connection…');
    setGenRunning(true);
    const testR = await fetch('/api/hwasi/thumbnails').catch(() => null);
    if (!testR || !testR.ok) {
      setGenRunning(false);
      setGenStatus('❌ Redis connection failed!');
      flash('❌ Redis unreachable — check your Secrets', 'err');
      return;
    }

    const ids = specificIds
      ? specificIds
      : Array.from({ length: end - start + 1 }, (_, i) => i + start);
    setGenTotal(ids.length);
    setGenProgress(0);
    let saved = 0;
    let done = 0;
    const CONCURRENT = 3;

    // ── Why this works when partial-blob approach failed ──────────────────────
    // Partial blob: we combine first 2MB + last 3MB bytes into one buffer.
    //   Problem: moov atom contains byte-offset tables (stco/co64) pointing to
    //   positions in the ORIGINAL full file. In our combined buffer, those positions
    //   are wrong → browser can't decode any frames → loadeddata never fires.
    //
    // CORS streaming proxy (/api/hwasi/thumb-stream/[id]):
    //   Browser loads video via crossOrigin='anonymous' from our proxy which adds
    //   Access-Control-Allow-Origin:* and forwards Range requests to CDN.
    //   Chrome automatically handles non-faststart (moov-at-end) MP4s by:
    //     1. Initial request → finds ftyp + mdat header
    //     2. Uses Content-Length to peek at file end
    //     3. Second range request → gets moov from end of file
    //     4. Fires loadedmetadata with correct duration → seek works perfectly
    //   Canvas capture works because of crossOrigin + our CORS header. ✅
    // ─────────────────────────────────────────────────────────────────────────

    async function captureViaStream(id) {
      return await new Promise((resolve) => {
        const vid = document.createElement('video');
        vid.muted = true;
        vid.playsInline = true;
        vid.preload = 'auto';        // tells browser to fetch enough to play
        vid.crossOrigin = 'anonymous';   // CRITICAL: allows canvas capture from CORS URL

        let settled = false;
        let seekPending = false;

        const cleanup = () => { vid.src = ''; vid.load(); };

        const capture = () => {
          try {
            const canvas = document.createElement('canvas');
            const vw = vid.videoWidth || 320;
            const vh = vid.videoHeight || 180;
            canvas.width = 320;
            canvas.height = 180;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#0a0010';
            ctx.fillRect(0, 0, 320, 180);
            const scale = Math.min(320 / vw, 180 / vh);
            const drawW = Math.round(vw * scale);
            const drawH = Math.round(vh * scale);
            const ox = Math.round((320 - drawW) / 2);
            const oy = Math.round((180 - drawH) / 2);
            ctx.drawImage(vid, ox, oy, drawW, drawH);
            // Quick black-frame check: sample center pixels
            const sample = ctx.getImageData(80, 45, 160, 90);
            let brightness = 0;
            for (let i = 0; i < sample.data.length; i += 4)
              brightness += sample.data[i] + sample.data[i + 1] + sample.data[i + 2];
            const avgBright = brightness / (sample.data.length / 4 * 3);
            if (avgBright < 6) { resolve(null); return; } // black frame — skip
            resolve(canvas.toDataURL('image/jpeg', 0.78));
          } catch { resolve(null); }
          finally { cleanup(); }
        };

        const finish = (ok) => {
          if (settled) return; settled = true;
          if (ok) capture(); else { cleanup(); resolve(null); }
        };

        // loadedmetadata: browser has found moov, knows duration — seek to captureAt
        vid.addEventListener('loadedmetadata', () => {
          if (settled) return;
          if (isFinite(vid.duration) && vid.duration > 0) {
            const seekTo = Math.min(captureAt, vid.duration * 0.9);
            seekPending = true;
            vid.currentTime = seekTo;
          } else {
            // No duration — capture whatever frame is loaded
            finish(true);
          }
        }, { once: true });

        // seeked: frame at captureAt is ready — capture it
        vid.addEventListener('seeked', () => {
          if (!seekPending) return;
          seekPending = false;
          finish(true);
        }, { once: true });

        // loadeddata fallback: fires when FIRST frame is decodable
        // Only act if seekPending hasn't started (avoids race with seeked)
        vid.addEventListener('loadeddata', () => {
          // Use setTimeout(0) to yield — let loadedmetadata/seeked handle it first
          setTimeout(() => {
            if (settled || seekPending) return;
            finish(true); // capture whatever frame is loaded
          }, 0);
        }, { once: true });

        vid.addEventListener('error', () => finish(false), { once: true });

        // 25s timeout per video (seeking requires fetching more data)
        setTimeout(() => {
          if (!settled) {
            settled = true;
            if (vid.readyState >= 2) capture();
            else { cleanup(); resolve(null); }
          }
        }, 25000);

        // Load via CORS proxy — browser makes its own range requests naturally
        vid.src = `/api/hwasi/thumb-stream/${id}`;
        vid.load();
      });
    }


    async function processOne(id) {
      if (genStopRef.current) return;
      setGenStatus(`Generating ${id}… (${saved} saved)`);
      try {
        const dataUrl = await captureViaStream(id);
        if (dataUrl) {
          const saveResp = await fetch(`/api/hwasi/thumbnail/${id}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dataUrl }),
          });
          if (saveResp.ok) { saved++; setThumbCount(c => c + 1); }
        }
      } catch { /* skip this video */ }
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
    const t = await fetch('/api/hwasi/thumbnails').then(x => x.json());
    const ids = t.ids || [];
    await Promise.all(ids.map(id =>
      fetch(`/api/hwasi/thumbnail/${id}`, { method: 'DELETE' }).catch(() => { })
    ));
    setThumbCount(0);
    flash('🗑 All thumbnails cleared');
  }

  async function logout() {
    await fetch('/api/logout', { method: 'POST' });


    window.location.href = '/login';
  }

  const filteredHistory = history.filter(h =>
    !histFilter || h.username?.includes(histFilter) || String(h.videoId)?.includes(histFilter) || h.displayName?.toLowerCase().includes(histFilter.toLowerCase())
  );

  // Stats for dashboard
  const deletedCount = (settings.deletedIds || []).length;
  const extraRangesCount = (settings.extraRanges || []).reduce((sum, r) => sum + Math.max(0, r.end - r.start + 1), 0);
  const totalVideos = Math.max(0, (settings.end - settings.start + 1) + extraRangesCount - deletedCount);
  const totalWatched = history.length;
  const now = Date.now();
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const watchesToday = history.filter(h => new Date(h.watchedAt) >= startOfDay).length;
  const watchesWeek = history.filter(h => now - new Date(h.watchedAt).getTime() < 7 * 24 * 3600 * 1000).length;
  const watchesMonth = history.filter(h => now - new Date(h.watchedAt).getTime() < 30 * 24 * 3600 * 1000).length;
  const topVideo = history.length ? (() => {
    const counts = {}; history.forEach(h => { counts[h.videoId] = (counts[h.videoId] || 0) + 1; });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return top ? `#${top[0]} (${top[1]}x)` : '—';
  })() : '—';

  if (!user) return <div className={styles.loading}><div className={styles.spinner} /></div>;

  return (
    <div className={styles.root}>
      {/* ── Sidebar ── */}
      <aside className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''}`}>
        {/* Logo */}
        <div className={styles.sidebarLogo}>
          <div className={styles.logoIcon}>
            <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
              <path d="M14 2L26 8.5V19.5L14 26L2 19.5V8.5L14 2Z" fill="url(#admg)" />
              <path d="M10 10l8 4-8 4V10z" fill="white" opacity="0.9" />
              <defs><linearGradient id="admg" x1="2" y1="2" x2="26" y2="26"><stop offset="0%" stopColor="#7c3aed" /><stop offset="100%" stopColor="#ec4899" /></linearGradient></defs>
            </svg>
          </div>
          {!collapsed && (
            <div>
              <div className={styles.logoTitle}>DesiHawas</div>
              <div className={styles.logoSub}>ADMIN</div>
            </div>
          )}
        </div>

        {/* Section label */}
        {!collapsed && <div className={styles.navSection}>NAVIGATION</div>}

        {/* Nav items — filtered by role */}
        {NAV.filter(n => n.roles.includes(user.role)).map(({ id, icon: Icon, label }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`${styles.navItem} ${tab === id ? styles.navItemActive : ''}`}
            title={collapsed ? label : undefined}>
            <span className={styles.navIcon}><Icon /></span>
            {!collapsed && <span className={styles.navLabel}>{label}</span>}
            {!collapsed && tab === id && <div className={styles.navIndicator} />}
          </button>
        ))}

        {!collapsed && <div className={styles.navSection} style={{ marginTop: 16 }}>QUICK ACTIONS</div>}
        <a href="/gallery" className={`${styles.navItem} ${styles.navGallery}`} title={collapsed ? 'Gallery' : undefined}>
          <span className={styles.navIcon}><IconGallery /></span>
          {!collapsed && <span className={styles.navLabel}>Gallery</span>}
        </a>

        {/* User at bottom */}
        <div className={styles.sidebarUser}>
          <div className={styles.sidebarAvatar}>{user.avatar || 'AD'}</div>
          {!collapsed && (
            <div className={styles.sidebarUserInfo}>
              <div className={styles.sidebarUserName}>{user.displayName || user.username}</div>
              <div className={styles.sidebarUserRole}>{user.role === 'advisor' ? 'Advisor' : 'Administrator'}</div>
            </div>
          )}
          {!collapsed && (
            <button className={styles.logoutBtn} onClick={logout} title="Sign out">
              <IconLogout />
            </button>
          )}
        </div>

        {/* Collapse toggle */}
        <button className={styles.collapseBtn} onClick={() => setCollapsed(c => !c)} title={collapsed ? 'Expand' : 'Collapse'}>
          {collapsed ? '›' : '‹ Collapse'}
        </button>
      </aside>

      {/* ── Main ── */}
      <div className={styles.main}>
        {/* Top bar */}
        <header className={styles.topbar}>
          <div>
            <h1 className={styles.pageTitle}>{NAV.find(n => n.id === tab)?.label || tab}</h1>
            <p className={styles.pageSub}>{
              tab === 'dashboard' ? 'Overview of your DesiHawas platform' :
                tab === 'curated' ? 'Manage Trending and Latest video sections' :
                  tab === 'scraper' ? 'Scan websites for new videos, auto-import thumbnails & titles, or add manually' :
                    tab === 'users' ? 'Create and manage viewer accounts' :
                    tab === 'analytics' ? 'See who watched which videos' :
                      'Configure video range and CDN source'
            }</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {msg.text && (
              <div className={`${styles.flashMsg} ${msg.type === 'err' ? styles.flashErr : styles.flashOk}`}>
                {msg.text}
              </div>
            )}
          </div>
        </header>

        <div className={styles.content}>

          {/* ══ DASHBOARD ══ */}
          {tab === 'dashboard' && (
            <div className={styles.fadeIn}>
              {/* ── Stats Row 1: Videos + Top Video ── */}
              <div className={styles.statsGrid}>
                <StatCard icon="🎦" label="Total Videos" value={totalVideos.toLocaleString()} sub={`#${settings.start}–#${settings.end}${extraRangesCount ? ` + ${extraRangesCount} extra` : ''}${deletedCount ? ` · ${deletedCount} deleted` : ''}`} color="purple" />
                <StatCard icon="🏆" label="Top Video" value={topVideo} sub="most watched" color="green" />
                <div
                  style={{ background: 'rgba(124,58,237,.1)', border: '1px solid rgba(124,58,237,.2)', borderRadius: 14, padding: '16px 20px', cursor: 'pointer', transition: 'transform .2s,box-shadow .2s', position: 'relative', overflow: 'hidden' }}
                  onClick={() => setShowOnlineModal(true)}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,.4)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 22 }}>🟢</span>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: onlineUsers.length > 0 ? '#4ade80' : '#6b7280', boxShadow: onlineUsers.length > 0 ? '0 0 8px #4ade80' : 'none', display: 'inline-block' }} />
                  </div>
                  <div style={{ fontSize: 30, fontWeight: 900, color: 'var(--text)', fontFamily: "'Space Grotesk',sans-serif" }}>{onlineUsers.length}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>Online Now</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>click to see who</div>
                </div>
                <StatCard icon="👁" label="All Time" value={totalWatched.toLocaleString()} sub="total watches" color="pink" />
              </div>
              {/* ── Stats Row 2: Watch Breakdown ── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginTop: 16, marginBottom: 4 }}>
                {[{ label: 'Today', val: watchesToday, color: '#f59e0b', bg: 'rgba(245,158,11,.1)', border: 'rgba(245,158,11,.2)' }, { label: 'This Week', val: watchesWeek, color: '#06b6d4', bg: 'rgba(6,182,212,.1)', border: 'rgba(6,182,212,.2)' }, { label: 'This Month', val: watchesMonth, color: '#a78bfa', bg: 'rgba(167,139,250,.1)', border: 'rgba(167,139,250,.2)' }].map(({ label, val, color, bg, border }) => (
                  <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
                    <div style={{ fontSize: 26, fontWeight: 800, color, fontFamily: "'Space Grotesk',sans-serif" }}>{val.toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>watches</div>
                  </div>
                ))}
              </div>

              {/* Quick Watch */}
              <div className={styles.card} style={{ marginTop: 20, marginBottom: 20 }}>
                <div className={styles.cardHeader}>
                  <span style={{ fontSize: 22 }}>▶</span>
                  <div><h3 className={styles.cardTitle}>Quick Watch</h3><p className={styles.cardSub}>Enter a video ID to instantly play it</p></div>
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <label className={styles.fieldLabel}>Video ID</label>
                    <input className="input" type="number" placeholder="e.g. 142" value={watchId} onChange={e => setWatchId(e.target.value)} onKeyDown={(e) => {
                      if (e.key === 'Enter' && watchId) {
                        setPreviewVideo({ id: watchId, loading: true, src: null });
                        fetch(`/api/hwasi/sign/${watchId}`).then(x => x.json()).then(sd => setPreviewVideo({ id: watchId, loading: false, src: sd.src })).catch(() => setPreviewVideo(null));
                      }
                    }} />
                  </div>
                  <button className="btn btn-primary" disabled={!watchId} onClick={async () => {
                    setPreviewVideo({ id: watchId, loading: true, src: null });
                    const sd = await fetch(`/api/hwasi/sign/${watchId}`).then(x => x.json()).catch(() => ({}));
                    setPreviewVideo({ id: watchId, loading: false, src: sd.src });
                  }}>▶ Play Video</button>
                </div>
              </div>

              <div className={styles.dashRow}>
                {/* Recent watches */}
                <div className={styles.dashCard} style={{ flex: 2 }}>
                  <div className={styles.dashCardHeader}>
                    <span className={styles.dashCardTitle}>Recent Activity</span>
                    <button className="btn btn-ghost btn-sm" onClick={() => setTab('analytics')}>View all</button>
                  </div>
                  {history.length === 0 ? (
                    <div className={styles.emptyState}>No watch activity yet</div>
                  ) : (
                    <div className={styles.actList}>
                      {history.slice(0, 8).map((h, i) => (
                        <div key={i} className={styles.actRow}>
                          <div className={styles.actAvatar}>{h.displayName?.slice(0, 2) || h.username?.slice(0, 2) || '??'}</div>
                          <div className={styles.actInfo}>
                            <span className={styles.actName}>{h.displayName || h.username}</span>
                            <span className={styles.actMeta}>watched <strong style={{ color: 'var(--accent2)' }}>#{h.videoId}</strong></span>
                          </div>
                          <span className={styles.actTime}>{timeAgo(h.watchedAt)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* Who's Online */}
                <div className={styles.dashCard} style={{ flex: 1 }}>
                  <div className={styles.dashCardHeader}>
                    <span className={styles.dashCardTitle} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: onlineUsers.length > 0 ? '#4ade80' : '#6b7280', boxShadow: onlineUsers.length > 0 ? '0 0 6px #4ade80' : 'none', display: 'inline-block', flexShrink: 0 }} />
                      Online ({onlineUsers.length})
                    </span>
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowOnlineModal(true)}>Details</button>
                  </div>
                  {onlineUsers.length === 0 ? (
                    <div className={styles.emptyState} style={{ fontSize: 13 }}>No active users right now</div>
                  ) : (
                    <div className={styles.usersMini}>
                      {onlineUsers.slice(0, 6).map((u, i) => (
                        <div key={i} className={styles.userMiniRow}>
                          <div style={{ position: 'relative', flexShrink: 0 }}>
                            <div className={styles.userMiniAvatar} style={{ background: u.role === 'admin' ? 'linear-gradient(135deg,#7c3aed,#9333ea)' : u.role === 'advisor' ? 'linear-gradient(135deg,#0ea5e9,#0284c7)' : 'linear-gradient(135deg,#0f766e,#0d9488)' }}>
                              {u.avatar || u.displayName?.slice(0, 2) || '??'}
                            </div>
                            <span style={{ position: 'absolute', bottom: -1, right: -1, width: 7, height: 7, borderRadius: '50%', background: '#4ade80', border: '1px solid #0a0015', boxShadow: '0 0 4px #4ade80' }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className={styles.userMiniName}>{u.displayName}</div>
                            <div className={styles.userMiniRole} style={{ fontSize: 10 }}>seen {Math.floor((Date.now() - new Date(u.lastSeen).getTime()) / 60000)}m ago</div>
                          </div>
                          <span className={`${styles.rolePill} ${u.role === 'admin' ? styles.roleAdmin : styles.roleViewer}`}>{u.role}</span>
                        </div>
                      ))}
                      {onlineUsers.length > 6 && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', textAlign: 'center', paddingTop: 4 }}>+{onlineUsers.length - 6} more</div>}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Online Users Detail Modal ── */}
              {showOnlineModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={e => { if (e.target === e.currentTarget) setShowOnlineModal(false) }}>
                  <div style={{ background: 'linear-gradient(145deg,rgba(20,15,30,.97),rgba(10,5,15,.99))', border: '1px solid rgba(124,58,237,.3)', borderRadius: 24, padding: 28, width: '90%', maxWidth: 500, maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                      <div>
                        <h3 style={{ fontWeight: 800, fontSize: 18, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: onlineUsers.length > 0 ? '#4ade80' : '#6b7280', boxShadow: onlineUsers.length > 0 ? '0 0 8px #4ade80' : 'none', display: 'inline-block' }} />
                          {onlineUsers.length} User{onlineUsers.length !== 1 ? 's' : ''} Online
                        </h3>
                        <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,.4)' }}>Active in last 15 minutes · refreshes every 30s</p>
                      </div>
                      <button onClick={() => setShowOnlineModal(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.5)', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>✕</button>
                    </div>
                    <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {onlineUsers.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,.4)', fontSize: 14 }}>Nobody's online right now</div>
                      ) : onlineUsers.map((u, i) => {
                        const idleMins = Math.floor((Date.now() - new Date(u.lastSeen).getTime()) / 60000);
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: 'rgba(255,255,255,.04)', borderRadius: 14, border: '1px solid rgba(255,255,255,.06)' }}>
                            <div style={{ position: 'relative', flexShrink: 0 }}>
                              <div style={{ width: 44, height: 44, borderRadius: '50%', background: u.role === 'admin' ? 'linear-gradient(135deg,#7c3aed,#ec4899)' : u.role === 'advisor' ? 'linear-gradient(135deg,#0ea5e9,#0284c7)' : 'linear-gradient(135deg,#0f766e,#0d9488)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, color: '#fff' }}>
                                {u.avatar || u.displayName?.slice(0, 2) || '??'}
                              </div>
                              <span style={{ position: 'absolute', bottom: 1, right: 1, width: 10, height: 10, borderRadius: '50%', background: '#4ade80', border: '2px solid #0a0015', boxShadow: '0 0 6px #4ade80' }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>{u.displayName || u.username}</div>
                              {u.email && <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', marginTop: 2 }}>✉ {u.email}</div>}
                              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', marginTop: 2 }}>@{u.username} · last seen {idleMins === 0 ? 'just now' : `${idleMins}m ago`}</div>
                            </div>
                            <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: u.role === 'admin' ? 'rgba(124,58,237,.2)' : u.role === 'advisor' ? 'rgba(14,165,233,.2)' : 'rgba(16,185,129,.15)', color: u.role === 'admin' ? '#a78bfa' : u.role === 'advisor' ? '#38bdf8' : '#34d399', border: `1px solid ${u.role === 'admin' ? 'rgba(124,58,237,.3)' : u.role === 'advisor' ? 'rgba(14,165,233,.3)' : 'rgba(16,185,129,.25)'}` }}>{u.role}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* ══ CURATED ══ */}
          {tab === 'curated' && (
            <div className={styles.fadeIn}>
              {/* Full Collection Shuffle */}
              <div className={styles.card} style={{ marginBottom: 20 }}>
                <div className={styles.cardHeader}>
                  <span style={{ fontSize: 24 }}>🎦</span>
                  <div style={{ flex: 1 }}>
                    <h3 className={styles.cardTitle}>Full Collection Order</h3>
                    <p className={styles.cardSub}>Shuffle the order viewers see in the Full Collection tab</p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className={styles.randomBtn}
                      onClick={async () => {
                        const cur = await secureFetch('/api/hwasi/settings').then(x => x.json()).catch(() => settings);
                        const s = cur.error ? settings : cur;
                        const primary = Array.from({ length: Math.max(0, s.end - s.start + 1) }, (_, i) => i + s.start);
                        const extra = (s.extraRanges || []).flatMap(r => Array.from({ length: Math.max(0, r.end - r.start + 1) }, (_, i) => i + r.start));
                        const all = [...new Set([...primary, ...extra])];
                        // Fisher-Yates shuffle
                        for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
                        const top = all.slice(0, 100);
                        const r2 = await fetch('/api/hwasi/curated', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...curated, fullCollection: top }) });
                        if (r2.ok) { const d = await r2.json(); setCurated(d); flash(`✅ Full Collection shuffled — first 100 IDs randomized`); }
                      }}
                    >🎲 Shuffle First 100</button>
                    {(curated.fullCollection || []).length > 0 && (
                      <button className={styles.clearBtn}
                        onClick={async () => {
                          const r2 = await fetch('/api/hwasi/curated', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...curated, fullCollection: [] }) });
                          if (r2.ok) { const d = await r2.json(); setCurated(d); flash('✅ Full Collection order reset to default (sequential)'); }
                        }}
                      >🗑 Reset to Sequential</button>
                    )}
                  </div>
                </div>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', marginTop: 4 }}>
                  {(curated.fullCollection || []).length > 0
                    ? `🔀 Custom order active — first ${(curated.fullCollection).length} videos shown in shuffled order, rest follow sequentially`
                    : 'ℹ️ No shuffle active — videos shown in sequential order (ID #start → #end)'}
                </p>
              </div>

              {[
                { key: 'trending',   label: 'Trending',   icon: '🔥' },
                { key: 'popular',    label: 'Popular',    icon: '📈' },
                { key: 'instaviral', label: 'Insta Viral', icon: '📸' },
              ].map(({ key: type, label, icon }) => (
                <div key={type} className={styles.card} style={{ marginBottom: 20 }}>
                  <div className={styles.cardHeader}>
                    <span style={{ fontSize: 24 }}>{icon}</span>
                    <div style={{ flex: 1 }}>
                      <h3 className={styles.cardTitle}>{label}</h3>
                      <p className={styles.cardSub}>
                        {(curated[type] || []).length} videos in this section
                        {type === 'instaviral' && ' · No limit · 👑 Premium only'}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
                      {/* Random 50 only for Trending and Popular — NOT Insta Viral */}
                      {type !== 'instaviral' && (
                        <button className={styles.randomBtn} onClick={() => pickRandom50(type)} title="Replace with 50 random videos from current range">
                          🎲 Random 50
                        </button>
                      )}
                      {(curated[type] || []).length > 0 && (
                        <button className={styles.clearBtn} onClick={() => { if (confirm(`Clear all ${label} videos?`)) clearCurated(type) }} title="Clear all">
                          🗑 Clear
                        </button>
                      )}
                    </div>
                  </div>
                  <div className={styles.chipRow}>
                    {(curated[type] || []).length === 0 && (
                      <span className={styles.emptyHint}>
                        {type === 'instaviral'
                          ? 'No videos added yet — enter IDs below (no limit, admin/advisor only)'
                          : 'No videos added yet — use Random 50 or enter IDs below'}
                      </span>
                    )}
                    {(curated[type] || []).map(id => (
                      <div key={id} className={styles.chip}>
                        <span>#{id}</span>
                        <button className={styles.chipRemove} onClick={() => removeCurated(type, id)}>×</button>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                    <input className="input" style={{ flex: 1, minWidth: 180 }} placeholder="Add video IDs: 51, 72, 88…"
                      value={curInput[type] || ''} onChange={e => setCurInput(p => ({ ...p, [type]: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && saveCurated(type)} />
                    <button className="btn btn-primary" onClick={() => saveCurated(type)}>Add Videos</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ══ THUMBNAILS ══ */}
          {tab === 'thumbnails' && (
            <div className={styles.fadeIn}>
              <div className={styles.card} style={{ marginBottom: 20 }}>
                <div className={styles.cardHeader}>
                  <span style={{ fontSize: 24 }}>🖼</span>
                  <div style={{ flex: 1 }}>
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
                  <div style={{ margin: '16px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>
                      <span>{genStatus}</span>
                      <span>{genProgress}/{genTotal} ({Math.round(genProgress / genTotal * 100)}%)</span>
                    </div>
                    <div style={{ height: 8, background: 'rgba(255,255,255,.06)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.round(genProgress / genTotal * 100)}%`, background: 'linear-gradient(90deg,#7c3aed,#ec4899)', borderRadius: 4, transition: 'width .3s' }} />
                    </div>
                  </div>
                )}

                {/* Buttons */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
                  {!genRunning ? (
                    <>
                      <button className="btn btn-primary" onClick={() => runGenerator(settings.start, settings.end)}>
                        ⚡ Generate All ({settings.end - settings.start + 1} videos)
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => runGenerator(settings.start, Math.min(settings.start + 9, settings.end))}>
                        🧪 Test First 10
                      </button>
                      {thumbCount > 0 && (
                        <button className="btn btn-ghost btn-sm" style={{ color: '#f87171' }}
                          onClick={() => { if (confirm('Clear ALL stored thumbnails?')) clearAllThumbs(); }}>
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
                <div className={styles.card} style={{ marginTop: 20 }}>
                  <h4 className={styles.cardTitle} style={{ marginBottom: 14 }}>Advanced Options</h4>

                  {/* Capture timestamp */}
                  <div style={{ marginBottom: 20 }}>
                    <label className={styles.fieldLabel}>
                      Capture Timestamp: <strong>{captureAt}s</strong>
                    </label>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                      <input type="range" min="0" max="30" step="0.5"
                        value={captureAt} onChange={e => setCaptureAt(Number(e.target.value))}
                        style={{ flex: 1, minWidth: 160, accentColor: '#7c3aed' }} />
                      <input type="number" min="0" max="60" step="0.5"
                        value={captureAt} onChange={e => setCaptureAt(Number(e.target.value))}
                        className="input" style={{ width: 80 }} />
                      <span style={{ fontSize: 12, color: 'var(--text3)' }}>seconds</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                      {[0.5, 1, 2, 3, 5, 10].map(t => (
                        <button key={t} className="btn btn-ghost btn-sm"
                          style={captureAt === t ? { borderColor: '#7c3aed', color: '#a78bfa' } : {}}
                          onClick={() => setCaptureAt(t)}>{t}s</button>
                      ))}
                    </div>
                  </div>

                  {/* Specific IDs regen */}
                  <label className={styles.fieldLabel}>Re-generate Specific Video IDs</label>
                  <p style={{ fontSize: 12, color: 'var(--text3)', margin: '4px 0 10px' }}>Enter comma-separated IDs (e.g. 72, 130, 245) to re-capture only those thumbnails</p>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <input className="input" style={{ flex: 1, minWidth: 180 }}
                      placeholder="e.g. 72, 130, 245, 388"
                      value={regenIds} onChange={e => setRegenIds(e.target.value)}
                      disabled={genRunning} />
                    <button className="btn btn-primary"
                      disabled={genRunning || !regenIds.trim()}
                      onClick={() => {
                        const ids = regenIds.split(',').map(s => s.trim()).filter(s => /^\d+$/.test(s)).map(Number);
                        if (!ids.length) { flash('❌ Enter valid IDs', 'err'); return; }
                        const min = Math.min(...ids);
                        const max = Math.max(...ids);
                        runGenerator(min, max, ids);
                      }}>⚡ Regen Selected</button>
                  </div>
                </div>
              </div>

              {/* ── Thumbnail Review Grid ─────────────────────────────── */}
              <div className={styles.card} style={{ marginTop: 20 }}>
                <div className={styles.cardHeader}>
                  <span style={{ fontSize: 22 }}>🔍</span>
                  <div>
                    <h3 className={styles.cardTitle}>Thumbnail Review</h3>
                    <p className={styles.cardSub}>See all videos — ID overlaid so you can spot black thumbnails</p>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowThumbGrid(g => !g)}>
                    {showThumbGrid ? '▲ Hide' : '▼ Show Grid'}
                  </button>
                </div>
                {showThumbGrid && (
                  <>
                    {/* Selection toolbar */}
                    {selectedGridIds.size > 0 && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10,
                        padding: '8px 12px', background: 'rgba(124,58,237,.15)', borderRadius: 10,
                        border: '1px solid rgba(124,58,237,.3)'
                      }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa' }}>
                          ✓ {selectedGridIds.size} selected
                        </span>
                        <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto', fontSize: 11 }}
                          onClick={() => { setSelectedGridIds(new Set()); }}>✕ Clear</button>
                        <button className="btn btn-primary btn-sm"
                          onClick={() => {
                            const sorted = Array.from(selectedGridIds).sort((a, b) => a - b);
                            setRegenIds(sorted.join(', '));
                          }}>⬆ Fill Regen Field</button>
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(100px,1fr))', gap: 6 }}>
                      {[
                        // Primary range
                        ...Array.from({ length: Math.max(0, settings.end - settings.start + 1) }, (_, i) => i + settings.start),
                        // Extra ranges (2500-2560, 10001-10243, etc.)
                        ...(settings.extraRanges || []).flatMap(r =>
                          Array.from({ length: Math.max(0, r.end - r.start + 1) }, (_, i) => i + r.start)
                        ),
                      ].map(id => {
                        const hasThumb = allThumbIds.has(id);
                        const isSelected = selectedGridIds.has(id);
                        return (
                          <div key={id}
                            style={{
                              position: 'relative', borderRadius: 8, overflow: 'hidden', background: '#0a0010',
                              border: isSelected
                                ? '2px solid #f59e0b'
                                : hasThumb ? '1px solid rgba(124,58,237,.3)' : '1px solid rgba(239,68,68,.3)',
                              cursor: 'pointer',
                              boxShadow: isSelected ? '0 0 0 2px rgba(245,158,11,.3)' : 'none',
                              transform: isSelected ? 'scale(0.96)' : 'scale(1)',
                              transition: 'border .15s,transform .15s,box-shadow .15s',
                              userSelect: 'none',
                            }}
                            onClick={(e) => {
                              if (e.ctrlKey || e.metaKey || e.shiftKey) {
                                // Ctrl/Cmd/Shift+click: toggle this ID in multi-selection
                                setSelectedGridIds(prev => {
                                  const next = new Set(prev);
                                  if (next.has(id)) next.delete(id);
                                  else next.add(id);
                                  // Auto-fill regen field with sorted selection
                                  const sorted = Array.from(next).sort((a, b) => a - b);
                                  setRegenIds(sorted.join(', '));
                                  return next;
                                });
                              } else {
                                // Normal click: single select → fill regen field directly
                                setSelectedGridIds(new Set([id]));
                                setRegenIds(String(id));
                              }
                            }}
                          >
                            {/* Selection checkbox indicator */}
                            {isSelected && (
                              <div style={{
                                position: 'absolute', top: 4, right: 4, zIndex: 2,
                                width: 18, height: 18, borderRadius: 4,
                                background: '#f59e0b', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', fontSize: 11, fontWeight: 900, color: '#000'
                              }}>✓</div>
                            )}
                            {hasThumb ? (
                              <img src={id >= 10000 ? `/api/hwasi/thumb-extra/${id}` : `/api/hwasi/thumbnail/${id}`}
                                style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }}
                                loading="lazy" alt={`#${id}`}
                                onError={e => { e.target.style.display = 'none'; }} />
                            ) : (
                              <div style={{
                                width: '100%', aspectRatio: '16/9', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', background: 'rgba(239,68,68,.1)', fontSize: 16
                              }}>❌</div>
                            )}
                            {/* Video ID label */}
                            <div style={{
                              position: 'absolute', bottom: 0, left: 0, right: 0,
                              background: 'linear-gradient(transparent,rgba(0,0,0,.9))',
                              padding: '10px 3px 3px', textAlign: 'center',
                              fontSize: 10, fontWeight: 700,
                              color: isSelected ? '#f59e0b' : hasThumb ? '#a78bfa' : '#f87171'
                            }}>#{id}</div>
                          </div>
                        );
                      })}
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 10, textAlign: 'center' }}>
                      <strong style={{ color: '#a78bfa' }}>Click</strong> = select one ·
                      <strong style={{ color: '#f59e0b' }}> Ctrl+Click</strong> = multi-select ·
                      Selected IDs auto-fill the regen field above
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ══ SUBSCRIPTIONS ══ */}
          {tab === 'subscriptions' && (
            <div className={styles.fadeIn}>

              {/* ─ For ADVISORS: request form ─ */}
              {user.role === 'advisor' && (
                <div className={styles.card} style={{ marginBottom: 20 }}>
                  <div className={styles.cardHeader}>
                    <span style={{ fontSize: 22 }}>📝</span>
                    <div><h3 className={styles.cardTitle}>Request Subscription for User</h3><p className={styles.cardSub}>Admin will review and approve this request</p></div>
                  </div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <label className={styles.fieldLabel}>User ID or Username</label>
                      <input className="input" placeholder="User ID or username" value={grantForm.userId} onChange={e => setGrantForm(p => ({ ...p, userId: e.target.value }))} />
                    </div>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <label className={styles.fieldLabel}>Display Name (optional)</label>
                      <input className="input" placeholder="For reference" value={grantForm.displayName || ''} onChange={e => setGrantForm(p => ({ ...p, displayName: e.target.value }))} />
                    </div>
                    <div style={{ minWidth: 130 }}>
                      <label className={styles.fieldLabel}>Plan</label>
                      <select className="input" value={grantForm.plan} onChange={e => setGrantForm(p => ({ ...p, plan: e.target.value }))}>
                        <option value="basic">₹100 — Basic (14d)</option>
                        <option value="plus">₹300 — Plus (60d)</option>
                        <option value="pro">₹599 — Pro (3yr)</option>
                      </select>
                    </div>
                    <div style={{ minWidth: 100 }}>
                      <label className={styles.fieldLabel}>Days</label>
                      <input className="input" type="number" min="1" placeholder="Days" value={grantForm.days} onChange={e => setGrantForm(p => ({ ...p, days: e.target.value }))} />
                    </div>
                    <button className="btn btn-primary" onClick={async () => {
                      if (!grantForm.userId || !grantForm.days) { flash('❌ Fill all fields', 'err'); return; }
                      const r = await fetch('/api/hwasi/sub-requests', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: grantForm.userId, userDisplayName: grantForm.displayName, plan: grantForm.plan, days: Number(grantForm.days) })
                      });
                      if (r.ok) { flash('📤 Request sent to admin for approval'); setGrantForm({ userId: '', plan: 'basic', days: '', displayName: '' }); }
                      else flash('❌ Failed to send request', 'err');
                    }}>📤 Send Request</button>
                  </div>
                  {/* Show advisor's past requests */}
                  {subRequests.filter(sr => sr.requestedBy === user.username).length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>My Requests</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {subRequests.filter(sr => sr.requestedBy === user.username).slice(0, 5).map(sr => (
                          <div key={sr.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(255,255,255,.04)', borderRadius: 10, fontSize: 13, flexWrap: 'wrap' }}>
                            <span style={{ color: '#a78bfa', fontWeight: 700 }}>@{sr.requestedFor}</span>
                            <span style={{ background: 'rgba(124,58,237,.2)', color: '#a78bfa', padding: '2px 8px', borderRadius: 100, fontSize: 11 }}>{sr.plan}</span>
                            <span style={{ color: 'rgba(255,255,255,.4)' }}>{sr.days}d</span>
                            <span style={{
                              marginLeft: 'auto', fontSize: 11, padding: '2px 10px', borderRadius: 100, fontWeight: 700,
                              background: sr.status === 'approved' ? 'rgba(16,185,129,.15)' : sr.status === 'rejected' ? 'rgba(239,68,68,.15)' : 'rgba(245,158,11,.15)',
                              color: sr.status === 'approved' ? '#34d399' : sr.status === 'rejected' ? '#f87171' : '#fbbf24'
                            }}>{sr.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ─ For ADMIN: pending sub-requests to approve ─ */}
              {user.role === 'admin' && subRequests.filter(sr => sr.status === 'pending').length > 0 && (
                <div className={styles.card} style={{ marginBottom: 20, borderColor: 'rgba(245,158,11,.2)', background: 'rgba(245,158,11,.04)' }}>
                  <div className={styles.cardHeader}>
                    <span style={{ fontSize: 22 }}>⏳</span>
                    <div><h3 className={styles.cardTitle}>Pending Subscription Requests</h3><p className={styles.cardSub}>{subRequests.filter(sr => sr.status === 'pending').length} request(s) from advisors</p></div>
                    <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={loadAll}>↻ Refresh</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                    {subRequests.filter(sr => sr.status === 'pending').map(sr => (
                      <div key={sr.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'rgba(245,158,11,.06)', border: '1px solid rgba(245,158,11,.15)', borderRadius: 12, flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>Subscription for: <span style={{ color: '#a78bfa' }}>{sr.requestedForDisplay || sr.requestedFor}</span></div>
                          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)' }}>
                            Plan: <strong style={{ color: '#f59e0b' }}>{sr.plan}</strong> · {sr.days} days ·
                            Requested by: <strong style={{ color: '#60a5fa' }}>@{sr.requestedBy}</strong> ({sr.requestedByRole})
                          </div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>{new Date(sr.timestamp).toLocaleString('en-IN')}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                          <button className="btn btn-primary btn-sm" onClick={async () => {
                            await fetch('/api/hwasi/sub-requests', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: sr.id, action: 'approve' }) });
                            flash('✅ Subscription approved & activated'); loadAll();
                          }}>✓ Approve</button>
                          <button className="btn btn-ghost btn-sm" style={{ color: '#f87171' }} onClick={async () => {
                            await fetch('/api/hwasi/sub-requests', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: sr.id, action: 'reject' }) });
                            flash('✕ Request rejected'); loadAll();
                          }}>✕ Reject</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Grant subscription + Users list (admin direct) */}
              {user.role === 'admin' && (<>
                <div className={styles.card} style={{ marginBottom: 20 }}>
                  <div className={styles.cardHeader}>
                    <span style={{ fontSize: 22 }}>✨</span>
                    <div><h3 className={styles.cardTitle}>Grant Subscription</h3><p className={styles.cardSub}>Manually activate premium for a user after payment</p></div>
                  </div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <label className={styles.fieldLabel}>User</label>
                      <select className="input" value={grantForm.userId} onChange={e => setGrantForm(p => ({ ...p, userId: e.target.value }))}>
                        <option value="">Select user...</option>
                        {users.map(u => <option key={u.id} value={u.id}>{u.displayName} ({u.username})</option>)}
                      </select>
                    </div>
                    <div style={{ minWidth: 130 }}>
                      <label className={styles.fieldLabel}>Plan</label>
                      <select className="input" value={grantForm.plan} onChange={e => setGrantForm(p => ({ ...p, plan: e.target.value }))}>
                        {plansConfig
                          ? Object.entries(plansConfig).map(([key, plan]) => (
                              <option key={key} value={key}>
                                ₹{plan.price} — {plan.label || key} ({plan.days} days)
                              </option>
                            ))
                          : ['basic','plus','pro'].map(k => <option key={k} value={k}>{k}</option>)
                        }
                      </select>
                    </div>
                    <div style={{ minWidth: 100 }}>
                      <label className={styles.fieldLabel}>Custom Days (opt)</label>
                      <input className="input" type="number" placeholder="auto" value={grantForm.days}
                        onChange={e => setGrantForm(p => ({ ...p, days: e.target.value }))} />
                    </div>
                    <button className="btn btn-primary" disabled={!grantForm.userId} onClick={async () => {
                      const r = await fetch('/api/hwasi/premium', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: grantForm.userId, plan: grantForm.plan, days: grantForm.days ? Number(grantForm.days) : undefined })
                      });
                      if (r.ok) { flash('✅ Premium granted!'); loadAll(); setGrantForm({ userId: '', plan: 'basic', days: '' }); }
                      else flash('❌ Failed to grant', 'err');
                    }}>✨ Grant</button>
                  </div>
                </div>

                {/* Users list with premium status */}
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <span style={{ fontSize: 22 }}>👥</span>
                    <div><h3 className={styles.cardTitle}>All Users</h3><p className={styles.cardSub}>Manage subscription status</p></div>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                          {['User', 'Role', 'Plan', 'Expires', 'Actions'].map(h => (
                            <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--text3)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {premiumUsers.map(u => {
                          const planColors = { basic: '#7c3aed', plus: '#0ea5e9', pro: '#f59e0b' };
                          const pc = planColors[u.premium?.plan] || 'transparent';
                          return (
                            <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                              <td style={{ padding: '12px' }}>
                                <div style={{ fontWeight: 600, color: '#f1f5f9' }}>{u.displayName}</div>
                                <div style={{ fontSize: 11, color: 'var(--text3)' }}>@{u.username}</div>
                              </td>
                              <td style={{ padding: '12px' }}>
                                <span style={{ background: u.role === 'admin' ? 'rgba(236,72,153,.15)' : 'rgba(255,255,255,.06)', color: u.role === 'admin' ? '#ec4899' : 'var(--text2)', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{u.role}</span>
                              </td>
                              <td style={{ padding: '12px' }}>
                                {u.premium ? (
                                  <span style={{ background: `${pc}22`, color: pc, border: `1px solid ${pc}44`, padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>{u.premium.plan}</span>
                                ) : (
                                  <span style={{ color: 'var(--text3)', fontSize: 12 }}>Free</span>
                                )}
                              </td>
                              <td style={{ padding: '12px', fontSize: 12, color: 'var(--text2)' }}>
                                {u.premium ? new Date(u.premium.expiresAt).toLocaleDateString('en-IN') : '—'}
                              </td>
                              <td style={{ padding: '12px' }}>
                                {u.premium && (
                                  <button className="btn btn-ghost btn-sm" style={{ color: '#f87171' }} onClick={async () => {
                                    await fetch(`/api/hwasi/premium?userId=${u.id}`, { method: 'DELETE' });
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
              </>)} {/* end admin-only section */}

            </div>
          )}

          {/* ══ AUTO SCRAPER & MANUAL ADD ══ */}
          {tab === 'scraper' && (
            <div className={styles.fadeIn}>
              {/* Card 1: Site Selector & Scanner Controls */}
              <div className={styles.card} style={{ marginBottom: 20 }}>
                <div className={styles.cardHeader}>
                  <span style={{ fontSize: 24 }}>🤖</span>
                  <div style={{ flex: 1 }}>
                    <h3 className={styles.cardTitle}>Auto Video Scraper</h3>
                    <p className={styles.cardSub}>
                      Automatically scan CDN sites for new videos, skip existing ones, download thumbnails & convert to base64, and update Redis database in 1 click!
                    </p>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={loadAll}>↻ Refresh Database</button>
                </div>

                {/* Site Selection Pills */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, margin: '16px 0' }}>
                  <div
                    onClick={() => setScrapeSite('desimms')}
                    style={{
                      padding: 16,
                      borderRadius: 12,
                      cursor: 'pointer',
                      border: scrapeSite === 'desimms' ? '2px solid #7c3aed' : '1px solid rgba(255,255,255,.08)',
                      background: scrapeSite === 'desimms' ? 'rgba(124, 58, 237, 0.12)' : 'rgba(255,255,255,.02)',
                      transition: 'all .2s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>🌐 DesiMMS (Primary CDN)</span>
                      {scrapeSite === 'desimms' && <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 10, background: '#7c3aed', color: '#fff' }}>Selected</span>}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text3)' }}>CDN: <code>cdn.desimms.com.co</code></div>
                    <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>
                      Current Range: <strong>#{settings.start || 1} – #{settings.end || 0}</strong> ({Math.max(0, (settings.end || 0) - (settings.start || 1) + 1)} videos)
                    </div>
                  </div>

                  <div
                    onClick={() => setScrapeSite('hindibf')}
                    style={{
                      padding: 16,
                      borderRadius: 12,
                      cursor: 'pointer',
                      border: scrapeSite === 'hindibf' ? '2px solid #ec4899' : '1px solid rgba(255,255,255,.08)',
                      background: scrapeSite === 'hindibf' ? 'rgba(236, 72, 153, 0.12)' : 'rgba(255,255,255,.02)',
                      transition: 'all .2s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>🌐 HindiBF (Extra Range #2)</span>
                      {scrapeSite === 'hindibf' && <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 10, background: '#ec4899', color: '#fff' }}>Selected</span>}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text3)' }}>CDN: <code>cdn.hindibf.com.co</code> (Offset: +10000)</div>
                    <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>
                      Current Range: <strong>#{settings.extraRanges?.find(r => r.cdnId === 'hindibf' || r.start >= 10000)?.start || 10001} – #{settings.extraRanges?.find(r => r.cdnId === 'hindibf' || r.start >= 10000)?.end || 10655}</strong>
                    </div>
                  </div>
                </div>

                {/* Scan Options Row */}
                <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', padding: '12px 16px', background: 'rgba(255,255,255,.03)', borderRadius: 10, margin: '14px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label style={{ fontSize: 13, color: 'var(--text2)' }}>Pages to scan:</label>
                    <select
                      value={scrapePages}
                      onChange={e => setScrapePages(Number(e.target.value))}
                      style={{ padding: '6px 12px', background: 'rgba(0,0,0,.4)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 6, color: '#fff' }}
                    >
                      <option value={1}>1 page (20 posts)</option>
                      <option value={2}>2 pages (40 posts)</option>
                      <option value={3}>3 pages (60 posts) - Recommended</option>
                      <option value={5}>5 pages (100 posts)</option>
                      <option value={10}>10 pages (200 posts)</option>
                    </select>
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text2)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={scrapeDeep}
                      onChange={e => setScrapeDeep(e.target.checked)}
                      style={{ accentColor: '#7c3aed' }}
                    />
                    Deep Scan (Do not stop early when hitting known videos)
                  </label>

                  <button
                    className="btn btn-primary"
                    disabled={scrapeScanning || scrapeImporting}
                    onClick={runScraperScan}
                    style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    {scrapeScanning ? '⏳ Scanning ' + (scrapeSite === 'desimms' ? 'DesiMMS' : 'HindiBF') + '...' : '⚡ Scan for New Videos'}
                  </button>
                </div>

                <div className={styles.infoBox}>
                  <strong>How this works:</strong> Clicking "Scan for New Videos" queries the WordPress REST API directly, compares each post against the Redis database, and automatically skips any video you already have. When new videos are found, clicking "Import to Redis" downloads the thumbnails, converts them to base64 JPEG, saves the titles, maps CDN routing, and automatically bumps your gallery range!
                </div>
              </div>

              {/* Card 2: Discovered Videos & Batch Import */}
              {scrapeResults && (
                <div className={styles.card} style={{ marginBottom: 20 }}>
                  <div className={styles.cardHeader}>
                    <span style={{ fontSize: 24 }}>✨</span>
                    <div style={{ flex: 1 }}>
                      <h3 className={styles.cardTitle}>
                        Scan Results: {scrapeResults.newCount > 0 ? scrapeResults.newCount + ' New Videos Found!' : 'Up to Date!'}
                      </h3>
                      <p className={styles.cardSub}>
                        Scanned {scrapeResults.scannedPosts} posts · {scrapeResults.knownCount} already known videos skipped · Target: {scrapeResults.siteName}
                      </p>
                    </div>

                    {scrapeResults.newCount > 0 && (
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button className="btn btn-ghost btn-sm" onClick={toggleScrapeSelectAll}>
                          {scrapeSelected.size === scrapeResults.newVideos.length ? 'Deselect All' : 'Select All (' + scrapeResults.newVideos.length + ')'}
                        </button>
                        <button
                          className="btn btn-primary"
                          disabled={scrapeSelected.size === 0 || scrapeImporting}
                          onClick={importScrapedVideos}
                        >
                          {scrapeImporting ? '⏳ Importing...' : '🚀 Import Selected (' + scrapeSelected.size + ') to Redis'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Progress Bar during Import */}
                  {scrapeImporting && (
                    <div style={{ margin: '16px 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text2)', marginBottom: 6 }}>
                        <span>{scrapeProgress.status}</span>
                        <span>{scrapeProgress.current} / {scrapeProgress.total}</span>
                      </div>
                      <div style={{ height: 8, background: 'rgba(255,255,255,.06)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: ((scrapeProgress.total > 0 ? (scrapeProgress.current / scrapeProgress.total) * 100 : 0)) + '%', background: 'linear-gradient(90deg,#7c3aed,#ec4899)', borderRadius: 4, transition: 'width .3s' }} />
                      </div>
                    </div>
                  )}

                  {/* New Videos List */}
                  {scrapeResults.newVideos && scrapeResults.newVideos.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14, marginTop: 16 }}>
                      {scrapeResults.newVideos.map(v => (
                        <div
                          key={v.systemId}
                          style={{
                            padding: 12,
                            borderRadius: 10,
                            background: scrapeSelected.has(v.systemId) ? 'rgba(124, 58, 237, 0.08)' : 'rgba(255,255,255,.02)',
                            border: scrapeSelected.has(v.systemId) ? '1px solid rgba(124, 58, 237, 0.4)' : '1px solid rgba(255,255,255,.06)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 10,
                          }}
                        >
                          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            <input
                              type="checkbox"
                              checked={scrapeSelected.has(v.systemId)}
                              onChange={() => toggleScrapeSelect(v.systemId)}
                              style={{ width: 18, height: 18, accentColor: '#7c3aed', cursor: 'pointer' }}
                            />
                            <div style={{ width: 90, height: 60, borderRadius: 6, overflow: 'hidden', background: '#000', flexShrink: 0, position: 'relative' }}>
                              {v.thumbnail ? (
                                <img src={v.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text3)', fontSize: 11 }}>No Thumb</div>
                              )}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                                <span style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>#{v.systemId}</span>
                                {v.cdnId !== v.systemId && (
                                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>(CDN #{v.cdnId})</span>
                                )}
                                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: v.site === 'desimms' ? 'rgba(124,58,237,.3)' : 'rgba(236,72,153,.3)', color: '#fff' }}>
                                  {v.site}
                                </span>
                              </div>
                              <input
                                type="text"
                                value={v.title}
                                onChange={e => updateScrapeTitle(v.systemId, e.target.value)}
                                style={{ width: '100%', padding: '4px 8px', fontSize: 12, background: 'rgba(0,0,0,.3)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 4, color: '#fff' }}
                                title="Click to edit title"
                              />
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
                            <a href={v.cdnUrl} target="_blank" rel="noreferrer" style={{ color: '#a78bfa', textDecoration: 'none' }}>▶ Play CDN Video</a>
                            <span style={{ color: 'var(--text3)' }}>·</span>
                            <a href={v.postUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--text3)', textDecoration: 'none' }}>🔗 View Post</a>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text3)' }}>
                      🎉 No new videos found! Your gallery is already synchronized with the site.
                    </div>
                  )}

                  {/* Log console */}
                  {scrapeLogs.length > 0 && (
                    <div style={{ marginTop: 16, background: '#090a0f', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, padding: 12, maxHeight: 180, overflowY: 'auto', fontFamily: 'monospace', fontSize: 12, color: '#4ade80' }}>
                      {scrapeLogs.map((log, idx) => (
                        <div key={idx} style={{ marginBottom: 3 }}>{log}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Card 3: Manual Video Add (Thumbnail + Title) */}
              <div className={styles.card} style={{ marginBottom: 20 }}>
                <div className={styles.cardHeader}>
                  <span style={{ fontSize: 24 }}>✍️</span>
                  <div style={{ flex: 1 }}>
                    <h3 className={styles.cardTitle}>Manual Video Add (Thumbnail & Title)</h3>
                    <p className={styles.cardSub}>
                      Manually add or replace a video in Redis. Automatically uploads thumbnail, saves custom title, maps CDN, and extends the gallery range!
                    </p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, margin: '14px 0' }}>
                  <div>
                    <label className={styles.fieldLabel}>Target Site / CDN Source</label>
                    <select
                      value={manualSite}
                      onChange={e => setManualSite(e.target.value)}
                      className={styles.input}
                    >
                      <option value="desimms">DesiMMS (Primary CDN: cdn.desimms.com.co)</option>
                      <option value="hindibf">HindiBF (Extra CDN #2: cdn.hindibf.com.co [+10000])</option>
                    </select>
                  </div>

                  <div>
                    <label className={styles.fieldLabel}>
                      Video ID / CDN ID {manualSite === 'hindibf' && manualCdnId && (
                        <span style={{ color: '#ec4899', fontSize: 11 }}>→ System ID: #{10000 + (parseInt(manualCdnId, 10) || 0)}</span>
                      )}
                    </label>
                    <input
                      type="number"
                      placeholder={manualSite === 'hindibf' ? "e.g. 752 (System #10752)" : "e.g. 1178"}
                      value={manualCdnId}
                      onChange={e => setManualCdnId(e.target.value)}
                      className={styles.input}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label className={styles.fieldLabel}>Video Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Hot Desi Bhabhi Romance with Boyfriend"
                    value={manualTitle}
                    onChange={e => setManualTitle(e.target.value)}
                    className={styles.input}
                  />
                </div>

                {/* Thumbnail Input: File Upload OR Remote URL */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 16 }}>
                  <div>
                    <label className={styles.fieldLabel}>Option A: Upload Image File (auto-resizes to crisp JPEG)</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleManualFileUpload}
                      style={{ padding: '8px 12px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, width: '100%', color: '#fff' }}
                    />
                  </div>

                  <div>
                    <label className={styles.fieldLabel}>Option B: Remote Image URL (server will fetch & convert)</label>
                    <input
                      type="text"
                      placeholder="https://example.com/thumb.jpg"
                      value={manualThumbUrl}
                      onChange={e => { setManualThumbUrl(e.target.value); setManualDataUrl(''); }}
                      className={styles.input}
                    />
                  </div>
                </div>

                {/* Thumbnail Live Preview */}
                {(manualDataUrl || manualThumbUrl) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 12, background: 'rgba(255,255,255,.03)', borderRadius: 10, marginBottom: 16 }}>
                    <div style={{ width: 120, height: 80, borderRadius: 8, overflow: 'hidden', background: '#000', border: '1px solid rgba(255,255,255,.1)' }}>
                      <img src={manualDataUrl || manualThumbUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: '#fff', fontSize: 13 }}>Thumbnail Preview Loaded</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                        {manualDataUrl ? 'Compressed base64 data ready' : 'Will be downloaded & converted by server'}
                      </div>
                    </div>
                  </div>
                )}

                <button
                  className="btn btn-primary"
                  disabled={manualSaving || !manualCdnId || !manualTitle}
                  onClick={handleManualSave}
                  style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  {manualSaving ? '⏳ Saving Video to Redis...' : '💾 Save Video to Database'}
                </button>
              </div>
            </div>
          )}

          {/* ══ USERS ══ */}
          {tab === 'users' && (

            <div className={styles.fadeIn}>

              {/* ─ Registration Approval Toggle ─ */}
              <div className={styles.card} style={{ marginBottom: 20 }}>
                <div className={styles.cardHeader}>
                  <span style={{ fontSize: 22 }}>🔐</span>
                  <div style={{ flex: 1 }}>
                    <h3 className={styles.cardTitle}>Registration Approval</h3>
                    <p className={styles.cardSub}>When ON, new registrations require admin approval before they can log in</p>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                    <span style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 600 }}>{regApproval ? '🟢 ON' : '⚫ OFF'}</span>
                    <div style={{ position: 'relative', width: 44, height: 24 }} onClick={async () => {
                      const next = !regApproval;
                      setRegApproval(next);
                      await fetch('/api/hwasi/reg-approval', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ required: next }) });
                      flash(next ? '🔐 Approval mode ON — new users need admin approval' : '🔓 Open mode — anyone can register instantly');
                    }}>
                      <div style={{
                        position: 'absolute', inset: 0, borderRadius: 12,
                        background: regApproval ? 'linear-gradient(135deg,#7c3aed,#4f46e5)' : 'rgba(255,255,255,.15)',
                        transition: 'background .2s'
                      }} />
                      <div style={{
                        position: 'absolute', top: 3, width: 18, height: 18, borderRadius: '50%', background: '#fff',
                        left: regApproval ? 23 : 3,
                        transition: 'left .2s', boxShadow: '0 1px 4px rgba(0,0,0,.3)'
                      }} />
                    </div>
                  </label>
                </div>
              </div>

              {/* ─ Email OTP Verification Toggle ─ */}
              <div className={styles.card} style={{ marginBottom: 20 }}>
                <div className={styles.cardHeader}>
                  <span style={{ fontSize: 22 }}>📧</span>
                  <div style={{ flex: 1 }}>
                    <h3 className={styles.cardTitle}>Email Verification (OTP)</h3>
                    <p className={styles.cardSub}>When ON, new users must verify email with OTP before logging in. Only works with popular email providers.</p>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                    <span style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 600 }}>{settings.otpRequired ? '🟢 ON' : '⚫ OFF'}</span>
                    <div style={{ position: 'relative', width: 44, height: 24 }} onClick={async () => {
                      const next = !settings.otpRequired;
                      setSettings(s => ({ ...s, otpRequired: next }));
                      await secureFetch('/api/hwasi/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...settings, otpRequired: next }) });
                      flash(next ? '📧 Email OTP ON — users must verify email on register' : '🔓 Email OTP OFF — direct registration, no email needed');
                    }}>
                      <div style={{ position: 'absolute', inset: 0, borderRadius: 12, background: settings.otpRequired ? 'linear-gradient(135deg,#7c3aed,#4f46e5)' : 'rgba(255,255,255,.15)', transition: 'background .2s' }} />
                      <div style={{ position: 'absolute', top: 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', left: settings.otpRequired ? 23 : 3, transition: 'left .2s', boxShadow: '0 1px 4px rgba(0,0,0,.3)' }} />
                    </div>
                  </label>
                </div>
              </div>

              {/* ─ Pending Registrations ─ */}
              {pendingUsers.length > 0 && (
                <div className={styles.card} style={{ marginBottom: 20 }}>
                  <div className={styles.cardHeader}>
                    <span style={{ fontSize: 22 }}>⏳</span>
                    <div><h3 className={styles.cardTitle}>Pending Registrations</h3><p className={styles.cardSub}>{pendingUsers.length} user(s) waiting for approval</p></div>
                    <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={loadAll}>↻ Refresh</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                    {pendingUsers.map(pu => (
                      <div key={pu.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'rgba(124,58,237,.06)', border: '1px solid rgba(124,58,237,.15)', borderRadius: 12, flexWrap: 'wrap' }}>
                        <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg,#7c3aed,#ec4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                          {pu.avatar || pu.displayName?.slice(0, 2)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{pu.displayName}</div>
                          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)' }}>@{pu.username} · {pu.email}</div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>{new Date(pu.createdAt).toLocaleString('en-IN')}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                          <button className="btn btn-primary btn-sm" onClick={async () => {
                            await fetch('/api/hwasi/pending-users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: pu.id, action: 'approve' }) });
                            flash('✅ User approved & can now log in'); loadAll();
                          }}>✓ Approve</button>
                          <button className="btn btn-ghost btn-sm" style={{ color: '#f87171' }} onClick={async () => {
                            await fetch('/api/hwasi/pending-users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: pu.id, action: 'reject' }) });
                            flash('🗑 Registration rejected'); loadAll();
                          }}>✕ Reject</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Create form */}
              <div className={styles.card} style={{ marginBottom: 20 }}>
                <div className={styles.cardHeader}>
                  <span style={{ fontSize: 22 }}>➕</span>
                  <div><h3 className={styles.cardTitle}>Create New User</h3><p className={styles.cardSub}>Add a new viewer or admin account</p></div>
                </div>
                <div className={styles.createGrid}>
                  <div>
                    <label className={styles.fieldLabel}>Display Name</label>
                    <input className="input" placeholder="e.g. John Doe" value={newUser.displayName} onChange={e => setNewUser(p => ({ ...p, displayName: e.target.value }))} />
                  </div>
                  <div>
                    <label className={styles.fieldLabel}>Username</label>
                    <input className="input" placeholder="e.g. johndoe" value={newUser.username} onChange={e => setNewUser(p => ({ ...p, username: e.target.value }))} />
                  </div>
                  <div>
                    <label className={styles.fieldLabel}>Password</label>
                    <input className="input" type="password" placeholder="Strong password" value={newUser.password} onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} />
                  </div>
                  <div>
                    <label className={styles.fieldLabel}>Role</label>
                    <select className="input" value={newUser.role} onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))}>
                      <option value="viewer">Viewer</option>
                      <option value="advisor">Advisor</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
                <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={createUser}>Create User</button>
              </div>

              {/* Users grid — EMS style cards */}
              <div className={styles.usersGrid}>
                {users.map(u => (
                  <div key={u.id} className={styles.userCard}>
                    <div className={styles.userCardTop}>
                      <div className={styles.userCardAvatar} style={{
                        background: u.role === 'admin' ? 'linear-gradient(135deg,#7c3aed,#ec4899)' :
                          u.role === 'advisor' ? 'linear-gradient(135deg,#d97706,#f59e0b)' :
                          'linear-gradient(135deg,#0f766e,#0d9488)'
                      }}>
                        {u.avatar || u.displayName?.slice(0, 2) || '??'}
                      </div>
                      <div className={`${styles.statusDot} ${styles.statusActive}`}>● active</div>
                    </div>
                    <div className={styles.userCardName}>{u.displayName}</div>
                    <div className={styles.userCardEmail}>@{u.username}</div>
                    <div className={styles.userCardRole} style={{
                      background: u.role === 'admin' ? 'rgba(124,58,237,.15)' :
                        u.role === 'advisor' ? 'rgba(217,119,6,.15)' : 'rgba(13,148,136,.15)',
                      color: u.role === 'admin' ? '#a78bfa' :
                        u.role === 'advisor' ? '#fbbf24' : '#2dd4bf',
                      border: `1px solid ${u.role === 'admin' ? 'rgba(124,58,237,.3)' : u.role === 'advisor' ? 'rgba(217,119,6,.3)' : 'rgba(13,148,136,.3)'}`,
                      padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, display: 'inline-block'
                    }}>
                      {u.role === 'admin' ? '👑 Administrator' : u.role === 'advisor' ? '💼 Advisor' : 'Viewer'}
                    </div>
                    <div className={styles.userCardJoined}>Joined {new Date(u.createdAt).toLocaleDateString()}</div>
                    <div className={styles.userCardActions}>
                      <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => setEditUser({ ...u, password: '' })}>
                        <IconEdit /> Edit
                      </button>
                      <button className="btn btn-ghost btn-sm" style={{ flex: 1, color: '#f87171' }} onClick={() => deleteUser(u.id, u.username)}>
                        <IconTrash /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══ PRICING MANAGEMENT ══ */}
          {tab === 'pricing' && (
            <div className={styles.fadeIn}>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <span style={{ fontSize: 22 }}>💰</span>
                  <div><h3 className={styles.cardTitle}>Plan Pricing</h3><p className={styles.cardSub}>Changes apply site-wide immediately</p></div>
                  <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => { fetch('/api/hwasi/plans').then(x => x.json()).then(d => setPlansConfig(d.plans || null)); }}>↻ Refresh</button>
                </div>
                {plansMsg && <div style={{ padding: '8px 14px', borderRadius: 8, background: plansMsg.includes('✅') ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)', color: plansMsg.includes('✅') ? '#4ade80' : '#f87171', marginBottom: 12, fontSize: 13 }}>{plansMsg}</div>}
                {['basic', 'plus', 'pro'].map(key => {
                  const p = (plansConfig || {})[key] || {};
                  const defaultIcons = { basic: '⚡', plus: '🚀', pro: '👑' };
                  return (
                    <div key={key} style={{ border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: 20, marginBottom: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                        <span style={{ fontSize: 24 }}>{defaultIcons[key]}</span>
                        <h4 style={{ margin: 0, fontWeight: 800, fontSize: 16, textTransform: 'capitalize' }}>{p.label || key}</h4>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12 }}>
                        <div>
                          <label className={styles.fieldLabel}>Sale Price (₹)</label>
                          <input className="input" type="number" min="1" value={p.price || ''} onChange={e => setPlansConfig(pc => ({ ...pc, [key]: { ...pc[key], price: Number(e.target.value) } }))} />
                        </div>
                        <div>
                          <label className={styles.fieldLabel}>Original Price (₹) <span style={{ fontSize: 10, color: 'rgba(255,255,255,.4)' }}>crossed-out</span></label>
                          <input className="input" type="number" min="1" value={p.originalPrice || ''} onChange={e => setPlansConfig(pc => ({ ...pc, [key]: { ...pc[key], originalPrice: Number(e.target.value) } }))} />
                        </div>
                        <div>
                          <label className={styles.fieldLabel}>Duration (days)</label>
                          <input className="input" type="number" min="1" value={p.days || ''} onChange={e => setPlansConfig(pc => ({ ...pc, [key]: { ...pc[key], days: Number(e.target.value) } }))} />
                        </div>
                        <div>
                          <label className={styles.fieldLabel}>Label</label>
                          <input className="input" value={p.label || key} onChange={e => setPlansConfig(pc => ({ ...pc, [key]: { ...pc[key], label: e.target.value } }))} />
                        </div>
                      </div>
                      {p.price && p.originalPrice && (
                        <div style={{ marginTop: 10, fontSize: 12, color: 'rgba(255,255,255,.4)' }}>
                          Savings: ₹{(p.originalPrice - p.price)} · {Math.round((p.originalPrice - p.price) / p.originalPrice * 100)}% off
                        </div>
                      )}
                    </div>
                  );
                })}
                <button
                  className="btn btn-primary"
                  disabled={plansSaving || !plansConfig}
                  onClick={async () => {
                    setPlansSaving(true); setPlansMsg('');
                    const r = await fetch('/api/hwasi/plans', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(plansConfig) });
                    const d = await r.json();
                    setPlansSaving(false);
                    if (d.ok) { setPlansConfig(d.plans); setPlansMsg('✅ Plans saved! Changes are live for all users.'); }
                    else setPlansMsg('❌ Failed to save: ' + (d.error || 'unknown error'));
                    setTimeout(() => setPlansMsg(''), 4000);
                  }}
                >
                  {plansSaving ? 'Saving...' : '💾 Save All Plans'}
                </button>
              </div>

              {/* ── Payment System Settings ── */}
              <div className={styles.card} style={{ marginTop: 20 }}>
                <div className={styles.cardHeader}>
                  <span style={{ fontSize: 22 }}>🛠</span>
                  <div><h3 className={styles.cardTitle}>Payment System</h3><p className={styles.cardSub}>Maintenance mode · UPI ID · QR Code</p></div>
                </div>
                {paySettingsMsg && <div style={{ padding: '8px 14px', borderRadius: 8, background: paySettingsMsg.includes('✅') ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)', color: paySettingsMsg.includes('✅') ? '#4ade80' : '#f87171', marginBottom: 12, fontSize: 13 }}>{paySettingsMsg}</div>}

                {/* Maintenance toggle */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'rgba(255,255,255,.04)', borderRadius: 12, border: '1px solid rgba(255,255,255,.08)', marginBottom: 14 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>🚧 Maintenance Mode</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>When ON — payment page shows "Under Maintenance" to all users</div>
                  </div>
                  <div onClick={() => setPaySettings(p => ({ ...p, maintenanceMode: !p.maintenanceMode }))}
                    style={{ width: 48, height: 26, borderRadius: 13, background: paySettings.maintenanceMode ? '#10b981' : 'rgba(255,255,255,.15)', cursor: 'pointer', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
                    <div style={{ position: 'absolute', top: 3, left: paySettings.maintenanceMode ? 24 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
                  </div>
                </div>

                {/* UPI ID */}
                <div style={{ marginBottom: 12 }}>
                  <label className={styles.fieldLabel}>💳 UPI ID</label>
                  <input className="input" placeholder="e.g. yourname@upi" value={paySettings.upiId || ''}
                    onChange={e => setPaySettings(p => ({ ...p, upiId: e.target.value }))} />
                </div>

                {/* QR Code URL */}
                <div style={{ marginBottom: 16 }}>
                  <label className={styles.fieldLabel}>📷 QR Code Image URL</label>
                  <input className="input" placeholder="https://i.imgur.com/yourqr.png" value={paySettings.qrUrl || ''}
                    onChange={e => setPaySettings(p => ({ ...p, qrUrl: e.target.value }))} />
                  {paySettings.qrUrl && <img src={paySettings.qrUrl} alt="QR Preview" style={{ marginTop: 10, width: 120, height: 120, objectFit: 'contain', borderRadius: 8, border: '1px solid rgba(255,255,255,.1)' }} />}
                </div>

                <button className="btn btn-primary" disabled={paySettingsSaving}
                  onClick={async () => {
                    setPaySettingsSaving(true); setPaySettingsMsg('');
                    const r = await fetch('/api/hwasi/payment-settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(paySettings) });
                    const d = await r.json();
                    setPaySettingsSaving(false);
                    if (d.ok) { setPaySettings(d.settings); setPaySettingsMsg('✅ Payment settings saved!'); }
                    else setPaySettingsMsg('❌ Failed to save');
                    setTimeout(() => setPaySettingsMsg(''), 3000);
                  }}
                >{paySettingsSaving ? 'Saving...' : '💾 Save Payment Settings'}</button>
              </div>

                            {/* ── Key Submissions & Activations (Replaced UTR Submissions) ── */}
              <div className={styles.card} style={{ marginTop: 20 }}>
                <div className={styles.cardHeader}>
                  <span style={{ fontSize: 22 }}>🔑</span>
                  <div>
                    <h3 className={styles.cardTitle}>Key Submissions &amp; Redemptions</h3>
                    <p className={styles.cardSub}>
                      {utrList.filter(u => u.type === 'access_key' || (u.utrId && u.utrId.startsWith('FC-')) || u.code).length} access keys activated · {utrList.length} total payments
                    </p>
                  </div>
                  <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => fetch('/api/hwasi/utr').then(x => x.json()).then(d => setUtrList(d.submissions || []))}>
                    ↻ Refresh
                  </button>
                </div>

                {/* Filter tabs */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                  {[
                    { key: 'all',      label: '📋 All Payments', color: '#a78bfa', count: utrList.length },
                    { key: 'keys',     label: '🔑 Access Keys',  color: '#38bdf8', count: utrList.filter(u => u.type === 'access_key' || (u.utrId && u.utrId.startsWith('FC-')) || u.code).length },
                    { key: 'basic',    label: '⚡ Basic',        color: '#7c3aed', count: utrList.filter(u => (u.plan || '').toLowerCase().includes('basic')).length },
                    { key: 'plus',     label: '🚀 Plus',         color: '#0ea5e9', count: utrList.filter(u => (u.plan || '').toLowerCase().includes('plus')).length },
                    { key: 'pro',      label: '👑 Pro',          color: '#f59e0b', count: utrList.filter(u => (u.plan || '').toLowerCase().includes('pro')).length },
                  ].map(f => (
                    <button
                      key={f.key}
                      onClick={() => setUtrFilter(f.key)}
                      style={{
                        padding: '6px 14px', borderRadius: 10, border: '1px solid ' + (utrFilter === f.key ? f.color + '88' : 'rgba(255,255,255,.1)'),
                        background: utrFilter === f.key ? f.color + '18' : 'rgba(255,255,255,.03)',
                        color: utrFilter === f.key ? f.color : 'rgba(255,255,255,.5)',
                        fontWeight: utrFilter === f.key ? 700 : 500, fontSize: 12, cursor: 'pointer', transition: 'all .15s',
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}
                    >
                      {f.label}
                      <span style={{ padding: '1px 7px', borderRadius: 20, background: utrFilter === f.key ? f.color + '33' : 'rgba(255,255,255,.08)', fontSize: 11, fontWeight: 700 }}>{f.count}</span>
                    </button>
                  ))}
                </div>

                {(() => {
                  const filtered = utrFilter === 'all' ? utrList
                    : utrFilter === 'keys' ? utrList.filter(u => u.type === 'access_key' || (u.utrId && u.utrId.startsWith('FC-')) || u.code)
                    : utrFilter === 'basic' ? utrList.filter(u => (u.plan || '').toLowerCase().includes('basic'))
                    : utrFilter === 'plus' ? utrList.filter(u => (u.plan || '').toLowerCase().includes('plus'))
                    : utrList.filter(u => (u.plan || '').toLowerCase().includes('pro'));

                  if (filtered.length === 0) return (
                    <p style={{ color: 'var(--text3)', textAlign: 'center', padding: '24px 0' }}>
                      {utrList.length === 0 ? 'No key redemptions or payments yet' : 'No records found for this filter'}
                    </p>
                  );

                  return (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ color: 'var(--text3)', fontSize: 11, textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                            <th style={{ padding: '10px 10px', textAlign: 'left' }}>User</th>
                            <th style={{ padding: '10px 10px', textAlign: 'left' }}>Access Key / Code</th>
                            <th style={{ padding: '10px 10px', textAlign: 'left' }}>Plan &amp; Duration</th>
                            <th style={{ padding: '10px 10px', textAlign: 'left' }}>Amount</th>
                            <th style={{ padding: '10px 10px', textAlign: 'left' }}>Redeemed At</th>
                            <th style={{ padding: '10px 10px', textAlign: 'left' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((u, fi) => {
                            const isKey = u.type === 'access_key' || (u.utrId && u.utrId.startsWith('FC-')) || u.code;
                            const keyVal = u.code || u.utrId || '—';
                            const planKey = (u.plan || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                            const planColors = { basic: '#7c3aed', plus: '#0ea5e9', pro: '#f59e0b' };
                            const planColor = planColors[planKey] || '#a78bfa';
                            const planName = u.planName || (planKey.charAt(0).toUpperCase() + planKey.slice(1));
                            const days = u.days ? u.days + ' Days' : (planKey === 'pro' ? '730 Days' : planKey === 'plus' ? '90 Days' : '20 Days');
                            const price = u.priceINR ? '₹' + u.priceINR : (planKey === 'pro' ? '₹599' : planKey === 'plus' ? '₹300' : '₹100');

                            return (
                              <tr key={fi} style={{ borderTop: '1px solid rgba(255,255,255,.05)' }}>
                                <td style={{ padding: '12px 10px' }}>
                                  <div style={{ fontWeight: 700, color: 'var(--text1)' }}>{u.displayName || u.username}</div>
                                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>@{u.username} · ID: {u.userId || '—'}</div>
                                </td>
                                <td style={{ padding: '12px 10px' }}>
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    <code style={{ fontFamily: 'monospace', color: isKey ? '#38bdf8' : '#a78bfa', fontWeight: 800, fontSize: 13, background: isKey ? 'rgba(14,165,233,.12)' : 'rgba(124,58,237,.1)', padding: '4px 8px', borderRadius: 6, border: '1px solid ' + (isKey ? 'rgba(14,165,233,.3)' : 'rgba(124,58,237,.3)') }}>
                                      {keyVal}
                                    </code>
                                    <button
                                      title="Copy Key"
                                      onClick={() => navigator.clipboard.writeText(keyVal)}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 12 }}
                                    >
                                      📋
                                    </button>
                                  </div>
                                </td>
                                <td style={{ padding: '12px 10px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ padding: '3px 10px', borderRadius: 100, background: planColor + '22', border: '1px solid ' + planColor + '55', fontSize: 11, fontWeight: 700, color: planColor }}>
                                      {planName}
                                    </span>
                                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,.5)' }}>({days})</span>
                                  </div>
                                </td>
                                <td style={{ padding: '12px 10px' }}>
                                  <span style={{ fontSize: 13, fontWeight: 800, color: '#34d399' }}>{price}</span>
                                </td>
                                <td style={{ padding: '12px 10px', fontSize: 11, color: 'rgba(255,255,255,.4)', whiteSpace: 'nowrap' }}>
                                  {u.timestamp ? new Date(u.timestamp).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                                </td>
                                <td style={{ padding: '12px 10px' }}>
                                  <span style={{ padding: '4px 10px', borderRadius: 100, background: 'rgba(16,185,129,.15)', color: '#34d399', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    <span>✅</span> {isKey ? 'Activated (ForCloud)' : 'Approved'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>

              {/* ── Free Watch Limit ── */}
              <div className={styles.card} style={{ marginTop: 20 }}>
                <div className={styles.cardHeader}>
                  <span style={{ fontSize: 22 }}>👁️</span>
                  <div>
                    <h3 className={styles.cardTitle}>Free Watch Limit</h3>
                    <p className={styles.cardSub}>Daily free video limit for non-premium users (default: 5)</p>
                  </div>
                </div>
                {watchLimitMsg && <div style={{ padding: '8px 14px', borderRadius: 8, background: watchLimitMsg.includes('✅') ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)', color: watchLimitMsg.includes('✅') ? '#4ade80' : '#f87171', marginBottom: 12, fontSize: 13 }}>{watchLimitMsg}</div>}
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
                  <div style={{ flex: '0 0 160px' }}>
                    <label className={styles.fieldLabel}>Daily Limit (Videos)</label>
                    <input className="input" type="number" min="1" max="100" value={watchLimit.limit}
                      onChange={e => setWatchLimit(p => ({ ...p, limit: Number(e.target.value) }))} />
                  </div>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <label className={styles.fieldLabel}>Custom Message (shown to free users when limit hit)</label>
                    <input className="input" placeholder="e.g. 🎉 Limit increased to 10 today only! Enjoy!" value={watchLimit.msg}
                      onChange={e => setWatchLimit(p => ({ ...p, msg: e.target.value }))} />
                  </div>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>
                  📋 Each user account gets their own daily limit (resets at midnight UTC). When they hit the limit, they see an upgrade prompt. If you set a message above, it will replace the default "upgrade" text.
                </p>
                <button className="btn btn-primary" disabled={watchLimitSaving} onClick={async () => {
                  setWatchLimitSaving(true); setWatchLimitMsg('');
                  const r = await fetch('/api/hwasi/watch-limit', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(watchLimit) });
                  const d = await r.json();
                  setWatchLimitSaving(false);
                  if (d.ok) setWatchLimitMsg('✅ Watch limit saved!');
                  else setWatchLimitMsg('❌ Failed to save');
                  setTimeout(() => setWatchLimitMsg(''), 3000);
                }}>📺 Save Watch Limit</button>
              </div>
            </div>
          )}


          {tab === 'devices' && (
            <div className={styles.fadeIn}>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <span style={{ fontSize: 22 }}>🔒</span>
                  <div>
                    <h3 className={styles.cardTitle}>Device Security</h3>
                    <p className={styles.cardSub}>Accounts with &gt;3 unique device fingerprints are auto-flagged</p>
                  </div>
                  <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => { secureFetch('/api/hwasi/devices').then(x => x.json()).then(d => setDeviceData(d.devices || {})); }}>↻ Refresh</button>
                </div>

                {/* Search + Filter bar */}
                {Object.keys(deviceData).length > 0 && (
                  <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input
                      className="input" style={{ flex: 1, minWidth: 200, padding: '8px 14px', fontSize: 13 }}
                      placeholder="🔍 Search by username or display name..."
                      value={deviceSearch}
                      onChange={e => setDeviceSearch(e.target.value)}
                    />
                    {[['all', 'All Users'], ['1', '1 Device'], ['2', '2 Devices'], ['3plus', '3+ Devices'], ['5plus', '5+ Devices']].map(([val, label]) => (
                      <button key={val}
                        onClick={() => setDeviceFilter(val)}
                        style={{
                          padding: '7px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none',
                          background: deviceFilter === val ? 'rgba(139,92,246,.4)' : 'rgba(255,255,255,.07)',
                          color: deviceFilter === val ? '#e9d5ff' : 'rgba(255,255,255,.6)',
                          transition: 'all .15s'
                        }}
                      >{label}</button>
                    ))}
                  </div>
                )}

                {Object.keys(deviceData).length === 0 ? (
                  <p style={{ color: 'var(--text3)', textAlign: 'center', padding: '32px 0' }}>No device data yet. Data appears once users log in.</p>
                ) : (() => {
                  // Apply search + filter
                  const entries = Object.entries(deviceData).filter(([uid, entry]) => {
                    const devCount = Object.keys(entry.devices || {}).length;
                    const matchSearch = !deviceSearch ||
                      (entry.username || '').toLowerCase().includes(deviceSearch.toLowerCase()) ||
                      (entry.displayName || '').toLowerCase().includes(deviceSearch.toLowerCase());
                    const matchFilter =
                      deviceFilter === 'all' ? true :
                      deviceFilter === '1'     ? devCount === 1 :
                      deviceFilter === '2'     ? devCount === 2 :
                      deviceFilter === '3plus' ? devCount >= 3 :
                      deviceFilter === '5plus' ? devCount >= 5 : true;
                    return matchSearch && matchFilter;
                  });
                  if (entries.length === 0) return <p style={{ color: 'var(--text3)', textAlign: 'center', padding: '24px 0' }}>No users match this filter.</p>;
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
                      {entries.map(([uid, entry]) => (
                        <div key={uid} style={{ padding: 16, background: entry.blocked ? 'rgba(239,68,68,.08)' : entry.flagged ? 'rgba(245,158,11,.08)' : 'rgba(255,255,255,.03)', border: `1px solid ${entry.blocked ? 'rgba(239,68,68,.25)' : entry.flagged ? 'rgba(245,158,11,.25)' : 'rgba(255,255,255,.08)'}`, borderRadius: 14 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                            <div style={{ fontWeight: 700 }}>{entry.displayName || entry.username || `User #${uid}`}</div>
                            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)' }}>@{entry.username}</div>
                            {entry.blocked && <span style={{ padding: '2px 8px', borderRadius: 10, background: 'rgba(239,68,68,.2)', color: '#f87171', fontSize: 11, fontWeight: 700 }}>🚫 BLOCKED</span>}
                            {entry.flagged && !entry.blocked && <span style={{ padding: '2px 8px', borderRadius: 10, background: 'rgba(245,158,11,.2)', color: '#fbbf24', fontSize: 11, fontWeight: 700 }}>⚠️ FLAGGED — sharing suspected</span>}
                            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ fontSize: 12, color: 'rgba(255,255,255,.4)' }}>{Object.keys(entry.devices || {}).length} device{Object.keys(entry.devices || {}).length !== 1 ? 's' : ''} seen</span>
                              {/* Remove entire user row from device security (for deleted accounts) */}
                              <button
                                title="Remove this user from Device Security list (for deleted accounts)"
                                onClick={async () => {
                                  if (!confirm(`Remove "${entry.username || uid}" completely from device security list?\nThis won't affect their account — only removes them from this view.`)) return;
                                  const r = await fetch('/api/hwasi/devices', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: uid, removeUser: true }) });
                                  if (r.ok) {
                                    setDeviceData(d => { const updated = { ...d }; delete updated[uid]; return updated; });
                                    flash(`✅ ${entry.username || uid} removed from device list`);
                                  }
                                }}
                                style={{ width: 24, height: 24, borderRadius: '50%', border: '1px solid rgba(255,255,255,.15)', background: 'rgba(100,100,100,.2)', color: 'rgba(255,255,255,.5)', fontSize: 13, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, lineHeight: 1 }}
                              >✕</button>
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                            {Object.entries(entry.devices || {}).map(([fp, dev], i) => {
                              const lbl = (dev.label || '').toLowerCase();
                              const icon = lbl.includes('iphone') || lbl.includes('ios') ? '🍎' :
                                lbl.includes('android') ? '🤖' :
                                lbl.includes('ipad') ? '📱' :
                                lbl.includes('windows') ? '🪟' :
                                lbl.includes('mac') || lbl.includes('macos') ? '🍏' :
                                lbl.includes('linux') ? '🐧' : '💻';
                              return (
                                <div key={fp} style={{ padding: '7px 10px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8, minWidth: 160, position: 'relative' }}>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 5 }}>
                                      <span>{icon}</span> {dev.label || `Device ${i + 1}`}
                                    </div>
                                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', marginTop: 2 }}>
                                      First: {new Date(dev.firstSeen).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                                      {' · '}Last: {new Date(dev.lastSeen).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                                    </div>
                                  </div>
                                  {/* ✕ Remove this device fingerprint */}
                                  <button
                                    title="Remove this device"
                                    onClick={async () => {
                                      if (!confirm(`Remove "${dev.label || 'device'}" from ${entry.username}? They can re-add it on next login.`)) return;
                                      const r = await fetch('/api/hwasi/devices', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: uid, fingerprint: fp }) });
                                      if (r.ok) {
                                        setDeviceData(d => {
                                          const updated = { ...d };
                                          const newDevices = { ...updated[uid].devices };
                                          delete newDevices[fp];
                                          updated[uid] = { ...updated[uid], devices: newDevices, flagged: Object.keys(newDevices).length > 3 };
                                          return updated;
                                        });
                                        flash(`✅ Device removed from ${entry.username}`);
                                      }
                                    }}
                                    style={{ width: 22, height: 22, borderRadius: '50%', border: 'none', background: 'rgba(239,68,68,.18)', color: '#f87171', fontSize: 12, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, lineHeight: 1 }}>
                                    ✕
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.25)', marginBottom: 8 }}>
                            Hardware fingerprints — same across all browsers (Chrome/Brave/Firefox) on same physical device
                          </div>
                          {user?.role === 'admin' && (
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              {!entry.blocked ? (
                                <button
                                  style={{ padding: '7px 16px', borderRadius: 10, border: 'none', background: 'rgba(239,68,68,.15)', color: '#f87171', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}
                                  onClick={() => { setBlockReason(''); setBlockModal({ uid, displayName: entry.displayName, username: entry.username }); }}
                                >🚫 Block Account</button>
                              ) : (
                                <button
                                  style={{ padding: '7px 16px', borderRadius: 10, border: 'none', background: 'rgba(34,197,94,.15)', color: '#4ade80', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}
                                  onClick={async () => {
                                    await fetch('/api/hwasi/devices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: uid, blocked: false }) });
                                    setDeviceData(d => ({ ...d, [uid]: { ...d[uid], blocked: false, flagged: false } }));
                                    flash(`✅ Unblocked ${entry.displayName || entry.username}`);
                                  }}
                                >✅ Unblock Account</button>
                              )}
                              <button
                                style={{ padding: '7px 16px', borderRadius: 10, border: '1px solid rgba(251,191,36,.3)', background: 'rgba(251,191,36,.1)', color: '#fbbf24', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}
                                onClick={() => { setDeviceMsgText(''); setDeviceMsgModal({ uid, displayName: entry.displayName, username: entry.username }); }}
                              >💬 Send Warning</button>
                              {/* Clear ALL devices for this user */}
                              <button
                                style={{ padding: '7px 16px', borderRadius: 10, border: '1px solid rgba(239,68,68,.25)', background: 'rgba(239,68,68,.08)', color: '#fca5a5', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}
                                onClick={async () => {
                                  if (!confirm(`Clear ALL device history for ${entry.username}? They can re-login on a new device.`)) return;
                                  const r = await fetch('/api/hwasi/devices', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: uid, clearAll: true }) });
                                  if (r.ok) {
                                    setDeviceData(d => ({ ...d, [uid]: { ...d[uid], devices: {}, flagged: false } }));
                                    flash(`✅ All devices cleared for ${entry.username}`);
                                  }
                                }}
                              >🗑 Clear All Devices</button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                  );
                })()}
              </div>
            </div>
          )}

          {/* ══ REPORTS ══ */}
          {tab === 'reports' && (
            <div className={styles.fadeIn}>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <span style={{ fontSize: 22 }}>🚩</span>
                  <div><h3 className={styles.cardTitle}>Reported Videos</h3><p className={styles.cardSub}>{reportsList.length} video(s) reported</p></div>
                  <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={loadAll}>↻ Refresh</button>
                </div>
                {reportsList.length === 0 ? (
                  <p style={{ color: 'var(--text3)', textAlign: 'center', padding: '32px 0' }}>No reports yet 🎉</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                    {reportsList.map(r => (
                      <div key={r.videoId} style={{ padding: 16, background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.15)', borderRadius: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>

                          {/* Play Preview Button */}
                          <button style={{
                            background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)',
                            color: '#f87171', fontSize: 15, fontWeight: 800, padding: '4px 10px', borderRadius: 8,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
                          }} onClick={async () => {
                            setPreviewVideo({ id: r.videoId, loading: true, src: null });
                            const sd = await fetch(`/api/hwasi/sign/${r.videoId}`).then(x => x.json()).catch(() => ({}));
                            setPreviewVideo({ id: r.videoId, loading: false, src: sd.src });
                          }}>
                            ▶ Video #{r.videoId}
                          </button>

                          <span style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', background: 'rgba(255,255,255,.06)', padding: '2px 10px', borderRadius: 100 }}>{r.reports.length} report{r.reports.length !== 1 ? 's' : ''}</span>
                          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                            <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => {
                              fetch(`/api/hwasi/reports`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoId: r.videoId }) })
                                .then(() => { flash('✅ Reports cleared'); loadAll(); });
                            }}>✓ Clear Reports</button>
                            <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: '#f87171' }} onClick={async () => {
                              const reason = prompt('Delete reason: duplicate/fake/nothing/broken/restricted', 'broken');
                              if (!reason) return;
                              await fetch(`/api/hwasi/video/${r.videoId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) });
                              await fetch(`/api/hwasi/reports`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoId: r.videoId }) });
                              flash('🗑 Video deleted & reports cleared'); loadAll();
                            }}>🗑 Delete Video</button>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {r.reports.map((rep, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgba(255,255,255,.6)' }}>
                              <span style={{ color: '#a78bfa', fontWeight: 700 }}>@{rep.username}</span>
                              <span style={{ background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.2)', color: '#f87171', padding: '1px 8px', borderRadius: 100, fontSize: 11 }}>{rep.reason}</span>
                              <span>{new Date(rep.timestamp).toLocaleString('en-IN')}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ DELETED VIDEOS ══ */}
          {tab === 'deleted' && (
            <div className={styles.fadeIn}>

              {/* Direct Delete Card */}
              <div className={styles.card} style={{ marginBottom: 20 }}>
                <div className={styles.cardHeader}>
                  <span style={{ fontSize: 22 }}>🎯</span>
                  <div><h3 className={styles.cardTitle}>Direct Delete</h3><p className={styles.cardSub}>Instantly delete a video by its ID</p></div>
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <label className={styles.fieldLabel}>Video ID</label>
                    <input className="input" type="number" placeholder="e.g. 142"
                      value={directDelForm.id} onChange={e => setDirectDelForm(p => ({ ...p, id: e.target.value }))} />
                  </div>
                  <div style={{ flex: 2, minWidth: 180 }}>
                    <label className={styles.fieldLabel}>Reason</label>
                    <select className="input" value={directDelForm.reason} onChange={e => setDirectDelForm(p => ({ ...p, reason: e.target.value }))}>
                      <option value="duplicate">Duplicate</option>
                      <option value="low_quality">Low Quality / Error</option>
                      <option value="violation">TOS Violation</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <button className="btn btn-primary" style={{ background: 'linear-gradient(135deg,#ef4444,#b91c1c)' }} disabled={!directDelForm.id} onClick={async () => {
                    if (!confirm(`Are you sure you want to delete Video #${directDelForm.id}?`)) return;
                    const r = await fetch(`/api/hwasi/video/${directDelForm.id}`, {
                      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ reason: directDelForm.reason })
                    });
                    if (r.ok) { flash(`✅ Video #${directDelForm.id} deleted successfully`); loadAll(); setDirectDelForm(p => ({ ...p, id: '' })); }
                    else flash(`❌ Failed to delete video #${directDelForm.id}`, 'err');
                  }}>🗑 Delete Video</button>
                </div>
              </div>

              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <span style={{ fontSize: 22 }}>🗑</span>
                  <div><h3 className={styles.cardTitle}>Deleted Videos Audit</h3><p className={styles.cardSub}>{deletedList.length} deletion(s) logged</p></div>
                  <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={loadAll}>↻ Refresh</button>
                </div>
                {deletedList.length === 0 ? (
                  <p style={{ color: 'var(--text3)', textAlign: 'center', padding: '32px 0' }}>No deletions yet</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12, fontSize: 13 }}>
                    <thead>
                      <tr style={{ color: 'var(--text3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Video #</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Reason</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Deleted By</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Role</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deletedList.map((d, i) => (
                        <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,.05)' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 700, color: '#a78bfa' }}>#{d.id}</td>
                          <td style={{ padding: '10px 12px' }}><span style={{ background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.2)', color: '#f87171', padding: '2px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700 }}>{d.reason}</span></td>
                          <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,.7)' }}>@{d.deletedBy}</td>
                          <td style={{ padding: '10px 12px' }}><span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: d.role === 'admin' ? 'rgba(236,72,153,.15)' : 'rgba(59,130,246,.15)', color: d.role === 'admin' ? '#ec4899' : '#60a5fa' }}>{d.role}</span></td>
                          <td style={{ padding: '10px 12px', fontSize: 11, color: 'rgba(255,255,255,.4)' }}>{new Date(d.timestamp).toLocaleString('en-IN')}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <button
                              style={{ padding: '5px 14px', borderRadius: 8, border: '1px solid rgba(34,197,94,.3)', background: 'rgba(34,197,94,.1)', color: '#4ade80', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}
                              onClick={async () => {
                                if (!confirm(`Restore video #${d.id} back to the gallery?`)) return;
                                const r = await fetch('/api/hwasi/restore-video', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: String(d.id) }) });
                                if (r.ok) { flash(`✅ Video #${d.id} restored!`); loadAll(); }
                                else flash('❌ Restore failed', 'err');
                              }}
                            >↩ Restore</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ══ ANALYTICS ══ */}
          {tab === 'analytics' && (
            <div className={styles.fadeIn}>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <span style={{ fontSize: 22 }}>📊</span>
                  <div><h3 className={styles.cardTitle}>Watch Analytics</h3><p className={styles.cardSub}>{filteredHistory.length} entries</p></div>
                  <div style={{ marginLeft: 'auto' }}>
                    <input className="input" style={{ width: 240 }} placeholder="Filter by user or video ID…"
                      value={histFilter} onChange={e => setHistFilter(e.target.value)} />
                  </div>
                </div>
                <div className={styles.table}>
                  <div className={styles.tableHead}>
                    <span>User</span><span>Video</span><span>Watched At</span>
                  </div>
                  {filteredHistory.length === 0 && <div className={styles.emptyState}>No watch history yet.</div>}
                  {filteredHistory.slice(0, 200).map((h, i) => (
                    <div key={i} className={styles.tableRow}>
                      <div className={styles.tableUser}>
                        <div className={styles.tableAvatar}>{h.displayName?.slice(0, 2) || h.username?.slice(0, 2) || '??'}</div>
                        <div>
                          <div className={styles.tableName}>{h.displayName || h.username}</div>
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
          
          {/* ══ SUPPORT TICKETS MANAGEMENT (Side-by-side layout) ══ */}
          {tab === 'tickets' && (
            <div className={styles.fadeIn}>
              <div className={styles.cardHeader} style={{ marginBottom: 16 }}>
                <span style={{ fontSize: 24 }}>🎧</span>
                <div>
                  <h3 className={styles.cardTitle}>Support Tickets Help Desk</h3>
                  <p className={styles.cardSub}>
                    {adminTickets.filter(t => t.status === 'open' || !t.status).length} open tickets needing response · {adminTickets.length} total
                  </p>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ marginLeft: 'auto' }}
                  onClick={fetchAdminTickets}
                >
                  ↻ Refresh Tickets
                </button>
              </div>

              {/* Side-by-side Layout */}
              <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 16, alignItems: 'start' }}>
                {/* Left Panel: Ticket List */}
                <div className={styles.card} style={{ padding: 16 }}>
                  {/* Search box */}
                  <div style={{ marginBottom: 10 }}>
                    <input
                      className="input input-sm"
                      placeholder="Search tickets by ID, username, subject..."
                      value={ticketSearch}
                      onChange={e => setTicketSearch(e.target.value)}
                      style={{ width: '100%', fontSize: 12 }}
                    />
                  </div>

                  {/* Filter pills */}
                  <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
                    {[
                      { key: 'all', label: 'All', count: adminTickets.length },
                      { key: 'open', label: '⏳ Open', count: adminTickets.filter(t => t.status === 'open' || !t.status).length },
                      { key: 'replied', label: '💬 Replied', count: adminTickets.filter(t => t.status === 'replied').length },
                      { key: 'resolved', label: '✅ Resolved', count: adminTickets.filter(t => t.status === 'resolved').length },
                    ].map(f => (
                      <button
                        key={f.key}
                        onClick={() => setAdminTicketFilter(f.key)}
                        style={{
                          padding: '4px 10px', borderRadius: 8,
                          border: '1px solid ' + (adminTicketFilter === f.key ? 'var(--accent)' : 'rgba(255,255,255,.08)'),
                          background: adminTicketFilter === f.key ? 'var(--accent-s)' : 'rgba(255,255,255,.03)',
                          color: adminTicketFilter === f.key ? 'var(--accent)' : 'rgba(255,255,255,.5)',
                          fontSize: 11, fontWeight: 700, cursor: 'pointer'
                        }}
                      >
                        {f.label} ({f.count})
                      </button>
                    ))}
                  </div>

                  {/* List of tickets */}
                  {ticketsLoading ? (
                    <div style={{ textAlign: 'center', padding: 30, color: 'var(--text3)' }}>Loading tickets...</div>
                  ) : (() => {
                    const q = ticketSearch.trim().toLowerCase();
                    const filtered = adminTickets.filter(t => {
                      const matchFilter = adminTicketFilter === 'all' ? true
                        : adminTicketFilter === 'open' ? (t.status === 'open' || !t.status)
                        : t.status === adminTicketFilter;

                      if (!matchFilter) return false;
                      if (!q) return true;
                      return (
                        (t.id || '').toLowerCase().includes(q) ||
                        (t.username || '').toLowerCase().includes(q) ||
                        (t.displayName || '').toLowerCase().includes(q) ||
                        (t.subject || '').toLowerCase().includes(q) ||
                        (t.category || '').toLowerCase().includes(q)
                      );
                    });

                    if (filtered.length === 0) {
                      return (
                        <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text3)', fontSize: 13 }}>
                          No tickets matching filter
                        </div>
                      );
                    }

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '650px', overflowY: 'auto' }}>
                        {filtered.map(t => {
                          const isSel = selectedTicket?.id === t.id;
                          const st = t.status || 'open';
                          const stBadge = st === 'resolved' ? { bg: 'rgba(16,185,129,.15)', text: '#34d399', icon: '✅' }
                            : st === 'replied' ? { bg: 'rgba(14,165,233,.15)', text: '#38bdf8', icon: '💬' }
                            : { bg: 'rgba(245,158,11,.15)', text: '#fbbf24', icon: '⏳' };

                          return (
                            <div
                              key={t.id}
                              onClick={() => { setSelectedTicket(t); setAdminReplyMsg(null); }}
                              style={{
                                padding: 12, borderRadius: 10, cursor: 'pointer',
                                background: isSel ? 'rgba(124,58,237,.15)' : 'rgba(255,255,255,.03)',
                                border: '1px solid ' + (isSel ? 'var(--accent)' : 'rgba(255,255,255,.06)'),
                                transition: 'all .15s'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 800, color: '#a78bfa' }}>
                                  #{t.id}
                                </span>
                                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 100, background: stBadge.bg, color: stBadge.text }}>
                                  {stBadge.icon} {st}
                                </span>
                              </div>
                              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text1)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {t.subject}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,.4)' }}>
                                <span>@{t.username}</span>
                                <span>{new Date(t.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

                {/* Right Panel: Selected Ticket Details & Reply Editor */}
                <div className={styles.card} style={{ minHeight: 450, padding: 20 }}>
                  {!selectedTicket ? (
                    <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text3)' }}>
                      <div style={{ fontSize: 44, marginBottom: 12 }}>📬</div>
                      <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text2)', marginBottom: 6 }}>No Ticket Selected</div>
                      <div style={{ fontSize: 13 }}>Click on any ticket from the left panel to inspect details and send a reply.</div>
                    </div>
                  ) : (
                    <div>
                      {/* Ticket Header */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, borderBottom: '1px solid rgba(255,255,255,.08)', paddingBottom: 16, marginBottom: 16 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 900, color: '#a78bfa', background: 'rgba(124,58,237,.15)', padding: '3px 10px', borderRadius: 8 }}>
                              #{selectedTicket.id}
                            </span>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 8, background: 'rgba(255,255,255,.08)', color: 'var(--text2)' }}>
                              {selectedTicket.category || 'General'}
                            </span>
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>
                              Submitted {new Date(selectedTicket.createdAt).toLocaleString('en-IN')}
                            </span>
                          </div>
                          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text1)', margin: 0 }}>
                            {selectedTicket.subject}
                          </h2>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{
                            padding: '6px 14px', borderRadius: 100, fontSize: 12, fontWeight: 800,
                            background: selectedTicket.status === 'resolved' ? 'rgba(16,185,129,.15)' : selectedTicket.status === 'replied' ? 'rgba(14,165,233,.15)' : 'rgba(245,158,11,.15)',
                            color: selectedTicket.status === 'resolved' ? '#34d399' : selectedTicket.status === 'replied' ? '#38bdf8' : '#fbbf24',
                            textTransform: 'uppercase', letterSpacing: '.04em'
                          }}>
                            {selectedTicket.status || 'open'}
                          </span>
                        </div>
                      </div>

                      {/* User Info Bar */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', marginBottom: 16 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 8, background: 'linear-gradient(135deg,#7c3aed,#ec4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff', fontSize: 14 }}>
                          {(selectedTicket.displayName || selectedTicket.username || 'U').slice(0, 2).toUpperCase()}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text1)' }}>
                            {selectedTicket.displayName} <span style={{ color: 'rgba(255,255,255,.4)', fontWeight: 500 }}>@{selectedTicket.username}</span>
                          </div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>
                            User ID: <code style={{ fontFamily: 'monospace' }}>{selectedTicket.userId}</code> · Role: {selectedTicket.role || 'viewer'}
                          </div>
                        </div>
                      </div>

                      {/* User Problem Message */}
                      <div style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
                          User Problem Description:
                        </div>
                        <div style={{ background: 'rgba(0,0,0,.3)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: 16, fontSize: 14, color: 'var(--text1)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                          {selectedTicket.message}
                        </div>
                      </div>

                      {/* Previous Admin Reply if exists */}
                      {selectedTicket.adminReply && (
                        <div style={{ marginBottom: 20, background: 'rgba(124,58,237,.08)', border: '1px solid rgba(124,58,237,.25)', borderRadius: 12, padding: 16 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 800, color: '#a78bfa' }}>
                              💬 Previous Admin Reply (by {selectedTicket.repliedBy || 'Admin'})
                            </span>
                            {selectedTicket.repliedAt && (
                              <span style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>
                                {new Date(selectedTicket.repliedAt).toLocaleString('en-IN')}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 13, color: '#fff', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                            {selectedTicket.adminReply}
                          </div>
                        </div>
                      )}

                      {/* Admin Reply Form */}
                      <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: 16 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text1)', marginBottom: 8 }}>
                          ✍️ {selectedTicket.adminReply ? 'Update / Send Another Reply:' : 'Reply to User:'}
                        </div>
                        <textarea
                          rows={4}
                          className="input"
                          style={{ width: '100%', marginBottom: 12, fontSize: 13, lineHeight: 1.6, resize: 'vertical' }}
                          placeholder="Type your response to the user. They will see this notification immediately upon logging in..."
                          value={adminReplyText}
                          onChange={e => setAdminReplyText(e.target.value)}
                        />

                        {adminReplyMsg && (
                          <div style={{
                            padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 12,
                            background: adminReplyMsg.ok ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.12)',
                            color: adminReplyMsg.ok ? '#4ade80' : '#f87171',
                            border: '1px solid ' + (adminReplyMsg.ok ? 'rgba(34,197,94,.3)' : 'rgba(239,68,68,.3)')
                          }}>
                            {adminReplyMsg.text}
                          </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 12, color: 'var(--text3)' }}>Set status:</span>
                            <select
                              value={adminReplyStatus}
                              onChange={e => setAdminReplyStatus(e.target.value)}
                              className="input input-sm"
                              style={{ fontSize: 12 }}
                            >
                              <option value="replied">💬 Replied (Open)</option>
                              <option value="resolved">✅ Resolved (Close Ticket)</option>
                            </select>
                          </div>

                          <button
                            onClick={sendAdminTicketReply}
                            disabled={adminReplying || !adminReplyText.trim()}
                            className="btn btn-primary btn-sm"
                            style={{
                              padding: '8px 20px', fontWeight: 800, fontSize: 13,
                              opacity: adminReplying || !adminReplyText.trim() ? 0.6 : 1,
                              cursor: adminReplying || !adminReplyText.trim() ? 'not-allowed' : 'pointer'
                            }}
                          >
                            {adminReplying ? 'Sending...' : '📤 Send Reply to User'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === 'settings' && (
            <div className={styles.fadeIn}>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <span style={{ fontSize: 22 }}>⚙️</span>
                  <div><h3 className={styles.cardTitle}>Video Range</h3><p className={styles.cardSub}>Control which video IDs are visible to all viewers</p></div>
                </div>

                {/* Primary range */}
                <div style={{ marginBottom: 8 }}>
                  <label className={styles.fieldLabel} style={{ marginBottom: 6, display: 'block' }}>Primary Range</label>
                  <div className={styles.settingsRow}>
                    <div style={{ flex: 1 }}>
                      <label className={styles.fieldLabel}>Start ID</label>
                      <input className="input" type="number" min="1" value={settings.start}
                        onChange={e => setSettings(s => ({ ...s, start: +e.target.value }))} />
                    </div>
                    <div className={styles.settingsDash}>—</div>
                    <div style={{ flex: 1 }}>
                      <label className={styles.fieldLabel}>End ID</label>
                      <input className="input" type="number" min="1" value={settings.end}
                        onChange={e => setSettings(s => ({ ...s, end: +e.target.value }))} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className={styles.fieldLabel}>Total Videos</label>
                      <div className={styles.totalBox}>{(settings.end - settings.start + 1).toLocaleString()} videos</div>
                    </div>
                  </div>
                </div>

                {/* Extra ranges */}
                {(settings.extraRanges || []).map((rng, i) => (
                  <div key={i} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <label className={styles.fieldLabel} style={{ margin: 0 }}>Extra Range #{i + 1}</label>
                      <button style={{ background: 'rgba(239,68,68,.15)', color: '#f87171', border: '1px solid rgba(239,68,68,.3)', borderRadius: 6, padding: '2px 10px', cursor: 'pointer', fontSize: 13 }}
                        onClick={() => setSettings(s => ({ ...s, extraRanges: (s.extraRanges || []).filter((_, j) => j !== i) }))}>✕ Remove</button>
                    </div>
                    <div className={styles.settingsRow}>
                      <div style={{ flex: 1 }}>
                        <label className={styles.fieldLabel}>Start ID</label>
                        <input className="input" type="number" min="1" value={rng.start}
                          onChange={e => setSettings(s => ({ ...s, extraRanges: s.extraRanges.map((r, j) => j === i ? { ...r, start: +e.target.value } : r) }))} />
                      </div>
                      <div className={styles.settingsDash}>—</div>
                      <div style={{ flex: 1 }}>
                        <label className={styles.fieldLabel}>End ID</label>
                        <input className="input" type="number" min="1" value={rng.end}
                          onChange={e => setSettings(s => ({ ...s, extraRanges: s.extraRanges.map((r, j) => j === i ? { ...r, end: +e.target.value } : r) }))} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label className={styles.fieldLabel}>Total</label>
                        <div className={styles.totalBox}>{(rng.end - rng.start + 1).toLocaleString()} videos</div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Add extra range button */}
                <button style={{ background: 'rgba(139,92,246,.15)', color: '#a78bfa', border: '1px dashed rgba(139,92,246,.4)', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontSize: 14, marginBottom: 16, marginTop: 4 }}
                  onClick={() => setSettings(s => ({ ...s, extraRanges: [...(s.extraRanges || []), { start: 2500, end: 2560 }] }))}
                >+ Add Extra Range</button>

                <button className="btn btn-primary" style={{ marginTop: 4, display: 'block' }} onClick={saveSettings} disabled={savingSet}>
                  {savingSet ? 'Saving…' : 'Save Range'}
                </button>
                <div className={styles.infoGrid}>
                  <InfoRow label="Primary Range" value={`#${settings.start} – #${settings.end}`} />
                  <InfoRow label="CDN Source" value={settings.cdnId} />
                  <InfoRow label="Primary Videos" value={(settings.end - settings.start + 1).toLocaleString()} />
                  {(settings.extraRanges || []).map((r, i) => (
                    <InfoRow key={i} label={`Extra Range #${i+1}`} value={`#${r.start} – #${r.end} (${r.end - r.start + 1} videos)`} />
                  ))}
                </div>
              </div>

              {/* ── Extra CDN Sources ── */}
              <div className={styles.card} style={{ marginTop: 20 }}>
                <div className={styles.cardHeader}>
                  <span style={{ fontSize: 22 }}>🌐</span>
                  <div>
                    <h3 className={styles.cardTitle}>Extra CDN Sources</h3>
                    <p className={styles.cardSub}>Add alternate video CDN sources (e.g. hindibf.com.co) and import their metadata</p>
                  </div>
                  <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}
                    onClick={() => fetch('/api/hwasi/extra-cdn').then(x => x.json()).then(d => setExtraCdnSources(d.sources || []))}>↻ Refresh</button>
                </div>

                {extraCdnMsg && <div style={{ padding: '8px 14px', borderRadius: 8, marginBottom: 12, fontSize: 13, background: extraCdnMsg.includes('✅') ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)', color: extraCdnMsg.includes('✅') ? '#4ade80' : '#f87171' }}>{extraCdnMsg}</div>}

                {extraCdnSources.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <label className={styles.fieldLabel} style={{ marginBottom: 8, display: 'block' }}>Active Extra CDN Sources</label>
                    {extraCdnSources.map(src => (
                      <div key={src.cdnId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', marginBottom: 8 }}>
                        <span style={{ fontSize: 20 }}>🌐</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{src.name}</div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>{src.cdnBase} · {src.count} videos · {new Date(src.importedAt).toLocaleDateString('en-IN')}</div>
                        </div>
                        <span style={{ padding: '3px 10px', borderRadius: 100, background: 'rgba(124,58,237,.15)', border: '1px solid rgba(124,58,237,.3)', fontSize: 11, fontWeight: 700, color: '#a78bfa' }}>{src.cdnId}</span>
                        <button style={{ padding: '5px 12px', borderRadius: 8, border: 'none', background: 'rgba(239,68,68,.15)', color: '#f87171', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                          onClick={async () => {
                            if (!confirm(`Remove CDN "${src.name}"?`)) return;
                            const r = await fetch('/api/hwasi/extra-cdn', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cdnId: src.cdnId }) });
                            if (r.ok) { setExtraCdnSources(prev => prev.filter(s => s.cdnId !== src.cdnId)); setExtraCdnMsg('✅ CDN removed'); setTimeout(() => setExtraCdnMsg(''), 3000); }
                          }}>✕ Remove</button>
                      </div>
                    ))}
                  </div>
                )}

                <label className={styles.fieldLabel} style={{ marginBottom: 10, display: 'block' }}>Add / Import CDN Source</label>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                  <div style={{ flex: '0 0 110px' }}>
                    <label className={styles.fieldLabel}>CDN ID</label>
                    <input className="input" placeholder="hindibf" value={extraCdnForm.cdnId} onChange={e => setExtraCdnForm(p => ({ ...p, cdnId: e.target.value }))} />
                  </div>
                  <div style={{ flex: '0 0 110px' }}>
                    <label className={styles.fieldLabel}>Display Name</label>
                    <input className="input" placeholder="HindiBF" value={extraCdnForm.name} onChange={e => setExtraCdnForm(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <label className={styles.fieldLabel}>CDN Base URL</label>
                    <input className="input" placeholder="https://cdn.hindibf.com.co" value={extraCdnForm.cdnBase} onChange={e => setExtraCdnForm(p => ({ ...p, cdnBase: e.target.value }))} />
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label className={styles.fieldLabel} style={{ marginBottom: 6, display: 'block' }}>
                    Import Metadata JSON&nbsp;
                    <span style={{ color: 'rgba(255,255,255,.4)', fontWeight: 400 }}>{'[{ "id": 58, "title": "...", "thumb": "data:image/jpeg;base64,..." }]'}</span>
                  </label>
                  <textarea className="input" rows={5} placeholder={'[\n  { "id": 58, "title": "Title", "thumb": "data:image/jpeg;base64,/9j/..." }\n]'}
                    value={extraCdnJson} onChange={e => setExtraCdnJson(e.target.value)}
                    style={{ fontFamily: 'monospace', fontSize: 12, resize: 'vertical', width: '100%' }} />
                </div>
                <button className="btn btn-primary" disabled={extraCdnSaving || !extraCdnForm.cdnId || !extraCdnForm.cdnBase}
                  onClick={async () => {
                    setExtraCdnSaving(true); setExtraCdnMsg('');
                    let videos = [];
                    if (extraCdnJson.trim()) {
                      try { videos = JSON.parse(extraCdnJson.trim()); }
                      catch { setExtraCdnMsg('❌ Invalid JSON — check format'); setExtraCdnSaving(false); return; }
                    }
                    const r = await fetch('/api/hwasi/extra-cdn', {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ ...extraCdnForm, videos }),
                    });
                    const d = await r.json(); setExtraCdnSaving(false);
                    if (d.ok) {
                      setExtraCdnMsg(`✅ "${extraCdnForm.name}" saved! ${d.imported} videos, ${d.withThumbs} thumbs, ${d.withTitles} titles.`);
                      fetch('/api/hwasi/extra-cdn').then(x => x.json()).then(dd => setExtraCdnSources(dd.sources || []));
                      setExtraCdnJson('');
                      setTimeout(() => setExtraCdnMsg(''), 5000);
                    } else { setExtraCdnMsg(`❌ ${d.error || 'Failed'}`); }
                  }}>
                  {extraCdnSaving ? 'Importing…' : '🌐 Save & Import CDN'}
                </button>
                <div className={styles.infoGrid} style={{ marginTop: 14 }}>
                  <InfoRow label="How it works" value="Videos signed with CDN ID in JWT → proxy redirects to correct CDN" />
                  <InfoRow label="Thumbnail route" value="/api/hwasi/thumb-extra/[id]" />
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── Edit User Modal ── */}
      {editUser && (
        <div className={styles.modalOverlay} onClick={e => { if (e.target === e.currentTarget) setEditUser(null) }}>
          <div className={styles.modalBox}>
            <div className={styles.modalHead}>
              <h3>Edit @{editUser.username}</h3>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setEditUser(null)}>✕</button>
            </div>
            <div className={styles.editForm}>
              <div><label className={styles.fieldLabel}>Display Name</label>
                <input className="input" value={editUser.displayName || ''} onChange={e => setEditUser(p => ({ ...p, displayName: e.target.value }))} /></div>
              <div><label className={styles.fieldLabel}>Username</label>
                <input className="input" value={editUser.username || ''} onChange={e => setEditUser(p => ({ ...p, username: e.target.value }))} /></div>
              <div><label className={styles.fieldLabel}>Email (optional)</label>
                <input className="input" type="email" value={editUser.email || ''} placeholder="user@example.com" onChange={e => setEditUser(p => ({ ...p, email: e.target.value }))} /></div>
              <div><label className={styles.fieldLabel}>New Password (blank = keep current)</label>
                <input className="input" type={showPass ? 'text' : 'password'} value={editUser.password || ''} placeholder="Leave blank to keep…"
                  onChange={e => setEditUser(p => ({ ...p, password: e.target.value }))} /></div>
              <div><label className={styles.fieldLabel}>Role</label>
                <select className="input" value={editUser.role} onChange={e => setEditUser(p => ({ ...p, role: e.target.value }))}>
                  <option value="viewer">Viewer</option>
                  <option value="advisor">💼 Advisor</option>
                  <option value="admin">👑 Admin</option>
                </select></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveEditUser}>Save Changes</button>
              <button className="btn btn-ghost" onClick={() => setEditUser(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── VIDEO PREVIEW MODAL ── */}
      {previewVideo && (
        <div className={styles.modalBg} style={{ zIndex: 9999 }} onClick={(e) => {
          if (e.target === e.currentTarget) setPreviewVideo(null);
        }}>
          <div style={{ position: 'relative', width: '90%', maxWidth: 1000, margin: '40px auto', background: '#000', borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,.6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', background: 'rgba(255,255,255,.05)', borderBottom: '1px solid rgba(255,255,255,.1)' }}>
              <div style={{ fontWeight: 800, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                {videoTitles[String(previewVideo.id)] || `Video #${previewVideo.id} Preview`}
                <button
                  title="Edit title"
                  onClick={() => { setEditTitleModal({ id: previewVideo.id }); setEditTitleInput(videoTitles[String(previewVideo.id)] || ''); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 16, padding: '2px 4px', borderRadius: 6, transition: 'color 0.2s' }}
                  onMouseOver={e => e.currentTarget.style.color = '#f472b6'}
                  onMouseOut={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
                >✏️</button>
              </div>
              <button onClick={() => setPreviewVideo(null)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 24, cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ width: '100%', aspectRatio: '16/9', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              {previewVideo.loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: 'rgba(255,255,255,.5)' }}>
                  <div className={styles.spinner} style={{ width: 30, height: 30 }} />
                  <div>Loading secure stream...</div>
                </div>
              ) : previewVideo.src ? (
                <video src={previewVideo.src} controls autoPlay style={{ width: '100%', height: '100%', outline: 'none' }} />
              ) : (
                <div style={{ color: '#f87171', fontWeight: 700 }}>Failed to load video stream</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT VIDEO TITLE MODAL (admin/advisor) ── */}
      {editTitleModal && (
        <div className={styles.modalBg} style={{ zIndex: 10000 }} onClick={e => { if (e.target === e.currentTarget) setEditTitleModal(null); }}>
          <div style={{ background: 'linear-gradient(145deg,rgba(20,15,30,.95),rgba(10,5,15,.98))', border: '1px solid rgba(236,72,153,.3)', borderRadius: 20, padding: 28, width: '90%', maxWidth: 460, position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 22 }}>✏️</span>
              <div>
                <h3 style={{ fontWeight: 800, fontSize: 16, margin: 0 }}>Set Video Title</h3>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', margin: 0 }}>Video #{editTitleModal.id} · visible to all users</p>
              </div>
            </div>
            <input
              className="input"
              style={{ width: '100%', marginTop: 16, marginBottom: 4, boxSizing: 'border-box' }}
              placeholder={`Custom title...`}
              value={editTitleInput}
              maxLength={80}
              autoFocus
              onChange={e => setEditTitleInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveVideoTitle(); if (e.key === 'Escape') setEditTitleModal(null); }}
            />
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', marginBottom: 16, textAlign: 'right' }}>{editTitleInput.length}/80</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ flex: 1, padding: '11px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#ec4899,#8b5cf6)', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: editTitleSaving ? .6 : 1 }} onClick={saveVideoTitle} disabled={editTitleSaving}>
                {editTitleSaving ? 'Saving...' : '✓ Save Title'}
              </button>
              {videoTitles[String(editTitleModal.id)] && (
                <button style={{ padding: '11px 14px', borderRadius: 12, border: '1px solid rgba(239,68,68,.3)', background: 'rgba(239,68,68,.1)', color: '#f87171', fontWeight: 600, cursor: 'pointer' }} onClick={() => { setEditTitleInput(''); saveVideoTitle(); }} title="Remove custom title">🗑</button>
              )}
              <button style={{ padding: '11px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,.1)', background: 'transparent', color: 'rgba(255,255,255,.6)', cursor: 'pointer' }} onClick={() => setEditTitleModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── DEVICE WARNING MESSAGE MODAL ── */}
      {deviceMsgModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(8px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#130a20', border: '1px solid rgba(251,191,36,.3)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 420, boxShadow: '0 30px 80px rgba(0,0,0,.7)' }}>
            <div style={{ fontSize: 36, textAlign: 'center', marginBottom: 12 }}>💬</div>
            <h3 style={{ textAlign: 'center', fontWeight: 900, fontSize: 18, marginBottom: 6, color: '#fbbf24' }}>Send Warning to User</h3>
            <p style={{ textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,.5)', marginBottom: 18 }}>
              Message to <strong style={{ color: '#fff' }}>{deviceMsgModal.displayName || deviceMsgModal.username}</strong>. They will see this as a popup next time they use the site.
            </p>
            {/* Quick templates */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              {[
                '⚠️ You are using this account on multiple devices. Please stop or your account may be banned.',
                '🚨 Warning: Account sharing is not allowed. Continued violation will result in permanent ban.',
                '🔔 Suspicious activity detected on your account. Please review your usage.',
              ].map(t => (
                <button key={t} onClick={() => setDeviceMsgText(t)}
                  style={{ padding: '9px 14px', borderRadius: 10, border: `1px solid ${deviceMsgText === t ? '#fbbf24' : 'rgba(255,255,255,.08)'}`, background: deviceMsgText === t ? 'rgba(251,191,36,.1)' : 'rgba(255,255,255,.03)', color: deviceMsgText === t ? '#fbbf24' : 'rgba(255,255,255,.65)', fontWeight: deviceMsgText === t ? 700 : 500, fontSize: 12, cursor: 'pointer', textAlign: 'left', transition: 'all .15s' }}
                >{t}</button>
              ))}
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', fontWeight: 700, display: 'block', marginBottom: 6 }}>OR TYPE CUSTOM MESSAGE</label>
              <textarea
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.05)', color: '#fff', fontSize: 13, boxSizing: 'border-box', resize: 'vertical', minHeight: 80 }}
                placeholder="Type your warning message..."
                value={deviceMsgText}
                onChange={e => setDeviceMsgText(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                disabled={!deviceMsgText.trim() || deviceMsgSending}
                style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: deviceMsgText.trim() ? 'linear-gradient(135deg,#f59e0b,#d97706)' : 'rgba(251,191,36,.3)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: deviceMsgText.trim() ? 'pointer' : 'not-allowed', transition: 'all .2s' }}
                onClick={async () => {
                  setDeviceMsgSending(true);
                  const r = await fetch('/api/hwasi/device-message', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: deviceMsgModal.uid, message: deviceMsgText.trim() }) });
                  setDeviceMsgSending(false);
                  if (r.ok) { flash(`💬 Message sent to ${deviceMsgModal.displayName || deviceMsgModal.username}`); setDeviceMsgModal(null); setDeviceMsgText(''); }
                  else flash('❌ Failed to send message', 'err');
                }}
              >{deviceMsgSending ? 'Sending...' : '💬 Send Message'}</button>
              <button
                style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1px solid rgba(255,255,255,.1)', background: 'transparent', color: 'rgba(255,255,255,.6)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
                onClick={() => { setDeviceMsgModal(null); setDeviceMsgText(''); }}
              >Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── BLOCK REASON MODAL ── */}
      {blockModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(8px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#130a20', border: '1px solid rgba(239,68,68,.3)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 420, boxShadow: '0 30px 80px rgba(0,0,0,.7)' }}>
            <div style={{ fontSize: 36, textAlign: 'center', marginBottom: 12 }}>🚫</div>
            <h3 style={{ textAlign: 'center', fontWeight: 900, fontSize: 18, marginBottom: 6, color: '#f87171' }}>Block Account</h3>
            <p style={{ textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,.5)', marginBottom: 18 }}>
              Blocking <strong style={{ color: '#fff' }}>{blockModal.displayName || blockModal.username}</strong>. Select a reason — it will be shown to the user when they try to login.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              {['Multiple device sharing detected', 'Account sharing / unauthorized access', 'Terms of service violation', 'Suspicious activity detected', 'Payment dispute / chargeback'].map(r => (
                <button key={r} onClick={() => setBlockReason(r)}
                  style={{ padding: '9px 14px', borderRadius: 10, border: `1px solid ${blockReason === r ? '#f87171' : 'rgba(255,255,255,.08)'}`, background: blockReason === r ? 'rgba(239,68,68,.15)' : 'rgba(255,255,255,.03)', color: blockReason === r ? '#f87171' : 'rgba(255,255,255,.65)', fontWeight: blockReason === r ? 700 : 500, fontSize: 13, cursor: 'pointer', textAlign: 'left', transition: 'all .15s' }}
                >{r}</button>
              ))}
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', fontWeight: 700, display: 'block', marginBottom: 6 }}>OR TYPE CUSTOM REASON</label>
              <input
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.05)', color: '#fff', fontSize: 13, boxSizing: 'border-box' }}
                placeholder="e.g. Banned for abuse..."
                value={blockReason}
                onChange={e => setBlockReason(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                disabled={!blockReason.trim()}
                style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: blockReason.trim() ? 'linear-gradient(135deg,#ef4444,#b91c1c)' : 'rgba(239,68,68,.3)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: blockReason.trim() ? 'pointer' : 'not-allowed', transition: 'all .2s' }}
                onClick={async () => {
                  const { uid } = blockModal;
                  await fetch('/api/hwasi/devices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: uid, blocked: true, reason: blockReason.trim() }) });
                  setDeviceData(d => ({ ...d, [uid]: { ...d[uid], blocked: true, blockReason: blockReason.trim() } }));
                  flash(`🚫 Blocked ${blockModal.displayName || blockModal.username}`, 'err');
                  setBlockModal(null); setBlockReason('');
                }}
              >🚫 Confirm Block</button>
              <button
                style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1px solid rgba(255,255,255,.1)', background: 'transparent', color: 'rgba(255,255,255,.6)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
                onClick={() => { setBlockModal(null); setBlockReason(''); }}
              >Cancel</button>
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
  if (secs < 3600) return Math.floor(secs / 60) + 'm ago';
  if (secs < 86400) return Math.floor(secs / 3600) + 'h ago';
  return Math.floor(secs / 86400) + 'd ago';
}

function StatCard({ icon, label, value, sub, color }) {
  const colors = { purple: 'rgba(124,58,237,.15)', pink: 'rgba(236,72,153,.12)', blue: 'rgba(59,130,246,.12)', green: 'rgba(34,197,94,.1)' };
  const borders = { purple: 'rgba(124,58,237,.25)', pink: 'rgba(236,72,153,.2)', blue: 'rgba(59,130,246,.2)', green: 'rgba(34,197,94,.18)' };
  return (
    <div style={{ background: colors[color], border: `1px solid ${borders[color]}`, borderRadius: 14, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 8, transition: 'transform .2s,box-shadow .2s' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,.4)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}>
      <div style={{ fontSize: 28 }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', fontFamily: "'Space Grotesk',sans-serif", letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>{label}</div>
      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{sub}</div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 16px', borderBottom: '1px solid rgba(255,255,255,.04)', fontSize: 13 }}>
      <span style={{ color: 'var(--text3)' }}>{label}</span>
      <strong style={{ color: 'var(--text2)' }}>{value}</strong>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function IconTicket() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}
function IconDash() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>; }
function IconCurated() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" /></svg>; }
function IconUsers() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>; }
function IconChart() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>; }
function IconSettings() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>; }
function IconGallery() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>; }
function IconLogout() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>; }
function IconEdit() { return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>; }
function IconTrash() { return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>; }
function IconThumb() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>; }
function IconPremium() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>; }
function IconFlag() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></svg>; }

function IconScraper() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 21h5v-5" />
    </svg>
  );
}
