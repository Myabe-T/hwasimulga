const fs = require('fs');
const path = 'app/gallery/page.js';
let c = fs.readFileSync(path, 'utf8');

// Fix modal share button
c = c.replace(
  `onClick={() => {
                    const shareUrl = \`\${window.location.origin}/watch/\${modal.id}\`;
                    if (navigator.share) {
                      navigator.share({ title: videoTitles[String(modal.id)] || videoTitle(modal.id), url: shareUrl });
                    } else {
                      navigator.clipboard.writeText(shareUrl);
                    }
                    setShareCopied(modal.id);
                    setTimeout(() => setShareCopied(null), 2000);
                  }}`,
  `onClick={async () => {
                    try {
                      const res = await fetch(\`/api/hwasi/share/\${modal.id}\`);
                      const d = await res.json();
                      const shareUrl = \`\${window.location.origin}/watch?v=\${encodeURIComponent(d.token)}\`;
                      if (navigator.share) {
                        navigator.share({ title: videoTitles[String(modal.id)] || videoTitle(modal.id), url: shareUrl });
                      } else {
                        navigator.clipboard.writeText(shareUrl);
                      }
                    } catch {}
                    setShareCopied(modal.id);
                    setTimeout(() => setShareCopied(null), 2000);
                  }}`
);

// Fix grid share button
c = c.replace(
  `onClick={(e) => {
          e.stopPropagation();
          const shareUrl = \`\${window.location.origin}/watch/\${id}\`;
          if (navigator.share) navigator.share({ title: videoTitle(id), url: shareUrl });
          else { navigator.clipboard?.writeText(shareUrl); }`,
  `onClick={async (e) => {
          e.stopPropagation();
          try {
            const res = await fetch(\`/api/hwasi/share/\${id}\`);
            const d = await res.json();
            const shareUrl = \`\${window.location.origin}/watch?v=\${encodeURIComponent(d.token)}\`;
            if (navigator.share) navigator.share({ title: videoTitle(id), url: shareUrl });
            else { navigator.clipboard?.writeText(shareUrl); }
          } catch {}`
);

fs.writeFileSync(path, c);
console.log('Done');
