const fs = require('fs');
const path = 'app/gallery/page.js';
let content = fs.readFileSync(path, 'utf8');

const oldModalShare = "onClick={() => {\n                      const shareUrl = \\/watch/\\;\n                      if (navigator.share) {\n                        navigator.share({ title: videoTitles[String(modal.id)] || videoTitle(modal.id), url: shareUrl });\n                      } else {\n                        navigator.clipboard.writeText(shareUrl);\n                      }\n                      setShareCopied(modal.id);\n                      setTimeout(() => setShareCopied(null), 2000);\n                    }}";

const newModalShare = "onClick={async () => {\n                      try {\n                        const res = await fetch(\/api/hwasi/share/\\);\n                        const { token } = await res.json();\n                        const shareUrl = \\/watch?v=\\;\n                        if (navigator.share) {\n                          await navigator.share({ title: videoTitles[String(modal.id)] || videoTitle(modal.id), url: shareUrl });\n                        } else {\n                          await navigator.clipboard.writeText(shareUrl);\n                        }\n                      } catch (e) {\n                         console.error('Share failed', e);\n                      }\n                      setShareCopied(modal.id);\n                      setTimeout(() => setShareCopied(null), 2000);\n                    }}";

content = content.replace(oldModalShare, newModalShare);

const oldGridShare = "onClick={(e) => {\n            e.stopPropagation();\n            const shareUrl = \\/watch/\\;\n            if (navigator.share) navigator.share({ title: videoTitle(id), url: shareUrl });\n            else { navigator.clipboard?.writeText(shareUrl); }\n          }} />";

const newGridShare = "onClick={async (e) => {\n            e.stopPropagation();\n            try {\n              const res = await fetch(\/api/hwasi/share/\\);\n              const { token } = await res.json();\n              const shareUrl = \\/watch?v=\\;\n              if (navigator.share) await navigator.share({ title: videoTitle(id), url: shareUrl });\n              else await navigator.clipboard?.writeText(shareUrl);\n            } catch (err) {\n              console.error('Share failed', err);\n            }\n          }} />";

content = content.replace(oldGridShare, newGridShare);

fs.writeFileSync(path, content);
