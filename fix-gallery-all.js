const fs = require('fs');
let g = fs.readFileSync('app/gallery/page.js', 'utf8');

// ================================================================
// FIX 1: Handle INSTAVIRAL_PREMIUM_ONLY code from server in openModal
// ================================================================
const OLD_ALLOWED = `      if (!check.allowed) {\r\n        setModal(null);\r\n        setUpgradeInfo(check);\r\n        setShowUpgrade(true);\r\n        return;\r\n      }`;
const NEW_ALLOWED = `      if (!check.allowed) {\r\n        setModal(null);\r\n        if (check.code === 'INSTAVIRAL_PREMIUM_ONLY') {\r\n          setInstaViralBlock(true);\r\n          return;\r\n        }\r\n        setUpgradeInfo(check);\r\n        setShowUpgrade(true);\r\n        return;\r\n      }`;
if (!g.includes(OLD_ALLOWED)) { console.error('FIX1 not found!'); } else { g = g.replace(OLD_ALLOWED, NEW_ALLOWED); console.log('Fix1 OK: server instaviral block'); }

// ================================================================
// FIX 2: Admin/UTR message modal — improve to show type-aware styling
// Replace the admin warning popup with the improved version
// ================================================================
const OLD_ADMIN_MSG = `      {/* ── ADMIN WARNING MESSAGE POPUP ── */}\r\n      {adminMessage && (\r\n        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(8px)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>\r\n          <div style={{ background: 'linear-gradient(135deg,#130a20,#1a0d2e)', border: '1px solid rgba(251,191,36,.4)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 400, textAlign: 'center', boxShadow: '0 30px 80px rgba(0,0,0,.7)' }}>\r\n            <div style={{ fontSize: 48, marginBottom: 10 }}>⚠️</div>\r\n            <h3 style={{ fontWeight: 900, fontSize: 18, color: '#fbbf24', marginBottom: 8 }}>Admin Warning</h3>\r\n            <p style={{ fontSize: 14, color: 'rgba(255,255,255,.7)', lineHeight: 1.7, marginBottom: 20, whiteSpace: 'pre-wrap' }}>{adminMessage.message}</p>\r\n            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', marginBottom: 16 }}>From: {adminMessage.from} · {new Date(adminMessage.timestamp).toLocaleString('en-IN')}</div>\r\n            <button\r\n              style={{ padding: '12px 28px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}\r\n              onClick={() => setAdminMessage(null)}\r\n            >✓ I Understand</button>\r\n          </div>\r\n        </div>\r\n      )}`;

const NEW_ADMIN_MSG = `      {/* ── ADMIN / UTR NOTIFICATION POPUP ── */}\r\n      {adminMessage && (\r\n        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(8px)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>\r\n          <div style={{ background: adminMessage.type === 'utr_rejected' ? 'linear-gradient(135deg,#1a0505,#2d0a0a)' : 'linear-gradient(135deg,#130a20,#1a0d2e)', border: \`1px solid \${adminMessage.type === 'utr_rejected' ? 'rgba(248,113,113,.4)' : 'rgba(251,191,36,.4)'}\`, borderRadius: 20, padding: 28, width: '100%', maxWidth: 420, textAlign: 'center', boxShadow: '0 30px 80px rgba(0,0,0,.7)' }}>\r\n            <div style={{ fontSize: 48, marginBottom: 10 }}>{adminMessage.type === 'utr_rejected' ? '❌' : '⚠️'}</div>\r\n            <h3 style={{ fontWeight: 900, fontSize: 18, color: adminMessage.type === 'utr_rejected' ? '#f87171' : '#fbbf24', marginBottom: 8 }}>\r\n              {adminMessage.type === 'utr_rejected' ? 'Payment Verification Failed' : 'Admin Notice'}\r\n            </h3>\r\n            <p style={{ fontSize: 14, color: 'rgba(255,255,255,.75)', lineHeight: 1.7, marginBottom: 20, whiteSpace: 'pre-wrap' }}>{adminMessage.message}</p>\r\n            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', marginBottom: 16 }}>From: {adminMessage.from} · {new Date(adminMessage.timestamp).toLocaleString('en-IN')}</div>\r\n            {adminMessage.type === 'utr_rejected' && (\r\n              <button style={{ padding: '11px 24px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#7c3aed,#ec4899)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', marginBottom: 8, width: '100%' }}\r\n                onClick={() => { setAdminMessage(null); window.location.href = '/premium'; }}>\r\n                🔄 Resubmit Payment\r\n              </button>\r\n            )}\r\n            <button\r\n              style={{ padding: '11px 28px', borderRadius: 12, border: 'none', background: adminMessage.type === 'utr_rejected' ? 'rgba(255,255,255,.1)' : 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', width: '100%' }}\r\n              onClick={() => setAdminMessage(null)}\r\n            >✓ I Understand</button>\r\n          </div>\r\n        </div>\r\n      )}`;

if (!g.includes(OLD_ADMIN_MSG)) { console.error('FIX2 admin msg not found! Searching...'); const i = g.indexOf('ADMIN WARNING'); console.log('Found at idx:', i); }
else { g = g.replace(OLD_ADMIN_MSG, NEW_ADMIN_MSG); console.log('Fix2 OK: admin/UTR notification modal improved'); }

// ================================================================
// FIX 3: foryou tab label fix — separate icon from label
// ================================================================
const OLD_FORYOU = `  { id: 'foryou', label: '🎬 Full Collection', icon: '' },`;
const NEW_FORYOU = `  { id: 'foryou', label: 'Full Collection', icon: '🎬' },`;
if (!g.includes(OLD_FORYOU)) { console.log('FIX3: foryou already fixed or not found'); }
else { g = g.replace(OLD_FORYOU, NEW_FORYOU); console.log('Fix3 OK: foryou label'); }

// ================================================================
// FIX 4: Section title for foryou tab
// ================================================================
const OLD_TITLE = `              {HOME_TABS.find(t => t.id === homeTab)?.icon} All {HOME_TABS.find(t => t.id === homeTab)?.label}\r\n`;
const NEW_TITLE = `              {homeTab === 'foryou'\r\n                ? '🎬 Entire Collection — 700+ Videos'\r\n                : \`\${HOME_TABS.find(t => t.id === homeTab)?.icon} All \${HOME_TABS.find(t => t.id === homeTab)?.label}\`}\r\n`;
if (!g.includes(OLD_TITLE)) { console.log('FIX4: title already fixed or not found'); }
else { g = g.replace(OLD_TITLE, NEW_TITLE); console.log('Fix4 OK: section title'); }

// ================================================================
// FIX 5: Remove blur from instaviral overlay
// ================================================================
const OLD_BLUR = `background:'rgba(10,0,21,.78)',backdropFilter:'blur(6px)',borderRadius:14,cursor:'pointer'`;
const NEW_BLUR = `background:'rgba(0,0,0,.45)',borderRadius:14,cursor:'pointer'`;
if (!g.includes(OLD_BLUR)) { console.log('FIX5: blur already fixed or not found'); }
else { g = g.replace(OLD_BLUR, NEW_BLUR); console.log('Fix5 OK: removed blur'); }

// ================================================================
// FIX 6: Spinner for ALL tabs while loading, not just trending
// ================================================================
const OLD_SPINNER = `          {curatedLoading && homeTab === 'trending' ? (`;
const NEW_SPINNER = `          {curatedLoading ? (`;
if (!g.includes(OLD_SPINNER)) { console.log('FIX6: spinner already fixed or not found'); }
else { g = g.replace(OLD_SPINNER, NEW_SPINNER); console.log('Fix6 OK: spinner for all tabs'); }

// ================================================================
// FIX 7: Hide download button in modal header for instaviral
// ================================================================
const OLD_MODAL_DL = `                <button className={styles.btnGhost} onClick={(e) => handleDownload(e, modal.id)}>⬇ Download</button>`;
const NEW_MODAL_DL = `                {!instaviralIds.includes(Number(modal.id)) && (\r\n                  <button className={styles.btnGhost} onClick={(e) => handleDownload(e, modal.id)}>⬇ Download</button>\r\n                )}`;
if (!g.includes(OLD_MODAL_DL)) { console.log('FIX7: modal download already fixed or not found'); }
else { g = g.replace(OLD_MODAL_DL, NEW_MODAL_DL); console.log('Fix7 OK: modal download hidden for instaviral'); }

fs.writeFileSync('app/gallery/page.js', g);

// Verify build would work - check for obvious JSX issues
const final = fs.readFileSync('app/gallery/page.js', 'utf8');
const opens = (final.match(/<div/g) || []).length;
const closes = (final.match(/<\/div>/g) || []).length;
console.log(`\nFinal check: ${opens} <div> opens, ${closes} </div> closes`);
console.log('Lines:', final.split('\n').length);
console.log('Has Fix1 (server instaviral):', final.includes('INSTAVIRAL_PREMIUM_ONLY'));
console.log('Has Fix2 (UTR modal):', final.includes('utr_rejected'));
console.log('Has Fix3 (foryou icon):', final.includes("id: 'foryou', label: 'Full Collection', icon: '🎬'"));
console.log('Has Fix4 (section title):', final.includes('Entire Collection'));
console.log('Has Fix5 (no blur):', !final.includes("backdropFilter:'blur(6px)'"));
console.log('Has Fix6 (spinner all):', final.includes('{curatedLoading ? ('));
console.log('Has Fix7 (modal dl hidden):', final.includes('instaviralIds.includes(Number(modal.id))'));
