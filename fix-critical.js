const fs = require('fs');

// ================================================================
// FIX 1: views/route.js — block instaviral for free users server-side
// ================================================================
let views = fs.readFileSync('app/api/hwasi/views/route.js', 'utf8');

// Add instaviral check after premium check in POST
views = views.replace(
  `  // Check premium status\n  const sub = await getPremium(session.sub);\n  if (sub) {\n    const token = await signVideoId(videoId);\n    return NextResponse.json(await encryptPayload({ allowed: true, isPremium: true, plan: sub.plan, expiresAt: sub.expiresAt, token }));\n  }`,
  `  // Check premium status\n  const sub = await getPremium(session.sub);\n\n  // Check if video is Insta Viral — only premium can watch\n  const instaviralList = await redis.get('hwasi:curated:instaviral');\n  let instaviralIds = [];\n  try { instaviralIds = instaviralList ? JSON.parse(instaviralList) : []; } catch {}\n  const isInstaViral = instaviralIds.map(Number).includes(Number(videoId));\n  if (isInstaViral && !sub && !['admin','advisor'].includes(session.role)) {\n    return NextResponse.json(await encryptPayload({ allowed: false, code: 'INSTAVIRAL_PREMIUM_ONLY', msg: '💎 Insta Viral videos are exclusive to Premium members. Upgrade to unlock!' }));\n  }\n\n  if (sub) {\n    const token = await signVideoId(videoId);\n    return NextResponse.json(await encryptPayload({ allowed: true, isPremium: true, plan: sub.plan, expiresAt: sub.expiresAt, token }));\n  }`
);

// Add isPremium to GET response
views = views.replace(
  `  if (sub) return NextResponse.json(await encryptPayload({ allowed: true, isPremium: true, plan: sub.plan, expiresAt: sub.expiresAt }));`,
  `  if (sub) return NextResponse.json(await encryptPayload({ allowed: true, isPremium: true, plan: sub.plan, expiresAt: sub.expiresAt }));\n`
);

fs.writeFileSync('app/api/hwasi/views/route.js', views);
console.log('views route fixed');

// ================================================================
// FIX 2: watch-shared/route.js — block instaviral for free users
// ================================================================
let ws = fs.readFileSync('app/api/hwasi/watch-shared/route.js', 'utf8');

ws = ws.replace(
  `  // Check premium from DB\n  const sub = await getPremium(session.sub);\n  if (sub) {`,
  `  // Check if video is Insta Viral — premium only even via share link\n  const instaRaw = await redis.get('hwasi:curated:instaviral');\n  let instaIds = [];\n  try { instaIds = instaRaw ? JSON.parse(instaRaw).map(Number) : []; } catch {}\n  const isInstaViral = instaIds.includes(Number(videoId));\n\n  // Check premium from DB\n  const sub = await getPremium(session.sub);\n\n  if (isInstaViral && !sub) {\n    return NextResponse.json(await encryptPayload({ allowed: false, code: 'INSTAVIRAL_PREMIUM_ONLY', msg: '💎 This Insta Viral video is for Premium members only. Upgrade to watch!' }), { status: 403 });\n  }\n\n  if (sub) {`
);

fs.writeFileSync('app/api/hwasi/watch-shared/route.js', ws);
console.log('watch-shared fixed');

// ================================================================
// FIX 3: gallery/page.js — add isPremium state, fix instaviral check,
//         fix settings load, hide download on instaviral
// ================================================================
let g = fs.readFileSync('app/gallery/page.js', 'utf8');

// Add isPremium state next to viewStatus
g = g.replace(
  `  const [viewStatus, setViewStatus] = useState(null);\r\n`,
  `  const [viewStatus, setViewStatus] = useState(null);\r\n  const [isPremium, setIsPremium] = useState(false);\r\n`
);

// Set isPremium when viewStatus loads
g = g.replace(
  `        setViewStatus(vs);\r\n`,
  `        setViewStatus(vs);\r\n        if (vs?.isPremium || ['admin','advisor'].includes(d.role)) setIsPremium(true);\r\n`
);

// Fix isPrivileged to also use pre-loaded isPremium state
g = g.replace(
  `    const isPrivileged = viewStatus?.isPremium || user?.role === 'admin' || user?.role === 'advisor';`,
  `    const isPrivileged = isPremium || viewStatus?.isPremium || user?.role === 'admin' || user?.role === 'advisor';`
);

// Add isPremium to useCallback deps
g = g.replace(
  `  }, [allIds, viewStatus, user, instaviralIds]);`,
  `  }, [allIds, viewStatus, user, instaviralIds, isPremium]);`
);

// Hide download button for instaviral videos in VideoCard calls — pass isInstaviral prop
// Find the VideoCard onDownload prop and add conditional
g = g.replace(
  `              onDownload={(e) => handleDownload(e, id)}`,
  `              onDownload={instaviralIds.includes(Number(id)) ? null : (e) => handleDownload(e, id)}`
);
// Also for second occurrence (in different tab render)
const beforeCount = (g.match(/onDownload=\{instaviralIds\.includes/g) || []).length;

fs.writeFileSync('app/gallery/page.js', g);
console.log('gallery fixed. isPremium occurrences:', (g.match(/isPremium/g)||[]).length);
console.log('instaviral download null:', (g.match(/onDownload=\{instaviralIds/g)||[]).length);

// ================================================================
// FIX 4: register/page.js — decode encrypted settings properly
// ================================================================
let reg = fs.readFileSync('app/register/page.js', 'utf8');

// Replace plain fetch for settings with secureFetch + proper decode
reg = reg.replace(
  `    // Fetch settings to check if OTP is required\n    fetch('/api/hwasi/settings').then(r => r.json()).then(d => {\n      const s = d?.data ? d.data : d;\n      if (typeof s?.otpRequired === 'boolean') setOtpRequired(s.otpRequired);\n    }).catch(() => {});`,
  `    // Fetch OTP required setting (public flag endpoint)\n    fetch('/api/hwasi/reg-settings').then(r => r.json()).then(d => {\n      if (typeof d?.otpRequired === 'boolean') setOtpRequired(d.otpRequired);\n    }).catch(() => setOtpRequired(false)); // Default OFF if fetch fails`
);

fs.writeFileSync('app/register/page.js', reg);
console.log('register fixed');
console.log('All done!');
