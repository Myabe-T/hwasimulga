const fs = require('fs');
const path = 'app/admin/page.js';
let content = fs.readFileSync(path, 'utf8');

// Replace {trending:[], latest:[]} with {trending:[], latest:[], instaviral:[]}
content = content.replace("const [curated, setCurated] = useState({ trending: [], latest: [] });", "const [curated, setCurated] = useState({ trending: [], latest: [], instaviral: [] });");

// Inside tab==='curated', we have sections for Trending and Latest. We need to add one for Insta Viral.
// Let's find the Latest section and append Insta Viral below it.
const latestSectionRegex = /<div className=\{styles\.card\} style=\{\{marginBottom:20\}\}>[\s\S]*?<h3 className=\{styles\.cardTitle\}>Latest Videos<\/h3>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/m;
const match = content.match(latestSectionRegex);

if (match) {
  const newSection = 
              {/* INSTA VIRAL */}
              <div className={styles.card} style={{marginBottom:20}}>
                <div className={styles.cardHeader}>
                  <span style={{fontSize:22}}>🔥</span>
                  <div><h3 className={styles.cardTitle}>Insta Viral Premium</h3><p className={styles.cardSub}>Premium only section for viral videos</p></div>
                </div>
                <div style={{display:'flex',gap:12,marginBottom:16}}>
                  <input className="input" style={{flex:1}} placeholder="Enter Video IDs (e.g. 5, 12, 105)"
                    onKeyDown={(e) => {
                      if (e.key==='Enter') {
                        const ids = e.target.value.split(',').map(x=>Number(x.trim())).filter(x=>x>0);
                        if (ids.length) {
                          const nv = [...new Set([...(curated.instaviral||[]), ...ids])];
                          saveCurated('instaviral', nv);
                          e.target.value = '';
                        }
                      }
                    }}
                  />
                  <button className="btn btn-primary" onClick={(e) => {
                    const inp = e.currentTarget.previousElementSibling;
                    const ids = inp.value.split(',').map(x=>Number(x.trim())).filter(x=>x>0);
                    if (ids.length) {
                      const nv = [...new Set([...(curated.instaviral||[]), ...ids])];
                      saveCurated('instaviral', nv);
                      inp.value = '';
                    }
                  }}>Add</button>
                </div>
                <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
                  {(curated.instaviral||[]).length===0 && <div style={{color:'var(--text3)',fontSize:13}}>No videos added yet</div>}
                  {(curated.instaviral||[]).map(id => (
                    <div key={id} style={{background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.1)',padding:'4px 10px',borderRadius:100,display:'flex',alignItems:'center',gap:6,fontSize:13,fontWeight:600}}>
                      #{id}
                      <span style={{cursor:'pointer',color:'#f87171',marginLeft:4,fontSize:14}} onClick={() => saveCurated('instaviral', curated.instaviral.filter(x=>x!==id))}>×</span>
                    </div>
                  ))}
                </div>
              </div>
;
  content = content.replace(match[0], match[0] + "\n" + newSection);
  fs.writeFileSync(path, content);
  console.log('Added Insta Viral section to Admin page');
} else {
  console.log('Could not find Latest section');
}
