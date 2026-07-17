const fs = require('fs');
const path = 'app/gallery/page.js';
let content = fs.readFileSync(path, 'utf8');

// Replace modal share logic
content = content.replace(
  /onClick=\{\(\) => \{\s*const shareUrl = \\$\{window\.location\.origin\}\/watch\/\$\{modal\.id\}\;\s*if \(navigator\.share\) \{\s*navigator\.share\(\{ title: videoTitles\[String\(modal\.id\)\] \|\| videoTitle\(modal\.id\), url: shareUrl \}\);\s*\} else \{\s*navigator\.clipboard\.writeText\(shareUrl\);\s*\}\s*setShareCopied\(modal\.id\);\s*setTimeout\(\(\) => setShareCopied\(null\), 2000\);\s*\}\}/,
  \onClick={async () => {
                      try {
                        const res = await fetch(\\\/api/hwasi/share/\\\\\\);
                        const { token } = await res.json();
                        const shareUrl = \\\\\\/watch?v=\\\\\\;
                        if (navigator.share) {
                          await navigator.share({ title: videoTitles[String(modal.id)] || videoTitle(modal.id), url: shareUrl });
                        } else {
                          await navigator.clipboard.writeText(shareUrl);
                        }
                      } catch (e) {
                        console.error('Share failed', e);
                      }
                      setShareCopied(modal.id);
                      setTimeout(() => setShareCopied(null), 2000);
                    }}\
);

// Replace grid share logic
content = content.replace(
  /onClick=\{\(e\) => \{\s*e\.stopPropagation\(\);\s*const shareUrl = \\$\{window\.location\.origin\}\/watch\/\$\{id\}\;\s*if \(navigator\.share\) navigator\.share\(\{ title: videoTitle\(id\), url: shareUrl \}\);\s*else \{ navigator\.clipboard\?\.writeText\(shareUrl\); \}\s*\}\}/,
  \onClick={async (e) => {
            e.stopPropagation();
            try {
              const res = await fetch(\\\/api/hwasi/share/\\\\\\);
              const { token } = await res.json();
              const shareUrl = \\\\\\/watch?v=\\\\\\;
              if (navigator.share) await navigator.share({ title: videoTitle(id), url: shareUrl });
              else await navigator.clipboard?.writeText(shareUrl);
            } catch (err) {
              console.error('Share failed', err);
            }
          }}\
);

fs.writeFileSync(path, content);
