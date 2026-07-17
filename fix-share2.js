const fs = require('fs');
const path = 'app/gallery/page.js';
let c = fs.readFileSync(path, 'utf8');

// Find and fix modal share button
const oldModal = `onClick={() => {
                    const shareUrl = \`\${window.location.origin}/watch/\${modal.id}\`;
                    if (navigator.share) {
                      navigator.share({ title: videoTitles[String(modal.id)] || videoTitle(modal.id), url: shareUrl });
                    } else {
                      navigator.clipboard.writeText(shareUrl);
                    }
                    setShareCopied(modal.id);
                    setTimeout(() => setShareCopied(null), 2000);
                  }}`;

const newModal = `onClick={async () => {
                    try {
                      const res = await fetch(\`/api/hwasi/share/\${modal.id}\`);
                      const d = await res.json();
                      const shareUrl = \`\${window.location.origin}/watch?v=\${encodeURIComponent(d.token || '')}\`;
                      if (navigator.share) {
                        navigator.share({ title: videoTitles[String(modal.id)] || videoTitle(modal.id), url: shareUrl });
                      } else {
                        navigator.clipboard.writeText(shareUrl);
                      }
                    } catch(err) {}
                    setShareCopied(modal.id);
                    setTimeout(() => setShareCopied(null), 2000);
                  }}`;

// Find and fix grid share button
const oldGrid = `onClick={(e) => {
          e.stopPropagation();
          const shareUrl = \`\${window.location.origin}/watch/\${id}\`;
          if (navigator.share) navigator.share({ title: videoTitle(id), url: shareUrl });
          else { navigator.clipboard?.writeText(shareUrl); }`;

const newGrid = `onClick={async (e) => {
          e.stopPropagation();
          try {
            const res = await fetch(\`/api/hwasi/share/\${id}\`);
            const d = await res.json();
            const shareUrl = \`\${window.location.origin}/watch?v=\${encodeURIComponent(d.token || '')}\`;
            if (navigator.share) navigator.share({ title: videoTitle(id), url: shareUrl });
            else { navigator.clipboard?.writeText(shareUrl); }
          } catch(err) {}`;

if (c.includes(oldModal)) {
  c = c.replace(oldModal, newModal);
  console.log('Fixed modal share');
} else {
  console.log('Modal share not found - checking current content...');
  // Find what's there
  const idx = c.indexOf('/watch/');
  console.log('First /watch/ at:', idx, c.substring(Math.max(0, idx-50), idx+100));
}

if (c.includes(oldGrid)) {
  c = c.replace(oldGrid, newGrid);
  console.log('Fixed grid share');
} else {
  console.log('Grid share not found');
}

fs.writeFileSync(path, c);
console.log('Done');
