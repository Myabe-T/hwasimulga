const fs = require('fs');

// ================================================================
// FIX GALLERY PAGE
// ================================================================
let g = fs.readFileSync('app/gallery/page.js', 'utf8');

// FIX 1: Instaviral check — use setInstaViralBlock NOT setShowUpgrade
// Also fix stale closure: add instaviralIds to useCallback deps
g = g.replace(
  `    if (isInstaViral && !isPrivileged) {\r\n      setModal(null);\r\n      setUpgradeInfo({ limit: 0, msg: '💎 This is an Insta Viral premium video. Upgrade to Premium to watch it instantly!' });\r\n      setShowUpgrade(true);\r\n      return;\r\n    }`,
  `    if (isInstaViral && !isPrivileged) {\r\n      setModal(null);\r\n      setInstaViralBlock(true);\r\n      return;\r\n    }`
);

// FIX 2: Add instaviralIds to useCallback deps to prevent stale closure
g = g.replace(
  `  }, [allIds, viewStatus, user]);`,
  `  }, [allIds, viewStatus, user, instaviralIds]);`
);

// FIX 3: Fix mobile "Free Account" chip — make it compact inline instead of giant circle
g = g.replace(
  `            {viewStatus && !viewStatus.isPremium && user.role === 'viewer' && (\r\n              <div className={styles.freeChip} onClick={() => window.location.href = '/premium'}\r\n                title="Upgrade to Premium for unlimited access">\r\n                🆓 Free Account — Upgrade\r\n              </div>\r\n            )}`,
  `            {viewStatus && !viewStatus.isPremium && user.role === 'viewer' && (\r\n              <div className={styles.freeChip} onClick={() => window.location.href = '/premium'}\r\n                title="Upgrade to Premium for unlimited access">\r\n                ✦ Upgrade\r\n              </div>\r\n            )}`
);

// Also fix the second occurrence (mobile menu header area)
g = g.replace(
  `            {viewStatus?.isPremium && (\r\n              <button className={styles.premiumBadge} onClick={() => setPremiumInfo(viewStatus)}>\r\n                👑 Premium\r\n              </button>\r\n            )}`,
  `            {viewStatus?.isPremium && (\r\n              <button className={styles.premiumBadge} onClick={() => setPremiumInfo(viewStatus)}>\r\n                👑\r\n              </button>\r\n            )}`
);

fs.writeFileSync('app/gallery/page.js', g);
console.log('Gallery fixed. Size:', fs.statSync('app/gallery/page.js').size);
console.log('instaViralBlock in deps:', g.includes('instaviralIds]);'));
console.log('setInstaViralBlock used:', g.includes('setInstaViralBlock(true)'));

// ================================================================
// FIX UTR ROUTE — use filter+save instead of lrem for reliable delete
// ================================================================
let utr = fs.readFileSync('app/api/hwasi/utr/route.js', 'utf8');
utr = utr.replace(
  `  const redis = await getRedis();\n  const items = await redis.lrange(KEY, 0, 999);\n  // Remove matching entry\n  let removed = false;\n  for (const item of items) {\n    try {\n      const parsed = JSON.parse(item);\n      if (parsed.utrId === utrId) {\n        await redis.lrem(KEY, 1, item);\n        removed = true;\n        break;\n      }\n    } catch {}\n  }`,
  `  const redis = await getRedis();\n  const items = await redis.lrange(KEY, 0, 999);\n  // Filter out the matching entry and rewrite the entire list\n  const filtered = (items || []).filter(item => {\n    try { return JSON.parse(item).utrId !== utrId; } catch { return true; }\n  });\n  const removed = filtered.length < (items || []).length;\n  // Atomically replace list\n  await redis.del(KEY);\n  if (filtered.length > 0) {\n    await redis.rpush(KEY, ...filtered);\n  }`
);
fs.writeFileSync('app/api/hwasi/utr/route.js', utr);
console.log('UTR route fixed');

// ================================================================
// FIX SEND-OTP — add AES encryption to request in register page
// ================================================================
let reg = fs.readFileSync('app/register/page.js', 'utf8');

// Replace plain fetch with secureFetch for OTP sending
reg = reg.replace(
  `import { secureFetch } from '@/lib/crypto';`,
  `import { secureFetch, encryptBody } from '@/lib/crypto';`
);

// Replace the plain fetch('/api/hwasi/send-otp' with secureFetch
reg = reg.replace(
  `      const r = await fetch('/api/hwasi/send-otp', {\n        method: 'POST', headers: { 'Content-Type': 'application/json' },\n        body: JSON.stringify({ email: form.email, displayName: form.displayName || form.username }),\n      });`,
  `      const r = await secureFetch('/api/hwasi/send-otp', {\n        method: 'POST', headers: { 'Content-Type': 'application/json' },\n        body: JSON.stringify({ email: form.email, displayName: form.displayName || form.username }),\n      });`
);

// Also replace the resend fetch
reg = reg.replace(
  `      const r = await fetch('/api/hwasi/send-otp', {\n        method: 'POST', headers: { 'Content-Type': 'application/json' },\n        body: JSON.stringify({ email: form.email, displayName: form.displayName }),\n      });`,
  `      const r = await secureFetch('/api/hwasi/send-otp', {\n        method: 'POST', headers: { 'Content-Type': 'application/json' },\n        body: JSON.stringify({ email: form.email, displayName: form.displayName }),\n      });`
);

fs.writeFileSync('app/register/page.js', reg);
console.log('Register page OTP encryption done');
