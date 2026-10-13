/**
 * fix-hindibf-cdn-range.mjs
 * Adds missing CDN mappings for hindibf videos 10244–10655
 * (system IDs = actual CDN video ID + 10000)
 * 
 * Run: node fix-hindibf-cdn-range.mjs
 */

const REDIS_URL   = 'https://relaxed-joey-122660.upstash.io';
const REDIS_TOKEN = 'gQAAAAAAAd8kAQIgcDE5MDcyNTE5ODEzNTM0MjE5ODBkMmFkNDJhNzZmYzBkYQ';
const OFFSET      = 10000;

// The range the user just added (10244-10655)
const NEW_CDN_START = 244;   // actual hindibf CDN video IDs
const NEW_CDN_END   = 655;

async function redisCmd(cmd) {
  const res = await fetch(REDIS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  return res.json();
}

console.log(`\n🔧 Fixing CDN mappings for system IDs ${OFFSET + NEW_CDN_START}–${OFFSET + NEW_CDN_END}`);
console.log(`   (hindibf CDN IDs ${NEW_CDN_START}–${NEW_CDN_END})`);

// Step 1: Build and store CDN mappings in hwasi:video_cdn
console.log('\n⏳ Step 1: Storing CDN mappings...');
const cdnMapArgs = [];
for (let cdnId = NEW_CDN_START; cdnId <= NEW_CDN_END; cdnId++) {
  const systemId = OFFSET + cdnId;
  cdnMapArgs.push(String(systemId));
  cdnMapArgs.push(JSON.stringify({ cdn: 'hindibf', vid: String(cdnId) }));
}
const r1 = await redisCmd(['HSET', 'hwasi:video_cdn', ...cdnMapArgs]);
console.log(`   ✅ CDN map result: added ${(NEW_CDN_END - NEW_CDN_START + 1)} entries. Result:`, JSON.stringify(r1));

// Step 2: Verify a sample entry
const sample = await redisCmd(['HGET', 'hwasi:video_cdn', String(OFFSET + NEW_CDN_START)]);
console.log(`\n🔍 Verify system ID ${OFFSET + NEW_CDN_START}:`, JSON.stringify(sample));
const sample2 = await redisCmd(['HGET', 'hwasi:video_cdn', String(OFFSET + NEW_CDN_END)]);
console.log(`🔍 Verify system ID ${OFFSET + NEW_CDN_END}:`, JSON.stringify(sample2));

// Step 3: Update hwasi:extra_cdns registry with new full range
console.log('\n⏳ Step 2: Updating CDN registry (hwasi:extra_cdns)...');
const existing = await redisCmd(['GET', 'hwasi:extra_cdns']);
let cdnList = [];
try {
  const raw = typeof existing.result === 'string' ? JSON.parse(existing.result) : (existing.result || []);
  cdnList = Array.isArray(raw) ? raw : [];
} catch { cdnList = []; }

// Remove old hindibf entry and replace with updated one
cdnList = cdnList.filter(c => c.cdnId !== 'hindibf');
cdnList.push({
  name:        'HindiBF',
  cdnId:       'hindibf',
  cdnBase:     'https://cdn.hindibf.com.co',
  count:       NEW_CDN_END,  // total CDN IDs (1-655)
  cdnRange:    { min: 1, max: NEW_CDN_END },
  systemRange: { start: OFFSET + 1, end: OFFSET + NEW_CDN_END },
  offset:      OFFSET,
  updatedAt:   new Date().toISOString(),
});
const r3 = await redisCmd(['SET', 'hwasi:extra_cdns', JSON.stringify(cdnList)]);
console.log('   Registry result:', JSON.stringify(r3));

// Step 4: Update settings extraRanges to cover full 10001-10655
console.log('\n⏳ Step 3: Updating settings extraRanges...');
const settingsRaw = await redisCmd(['GET', 'hwasi:settings']);
let settings = {};
try {
  settings = typeof settingsRaw.result === 'string' ? JSON.parse(settingsRaw.result) : (settingsRaw.result || {});
} catch { settings = {}; }

// Update or add the hindibf extra range
const existingRanges = (settings.extraRanges || []).filter(r => r.cdnId !== 'hindibf');
existingRanges.push({ start: OFFSET + 1, end: OFFSET + NEW_CDN_END, cdnId: 'hindibf' });
settings.extraRanges = existingRanges;

const r4 = await redisCmd(['SET', 'hwasi:settings', JSON.stringify(settings)]);
console.log('   Settings result:', JSON.stringify(r4));

console.log('\n✅ Migration complete!');
console.log(`   📹 ${NEW_CDN_END - NEW_CDN_START + 1} new CDN mappings added (system IDs ${OFFSET + NEW_CDN_START}–${OFFSET + NEW_CDN_END})`);
console.log(`   🌐 Videos now routable to: https://cdn.hindibf.com.co/{244-655}.mp4`);
console.log(`   ⚙️  Settings updated: hindibf range now ${OFFSET + 1}–${OFFSET + NEW_CDN_END}`);
console.log('\n   🎉 Videos 10244-10655 should now play correctly!');
