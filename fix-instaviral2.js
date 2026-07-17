const fs = require('fs');
let g = fs.readFileSync('app/gallery/page.js', 'utf8');

// ================================================================
// FIX 1: VideoCard — hide Download button when onDownload is null
// ================================================================
const OLD_DL = `        <ActionBtn icon="⬇" label="Download" color="#10b981" onClick={(e) => onDownload(e)} />\r\n`;
const NEW_DL = `        {onDownload && <ActionBtn icon="⬇" label="Download" color="#10b981" onClick={(e) => onDownload(e)} />}\r\n`;
if (!g.includes(OLD_DL)) { console.error('DL btn not found!'); process.exit(1); }
g = g.replace(OLD_DL, NEW_DL);

// ================================================================
// FIX 2: Add instaViralBlock MODAL — was set but NEVER rendered!
// Insert right before the showUpgrade modal
// ================================================================
const UPGRADE_MARKER = `      {showUpgrade && (`;
if (!g.includes(UPGRADE_MARKER)) { console.error('showUpgrade not found!'); process.exit(1); }

const INSTA_BLOCK_MODAL = `      {/* ── Insta Viral Premium Block ── */}
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

`;
g = g.replace(UPGRADE_MARKER, INSTA_BLOCK_MODAL + UPGRADE_MARKER);

// ================================================================
// FIX 3: Replace the VideoCard map to wrap each card in a div with lock overlay
// ================================================================
const OLD_MAP = `            {tabIds().map((id, i) => (\r\n              <VideoCard key={id} id={id} index={i}\r\n                hasThumb={thumbIds.has(id)}\r\n                isBookmarked={bookmarks.has(id)}\r\n                isAdmin={isAdminOrAdvisor}\r\n                showHash={isAdminOrAdvisor}\r\n                onPlay={() => openModal(id)}\r\n                onDownload={instaviralIds.includes(Number(id)) ? null : (e) => handleDownload(e, id)}\r\n                onBookmark={(e) => toggleBookmark(e, id)}\r\n                onReport={(e) => { e.stopPropagation(); setReportModal(id); }}\r\n                onDelete={isAdminOrAdvisor ? (e) => { e.stopPropagation(); setDeleteModal({ id }); setDeleteReason('duplicate'); } : null}\r\n              />\r\n            ))}`;

const NEW_MAP = `            {tabIds().map((id, i) => (
              <div key={id} style={{ position: 'relative' }}>
                {homeTab === 'instaviral' && !isPremium && (
                  <div style={{ position:'absolute',inset:0,zIndex:10,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'rgba(10,0,21,.78)',backdropFilter:'blur(6px)',borderRadius:14,cursor:'pointer' }}
                    onClick={(e) => { e.stopPropagation(); setInstaViralBlock(true); }}>
                    <div style={{ fontSize:32, marginBottom:4 }}>💎</div>
                    <div style={{ fontSize:10, fontWeight:800, color:'#f59e0b', letterSpacing:1.2, textTransform:'uppercase' }}>Premium Only</div>
                  </div>
                )}
                <VideoCard id={id} index={i}
                  hasThumb={thumbIds.has(id)}
                  isBookmarked={bookmarks.has(id)}
                  isAdmin={isAdminOrAdvisor}
                  showHash={isAdminOrAdvisor}
                  onPlay={() => openModal(id)}
                  onDownload={instaviralIds.includes(Number(id)) ? null : (e) => handleDownload(e, id)}
                  onBookmark={(e) => toggleBookmark(e, id)}
                  onReport={(e) => { e.stopPropagation(); setReportModal(id); }}
                  onDelete={isAdminOrAdvisor ? (e) => { e.stopPropagation(); setDeleteModal({ id }); setDeleteReason('duplicate'); } : null}
                />
              </div>
            ))}`;

if (!g.includes(OLD_MAP)) {
  console.error('OLD_MAP not found! Looking for similar...');
  const idx = g.indexOf('tabIds().map');
  console.log('Found at:', idx, '=> context:', g.substring(idx, idx+300));
  process.exit(1);
}
g = g.replace(OLD_MAP, NEW_MAP);

// ================================================================
// FIX 4: Add position:relative to vcard CSS
// ================================================================
let css = fs.readFileSync('app/gallery/gallery.module.css', 'utf8');
css = css.replace(
  `.vcard { border-radius:14px;`,
  `.vcard { position:relative; border-radius:14px;`
);
fs.writeFileSync('app/gallery/gallery.module.css', css);

fs.writeFileSync('app/gallery/page.js', g);

// Verify
const final = fs.readFileSync('app/gallery/page.js', 'utf8');
console.log('Download null check:', final.includes('{onDownload &&'));
console.log('InstaViralBlock modal:', final.includes('Premium Only Content'));
console.log('Lock overlay:', final.includes('PREMIUM ONLY') || final.includes('Premium Only'));
console.log('Map wrapped div:', final.includes("key={id} style={{ position: 'relative' }}"));
console.log('Lines:', final.split('\n').length);
