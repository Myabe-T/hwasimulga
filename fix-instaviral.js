const fs = require('fs');
let g = fs.readFileSync('app/gallery/page.js', 'utf8');

// ================================================================
// FIX 1: VideoCard — hide Download button entirely when onDownload is null
// ================================================================
g = g.replace(
  `        <ActionBtn icon="⬇" label="Download" color="#10b981" onClick={(e) => onDownload(e)} />\r\n`,
  `        {onDownload && <ActionBtn icon="⬇" label="Download" color="#10b981" onClick={(e) => onDownload(e)} />}\r\n`
);

// ================================================================
// FIX 2: Add instaViralBlock MODAL render — it was set but never shown!
// Find the showUpgrade modal render and add instaViralBlock render next to it
// ================================================================
const UPGRADE_RENDER_SEARCH = `      {showUpgrade && (`;

if (!g.includes(UPGRADE_RENDER_SEARCH)) {
  console.error('Could not find showUpgrade render!');
  process.exit(1);
}

g = g.replace(
  UPGRADE_RENDER_SEARCH,
  `      {/* ── Insta Viral Premium Block ── */}
      {instaViralBlock && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.85)', backdropFilter:'blur(12px)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
          onClick={() => setInstaViralBlock(false)}>
          <div style={{ background:'linear-gradient(135deg,#1a0030,#2d0050)', border:'1px solid rgba(236,72,153,.3)', borderRadius:24, padding:'40px 32px', maxWidth:420, width:'100%', textAlign:'center', boxShadow:'0 0 60px rgba(124,58,237,.4)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:64, marginBottom:16 }}>💎</div>
            <h2 style={{ fontSize:24, fontWeight:800, margin:'0 0 10px', background:'linear-gradient(135deg,#ec4899,#a855f7)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>Premium Only</h2>
            <p style={{ color:'rgba(255,255,255,.7)', marginBottom:24, lineHeight:1.6 }}>
              Insta Viral videos are exclusive to <strong style={{color:'#f59e0b'}}>Premium members</strong>.<br/>
              Upgrade now to unlock the full collection!
            </p>
            <button onClick={() => window.location.href='/premium'}
              style={{ width:'100%', padding:'14px 0', borderRadius:12, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#7c3aed,#ec4899)', color:'#fff', fontWeight:800, fontSize:16, marginBottom:12 }}>
              🚀 Upgrade to Premium
            </button>
            <button onClick={() => setInstaViralBlock(false)}
              style={{ background:'none', border:'1px solid rgba(255,255,255,.15)', color:'rgba(255,255,255,.6)', padding:'10px 0', width:'100%', borderRadius:10, cursor:'pointer', fontSize:13 }}>
              Maybe Later
            </button>
          </div>
        </div>
      )}

      {showUpgrade && (`
);

// ================================================================
// FIX 3: Also block ALL instaviral card clicks with a lock overlay
//         so free users can't even click the thumbnail
// ================================================================
// Find where instaviral tab renders VideoCards and wrap click with lock
// Actually the openModal already handles it — just need the modal to show

// ================================================================
// FIX 4: Ensure instaviralIds is pre-loaded before any click is possible
// The issue: curated loads async, user might click before it's ready
// Solution: show a 💎 lock icon overlay on instaviral cards for non-premium users
// This way clicking ANYTHING on the card shows the block
// ================================================================

// In the instaviral VideoCard render, add a premium overlay for non-premium users
// Find the tabIds map in gallery section
const OLD_CARD = `            <VideoCard key={id} id={id} index={i}`;
const NEW_CARD = `            {homeTab === 'instaviral' && !isPremium && (
                <div style={{ position:'absolute', inset:0, zIndex:10, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'rgba(10,0,21,.7)', backdropFilter:'blur(4px)', borderRadius:16, cursor:'pointer' }}
                  onClick={() => setInstaViralBlock(true)}>
                  <div style={{ fontSize:36, marginBottom:6 }}>💎</div>
                  <div style={{ fontSize:11, fontWeight:700, color:'#f59e0b', letterSpacing:1 }}>PREMIUM ONLY</div>
                </div>
              )}
            <VideoCard key={id} id={id} index={i}`;

// Only replace inside the gallery tab section (line ~690-715 area)
const gallerySection = g.indexOf('          {/* Pagination — unified for all tabs */}');
if (gallerySection === -1) { console.error('Could not find gallery section'); }

const beforePag = g.substring(0, gallerySection);
const afterPag = g.substring(gallerySection);

// Count OLD_CARD occurrences in beforePag
const count = (beforePag.match(/<VideoCard key=\{id\} id=\{id\} index=\{i\}/g) || []).length;
console.log('VideoCard occurrences in gallery section:', count);

// Replace just the first occurrence in the gallery main render
let replaced = false;
const updated = beforePag.replace(
  /(\s+)<VideoCard key=\{id\} id=\{id\} index=\{i\}/,
  (match, spaces) => {
    replaced = true;
    return `${spaces}{homeTab === 'instaviral' && !isPremium && (
${spaces}  <div style={{ position:'absolute', inset:0, zIndex:10, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'rgba(10,0,21,.75)', backdropFilter:'blur(4px)', borderRadius:16, cursor:'pointer' }}
${spaces}    onClick={(e) => { e.stopPropagation(); setInstaViralBlock(true); }}>
${spaces}    <div style={{ fontSize:36, marginBottom:6 }}>💎</div>
${spaces}    <div style={{ fontSize:11, fontWeight:700, color:'#f59e0b', letterSpacing:1 }}>PREMIUM ONLY</div>
${spaces}  </div>
${spaces})}
${spaces}<VideoCard key={id} id={id} index={i}`;
  }
);
console.log('Lock overlay replaced:', replaced);

g = updated + afterPag;

fs.writeFileSync('app/gallery/page.js', g);

// Verify
const final = fs.readFileSync('app/gallery/page.js', 'utf8');
console.log('Download conditional:', final.includes('{onDownload &&'));
console.log('InstaViralBlock modal:', final.includes('Insta Viral Premium Block'));
console.log('Lock overlay:', final.includes('PREMIUM ONLY'));
console.log('Total lines:', final.split('\n').length);
