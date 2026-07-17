const fs = require('fs');

// Fix admin page - add UTR delete button
let c = fs.readFileSync('app/admin/page.js', 'utf8');

// Add Action column header to UTR table
c = c.replace(
  `                      <th style={{padding:'8px',textAlign:'left'}}>When</th>\r\n                    </tr></thead>`,
  `                      <th style={{padding:'8px',textAlign:'left'}}>When</th>\r\n                      <th style={{padding:'8px',textAlign:'left'}}>Action</th>\r\n                    </tr></thead>`
);

// Add delete button cell to UTR rows
c = c.replace(
  `                        <td style={{padding:'10px 8px',fontSize:11,color:'rgba(255,255,255,.4)'}}>{new Date(u.timestamp).toLocaleString('en-IN')}</td>\r\n                      </tr>`,
  `                        <td style={{padding:'10px 8px',fontSize:11,color:'rgba(255,255,255,.4)'}}>{new Date(u.timestamp).toLocaleString('en-IN')}</td>\r\n                        <td style={{padding:'10px 8px'}}>\r\n                          <button className="btn btn-sm" style={{background:'rgba(239,68,68,.15)',color:'#f87171',border:'1px solid rgba(239,68,68,.3)',borderRadius:8,padding:'4px 10px',cursor:'pointer',fontSize:11}}\r\n                            onClick={async()=>{\r\n                              if(!confirm(\`Delete UTR "\${u.utrId}" by @\${u.username}? The user will receive a rejection notification.\`)) return;\r\n                              const r = await fetch('/api/hwasi/utr',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({utrId:u.utrId,userId:u.userId,username:u.username})});\r\n                              if(r.ok){setUtrList(l=>l.filter(x=>x.utrId!==u.utrId));flash('🗑 UTR removed. User notified.');}\r\n                              else flash('❌ Failed to delete','err');\r\n                            }}>\r\n                            ✕ Reject\r\n                          </button>\r\n                        </td>\r\n                      </tr>`
);

// Fix curated admin section - rename "latest" to "popular" in labels
c = c.replace(/Latest Videos/g, 'Popular Videos');
c = c.replace(/curated\.latest/g, 'curated.popular || curated.latest');
c = c.replace(
  "setCurated(prev => ({...prev, latest:",
  "setCurated(prev => ({...prev, popular:"
);

fs.writeFileSync('app/admin/page.js', c);
console.log('Admin fixes done');
