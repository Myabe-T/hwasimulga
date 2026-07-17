const fs = require('fs');
const path = 'app/gallery/page.js';
let content = fs.readFileSync(path, 'utf8');

const oldLogic = \      if (!isPrivileged) {
        const fp = getFingerprint();
        const checkRes = await fetch('/api/hwasi/views', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId: id, fingerprint: fp }),
        }).catch(() => ({ json: () => ({ allowed: true }) }));
        const check = await checkRes.json();
        setViewStatus(check);
        if (!check.allowed) {
          setModal(null);
          setUpgradeInfo(check);
          setShowUpgrade(true);
          return;
        }
      }
  
      fetch('/api/hwasi/history', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: id }),
      }).catch(() => { });
      try {
        const sr = await fetch(\\\/api/hwasi/sign/\\\\\\);
        const sd = await sr.json();
        if (sd.src) setModal(prev => prev?.id === id ? { ...prev, src: sd.src, loading: false } : prev);
        else setModal(prev => prev?.id === id ? { ...prev, src: '', loading: false } : prev);
      } catch {
        setModal(prev => prev?.id === id ? { ...prev, src: '', loading: false } : prev);
      }\;

const newLogic = \      // Call views to authorize AND get token
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
\;

content = content.replace(oldLogic, newLogic);

// Also replace the GET views fetch in init
content = content.replace(
  /fetch\('\\/api\\/hwasi\\/views'\)/g,
  "secureFetch('/api/hwasi/views')"
);

fs.writeFileSync(path, content);
